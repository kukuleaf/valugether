import { Module } from '@nestjs/common';
import { PresetsController } from './presets.controller';
import { AuthModule } from '../auth/auth.module';
@Module({ imports: [AuthModule], controllers: [PresetsController] })
export class PresetsModule {}
