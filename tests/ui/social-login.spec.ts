import { expect, test } from '@playwright/test';

const MOBILE = 'http://127.0.0.1:3102';
const API = 'http://localhost:3000/api';

test.describe('official social login buttons', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('official images load in order, retain proportions, and fit a narrow screen', async ({
    page,
  }, testInfo) => {
    await page.goto(`${MOBILE}/auth/login`);
    const google = page.getByTestId('social-google');
    const kakao = page.getByTestId('social-kakao');
    const naver = page.getByTestId('social-naver');
    await expect(google).toBeDisabled();
    await expect(naver).toBeDisabled();
    await expect(kakao).toBeEnabled();
    await expect(google).toHaveAttribute('aria-label', 'Google로 로그인 · 현재 이용 불가');
    await expect(kakao).toHaveAttribute('aria-label', '카카오로 로그인');
    await expect(naver).toHaveAttribute('aria-label', '네이버로 로그인');
    await expect(page.getByText('Google 로그인 준비 중')).toHaveCount(0);
    await expect(page.getByText('네이버 로그인 준비 중')).toHaveCount(0);
    await expect(
      page.getByText('카카오·네이버 로그인은 Android 앱에서 사용할 수 있습니다.'),
    ).toHaveCount(0);

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const buttonWidths: number[] = [];
      for (const [provider, aspect] of [
        ['google', 720 / 160],
        ['kakao', 896 / 184],
        ['naver', 840 / 192],
      ] as const) {
        const button = page.getByTestId(`social-${provider}`);
        await button.scrollIntoViewIfNeeded();
        const bounds = await button.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.height).toBeGreaterThanOrEqual(48);
        buttonWidths.push(bounds!.width);
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        const image = page.getByTestId(`${provider}-login-image`);
        await expect(image).toBeVisible();
        await expect
          .poll(() =>
            image.locator('img').evaluate((element) => {
              const image = element as HTMLImageElement;
              return image.complete && image.naturalWidth > 0;
            }),
          )
          .toBe(true);
        const imageBounds = await image.boundingBox();
        expect(Math.abs(imageBounds!.width - bounds!.width)).toBeLessThanOrEqual(1);
        expect(imageBounds!.width / imageBounds!.height).toBeCloseTo(aspect, 1);
      }
      expect(Math.max(...buttonWidths) - Math.min(...buttonWidths)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const order = await page
        .locator('[data-testid^="social-"]')
        .evaluateAll((elements) => elements.map((element) => element.getAttribute('data-testid')));
      expect(order).toEqual(['social-google', 'social-kakao', 'social-naver']);
      await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true });
    }
  });

  test('NAVER profiles use provider-specific labels and logout clears the app session on web', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth.access', 'naver-app-access');
      localStorage.setItem('auth.refresh', 'naver-app-refresh');
    });
    await page.route(`${API}/auth/me`, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          email: null,
          social_email: null,
          email_verified_at: null,
          last_login_at: null,
          created_at: '2026-01-01',
          has_password: false,
          social_providers: ['NAVER'],
          preset_count: 0,
          watchlist_count: 0,
        }),
      }),
    );
    await page.route(`${API}/auth/logout`, (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      }),
    );
    await page.goto(`${MOBILE}/settings`);
    await expect(page.getByText('네이버 계정', { exact: true })).toBeVisible();
    await expect(page.getByText('네이버 로그인 · 별도 이메일 인증 없음')).toBeVisible();
    await page.getByRole('button', { name: '회원 탈퇴', exact: true }).click();
    await expect(page.getByRole('button', { name: '네이버 재인증 후 영구 탈퇴' })).toBeDisabled();
    await expect(
      page.getByText('네이버로 가입한 Android 앱에서 탈퇴할 수 있습니다.'),
    ).toBeVisible();
    await page.goBack();
    await page.getByRole('button', { name: '로그아웃', exact: true }).click();
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => [
        localStorage.getItem('auth.access'),
        localStorage.getItem('auth.refresh'),
      ]),
    ).toEqual([null, null]);
  });
});
