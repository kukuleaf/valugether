import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

@Injectable()
export class StocksService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async list(marketCode?: string, limit = 50) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    const r = await this.db.query(
      `select v.*, p.trade_date, p.close_price
       from v_security_master v
       left join v_latest_price p on p.security_id=v.security_id
       where v.is_active=true and ($1::text is null or v.market_code=$1)
       order by v.market_code,v.ticker limit $2`,
      [marketCode ?? null, safeLimit],
    );
    return r.rows;
  }

  async detail(id: number) {
    const s = await this.db.query('select * from v_security_master where security_id=$1', [id]);
    if (!s.rowCount) throw new NotFoundException('종목을 찾을 수 없습니다.');
    const metrics = await this.db.query(
      `select m.metric_code,m.metric_name_ko,m.statement_type,m.unit_type,
              l.numeric_value,l.text_value,l.as_of_date
       from latest_metric_value l join financial_metric m on m.metric_id=l.metric_id
       where l.security_id=$1 and m.is_active=true order by m.display_order`,
      [id],
    );
    return { ...s.rows[0], metrics: metrics.rows };
  }
}
