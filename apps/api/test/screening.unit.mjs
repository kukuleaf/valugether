import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { ScreeningService } = require('../dist/src/screening/screening.service.js');

function serviceFor(values) {
  const db = {
    async query(sql) {
      if (sql.includes('select s.sort_metric_code'))
        return {
          rowCount: 1,
          rows: [
            {
              sort_metric_code: 'PER',
              sort_direction: 'ASC',
              metric_code: 'PER',
              operator_code: 'LTE',
              target_value: 15,
              weight: 1,
              required: true,
            },
          ],
        };
      if (sql.includes('select m.metric_code,m.metric_name_ko'))
        return {
          rows: [{ metric_code: 'PER', metric_name_ko: 'PER', unit_type: 'MULTIPLE' }],
        };
      if (sql.includes('select s.security_id,s.ticker'))
        return {
          rows: values.map((value, index) => ({
            security_id: String(index + 1),
            ticker: `STOCK${index}`,
            security_name: `Stock ${index}`,
            metric_code: 'PER',
            numeric_value: value,
            as_of_date: '2026-10-09',
          })),
        };
      if (sql.includes('select ids.security_id'))
        return {
          rows: values.map((_, index) => ({
            security_id: String(index + 1),
            price_as_of_date: '2026-10-09',
            price_age_days: 1,
          })),
        };
      return { rows: [] };
    },
  };
  return new ScreeningService(db, { get: () => undefined });
}

test('general strategies exclude missing and nonpositive PER, including cached legacy ratios', async () => {
  const result = await serviceFor([null, '-5', '0', '10']).search(
    {
      strategyCode: 'UNDERVALUED',
    },
    undefined,
    false,
  );
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].ticker, 'STOCK3');
  assert.equal(result.results[0].securityId, 4);
  assert.equal(result.results[0].priceStatus, 'CURRENT');
  assert.equal(result.results[0].priceAsOfDate, '2026-10-09');
});

test('advanced conditions never treat NULL as a zero value', async () => {
  const result = await serviceFor([null, '0']).search(
    {
      conditions: [{ metricCode: 'PER', operator: 'EQ', target: 0 }],
    },
    undefined,
    false,
  );
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].ticker, 'STOCK1');
});

test('an inverted BETWEEN range is rejected before querying data', async () => {
  await assert.rejects(
    serviceFor([]).search(
      {
        conditions: [{ metricCode: 'PER', operator: 'BETWEEN', target: 20, target2: 10 }],
      },
      undefined,
      false,
    ),
    (error) => error.getStatus() === 400,
  );
});
