import { Module } from '@nestjs/common';
import { MarketPriceSyncService } from './market-price-sync.service';
import { BatchController } from './batch.controller';
import { AuthModule } from '../auth/auth.module';
import { ProvidersModule } from '../providers/providers.module';
import { PresetsModule } from '../presets/presets.module';
import { MasterDataSyncService } from './master-data-sync.service';
import { FinancialSyncService } from './financial-sync.service';
import { BatchQueueService } from './batch-queue.service';
@Module({
  imports: [AuthModule, ProvidersModule, PresetsModule],
  providers: [
    MarketPriceSyncService,
    MasterDataSyncService,
    FinancialSyncService,
    BatchQueueService,
  ],
  controllers: [BatchController],
  exports: [MarketPriceSyncService, BatchQueueService],
})
export class BatchModule {}
