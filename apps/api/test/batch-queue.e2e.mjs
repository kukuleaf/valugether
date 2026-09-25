import assert from 'node:assert/strict';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { Pool } from 'pg';
import { AppModule } from '../dist/src/app.module.js';
import { BatchQueueService } from '../dist/src/batch/batch-queue.service.js';

test('BullMQ worker processes a data-quality job through Redis', { timeout: 30_000 }, async (t) => {
  assert.equal(process.env.BATCH_WORKER_ENABLED, 'true');
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const marker = (await db.query('select clock_timestamp() marker')).rows[0].marker;
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  t.after(async () => {
    await app.close();
    const runs = await db.query(
      `select batch_run_id from batch_job_run
       where batch_code='DATA_QUALITY_CHECK' and requested_by_type='SCHEDULER'
         and started_at >= $1`,
      [marker],
    );
    const runIds = runs.rows.map((row) => row.batch_run_id);
    if (runIds.length) {
      await db.query('delete from data_quality_run where batch_run_id=any($1::uuid[])', [runIds]);
      await db.query('delete from batch_job_run where batch_run_id=any($1::uuid[])', [runIds]);
    }
    await db.end();
  });

  const queue = app.get(BatchQueueService);
  const initial = await queue.status();
  assert.equal(initial.enabled, true);
  assert.equal(initial.queueName, process.env.BATCH_QUEUE_NAME);

  const accepted = await queue.enqueue('DATA_QUALITY_CHECK');
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.batchCode, 'DATA_QUALITY_CHECK');

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const status = await queue.status();
    assert.equal(status.counts?.failed, 0);
    if ((status.counts?.completed ?? 0) >= 1) {
      assert.equal(status.counts?.waiting, 0);
      assert.equal(status.counts?.active, 0);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.fail('BullMQ job did not complete within 20 seconds');
});
