import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Pool } from 'pg';
import { DB_POOL } from '../database/database.module';
import { GlobalExceptionFilter } from './global-exception.filter';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  providers: [
    RequestContextService,
    RequestContextMiddleware,
    RateLimitService,
    RateLimitGuard,
    {
      provide: APP_FILTER,
      inject: [DB_POOL, RequestContextService],
      useFactory: (db: Pool, context: RequestContextService) =>
        new GlobalExceptionFilter(db, context),
    },
    { provide: APP_GUARD, useExisting: RateLimitGuard },
  ],
  exports: [RequestContextService],
})
export class HttpObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
