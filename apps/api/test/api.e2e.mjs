import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const argon2 = require('argon2');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module.js');
const { AdminStrategiesService } = require('../dist/src/admin/admin-strategies.service.js');
const { ScreeningService } = require('../dist/src/screening/screening.service.js');
const { AuthService } = require('../dist/src/auth/auth.service.js');
const { PresetsController } = require('../dist/src/presets/presets.controller.js');
const { newOpaqueToken, hashToken } = require('../dist/src/auth/token.util.js');
const { DB_POOL } = require('../dist/src/common/database/database.module.js');
const { configureHttp, corsAllowedOrigins } = require('../dist/src/common/http/configure-http.js');

if (process.env.NODE_ENV === 'production') {
  throw new Error('E2E tests refuse to run with NODE_ENV=production');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const databaseHost = new URL(process.env.DATABASE_URL).hostname;
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(databaseHost) &&
  process.env.E2E_ALLOW_NONLOCAL_DATABASE !== 'true'
) {
  throw new Error('E2E tests only use a local database unless explicitly allowed');
}

process.env.BATCH_WORKER_ENABLED = 'false';
process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.e2e';
process.env.RATE_LIMIT_ENABLED = 'true';
process.env.RATE_LIMIT_STORE = 'memory';
process.env.AUTH_RATE_LIMIT_MAX = '3';
process.env.AUTH_RATE_LIMIT_WINDOW_SECONDS = '60';
process.env.SEARCH_RATE_LIMIT_MAX = '20';
process.env.SEARCH_RATE_LIMIT_WINDOW_SECONDS = '60';

