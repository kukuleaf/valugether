import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  @Get()
  async getHealth() {
    const result = await this.db.query('select now() as db_time');
    return { ok: true, service: 'valugether-api', dbTime: result.rows[0].db_time };
  }
}
