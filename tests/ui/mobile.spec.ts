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
    await expect(page.getByText('가치보는주식', { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: '가치보는주식 로고' })).toBeVisible();
    const headline = page.getByText('숨겨진 가치, 현명한 투자', { exact: true });
    await expect(headline).toBeVisible();
    expect(
      await headline.evaluate((element) => element.getBoundingClientRect().height),
    ).toBeLessThan(40);
    await expect(page.getByText('1만 원짜리 기업을 5천 원에 사는 방법')).toBeVisible();
    const chipTops = await page
      .getByTestId('exchange-scroll')
      .locator('[role="checkbox"]')
      .evaluateAll((chips) => chips.map((chip) => Math.round(chip.getBoundingClientRect().top)));
    expect(chipTops).toHaveLength(4);
    expect(new Set(chipTops).size).toBe(1);
    await page.setViewportSize({ width: 320, height: 844 });
    await expect
      .poll(() => headline.evaluate((element) => element.getBoundingClientRect().height))
      .toBeLessThan(40);
    await expect
      .poll(() =>
        page
          .getByTestId('exchange-scroll')
          .evaluate((element) => element.scrollWidth > element.clientWidth),
      )
      .toBe(true);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('저평가 기업')).toBeVisible();

    await page.getByRole('button', { name: '저평가 기업 찾아보기' }).click();
    await expect(page.getByText('검색 결과', { exact: true })).toBeVisible();
    await expect(page.getByText('정확 일치')).toBeVisible();
    await page.getByRole('button', { name: '이전 화면으로' }).click();
    await expect(page.getByText('가치보는주식', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: /조건검색/ }).click();
    await expect(page.getByText('조건 검색', { exact: true })).toBeVisible();
    await expect(page.getByText('쉬운 검색')).toBeVisible();

    const listed = await (
      await page.request.get('http://127.0.0.1:3201/api/stocks?limit=200')
    ).json();
    const pricedStock = listed.find(
      (item: { security_id: number; close_price: string | null }) => item.close_price != null,
    );
    expect(pricedStock).toBeTruthy();
    await page.goto(`${MOBILE}/stocks/${pricedStock.security_id}`);
    await expect(page.getByText('어떤 기업인가요?')).toBeVisible();
    await page.getByRole('button', { name: '주가 차트 보기' }).click();
    await expect(page.getByText('주가 흐름')).toBeVisible();
    await expect(page.getByText(/일 저장/)).toBeVisible();
    await page.getByRole('button', { name: '차트 닫기' }).click();
    await expect(page.getByText('주가 흐름')).not.toBeVisible();
    await page.getByRole('button', { name: '주가 차트 보기' }).click();
    await page.getByTestId('price-chart-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.getByText('주가 흐름')).not.toBeVisible();

    await page.goto(`${MOBILE}/auth/login`);
    await page.getByPlaceholder('이메일').fill(USER_EMAIL);
    await page.getByPlaceholder('비밀번호').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: '로그인', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText(USER_EMAIL)).toBeVisible();
    await expect(page.getByText('이메일 인증 완료')).toBeVisible();
    await expect(page.getByRole('button', { name: '알림 설정' })).toBeVisible();

    await page.getByRole('button', { name: '로그아웃' }).click();
    await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();
    await expect(page.getByText('간편 로그인')).toBeVisible();
    await page.getByRole('tab', { name: /관심기업/ }).click();
    await expect(page.getByText('로그인이 필요합니다')).toBeVisible();
    const stored = await page.evaluate(() => ({
      access: localStorage.getItem('auth.access'),
      refresh: localStorage.getItem('auth.refresh'),
    }));
    expect(stored).toEqual({ access: null, refresh: null });
  });
});
