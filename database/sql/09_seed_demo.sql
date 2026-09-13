-- Fictitious securities for local screening and detail-screen tests.

-- Local-development account only: demo@rightstock.local / DemoPassword1!
INSERT INTO app_user(user_id,email,status_code,email_verified_at)
VALUES ('00000000-0000-4000-8000-000000000001','demo@rightstock.local','ACTIVE',now())
ON CONFLICT (email) DO UPDATE SET status_code='ACTIVE',deleted_at=NULL,updated_at=now();

INSERT INTO user_password(user_id,password_hash)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  '$argon2id$v=19$m=65536,t=3,p=4$qPRH4WDl898jjXyhU/ScNg$zjj2cU24zg1eXhz08JQfMxDa76eeHYl1il80BqyIAQ0'
)
ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=now();

INSERT INTO user_role(user_id,role_code)
VALUES ('00000000-0000-4000-8000-000000000001','USER')
ON CONFLICT DO NOTHING;

INSERT INTO watchlist(user_id,watchlist_name,is_default)
VALUES ('00000000-0000-4000-8000-000000000001','관심종목',true)
ON CONFLICT (user_id,watchlist_name) DO NOTHING;

INSERT INTO company(
  legal_name, display_name, country_code, sec_cik, industry_code,
  sector_code, website_url
) VALUES
('Demo Alpha Inc.','Demo Alpha','US','DEMO000001','TECH-SOFTWARE','TECHNOLOGY','https://example.com/demo-alpha'),
('Demo Beta Inc.','Demo Beta','US','DEMO000002','INDUSTRIAL','INDUSTRIALS','https://example.com/demo-beta')
ON CONFLICT (sec_cik) DO UPDATE SET
  industry_code=EXCLUDED.industry_code,
  sector_code=EXCLUDED.sector_code,
  website_url=EXCLUDED.website_url,
  updated_at=now();

WITH ex AS (SELECT exchange_id FROM exchange WHERE exchange_code='NASDAQ')
INSERT INTO security(
  company_id, exchange_id, ticker, security_name, currency_code, isin, listing_date
)
SELECT
  c.company_id, ex.exchange_id, x.ticker, c.display_name, 'USD', x.isin, x.listing_date
FROM (VALUES
  ('DEMO000001','DEMOA','US0000000001','2014-06-12'::date),
  ('DEMO000002','DEMOB','US0000000002','2017-09-18'::date)
) x(cik,ticker,isin,listing_date)
JOIN company c ON c.sec_cik=x.cik
CROSS JOIN ex
ON CONFLICT (exchange_id,ticker) DO UPDATE SET
  isin=EXCLUDED.isin,
  listing_date=EXCLUDED.listing_date,
  updated_at=now();

