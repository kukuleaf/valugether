import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DB_POOL } from '../common/database/database.module';
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

  async run(market: string, requestedLimit = 20) {
    const marketCode = market.toUpperCase();
    if (marketCode !== 'KR' && marketCode !== 'US') throw new Error('market must be KR or US');
    const limit = Math.max(1, Math.min(Number(requestedLimit) || 20, 200));
    const provider = marketCode === 'KR' ? this.dart : this.sec;
    const externalColumn = marketCode === 'KR' ? 'dart_corp_code' : 'sec_cik';
    const batchCode = marketCode === 'KR' ? 'DART_FINANCIAL_SYNC' : 'SEC_FINANCIAL_SYNC';
    const companies = await this.db.query(
      `select company_id,external_company_id,security_id from (
         select distinct on (c.company_id)
           c.company_id,c.${externalColumn} external_company_id,s.security_id,
           case
             when $1='KR' then array_position(
               array['005930','196170','000660','247540','373220','086520','207940','028300',
                     '005380','068760','000270','277810','068270','145020','105560','141080',
                     '055550','403870','035420','000250','035720','006400','051910','028260',
                     '012330','003670','066570','086790','032830','009150']::text[],s.ticker
             )
             else array_position(
               array['NVDA','AAPL','GOOGL','GOOG','MSFT','AMZN','AVGO','META','TSLA','MU',
                     'WMT','AMD','NFLX','COST','INTC','CSCO','PLTR','LRCX','AMAT','TXN',
                     'QCOM','TMUS','PEP','ADBE','CRWD']::text[],s.ticker
             )
           end priority
         from company c
         join security s on s.company_id=c.company_id and s.is_active=true
         join exchange e on e.exchange_id=s.exchange_id and e.market_code=$1
         where c.is_active=true and c.${externalColumn} is not null
         order by c.company_id,priority nulls last,s.security_id
       ) candidates
       order by priority nulls last,company_id
       limit $2`,
      [marketCode, limit],
    );
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
    let errors = 0;
    const failures: Array<{ externalCompanyId: string; error: string }> = [];

    for (const company of companies.rows) {
      try {
        const facts = await provider.fetchCompanyFacts(company.external_company_id);
        await this.persistCompanyFacts(
          Number(company.company_id),
          Number(company.security_id),
          providerId,
          facts,
        );
        updated++;
      } catch (error: any) {
        errors++;
        failures.push({
          externalCompanyId: company.external_company_id,
          error: String(error?.message ?? error).slice(0, 300),
        });
      }
      if (marketCode === 'US') await new Promise((resolve) => setTimeout(resolve, 120));
    }

    await this.db.query(
      `update batch_job_run set status_code=$2,ended_at=now(),updated_count=$3,error_count=$4,
         summary_json=$5::jsonb where batch_run_id=$1`,
      [
        runId,
        errors ? (updated ? 'PARTIAL_SUCCESS' : 'FAILED') : 'SUCCESS',
        updated,
        errors,
        JSON.stringify({ market: marketCode, provider: provider.code, failures }),
      ],
    );
    return {
      runId,
      market: marketCode,
      provider: provider.code,
      requested: companies.rowCount,
      updated,
      errors,
      failures,
    };
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
    const asOfDate = String(
      priceRow.rows[0]?.trade_date ??
        [...byMetric.values()].flat()[0]?.endDate ??
        new Date().toISOString().slice(0, 10),
    ).slice(0, 10);
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
      BPS: equity == null || !shares ? undefined : equity / shares,
      MARKET_CAP: price == null || shares == null ? undefined : price * shares,
      PER: price == null || !eps ? undefined : price / eps,
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
    values.PBR = price == null || !bps ? undefined : price / bps;
    values.EARNINGS_YIELD = values.PER ? 100 / values.PER : undefined;
    for (const [metricCode, value] of Object.entries(values)) {
      if (value == null || !Number.isFinite(value)) continue;
      await client.query(
        `insert into latest_metric_value(
           security_id,metric_id,numeric_value,as_of_date,source_type,calculation_version
         )
         select $1,metric_id,$3,$4,'DERIVED','ACTUAL_V1'
         from financial_metric where metric_code=$2
         on conflict(security_id,metric_id) do update set
           numeric_value=excluded.numeric_value,as_of_date=excluded.as_of_date,
           source_type=excluded.source_type,source_ref_id=null,
           calculation_version=excluded.calculation_version,updated_at=now()`,
        [securityId, metricCode, value, asOfDate],
      );
    }
    void companyId;
  }

  private growth(list?: NormalizedFinancialFact[]) {
    if (!list || list.length < 2 || !list[1].value) return undefined;
    return ((list[0].value - list[1].value) / Math.abs(list[1].value)) * 100;
  }

  private consecutivePositive(list?: NormalizedFinancialFact[]) {
    if (!list?.length) return undefined;
    let count = 0;
    for (const item of list) {
      if (item.value <= 0) break;
      count++;
    }
    return count;
  }
}
