import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { priceFreshnessStatus, priceMaxAgeDays } from '../common/price-freshness';

type MetricHistoryRow = {
  metric_code: string;
  period_type: string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  start_date: string | null;
  end_date: string;
  filing_date: string | null;
  report_type: string | null;
  consolidation_code: string | null;
  numeric_value: string | null;
  text_value: string | null;
  currency_code: string | null;
  unit_code: string | null;
  source_type: string;
  provider_name: string | null;
  is_restated: boolean;
};

@Injectable()
export class StocksService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
  ) {}

  async list(marketCode?: string, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const r = await this.db.query(
      `select v.*, p.trade_date, p.close_price
       from v_security_master v
       left join v_latest_price p on p.security_id=v.security_id
       where v.is_active=true and ($1::text is null or v.market_code=$1)
       order by v.market_code,v.ticker limit $2`,
      [marketCode ?? null, safeLimit],
    );
    return r.rows;
  }

  async priceHistory(id: number, range = '6M') {
    const ranges: Record<string, { interval: string; limit: number }> = {
      '1M': { interval: '1 month', limit: 31 },
      '3M': { interval: '3 months', limit: 93 },
      '6M': { interval: '6 months', limit: 186 },
      '1Y': { interval: '1 year', limit: 366 },
      '3Y': { interval: '3 years', limit: 1098 },
      '5Y': { interval: '5 years', limit: 1830 },
    };
    const safeRange = ranges[range] ? range : '6M';
    const selected = ranges[safeRange];
    const result = await this.db.query(
      `select distinct on (dp.trade_date)
         dp.trade_date::text, dp.open_price, dp.high_price, dp.low_price,
         dp.close_price, dp.adjusted_close, dp.volume, dp.currency_code,
         p.provider_name
       from daily_price dp
       join data_provider p on p.provider_id=dp.provider_id
       where dp.security_id=$1
         and dp.trade_date >= current_date - $2::interval
       order by dp.trade_date desc, p.priority
       limit $3`,
      [id, selected.interval, selected.limit],
    );
    return { range: safeRange, prices: result.rows };
  }

  async detail(id: number) {
    const security = await this.db.query(
      `select
         s.security_id, s.ticker, s.security_name, s.security_type,
         s.currency_code, s.isin, s.listing_date::text, s.delisting_date::text, s.is_active,
         c.company_id, c.legal_name, c.display_name as company_name,
         c.country_code, c.dart_corp_code, c.sec_cik, c.industry_code,
         c.sector_code, c.is_financial, c.website_url,
         to_jsonb(c)->>'business_summary' as business_summary,
         e.market_code, e.exchange_code, e.mic, e.exchange_name,
         e.country_code as exchange_country_code, e.currency_code as exchange_currency_code,
         e.timezone_name
       from security s
       join company c on c.company_id=s.company_id
       join exchange e on e.exchange_id=s.exchange_id
       where s.security_id=$1`,
      [id],
    );
    if (!security.rowCount) throw new NotFoundException('종목을 찾을 수 없습니다.');

    const [latestMetrics, metricHistory, latestPrice, priceHistory, dividends, splits] =
      await Promise.all([
        this.db.query(
          `select
             m.metric_code, m.metric_name_ko, m.metric_name_en, m.statement_type,
             m.value_type, m.unit_type, m.direction_code, m.formula_text, m.description,
             l.numeric_value, l.text_value, l.as_of_date::text, l.source_type,
             l.calculation_version
           from financial_metric m
           left join latest_metric_value l
             on l.metric_id=m.metric_id and l.security_id=$1
           where m.is_active=true and (
             l.security_id is not null
             or exists (
               select 1
               from financial_fact f
               join financial_period fp on fp.financial_period_id=f.financial_period_id
               where f.metric_id=m.metric_id and fp.company_id=$2
             )
             or exists (
               select 1 from derived_metric_value d
               where d.metric_id=m.metric_id and d.security_id=$1
             )
           )
           order by m.display_order, m.metric_code`,
          [id, security.rows[0].company_id],
        ),
        this.db.query<MetricHistoryRow>(
          `select * from (
             select
               m.metric_code, fp.period_type, fp.fiscal_year, fp.fiscal_quarter,
               fp.start_date::text, fp.end_date::text, fp.filing_date::text, fp.report_type,
               fp.consolidation_code, f.numeric_value, f.text_value,
               f.currency_code, f.unit_code, 'DISCLOSURE'::text as source_type,
               p.provider_name, f.is_restated
             from financial_fact f
             join financial_period fp on fp.financial_period_id=f.financial_period_id
             join financial_metric m on m.metric_id=f.metric_id and m.is_active=true
             left join data_provider p on p.provider_id=fp.source_provider_id
             where fp.company_id=$2

             union all

             select
               m.metric_code, d.period_type, null::integer as fiscal_year,
               case
                 when d.period_type ~ '^Q[1-4]$' then substring(d.period_type from 2)::integer
                 else null::integer
               end as fiscal_quarter,
               null::text as start_date, d.as_of_date::text as end_date,
               null::text as filing_date, null::varchar as report_type,
               null::varchar as consolidation_code, d.numeric_value, d.text_value,
               d.currency_code, null::varchar as unit_code, 'CALCULATED'::text as source_type,
               null::varchar as provider_name, false as is_restated
             from derived_metric_value d
             join financial_metric m on m.metric_id=d.metric_id and m.is_active=true
             where d.security_id=$1
           ) h
           order by h.metric_code, h.end_date desc, h.fiscal_quarter desc nulls last`,
          [id, security.rows[0].company_id],
        ),
        this.db.query(
          `select
             dp.trade_date::text, dp.open_price, dp.high_price, dp.low_price,
             dp.close_price, dp.adjusted_close, dp.volume, dp.currency_code,
             dp.fetched_at, p.provider_code, p.provider_name,
             (current_date-dp.trade_date)::int as age_days
           from daily_price dp
           join data_provider p on p.provider_id=dp.provider_id
           where dp.security_id=$1
           order by dp.trade_date desc, p.priority
           limit 1`,
          [id],
        ),
        this.db.query(
          `select
             dp.trade_date::text, dp.open_price, dp.high_price, dp.low_price,
             dp.close_price, dp.adjusted_close, dp.volume, dp.currency_code,
             p.provider_name
           from daily_price dp
           join data_provider p on p.provider_id=dp.provider_id
           where dp.security_id=$1
           order by dp.trade_date desc, p.priority
           limit 120`,
          [id],
        ),
        this.db.query(
          `select
             d.ex_date::text, d.payment_date::text, d.amount_per_share, d.currency_code,
             d.event_status, p.provider_name
           from dividend_event d
           left join data_provider p on p.provider_id=d.provider_id
           where d.security_id=$1
           order by d.ex_date desc`,
          [id],
        ),
        this.db.query(
          `select s.ex_date::text, s.split_from, s.split_to, p.provider_name
           from split_event s
           left join data_provider p on p.provider_id=s.provider_id
           where s.security_id=$1
           order by s.ex_date desc`,
          [id],
        ),
      ]);

    const historyByMetric = new Map<string, MetricHistoryRow[]>();
    for (const row of metricHistory.rows) {
      const rows = historyByMetric.get(row.metric_code) ?? [];
      rows.push(row);
      historyByMetric.set(row.metric_code, rows);
    }
    const calculatedHistory = historicalIndicators(metricHistory.rows);
    for (const row of calculatedHistory) {
      const rows = historyByMetric.get(row.metric_code) ?? [];
      if (!rows.some((existing) => existing.end_date === row.end_date && existing.period_type === row.period_type)) {
        rows.push(row);
        rows.sort((a, b) => b.end_date.localeCompare(a.end_date));
        historyByMetric.set(row.metric_code, rows);
      }
    }

    const knownCodes = new Set(latestMetrics.rows.map((metric) => metric.metric_code));
    const missingCodes = [...new Set(calculatedHistory.map((row) => row.metric_code))]
      .filter((code) => !knownCodes.has(code));
    const missingMetrics = missingCodes.length ? await this.db.query(
      `select metric_code,metric_name_ko,metric_name_en,statement_type,value_type,
              unit_type,direction_code,formula_text,description
       from financial_metric where is_active=true and metric_code=any($1::text[])
       order by display_order,metric_code`,
      [missingCodes],
    ) : { rows: [] };
    const metrics = [...latestMetrics.rows, ...missingMetrics.rows.map((metric) => {
      const latest = historyByMetric.get(metric.metric_code)?.[0];
      return { ...metric, numeric_value: latest?.numeric_value ?? null,
        text_value: null, as_of_date: latest?.end_date ?? null,
        source_type: 'CALCULATED', calculation_version: 'HISTORY_V1' };
    })].map((metric) => ({
      ...metric,
      history: historyByMetric.get(metric.metric_code) ?? [],
    }));

    return {
      ...security.rows[0],
      latest_price: latestPrice.rows[0] ?? null,
      price_status: priceFreshnessStatus(
        latestPrice.rows[0]?.age_days == null ? null : Number(latestPrice.rows[0].age_days),
        priceMaxAgeDays(this.config),
      ),
      price_history: priceHistory.rows,
      metrics,
      dividends: dividends.rows,
      splits: splits.rows,
    };
  }
}

