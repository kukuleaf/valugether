import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import Redis from 'ioredis';

type LimitResult = {
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

type MemoryEntry = {
  count: number;
  expiresAt: number;
};

const REDIS_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {count, ttl}
`;

@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private readonly redis?: Redis;
  private operations = 0;
  private lastStoreWarningAt = 0;
  private redisRetryAt = 0;

  constructor(private readonly config: ConfigService) {
    if ((this.config.get<string>('RATE_LIMIT_STORE') ?? 'memory').toLowerCase() === 'redis') {
      this.redis = new Redis(
        this.config.get<string>('RATE_LIMIT_REDIS_URL') ??
          this.config.get<string>('REDIS_URL') ??
          'redis://localhost:6379',
        {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          connectTimeout: 2_000,
        },
      );
      this.redis.on('error', () => undefined);
    }
  }

  async consume(scope: string, identity: string, limit: number, windowSeconds: number) {
    const key = `${scope}:${this.hashIdentity(identity)}`;
    if (this.redis && Date.now() >= this.redisRetryAt) {
      try {
        if (this.redis.status === 'wait' || this.redis.status === 'end') await this.redis.connect();
        const raw = (await this.redis.eval(
          REDIS_SCRIPT,
          1,
          `right-stock:rate-limit:${key}`,
          windowSeconds,
        )) as [number, number];
        return this.result(Number(raw[0]), limit, Math.max(1, Number(raw[1])));
      } catch (error) {
        this.redisRetryAt = Date.now() + 30_000;
        this.warnStoreFallback(error);
      }
    }
    return this.consumeMemory(key, limit, windowSeconds);
  }

  async onModuleDestroy() {
    if (!this.redis) return;
    if (this.redis.status === 'ready' || this.redis.status === 'connect') {
      await this.redis.quit().catch(() => this.redis?.disconnect());
    } else {
      this.redis.disconnect();
    }
  }

  private consumeMemory(key: string, limit: number, windowSeconds: number): LimitResult {
    const now = Date.now();
    let entry = this.memory.get(key);
    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + windowSeconds * 1_000 };
      this.memory.set(key, entry);
    }
    entry.count += 1;
    this.operations += 1;
    if (this.operations % 1_000 === 0 || this.memory.size > 10_000) this.sweepMemory(now);
    return this.result(entry.count, limit, Math.max(1, Math.ceil((entry.expiresAt - now) / 1_000)));
  }

  private result(count: number, limit: number, retryAfterSeconds: number): LimitResult {
    return {
      count,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds,
    };
  }

  private hashIdentity(identity: string) {
    const salt = this.config.get<string>('IP_HASH_SALT') ?? 'rate-limit-local';
    return createHmac('sha256', salt).update(identity).digest('hex');
  }

  private sweepMemory(now: number) {
    for (const [key, entry] of this.memory) {
      if (entry.expiresAt <= now) this.memory.delete(key);
    }
  }

  private warnStoreFallback(error: unknown) {
    const now = Date.now();
    if (now - this.lastStoreWarningAt < 60_000) return;
    this.lastStoreWarningAt = now;
    this.logger.warn(
      JSON.stringify({
        event: 'rate_limit_store_fallback',
        store: 'memory',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
