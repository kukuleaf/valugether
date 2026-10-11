import { expect, test, type Page, type Route } from '@playwright/test';

const MOBILE = 'http://127.0.0.1:3102';
const API = 'http://localhost:3000/api';

const metrics = [
  {
    metric_code: 'PER',
    metric_name_ko: 'PER',
    statement_type: 'VALUATION',
    unit_type: 'RATIO',
    default_operator: 'LTE',
  },
  {
    metric_code: 'ROE',
    metric_name_ko: 'ROE',
    statement_type: 'RATIO',
    unit_type: 'PERCENT',
    default_operator: 'GTE',
  },
  {
    metric_code: 'PBR',
    metric_name_ko: 'PBR',
    statement_type: 'VALUATION',
    unit_type: 'RATIO',
    default_operator: 'LTE',
  },
  {
    metric_code: 'EPS_GROWTH_YOY',
    metric_name_ko: 'EPS 성장률',
    statement_type: 'GROWTH',
    unit_type: 'PERCENT',
    default_operator: 'GTE',
  },
  {
    metric_code: 'DEBT_RATIO',
    metric_name_ko: '부채비율',
    statement_type: 'RATIO',
    unit_type: 'PERCENT',
    default_operator: 'LTE',
  },
  {
    metric_code: 'PROFITABLE_CONSECUTIVE_YEARS',
    metric_name_ko: '연속 흑자 연수',
    statement_type: 'TREND',
    unit_type: 'COUNT',
    default_operator: 'GTE',
  },
].map((metric) => ({ ...metric, basic_search: true, user_selectable: true }));

