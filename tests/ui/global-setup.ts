import argon2 from 'argon2';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { Pool } from 'pg';
import {
  ADMIN_EMAIL,
  NOTICE_PREFIX,
  TEST_EMAILS,
  TEST_PASSWORD,
  USER_EMAIL,
} from './test-accounts';

loadEnv({ path: path.resolve(__dirname, '../../apps/api/.env') });

export default async function globalSetup() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for UI E2E');
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) {
    throw new Error('UI E2E only uses a local database');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await cleanup(pool);
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });
  for (const [email, role] of [
    [ADMIN_EMAIL, 'ADMIN'],
    [USER_EMAIL, 'USER'],
  ] as const) {
    const user = await pool.query(
      `insert into app_user(email,status_code,email_verified_at)
       values($1,'ACTIVE',now()) returning user_id`,
      [email],
    );
    const userId = user.rows[0].user_id;
    await pool.query('insert into user_password(user_id,password_hash) values($1,$2)', [
      userId,
      passwordHash,
    ]);
    await pool.query('insert into user_role(user_id,role_code) values($1,$2)', [userId, role]);
    await pool.query(
      `insert into watchlist(user_id,watchlist_name,is_default)
       values($1,'UI E2E default',true)`,
      [userId],
    );
  }
  await pool.end();

  return async () => {
    const teardownPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      await cleanup(teardownPool);
    } finally {
      await teardownPool.end();
    }
  };
}

async function cleanup(pool: Pool) {
  const users = await pool.query('select user_id from app_user where email=any($1::citext[])', [
    TEST_EMAILS,
  ]);
  const userIds = users.rows.map((row) => row.user_id);
  if (userIds.length) {
    await pool.query(
      `delete from audit_log
       where actor_user_id=any($1::uuid[]) or target_id=any($2::text[])`,
      [userIds, userIds],
    );
    await pool.query('delete from screen_search_log where user_id=any($1::uuid[])', [userIds]);
    await pool.query('delete from app_user where user_id=any($1::uuid[])', [userIds]);
  }
  await pool.query('delete from notice where title like $1', [`${NOTICE_PREFIX}%`]);
}
