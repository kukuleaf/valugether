import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { FinancialSyncService } = require('../dist/src/batch/financial-sync.service.js');
const service = new FinancialSyncService({}, {}, {});

const fact = (metricCode, value, fiscalYear, periodType = 'FY') => ({
  metricCode,
  value,
  fiscalYear,
  periodType,
  endDate: `${fiscalYear}-12-31`,
});

test('YoY compares the same fiscal period and never skips a missing year', () => {
  assert.equal(service.growth([fact('REVENUE', 150, 2025), fact('REVENUE', 100, 2023)]), undefined);
  assert.equal(
    service.growth([
      fact('REVENUE', 150, 2025, 'Q3'),
      fact('REVENUE', 130, 2025, 'Q2'),
      fact('REVENUE', 100, 2024, 'Q3'),
    ]),
    50,
  );
});

test('consecutive profitable years exclude quarters and stop at a missing year', () => {
  assert.equal(
    service.consecutivePositive([
      fact('NET_INCOME', 10, 2025, 'Q3'),
      fact('NET_INCOME', 10, 2025),
      fact('NET_INCOME', 10, 2024),
      fact('NET_INCOME', 10, 2022),
    ]),
    2,
  );
});

test('losses and nonpositive equity clear stale PER and PBR instead of looking cheap', async () => {
  const written = new Map();
  const client = {
    async query(sql, parameters) {
      if (sql.includes('select close_price')) {
        return { rowCount: 1, rows: [{ close_price: '100', trade_date: '2026-10-09' }] };
      }
      written.set(parameters[1], parameters[2]);
      return { rowCount: 1, rows: [] };
    },
  };
  await service.recalculate(client, 1, 1, [
    fact('EPS_BASIC', -5, 2025),
    fact('TOTAL_EQUITY', -1000, 2025),
    fact('WEIGHTED_AVG_SHARES', 100, 2025),
  ]);
  for (const metric of ['PER', 'PBR', 'BPS', 'EARNINGS_YIELD']) {
    assert.equal(written.get(metric), null, `${metric} must be invalidated`);
  }
});
