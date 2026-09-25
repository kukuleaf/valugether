BEGIN;

ALTER TABLE user_notification_setting
  ADD COLUMN IF NOT EXISTS email_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE user_notification
  ADD COLUMN IF NOT EXISTS email_status varchar(20) NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN IF NOT EXISTS email_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_error text;

DO $$ BEGIN
  ALTER TABLE user_notification
    ADD CONSTRAINT ck_user_notification_email_status
    CHECK (email_status IN ('NOT_REQUESTED','PENDING','SENT','FAILED','SKIPPED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS ix_user_notification_email_delivery
  ON user_notification(email_status,created_at)
  WHERE email_status IN ('PENDING','FAILED');

COMMIT;
