import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { RankingExportService } from './ranking-export.service';
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [RankingExportService],
})
export class AdminModule {}
