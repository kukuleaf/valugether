import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const requested = process.argv[2];
if (!requested?.match(/^database[\\/]sql[\\/]\d{2}_[\w-]+\.sql$/)) {
  throw new Error('Usage: node tools/run-sql.mjs database/sql/NN_name.sql');
}

const sql = await readFile(resolve(requested), 'utf8');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query(sql);
  console.log(`Applied: ${requested}`);
} finally {
  await client.end();
}
