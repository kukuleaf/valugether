BEGIN;

CREATE INDEX IF NOT EXISTS ix_verification_token_user_purpose_created
  ON verification_token(user_id, purpose_code, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_verification_token_expiry_cleanup
  ON verification_token(expires_at)
  WHERE used_at IS NULL;

COMMIT;
