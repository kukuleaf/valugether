BEGIN;

-- =========================
-- Common / configuration
-- =========================
CREATE TABLE IF NOT EXISTS common_code_group (
  group_code        varchar(30) PRIMARY KEY,
  group_name        varchar(100) NOT NULL,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS common_code (
  group_code        varchar(30) NOT NULL REFERENCES common_code_group(group_code),
  code              varchar(50) NOT NULL,
  code_name         varchar(120) NOT NULL,
  description       text,
  extra_json        jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_code, code)
);

CREATE TABLE IF NOT EXISTS system_setting (
  setting_key       varchar(120) PRIMARY KEY,
  setting_value     text NOT NULL,
  value_type        varchar(20) NOT NULL DEFAULT 'STRING',
  description       text,
  is_secret         boolean NOT NULL DEFAULT false,
  updated_by        uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- Users / auth
-- =========================
CREATE TABLE IF NOT EXISTS app_user (
  user_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext UNIQUE,
  status_code       varchar(30) NOT NULL DEFAULT 'ACTIVE',
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE TABLE IF NOT EXISTS user_password (
  user_id             uuid PRIMARY KEY REFERENCES app_user(user_id) ON DELETE CASCADE,
  password_hash       text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts     integer NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_social_account (
  social_account_id bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  provider_code     varchar(30) NOT NULL,
  provider_subject  varchar(255) NOT NULL,
  provider_email    citext,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_code, provider_subject),
  UNIQUE (user_id, provider_code)
);

CREATE TABLE IF NOT EXISTS user_refresh_token (
  refresh_token_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  token_hash        text NOT NULL,
  device_id         varchar(200),
  user_agent        varchar(500),
  expires_at        timestamptz NOT NULL,
  revoked_at        timestamptz,
  replaced_by_id    uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_role (
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  role_code         varchar(30) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_code)
);

CREATE TABLE IF NOT EXISTS user_consent (
  consent_id        bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  consent_type      varchar(50) NOT NULL,
  version           varchar(30) NOT NULL,
  agreed            boolean NOT NULL,
  agreed_at         timestamptz NOT NULL DEFAULT now(),
  withdrawn_at      timestamptz
);

CREATE TABLE IF NOT EXISTS entitlement (
  entitlement_code varchar(50) PRIMARY KEY,
  entitlement_name varchar(100) NOT NULL,
  description      text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_entitlement (
  user_id          uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  entitlement_code varchar(50) NOT NULL REFERENCES entitlement(entitlement_code),
  starts_at        timestamptz NOT NULL DEFAULT now(),
  ends_at          timestamptz,
  source_code      varchar(50) NOT NULL DEFAULT 'ADMIN',
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entitlement_code, starts_at)
);

CREATE TABLE IF NOT EXISTS verification_token (
  token_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES app_user(user_id) ON DELETE CASCADE,
  purpose_code      varchar(40) NOT NULL,
  token_hash        text NOT NULL UNIQUE,
  expires_at        timestamptz NOT NULL,
  used_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- Company / security master
-- =========================
CREATE TABLE IF NOT EXISTS exchange (
  exchange_id       bigserial PRIMARY KEY,
  market_code       varchar(20) NOT NULL,
  exchange_code     varchar(30) NOT NULL,
  mic               varchar(10),
  exchange_name     varchar(150) NOT NULL,
  country_code      char(2) NOT NULL,
  currency_code     char(3) NOT NULL,
  timezone_name     varchar(80) NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exchange_code),
  UNIQUE (mic)
);

CREATE TABLE IF NOT EXISTS company (
  company_id        bigserial PRIMARY KEY,
  legal_name        varchar(300) NOT NULL,
  display_name      varchar(300) NOT NULL,
  country_code      char(2) NOT NULL,
  dart_corp_code    varchar(20),
  sec_cik           varchar(20),
  industry_code     varchar(80),
  sector_code       varchar(80),
  is_financial      boolean NOT NULL DEFAULT false,
  website_url       text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dart_corp_code),
  UNIQUE (sec_cik)
);

CREATE TABLE IF NOT EXISTS security (
  security_id       bigserial PRIMARY KEY,
  company_id        bigint NOT NULL REFERENCES company(company_id),
  exchange_id       bigint NOT NULL REFERENCES exchange(exchange_id),
  ticker            varchar(40) NOT NULL,
  security_name     varchar(300) NOT NULL,
  security_type     varchar(30) NOT NULL DEFAULT 'COMMON_STOCK',
  currency_code     char(3) NOT NULL,
  isin              varchar(20),
  listing_date      date,
  delisting_date    date,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exchange_id, ticker)
);

