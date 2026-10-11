import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker, type ConnectionOptions, type JobsOptions } from 'bullmq';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { PresetAlertsService } from '../presets/preset-alerts.service';
import { FinancialSyncService } from './financial-sync.service';
import { MarketPriceSyncService } from './market-price-sync.service';
import { DataQualityService } from './data-quality.service';

type BatchJobData = {
  batchCode: SupportedBatchCode;
};

const SUPPORTED_BATCH_CODES = [
  'KR_EOD_PRICE_SYNC',
  'US_EOD_PRICE_SYNC',
  'DART_FINANCIAL_SYNC',
  'SEC_FINANCIAL_SYNC',
  'PRESET_MATCH_NOTIFY',
  'DATA_QUALITY_CHECK',
] as const;

type SupportedBatchCode = (typeof SUPPORTED_BATCH_CODES)[number];

@Injectable()
export class BatchQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BatchQueueService.name);
  private readonly enabled: boolean;
  private readonly queueName: string;
  private readonly connection: ConnectionOptions;
  private queue?: Queue<BatchJobData>;
  private worker?: Worker<BatchJobData>;
  private lastWorkerErrorLogAt = 0;

  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly config: ConfigService,
    private readonly financial: FinancialSyncService,
    private readonly prices: MarketPriceSyncService,
    private readonly presetAlerts: PresetAlertsService,
    private readonly dataQuality: DataQualityService,
  ) {
    this.enabled = this.config.get<string>('BATCH_WORKER_ENABLED') === 'true';
    this.queueName = this.config.get<string>('BATCH_QUEUE_NAME') ?? 'valugether-batch';
    this.connection = {
      url: this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      maxRetriesPerRequest: null,
    };
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Batch worker disabled (BATCH_WORKER_ENABLED=false)');
      return;
    }
    try {
      this.queue = new Queue<BatchJobData>(this.queueName, { connection: this.connection });
      this.worker = new Worker<BatchJobData>(this.queueName, (job) => this.process(job), {
        connection: this.connection,
        concurrency: 1,
      });
      this.worker.on('failed', (job, error) => {
        const finalAttempt = !job || job.attemptsMade >= Number(job.opts.attempts ?? 1);
        if (finalAttempt) {
          void this.recordFailure(job, error).catch((logError) =>
            this.logger.error('Failed to record batch queue error', logError),
          );
        }
      });
      this.worker.on('error', (error) => {
        const now = Date.now();
        if (now - this.lastWorkerErrorLogAt >= 30_000) {
          this.lastWorkerErrorLogAt = now;
          this.logger.error(`Batch worker error: ${error.message}`);
        }
      });
      await this.waitUntilReady();
      await this.syncSchedulers();
      this.logger.log(`Batch worker ready: ${this.queueName}`);
    } catch (error) {
      await this.worker?.close(true).catch(() => undefined);
      await this.queue?.close().catch(() => undefined);
      this.worker = undefined;
      this.queue = undefined;
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async status() {
    const definitions = await this.loadDefinitions();
    if (!this.queue) {
      return {
        enabled: false,
        queueName: this.queueName,
        definitions,
        counts: null,
        schedulers: [],
      };
    }
    const [counts, schedulers] = await Promise.all([
      this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed'),
      this.queue.getJobSchedulers(0, -1, true),
    ]);
    return { enabled: true, queueName: this.queueName, definitions, counts, schedulers };
  }

  async enqueue(batchCode: string) {
    const code = this.assertSupported(batchCode);
    const queue = this.requireQueue();
    const definition = await this.loadDefinition(code);
    const job = await queue.add(
      code,
      { batchCode: code },
      {
        ...this.jobOptions(Number(definition.max_retry)),
        deduplication: { id: code },
      },
    );
    return { accepted: true, jobId: job.id, batchCode: code };
  }

  async updateSchedule(
    batchCode: string,
    input: { isEnabled?: boolean; scheduleCron?: string; maxRetry?: number },
  ) {
    const code = this.assertSupported(batchCode);
    if (input.isEnabled === true && !input.scheduleCron) {
      const current = await this.loadDefinition(code);
      if (!current.schedule_cron) {
        throw new BadRequestException('활성화할 배치에는 scheduleCron이 필요합니다.');
      }
    }
    const result = await this.db.query(
      `update batch_definition set
         is_enabled=coalesce($2,is_enabled),
         schedule_cron=coalesce($3,schedule_cron),
         max_retry=coalesce($4,max_retry),
         updated_at=now()
       where batch_code=$1
       returning batch_code,batch_name,schedule_cron,timezone_name,is_enabled,max_retry,updated_at`,
      [code, input.isEnabled ?? null, input.scheduleCron ?? null, input.maxRetry ?? null],
    );
    if (!result.rowCount) throw new BadRequestException(`등록되지 않은 batch: ${code}`);
    await this.syncSchedulers();
    return { ...result.rows[0], workerEnabled: this.enabled };
  }

  async syncSchedulers() {
    if (!this.queue) return { enabled: false, scheduled: [] as string[] };
    const definitions = await this.loadDefinitions();
    const scheduled: string[] = [];
    for (const code of SUPPORTED_BATCH_CODES) {
      const definition = definitions.find((item) => item.batch_code === code);
      if (definition?.is_enabled && definition.schedule_cron) {
        await this.queue.upsertJobScheduler(
          code,
          { pattern: definition.schedule_cron, tz: definition.timezone_name },
          {
            name: code,
            data: { batchCode: code },
            opts: this.jobOptions(Number(definition.max_retry)),
          },
        );
        scheduled.push(code);
      } else {
        await this.queue.removeJobScheduler(code);
      }
    }
    return { enabled: true, scheduled };
  }

  private async process(job: Job<BatchJobData>) {
    return this.withTaskLock(job.data.batchCode, async () => {
      switch (job.data.batchCode) {
        case 'DART_FINANCIAL_SYNC':
          return this.financial.run('KR', this.financialChunkSize(), false, true);
        case 'SEC_FINANCIAL_SYNC':
          return this.financial.run('US', this.financialChunkSize(), false, true);
        case 'KR_EOD_PRICE_SYNC':
          return this.runPrices(['XKRX', 'XKOS'], 'KR_EOD_PRICE_SYNC');
        case 'US_EOD_PRICE_SYNC':
          return this.runPrices(['XNAS', 'XNYS'], 'US_EOD_PRICE_SYNC');
        case 'PRESET_MATCH_NOTIFY':
          return this.presetAlerts.runDue();
        case 'DATA_QUALITY_CHECK':
          return this.dataQuality.run('SCHEDULER');
      }
    });
  }

  private async runPrices(mics: string[], batchCode: string) {
    const results = [];
    for (const mic of mics) {
      const result = await this.prices.run(mic, batchCode);
      results.push(result);
      if (result.errors) throw new Error(`${mic} price sync failed for ${result.errors} symbols`);
    }
    return results;
  }

  private async withTaskLock<T>(batchCode: string, task: () => Promise<T>) {
    const client = await this.db.connect();
    const lockKey = `batch:${batchCode}`;
    let acquired = false;
    try {
      const lock = await client.query('select pg_try_advisory_lock(hashtext($1)) locked', [
        lockKey,
      ]);
      acquired = Boolean(lock.rows[0]?.locked);
      if (!acquired) return { skipped: true, reason: 'ALREADY_RUNNING', batchCode };
      return await task();
    } finally {
      if (acquired) {
        await client
          .query('select pg_advisory_unlock(hashtext($1))', [lockKey])
          .catch(() => undefined);
      }
      client.release();
    }
  }

  private async recordFailure(job: Job<BatchJobData> | undefined, error: Error) {
    await this.db.query(
      `insert into application_error_log(error_code,error_class,message,stack_trace,context_json)
       values('BATCH_QUEUE_FAILED',$1,$2,$3,$4::jsonb)`,
      [
        error.name,
        error.message.slice(0, 2000),
        error.stack?.slice(0, 8000) ?? null,
        JSON.stringify({
          queueName: this.queueName,
          jobId: job?.id,
          batchCode: job?.data.batchCode,
          attemptsMade: job?.attemptsMade,
        }),
      ],
    );
  }

  private jobOptions(maxRetry: number): JobsOptions {
    return {
      attempts: Math.max(1, maxRetry + 1),
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 500 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
    };
  }

  private financialChunkSize() {
    return Math.max(1, Math.min(Number(this.config.get('FINANCIAL_SYNC_CHUNK_SIZE') ?? 200), 200));
  }

  private async waitUntilReady() {
    const timeoutMs = Math.max(
      1000,
      Number(this.config.get('BATCH_REDIS_STARTUP_TIMEOUT_MS') ?? 10_000),
    );
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.all([this.queue!.waitUntilReady(), this.worker!.waitUntilReady()]),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Redis was not ready within ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private async loadDefinitions() {
    const result = await this.db.query(
      `select batch_code,batch_name,schedule_cron,timezone_name,is_enabled,max_retry,updated_at
       from batch_definition where batch_code=any($1::text[]) order by batch_code`,
      [SUPPORTED_BATCH_CODES],
    );
    return result.rows;
  }

  private async loadDefinition(code: SupportedBatchCode) {
    const result = await this.db.query(
      `select batch_code,batch_name,schedule_cron,timezone_name,is_enabled,max_retry,updated_at
       from batch_definition where batch_code=$1`,
      [code],
    );
    if (!result.rowCount) throw new BadRequestException(`등록되지 않은 batch: ${code}`);
    return result.rows[0];
  }

  private assertSupported(batchCode: string): SupportedBatchCode {
    if (!SUPPORTED_BATCH_CODES.includes(batchCode as SupportedBatchCode)) {
      throw new BadRequestException(`지원하지 않는 batch: ${batchCode}`);
    }
    return batchCode as SupportedBatchCode;
  }

  private requireQueue() {
    if (!this.queue) {
      throw new ServiceUnavailableException('BATCH_WORKER_ENABLED=true 설정이 필요합니다.');
    }
    return this.queue;
  }
}
