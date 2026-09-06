import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { StocksModule } from './stocks/stocks.module';
import { ScreeningModule } from './screening/screening.module';
import { ProvidersModule } from './providers/providers.module';
import { AuditModule } from './audit/audit.module';
import { BatchModule } from './batch/batch.module';
import { AdminModule } from './admin/admin.module';
import { WatchlistsModule } from './watchlists/watchlists.module';
import { PresetsModule } from './presets/presets.module';
import { MetricsModule } from './metrics/metrics.module';
import { TermsModule } from './terms/terms.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuditModule,
    ProvidersModule,
    AuthModule,
    HealthModule,
    StocksModule,
    ScreeningModule,
    BatchModule,
    AdminModule,
    WatchlistsModule,
    PresetsModule,
    MetricsModule,
    TermsModule,
  ],
})
export class AppModule {}