-- =========================
-- Providers / mappings
-- =========================
CREATE TABLE IF NOT EXISTS data_provider (
  provider_id       bigserial PRIMARY KEY,
  provider_code     varchar(50) NOT NULL UNIQUE,
  provider_name     varchar(120) NOT NULL,
  provider_type     varchar(30) NOT NULL,
  base_url          text,
  is_enabled        boolean NOT NULL DEFAULT false,
  priority          integer NOT NULL DEFAULT 100,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_provider_capability (
  provider_id       bigint NOT NULL REFERENCES data_provider(provider_id) ON DELETE CASCADE,
  market_code       varchar(20) NOT NULL,
  capability_code  varchar(50) NOT NULL,
  is_enabled        boolean NOT NULL DEFAULT true,
  extra_json        jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (provider_id, market_code, capability_code)
);

CREATE TABLE IF NOT EXISTS provider_security_map (
  provider_id       bigint NOT NULL REFERENCES data_provider(provider_id) ON DELETE CASCADE,
  security_id       bigint NOT NULL REFERENCES security(security_id) ON DELETE CASCADE,
  external_symbol   varchar(120) NOT NULL,
  external_exchange varchar(80),
  external_company_id varchar(120),
  is_active         boolean NOT NULL DEFAULT true,
  last_verified_at  timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider_id, security_id),
  UNIQUE (provider_id, external_symbol, external_exchange)
);

-- =========================
-- Metrics / financial facts
-- =========================
CREATE TABLE IF NOT EXISTS financial_metric (
  metric_id         bigserial PRIMARY KEY,
  metric_code       varchar(80) NOT NULL UNIQUE,
  metric_name_ko    varchar(160) NOT NULL,
  metric_name_en    varchar(160),
  statement_type    varchar(30) NOT NULL,
  value_type        varchar(20) NOT NULL DEFAULT 'NUMBER',
  unit_type         varchar(30) NOT NULL,
  direction_code    varchar(30),
  default_operator  varchar(20),
  user_selectable   boolean NOT NULL DEFAULT true,
  basic_search      boolean NOT NULL DEFAULT false,
  display_order     integer NOT NULL DEFAULT 0,
  formula_text      text,
  description       text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_metric_mapping (
  provider_id       bigint NOT NULL REFERENCES data_provider(provider_id) ON DELETE CASCADE,
  external_metric_code varchar(300) NOT NULL,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  priority          integer NOT NULL DEFAULT 100,
  unit_hint         varchar(50),
  valid_from        date,
  valid_to          date,
  notes             text,
  PRIMARY KEY (provider_id, external_metric_code, metric_id)
);

-- Keeps unmapped/diagnostic financial facts so provider taxonomies can evolve
-- without silently throwing data away. Do not expose raw provider tags directly
-- to users until they are mapped to a canonical financial_metric.
CREATE TABLE IF NOT EXISTS provider_financial_fact_raw (
  raw_fact_id       bigserial PRIMARY KEY,
  provider_id       bigint NOT NULL REFERENCES data_provider(provider_id) ON DELETE CASCADE,
  company_id        bigint REFERENCES company(company_id) ON DELETE CASCADE,
  external_company_id varchar(120) NOT NULL,
  source_report_id  varchar(200) NOT NULL,
  external_metric_code varchar(300) NOT NULL,
  external_label    varchar(500),
  statement_type    varchar(30),
  start_date        date,
  end_date          date NOT NULL,
  filing_date       date,
  numeric_value     numeric(38,10),
  text_value        text,
  unit_code         varchar(50),
  currency_code     char(3),
  source_context_id varchar(300) NOT NULL DEFAULT '',
  mapping_status    varchar(30) NOT NULL DEFAULT 'UNMAPPED',
  raw_json          jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider_id, source_report_id, external_metric_code, source_context_id)
);

