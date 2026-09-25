import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { PresetAlertsService } from '../presets/preset-alerts.service';

@Injectable()
export class MarketPriceSyncService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly providers: ProviderRegistry,
    private readonly presetAlerts: PresetAlertsService,
  ) {}

  async run(exchangeMic: string, batchCode = 'US_EOD_PRICE_SYNC') {
    const provider = this.providers.marketData();
    const run = await this.db.query(
      `insert into batch_job_run(batch_code,status_code,requested_by_type) values($1,'RUNNING','ADMIN') returning batch_run_id`,
      [batchCode],
    );
    const runId = run.rows[0].batch_run_id;
    const started = Date.now();
    let inserted = 0,
      updated = 0,
      skipped = 0,
      errors = 0;
    try {
      const providerRow = await this.db.query(
        'select provider_id from data_provider where provider_code=$1',
        [provider.code],
      );
      if (!providerRow.rowCount) throw new Error(`provider not seeded: ${provider.code}`);
      const providerId = providerRow.rows[0].provider_id;
      const mappings = await this.db.query(
        `select p.external_symbol
         from provider_security_map p
         join security s on s.security_id = p.security_id
         join exchange e on e.exchange_id = s.exchange_id
         where p.provider_id = $1
           and p.is_active = true
           and e.mic = $2
           and exists(
             select 1 from latest_metric_value l where l.security_id=s.security_id
           )
         order by p.external_symbol`,
        [providerId, exchangeMic],
      );
      const prices = await provider.fetchLatestEod({
        exchangeMic,
        externalSymbols: mappings.rows.map((x) => x.external_symbol),
      });
      const providerFailures = provider.diagnostics?.().failures ?? [];
      errors += providerFailures.length;
      const client = await this.db.connect();
      try {
        await client.query('begin');
        for (const p of prices) {
          await client.query('savepoint price_row');
          try {
            const map = await client.query(
              `select psm.security_id
               from provider_security_map psm
               join security s on s.security_id=psm.security_id
               join exchange e on e.exchange_id=s.exchange_id
               where psm.provider_id=$1 and psm.external_symbol=$2
                 and psm.is_active=true and e.mic=$3
               limit 1`,
              [providerId, p.externalSymbol, exchangeMic],
            );
            let securityId = map.rows[0]?.security_id;
            if (!securityId && provider.code === 'MOCK') {
              const local = await client.query(
                `select s.security_id from security s join exchange e on e.exchange_id=s.exchange_id where e.mic=$1 and s.ticker=$2 limit 1`,
                [exchangeMic, p.externalSymbol],
              );
              securityId = local.rows[0]?.security_id;
            }
            if (!securityId) {
              skipped++;
              await client.query('release savepoint price_row');
              continue;
            }
            const existed = await client.query(
              `select 1 from daily_price where security_id=$1 and trade_date=$2 and provider_id=$3`,
              [securityId, p.tradeDate, providerId],
            );
            await this.upsert(client, securityId, providerId, p);
            await this.refreshPriceMetrics(client, securityId, p.close, p.tradeDate);
            existed.rowCount ? updated++ : inserted++;
            await client.query('release savepoint price_row');
          } catch {
            await client.query('rollback to savepoint price_row');
            await client.query('release savepoint price_row');
            errors++;
          }
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
      await this.db.query(
        `insert into data_ingestion_log(
           batch_run_id, provider_id, entity_type, market_code,
           business_date, received_count, mapped_count, inserted_count,
           updated_count, skipped_count, error_count
         ) values ($1, $2, 'DAILY_PRICE', null, current_date, $3, $4, $5, $6, $7, $8)`,
        [
          runId,
          providerId,
          prices.length,
          prices.length - skipped,
          inserted,
          updated,
          skipped,
          errors,
        ],
      );
      await this.db.query(
        `update batch_job_run set status_code=$2,ended_at=now(),inserted_count=$3,updated_count=$4,skipped_count=$5,error_count=$6 where batch_run_id=$1`,
        [runId, errors ? 'PARTIAL_SUCCESS' : 'SUCCESS', inserted, updated, skipped, errors],
      );
      let presetAlerts: unknown;
      try {
        presetAlerts = await this.presetAlerts.runDue();
      } catch (error: any) {
        presetAlerts = { error: String(error?.message ?? error) };
      }
      return {
        runId,
        provider: provider.code,
        exchangeMic,
        inserted,
        updated,
        skipped,
        errors,
        presetAlerts,
        providerFailures,
        elapsedMs: Date.now() - started,
      };
    } catch (e: any) {
      await this.db.query(
        `update batch_job_run set status_code='FAILED',ended_at=now(),error_count=error_count+1,error_message=$2 where batch_run_id=$1`,
        [runId, String(e?.message ?? e).slice(0, 2000)],
      );
      throw e;
    }
  }

  private async upsert(client: PoolClient, securityId: number, providerId: number, p: any) {
    await client.query(
      `insert into daily_price(
         security_id, trade_date, provider_id, open_price, high_price,
         low_price, close_price, adjusted_close, volume, currency_code
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict(security_id, trade_date, provider_id) do update
       set open_price = excluded.open_price,
           high_price = excluded.high_price,
           low_price = excluded.low_price,
           close_price = excluded.close_price,
           adjusted_close = excluded.adjusted_close,
           volume = excluded.volume,
           currency_code = excluded.currency_code,
           fetched_at = now(),
           updated_at = now()`,
      [
        securityId,
        p.tradeDate,
        providerId,
        p.open,
        p.high,
        p.low,
        p.close,
        p.adjustedClose,
        p.volume,
        p.currency,
      ],
    );
  }

  private async refreshPriceMetrics(
    client: PoolClient,
    securityId: number,
    closePrice: number,
    tradeDate: string,
  ) {
    await client.query(
      `with base as (
         select
           max(l.numeric_value) filter(where m.metric_code='EPS_BASIC') eps,
           max(l.numeric_value) filter(where m.metric_code='BPS') bps,
           max(l.numeric_value) filter(where m.metric_code='WEIGHTED_AVG_SHARES') shares,
           max(l.numeric_value) filter(where m.metric_code='DPS') dps
         from latest_metric_value l
         join financial_metric m on m.metric_id=l.metric_id
         where l.security_id=$1
       ), calculated(metric_code,numeric_value) as (
         select 'CLOSE_PRICE'::text,$2::numeric
         union all select 'PER',$2::numeric/nullif(eps,0) from base
         union all select 'PBR',$2::numeric/nullif(bps,0) from base
         union all select 'MARKET_CAP',$2::numeric*shares from base
         union all select 'DIVIDEND_YIELD',dps/nullif($2::numeric,0)*100 from base
         union all select 'EARNINGS_YIELD',eps/nullif($2::numeric,0)*100 from base
       )
       insert into latest_metric_value(
         security_id,metric_id,numeric_value,as_of_date,source_type,calculation_version
       )
       select $1,m.metric_id,c.numeric_value,$3,'DERIVED','PRICE_V1'
       from calculated c
       join financial_metric m on m.metric_code=c.metric_code and m.is_active=true
       where c.numeric_value is not null
       on conflict(security_id,metric_id) do update set
         numeric_value=excluded.numeric_value,as_of_date=excluded.as_of_date,
         source_type=excluded.source_type,source_ref_id=null,
         calculation_version=excluded.calculation_version,updated_at=now()`,
      [securityId, closePrice, tradeDate],
    );
  }
}
