import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
import { AccessTokenGuard } from '../auth/access-token.guard';
import { AdminGuard } from '../auth/admin.guard';
import { AuditService } from '../audit/audit.service';
class ToleranceDto {
  @IsIn(['PERCENT', 'ABSOLUTE']) type!: 'PERCENT' | 'ABSOLUTE';
  @IsNumber() @Min(0) value!: number;
}
class CreateTermDto {
  @IsString() code!: string;
  @IsString() title!: string;
  @IsString() version!: string;
  @IsString() content!: string;
  @IsBoolean() isRequired!: boolean;
  @IsOptional() @IsDateString() effectiveFrom?: string;
}
class UpdateTermDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsDateString() effectiveFrom?: string;
}
@Controller('admin')
@UseGuards(AccessTokenGuard, AdminGuard)
export class AdminController {
  constructor(
    @Inject(DB_POOL) private readonly db: Pool,
    private readonly audit: AuditService,
  ) {}
  @Get('dashboard') async dashboard() {
    const [u, s, b, e] = await Promise.all([
      this.db.query(
        `select count(*)::int total,count(*) filter(where status_code='ACTIVE')::int active from app_user where deleted_at is null`,
      ),
      this.db.query(
        `select count(*)::int searches from screen_search_log where created_at>=current_date`,
      ),
      this.db.query(
        `select batch_code,status_code,started_at,ended_at,error_count from batch_job_run order by started_at desc limit 10`,
      ),
      this.db.query(
        `select e.market_code, max(p.trade_date) latest_price_date
         from daily_price p
         join security s on s.security_id = p.security_id
         join exchange e on e.exchange_id = s.exchange_id
         group by e.market_code`,
      ),
    ]);
    return { users: u.rows[0], today: s.rows[0], latestBatches: b.rows, priceFreshness: e.rows };
  }
  @Get('tolerances') async tolerances() {
    return (
      await this.db.query(
        `select t.tolerance_id, t.setting_detail_code, m.metric_code,
                m.metric_name_ko, t.operator_code, t.tolerance_type,
                t.tolerance_value, t.market_code, t.updated_at
         from screen_metric_tolerance t
         join financial_metric m on m.metric_id = t.metric_id
         where t.is_active = true
         order by t.setting_detail_code`,
      )
    ).rows;
  }
  @Patch('tolerances/:id') async updateTolerance(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToleranceDto,
  ) {
    const before = (
      await this.db.query('select * from screen_metric_tolerance where tolerance_id=$1', [id])
    ).rows[0];
    const after = (
      await this.db.query(
        'update screen_metric_tolerance set tolerance_type=$2,tolerance_value=$3,updated_at=now() where tolerance_id=$1 returning *',
        [id, dto.type, dto.value],
      )
    ).rows[0];
    await this.audit.write({
      actorUserId: req.user.sub,
      actionCode: 'ADMIN_CONFIG_CHANGE',
      targetType: 'SCREEN_TOLERANCE',
      targetId: String(id),
      before,
      after,
    });
    return after;
  }
  @Get('providers') async providers() {
    return (
      await this.db.query(
        'select provider_code,provider_name,provider_type,is_enabled,priority,notes,updated_at from data_provider order by priority',
      )
    ).rows;
  }
  @Get('terms') async terms() {
    return (
      await this.db.query(
        `select term_id, term_code, title, version, content, is_required,
                status_code, effective_from, published_at, created_at, updated_at
         from terms_document
         order by term_code, created_at desc`,
      )
    ).rows;
  }
  @Post('terms') async createTerm(@Req() req: any, @Body() dto: CreateTermDto) {
    const created = (
      await this.db.query(
        `insert into terms_document
           (term_code,title,version,content,is_required,effective_from,created_by)
         values(upper($1),$2,$3,$4,$5,coalesce($6::timestamptz,now()),$7)
         returning *`,
        [
          dto.code,
          dto.title,
          dto.version,
          dto.content,
          dto.isRequired,
          dto.effectiveFrom,
          req.user.sub,
        ],
      )
    ).rows[0];
    await this.audit.write({
      actorUserId: req.user.sub,
      actionCode: 'ADMIN_CONFIG_CHANGE',
      targetType: 'TERMS',
      targetId: String(created.term_id),
      after: created,
    });
    return created;
  }
  @Patch('terms/:id') async updateTerm(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTermDto,
  ) {
    const before = (await this.db.query('select * from terms_document where term_id=$1', [id]))
      .rows[0];
    if (!before) throw new BadRequestException('약관을 찾을 수 없습니다.');
    if (before.status_code !== 'DRAFT') {
      throw new BadRequestException('배포된 약관은 수정할 수 없습니다. 새 버전을 만들어 주세요.');
    }
    const after = (
      await this.db.query(
        `update terms_document
         set title=coalesce($2,title), content=coalesce($3,content),
             is_required=coalesce($4,is_required),
             effective_from=coalesce($5::timestamptz,effective_from), updated_at=now()
         where term_id=$1 returning *`,
        [id, dto.title, dto.content, dto.isRequired, dto.effectiveFrom],
      )
    ).rows[0];
    await this.audit.write({
      actorUserId: req.user.sub,
      actionCode: 'ADMIN_CONFIG_CHANGE',
      targetType: 'TERMS',
      targetId: String(id),
      before,
      after,
    });
    return after;
  }
  @Post('terms/:id/publish') async publishTerm(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const client = await this.db.connect();
    try {
      await client.query('begin');
      const before = (
        await client.query('select * from terms_document where term_id=$1 for update', [id])
      ).rows[0];
      if (!before) throw new BadRequestException('약관을 찾을 수 없습니다.');
      if (before.status_code !== 'DRAFT') {
        throw new BadRequestException('작성 중인 약관만 배포할 수 있습니다.');
      }
      await client.query(
        `update terms_document set status_code='RETIRED',updated_at=now()
         where term_code=$1 and status_code='PUBLISHED'`,
        [before.term_code],
      );
      const after = (
        await client.query(
          `update terms_document
           set status_code='PUBLISHED',published_at=now(),
               effective_from=coalesce(effective_from,now()),updated_at=now()
           where term_id=$1 returning *`,
          [id],
        )
      ).rows[0];
      await client.query('commit');
      await this.audit.write({
        actorUserId: req.user.sub,
        actionCode: 'ADMIN_CONFIG_CHANGE',
        targetType: 'TERMS',
        targetId: String(id),
        before,
        after,
      });
      return after;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
  @Get('batch-runs') async batches(@Query('limit') limit?: string) {
    return (
      await this.db.query('select * from batch_job_run order by started_at desc limit $1', [
        Math.min(Number(limit ?? 50), 200),
      ])
    ).rows;
  }
  @Get('audit-logs') async logs(@Query('limit') limit?: string) {
    return (
      await this.db.query('select * from audit_log order by created_at desc limit $1', [
        Math.min(Number(limit ?? 100), 500),
      ])
    ).rows;
  }
}
