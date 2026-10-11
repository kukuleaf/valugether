import { expect, test } from '@playwright/test';
const MOBILE = 'http://127.0.0.1:3102';
const API = 'http://localhost:3000/api';
const prices = [
  {
    trade_date: '2026-10-08',
    close_price: 110,
    open_price: 100,
    high_price: 112,
    low_price: 99,
    adjusted_close: 110,
    volume: 1000,
    currency_code: 'USD',
    provider_name: 'TEST',
  },
  { trade_date: '2026-10-07', close_price: 100, currency_code: 'USD', provider_name: 'TEST' },
];
const metric = (code: string, type: string, history = true) => ({
  metric_code: code,
  metric_name_ko: code === 'REVENUE' ? '매출액' : 'PER',
  statement_type: type,
  unit_type: code === 'REVENUE' ? 'CURRENCY' : 'RATIO',
  value_type: 'NUMERIC',
  numeric_value: 10,
  as_of_date: '2025-12-31',
  text_value: null,
  history: history
    ? [2025, 2024, 2023, 2022].map((year) => ({
        period_type: 'FY',
        fiscal_year: year,
        fiscal_quarter: null,
        end_date: `${year}-12-31`,
        numeric_value: 10,
      }))
    : [],
});
const stock = {
  security_id: 101,
  ticker: 'TEST',
  security_name: '검증 기업',
  legal_name: '검증 기업',
  company_name: '검증 기업',
  currency_code: 'USD',
  exchange_name: 'NASDAQ',
  market_code: 'US',
  exchange_code: 'NASDAQ',
  country_code: 'US',
  security_type: 'COMMON_STOCK',
  is_active: true,
  business_summary: '반도체를 설계하는 기업입니다.',
  latest_price: prices[0],
  price_history: prices,
  price_status: 'CURRENT',
  metrics: [metric('REVENUE', 'IS', false), metric('PER', 'VALUATION')],
  dividends: [],
  splits: [],
};

test.describe('mobile detail and narrow layouts', () => {
  test.use({ viewport: { width: 320, height: 568 } });
  test.beforeEach(async ({ page }) => {
    await page.route(`${API}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/stocks/101') return route.fulfill({ json: stock });
      if (url.pathname === '/api/stocks/101/prices') return route.fulfill({ json: { prices } });
      if (url.pathname === '/api/metrics' || url.pathname === '/api/notices')
        return route.fulfill({ json: [] });
      if (url.pathname === '/api/screening/strategies')
        return route.fulfill({
          json: [
            {
              strategy_code: 'UNDERVALUED',
              strategy_name: '저평가 기업',
              description: '가격보다 가치가 높은 기업',
            },
          ],
        });
      return route.fulfill({ status: 401, json: { message: '로그인이 필요합니다.' } });
    });
  });

  test('single-period grids fill their card and four historical periods scroll without page overflow', async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${MOBILE}/stocks/101`);
    await expect(page.getByText('어떤 기업인가요?')).toBeVisible();
    await page.getByText('재무제표', { exact: true }).first().click();
    const card = page.getByTestId('metric-table');
    const grid = page.getByTestId('metric-grid');
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    const gridBox = await grid.boundingBox();
    expect(Math.abs(cardBox!.width - gridBox!.width)).toBeLessThan(3);
    const valueBox = await grid.getByText('10', { exact: true }).last().boundingBox();
    expect(valueBox!.x + valueBox!.width).toBeGreaterThan(cardBox!.x + cardBox!.width - 16);
    await page.screenshot({ path: info.outputPath('financial-320.png'), fullPage: true });
    await page.getByText('투자지표', { exact: true }).first().click();
    await expect(page.getByText('22.12.31', { exact: true })).toBeAttached();
    const overflow = await grid.evaluate((element) =>
      Array.from(element.querySelectorAll('div')).some(
        (child) => child.scrollWidth > child.clientWidth + 20,
      ),
    );
    expect(overflow).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('indicators-320.png'), fullPage: true });
    expect(errors).toEqual([]);
  });

  test('quick chart period changes discard an older response', async ({ page }, info) => {
    let completeOld: (() => void) | undefined;
    let oldStarted = false;
    await page.route(`${API}/stocks/101/prices?*`, async (route) => {
      if (new URL(route.request().url()).searchParams.get('range') === '6M') {
        oldStarted = true;
        await new Promise<void>((resolve) => {
          completeOld = resolve;
        });
        return route.fulfill({
          json: { prices: [...prices, { ...prices[1], trade_date: '2026-10-06' }] },
        });
      }
      return route.fulfill({ json: { prices } });
    });
    await page.goto(`${MOBILE}/stocks/101`);
    await page.getByRole('button', { name: '주가 차트 보기' }).click();
    await expect.poll(() => oldStarted).toBe(true);
    await page.getByText('1M', { exact: true }).click();
    await expect(page.getByText(/2일 저장/)).toBeVisible();
    completeOld!();
    await expect(page.getByText(/3일 저장/)).not.toBeVisible();
    await expect(page.getByRole('button', { name: '차트 닫기' })).toBeInViewport();
    await page.screenshot({ path: info.outputPath('chart-320.png') });
    await page.getByRole('button', { name: '차트 닫기' }).click();
    await expect(page.getByText('주가 흐름')).not.toBeVisible();
  });

  test('narrow home retains one-line headline and web does not load a native ad SDK', async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(MOBILE);
    const headline = page.getByText('숨겨진 가치, 현명한 투자');
    await expect(headline).toBeVisible();
    expect((await headline.boundingBox())!.height).toBeLessThan(40);
    await expect(page.getByTestId('ad-home')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: info.outputPath('home-320.png'), fullPage: true });
    expect(errors).toEqual([]);
  });

  test('published privacy policy is public and a failed load can be retried', async ({ page }) => {
    let attempts = 0;
    await page.route(`${API}/terms/active`, async (route) => {
      attempts += 1;
      if (attempts === 1) return route.fulfill({ status: 503, json: { message: '일시적인 오류' } });
      return route.fulfill({
        json: [
          {
            term_code: 'PRIVACY',
            title: '검증용 개인정보 정책',
            version: '2.0',
            effective_from: '2026-10-11',
            content: '검증용 정책 본문입니다.',
          },
        ],
      });
    });
    await page.goto(`${MOBILE}/privacy`);
    await expect(page.getByText('개인정보 처리방침을 불러오지 못했습니다.')).toBeVisible();
    await page.getByRole('button', { name: '다시 불러오기' }).click();
    await expect(page.getByText('검증용 개인정보 정책', { exact: true })).toBeVisible();
    await expect(page.getByText('검증용 정책 본문입니다.')).toBeVisible();
    await expect(page.getByText('Google 광고 안내', { exact: true })).toHaveCount(0);
    expect(attempts).toBe(2);
  });
});