const stamp = `${Date.now()}-${process.pid}`;
const email = `codex-e2e-${stamp}@example.invalid`;
const password = 'E2ePassword!1234';
let app;
let db;
let baseUrl;
let userId;
let securityId;
const errorRequestIds = [];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  configureHttp(app);
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  if (!address || typeof address === 'string') throw new Error('test server address unavailable');
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  db = app.get(DB_POOL);

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const client = await db.connect();
  try {
    await client.query('begin');
    userId = (
      await client.query(
        `insert into app_user(email,status_code,email_verified_at)
         values($1,'ACTIVE',now()) returning user_id`,
        [email],
      )
    ).rows[0].user_id;
    await client.query('insert into user_password(user_id,password_hash) values($1,$2)', [
      userId,
      passwordHash,
    ]);
    await client.query("insert into user_role(user_id,role_code) values($1,'USER')", [userId]);
    await client.query(
      "insert into watchlist(user_id,watchlist_name,is_default) values($1,'E2E 관심종목',true)",
      [userId],
    );
    const security = await client.query(
      'select security_id from security order by is_active desc,security_id limit 1',
    );
    if (!security.rowCount) throw new Error('09_seed_demo.sql or synced security data is required');
    securityId = Number(security.rows[0].security_id);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

after(async () => {
  let cleanupError;
  try {
    if (db && userId) {
      if (errorRequestIds.length) {
        await db.query('delete from application_error_log where request_id=any($1::uuid[])', [
          errorRequestIds,
        ]);
      }
      await db.query('delete from audit_log where actor_user_id=$1::uuid or target_id=$1::text', [
        userId,
      ]);
      await db.query('delete from screen_search_log where user_id=$1', [userId]);
      await db.query('delete from app_user where user_id=$1', [userId]);
      const residue = await db.query('select count(*)::int count from app_user where email=$1', [
        email,
      ]);
      assert.equal(residue.rows[0].count, 0, 'E2E user cleanup failed');
    }
  } catch (error) {
    cleanupError = error;
  } finally {
    if (app) await app.close().catch(() => undefined);
    if (db) await db.end().catch(() => undefined);
  }
  if (cleanupError) throw cleanupError;
});

test('public catalog endpoints', async () => {
  const health = await request('/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.ok, true);
  assert.match(health.response.headers.get('x-request-id'), UUID_PATTERN);

  const strategies = await request('/screening/strategies');
  assert.equal(strategies.response.status, 200);
  assert.ok(Array.isArray(strategies.body) && strategies.body.length >= 4);
  assert.ok(strategies.body.every((strategy) => Array.isArray(strategy.conditions)));

  const suppliedRequestId = '11111111-1111-4111-8111-111111111111';
  const metrics = await request('/metrics?basic=true', {
    headers: { 'x-request-id': suppliedRequestId },
  });
  assert.equal(metrics.response.status, 200);
  assert.equal(metrics.response.headers.get('x-request-id'), suppliedRequestId);
  assert.ok(Array.isArray(metrics.body) && metrics.body.length > 0);

  const replacedRequestId = await request('/health', {
    headers: { 'x-request-id': 'invalid-request-id' },
  });
  assert.match(replacedRequestId.response.headers.get('x-request-id'), UUID_PATTERN);
  assert.notEqual(replacedRequestId.response.headers.get('x-request-id'), 'invalid-request-id');

  const terms = await request('/terms/active');
  assert.equal(terms.response.status, 200);
  assert.ok(Array.isArray(terms.body) && terms.body.some((term) => term.is_required));

  const notices = await request('/notices');
  assert.equal(notices.response.status, 200);
  assert.ok(Array.isArray(notices.body));

  for (const limit of ['invalid', '-1', '1.5', '201']) {
    const invalidStocks = await request(`/stocks?limit=${limit}`);
    assert.equal(invalidStocks.response.status, 400, `invalid stock limit ${limit}`);
  }

  const allowedPreflight = await fetch(`${baseUrl}/health`, {
    method: 'OPTIONS',
    headers: {
      origin: 'https://allowed.e2e',
      'access-control-request-method': 'GET',
    },
  });
  assert.equal(allowedPreflight.status, 204);
  assert.equal(allowedPreflight.headers.get('access-control-allow-origin'), 'https://allowed.e2e');

  const deniedOrigin = await fetch(`${baseUrl}/health`, {
    headers: { origin: 'https://denied.e2e' },
  });
  assert.equal(deniedOrigin.status, 200);
  assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null);

  assert.throws(
    () => corsAllowedOrigins({ NODE_ENV: 'production' }),
    /CORS_ALLOWED_ORIGINS is required/,
  );
});

test('authentication and refresh-token rotation', async () => {
  const unauthorized = await request('/auth/me');
  assert.equal(unauthorized.response.status, 401);
  assert.equal(unauthorized.body.requestId, unauthorized.response.headers.get('x-request-id'));
  assert.match(unauthorized.body.requestId, UUID_PATTERN);

  const login = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.response.status, 201);
  assert.ok(login.body.accessToken && login.body.refreshToken);

  const me = await request('/auth/me', {}, login.body.accessToken);
  assert.equal(me.response.status, 200);
  assert.equal(me.body.email, email);

  const refreshed = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: login.body.refreshToken },
  });
  assert.equal(refreshed.response.status, 201);
  assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);

  const reused = await request('/auth/refresh', {
    method: 'POST',
    body: { refreshToken: login.body.refreshToken },
  });
  assert.equal(reused.response.status, 401);

  const adminDenied = await request('/admin/dashboard', {}, refreshed.body.accessToken);
  assert.equal(adminDenied.response.status, 403);

  const logout = await request('/auth/logout', {
    method: 'POST',
    body: { refreshToken: refreshed.body.refreshToken },
  });
  assert.equal(logout.response.status, 201);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const allowed = await request('/auth/password-reset/request', {
      method: 'POST',
      body: { email: `rate-limit-${stamp}@example.invalid` },
    });
    assert.equal(allowed.response.status, 201);
  }
  const rateLimited = await request('/auth/password-reset/request', {
    method: 'POST',
    body: { email: `rate-limit-${stamp}@example.invalid` },
  });
  assert.equal(rateLimited.response.status, 429);
  assert.equal(rateLimited.response.headers.get('x-ratelimit-limit'), '3');
  assert.equal(rateLimited.response.headers.get('x-ratelimit-remaining'), '0');
  assert.ok(Number(rateLimited.response.headers.get('retry-after')) > 0);
  assert.equal(rateLimited.body.requestId, rateLimited.response.headers.get('x-request-id'));
});

