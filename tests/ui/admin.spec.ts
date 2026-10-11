import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL, NOTICE_PREFIX, TEST_PASSWORD } from './test-accounts';

const ADMIN = 'http://127.0.0.1:3101';

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
    for (const [link, heading] of pages) {
      await page.getByRole('link', { name: link }).click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    await expect(page.getByRole('cell', { name: '서비스 이용약관 (검토 초안)' })).toBeVisible();

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
