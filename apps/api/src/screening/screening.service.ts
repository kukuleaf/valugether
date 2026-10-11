import { BadRequestException, Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { RequestContextService } from '../common/http/request-context.service';
import { priceFreshnessStatus, priceMaxAgeDays } from '../common/price-freshness';
import { ScreenConditionDto, ScreenSearchDto } from './screening.dto';

type Tolerance = { type: 'PERCENT' | 'ABSOLUTE'; value: number };
type Eval = { status: 'EXACT' | 'NEAR' | 'FAIL'; score: number };

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
    @Optional() private readonly context?: RequestContextService,
  ) {}

  async strategies() {
    const r = await this.db.query(
      `select s.strategy_code,s.strategy_name,s.description,s.display_order,
              coalesce(json_agg(json_build_object(
                'metricCode',m.metric_code,'metricName',m.metric_name_ko,
                'unitType',m.unit_type,'operator',c.operator_code,
                'target',c.target_value,'target2',c.target_value2,
                'weight',c.weight,'required',c.required
              ) order by c.display_order) filter (where c.strategy_condition_id is not null),'[]') conditions
       from screen_strategy s
       left join screen_strategy_condition c on c.strategy_id=s.strategy_id
       left join financial_metric m on m.metric_id=c.metric_id
       where s.is_active=true
       group by s.strategy_id
       order by s.display_order,s.strategy_id`,
    );
    return r.rows.map((row) => ({
      ...row,
      conditions: row.conditions.map((condition: any) => ({
        ...condition,
        target: Number(condition.target),
        target2: condition.target2 == null ? undefined : Number(condition.target2),
        weight: Number(condition.weight),
      })),
    }));
  }

  async search(dto: ScreenSearchDto, userId?: string, recordHistory = true) {
    const started = Date.now();
    let conditions = dto.conditions ?? [];
    if (dto.strategyCode) {
      conditions = await this.loadStrategy(dto.strategyCode);
    }
    if (!conditions.length) throw new BadRequestException('검색 조건이 필요합니다.');
    const metricCodes = [...new Set(conditions.map((c) => c.metricCode))];
    const meta = await this.loadMetricMeta(metricCodes);
    if (meta.size !== metricCodes.length) {
      const missing = metricCodes.filter((x) => !meta.has(x));
      throw new BadRequestException(`등록되지 않은 metric: ${missing.join(', ')}`);
    }
    const marketCodes = dto.marketCodes?.length ? dto.marketCodes : null;
    const exchangeCodes = dto.exchangeCodes?.length ? dto.exchangeCodes : null;
    const rows = await this.db.query(
      `select s.security_id,s.ticker,s.security_name,e.market_code,e.exchange_code,
              m.metric_code,l.numeric_value,l.as_of_date
       from security s join company c on c.company_id=s.company_id join exchange e on e.exchange_id=s.exchange_id
       join latest_metric_value l on l.security_id=s.security_id
       join financial_metric m on m.metric_id=l.metric_id
       where s.is_active=true and c.is_active=true and e.is_active=true
         and m.metric_code=any($1::text[])
         and ($2::text[] is null or e.market_code=any($2::text[]))
         and ($3::text[] is null or e.exchange_code=any($3::text[]))
         and ($4::boolean=false or c.is_financial=false)
       order by s.security_id`,
      [metricCodes, marketCodes, exchangeCodes, Boolean(dto.strategyCode)],
    );

    const bySecurity = new Map<number, any>();
    for (const r of rows.rows) {
      const x = bySecurity.get(r.security_id) ?? {
        securityId: r.security_id,
        ticker: r.ticker,
        name: r.security_name,
        marketCode: r.market_code,
        exchangeCode: r.exchange_code,
        values: {},
      };
      x.values[r.metric_code] = { value: Number(r.numeric_value), asOfDate: r.as_of_date };
      bySecurity.set(r.security_id, x);
    }

    const results: any[] = [];
    for (const s of bySecurity.values()) {
      let allExact = true,
        failed = false,
        weighted = 0,
        weights = 0;
      const details = [];
      for (const c of conditions) {
        const m = meta.get(c.metricCode)!;
        const actual = s.values[c.metricCode]?.value;
        if (actual == null) {
          if (c.required !== false) {
            failed = true;
            break;
          }
          allExact = false;
          weights += c.weight ?? 1;
          details.push({
            metricCode: c.metricCode,
            metricName: m.name,
            unitType: m.unitType,
            actual: null,
            asOfDate: null,
            target: c.target,
            target2: c.target2,
            operator: c.operator,
            status: 'FAIL',
            score: 0,
            tolerance: m.tolerance,
          });
          continue;
        }
        const ev = this.evaluate(actual, c, m.tolerance);
        if (ev.status === 'FAIL') {
          if (c.required !== false) {
            failed = true;
            break;
          }
          allExact = false;
        }
        if (ev.status === 'NEAR') allExact = false;
        const w = c.weight ?? 1;
        weighted += ev.score * w;
        weights += w;
        details.push({
          metricCode: c.metricCode,
          metricName: m.name,
          unitType: m.unitType,
          actual,
          asOfDate: s.values[c.metricCode].asOfDate,
          target: c.target,
          target2: c.target2,
          operator: c.operator,
          status: ev.status,
          score: Number(ev.score.toFixed(2)),
          tolerance: m.tolerance,
        });
      }
      if (!failed) {
        results.push({
          ...s,
          matchType: allExact ? 'EXACT' : 'NEAR',
          similarity: Number((weighted / weights).toFixed(2)),
          details,
        });
      }
    }
    results.sort(
      (a, b) =>
        (a.matchType === b.matchType
          ? b.similarity - a.similarity
          : a.matchType === 'EXACT'
            ? -1
            : 1) || a.ticker.localeCompare(b.ticker),
    );
    const exactCount = results.filter((x) => x.matchType === 'EXACT').length;
    const nearCount = results.length - exactCount;
    const limited = results.slice(0, dto.limit ?? 50);
    if (limited.length) {
      const prices = await this.db.query(
        `select ids.security_id,price.trade_date::text as price_as_of_date,
                (current_date-price.trade_date)::int as price_age_days
         from unnest($1::bigint[]) as ids(security_id)
         left join lateral (
           select dp.trade_date from daily_price dp
           where dp.security_id=ids.security_id
           order by dp.trade_date desc,dp.provider_id limit 1
         ) price on true`,
        [limited.map((result) => result.securityId)],
      );
      const byId = new Map(prices.rows.map((price) => [Number(price.security_id), price]));
      const maxAgeDays = priceMaxAgeDays(this.config);
      for (const result of limited) {
        const price = byId.get(result.securityId);
        result.priceAsOfDate = price?.price_as_of_date ?? null;
        result.priceStatus = priceFreshnessStatus(
          price?.price_age_days == null ? null : Number(price.price_age_days),
          maxAgeDays,
        );
      }
    }
    const elapsed = Date.now() - started;
    if (recordHistory) {
      await this.db.query(
        `insert into screen_search_log(user_id,search_mode,strategy_code,request_json,exact_count,near_count,elapsed_ms,request_id)
         values($1,$2,$3,$4::jsonb,$5,$6,$7,$8)`,
        [
          userId ?? null,
          dto.strategyCode ? 'GENERAL' : 'ADVANCED',
          dto.strategyCode ?? null,
          JSON.stringify(dto),
          exactCount,
          nearCount,
          elapsed,
          this.context?.requestId() ?? null,
        ],
      );
    }
    return { exactCount, nearCount, elapsedMs: elapsed, results: limited };
  }

  async history(userId: string, beforeId?: number, requestedLimit?: number) {
    const limit = requestedLimit ?? 30;
    const result = await this.db.query(
      `select l.search_log_id,l.search_mode,l.strategy_code,s.strategy_name,
              l.request_json,l.exact_count,l.near_count,l.elapsed_ms,l.created_at
       from screen_search_log l
       left join screen_strategy s on s.strategy_code=l.strategy_code
       where l.user_id=$1 and ($2::bigint is null or l.search_log_id<$2)
       order by l.search_log_id desc
       limit $3`,
      [userId, beforeId ?? null, limit + 1],
    );
    const hasMore = result.rows.length > limit;
    const page = result.rows.slice(0, limit);
    const items = page.map((row) => ({
      id: Number(row.search_log_id),
      searchMode: row.search_mode,
      strategyCode: row.strategy_code,
      strategyName: row.strategy_name,
      request: row.request_json,
      exactCount: row.exact_count,
      nearCount: row.near_count,
      elapsedMs: row.elapsed_ms,
      createdAt: row.created_at,
    }));
    return {
      items,
      hasMore,
      nextCursor: hasMore && items.length ? items[items.length - 1].id : null,
    };
  }

  async deleteHistory(userId: string, id: number) {
    const result = await this.db.query(
      'delete from screen_search_log where search_log_id=$1 and user_id=$2 returning search_log_id',
      [id, userId],
    );
    return { deleted: Boolean(result.rowCount) };
  }

  async clearHistory(userId: string) {
    const result = await this.db.query('delete from screen_search_log where user_id=$1', [userId]);
    return { deletedCount: result.rowCount ?? 0 };
  }

  private async loadStrategy(code: string): Promise<ScreenConditionDto[]> {
    const r = await this.db.query(
      `select m.metric_code,c.operator_code,c.target_value,c.target_value2,c.weight,c.required
       from screen_strategy s join screen_strategy_condition c on c.strategy_id=s.strategy_id
       join financial_metric m on m.metric_id=c.metric_id
       where s.strategy_code=$1 and s.is_active=true order by c.display_order`,
      [code],
    );
    if (!r.rowCount) throw new BadRequestException('전략을 찾을 수 없습니다.');
    return r.rows.map((x) => ({
      metricCode: x.metric_code,
      operator: x.operator_code,
      target: Number(x.target_value),
      target2: x.target_value2 == null ? undefined : Number(x.target_value2),
      weight: Number(x.weight),
      required: x.required,
    }));
  }

  private async loadMetricMeta(codes: string[]) {
    const r = await this.db.query(
      `select m.metric_code,m.metric_name_ko,m.unit_type,t.tolerance_type,t.tolerance_value
       from financial_metric m left join lateral(
         select * from screen_metric_tolerance t where t.metric_id=m.metric_id and t.is_active=true
          and t.effective_from<=current_date and (t.effective_to is null or t.effective_to>=current_date)
         order by t.effective_from desc limit 1
       ) t on true where m.metric_code=any($1::text[])`,
      [codes],
    );
    const map = new Map<string, { name: string; unitType: string; tolerance: Tolerance }>();
    for (const x of r.rows)
      map.set(x.metric_code, {
        name: x.metric_name_ko,
        unitType: x.unit_type,
        tolerance: { type: x.tolerance_type ?? 'ABSOLUTE', value: Number(x.tolerance_value ?? 0) },
      });
    return map;
  }

  private evaluate(actual: number, c: ScreenConditionDto, t: Tolerance): Eval {
    if (c.operator === 'EQ')
      return actual === c.target ? { status: 'EXACT', score: 100 } : { status: 'FAIL', score: 0 };
    if (c.operator === 'BETWEEN') {
      if (c.target2 == null) return { status: 'FAIL', score: 0 };
      return actual >= c.target && actual <= c.target2
        ? { status: 'EXACT', score: 100 }
        : { status: 'FAIL', score: 0 };
    }
    const exact =
      c.operator === 'LTE'
        ? actual <= c.target
        : c.operator === 'LT'
          ? actual < c.target
          : c.operator === 'GTE'
            ? actual >= c.target
            : actual > c.target;
    if (exact) return { status: 'EXACT', score: 100 };
    const delta = t.type === 'PERCENT' ? Math.abs(c.target) * t.value : t.value;
    if (delta <= 0) return { status: 'FAIL', score: 0 };
    const distance =
      c.operator === 'LTE' || c.operator === 'LT' ? actual - c.target : c.target - actual;
    if (distance < 0 || distance > delta) return { status: 'FAIL', score: 0 };
    return { status: 'NEAR', score: Math.max(0, 100 * (1 - distance / delta)) };
  }
}
