import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../dist/src/auth/auth.service.js');

if (process.env.NODE_ENV === 'production') throw new Error('Naver E2E tests refuse to run in production');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseHost) && process.env.E2E_ALLOW_NONLOCAL_DATABASE !== 'true') {
  throw new Error('Naver E2E tests only use a local database unless explicitly allowed');
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const fixtureUserIds = new Set();
const fixtureSubjects = new Set();
const fixtureEmails = new Set();
const audit = { write: async () => undefined };

after(async () => {
  try {
    if (fixtureUserIds.size || fixtureSubjects.size || fixtureEmails.size) {
      await db.query(
        `delete from app_user where user_id=any($1::uuid[]) or email=any($2::citext[])
         or user_id in (select user_id from user_social_account where provider_code='NAVER' and provider_subject=any($3::text[]))`,
        [[...fixtureUserIds], [...fixtureEmails], [...fixtureSubjects]],
      );
      const residue = await db.query(
        `select count(*)::int count from app_user where user_id=any($1::uuid[]) or email=any($2::citext[])
         or user_id in (select user_id from user_social_account where provider_code='NAVER' and provider_subject=any($3::text[]))`,
        [[...fixtureUserIds], [...fixtureEmails], [...fixtureSubjects]],
      );
      assert.equal(residue.rows[0].count, 0, 'Naver fixture cleanup failed');
    }
  } finally {
    await db.end();
  }
});

const newSubject = () => {
  const subject = `naver-e2e-${randomUUID()}`;
  fixtureSubjects.add(subject);
  return subject;
};
const createService = (naver, database = db) => new AuthService(
  database, new JwtService(), new ConfigService(process.env), audit, {}, {}, naver,
);
const requiredConsents = async () => {
  const terms = await db.query(
    `select distinct on (term_code) term_id,is_required from terms_document
     where status_code='PUBLISHED' and effective_from<=now()
     order by term_code,effective_from desc,term_id desc`,
  );
  assert.ok(terms.rows.some((term) => term.is_required));
  return terms.rows.map((term) => ({ termId: Number(term.term_id), agreed: Boolean(term.is_required) }));
};
const identity = (subject, email = null) => ({ subject, email, accessToken: 'server-access-token-test-1234567890' });
const userIdFor = async (subject) => {
  const row = (await db.query("select user_id from user_social_account where provider_code='NAVER' and provider_subject=$1", [subject])).rows[0];
  assert.ok(row);
  fixtureUserIds.add(row.user_id);
  return row.user_id;
};

test('Naver registration requires current terms, preserves email-less accounts, and does not merge email identities', async () => {
  const subject = newSubject();
  let email = null;
  const service = createService({ verify: async () => identity(subject, email) });
  assert.deepEqual(await service.naverLogin('test-refresh-token'), { consentRequired: true });
  assert.equal((await db.query("select 1 from user_social_account where provider_code='NAVER' and provider_subject=$1", [subject])).rowCount, 0);
  await assert.rejects(service.naverLogin('test-refresh-token', []), /필수 약관/);
  const consents = await requiredConsents();
  await assert.rejects(service.naverLogin('test-refresh-token', [...consents, { termId: -1, agreed: true }]), /약관이 변경/);
  const tokens = await service.naverLogin('test-refresh-token', consents);
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);
  assert.equal('providerAccessToken' in tokens, false);
  const userId = await userIdFor(subject);
  const me = await service.me(userId);
  assert.equal(me.email, null);
  assert.equal(me.social_email, null);
  assert.equal(me.email_verified_at, null);
  assert.equal(me.has_password, false);
  assert.deepEqual(me.social_providers, ['NAVER']);
  assert.equal((await db.query('select 1 from watchlist where user_id=$1 and is_default=true', [userId])).rowCount, 1);

  email = `naver-test-${randomUUID()}@example.com`;
  fixtureEmails.add(email);
  const existing = await db.query("insert into app_user(email,status_code) values($1,'ACTIVE') returning user_id", [email]);
  fixtureUserIds.add(existing.rows[0].user_id);
  assert.ok((await service.naverLogin('test-refresh-token')).accessToken);
  assert.equal((await service.me(userId)).social_email, email);
  assert.equal((await service.me(userId)).email, null);
  assert.notEqual(userId, existing.rows[0].user_id);
  const secondSubject = newSubject();
  const other = createService({ verify: async () => identity(secondSubject, email) });
  await other.naverLogin('test-refresh-token', consents);
  assert.notEqual(await userIdFor(secondSubject), existing.rows[0].user_id);
  assert.notEqual(await userIdFor(secondSubject), userId);
});