CREATE TABLE IF NOT EXISTS financial_period (
  financial_period_id bigserial PRIMARY KEY,
  company_id        bigint NOT NULL REFERENCES company(company_id),
  period_type       varchar(20) NOT NULL,
  fiscal_year       integer,
  fiscal_quarter    integer,
  start_date        date,
  end_date          date NOT NULL,
  filing_date       date,
  report_type       varchar(60),
  consolidation_code varchar(20),
  source_provider_id bigint REFERENCES data_provider(provider_id),
  source_report_id  varchar(200) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, source_provider_id, source_report_id, end_date)
);

CREATE TABLE IF NOT EXISTS financial_fact (
  financial_fact_id bigserial PRIMARY KEY,
  financial_period_id bigint NOT NULL REFERENCES financial_period(financial_period_id) ON DELETE CASCADE,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  numeric_value     numeric(38,10),
  text_value        text,
  currency_code     char(3),
  unit_code         varchar(30),
  source_external_metric varchar(300),
  source_context_id varchar(300),
  is_restated       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financial_period_id, metric_id, source_context_id)
);

-- =========================
-- Market price/events
-- =========================
CREATE TABLE IF NOT EXISTS daily_price (
  security_id       bigint NOT NULL REFERENCES security(security_id) ON DELETE CASCADE,
  trade_date        date NOT NULL,
  provider_id       bigint NOT NULL REFERENCES data_provider(provider_id),
  open_price        numeric(30,10),
  high_price        numeric(30,10),
  low_price         numeric(30,10),
  close_price       numeric(30,10) NOT NULL,
  adjusted_close    numeric(30,10),
  volume            numeric(38,0),
  currency_code     char(3),
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (security_id, trade_date, provider_id)
);

CREATE TABLE IF NOT EXISTS dividend_event (
  dividend_event_id bigserial PRIMARY KEY,
  security_id       bigint NOT NULL REFERENCES security(security_id),
  provider_id       bigint REFERENCES data_provider(provider_id),
  ex_date           date NOT NULL,
  payment_date      date,
  amount_per_share  numeric(30,10),
  currency_code     char(3),
  event_status      varchar(30) DEFAULT 'CONFIRMED',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (security_id, ex_date, provider_id)
);

CREATE TABLE IF NOT EXISTS split_event (
  split_event_id    bigserial PRIMARY KEY,
  security_id       bigint NOT NULL REFERENCES security(security_id),
  provider_id       bigint REFERENCES data_provider(provider_id),
  ex_date           date NOT NULL,
  split_from        numeric(20,8) NOT NULL,
  split_to          numeric(20,8) NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (security_id, ex_date, provider_id)
);

-- =========================
-- Derived / search latest
-- =========================
CREATE TABLE IF NOT EXISTS derived_metric_value (
  derived_metric_value_id bigserial PRIMARY KEY,
  security_id       bigint NOT NULL REFERENCES security(security_id) ON DELETE CASCADE,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  as_of_date        date NOT NULL,
  period_type       varchar(20) NOT NULL DEFAULT 'LATEST',
  numeric_value     numeric(38,10),
  text_value        text,
  currency_code     char(3),
  calculation_version varchar(40) NOT NULL,
  source_json       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (security_id, metric_id, as_of_date, period_type, calculation_version)
);

CREATE TABLE IF NOT EXISTS latest_metric_value (
  security_id       bigint NOT NULL REFERENCES security(security_id) ON DELETE CASCADE,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  numeric_value     numeric(38,10),
  text_value        text,
  as_of_date        date NOT NULL,
  source_type       varchar(30) NOT NULL,
  source_ref_id     bigint,
  calculation_version varchar(40),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (security_id, metric_id)
);

-- =========================
-- Screening configuration
-- =========================
CREATE TABLE IF NOT EXISTS screen_metric_tolerance (
  tolerance_id      bigserial PRIMARY KEY,
  setting_group_code varchar(30) NOT NULL DEFAULT 'SYS001',
  setting_detail_code varchar(30) NOT NULL,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  operator_code     varchar(20),
  tolerance_type    varchar(20) NOT NULL,
  tolerance_value   numeric(20,8) NOT NULL CHECK (tolerance_value >= 0),
  market_code       varchar(20),
  effective_from    date NOT NULL DEFAULT current_date,
  effective_to      date,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (setting_group_code, setting_detail_code, effective_from)
);

