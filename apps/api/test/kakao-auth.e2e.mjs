import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../dist/src/auth/auth.service.js');

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const nonceHashes = [];
let createdUserId;

after(async () => {
  if (createdUserId) await db.query('delete from app_user where user_id=$1', [createdUserId]);
  if (nonceHashes.length) {
    await db.query('delete from social_login_nonce where nonce_hash=any($1::text[])', [
      nonceHashes,
    ]);
  }
  await db.end();
});

test('Kakao OIDC account requires terms, no email verification, and supports reauthentication deletion', async () => {
  const subject = `e2e-${randomUUID()}`;
  let unlinked = false;
  const kakao = {
    async verify(idToken, nonce) {
      assert.equal(idToken, 'test-id-token');
      assert.ok(nonce.length >= 20);
      return { subject, email: null, authenticatedAt: Math.floor(Date.now() / 1000) };
    },
    async unlink(accessToken, expectedSubject) {
      assert.equal(accessToken, 'test-access-token');
      assert.equal(expectedSubject, subject);
      unlinked = true;
    },
  };
  const service = new AuthService(
    db,
    new JwtService(),
    new ConfigService({ ...process.env, KAKAO_NATIVE_APP_KEY: 'e2e-native-key' }),
    { write: async () => undefined },
    {},
    kakao,
  );
  const newNonce = async () => {
    const { nonce } = await service.createKakaoNonce();
    nonceHashes.push(createHash('sha256').update(nonce).digest('hex'));
    return nonce;
  };

  const nonce = await newNonce();
  assert.deepEqual(await service.kakaoLogin('test-id-token', nonce), { consentRequired: true });
  await assert.rejects(service.kakaoLogin('test-id-token', nonce, []), /필수 약관/);

  const terms = await db.query(
    `select distinct on (term_code) term_id,is_required from terms_document
     where status_code='PUBLISHED' and effective_from<=now()
     order by term_code,effective_from desc,term_id desc`,
  );
  assert.ok(terms.rows.some((term) => term.is_required));
  const consents = terms.rows.map((term) => ({
    termId: Number(term.term_id),
    agreed: Boolean(term.is_required),
  }));
  const first = await service.kakaoLogin('test-id-token', nonce, consents);
  assert.ok(first.accessToken);
  assert.ok(first.refreshToken);
  const account = await db.query(
    `select u.user_id,u.email,u.email_verified_at,p.user_id as password_user_id,s.provider_subject
     from app_user u
     join user_social_account s on s.user_id=u.user_id
     left join user_password p on p.user_id=u.user_id
     where s.provider_code='KAKAO' and s.provider_subject=$1`,
    [subject],
  );
  assert.equal(account.rowCount, 1);
  createdUserId = account.rows[0].user_id;
  assert.equal(account.rows[0].email, null);
  assert.equal(account.rows[0].email_verified_at, null);
  assert.equal(account.rows[0].password_user_id, null);
  await assert.rejects(service.kakaoLogin('test-id-token', nonce), /만료/);

  const loginNonce = await newNonce();
  const again = await service.kakaoLogin('test-id-token', loginNonce);
  assert.ok(again.accessToken);
  const deleteNonce = await newNonce();
  const removed = await service.deleteAccount(createdUserId, {
    confirmation: 'DELETE_MY_ACCOUNT',
    kakaoIdToken: 'test-id-token',
    kakaoAccessToken: 'test-access-token',
    kakaoNonce: deleteNonce,
  });
  assert.equal(removed.ok, true);
  assert.equal(unlinked, true);
  assert.equal(
    (await db.query('select 1 from app_user where user_id=$1', [createdUserId])).rowCount,
    0,
  );
  createdUserId = undefined;
});
