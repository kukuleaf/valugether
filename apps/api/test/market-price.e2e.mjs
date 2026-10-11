import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Pool } = require('pg');
const { MarketPriceSyncService } = require('../dist/src/batch/market-price-sync.service.js');
const { KisHistoryProvider } = require('../dist/src/providers/kis-history.provider.js');

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost)) {
  throw new Error('Market price E2E only uses a local database');
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const exchangeMic = 'XNAS';
const tickers = ['E2EPRICA', 'E2EPRICB'];
const companyIds = [];
const securityIds = [];
const runIds = [];
let provider;
let service;

before(async () => {
  const exchange = await db.query('select exchange_id from exchange where mic=$1', [exchangeMic]);
  if (!exchange.rowCount) throw new Error('NASDAQ/XNAS exchange seed is required');
  const mock = await db.query("select 1 from data_provider where provider_code='MOCK'");
  if (!mock.rowCount) throw new Error('MOCK provider seed is required');

  await cleanupFixtures();
  for (let index = 0; index < tickers.length; index += 1) {
    const company = await db.query(
      `insert into company(legal_name,display_name,country_code,sec_cik)
       values($1,$1,'US',$2) returning company_id`,
      [`UI Batch E2E ${index}`, `E2EPRICE${index}`],
    );
    companyIds.push(Number(company.rows[0].company_id));
    const security = await db.query(
      `insert into security(company_id,exchange_id,ticker,security_name,currency_code)
       values($1,$2,$3,$3,'USD') returning security_id`,
      [company.rows[0].company_id, exchange.rows[0].exchange_id, tickers[index]],
    );
    securityIds.push(Number(security.rows[0].security_id));
  }

  provider = {
    code: 'MOCK',
    prices: [],
    failures: [],
    async fetchLatestEod() {
      return this.prices;
    },
    diagnostics() {
      return { failures: this.failures };
    },
  };
  service = new MarketPriceSyncService(
    db,
    { marketData: () => provider },
    { runDue: async () => ({ evaluatedUsers: 0 }) },
  );
});

after(async () => {
  try {
    await cleanupFixtures();
  } finally {
    await db.end();
  }
});

test('MOCK price sync is idempotent', async () => {
  provider.prices = [price(tickers[0], '2099-12-30', 101), price(tickers[1], '2099-12-30', 202)];
  provider.failures = [];

  const first = await service.run(exchangeMic);
  runIds.push(first.runId);
  assert.deepEqual(
    {
      inserted: first.inserted,
      updated: first.updated,
      skipped: first.skipped,
      errors: first.errors,
    },
    { inserted: 2, updated: 0, skipped: 0, errors: 0 },
  );

  const second = await service.run(exchangeMic);
  runIds.push(second.runId);
  assert.deepEqual(
    {
      inserted: second.inserted,
      updated: second.updated,
      skipped: second.skipped,
      errors: second.errors,
    },
    { inserted: 0, updated: 2, skipped: 0, errors: 0 },
  );
  const rows = await db.query(
    `select count(*)::int count from daily_price
     where security_id=any($1::bigint[]) and trade_date='2099-12-30'`,
    [securityIds],
  );
  assert.equal(rows.rows[0].count, 2);
});

test('historical rows do not overwrite the newest price metric', async () => {
  provider.prices = [price(tickers[0], '2099-12-28', 88), price(tickers[0], '2099-12-30', 102)];
  const result = await service.run(exchangeMic);
  runIds.push(result.runId);
  assert.equal(result.inserted, 1);
  assert.equal(result.updated, 1);
  const rows = await db.query(
    `select dp.trade_date::text,dp.close_price from daily_price dp
     where dp.security_id=$1 order by dp.trade_date`,
    [securityIds[0]],
  );
  assert.deepEqual(rows.rows.map((row) => row.trade_date), ['2099-12-28', '2099-12-30']);
  const latest = await db.query(
    `select l.as_of_date::text,l.numeric_value from latest_metric_value l
     join financial_metric m on m.metric_id=l.metric_id
     where l.security_id=$1 and m.metric_code='CLOSE_PRICE'`,
    [securityIds[0]],
  );
  assert.equal(latest.rows[0].as_of_date, '2099-12-30');
  assert.equal(Number(latest.rows[0].numeric_value), 102);
});

test('KIS adapter returns every daily close in date order', async () => {
  const kis = {
    fetchOverseasDaily: async () => [
      { xymd: '20261010', clos: '104' },
      { xymd: '20261009', clos: '101' },
    ],
  };
  const adapter = new KisHistoryProvider(kis, { get: () => 0 });
  const rows = await adapter.fetchLatestEod({ exchangeMic: 'XNAS', externalSymbols: ['TEST'] });
  assert.deepEqual(rows.map((row) => [row.tradeDate, row.close]), [
    ['2026-10-09', 101], ['2026-10-10', 104],
  ]);
});

test('one invalid row rolls back to a savepoint and later rows continue', async () => {
  provider.prices = [
    price(tickers[0], '2099-12-31', 111),
    { ...price(tickers[1], '2099-12-31', 222), close: Number.MAX_VALUE },
    price(tickers[1], '2099-12-31', 222),
  ];
  provider.failures = [];

  const result = await service.run(exchangeMic);
  runIds.push(result.runId);
  assert.deepEqual(
    {
      inserted: result.inserted,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    },
    { inserted: 2, updated: 0, skipped: 0, errors: 1 },
  );
  const run = await db.query(
    'select status_code,error_count from batch_job_run where batch_run_id=$1',
    [result.runId],
  );
  assert.deepEqual(run.rows[0], { status_code: 'PARTIAL_SUCCESS', error_count: 1 });
  const rows = await db.query(
    `select count(*)::int count from daily_price
     where security_id=any($1::bigint[]) and trade_date='2099-12-31'`,
    [securityIds],
  );
  assert.equal(rows.rows[0].count, 2);
});

function price(externalSymbol, tradeDate, close) {
  return {
    providerCode: 'MOCK',
    externalSymbol,
    exchangeMic,
    tradeDate,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    adjustedClose: close,
    volume: 1_000,
    currency: 'USD',
  };
}

async function cleanupFixtures() {
  if (runIds.length) {
    await db.query('delete from data_ingestion_log where batch_run_id=any($1::uuid[])', [runIds]);
    await db.query('delete from batch_job_run where batch_run_id=any($1::uuid[])', [runIds]);
    runIds.length = 0;
  }
  const securities = await db.query(
    'select security_id from security where ticker=any($1::text[])',
    [tickers],
  );
  const ids = securities.rows.map((row) => row.security_id);
  if (ids.length) await db.query('delete from security where security_id=any($1::bigint[])', [ids]);
  await db.query("delete from company where sec_cik like 'E2EPRICE%'");
}