CREATE TABLE IF NOT EXISTS screen_strategy (
  strategy_id       bigserial PRIMARY KEY,
  strategy_code     varchar(50) NOT NULL UNIQUE,
  strategy_name     varchar(120) NOT NULL,
  description       text,
  target_user_level varchar(30) NOT NULL DEFAULT 'GENERAL',
  is_active         boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screen_strategy_condition (
  strategy_condition_id bigserial PRIMARY KEY,
  strategy_id       bigint NOT NULL REFERENCES screen_strategy(strategy_id) ON DELETE CASCADE,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  operator_code     varchar(20) NOT NULL,
  target_value      numeric(38,10),
  target_value2     numeric(38,10),
  weight            numeric(10,4) NOT NULL DEFAULT 1,
  required          boolean NOT NULL DEFAULT true,
  display_order     integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (strategy_id, metric_id, operator_code)
);

CREATE TABLE IF NOT EXISTS screen_preset (
  preset_id         bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  preset_name       varchar(120) NOT NULL,
  description       text,
  search_mode       varchar(30) NOT NULL DEFAULT 'ADVANCED_BASIC',
  market_filter_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  exchange_filter_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default        boolean NOT NULL DEFAULT false,
  notification_enabled boolean NOT NULL DEFAULT false,
  notification_interval_days smallint NOT NULL DEFAULT 1 CHECK (notification_interval_days BETWEEN 1 AND 30),
  next_notification_at timestamptz,
  last_notification_at timestamptz,
  last_match_security_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, preset_name)
);

