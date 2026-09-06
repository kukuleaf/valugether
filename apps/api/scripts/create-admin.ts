import 'dotenv/config';
import * as argon2 from 'argon2';
import { Pool } from 'pg';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password)
    throw new Error('usage: npm run create-admin -- admin@example.com StrongPassword');
  const db = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await db.connect();
  try {
    await client.query('begin');
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const found = await client.query('select user_id from app_user where email=$1', [email]);
    let userId = found.rows[0]?.user_id;
    if (!userId) {
      const ins = await client.query(
        `insert into app_user(email, status_code, email_verified_at)
         values ($1, 'ACTIVE', now())
         returning user_id`,
        [email],
      );
      userId = ins.rows[0].user_id;
      await client.query('insert into user_password(user_id,password_hash) values($1,$2)', [
        userId,
        hash,
      ]);
    } else {
      await client.query(
        `insert into user_password(user_id, password_hash)
         values ($1, $2)
         on conflict(user_id) do update
         set password_hash = excluded.password_hash,
             updated_at = now()`,
        [userId, hash],
      );
    }
    await client.query(
      "insert into user_role(user_id,role_code) values($1,'USER') on conflict do nothing",
      [userId],
    );
    await client.query(
      "insert into user_role(user_id,role_code) values($1,'ADMIN') on conflict do nothing",
      [userId],
    );
    await client.query('commit');
    console.log(`admin created: ${email}`);
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