test('Naver concurrent first logins create exactly one user; suspended users cannot log in', async () => {
  const subject = newSubject();
  const service = createService({ verify: async () => identity(subject) });
  const consents = await requiredConsents();
  const results = await Promise.all([
    service.naverLogin('test-refresh-token', consents),
    service.naverLogin('test-refresh-token', consents),
  ]);
  assert.ok(results.every((result) => result.accessToken));
  assert.equal((await db.query("select 1 from user_social_account where provider_code='NAVER' and provider_subject=$1", [subject])).rowCount, 1);
  const userId = await userIdFor(subject);
  assert.equal((await db.query('select 1 from watchlist where user_id=$1', [userId])).rowCount, 1);
  await db.query("update app_user set status_code='SUSPENDED' where user_id=$1", [userId]);
  await assert.rejects(service.naverLogin('test-refresh-token'), /사용할 수 없는 계정/);
});

test('Naver deletion rejects missing/mismatched/mixed proof and unlinks only after committed deletion', async () => {
  const subject = newSubject();
  let proofSubject = subject;
  let unlinkCalls = 0;
  let userId;
  const naver = {
    verify: async () => identity(proofSubject),
    async unlink(token) {
      unlinkCalls += 1;
      assert.equal(token, identity(subject).accessToken);
      assert.equal((await db.query('select 1 from app_user where user_id=$1', [userId])).rowCount, 0);
    },
  };
  const service = createService(naver);
  await service.naverLogin('test-refresh-token', await requiredConsents());
  userId = await userIdFor(subject);
  await assert.rejects(service.deleteAccount(userId, { confirmation: 'DELETE_MY_ACCOUNT' }), /소셜 계정으로 다시 인증/);
  proofSubject = 'unrelated-subject';
  await assert.rejects(service.deleteAccount(userId, { confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: 'test-refresh-token' }), /네이버 계정이 일치하지/);
  assert.equal(unlinkCalls, 0);
  proofSubject = subject;
  await assert.rejects(service.deleteAccount(userId, { confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: 'test-refresh-token', kakaoAccessToken: 'mixed-proof' }), /하나의 소셜/);

  const failingDb = {
    async connect() {
      const client = await db.connect();
      return {
        query: async (sql, args) => {
          if (sql === 'delete from app_user where user_id=$1') throw new Error('injected DB failure');
          return client.query(sql, args);
        },
        release: () => client.release(),
      };
    },
  };
  await assert.rejects(createService(naver, failingDb).deleteAccount(userId, { confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: 'test-refresh-token' }), /injected DB failure/);
  assert.equal(unlinkCalls, 0);
  assert.equal((await db.query('select 1 from app_user where user_id=$1', [userId])).rowCount, 1);
  assert.ok((await service.naverLogin('test-refresh-token')).accessToken);
  const removed = await service.deleteAccount(userId, { confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: 'test-refresh-token' });
  assert.equal(removed.ok, true);
  assert.equal(removed.providerDisconnectPending, undefined);
  assert.equal(unlinkCalls, 1);
  assert.equal((await db.query('select 1 from user_refresh_token where user_id=$1', [userId])).rowCount, 0);
});

