BEGIN;

ALTER TABLE screen_preset
  ADD COLUMN IF NOT EXISTS notification_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notification_interval_days smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS next_notification_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_notification_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_match_security_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  ALTER TABLE screen_preset
    ADD CONSTRAINT ck_screen_preset_notification_interval
    CHECK (notification_interval_days BETWEEN 1 AND 30);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_notification (
  notification_id  bigserial PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  preset_id         bigint REFERENCES screen_preset(preset_id) ON DELETE CASCADE,
  notification_type varchar(40) NOT NULL DEFAULT 'PRESET_MATCH',
  title             varchar(200) NOT NULL,
  body              text NOT NULL,
  payload_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at           timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_screen_preset_due_notification
  ON screen_preset(next_notification_at)
  WHERE notification_enabled=true;
CREATE INDEX IF NOT EXISTS ix_user_notification_user_created
  ON user_notification(user_id,created_at DESC);

INSERT INTO batch_definition(batch_code,batch_name,schedule_cron,timezone_name,is_enabled,description)
VALUES ('PRESET_MATCH_NOTIFY','맞춤기업 조건 충족 알림','30 10 * * *','Asia/Seoul',false,
        '가격 및 파생지표 갱신 뒤 알림 주기가 도래한 프리셋을 평가')
ON CONFLICT (batch_code) DO UPDATE SET
  batch_name=EXCLUDED.batch_name,
  schedule_cron=EXCLUDED.schedule_cron,
  description=EXCLUDED.description,
  updated_at=now();

COMMIT;
