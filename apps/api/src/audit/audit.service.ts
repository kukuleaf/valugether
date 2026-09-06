import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { DB_POOL } from '../common/database/database.module';

@Injectable()
export class AuditService {
  constructor(@Inject(DB_POOL) private readonly db: Pool) {}

  async write(input: {
    actorUserId?: string | null;
    actionCode: string;
    targetType?: string;
    targetId?: string;
    before?: unknown;
    after?: unknown;
    requestId?: string;
  }) {
    await this.db.query(
      `insert into audit_log(actor_user_id,action_code,target_type,target_id,before_json,after_json,request_id)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
      [
        input.actorUserId ?? null,
        input.actionCode,
        input.targetType ?? null,
        input.targetId ?? null,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
        input.requestId ?? null,
      ],
    );
  }
}
