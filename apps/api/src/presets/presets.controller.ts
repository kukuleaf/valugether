import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuditService } from '../audit/audit.service';

class PresetConditionDto {
  @IsString() metricCode!: string;
  @IsString() operator!: string;
  @IsNumber() target!: number;
  @IsOptional() @IsNumber() target2?: number;
  @IsOptional() @IsNumber() weight?: number;
}
class SavePresetDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() description?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PresetConditionDto)
  conditions!: PresetConditionDto[];
  @IsOptional() @IsArray() markets?: string[];
  @IsOptional() @IsIn(['GENERAL', 'ADVANCED_BASIC', 'ADVANCED_DETAIL']) mode?: string;
}
class PresetNotificationDto {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(1) @Max(30) intervalDays!: number;
}

@Controller('presets')
@UseGuards(AccessTokenGuard)
export class PresetsController {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly audit: AuditService,
  ) {}

  @Get() async list(@Req() req: any) {
    const r = await this.db.query(
      `select p.preset_id, p.preset_name, p.description, p.search_mode,
              p.market_filter_json, p.notification_enabled,
              p.notification_interval_days, p.next_notification_at,
              p.last_notification_at, p.created_at,
              coalesce(
                json_agg(
                  json_build_object(
                    'metricCode', m.metric_code,
                    'operator', c.operator_code,
                    'target', c.target_value,
                    'target2', c.target_value2,
                    'weight', c.weight
                  ) order by c.display_order
                ) filter (where c.preset_condition_id is not null),
                '[]'
              ) conditions
       from screen_preset p
       left join screen_preset_condition c on c.preset_id = p.preset_id
       left join financial_metric m on m.metric_id = c.metric_id
       where p.user_id = $1
       group by p.preset_id
       order by p.updated_at desc`,
      [req.user.sub],
    );
    return r.rows;
  }

  @Post() async save(@Req() req: any, @Body() dto: SavePresetDto) {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const p = await client.query(
        `insert into screen_preset(
           user_id, preset_name, description, market_filter_json, search_mode
         ) values ($1, $2, $3, $4::jsonb, $5)
         on conflict(user_id, preset_name) do update
         set description = excluded.description,
             market_filter_json = excluded.market_filter_json,
             search_mode = excluded.search_mode,
             updated_at = now()
         returning preset_id`,
        [
          req.user.sub,
          dto.name,
          dto.description ?? null,
          JSON.stringify(dto.markets ?? []),
          dto.mode ?? 'ADVANCED_BASIC',
        ],
      );
      const id = p.rows[0].preset_id;
      await client.query('delete from screen_preset_condition where preset_id=$1', [id]);
      let ord = 0;
      for (const c of dto.conditions) {
        const m = await client.query(
          'select metric_id from financial_metric where metric_code=$1 and is_active=true',
          [c.metricCode],
        );
        if (!m.rowCount) throw new Error(`unknown metric ${c.metricCode}`);
        await client.query(
          `insert into screen_preset_condition(
             preset_id, metric_id, operator_code, target_value,
             target_value2, weight, display_order
           ) values ($1, $2, $3, $4, $5, $6, $7)`,
          [id, m.rows[0].metric_id, c.operator, c.target, c.target2 ?? null, c.weight ?? 1, ord++],
        );
      }
      await client.query('commit');
      await this.audit.write({
        actorUserId: req.user.sub,
        actionCode: 'PRESET_CHANGE',
        targetType: 'PRESET',
        targetId: String(id),
        after: { name: dto.name },
      });
      return { presetId: id };
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }

  @Patch(':id/notification')
  async updateNotification(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PresetNotificationDto,
  ) {
    const result = await this.db.query(
      `update screen_preset
       set notification_enabled=$3,
           notification_interval_days=$4,
           next_notification_at=case when $3 then coalesce(next_notification_at,now()) else null end,
           updated_at=now()
       where preset_id=$1 and user_id=$2
       returning preset_id,notification_enabled,notification_interval_days,next_notification_at`,
      [id, req.user.sub, dto.enabled, dto.intervalDays],
    );
    return result.rows[0] ?? { presetId: id, updated: false };
  }

  @Get('notifications/inbox')
  async notifications(@Req() req: any) {
    const result = await this.db.query(
      `select notification_id,preset_id,title,body,payload_json,read_at,created_at
       from user_notification where user_id=$1 order by created_at desc limit 50`,
      [req.user.sub],
    );
    return result.rows;
  }

  @Delete(':id') async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    await this.db.query('delete from screen_preset where preset_id=$1 and user_id=$2', [
      id,
      req.user.sub,
    ]);
    await this.audit.write({
      actorUserId: req.user.sub,
      actionCode: 'PRESET_CHANGE',
      targetType: 'PRESET',
      targetId: String(id),
      after: { action: 'DELETE' },
    });
    return { ok: true };
  }
}
