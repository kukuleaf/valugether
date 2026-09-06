import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';
@Controller('metrics')
export class MetricsController {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}
  @Get()
  async list(@Query('basic') basic?: string) {
    const r = await this.db.query(
      `select metric_id, metric_code, metric_name_ko, metric_name_en,
              statement_type, unit_type, direction_code, default_operator,
              user_selectable, basic_search, display_order
       from financial_metric
       where is_active = true
         and user_selectable = true
         and ($1::boolean is null or basic_search = $1)
       order by display_order`,
      [basic == null ? null : basic === 'true'],
    );
    return r.rows;
  }
}
