import { expect, test } from '@playwright/test';
import { TEST_PASSWORD, USER_EMAIL } from './test-accounts';

const MOBILE = 'http://127.0.0.1:3102';

test.describe.serial('mobile web smoke', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('home, screening, login session, and logout', async ({ page }) => {
    await page.route('http://localhost:3000/api/**', async (route) => {
      const url = route.request().url().replace('http://localhost:3000', 'http://127.0.0.1:3201');
      await route.fulfill({ response: await route.fetch({ url }) });
    });
    page.on('dialog', (dialog) => dialog.accept());
    await page.goto(MOBILE);
    await expect(page.getByText('숫자로 확인하는')).toBeVisible();
    await expect(page.getByText('저평가 기업')).toBeVisible();

    await page.getByRole('button', { name: '저평가 기업 찾아보기' }).click();
    await expect(page.getByText('검색 결과', { exact: true })).toBeVisible();
    await expect(page.getByText('정확 일치')).toBeVisible();

    await page.getByRole('button', { name: '조건검색 탭으로 이동' }).click();
    await expect(page.getByText('조건 검색', { exact: true })).toBeVisible();
    await expect(page.getByText('쉬운 검색')).toBeVisible();

    await page.goto(`${MOBILE}/auth/login`);
    await page.getByPlaceholder('이메일').fill(USER_EMAIL);
    await page.getByPlaceholder('비밀번호').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText(USER_EMAIL)).toBeVisible();
    await expect(page.getByText('이메일 인증 완료')).toBeVisible();

    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
    const stored = await page.evaluate(() => ({
      access: localStorage.getItem('auth.access'),
      refresh: localStorage.getItem('auth.refresh'),
    }));
    expect(stored).toEqual({ access: null, refresh: null });
  });
});