test('Naver provider unlink failure reports completed local deletion and pending connection cleanup', async () => {
  const subject = newSubject();
  const service = createService({
    verify: async () => identity(subject),
    unlink: async () => { throw new Error('simulated provider outage with sensitive token'); },
  });
  await service.naverLogin('test-refresh-token', await requiredConsents());
  const userId = await userIdFor(subject);
  const removed = await service.deleteAccount(userId, { confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: 'test-refresh-token' });
  assert.equal(removed.ok, true);
  assert.equal(removed.providerDisconnectPending, true);
  assert.equal((await db.query('select 1 from app_user where user_id=$1', [userId])).rowCount, 0);
});

test('Naver HTTP contract enforces proof validation, protected account routes, and auth rate limiting', async () => {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/src/app.module.js');
  const { NaverOAuthService } = require('../dist/src/auth/naver-oauth.service.js');
  const { AuditService } = require('../dist/src/audit/audit.service.js');
  const { DB_POOL } = require('../dist/src/common/database/database.module.js');
  const { configureHttp } = require('../dist/src/common/http/configure-http.js');
  process.env.BATCH_WORKER_ENABLED = 'false';
  process.env.RATE_LIMIT_ENABLED = 'true';
  process.env.RATE_LIMIT_STORE = 'memory';
  process.env.AUTH_RATE_LIMIT_MAX = '3';
  process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';
  const subject = newSubject();
  const refreshToken = 'sdk-refresh-token-test-12345678901234567890';
  let app;
  let appDb;
  let unlinkCalls = 0;
  let userId;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    appDb = app.get(DB_POOL);
    const naver = app.get(NaverOAuthService);
    naver.verify = async (proof) => {
      assert.equal(proof, refreshToken);
      return identity(subject);
    };
    naver.unlink = async () => {
      unlinkCalls += 1;
      assert.equal((await appDb.query('select 1 from app_user where user_id=$1', [userId])).rowCount, 0);
    };
    app.get(AuditService).write = audit.write;
    configureHttp(app);
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    const base = `http://127.0.0.1:${address.port}/api`;
    const post = (body) => fetch(`${base}/auth/naver/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await post({ accessToken: 'untrusted-access-token-1234567890' })).status, 400);
    const consentResponse = await post({ refreshToken });
    assert.equal(consentResponse.status, 201);
    assert.deepEqual(await consentResponse.json(), { consentRequired: true });
    const registered = await post({ refreshToken, consents: await requiredConsents() });
    assert.equal(registered.status, 201);
    const tokens = await registered.json();
    assert.ok(tokens.accessToken);
    assert.ok(tokens.refreshToken);
    assert.equal(tokens.naverRefreshToken, undefined);
    assert.equal(tokens.providerAccessToken, undefined);
    userId = await userIdFor(subject);
    assert.equal((await fetch(`${base}/auth/me`)).status, 401);
    const authorization = `Bearer ${tokens.accessToken}`;
    const me = await fetch(`${base}/auth/me`, { headers: { authorization } });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).social_providers, ['NAVER']);
    const deleteRequest = (body) => fetch(`${base}/auth/me`, {
      method: 'DELETE', headers: { authorization, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await deleteRequest({ confirmation: 'DELETE_MY_ACCOUNT', naverAccessToken: 'not-refresh-proof' })).status, 400);
    const removed = await deleteRequest({ confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: refreshToken });
    assert.equal(removed.status, 200);
    assert.equal((await removed.json()).ok, true);
    assert.equal(unlinkCalls, 1);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { authorization } })).status, 401);
    // Global auth limiting runs before account authentication. Even a request
    // using a now-deleted account's JWT consumes the deletion route's quota.
    assert.equal((await deleteRequest({ confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: refreshToken })).status, 401);
    const limitedDeletion = await deleteRequest({ confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: refreshToken });
    assert.equal(limitedDeletion.status, 429);
    assert.equal(limitedDeletion.headers.get('x-ratelimit-limit'), '3');
    assert.equal(unlinkCalls, 1);
    assert.equal((await post({ refreshToken })).status, 429);
  } finally {
    if (app) await app.close();
    if (appDb) await appDb.end();
  }
});
