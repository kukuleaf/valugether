import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { NoFinancialDataError } from '../providers/core/financial-data.provider';
import { NormalizedFinancialFact } from '../providers/core/normalized-models';
import { DartProvider } from '../providers/dart/dart.provider';
import { SecProvider } from '../providers/sec/sec.provider';

@Injectable()
export class FinancialSyncService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly dart: DartProvider,
    private readonly sec: SecProvider,
  ) {}

  async run(market: string, requestedLimit = 20, resetCursor = false, stopOnError = false) {
    const marketCode = market.toUpperCase();
    if (marketCode !== 'KR' && marketCode !== 'US') throw new Error('market must be KR or US');
    const limit = Math.max(1, Math.min(Number(requestedLimit) || 20, 200));
    const provider = marketCode === 'KR' ? this.dart : this.sec;
    const externalColumn = marketCode === 'KR' ? 'dart_corp_code' : 'sec_cik';
    const batchCode = marketCode === 'KR' ? 'DART_FINANCIAL_SYNC' : 'SEC_FINANCIAL_SYNC';
    const checkpointKey = `FINANCIAL_SYNC_CURSOR_${marketCode}`;
    if (resetCursor) await this.saveCursor(checkpointKey, '0');
    let cursorStart = await this.loadCursor(checkpointKey);
    let companies = await this.loadCompanies(marketCode, externalColumn, cursorStart, limit);
    let wrappedAtStart = false;
    if (!companies.rowCount && cursorStart !== '0') {
      cursorStart = '0';
      wrappedAtStart = true;
      await this.saveCursor(checkpointKey, cursorStart);
      companies = await this.loadCompanies(marketCode, externalColumn, cursorStart, limit);
    }
    const providerRow = await this.db.query(
      'select provider_id from data_provider where provider_code=$1',
      [provider.code],
    );
    if (!providerRow.rowCount) throw new Error(`provider not seeded: ${provider.code}`);
    const providerId = Number(providerRow.rows[0].provider_id);
    const run = await this.db.query(
      `insert into batch_job_run(batch_code,status_code,requested_by_type)
       values($1,'RUNNING','ADMIN') returning batch_run_id`,
      [batchCode],
    );
    const runId = run.rows[0].batch_run_id;
    let updated = 0;
    let noData = 0;
    let factsReceived = 0;
    let errors = 0;
    const failures: Array<{ externalCompanyId: string; error: string }> = [];
    const noDataCompanies: Array<{ externalCompanyId: string; reason: string }> = [];

    try {
      for (const company of companies.rows) {
        try {
          const facts = await provider.fetchCompanyFacts(company.external_company_id);
          if (!facts.length) {
            noData++;
            noDataCompanies.push({
              externalCompanyId: company.external_company_id,
              reason: 'EMPTY_RESPONSE',
            });
          } else {
            await this.persistCompanyFacts(
              Number(company.company_id),
              Number(company.security_id),
              providerId,
              facts,
            );
            factsReceived += facts.length;
            updated++;
          }
        } catch (error: any) {
          if (error instanceof NoFinancialDataError) {
            noData++;
            noDataCompanies.push({
              externalCompanyId: company.external_company_id,
              reason: error.reason,
            });
          } else {
            errors++;
            failures.push({
              externalCompanyId: company.external_company_id,
              error: String(error?.message ?? error).slice(0, 300),
            });
            if (stopOnError) throw error;
          }
        }
        await this.saveCursor(checkpointKey, String(company.company_id));
        if (marketCode === 'US') await new Promise((resolve) => setTimeout(resolve, 120));
      }
    } catch (error: any) {
      await this.db.query(
        `update batch_job_run set status_code='FAILED',ended_at=now(),updated_count=$2,
           skipped_count=$3,error_count=$4,error_message=$5,
           summary_json=$6::jsonb where batch_run_id=$1`,
        [
          runId,
          updated,
          noData,
          Math.max(errors, 1),
          String(error?.message ?? error).slice(0, 2000),
          JSON.stringify({
            market: marketCode,
            provider: provider.code,
            cursorStart,
            updated,
            noData,
            factsReceived,
            errors: Math.max(errors, 1),
            noDataCompanies,
            failures,
          }),
        ],
      );
      throw error;
    }

    const cursorEnd = companies.rowCount
      ? String(companies.rows[companies.rows.length - 1].company_id)
      : cursorStart;
    const hasMore = companies.rowCount
      ? await this.hasMoreCompanies(marketCode, externalColumn, cursorEnd)
      : false;
    const nextCursor = hasMore ? cursorEnd : '0';
    await this.saveCursor(checkpointKey, nextCursor);
    const summary = {
      market: marketCode,
      provider: provider.code,
      cursorStart,
      cursorEnd,
      nextCursor,
      cycleCompleted: !hasMore,
      wrappedAtStart,
      requested: companies.rowCount,
      updated,
      noData,
      factsReceived,
      errors,
      noDataCompanies,
      failures,
    };

    await this.db.query(
      `update batch_job_run set status_code=$2,ended_at=now(),updated_count=$3,
         skipped_count=$4,error_count=$5,summary_json=$6::jsonb where batch_run_id=$1`,
      [
        runId,
        errors ? (updated ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS',
        updated,
        noData,
        errors,
        JSON.stringify(summary),
      ],
    );
    return {
      runId,
      ...summary,
    };
  }

  private async loadCompanies(
    marketCode: string,
    externalColumn: 'dart_corp_code' | 'sec_cik',
    cursor: string,
    limit: number,
  ) {
    return this.db.query(
      `select distinct on(c.company_id)
         c.company_id,c.${externalColumn} external_company_id,s.security_id
       from company c
       join security s on s.company_id=c.company_id and s.is_active=true
       join exchange e on e.exchange_id=s.exchange_id and e.market_code=$1
       where c.is_active=true and c.${externalColumn} is not null and c.company_id>$2::bigint
       order by c.company_id,s.security_id
       limit $3`,
      [marketCode, cursor, limit],
    );
  }

  private async hasMoreCompanies(
    marketCode: string,
    externalColumn: 'dart_corp_code' | 'sec_cik',
    cursor: string,
  ) {
    const result = await this.db.query(
      `select 1
       from company c
       join security s on s.company_id=c.company_id and s.is_active=true
       join exchange e on e.exchange_id=s.exchange_id and e.market_code=$1
       where c.is_active=true and c.${externalColumn} is not null and c.company_id>$2::bigint
       limit 1`,
      [marketCode, cursor],
    );
    return Boolean(result.rowCount);
  }

  private async loadCursor(key: string) {
    const result = await this.db.query(
      'select setting_value from system_setting where setting_key=$1',
      [key],
    );
    const value = String(result.rows[0]?.setting_value ?? '0');
    return /^\d+$/.test(value) ? value : '0';
  }

  private async saveCursor(key: string, cursor: string) {
    await this.db.query(
      `insert into system_setting(setting_key,setting_value,value_type,description)
       values($1,$2,'NUMBER','재무 동기화 재시작용 마지막 company_id')
       on conflict(setting_key) do update set setting_value=excluded.setting_value,updated_at=now()`,
      [key, cursor],
    );
  }

  private async persistCompanyFacts(
    companyId: number,
    securityId: number,
    providerId: number,
    facts: NormalizedFinancialFact[],
  ) {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      for (const fact of facts) {
        const metric = await client.query(
          'select metric_id from financial_metric where metric_code=$1 and is_active=true',
          [fact.metricCode],
        );
        if (!metric.rowCount) continue;
        const period = await client.query(
          `insert into financial_period(
             company_id,period_type,fiscal_year,fiscal_quarter,start_date,end_date,filing_date,
             report_type,consolidation_code,source_provider_id,source_report_id
           ) values($1,$2,$3,$4,$5,$6,$7,'ANNUAL',$8,$9,$10)
           on conflict(company_id,source_provider_id,source_report_id,end_date) do update set
             filing_date=excluded.filing_date
           returning financial_period_id`,
          [
            companyId,
            fact.periodType,
            fact.fiscalYear ?? null,
            fact.fiscalQuarter ?? null,
            fact.startDate ?? null,
            fact.endDate,
            fact.filingDate ?? null,
            fact.providerCode === 'DART' ? 'CFS' : null,
            providerId,
            fact.sourceReportId,
          ],
        );
        const factRow = await client.query(
          `insert into financial_fact(
             financial_period_id,metric_id,numeric_value,currency_code,unit_code,
             source_external_metric,source_context_id
           ) values($1,$2,$3,$4,$5,$6,$7)
           on conflict(financial_period_id,metric_id,source_context_id) do update set
             numeric_value=excluded.numeric_value,currency_code=excluded.currency_code,
             unit_code=excluded.unit_code,source_external_metric=excluded.source_external_metric,
             updated_at=now()
           returning financial_fact_id`,
          [
            period.rows[0].financial_period_id,
            metric.rows[0].metric_id,
            fact.value,
            fact.currency ?? null,
            fact.unit ?? null,
            fact.sourceExternalMetric,
            fact.sourceContextId ?? '',
          ],
        );
        await client.query(
          `insert into latest_metric_value(
             security_id,metric_id,numeric_value,as_of_date,source_type,source_ref_id
           ) values($1,$2,$3,$4,'FINANCIAL_FACT',$5)
           on conflict(security_id,metric_id) do update set
             numeric_value=excluded.numeric_value,as_of_date=excluded.as_of_date,
             source_type=excluded.source_type,source_ref_id=excluded.source_ref_id,updated_at=now()
           where excluded.as_of_date>=latest_metric_value.as_of_date`,
          [
            securityId,
            metric.rows[0].metric_id,
            fact.value,
            fact.endDate,
            factRow.rows[0].financial_fact_id,
          ],
        );
      }
      await this.recalculate(client, companyId, securityId, facts);
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async recalculate(
    client: PoolClient,
    companyId: number,
    securityId: number,
    facts: NormalizedFinancialFact[],
  ) {
    const byMetric = new Map<string, NormalizedFinancialFact[]>();
    for (const fact of facts) {
      const list = byMetric.get(fact.metricCode) ?? [];
      list.push(fact);
      byMetric.set(fact.metricCode, list);
    }
    for (const list of byMetric.values()) {
      list.sort((a, b) => b.endDate.localeCompare(a.endDate));
    }
    const latest = (code: string) => byMetric.get(code)?.[0]?.value;
    const priceRow = await client.query(
      `select close_price,trade_date from daily_price where security_id=$1
       order by trade_date desc limit 1`,
      [securityId],
    );
    const price = priceRow.rowCount ? Number(priceRow.rows[0].close_price) : undefined;
    const asOfDate = this.dateOnly(
      priceRow.rows[0]?.trade_date ?? [...byMetric.values()].flat()[0]?.endDate ?? new Date(),
    );
    const revenue = latest('REVENUE');
    const operatingIncome = latest('OPERATING_INCOME');
    const netIncome = latest('NET_INCOME');
    const equity = latest('TOTAL_EQUITY');
    const assets = latest('TOTAL_ASSETS');
    const liabilities = latest('TOTAL_LIABILITIES');
    const currentAssets = latest('CURRENT_ASSETS');
    const currentLiabilities = latest('CURRENT_LIABILITIES');
    const cfo = latest('CFO');
    const capex = latest('CAPEX');
    const eps = latest('EPS_BASIC');
    const shares = latest('WEIGHTED_AVG_SHARES');
    const dps = latest('DPS');
    const values: Record<string, number | undefined> = {
      CLOSE_PRICE: price,
      FREE_CASH_FLOW: cfo == null || capex == null ? undefined : cfo - Math.abs(capex),
      BPS:
        equity == null || equity <= 0 || shares == null || shares <= 0
          ? undefined
          : equity / shares,
      MARKET_CAP: price == null || shares == null ? undefined : price * shares,
      PER: price == null || price <= 0 || eps == null || eps <= 0 ? undefined : price / eps,
      ROE: netIncome == null || !equity ? undefined : (netIncome / equity) * 100,
      ROA: netIncome == null || !assets ? undefined : (netIncome / assets) * 100,
      OPERATING_MARGIN:
        operatingIncome == null || !revenue ? undefined : (operatingIncome / revenue) * 100,
      NET_MARGIN: netIncome == null || !revenue ? undefined : (netIncome / revenue) * 100,
      DEBT_RATIO: liabilities == null || !equity ? undefined : (liabilities / equity) * 100,
      CURRENT_RATIO:
        currentAssets == null || !currentLiabilities
          ? undefined
          : currentAssets / currentLiabilities,
      PROFITABLE_TTM: netIncome == null ? undefined : netIncome > 0 ? 1 : 0,
      PROFITABLE_CONSECUTIVE_YEARS: this.consecutivePositive(byMetric.get('NET_INCOME')),
      DIVIDEND_CONSECUTIVE_YEARS: this.consecutivePositive(byMetric.get('DPS')),
      DIVIDEND_YIELD: dps == null || !price ? undefined : (dps / price) * 100,
      PAYOUT_RATIO: dps == null || !eps ? undefined : (dps / eps) * 100,
      REVENUE_GROWTH_YOY: this.growth(byMetric.get('REVENUE')),
      OPERATING_INCOME_GROWTH_YOY: this.growth(byMetric.get('OPERATING_INCOME')),
      NET_INCOME_GROWTH_YOY: this.growth(byMetric.get('NET_INCOME')),
      EPS_GROWTH_YOY: this.growth(byMetric.get('EPS_BASIC')),
    };
    const bps = values.BPS;
    values.PBR = price == null || price <= 0 || bps == null || bps <= 0 ? undefined : price / bps;
    values.EARNINGS_YIELD = values.PER ? 100 / values.PER : undefined;
    for (const [metricCode, value] of Object.entries(values)) {
      if (value != null && !Number.isFinite(value)) continue;
      // Invalid valuation denominators must clear a formerly valid ratio.
      if (value == null && !['PER', 'PBR', 'BPS', 'EARNINGS_YIELD'].includes(metricCode)) continue;
      await client.query(
        `insert into latest_metric_value(
           security_id,metric_id,numeric_value,as_of_date,source_type,calculation_version
         )
         select $1,metric_id,$3,$4,'DERIVED','ACTUAL_V1'
         from financial_metric where metric_code=$2
         on conflict(security_id,metric_id) do update set
           numeric_value=excluded.numeric_value,text_value=null,as_of_date=excluded.as_of_date,
           source_type=excluded.source_type,source_ref_id=null,
           calculation_version=excluded.calculation_version,updated_at=now()`,
        [securityId, metricCode, value ?? null, asOfDate],
      );
    }
    void companyId;
  }

  private growth(list?: NormalizedFinancialFact[]) {
    if (!list?.length) return undefined;
    const current = list[0];
    const currentYear = current.fiscalYear ?? Number(current.endDate.slice(0, 4));
    const previous = list.find(
      (fact) =>
        fact.periodType === current.periodType &&
        (fact.fiscalYear ?? Number(fact.endDate.slice(0, 4))) === currentYear - 1,
    );
    if (!previous?.value) return undefined;
    return ((current.value - previous.value) / Math.abs(previous.value)) * 100;
  }

  private consecutivePositive(list?: NormalizedFinancialFact[]) {
    const annual = list?.filter((fact) => fact.periodType === 'FY');
    if (!annual?.length) return undefined;
    let count = 0;
    let expectedYear = annual[0].fiscalYear ?? Number(annual[0].endDate.slice(0, 4));
    for (const item of annual) {
      const year = item.fiscalYear ?? Number(item.endDate.slice(0, 4));
      if (year !== expectedYear) break;
      if (item.value <= 0) break;
      count++;
      expectedYear--;
    }
    return count;
  }

  private dateOnly(value: unknown) {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const text = String(value);
    const date = text.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!date) throw new Error(`invalid date value: ${text}`);
    return date;
  }
}
