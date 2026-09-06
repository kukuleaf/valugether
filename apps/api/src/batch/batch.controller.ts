import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AdminGuard } from '../auth/admin.guard';
import { MarketPriceSyncService } from './market-price-sync.service';
@Controller('admin/batches')
@UseGuards(AccessTokenGuard, AdminGuard)
export class BatchController {
  constructor(private readonly sync: MarketPriceSyncService) {}
  @Post('market/:mic') run(@Param('mic') mic: string) {
    return this.sync.run(mic);
  }
}
