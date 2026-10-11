import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { MailService } from '../common/mail/mail.service';
import { priceMaxAgeDays } from '../common/price-freshness';

type Severity = 'WARNING' | 'CRITICAL';
type QualityIssue = {
  checkCode: string;
  severity: Severity;
  marketCode?: string;
  actual?: number;
  threshold?: number;
  message: string;
  details?: Record<string, unknown>;
};

@Injectable()
export class DataQualityService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async run(requestedBy: 'ADMIN' | 'SCHEDULER' = 'ADMIN') {
    const batch = await this.db.query(
      `insert into batch_job_run(batch_code,status_code,requested_by_type)
       values('DATA_QUALITY_CHECK','RUNNING',$1) returning batch_run_id`,
      [requestedBy],
    );
    const batchRunId = batch.rows[0].batch_run_id;
    const quality = await this.db.query(
      `insert into data_quality_run(batch_run_id,status_code)
       values($1,'RUNNING') returning data_quality_run_id`,
      [batchRunId],
    );
    const runId = quality.rows[0].data_quality_run_id;

    try {
      const { issues, checkedCount, snapshots, thresholds } = await this.collect();
      const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;
      const criticalCount = issues.filter((issue) => issue.severity === 'CRITICAL').length;
      const status = criticalCount ? 'CRITICAL' : warningCount ? 'WARNING' : 'PASS';
      const signature = createHash('sha256')
        .update(
          issues
            .map((issue) => `${issue.checkCode}:${issue.marketCode ?? '-'}:${issue.severity}`)
            .sort()
            .join('|'),
        )
        .digest('hex');
      const summary = { status, signature, thresholds, snapshots };

      const client = await this.db.connect();
      try {
        await client.query('begin');
        for (const issue of issues) {
          await client.query(
            `insert into data_quality_issue(
               data_quality_run_id,check_code,severity_code,market_code,
               actual_value,threshold_value,message,details_json
             ) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
            [
              runId,
              issue.checkCode,
              issue.severity,
              issue.marketCode ?? null,
              issue.actual ?? null,
              issue.threshold ?? null,
              issue.message,
              JSON.stringify(issue.details ?? {}),
            ],
          );
        }
        await client.query(
          `update data_quality_run set
             status_code=$2,ended_at=now(),checked_count=$3,
             warning_count=$4,critical_count=$5,summary_json=$6::jsonb
           where data_quality_run_id=$1`,
          [runId, status, checkedCount, warningCount, criticalCount, JSON.stringify(summary)],
        );
        await client.query(
          `update batch_job_run set
             status_code=$2,ended_at=now(),error_count=$3,summary_json=$4::jsonb
           where batch_run_id=$1`,
          [
            batchRunId,
            criticalCount ? 'PARTIAL_SUCCESS' : 'SUCCESS',
            criticalCount,
            JSON.stringify({ qualityRunId: runId, ...summary, warningCount, criticalCount }),
          ],
        );
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }

      const alertStatus = await this.sendAlert(runId, signature, status, issues);
      return {
        runId,
        batchRunId,
        status,
        checkedCount,
        warningCount,
        criticalCount,
        alertStatus,
        issues,
        snapshots,
      };
    } catch (error: any) {
      const message = String(error?.message ?? error).slice(0, 2000);
      await Promise.all([
        this.db.query(
          `update data_quality_run set status_code='FAILED',ended_at=now(),summary_json=$2::jsonb
           where data_quality_run_id=$1`,
          [runId, JSON.stringify({ error: message })],
        ),
        this.db.query(
          `update batch_job_run set status_code='FAILED',ended_at=now(),error_count=1,error_message=$2
           where batch_run_id=$1`,
          [batchRunId, message],
        ),
        this.db.query(
          `insert into application_error_log(error_code,error_class,message,stack_trace,context_json)
           values('DATA_QUALITY_CHECK_FAILED',$1,$2,$3,$4::jsonb)`,
          [
            error?.name ?? 'Error',
            message,
            error?.stack?.slice(0, 8000) ?? null,
            JSON.stringify({ runId, batchRunId }),
          ],
        ),
      ]);
      throw error;
    }
  }

  async latest(limit = 10) {
    const runs = await this.db.query(
      `select data_quality_run_id,status_code,started_at,ended_at,checked_count,
              warning_count,critical_count,summary_json,alert_status_code,alert_sent_at
       from data_quality_run order by started_at desc limit $1`,
      [Math.max(1, Math.min(limit, 50))],
    );
    if (!runs.rowCount) return { latest: null, issues: [], recent: [] };
    const latest = runs.rows[0];
    const issues = await this.db.query(
      `select data_quality_issue_id,check_code,severity_code,market_code,
              actual_value,threshold_value,message,details_json,created_at
       from data_quality_issue where data_quality_run_id=$1
       order by case severity_code when 'CRITICAL' then 0 else 1 end,check_code,market_code`,
      [latest.data_quality_run_id],
    );
    return { latest, issues: issues.rows, recent: runs.rows };
  }

  private async collect() {
    const thresholds = {
      priceMaxAgeDays: priceMaxAgeDays(this.config),
      financialMaxAgeDays: this.numberConfig('DATA_QUALITY_FINANCIAL_MAX_AGE_DAYS', 550, 30, 1500),
      minPriceCoveragePercent: this.numberConfig(
        'DATA_QUALITY_MIN_PRICE_COVERAGE_PERCENT',
        80,
        0,
        100,
      ),
      minMetricCoveragePercent: this.numberConfig(
        'DATA_QUALITY_MIN_METRIC_COVERAGE_PERCENT',
        70,
        0,
        100,
      ),
      stuckBatchMinutes: this.numberConfig('DATA_QUALITY_STUCK_BATCH_MINUTES', 180, 10, 1440),
      recentFailureHours: this.numberConfig('DATA_QUALITY_RECENT_FAILURE_HOURS', 24, 1, 168),
    };
    const [priceRows, financialRows, invalidRows, stuckRows, failedRows] = await Promise.all([
      this.priceSnapshots(),
      this.financialSnapshots(),
      this.invalidLatestPrices(),
      this.stuckBatches(thresholds.stuckBatchMinutes),
      this.recentFailedBatches(thresholds.recentFailureHours),
    ]);
    const issues: QualityIssue[] = [];
    let checkedCount = 0;

    if (!priceRows.length) {
      checkedCount++;
      issues.push({
        checkCode: 'ACTIVE_SECURITY_EMPTY',
        severity: 'CRITICAL',
        actual: 0,
        threshold: 1,
        message: '검색 가능한 활성 종목이 없습니다.',
      });
    }

    for (const row of priceRows) {
      checkedCount += 2;
      const market = row.exchange_code;
      const age = row.age_days == null ? null : Number(row.age_days);
      const coverage = Number(row.coverage_percent);
      if (age == null || age > thresholds.priceMaxAgeDays) {
        issues.push({
          checkCode: 'PRICE_FRESHNESS',
          severity: age == null || age > thresholds.priceMaxAgeDays * 2 ? 'CRITICAL' : 'WARNING',
          marketCode: market,
          actual: age ?? undefined,
          threshold: thresholds.priceMaxAgeDays,
          message: `${market} 최신 가격이 ${age == null ? '없습니다' : `${age}일 지연됐습니다`}.`,
          details: { latestPriceDate: row.latest_price_date },
        });
      }
      if (coverage < thresholds.minPriceCoveragePercent) {
        issues.push({
          checkCode: 'PRICE_COVERAGE',
          severity: coverage < thresholds.minPriceCoveragePercent / 2 ? 'CRITICAL' : 'WARNING',
          marketCode: market,
          actual: coverage,
          threshold: thresholds.minPriceCoveragePercent,
          message: `${market} 가격 커버리지가 ${coverage}%입니다.`,
          details: {
            activeSecurities: Number(row.active_securities),
            coveredSecurities: Number(row.covered_securities),
          },
        });
      }
    }

    for (const row of financialRows) {
      checkedCount += 2;
      const market = row.market_code;
      const age = row.age_days == null ? null : Number(row.age_days);
      const coverage = Number(row.coverage_percent);
      if (age == null || age > thresholds.financialMaxAgeDays) {
        issues.push({
          checkCode: 'FINANCIAL_FRESHNESS',
          severity: age == null ? 'CRITICAL' : 'WARNING',
          marketCode: market,
          actual: age ?? undefined,
          threshold: thresholds.financialMaxAgeDays,
          message: `${market} 최신 재무 데이터가 ${age == null ? '없습니다' : `${age}일 지연됐습니다`}.`,
          details: { latestFinancialDate: row.latest_financial_date },
        });
      }
      if (coverage < thresholds.minMetricCoveragePercent) {
        issues.push({
          checkCode: 'FINANCIAL_COVERAGE',
          severity: coverage < thresholds.minMetricCoveragePercent / 2 ? 'CRITICAL' : 'WARNING',
          marketCode: market,
          actual: coverage,
          threshold: thresholds.minMetricCoveragePercent,
          message: `${market} 재무 데이터 커버리지가 ${coverage}%입니다.`,
          details: {
            activeSecurities: Number(row.active_securities),
            coveredSecurities: Number(row.covered_securities),
          },
        });
      }
    }

    checkedCount += priceRows.length;
    for (const row of invalidRows) {
      const count = Number(row.invalid_count);
      if (count) {
        issues.push({
          checkCode: 'INVALID_LATEST_PRICE',
          severity: 'CRITICAL',
          marketCode: row.exchange_code,
          actual: count,
          threshold: 0,
          message: `${row.exchange_code} 최신 가격 이상값 ${count}건이 있습니다.`,
          details: { securityIds: row.security_ids },
        });
      }
    }

    checkedCount += 2;
    if (stuckRows.length) {
      issues.push({
        checkCode: 'BATCH_STUCK',
        severity: 'CRITICAL',
        actual: stuckRows.length,
        threshold: 0,
        message: `제한시간을 넘긴 실행 중 배치가 ${stuckRows.length}건 있습니다.`,
        details: { batches: stuckRows },
      });
    }
    if (failedRows.length) {
      issues.push({
        checkCode: 'RECENT_BATCH_FAILURE',
        severity: 'WARNING',
        actual: failedRows.length,
        threshold: 0,
        message: `최근 실패·부분 성공 배치가 ${failedRows.length}건 있습니다.`,
        details: { batches: failedRows },
      });
    }

    return {
      issues,
      checkedCount,
      thresholds,
      snapshots: { prices: priceRows, financials: financialRows },
    };
  }

  private async priceSnapshots() {
    const result = await this.db.query(
      `with latest as (
         select security_id,max(trade_date) latest_price_date
         from daily_price group by security_id
       )
       select e.market_code,e.exchange_code,count(*)::int active_securities,
              count(l.security_id)::int covered_securities,
              round(count(l.security_id)::numeric/nullif(count(*),0)*100,2) coverage_percent,
              max(l.latest_price_date) latest_price_date,
              (current_date-max(l.latest_price_date))::int age_days
       from security s
       join company c on c.company_id=s.company_id and c.is_active=true
       join exchange e on e.exchange_id=s.exchange_id and e.is_active=true
       left join latest l on l.security_id=s.security_id
       where s.is_active=true
       group by e.market_code,e.exchange_code
       order by e.market_code,e.exchange_code`,
    );
    return result.rows;
  }

  private async financialSnapshots() {
    const result = await this.db.query(
      `with coverage as (
         select s.security_id,e.market_code,
                max(l.as_of_date) filter(where l.source_type='FINANCIAL_FACT') latest_financial_date
         from security s
         join company c on c.company_id=s.company_id and c.is_active=true
         join exchange e on e.exchange_id=s.exchange_id and e.is_active=true
         left join latest_metric_value l on l.security_id=s.security_id
         where s.is_active=true
         group by s.security_id,e.market_code
       )
       select market_code,count(*)::int active_securities,
              count(latest_financial_date)::int covered_securities,
              round(count(latest_financial_date)::numeric/nullif(count(*),0)*100,2) coverage_percent,
              max(latest_financial_date) latest_financial_date,
              (current_date-max(latest_financial_date))::int age_days
       from coverage group by market_code order by market_code`,
    );
    return result.rows;
  }

  private async invalidLatestPrices() {
    const result = await this.db.query(
      `with latest as (
         select distinct on(p.security_id) p.security_id,p.close_price,p.high_price,
                p.low_price,p.volume
         from daily_price p order by p.security_id,p.trade_date desc,p.updated_at desc
       )
       select e.exchange_code,count(*)::int invalid_count,
              (array_agg(s.security_id order by s.security_id))[1:20] security_ids
       from latest p
       join security s on s.security_id=p.security_id
       join exchange e on e.exchange_id=s.exchange_id
       where p.close_price<=0 or p.high_price<p.low_price
          or p.close_price<p.low_price or p.close_price>p.high_price
          or coalesce(p.volume,0)<0
       group by e.exchange_code order by e.exchange_code`,
    );
    return result.rows;
  }

  private async stuckBatches(minutes: number) {
    const result = await this.db.query(
      `select batch_run_id,batch_code,started_at
       from batch_job_run
       where status_code='RUNNING' and started_at<now()-($1::text||' minutes')::interval
       order by started_at limit 20`,
      [minutes],
    );
    return result.rows;
  }

  private async recentFailedBatches(hours: number) {
    const result = await this.db.query(
      `select batch_run_id,batch_code,status_code,started_at,error_count
       from batch_job_run
       where batch_code<>'DATA_QUALITY_CHECK'
         and status_code in('FAILED','PARTIAL_SUCCESS')
         and started_at>=now()-($1::text||' hours')::interval
       order by started_at desc limit 20`,
      [hours],
    );
    return result.rows;
  }

  private async sendAlert(
    runId: string,
    signature: string,
    status: string,
    issues: QualityIssue[],
  ) {
    let alertStatus = 'SKIPPED_NO_ISSUES';
    let sentAt: Date | null = null;
    if (issues.length) {
      const enabled = this.config.get<string>('OPS_ALERT_EMAIL_ENABLED') === 'true';
      const recipients = (this.config.get<string>('OPS_ALERT_EMAILS') ?? '')
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      if (!enabled) alertStatus = 'SKIPPED_DISABLED';
      else if (!recipients.length) alertStatus = 'SKIPPED_NO_RECIPIENT';
      else {
        const cooldownHours = this.numberConfig('OPS_ALERT_COOLDOWN_HOURS', 24, 1, 168);
        const duplicate = await this.db.query(
          `select 1 from data_quality_run
           where data_quality_run_id<>$1 and summary_json->>'signature'=$2
             and alert_sent_at>=now()-($3::text||' hours')::interval
           limit 1`,
          [runId, signature, cooldownHours],
        );
        if (duplicate.rowCount) alertStatus = 'SKIPPED_DUPLICATE';
        else {
          try {
            await this.mail.sendOperationalAlert(recipients, { status, issues });
            alertStatus = 'SENT';
            sentAt = new Date();
          } catch (error: any) {
            alertStatus = 'FAILED';
            await this.db.query(
              `insert into application_error_log(error_code,error_class,message,stack_trace,context_json)
               values('OPS_ALERT_EMAIL_FAILED',$1,$2,$3,$4::jsonb)`,
              [
                error?.name ?? 'Error',
                String(error?.message ?? error).slice(0, 2000),
                error?.stack?.slice(0, 8000) ?? null,
                JSON.stringify({ runId, recipientCount: recipients.length }),
              ],
            );
          }
        }
      }
    }
    await this.db.query(
      `update data_quality_run set alert_status_code=$2,alert_sent_at=$3
       where data_quality_run_id=$1`,
      [runId, alertStatus, sentAt],
    );
    return alertStatus;
  }

  private numberConfig(key: string, fallback: number, min: number, max: number) {
    const parsed = Number(this.config.get(key) ?? fallback);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(parsed, max)) : fallback;
  }
}
