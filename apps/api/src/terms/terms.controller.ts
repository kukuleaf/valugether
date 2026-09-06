import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

@Controller('terms')
export class TermsController {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  @Get('active')
  async active() {
    const result = await this.db.query(
      `select distinct on (term_code)
              term_id, term_code, title, version, content, is_required, effective_from
       from terms_document
       where status_code = 'PUBLISHED'
         and effective_from <= now()
       order by term_code, effective_from desc, term_id desc`,
    );
    return result.rows;
  }
}