function historicalIndicators(facts: MetricHistoryRow[]): MetricHistoryRow[] {
  const periods = new Map<string, Map<string, MetricHistoryRow>>();
  for (const fact of facts) {
    if (fact.source_type !== 'DISCLOSURE' || fact.numeric_value == null) continue;
    const key = `${fact.end_date}|${fact.period_type}`;
    const metrics = periods.get(key) ?? new Map<string, MetricHistoryRow>();
    if (!metrics.has(fact.metric_code)) metrics.set(fact.metric_code, fact);
    periods.set(key, metrics);
  }
  const ordered = [...periods.entries()].sort(([a], [b]) => a.localeCompare(b));
  const result: MetricHistoryRow[] = [];
  for (const [key, metrics] of ordered) {
    const [date, periodType] = key.split('|');
    const get = (code: string) => {
      const value = metrics.get(code)?.numeric_value;
      return value == null ? null : Number(value);
    };
    const divide = (top: number | null, bottom: number | null, percent = false) =>
      top == null || bottom == null || bottom === 0 ? null : top / bottom * (percent ? 100 : 1);
    const previous = ordered.find(([otherKey]) => {
      const [otherDate, otherType] = otherKey.split('|');
      return otherType === periodType && Number(otherDate.slice(0, 4)) === Number(date.slice(0, 4)) - 1;
    })?.[1];
    const averageBalance = (code: string) => {
      const current = get(code);
      const prior = previous?.get(code)?.numeric_value;
      return current == null || prior == null ? null : (current + Number(prior)) / 2;
    };
    const growth = (code: string) => {
      const current = get(code);
      const prior = previous?.get(code)?.numeric_value;
      return current == null || prior == null || Number(prior) === 0
        ? null : (current - Number(prior)) / Math.abs(Number(prior)) * 100;
    };
    const values: Record<string, number | null> = {
      ROE: divide(get('NET_INCOME'), averageBalance('TOTAL_EQUITY'), true),
      ROA: divide(get('NET_INCOME'), averageBalance('TOTAL_ASSETS'), true),
      DEBT_RATIO: divide(get('TOTAL_LIABILITIES'), get('TOTAL_EQUITY'), true),
      CURRENT_RATIO: divide(get('CURRENT_ASSETS'), get('CURRENT_LIABILITIES')),
      OPERATING_MARGIN: divide(get('OPERATING_INCOME'), get('REVENUE'), true),
      NET_MARGIN: divide(get('NET_INCOME'), get('REVENUE'), true),
      FREE_CASH_FLOW: get('CFO') == null || get('CAPEX') == null ? null : get('CFO')! - Math.abs(get('CAPEX')!),
      BPS: divide(get('TOTAL_EQUITY'), get('WEIGHTED_AVG_SHARES')),
      PAYOUT_RATIO: divide(get('DPS'), get('EPS_BASIC'), true),
      REVENUE_GROWTH_YOY: growth('REVENUE'),
      OPERATING_INCOME_GROWTH_YOY: growth('OPERATING_INCOME'),
      NET_INCOME_GROWTH_YOY: growth('NET_INCOME'),
      EPS_GROWTH_YOY: growth('EPS_BASIC'),
    };
    const sample = metrics.values().next().value as MetricHistoryRow | undefined;
    if (!sample) continue;
    for (const [metricCode, value] of Object.entries(values)) {
      if (value == null || !Number.isFinite(value)) continue;
      result.push({
        ...sample,
        metric_code: metricCode,
        end_date: date,
        period_type: periodType,
        numeric_value: String(value),
        text_value: null,
        source_type: 'CALCULATED',
        provider_name: null,
      });
    }
  }
  return result;
}