test('search history, watchlist, preset, and notification settings', async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(login.response.status, 201);
  const token = login.body.accessToken;

  const metricSample = await db.query(
    `select l.security_id,l.numeric_value,e.exchange_code
     from latest_metric_value l
     join financial_metric m on m.metric_id=l.metric_id and m.metric_code='CLOSE_PRICE'
     join security s on s.security_id=l.security_id
     join exchange e on e.exchange_id=s.exchange_id
     where s.is_active=true and e.is_active=true
     order by s.security_id limit 1`,
  );
  assert.equal(metricSample.rowCount, 1, 'a CLOSE_PRICE metric is required');
  const exactValue = Number(metricSample.rows[0].numeric_value);
  const exchangeCode = metricSample.rows[0].exchange_code;
  const stockDetail = await request(`/stocks/${metricSample.rows[0].security_id}`);
  assert.equal(stockDetail.response.status, 200);
  assert.ok(['CURRENT', 'DELAYED', 'MISSING'].includes(stockDetail.body.price_status));
  assert.equal(stockDetail.body.price_status === 'MISSING', stockDetail.body.latest_price === null);
  const operatorCases = [
    { operator: 'LTE', target: 1e15, accepts: (value) => value <= 1e15 },
    { operator: 'LT', target: 1e15, accepts: (value) => value < 1e15 },
    { operator: 'GTE', target: -1e15, accepts: (value) => value >= -1e15 },
    { operator: 'GT', target: -1e15, accepts: (value) => value > -1e15 },
    { operator: 'EQ', target: exactValue, accepts: (value) => value === exactValue },
    {
      operator: 'BETWEEN',
      target: -1e15,
      target2: 1e15,
      accepts: (value) => value >= -1e15 && value <= 1e15,
    },
  ];
  for (const operatorCase of operatorCases) {
    const advanced = await request(
      '/screening/search',
      {
        method: 'POST',
        body: {
          exchangeCodes: [exchangeCode],
          conditions: [
            {
              metricCode: 'CLOSE_PRICE',
              operator: operatorCase.operator,
              target: operatorCase.target,
              ...(operatorCase.target2 === undefined ? {} : { target2: operatorCase.target2 }),
            },
          ],
          limit: 20,
        },
      },
      token,
    );
    assert.equal(advanced.response.status, 201, `${operatorCase.operator} search failed`);
    assert.ok(advanced.body.results.length > 0, `${operatorCase.operator} returned no results`);
    if (operatorCase.operator === 'EQ') {
      const matchingStock = advanced.body.results.find(
        (result) => result.securityId === Number(metricSample.rows[0].security_id),
      );
      assert.ok(matchingStock, 'the exact source stock must appear in the result');
      assert.equal(matchingStock.priceStatus, stockDetail.body.price_status);
      assert.equal(matchingStock.priceAsOfDate, stockDetail.body.latest_price?.trade_date ?? null);
    }
    for (const result of advanced.body.results) {
      assert.equal(result.exchangeCode, exchangeCode);
      assert.equal(result.details[0].operator, operatorCase.operator);
      assert.equal(result.details[0].status, 'EXACT');
      assert.ok(operatorCase.accepts(result.details[0].actual));
      assert.match(result.details[0].asOfDate, /^\d{4}-\d{2}-\d{2}/);
      assert.ok(['CURRENT', 'DELAYED', 'MISSING'].includes(result.priceStatus));
      if (result.priceStatus === 'MISSING') {
        assert.equal(result.priceAsOfDate, null);
      } else {
        assert.match(result.priceAsOfDate, /^\d{4}-\d{2}-\d{2}$/);
      }
    }
  }

  const invalidSearch = await request(
    '/screening/search',
    { method: 'POST', body: { strategyCode: 'UNDERVALUED', unexpected: true } },
    token,
  );
  assert.equal(invalidSearch.response.status, 400);
  assert.equal(invalidSearch.body.requestId, invalidSearch.response.headers.get('x-request-id'));
  assert.match(invalidSearch.body.requestId, UUID_PATTERN);

  const search = await request(
    '/screening/search',
    { method: 'POST', body: { strategyCode: 'UNDERVALUED', limit: 5 } },
    token,
  );
  assert.equal(search.response.status, 201);
  assert.ok(Array.isArray(search.body.results));
  const searchRequestId = search.response.headers.get('x-request-id');
  const persistedSearchRequest = await db.query(
    'select request_id from screen_search_log where user_id=$1 order by search_log_id desc limit 1',
    [userId],
  );
  assert.equal(persistedSearchRequest.rows[0].request_id, searchRequestId);

  const history = await request('/screening/history?limit=10', {}, token);
  assert.equal(history.response.status, 200);
  assert.ok(history.body.items.some((item) => item.strategyCode === 'UNDERVALUED'));

  const deleteHistory = await request(
    `/screening/history/${history.body.items[0].id}`,
    { method: 'DELETE' },
    token,
  );
  assert.equal(deleteHistory.response.status, 200);
  assert.equal(deleteHistory.body.deleted, true);

  const addWatch = await request(
    '/watchlists/default/items',
    { method: 'POST', body: { securityId, memo: 'E2E' } },
    token,
  );
  assert.equal(addWatch.response.status, 201);
  const addWatchRequestId = addWatch.response.headers.get('x-request-id');
  const persistedAuditRequest = await db.query(
    `select request_id from audit_log
     where actor_user_id=$1 and action_code='WATCHLIST_CHANGE'
     order by audit_log_id desc limit 1`,
    [userId],
  );
  assert.equal(persistedAuditRequest.rows[0].request_id, addWatchRequestId);
  const watchlist = await request('/watchlists/default', {}, token);
  assert.equal(watchlist.response.status, 200);
  assert.ok(watchlist.body.some((item) => Number(item.security_id) === securityId));
  const removeWatch = await request(
    `/watchlists/default/items/${securityId}`,
    { method: 'DELETE' },
    token,
  );
  assert.equal(removeWatch.response.status, 200);

  const missingWatch = await request(
    '/watchlists/default/items',
    {
      method: 'POST',
      body: { securityId: 9007199254740991 },
    },
    token,
  );
  assert.equal(missingWatch.response.status, 404);

  const createdPreset = await request(
    '/presets',
    {
      method: 'POST',
      body: {
        name: `E2E preset ${stamp}`,
        description: 'automated integration test',
        mode: 'ADVANCED_BASIC',
        markets: ['KR', 'US'],
        conditions: [{ metricCode: 'PER', operator: 'LTE', target: 15, weight: 1 }],
      },
    },
    token,
  );
  assert.equal(createdPreset.response.status, 201);
  const presetId = Number(createdPreset.body.presetId);

  const presets = await request('/presets', {}, token);
  assert.equal(presets.response.status, 200);
  assert.ok(presets.body.some((preset) => Number(preset.preset_id) === presetId));

  const updatedPreset = await request(
    `/presets/${presetId}`,
    {
      method: 'PATCH',
      body: {
        name: `E2E preset updated ${stamp}`,
        description: 'updated',
        mode: 'ADVANCED_BASIC',
        markets: ['US'],
        conditions: [{ metricCode: 'PBR', operator: 'LTE', target: 2, weight: 1 }],
      },
    },
    token,
  );
  assert.equal(updatedPreset.response.status, 200);
  assert.equal(Number(updatedPreset.body.presetId), presetId);

  const settings = await request(
    '/presets/notification-settings',
    { method: 'PATCH', body: { enabled: true, emailEnabled: false, intervalDays: 3 } },
    token,
  );
  assert.equal(settings.response.status, 200);
  assert.equal(settings.body.custom_company_enabled, true);
  assert.equal(settings.body.notification_interval_days, 3);

  const invalidPreset = await request(
    '/presets',
    {
      method: 'POST',
      body: {
        name: `E2E invalid preset ${stamp}`,
        mode: 'ADVANCED_BASIC',
        conditions: [{ metricCode: 'E2E_UNKNOWN_METRIC', operator: 'LTE', target: 1, weight: 1 }],
      },
    },
    token,
  );
  assert.equal(invalidPreset.response.status, 400);
  for (const conditions of [
    [],
    [{ metricCode: 'PER', operator: 'INVALID', target: 1 }],
    [{ metricCode: 'PER', operator: 'BETWEEN', target: 20, target2: 10 }],
    [{ metricCode: 'PER', operator: 'LTE', target: 15, weight: -1 }],
  ]) {
    const invalid = await request(
      '/presets',
      {
        method: 'POST',
        body: { name: `E2E invalid preset ${stamp}`, conditions },
      },
      token,
    );
    assert.equal(invalid.response.status, 400);
  }
  const persistedPresets = await request('/presets', {}, token);
  assert.equal(persistedPresets.body.length, 1, 'invalid conditions must not be persisted');

  const controller = app.get(PresetsController);
  const originalPersistPreset = controller.persistPreset;
  let serverError;
  try {
    controller.persistPreset = async () => {
      throw new Error('E2E injected server failure');
    };
    serverError = await request(
      '/presets',
      {
        method: 'POST',
        body: {
          name: `E2E server failure ${stamp}`,
          conditions: [{ metricCode: 'PER', operator: 'LTE', target: 15 }],
        },
      },
      token,
    );
  } finally {
    controller.persistPreset = originalPersistPreset;
  }
  assert.equal(serverError.response.status, 500);
  assert.equal(serverError.body.message, '서버 오류가 발생했습니다.');
  assert.equal(serverError.body.requestId, serverError.response.headers.get('x-request-id'));
  errorRequestIds.push(serverError.body.requestId);
  const persistedError = await db.query(
    `select error_code,error_class,context_json
     from application_error_log where request_id=$1`,
    [serverError.body.requestId],
  );
  assert.equal(persistedError.rowCount, 1);
  assert.equal(persistedError.rows[0].error_code, 'HTTP_UNHANDLED_EXCEPTION');
  assert.equal(persistedError.rows[0].context_json.path, '/api/presets');

  const deletePreset = await request(`/presets/${presetId}`, { method: 'DELETE' }, token);
  assert.equal(deletePreset.response.status, 200);
});

