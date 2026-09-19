import { Module } from '@nestjs/common';
import { MarketPriceSyncService } from './market-price-sync.service';
import { BatchController } from './batch.controller';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { PresetsModule } from '../presets/presets.module';
import { MasterDataSyncService } from './master-data-sync.service';
import { FinancialSyncService } from './financial-sync.service';
@Module({
  imports: [AuthModule, ProvidersModule, PresetsModule],
  providers: [MarketPriceSyncService, MasterDataSyncService, FinancialSyncService],
  controllers: [BatchController],
  exports: [MarketPriceSyncService],
})
export class BatchModule {}
