import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } = require('jose');
const { verifyKakaoIdToken } = require('../dist/src/auth/kakao-oidc.service.js');

test('Kakao ID token verifies signature, issuer, audience, expiry, and nonce', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const key = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const keys = createLocalJWKSet({ keys: [key] });
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({
    nonce: 'expected-nonce',
    auth_time: now,
    email: ' TEST@EXAMPLE.COM ',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://kauth.kakao.com')
    .setAudience('native-app-key')
    .setSubject('123456789')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(privateKey);

  assert.deepEqual(await verifyKakaoIdToken(token, 'expected-nonce', 'native-app-key', keys), {
    subject: '123456789',
    email: 'test@example.com',
    authenticatedAt: now,
  });
  await assert.rejects(verifyKakaoIdToken(token, 'wrong-nonce', 'native-app-key', keys));
  await assert.rejects(verifyKakaoIdToken(token, 'expected-nonce', 'other-app-key', keys));

  const expired = await new SignJWT({ nonce: 'expected-nonce', auth_time: now - 900 })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://kauth.kakao.com')
    .setAudience('native-app-key')
    .setSubject('123456789')
    .setIssuedAt(now - 900)
    .setExpirationTime(now - 600)
    .sign(privateKey);
  await assert.rejects(verifyKakaoIdToken(expired, 'expected-nonce', 'native-app-key', keys));

  const { privateKey: wrongPrivateKey } = await generateKeyPair('RS256');
  const forged = await new SignJWT({ nonce: 'expected-nonce', auth_time: now })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer('https://kauth.kakao.com')
    .setAudience('native-app-key')
    .setSubject('123456789')
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(wrongPrivateKey);
  await assert.rejects(verifyKakaoIdToken(forged, 'expected-nonce', 'native-app-key', keys));
});
