BEGIN;

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

CREATE INDEX IF NOT EXISTS ix_data_quality_run_started
  ON data_quality_run(started_at DESC);
CREATE INDEX IF NOT EXISTS ix_data_quality_issue_run
  ON data_quality_issue(data_quality_run_id, severity_code, check_code);

INSERT INTO batch_definition(
  batch_code,batch_name,schedule_cron,timezone_name,is_enabled,max_retry,description
) VALUES(
  'DATA_QUALITY_CHECK','데이터 품질 검사','0 11 * * *','Asia/Seoul',false,1,
  '가격·재무 최신성, 커버리지, 이상값, 배치 실패 검사'
)
ON CONFLICT(batch_code) DO UPDATE SET
  batch_name=EXCLUDED.batch_name,
  schedule_cron=EXCLUDED.schedule_cron,
  description=EXCLUDED.description,
  updated_at=now();

COMMIT;
