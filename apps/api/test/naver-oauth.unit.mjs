import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { ConfigService } = require('@nestjs/config');
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const { NaverOAuthService } = require('../dist/src/auth/naver-oauth.service.js');
const { NaverLoginDto, DeleteAccountDto } = require('../dist/src/auth/auth.dto.js');

const refreshToken = 'sdk-refresh-token-12345678901234567890';
const accessToken = 'server-access-token-12345678901234567890';
const credentials = { NAVER_CLIENT_ID: 'test-client-id', NAVER_CLIENT_SECRET: 'test-client-secret' };
const service = () => new NaverOAuthService(new ConfigService(credentials));
const tokenBody = () => ({ access_token: accessToken, token_type: 'bearer', expires_in: '3600' });
const profileBody = (profile = { id: 'application-specific-subject' }) => ({
  resultcode: '00', message: 'success', response: profile,
});
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

async function withFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await action(); } finally { globalThis.fetch = original; }
}

test('Naver login exchanges refresh token with this client and uses only server-issued access token', async () => {
  const calls = [];
  await withFetch(async (url, init) => {
    calls.push(url);
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    if (url === 'https://nid.naver.com/oauth2.0/token') {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['Content-Type'], 'application/x-www-form-urlencoded');
      const body = new URLSearchParams(init.body);
      assert.equal(body.get('grant_type'), 'refresh_token');
      assert.equal(body.get('client_id'), credentials.NAVER_CLIENT_ID);
      assert.equal(body.get('client_secret'), credentials.NAVER_CLIENT_SECRET);
      assert.equal(body.get('refresh_token'), refreshToken);
      return json(tokenBody());
    }
    assert.equal(url, 'https://openapi.naver.com/v1/nid/me');
    assert.equal(init.headers.Authorization, `Bearer ${accessToken}`);
    return json(profileBody({ id: 'application-specific-subject', email: ' TEST@EXAMPLE.COM ' }));
  }, async () => {
    assert.deepEqual(await service().verify(refreshToken), {
      subject: 'application-specific-subject', email: 'test@example.com', accessToken,
    });
  });
  assert.equal(calls.length, 2);
});

test('Naver optional email is not required; malformed email is discarded', async () => {
  for (const email of [undefined, '', 'not-an-email', 'a@b', 'a\r\n@b.com']) {
    await withFetch(async (url) => url.includes('/token') ? json(tokenBody()) : json(profileBody({ id: 'subject', email })), async () => {
      assert.equal((await service().verify(refreshToken)).email, null);
    });
  }
});

test('Naver expired/foreign-client refresh grants cannot reach profile or issue identity', async () => {
  for (const response of [
    () => json({ error: 'invalid_grant', error_description: 'sensitive provider detail' }, 400),
    () => json({ error: 'invalid_grant' }),
    () => json({ error: 'unauthorized_client' }, 401),
    () => json({ error: 'temporarily_unavailable' }, 503),
  ]) {
    let calls = 0;
    await withFetch(async (url) => {
      calls += 1;
      assert.equal(url, 'https://nid.naver.com/oauth2.0/token');
      return response();
    }, async () => {
      await assert.rejects(service().verify(refreshToken), (error) => {
        assert.ok([401, 502, 503].includes(error.getStatus()));
        assert.equal(error.message.includes('sensitive'), false);
        return true;
      });
    });
    assert.equal(calls, 1);
  }
});

test('Naver rejects malformed tokens, provider responses, subjects and unexpected refresh rotation', async () => {
  for (const token of ['', 'short', 'x'.repeat(4097), `${refreshToken}\r\nX-Injected: yes`]) {
    await withFetch(async () => { assert.fail('Invalid token must not be sent upstream'); }, async () => {
      await assert.rejects(service().verify(token), (error) => error.getStatus() === 401);
    });
  }
  for (const body of [
    {}, null, [], { ...tokenBody(), access_token: 'invalid token' },
    { ...tokenBody(), token_type: 'mac' }, { ...tokenBody(), expires_in: 0 },
    { ...tokenBody(), refresh_token: 'unexpected-new-refresh-token-12345678' },
  ]) {
    await withFetch(async () => json(body), async () => {
      await assert.rejects(service().verify(refreshToken), (error) => error.getStatus() === 502);
    });
  }
  for (const body of [profileBody({}), profileBody({ id: 123 }), profileBody({ id: ' ' }), profileBody({ id: 'x'.repeat(256) })]) {
    await withFetch(async (url) => url.includes('/token') ? json(tokenBody()) : json(body), async () => {
      await assert.rejects(service().verify(refreshToken), (error) => error.getStatus() === 502);
    });
  }
});

test('Naver connection revoke uses form body and accepts HTTP 200 without JSON', async () => {
  await withFetch(async (url, init) => {
    assert.equal(url, 'https://nid.naver.com/oauth2.0/revoke');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    const body = new URLSearchParams(init.body);
    assert.equal(body.get('client_id'), credentials.NAVER_CLIENT_ID);
    assert.equal(body.get('client_secret'), credentials.NAVER_CLIENT_SECRET);
    assert.equal(body.get('token'), accessToken);
    assert.equal(body.get('token_type_hint'), 'access_token');
    return new Response(null, { status: 200 });
  }, async () => {
    await service().unlink(accessToken);
  });
  await withFetch(async () => json({ error: 'temporarily_unavailable' }, 503), async () => {
    await assert.rejects(service().unlink(accessToken), (error) => error.getStatus() === 502);
  });
});

test('Naver network/configuration errors never expose credentials or raw provider errors', async () => {
  await withFetch(async () => { throw new Error(`${refreshToken} ${credentials.NAVER_CLIENT_SECRET}`); }, async () => {
    await assert.rejects(service().verify(refreshToken), (error) => {
      assert.equal(error.getStatus(), 502);
      assert.equal(error.message.includes(refreshToken), false);
      assert.equal(error.message.includes(credentials.NAVER_CLIENT_SECRET), false);
      return true;
    });
    await assert.rejects(new NaverOAuthService({ get: () => undefined }).verify(refreshToken), (error) => error.getStatus() === 503);
  });
});

test('Naver login/deletion DTOs validate refresh proof and reject access-token-only payloads', async () => {
  assert.equal((await validate(plainToInstance(NaverLoginDto, { refreshToken }))).length, 0);
  assert.ok((await validate(plainToInstance(NaverLoginDto, { accessToken }), { whitelist: true, forbidNonWhitelisted: true })).length);
  assert.ok((await validate(plainToInstance(NaverLoginDto, { refreshToken: 'short' }))).length);
  assert.ok((await validate(plainToInstance(NaverLoginDto, { refreshToken, consents: Array.from({ length: 31 }, () => ({ termId: 1, agreed: true })) }))).length);
  assert.equal((await validate(plainToInstance(DeleteAccountDto, { confirmation: 'DELETE_MY_ACCOUNT', naverRefreshToken: refreshToken }))).length, 0);
  assert.ok((await validate(plainToInstance(DeleteAccountDto, { confirmation: 'not-confirmed', naverRefreshToken: refreshToken }))).length);
});
