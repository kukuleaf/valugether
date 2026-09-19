CREATE INDEX IF NOT EXISTS ix_security_active_market ON security(exchange_id, is_active, ticker);
CREATE INDEX IF NOT EXISTS ix_company_name_trgm ON company USING gin(display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_financial_fact_metric ON financial_fact(metric_id, financial_period_id);
CREATE INDEX IF NOT EXISTS ix_financial_period_company_date ON financial_period(company_id, end_date DESC);
CREATE INDEX IF NOT EXISTS ix_daily_price_date ON daily_price(trade_date DESC, security_id);
CREATE INDEX IF NOT EXISTS ix_latest_metric_numeric ON latest_metric_value(metric_id, numeric_value, security_id);
CREATE INDEX IF NOT EXISTS ix_latest_metric_security ON latest_metric_value(security_id, metric_id);
CREATE INDEX IF NOT EXISTS ix_derived_security_date ON derived_metric_value(security_id, as_of_date DESC, metric_id);
CREATE INDEX IF NOT EXISTS ix_screen_search_user_date ON screen_search_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_api_log_provider_date ON external_api_call_log(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_actor_date ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_batch_job_code_date ON batch_job_run(batch_code, started_at DESC);
CREATE INDEX IF NOT EXISTS ix_screen_preset_due_notification ON screen_preset(next_notification_at) WHERE notification_enabled=true;
CREATE INDEX IF NOT EXISTS ix_user_notification_user_created ON user_notification(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_notification_setting_due
  ON user_notification_setting(next_notification_at)
  WHERE custom_company_enabled=true;

CREATE OR REPLACE VIEW v_security_master AS
SELECT s.security_id, e.market_code, e.exchange_code, e.mic,
       s.ticker, s.security_name, s.currency_code, s.is_active,
       c.company_id, c.display_name AS company_name, c.dart_corp_code, c.sec_cik
FROM security s
JOIN company c ON c.company_id=s.company_id
JOIN exchange e ON e.exchange_id=s.exchange_id;

CREATE OR REPLACE VIEW v_latest_price AS
SELECT DISTINCT ON (dp.security_id)
       dp.security_id, dp.trade_date, dp.close_price, dp.adjusted_close, dp.volume,
       dp.currency_code, dp.provider_id
FROM daily_price dp
ORDER BY dp.security_id, dp.trade_date DESC, dp.provider_id;

CREATE OR REPLACE VIEW v_screen_metric_catalog AS
SELECT m.metric_id, m.metric_code, m.metric_name_ko, m.metric_name_en,
       m.statement_type, m.unit_type, m.direction_code, m.default_operator,
       m.basic_search, m.display_order,
       t.setting_detail_code, t.tolerance_type, t.tolerance_value
FROM financial_metric m
LEFT JOIN LATERAL (
  SELECT x.* FROM screen_metric_tolerance x
  WHERE x.metric_id=m.metric_id
    AND x.is_active=true
    AND x.effective_from <= current_date
    AND (x.effective_to IS NULL OR x.effective_to >= current_date)
  ORDER BY x.effective_from DESC
  LIMIT 1
) t ON true
WHERE m.is_active=true;

CREATE INDEX IF NOT EXISTS ix_raw_financial_unmapped ON provider_financial_fact_raw(provider_id, mapping_status, external_metric_code);

-- Common updated_at trigger for operational consistency.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'common_code_group','common_code','system_setting','app_user','user_password',
    'user_social_account','company','security','data_provider','financial_metric',
    'financial_fact','daily_price','derived_metric_value','latest_metric_value',
    'screen_metric_tolerance','screen_strategy','screen_preset','user_notification_setting','watchlist',
    'batch_definition','notice'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_'||t||'_updated_at', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', 'trg_'||t||'_updated_at', t);
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_system_setting_updated_by'
  ) THEN
    ALTER TABLE system_setting
      ADD CONSTRAINT fk_system_setting_updated_by FOREIGN KEY(updated_by) REFERENCES app_user(user_id) ON DELETE SET NULL;
  END IF;
END $$;
