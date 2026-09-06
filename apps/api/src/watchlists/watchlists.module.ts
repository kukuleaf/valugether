import { Module } from '@nestjs/common';
import { WatchlistsController } from './watchlists.controller';
import { AuthModule } from '../auth/auth.module';
@Module({ imports: [AuthModule], controllers: [WatchlistsController] })
export class WatchlistsModule {}
