import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AdminGuard } from '../auth/admin.guard';
import { MarketPriceSyncService } from './market-price-sync.service';
import { PresetAlertsService } from '../presets/preset-alerts.service';
import { MasterDataSyncService } from './master-data-sync.service';
import { FinancialSyncService } from './financial-sync.service';
import { BatchQueueService } from './batch-queue.service';

class UpdateBatchScheduleDto {
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsString() scheduleCron?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10) maxRetry?: number;
}

@Controller('admin/batches')
@UseGuards(AccessTokenGuard, AdminGuard)
export class BatchController {
  constructor(
    private readonly sync: MarketPriceSyncService,
    private readonly presetAlerts: PresetAlertsService,
    private readonly masterData: MasterDataSyncService,
    private readonly financial: FinancialSyncService,
    private readonly queue: BatchQueueService,
  ) {}

  @Get('queue') queueStatus() {
    return this.queue.status();
  }

  @Post('queue/:batchCode') enqueue(@Req() req: any, @Param('batchCode') batchCode: string) {
    return this.queue.enqueue(batchCode, req.user.sub);
  }

  @Patch('schedules/:batchCode') updateSchedule(
    @Param('batchCode') batchCode: string,
    @Body() dto: UpdateBatchScheduleDto,
  ) {
    return this.queue.updateSchedule(batchCode, dto);
  }

  @Post('market/:mic') run(@Param('mic') mic: string) {
    return this.sync.run(mic);
  }
  @Post('preset-alerts') runPresetAlerts() {
    return this.presetAlerts.runDue();
  }
  @Post('master/:market') runMasterData(@Param('market') market: string) {
    return this.masterData.run(market);
  }
  @Post('financial/:market') runFinancialData(
    @Param('market') market: string,
    @Query('limit') limit?: string,
  ) {
    return this.financial.run(market, Number(limit ?? 20));
  }
}
