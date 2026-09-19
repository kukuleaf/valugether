BEGIN;

ALTER TABLE screen_preset
  ADD COLUMN IF NOT EXISTS exchange_filter_json jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS user_notification_setting (
  user_id           uuid PRIMARY KEY REFERENCES app_user(user_id) ON DELETE CASCADE,
  custom_company_enabled boolean NOT NULL DEFAULT false,
  notification_interval_days smallint NOT NULL DEFAULT 1
    CHECK (notification_interval_days BETWEEN 1 AND 30),
  next_notification_at timestamptz,
  last_notification_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO user_notification_setting(
  user_id,custom_company_enabled,notification_interval_days,next_notification_at,last_notification_at
)
SELECT user_id,bool_or(notification_enabled),min(notification_interval_days),
       min(next_notification_at),max(last_notification_at)
FROM screen_preset
GROUP BY user_id
ON CONFLICT(user_id) DO NOTHING;

UPDATE screen_preset
SET notification_enabled=false,next_notification_at=null
WHERE notification_enabled=true OR next_notification_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_user_notification_setting_due
  ON user_notification_setting(next_notification_at)
  WHERE custom_company_enabled=true;

UPDATE exchange SET mic=NULL,is_active=false WHERE exchange_code='KRX';

INSERT INTO exchange(
  market_code,exchange_code,mic,exchange_name,country_code,currency_code,timezone_name,is_active
) VALUES
('KR','KOSPI','XKRX','Korea Exchange KOSPI','KR','KRW','Asia/Seoul',true),
('KR','KOSDAQ','XKOS','Korea Exchange KOSDAQ','KR','KRW','Asia/Seoul',true)
ON CONFLICT(exchange_code) DO UPDATE SET
  mic=excluded.mic,exchange_name=excluded.exchange_name,is_active=true;

UPDATE data_provider SET is_enabled=(provider_code IN ('DART','SEC','KIS')),
  updated_at=now()
WHERE provider_code IN ('DART','SEC','KIS','MOCK');

INSERT INTO data_provider_capability(provider_id,market_code,capability_code)
SELECT provider_id,'US','EOD_PRICE' FROM data_provider WHERE provider_code='KIS'
ON CONFLICT DO NOTHING;

UPDATE security s SET is_active=false,updated_at=now()
FROM company c WHERE c.company_id=s.company_id AND c.sec_cik LIKE 'DEMO%';
UPDATE company SET is_active=false,updated_at=now() WHERE sec_cik LIKE 'DEMO%';

DROP INDEX IF EXISTS ix_screen_preset_due_notification;

COMMIT;
