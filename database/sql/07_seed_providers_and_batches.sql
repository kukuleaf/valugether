INSERT INTO exchange(market_code, exchange_code, mic, exchange_name, country_code, currency_code, timezone_name) VALUES
('KR','KOSPI','XKRX','Korea Exchange KOSPI','KR','KRW','Asia/Seoul'),
('KR','KOSDAQ','XKOS','Korea Exchange KOSDAQ','KR','KRW','Asia/Seoul'),
('US','NASDAQ','XNAS','Nasdaq','US','USD','America/New_York'),
('US','NYSE','XNYS','New York Stock Exchange','US','USD','America/New_York'),
('US','NYSE_ARCA','ARCX','NYSE Arca','US','USD','America/New_York')
ON CONFLICT (exchange_code) DO NOTHING;

INSERT INTO data_provider(provider_code, provider_name, provider_type, base_url, is_enabled, priority, notes) VALUES
('DART','OpenDART','FINANCIAL','https://opendart.fss.or.kr/api',true,10,'한국 공시/재무'),
('SEC','SEC EDGAR','FINANCIAL','https://data.sec.gov',true,10,'미국 공시/재무. API key 없음, User-Agent 필수'),
('KIS','한국투자증권 Open API','MARKET','https://openapi.koreainvestment.com:9443',true,15,'한국·미국 주식 일별 가격'),
('MARKETSTACK','Marketstack','MARKET','https://api.marketstack.com/v1',false,20,'EOD 가격 후보. 오픈 전 사용조건 재확인'),
('MOCK','Mock Provider','BOTH',NULL,false,999,'로컬 개발용')
ON CONFLICT (provider_code) DO UPDATE SET
  provider_name=EXCLUDED.provider_name,
  base_url=EXCLUDED.base_url,
  notes=EXCLUDED.notes,
  updated_at=now();

INSERT INTO data_provider_capability(provider_id, market_code, capability_code)
SELECT provider_id, market_code, capability
FROM data_provider CROSS JOIN LATERAL (
  VALUES
  (CASE provider_code WHEN 'DART' THEN 'KR' WHEN 'KIS' THEN 'KR' WHEN 'SEC' THEN 'US' WHEN 'MARKETSTACK' THEN 'US' ELSE 'US' END,
   CASE WHEN provider_code IN ('DART','SEC') THEN 'FINANCIAL_FACTS' ELSE 'EOD_PRICE' END)
) v(market_code, capability)
WHERE provider_code IN ('DART','SEC','KIS','MARKETSTACK')
ON CONFLICT DO NOTHING;

INSERT INTO data_provider_capability(provider_id, market_code, capability_code)
SELECT provider_id, 'US', 'EOD_PRICE' FROM data_provider WHERE provider_code='KIS'
ON CONFLICT DO NOTHING;

INSERT INTO data_provider_capability(provider_id, market_code, capability_code)
SELECT provider_id, 'KR', 'EOD_PRICE' FROM data_provider WHERE provider_code='MOCK'
ON CONFLICT DO NOTHING;
INSERT INTO data_provider_capability(provider_id, market_code, capability_code)
SELECT provider_id, 'US', 'EOD_PRICE' FROM data_provider WHERE provider_code='MOCK'
ON CONFLICT DO NOTHING;

INSERT INTO batch_definition(batch_code,batch_name,schedule_cron,timezone_name,is_enabled,description) VALUES
('KR_EOD_PRICE_SYNC','한국 EOD 가격 동기화','0 18 * * 1-5','Asia/Seoul',false,'실 공급자 확정 후 활성화'),
('US_EOD_PRICE_SYNC','미국 EOD 가격 동기화','30 8 * * 2-6','Asia/Seoul',false,'미국 장 마감/공급자 반영 지연 고려 후 조정'),
('DART_FINANCIAL_SYNC','DART 재무 동기화','0 3 * * *','Asia/Seoul',false,'증분 공시 수집'),
('SEC_FINANCIAL_SYNC','SEC 재무 동기화','30 17 * * *','Asia/Seoul',false,'nightly bulk 또는 증분'),
('DERIVED_METRIC_RECALC','파생지표 재계산','0 10 * * *','Asia/Seoul',false,'변경된 종목만 계산'),
('PRESET_MATCH_NOTIFY','맞춤기업 조건 충족 알림','30 10 * * *','Asia/Seoul',false,'가격 및 파생지표 갱신 뒤 알림 주기가 도래한 프리셋을 평가'),
('DATA_QUALITY_CHECK','데이터 품질 검사','0 11 * * *','Asia/Seoul',false,'가격·재무 최신성, 커버리지, 이상값, 배치 실패 검사')
ON CONFLICT (batch_code) DO UPDATE SET
  batch_name=EXCLUDED.batch_name,
  schedule_cron=EXCLUDED.schedule_cron,
  description=EXCLUDED.description,
  updated_at=now();
