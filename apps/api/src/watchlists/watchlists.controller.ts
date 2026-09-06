import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuditService } from '../audit/audit.service';

class AddWatchDto {
  @IsInt() securityId!: number;
  @IsOptional() @IsString() @MaxLength(500) memo?: string;
}

@Controller('watchlists')
@UseGuards(AccessTokenGuard)
export class WatchlistsController {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly audit: AuditService,
  ) {}

  @Get('default')
  async getDefault(@Req() req: any) {
    const r = await this.db.query(
      `select w.watchlist_id,w.watchlist_name,i.security_id,s.ticker,s.security_name,i.memo,i.created_at
      from watchlist w left join watchlist_item i on i.watchlist_id=w.watchlist_id
      left join security s on s.security_id=i.security_id
      where w.user_id=$1 and w.is_default=true order by i.created_at desc`,
      [req.user.sub],
    );
    return r.rows;
  }

  @Post('default/items')
  async add(@Req() req: any, @Body() dto: AddWatchDto) {
    const w = await this.db.query(
      `select watchlist_id from watchlist where user_id=$1 and is_default=true limit 1`,
      [req.user.sub],
    );
    if (!w.rowCount) throw new Error('default watchlist missing');
    await this.db.query(
      `insert into watchlist_item(watchlist_id,security_id,memo) values($1,$2,$3)
      on conflict(watchlist_id,security_id) do update set memo=excluded.memo`,
      [w.rows[0].watchlist_id, dto.securityId, dto.memo ?? null],
    );
    await this.audit.write({
      actorUserId: req.user.sub,
      actionCode: 'WATCHLIST_CHANGE',
      targetType: 'SECURITY',
      targetId: String(dto.securityId),
      after: { action: 'ADD' },
    });
    return { ok: true };
  }

  @Delete('default/items/:securityId')
  async remove(@Req() req: any, @Param('securityId', ParseIntPipe) securityId: number) {
    await this.db.query(
      `delete from watchlist_item using watchlist w
      where watchlist_item.watchlist_id=w.watchlist_id and w.user_id=$1 and w.is_default=true and watchlist_item.security_id=$2`,
      [req.user.sub, securityId],
    );
    await this.audit.write({
      actorUserId: req.user.sub,
      actionCode: 'WATCHLIST_CHANGE',
      targetType: 'SECURITY',
      targetId: String(securityId),
      after: { action: 'REMOVE' },
    });
    return { ok: true };
  }
}
