BEGIN;

-- Social-only accounts may have no email. Email/password accounts still require an email in the API.
ALTER TABLE app_user ALTER COLUMN email DROP NOT NULL;

CREATE TABLE IF NOT EXISTS social_login_nonce (
  nonce_hash    char(64) PRIMARY KEY,
  provider_code varchar(30) NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz
);

CREATE INDEX IF NOT EXISTS ix_social_login_nonce_expires
  ON social_login_nonce(expires_at);

COMMIT;
