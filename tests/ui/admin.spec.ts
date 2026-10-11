import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, NOTICE_PREFIX, TEST_PASSWORD } from './test-accounts';

const ADMIN = 'http://127.0.0.1:3101';

async function login(page: import('@playwright/test').Page) {
  const response = await page.request.post(`${ADMIN}/api/session/login`, {
    headers: { origin: ADMIN },
    data: { email: ADMIN_EMAIL, password: TEST_PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(200);
}

test.describe.serial('admin browser', () => {
  test('all admin pages require a session', async ({ page }) => {
    for (const path of [
      '/dashboard',
      '/tolerances',
      '/providers',
      '/batches',
      '/rankings',
      '/strategies',
      '/notices',
      '/logs',
      '/terms',
    ]) {
      await page.goto(`${ADMIN}${path}`);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test('security headers and same-origin mutation protection', async ({ request }) => {
    const page = await request.get(`${ADMIN}/login`);
    expect(page.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(page.headers()['content-security-policy']).not.toContain("'unsafe-eval'");
    expect(page.headers()['x-frame-options']).toBe('DENY');
    expect(page.headers()['x-content-type-options']).toBe('nosniff');

    const rejected = await request.post(`${ADMIN}/api/session/login`, {
      headers: { origin: 'https://attacker.invalid' },
      data: { email: ADMIN_EMAIL, password: TEST_PASSWORD },
    });
    expect(rejected.status()).toBe(403);

    const allowed = await request.post(`${ADMIN}/api/session/login`, {
      headers: { origin: ADMIN },
      data: { email: ADMIN_EMAIL, password: TEST_PASSWORD },
    });
    expect(allowed.status(), await allowed.text()).toBe(200);
  });

  test('strategy sort is configured separately from search conditions', async ({ page }) => {
    await page.goto(`${ADMIN}/login`);
    await page.getByPlaceholder('email').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    const strategiesLoaded = page.waitForResponse((response) =>
      response.url().endsWith('/api/admin/strategies'),
    );
    await page.getByRole('link', { name: '전략 관리' }).click();
    const strategiesResponse = await strategiesLoaded;
    expect(strategiesResponse.ok()).toBeTruthy();
    const strategies = await strategiesResponse.json();
    const strategy = strategies.find((item: { code: string }) => item.code === 'STABLE');
    expect(strategy).toBeTruthy();
    await page.getByRole('button').filter({ hasText: 'STABLE' }).click();
    await expect(page.getByLabel('정렬 지표')).toHaveValue(strategy.sortMetricCode ?? '');
    await expect(page.getByLabel('정렬 방향')).toHaveValue(strategy.sortDirection);

    await page.setViewportSize({ width: 1024, height: 768 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBeTruthy();
    await page.getByLabel('정렬 지표').selectOption('PER');
    await page.getByLabel('정렬 방향').selectOption('DESC');
    let payload: any;
    await page.route(`**/api/admin/strategies/${strategy.id}`, async (route) => {
      payload = route.request().postDataJSON();
      await route.fulfill({ status: 503, json: { message: '저장 서버 점검 중입니다.' } });
    });
    await page.getByRole('button', { name: '저장', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('저장 서버 점검 중입니다.');
    await expect(page.getByLabel('정렬 방향')).toHaveValue('DESC');
    await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();
    expect(payload.sortMetricCode).toBe('PER');
    expect(payload.sortDirection).toBe('DESC');
    expect(payload.conditions).toHaveLength(strategy.conditions.length);
  });

  test('expired access cookie refreshes simultaneous admin requests', async ({ page }) => {
    await login(page);
    await page.context().clearCookies({ name: 'admin_access' });
    const responses = Promise.all([
      page.waitForResponse((response) => response.url().includes('/api/admin/batch-runs')),
      page.waitForResponse((response) =>
        response.url().includes('/api/admin/batches/data-quality'),
      ),
    ]);
    await page.goto(`${ADMIN}/batches`);
    for (const response of await responses) expect(response.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: '배치·데이터 품질', exact: true }),
    ).toBeVisible();
    expect(
      (await page.context().cookies()).some((cookie) => cookie.name === 'admin_access'),
    ).toBeTruthy();
  });

  test('load failures are visible and retry recovers without a page crash', async ({ page }) => {
    await login(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/api/admin/providers', (route) =>
      route.fulfill({
        status: 503,
        json: { message: '데이터 서버 점검 중입니다.' },
      }),
    );
    await page.goto(`${ADMIN}/providers`);
    const feedback = page.getByRole('alert').filter({ hasText: '데이터 서버 점검 중입니다.' });
    await expect(feedback).toBeVisible();
    await expect(page.getByText('데이터 없음', { exact: true })).toHaveCount(0);
    await page.unroute('**/api/admin/providers');
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(feedback).toHaveCount(0);
    await expect(page.getByRole('table')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('draft term editor keeps save errors inside the dialog and closes with Escape', async ({
    page,
  }) => {
    await login(page);
    await page.route('**/api/admin/terms', (route) =>
      route.fulfill({
        json: [
          {
            term_id: 98765,
            term_code: 'SERVICE',
            title: '편집 확인 약관',
            version: 'test',
            content: '화면 검증용 약관입니다.',
            is_required: true,
            status_code: 'DRAFT',
            effective_from: null,
          },
        ],
      }),
    );
    await page.route('**/api/admin/terms/98765', (route) =>
      route.fulfill({
        status: 503,
        json: { message: '약관 저장 서버 점검 중입니다.' },
      }),
    );
    await page.goto(`${ADMIN}/terms`);
    await page.getByRole('button', { name: '수정', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('제목', { exact: true }).fill('편집한 약관');
    await dialog.getByRole('button', { name: '저장', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('약관 저장 서버 점검 중입니다.');
    await expect(dialog.getByLabel('제목', { exact: true })).toHaveValue('편집한 약관');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('login, admin screens, notice lifecycle, export, and logout', async ({ page }) => {
    page.on('dialog', (dialog) => dialog.accept());
    await page.context().clearCookies();
    await page.goto(`${ADMIN}/login`);
    await page.getByPlaceholder('email').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('가치보는주식', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    const pages: Array<[string, string]> = [
      ['Tolerance', '근접검색 허용오차'],
      ['Providers', 'Providers'],
      ['Batches', '배치·데이터 품질'],
      ['전략 관리', '전략 관리'],
      ['Audit Logs', 'Audit Logs'],
      ['약관 관리', '약관 관리'],
    ];
    let terms: Array<{ title: string }> = [];
    for (const [link, heading] of pages) {
      const termsLoaded =
        link === '약관 관리'
          ? page.waitForResponse((response) => response.url().endsWith('/api/admin/terms'))
          : null;
      await page.getByRole('link', { name: link }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      if (termsLoaded) {
        const termsResponse = await termsLoaded;
        expect(termsResponse.ok()).toBeTruthy();
        terms = await termsResponse.json();
      }
    }
    await expect(page.locator('tbody tr')).toHaveCount(terms.length);
    if (terms.length) {
      await expect(
        page.getByRole('cell', { name: terms[0].title, exact: true }).first(),
      ).toBeVisible();
    }

    await page.getByRole('link', { name: '공지 관리' }).click();
    await expect(page.getByRole('heading', { name: '공지 관리' })).toBeVisible();
    const title = `${NOTICE_PREFIX} ${Date.now()}`;
    await page.locator('input.field').first().fill(title);
    await page.locator('textarea.field').fill('브라우저 자동 검증 후 삭제됩니다.');
    await page.getByRole('button', { name: '작성 중으로 저장' }).click();
    const notice = page.locator('article').filter({ hasText: title });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: '삭제' }).click();
    await expect(notice).toHaveCount(0);

    await page.getByRole('link', { name: 'Excel Export' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Excel 다운로드' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^기업순위분석_US_\d{4}-\d{2}-\d{2}\.xlsx$/);

    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      (await page.context().cookies()).filter((cookie) => cookie.name.startsWith('admin_')),
    ).toHaveLength(0);
  });
});
