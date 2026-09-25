import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { RankingExportService } from './ranking-export.service';
import { AdminStrategiesService } from './admin-strategies.service';
import { AdminNoticesService } from './admin-notices.service';
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [RankingExportService, AdminStrategiesService, AdminNoticesService],
})
export class AdminModule {}