-- Broad mock metric set. Values are deliberately fictitious.
WITH base(metric_code, val) AS (
VALUES
('REVENUE',438380.0),
('COST_OF_REVENUE',290020.0),
('GROSS_PROFIT',148360.0),
('OPERATING_INCOME',116685.0),
('EBITDA',125822.0),
('NET_INCOME',98310.0),
('INTEREST_EXPENSE',5195.0),
('EPS_BASIC',39.77),
('CASH_EQUIVALENTS',40609.0),
('ACCOUNTS_RECEIVABLE',53197.0),
('INVENTORY',26575.0),
('CURRENT_ASSETS',244136.0),
('TOTAL_ASSETS',1263071.0),
('CURRENT_LIABILITIES',117122.0),
('SHORT_TERM_DEBT',61846.0),
('LONG_TERM_DEBT',128599.0),
('TOTAL_DEBT',190445.0),
('TOTAL_LIABILITIES',512894.0),
('TOTAL_EQUITY',747910.0),
('RETAINED_EARNINGS',798959.0),
('BPS',346.76),
('CFO',46634.0),
('CAPEX',-22419.0),
('CFI',-106088.0),
('CFF',-763.0),
('DIVIDENDS_PAID',0.0),
('FREE_CASH_FLOW',24215.0),
('MARKET_CAP',1098000.0),
('PER',14.0),
('PBR',1.20),
('PSR',2.46),
('PCR',23.14),
('EV_EBITDA',8.72),
('ROE',12.0),
('ROA',6.90),
('GROSS_MARGIN',33.84),
('OPERATING_MARGIN',26.62),
('NET_MARGIN',22.42),
('DEBT_RATIO',68.60),
('CURRENT_RATIO',2.08),
('REVENUE_GROWTH_YOY',4.56),
('OPERATING_INCOME_GROWTH_YOY',12.33),
('NET_INCOME_GROWTH_YOY',9.84),
('EPS_GROWTH_YOY',8.0),
('PROFITABLE_TTM',1.0),
('PROFITABLE_CONSECUTIVE_YEARS',10.0),
('EPS_POSITIVE_GROWTH_YEARS',4.0),
('DPS',0.0),
('DIVIDEND_YIELD',0.0),
('PAYOUT_RATIO',0.0),
('DIVIDEND_CONSECUTIVE_YEARS',0.0)
), tickers(ticker, factor) AS (
VALUES ('DEMOA',1.0),('DEMOB',0.82)
), vals AS (
SELECT
  t.ticker,
  b.metric_code,
  CASE
    WHEN b.metric_code IN ('PROFITABLE_TTM') THEN b.val
    WHEN b.metric_code LIKE '%YEARS' THEN round(b.val*t.factor)
    ELSE round(b.val*t.factor, 4)
  END AS val
FROM base b CROSS JOIN tickers t
)
INSERT INTO latest_metric_value(
  security_id, metric_id, numeric_value, as_of_date, source_type, calculation_version
)
SELECT s.security_id,m.metric_id,v.val,'2026-06-30'::date,'DEMO','demo-v2'
FROM vals v
JOIN exchange e ON e.exchange_code='NASDAQ'
JOIN security s ON s.exchange_id=e.exchange_id AND s.ticker=v.ticker
JOIN financial_metric m ON m.metric_code=v.metric_code
ON CONFLICT (security_id,metric_id) DO UPDATE SET
  numeric_value=EXCLUDED.numeric_value,
  as_of_date=EXCLUDED.as_of_date,
  source_type=EXCLUDED.source_type,
  calculation_version=EXCLUDED.calculation_version,
  updated_at=now();

-- Four quarterly points for the comparison tables.
WITH base(metric_code, val) AS (
VALUES
('REVENUE',438380.0),('COST_OF_REVENUE',290020.0),('GROSS_PROFIT',148360.0),
('OPERATING_INCOME',116685.0),('EBITDA',125822.0),('NET_INCOME',98310.0),
('INTEREST_EXPENSE',5195.0),('EPS_BASIC',39.77),('CASH_EQUIVALENTS',40609.0),
('ACCOUNTS_RECEIVABLE',53197.0),('INVENTORY',26575.0),('CURRENT_ASSETS',244136.0),
('TOTAL_ASSETS',1263071.0),('CURRENT_LIABILITIES',117122.0),('SHORT_TERM_DEBT',61846.0),
('LONG_TERM_DEBT',128599.0),('TOTAL_DEBT',190445.0),('TOTAL_LIABILITIES',512894.0),
('TOTAL_EQUITY',747910.0),('RETAINED_EARNINGS',798959.0),('BPS',346.76),
('CFO',46634.0),('CAPEX',-22419.0),('CFI',-106088.0),('CFF',-763.0),
('DIVIDENDS_PAID',0.0),('FREE_CASH_FLOW',24215.0),('MARKET_CAP',1098000.0),
('PER',14.0),('PBR',1.20),('PSR',2.46),('PCR',23.14),('EV_EBITDA',8.72),
('ROE',12.0),('ROA',6.90),('GROSS_MARGIN',33.84),('OPERATING_MARGIN',26.62),
('NET_MARGIN',22.42),('DEBT_RATIO',68.60),('CURRENT_RATIO',2.08),
('REVENUE_GROWTH_YOY',4.56),('OPERATING_INCOME_GROWTH_YOY',12.33),
('NET_INCOME_GROWTH_YOY',9.84),('EPS_GROWTH_YOY',8.0),('DPS',0.0),
('DIVIDEND_YIELD',0.0),('PAYOUT_RATIO',0.0)
), tickers(ticker, company_factor) AS (
VALUES ('DEMOA',1.0),('DEMOB',0.82)
), periods(period_type, as_of_date, period_factor) AS (
VALUES
('Q3','2025-09-30'::date,0.84),
('Q4','2025-12-31'::date,0.89),
('Q1','2026-03-31'::date,0.95),
('Q2','2026-06-30'::date,1.00)
), vals AS (
SELECT
  t.ticker, b.metric_code, p.period_type, p.as_of_date,
  round(b.val*t.company_factor*p.period_factor, 4) AS val
FROM base b CROSS JOIN tickers t CROSS JOIN periods p
)
INSERT INTO derived_metric_value(
  security_id, metric_id, as_of_date, period_type, numeric_value,
  calculation_version, source_json
)
SELECT
  s.security_id, m.metric_id, v.as_of_date, v.period_type, v.val,
  'demo-v2', jsonb_build_object('source', 'fictitious-quarterly-demo')