CREATE TABLE IF NOT EXISTS screen_preset_condition (
  preset_condition_id bigserial PRIMARY KEY,
  preset_id         bigint NOT NULL REFERENCES screen_preset(preset_id) ON DELETE CASCADE,
  metric_id         bigint NOT NULL REFERENCES financial_metric(metric_id),
  operator_code     varchar(20) NOT NULL,
  target_value      numeric(38,10),
  target_value2     numeric(38,10),
  weight            numeric(10,4) NOT NULL DEFAULT 1,
  display_order     integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS screen_search_log (
  search_log_id     bigserial PRIMARY KEY,
  user_id           uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  search_mode       varchar(30) NOT NULL,
  strategy_code     varchar(50),
  request_json      jsonb NOT NULL,
  exact_count       integer NOT NULL DEFAULT 0,
  near_count        integer NOT NULL DEFAULT 0,
  elapsed_ms        integer,
  request_id        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_notification (
  notification_id  bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  preset_id         bigint REFERENCES screen_preset(preset_id) ON DELETE CASCADE,
  notification_type varchar(40) NOT NULL DEFAULT 'PRESET_MATCH',
  title             varchar(200) NOT NULL,
  body              text NOT NULL,
  payload_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_status      varchar(20) NOT NULL DEFAULT 'NOT_REQUESTED'
                    CONSTRAINT ck_user_notification_email_status
                    CHECK (email_status IN ('NOT_REQUESTED','PENDING','SENT','FAILED','SKIPPED')),
  email_attempted_at timestamptz,
  email_sent_at     timestamptz,
  email_error       text,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_notification_setting (
  user_id           uuid PRIMARY KEY REFERENCES app_user(user_id) ON DELETE CASCADE,
  custom_company_enabled boolean NOT NULL DEFAULT false,
  email_enabled     boolean NOT NULL DEFAULT false,
  notification_interval_days smallint NOT NULL DEFAULT 1
    CHECK (notification_interval_days BETWEEN 1 AND 30),
  next_notification_at timestamptz,
  last_notification_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- =========================
-- Watchlist
-- =========================
CREATE TABLE IF NOT EXISTS watchlist (
  watchlist_id      bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  watchlist_name    varchar(100) NOT NULL DEFAULT '관심종목',
  is_default        boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, watchlist_name)
);

CREATE TABLE IF NOT EXISTS watchlist_item (
  watchlist_id      bigint NOT NULL REFERENCES watchlist(watchlist_id) ON DELETE CASCADE,
  security_id       bigint NOT NULL REFERENCES security(security_id) ON DELETE CASCADE,
  memo              varchar(500),
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watchlist_id, security_id)
);

-- =========================
-- Batch / operational logging
-- =========================
CREATE TABLE IF NOT EXISTS batch_definition (
  batch_code        varchar(80) PRIMARY KEY,
  batch_name        varchar(160) NOT NULL,
  schedule_cron     varchar(100),
  timezone_name     varchar(80) NOT NULL DEFAULT 'Asia/Seoul',
  is_enabled        boolean NOT NULL DEFAULT false,
  max_retry         integer NOT NULL DEFAULT 3,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_job_run (
  batch_run_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_code        varchar(80) NOT NULL REFERENCES batch_definition(batch_code),
  status_code       varchar(30) NOT NULL,
  requested_by_type varchar(30) NOT NULL DEFAULT 'SCHEDULER',
  requested_by_user_id uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  business_date     date,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  inserted_count    integer NOT NULL DEFAULT 0,
  updated_count     integer NOT NULL DEFAULT 0,
  skipped_count     integer NOT NULL DEFAULT 0,
  error_count       integer NOT NULL DEFAULT 0,
  summary_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message     text
);

CREATE TABLE IF NOT EXISTS batch_step_run (
  batch_step_run_id bigserial PRIMARY KEY,
  batch_run_id      uuid NOT NULL REFERENCES batch_job_run(batch_run_id) ON DELETE CASCADE,
  step_code         varchar(80) NOT NULL,
  status_code       varchar(30) NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  processed_count   integer NOT NULL DEFAULT 0,
  summary_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message     text
);

CREATE TABLE IF NOT EXISTS external_api_call_log (
  api_call_log_id   bigserial PRIMARY KEY,
  batch_run_id      uuid REFERENCES batch_job_run(batch_run_id) ON DELETE SET NULL,
  provider_id       bigint REFERENCES data_provider(provider_id),
  endpoint_group    varchar(120) NOT NULL,
  http_method       varchar(10) NOT NULL,
  http_status       integer,
  duration_ms       integer,
  request_units     integer,
  returned_count    integer,
  success           boolean NOT NULL,
  error_code        varchar(100),
  error_message     text,
  request_id        uuid,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_ingestion_log (
  ingestion_log_id  bigserial PRIMARY KEY,
  batch_run_id      uuid REFERENCES batch_job_run(batch_run_id) ON DELETE SET NULL,
  provider_id       bigint REFERENCES data_provider(provider_id),
  entity_type       varchar(80) NOT NULL,
  market_code       varchar(20),
  business_date     date,
  received_count    integer NOT NULL DEFAULT 0,
  mapped_count      integer NOT NULL DEFAULT 0,
  inserted_count    integer NOT NULL DEFAULT 0,
  updated_count     integer NOT NULL DEFAULT 0,
  skipped_count     integer NOT NULL DEFAULT 0,
  error_count       integer NOT NULL DEFAULT 0,
  details_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_quality_run (
  data_quality_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_run_id      uuid REFERENCES batch_job_run(batch_run_id) ON DELETE SET NULL,
  status_code       varchar(30) NOT NULL DEFAULT 'RUNNING',
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  checked_count     integer NOT NULL DEFAULT 0,
  warning_count     integer NOT NULL DEFAULT 0,
  critical_count    integer NOT NULL DEFAULT 0,
  summary_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  alert_status_code varchar(30),
  alert_sent_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_quality_issue (
  data_quality_issue_id bigserial PRIMARY KEY,
  data_quality_run_id uuid NOT NULL REFERENCES data_quality_run(data_quality_run_id) ON DELETE CASCADE,
  check_code        varchar(100) NOT NULL,
  severity_code     varchar(20) NOT NULL,
  market_code       varchar(20),
  actual_value      numeric(38,10),
  threshold_value   numeric(38,10),
  message           text NOT NULL,
  details_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  audit_log_id      bigserial PRIMARY KEY,
  actor_user_id     uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  action_code       varchar(100) NOT NULL,
  target_type       varchar(80),
  target_id         varchar(150),
  before_json       jsonb,
  after_json        jsonb,
  request_id        uuid,
  ip_hash           varchar(128),
  user_agent        varchar(500),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_error_log (
  error_log_id      bigserial PRIMARY KEY,
  request_id        uuid,
  error_code        varchar(100),
  error_class       varchar(250),
  message           text NOT NULL,
  stack_trace       text,
  context_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notice (
  notice_id         bigserial PRIMARY KEY,
  title             varchar(250) NOT NULL,
  body              text NOT NULL,
  status_code       varchar(30) NOT NULL DEFAULT 'DRAFT',
  starts_at         timestamptz,
  ends_at           timestamptz,
  created_by        uuid REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMIT;
