import { Module } from '@nestjs/common';
import { PresetsController } from './presets.controller';
import { AuthModule } from '../auth/auth.module';
import { ScreeningModule } from '../screening/screening.module';
import { PresetAlertsService } from './preset-alerts.service';
@Module({
  imports: [AuthModule, ScreeningModule],
  controllers: [PresetsController],
  providers: [PresetAlertsService],
  exports: [PresetAlertsService],
})
export class PresetsModule {}
