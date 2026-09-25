import { Controller, Get } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

@Controller('notices')
export class NoticesController {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  @Get()
  async active() {
    return (
      await this.db.query(
        `select notice_id,title,body,starts_at,ends_at,updated_at
         from notice
         where status_code='PUBLISHED'
           and (starts_at is null or starts_at<=now())
           and (ends_at is null or ends_at>now())
         order by starts_at desc nulls last,notice_id desc
         limit 10`,
      )
    ).rows;
  }
}