FROM vals v
JOIN exchange e ON e.exchange_code='NASDAQ'
JOIN security s ON s.exchange_id=e.exchange_id AND s.ticker=v.ticker
JOIN financial_metric m ON m.metric_code=v.metric_code
ON CONFLICT (security_id,metric_id,as_of_date,period_type,calculation_version)
DO UPDATE SET
  numeric_value=EXCLUDED.numeric_value,
  source_json=EXCLUDED.source_json,
  updated_at=now();

WITH provider AS (
  SELECT provider_id FROM data_provider WHERE provider_code='MOCK'
), prices(ticker,trade_date,open_price,high_price,low_price,close_price,volume) AS (
VALUES
('DEMOA','2026-09-01'::date,495.10,501.20,493.60,499.80,1145200),
('DEMOA','2026-09-02'::date,500.00,504.80,498.30,503.20,1084300),
('DEMOA','2026-09-03'::date,503.40,508.10,501.70,506.90,1268100),
('DEMOA','2026-09-04'::date,506.50,509.30,502.40,504.10,1190200),
('DEMOA','2026-09-08'::date,504.30,508.70,503.10,506.03,1325400),
('DEMOB','2026-09-01'::date,78.20,79.40,77.80,79.10,845200),
('DEMOB','2026-09-02'::date,79.00,80.10,78.50,79.70,792100),
('DEMOB','2026-09-03'::date,79.80,81.20,79.40,80.90,913500),
('DEMOB','2026-09-04'::date,80.70,81.00,79.60,80.10,868400),
('DEMOB','2026-09-08'::date,80.30,82.00,80.00,81.60,954800)
)
INSERT INTO daily_price(
  security_id, trade_date, provider_id, open_price, high_price, low_price,
  close_price, adjusted_close, volume, currency_code
)
SELECT
  s.security_id, p.trade_date, provider.provider_id, p.open_price, p.high_price,
  p.low_price, p.close_price, p.close_price, p.volume, 'USD'
FROM prices p
JOIN exchange e ON e.exchange_code='NASDAQ'
JOIN security s ON s.exchange_id=e.exchange_id AND s.ticker=p.ticker
CROSS JOIN provider
ON CONFLICT (security_id,trade_date,provider_id) DO UPDATE SET
  open_price=EXCLUDED.open_price,
  high_price=EXCLUDED.high_price,
  low_price=EXCLUDED.low_price,
  close_price=EXCLUDED.close_price,
  adjusted_close=EXCLUDED.adjusted_close,
  volume=EXCLUDED.volume,
  updated_at=now();

WITH preset AS (
  INSERT INTO screen_preset(user_id,preset_name,description,search_mode,market_filter_json)
  VALUES (
    '00000000-0000-4000-8000-000000000001',
    '합리적 성장주',
    '수익성과 성장성을 함께 보는 샘플 프리셋',
    'ADVANCED_BASIC',
    '["US","KR"]'::jsonb
  )
  ON CONFLICT (user_id,preset_name) DO UPDATE SET
    description=EXCLUDED.description,
    search_mode=EXCLUDED.search_mode,
    market_filter_json=EXCLUDED.market_filter_json,
    updated_at=now()
  RETURNING preset_id
), cleared AS (
  DELETE FROM screen_preset_condition
  WHERE preset_id=(SELECT preset_id FROM preset)
)
INSERT INTO screen_preset_condition(
  preset_id,metric_id,operator_code,target_value,weight,display_order
)
SELECT preset.preset_id,m.metric_id,c.operator_code,c.target_value,1,c.display_order
FROM preset
CROSS JOIN (VALUES
  ('PER','LTE',15::numeric,1),
  ('ROE','GTE',10::numeric,2),
  ('EPS_GROWTH_YOY','GTE',5::numeric,3)
) c(metric_code,operator_code,target_value,display_order)
JOIN financial_metric m ON m.metric_code=c.metric_code;
