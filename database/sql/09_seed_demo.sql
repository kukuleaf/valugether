-- Fictitious securities for local screening tests. Not real investment data.

WITH ex AS (SELECT exchange_id FROM exchange WHERE exchange_code='NASDAQ')
INSERT INTO company(legal_name,display_name,country_code,sec_cik) VALUES
('Demo Alpha Inc.','Demo Alpha','US','DEMO000001'),
('Demo Beta Inc.','Demo Beta','US','DEMO000002')
ON CONFLICT (sec_cik) DO NOTHING;

WITH ex AS (SELECT exchange_id FROM exchange WHERE exchange_code='NASDAQ')
INSERT INTO security(company_id,exchange_id,ticker,security_name,currency_code)
SELECT c.company_id, ex.exchange_id, x.ticker, c.display_name, 'USD'
FROM (VALUES ('DEMO000001','DEMOA'),('DEMO000002','DEMOB')) x(cik,ticker)
JOIN company c ON c.sec_cik=x.cik CROSS JOIN ex
ON CONFLICT (exchange_id,ticker) DO NOTHING;

WITH vals(ticker, metric_code, val) AS (
VALUES
('DEMOA','PER',14.0),('DEMOA','ROE',12.0),('DEMOA','PBR',1.20),('DEMOA','EPS_GROWTH_YOY',8.0),
('DEMOB','PER',15.8),('DEMOB','ROE',9.4),('DEMOB','PBR',1.45),('DEMOB','EPS_GROWTH_YOY',6.0)
)
INSERT INTO latest_metric_value(security_id,metric_id,numeric_value,as_of_date,source_type,calculation_version)
SELECT s.security_id,m.metric_id,v.val,current_date,'DEMO','demo-v1'
FROM vals v
JOIN exchange e ON e.exchange_code='NASDAQ'
JOIN security s ON s.exchange_id=e.exchange_id AND s.ticker=v.ticker
JOIN financial_metric m ON m.metric_code=v.metric_code
ON CONFLICT (security_id,metric_id) DO UPDATE SET
numeric_value=EXCLUDED.numeric_value, as_of_date=EXCLUDED.as_of_date, updated_at=now();