const preset = (id: number, name: string) => ({
  preset_id: id,
  preset_name: name,
  description: null,
  search_mode: 'ADVANCED_BASIC',
  market_filter_json: ['KR'],
  exchange_filter_json: ['KOSPI'],
  conditions: [{ metricCode: 'PER', operator: 'LTE', target: 15 }],
});
const profile = {
  email: 'mobile-audit@example.test',
  social_email: null,
  email_verified_at: '2026-01-01',
  last_login_at: null,
  created_at: '2026-01-01',
  has_password: true,
  social_providers: [],
  preset_count: 1,
  watchlist_count: 0,
};
const notificationSettings = {
  custom_company_enabled: false,
  email_enabled: false,
  email_available: false,
  notification_interval_days: 7,
  next_notification_at: null,
  last_notification_at: null,
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function session(page: Page, access = 'valid-access', refresh = 'valid-refresh') {
  await page.addInitScript(
    ({ access, refresh }) => {
      localStorage.setItem('auth.access', access);
      localStorage.setItem('auth.refresh', refresh);
    },
    { access, refresh },
  );
}

test.describe('mobile behavior regressions', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.route(`${API}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api', '');
      if (path === '/metrics') return json(route, metrics);
      if (path === '/auth/me') return json(route, profile);
      if (path === '/auth/logout') return json(route, { ok: true });
      if (path === '/presets') return json(route, [preset(1, '나의 기준')]);
      if (path === '/presets/notifications/inbox') return json(route, []);
      if (path === '/screening/search')
        return json(route, { exactCount: 0, nearCount: 0, results: [] });
      return json(route, []);
    });
  });

  test('parallel protected requests refresh once and preserve the session', async ({ page }) => {
    await session(page, 'expired-access', 'old-refresh');
    let refreshCount = 0;
    let unauthorizedCount = 0;
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    await page.route(`${API}/auth/refresh`, async (route) => {
      refreshCount += 1;
      await refreshGate;
      await json(route, { accessToken: 'new-access', refreshToken: 'new-refresh' });
    });
    await page.route(`${API}/presets{,/notifications/inbox}`, async (route) => {
      if (route.request().headers().authorization !== 'Bearer new-access') {
        unauthorizedCount += 1;
        return json(route, { message: 'expired' }, 401);
      }
      return json(
        route,
        route.request().url().endsWith('/inbox') ? [] : [preset(1, '갱신 후 기준')],
      );
    });
    await page.goto(`${MOBILE}/custom`);
    await expect.poll(() => unauthorizedCount).toBe(2);
    expect(refreshCount).toBe(1);
    releaseRefresh();
    await expect(page.getByRole('button', { name: '오늘의 조건 충족 기업 조회' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '갱신 후 기준' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('auth.refresh'))).toBe('new-refresh');
  });

  test('logout during an in-flight refresh cannot sign the user back in', async ({ page }) => {
    await session(page, 'expired-access', 'old-refresh');
    let refreshCount = 0;
    let releaseRefresh!: () => void;
    const refreshGate = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    await page.route(`${API}/presets{,/notifications/inbox}`, (route) =>
      json(route, { message: 'expired' }, 401),
    );
    await page.route(`${API}/auth/refresh`, async (route) => {
      refreshCount += 1;
      await refreshGate;
      await json(route, { accessToken: 'late-access', refreshToken: 'late-refresh' });
    });
    await page.goto(`${MOBILE}/custom`);
    await expect.poll(() => refreshCount).toBe(1);
    await page.getByRole('tab', { name: /내 정보/ }).click();
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    releaseRefresh();
    await page.getByRole('tab', { name: /맞춤기업/ }).click();
    await expect(page.getByText('로그인이 필요합니다', { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => [
        localStorage.getItem('auth.access'),
        localStorage.getItem('auth.refresh'),
      ]),
    ).toEqual([null, null]);
  });

  test('returning after a selected preset is deleted selects a remaining preset', async ({
    page,
  }) => {
    await session(page);
    let rows = [preset(1, '남은 기준'), preset(2, '삭제할 기준')];
    await page.route(`${API}/presets`, (route) => json(route, rows));
    await page.goto(`${MOBILE}/custom`);
    await page.getByRole('radio', { name: '삭제할 기준' }).click();
    await page.getByRole('tab', { name: /내 정보/ }).click();
    await expect(page.getByText(profile.email)).toBeVisible();
    rows = [preset(1, '남은 기준')];
    await page.getByRole('tab', { name: /맞춤기업/ }).click();
    await expect(page.getByRole('button', { name: '오늘의 조건 충족 기업 조회' })).toBeVisible();
    await expect(page.getByRole('radio', { name: '삭제할 기준' })).toHaveCount(0);
  });

  test('enabling debt limit submits its displayed default', async ({ page }) => {
    let submitted: any;
    await page.route(`${API}/screening/search`, async (route) => {
      submitted = route.request().postDataJSON();
      await json(route, { exactCount: 0, nearCount: 0, results: [] });
    });
    await page.goto(`${MOBILE}/advanced`);
    await page.getByRole('switch', { name: '부채비율 제한', exact: true }).click();
    await expect(page.getByLabel('부채비율 기준값', { exact: true })).toHaveValue('100');
    await page.getByRole('button', { name: '회사 찾기', exact: true }).click();
    await expect(page.getByText('조건에 맞는 기업이 없습니다')).toBeVisible();
    expect(submitted.conditions).toContainEqual({
      metricCode: 'DEBT_RATIO',
      operator: 'LTE',
      target: 100,
    });
  });

  test('editing a range preserves its upper limit and weight', async ({ page }) => {
    await session(page);
    const rangePreset = {
      ...preset(7, '범위 기준'),
      search_mode: 'ADVANCED_DETAIL',
      conditions: [{ metricCode: 'ROE', operator: 'BETWEEN', target: 10, target2: 20, weight: 2 }],
    };
    let submitted: any;
    await page.route(`${API}/presets/7`, async (route) => {
      if (route.request().method() === 'PATCH') {
        submitted = route.request().postDataJSON();
        return json(route, { presetId: 7 });
      }
      return json(route, rangePreset);
    });
    await page.goto(`${MOBILE}/advanced?presetId=7`);
    await page.getByRole('button', { name: /수익성과 안정성/ }).click();
    await expect(page.getByLabel('ROE 범위 최댓값')).toHaveValue('20');
    await page.getByLabel('ROE 기준값', { exact: true }).fill('11');
    await page.getByRole('button', { name: '맞춤기업 기준 수정', exact: true }).click();
    await page.getByRole('button', { name: '수정 저장', exact: true }).click();
    await expect(page).toHaveURL(/\/presets\/7$/);
    expect(submitted.conditions).toEqual([
      { metricCode: 'ROE', operator: 'BETWEEN', target: 11, target2: 20, weight: 2 },
    ]);
  });

  test('notification load failures cannot overwrite saved settings; retry recovers', async ({
    page,
  }) => {
    await session(page);
    await page.setViewportSize({ width: 320, height: 480 });
    let fail = true;
    let saves = 0;
    await page.route(`${API}/presets/notification-settings`, (route) => {
      if (route.request().method() === 'PATCH') {
        saves += 1;
        return json(route, notificationSettings);
      }
      return fail
        ? json(route, { message: '설정 연결 실패' }, 503)
        : json(route, notificationSettings);
    });
    await page.goto(`${MOBILE}/notification-settings`);
    await expect(page.getByText('설정 연결 실패')).toBeVisible();
    await expect(page.getByRole('button', { name: '알림 설정 저장' })).toHaveCount(0);
    expect(saves).toBe(0);
    fail = false;
    await page.getByRole('button', { name: '다시 시도' }).click();
    await page.getByRole('button', { name: '알림 설정 저장' }).click();
    await expect(page.getByText('알림 설정을 저장했습니다.')).toBeVisible();
    expect(saves).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test('watchlist service errors show retry without asking the user to log in again', async ({
    page,
  }) => {
    await session(page);
    let fail = true;
    await page.route(`${API}/watchlists/default`, (route) =>
      fail ? json(route, { message: '관심기업 연결 실패' }, 503) : json(route, []),
    );
    await page.goto(`${MOBILE}/watchlist`);
    await expect(page.getByText('관심기업 연결 실패')).toBeVisible();
    await expect(page.getByText('로그인이 필요합니다')).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.getByText('아직 관심기업이 없습니다')).toBeVisible();
  });

  test('failed login is visible and unavailable terms prevent registration', async ({ page }) => {
    await page.route(`${API}/auth/login`, (route) =>
      json(route, { message: '이메일 또는 비밀번호를 확인해 주세요.' }, 401),
    );
    await page.route(`${API}/terms/active`, (route) =>
      json(route, { message: 'unavailable' }, 503),
    );
    await page.goto(`${MOBILE}/auth/login`);
    await page.getByPlaceholder('이메일').fill('person@example.test');
    await page.getByPlaceholder('비밀번호').fill('incorrect-password');
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(
      page.getByText('이메일 또는 비밀번호를 확인해 주세요.', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: '새 계정 만들기' }).click();
    await expect(page.getByText('약관을 불러오지 못했습니다. 다시 시도해 주세요.')).toBeVisible();
    await expect(page.getByRole('button', { name: '가입하기' })).toBeDisabled();
  });

  test('preset removal requires confirmation and cancel makes no request', async ({ page }) => {
    await session(page);
    let deletes = 0;
    await page.route(`${API}/presets/1`, (route) => {
      if (route.request().method() === 'DELETE') {
        deletes += 1;
        return json(route, { ok: true });
      }
      return json(route, preset(1, '삭제 확인 기준'));
    });
    await page.goto(`${MOBILE}/presets/1`);
    await page.getByRole('button', { name: '기준 삭제', exact: true }).click();
    await expect(page.getByText("'삭제 확인 기준' 기준을 삭제할까요?")).toBeVisible();
    expect(deletes).toBe(0);
    await page.getByRole('button', { name: '취소', exact: true }).click();
    expect(deletes).toBe(0);
    await page.getByRole('button', { name: '기준 삭제', exact: true }).click();
    await page.getByRole('button', { name: '삭제', exact: true }).click();
    await expect(page).toHaveURL(/\/custom$/);
    expect(deletes).toBe(1);
  });
});
