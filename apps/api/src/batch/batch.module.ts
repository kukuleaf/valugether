import { Module } from '@nestjs/common';
import { MarketPriceSyncService } from './market-price-sync.service';
import { BatchController } from './batch.controller';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { PresetsModule } from '../presets/presets.module';
@Module({
  imports: [AuthModule, ProvidersModule, PresetsModule],
  providers: [MarketPriceSyncService],
  controllers: [BatchController],
  exports: [MarketPriceSyncService],
})
export class BatchModule {}