test('a refresh token rotates once under concurrency and admin revocation is immediate', async () => {
  const auth = app.get(AuthService);
  const login = await auth.login(email, password);
  const attempts = await Promise.allSettled([
    auth.refresh(login.refreshToken),
    auth.refresh(login.refreshToken),
    auth.refresh(login.refreshToken),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  for (const rejected of attempts.filter((attempt) => attempt.status === 'rejected')) {
    assert.equal(rejected.reason.getStatus(), 401);
  }

  await db.query("insert into user_role(user_id,role_code) values($1,'ADMIN')", [userId]);
  let adminLogin;
  try {
    adminLogin = await auth.login(email, password);
    const allowed = await request('/admin/dashboard', {}, adminLogin.accessToken);
    assert.equal(allowed.response.status, 200);
  } finally {
    await db.query("delete from user_role where user_id=$1 and role_code='ADMIN'", [userId]);
  }
  const denied = await request('/admin/dashboard', {}, adminLogin.accessToken);
  assert.equal(denied.response.status, 403);
});

test('an email verification link cannot reactivate a suspended account', async () => {
  const verificationToken = newOpaqueToken();
  await db.query(
    `insert into verification_token(user_id,token_hash,purpose_code,expires_at)
     values($1,$2,'EMAIL_VERIFY',now()+interval '30 minutes')`,
    [userId, hashToken(verificationToken)],
  );
  try {
    await db.query("update app_user set status_code='SUSPENDED' where user_id=$1", [userId]);
    await assert.rejects(
      app.get(AuthService).confirmEmailVerification(verificationToken),
      (error) => error.getStatus() === 400,
    );
    const user = await db.query('select status_code from app_user where user_id=$1', [userId]);
    assert.equal(user.rows[0].status_code, 'SUSPENDED');
  } finally {
    await db.query("update app_user set status_code='ACTIVE' where user_id=$1", [userId]);
    await db.query('delete from verification_token where token_hash=$1', [
      hashToken(verificationToken),
    ]);
  }
});

test('admin-configured strategy sort is persisted and used by screening', async () => {
  const code = `E2E_SORT_${stamp}`;
  let strategyId;
  try {
    const created = await db.query(
      `insert into screen_strategy(strategy_code,strategy_name,description,display_order,
                                   sort_metric_code,sort_direction)
       values($1,'E2E sort','temporary sorting test',999,'PER','ASC')
       returning strategy_id`,
      [code],
    );
    strategyId = Number(created.rows[0].strategy_id);
    await db.query(
      `insert into screen_strategy_condition(strategy_id,metric_id,operator_code,target_value,weight,required)
       select $1,metric_id,'LTE',100000,1,true from financial_metric where metric_code='PER'`,
      [strategyId],
    );

    const changed = await app.get(AdminStrategiesService).update(userId, strategyId, {
      name: 'E2E sort',
      description: 'temporary sorting test',
      isActive: true,
      displayOrder: 999,
      sortMetricCode: 'ROE',
      sortDirection: 'DESC',
      conditions: [
        { metricCode: 'PER', operator: 'LTE', target: 100000, weight: 1, required: true },
      ],
    });
    assert.equal(changed.sortMetricCode, 'ROE');
    assert.equal(changed.sortDirection, 'DESC');
    const persisted = await db.query(
      'select sort_metric_code,sort_direction from screen_strategy where strategy_id=$1',
      [strategyId],
    );
    assert.equal(persisted.rows[0].sort_metric_code, 'ROE');
    assert.equal(persisted.rows[0].sort_direction, 'DESC');

    const search = await app
      .get(ScreeningService)
      .search({ strategyCode: code, limit: 50 }, undefined, false);
    for (let index = 1; index < search.results.length; index++) {
      const previous = search.results[index - 1];
      const current = search.results[index];
      if (previous.matchType !== current.matchType || previous.similarity !== current.similarity)
        continue;
      const previousValue = previous.values.ROE?.value;
      const currentValue = current.values.ROE?.value;
      if (!Number.isFinite(previousValue)) assert.equal(Number.isFinite(currentValue), false);
      else if (Number.isFinite(currentValue)) assert.ok(previousValue >= currentValue);
    }
  } finally {
    if (strategyId)
      await db.query('delete from screen_strategy where strategy_id=$1', [strategyId]);
  }
});

async function request(path, init = {}, accessToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { response, body };
}
