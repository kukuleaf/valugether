import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { ProviderRegistry } from '../providers/provider-registry.service';

@Injectable()
export class MarketPriceSyncService {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly providers: ProviderRegistry,
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
         order by p.external_symbol`,
        [providerId, exchangeMic],
      );
      const prices = await provider.fetchLatestEod({
        exchangeMic,
        externalSymbols: mappings.rows.map((x) => x.external_symbol),
      });
      const client = await this.db.connect();
      try {
        await client.query('begin');
        for (const p of prices) {
          try {
            const map = await client.query(
              `select security_id from provider_security_map where provider_id=$1 and external_symbol=$2 and is_active=true limit 1`,
              [providerId, p.externalSymbol],
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
              continue;
            }
            const existed = await client.query(
              `select 1 from daily_price where security_id=$1 and trade_date=$2 and provider_id=$3`,
              [securityId, p.tradeDate, providerId],
            );
            await this.upsert(client, securityId, providerId, p);
            existed.rowCount ? updated++ : inserted++;
          } catch {
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
      return {
        runId,
        provider: provider.code,
        exchangeMic,
        inserted,
        updated,
        skipped,
        errors,
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
}
