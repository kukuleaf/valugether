import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import { DB_POOL } from '../common/database/database.module';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AuditService } from '../audit/audit.service';

class PresetConditionDto {
  @IsString() @MinLength(1) @MaxLength(80) metricCode!: string;
  @IsIn(['LTE', 'LT', 'GTE', 'GT', 'EQ', 'BETWEEN']) operator!: string;
  @IsNumber() target!: number;
  @IsOptional() @IsNumber() target2?: number;
  @IsOptional() @IsNumber() @Min(0.01) @Max(100) weight?: number;
}
class SavePresetDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => PresetConditionDto)
  conditions!: PresetConditionDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) markets?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) exchanges?: string[];
  @IsOptional() @IsIn(['GENERAL', 'ADVANCED_BASIC', 'ADVANCED_DETAIL']) mode?: string;
}
class NotificationSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsInt() @Min(1) @Max(30) intervalDays!: number;
}

@Controller('presets')
@UseGuards(AccessTokenGuard)
export class PresetsController {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  @Get() async list(@Req() req: any) {
    return this.loadPresets(req.user.sub);
  }

  @Get('notification-settings') async notificationSettings(@Req() req: any) {
    const result = await this.db.query(
      `insert into user_notification_setting(user_id)
       values($1)
       on conflict(user_id) do update set user_id=excluded.user_id
       returning custom_company_enabled,email_enabled,notification_interval_days,
                 next_notification_at,last_notification_at`,
      [req.user.sub],
    );
    return this.notificationSettingsResponse(result.rows[0]);
  }

  @Patch('notification-settings')
  async updateNotificationSettings(@Req() req: any, @Body() dto: NotificationSettingsDto) {
    const result = await this.db.query(
      `insert into user_notification_setting(
         user_id,custom_company_enabled,email_enabled,notification_interval_days,next_notification_at
       ) values($1,$2,coalesce($4::boolean,false),$3,case when $2 then now() else null end)
       on conflict(user_id) do update
       set custom_company_enabled=excluded.custom_company_enabled,
           email_enabled=coalesce($4::boolean,user_notification_setting.email_enabled),
           notification_interval_days=excluded.notification_interval_days,
           next_notification_at=case
             when excluded.custom_company_enabled=false then null
             when user_notification_setting.custom_company_enabled=false then now()
             else user_notification_setting.next_notification_at
           end,
           updated_at=now()
       returning custom_company_enabled,email_enabled,notification_interval_days,
                 next_notification_at,last_notification_at`,
      [req.user.sub, dto.enabled, dto.intervalDays, dto.emailEnabled ?? null],
    );
    return this.notificationSettingsResponse(result.rows[0]);
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

  @Get(':id') async detail(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const rows = await this.loadPresets(req.user.sub, id);
    if (!rows.length) throw new NotFoundException('맞춤기업 기준을 찾을 수 없습니다.');
    return rows[0];
  }

  private async loadPresets(userId: string, presetId?: number) {
    const r = await this.db.query(
      `select p.preset_id, p.preset_name, p.description, p.search_mode,
              p.market_filter_json, p.exchange_filter_json, p.created_at,
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
       where p.user_id = $1 and ($2::bigint is null or p.preset_id=$2)
       group by p.preset_id
       order by p.updated_at desc`,
      [userId, presetId ?? null],
    );
    return r.rows;
  }

  @Post() async save(@Req() req: any, @Body() dto: SavePresetDto) {
    return this.persistPreset(req.user.sub, dto);
  }

  @Patch(':id') async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SavePresetDto,
  ) {
    return this.persistPreset(req.user.sub, dto, id);
  }

  private async persistPreset(userId: string, dto: SavePresetDto, presetId?: number) {
    if (!dto.name.trim()) throw new BadRequestException('기준 이름을 입력하세요.');
    for (const condition of dto.conditions) {
      if (
        condition.operator === 'BETWEEN' &&
        (condition.target2 == null || condition.target > condition.target2)
      ) {
        throw new BadRequestException('범위 조건의 최솟값과 최댓값을 확인하세요.');
      }
    }
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const values = [
        userId,
        dto.name.trim(),
        dto.description ?? null,
        JSON.stringify(dto.markets ?? []),
        JSON.stringify(dto.exchanges ?? []),
        dto.mode ?? 'ADVANCED_BASIC',
      ];
      const p = presetId
        ? await client.query(
            `update screen_preset
             set preset_name=$2,description=$3,market_filter_json=$4::jsonb,
                 exchange_filter_json=$5::jsonb,search_mode=$6,
                 last_match_security_ids='[]'::jsonb,last_notification_at=null,updated_at=now()
             where preset_id=$7 and user_id=$1
             returning preset_id`,
            [...values, presetId],
          )
        : await client.query(
            `insert into screen_preset(
               user_id,preset_name,description,market_filter_json,exchange_filter_json,search_mode
             ) values($1,$2,$3,$4::jsonb,$5::jsonb,$6)
             on conflict(user_id,preset_name) do update
             set description=excluded.description,
                 market_filter_json=excluded.market_filter_json,
                 exchange_filter_json=excluded.exchange_filter_json,
                 search_mode=excluded.search_mode,
                 last_match_security_ids='[]'::jsonb,
                 last_notification_at=null,
                 updated_at=now()
             returning preset_id`,
            values,
          );
      if (!p.rowCount) throw new NotFoundException('맞춤기업 기준을 찾을 수 없습니다.');
      const id = p.rows[0].preset_id;
      await client.query('delete from screen_preset_condition where preset_id=$1', [id]);
      let ord = 0;
      for (const c of dto.conditions) {
        const m = await client.query(
          'select metric_id from financial_metric where metric_code=$1 and is_active=true',
          [c.metricCode],
        );
        if (!m.rowCount) throw new BadRequestException('사용할 수 없는 지표가 포함되어 있습니다.');
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
        actorUserId: userId,
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

  private notificationSettingsResponse(row: any) {
    return {
      ...row,
      email_available: this.config.get<string>('PRESET_ALERT_EMAIL_ENABLED') === 'true',
    };
  }
}
