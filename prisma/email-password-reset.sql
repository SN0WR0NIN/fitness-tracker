BEGIN;

ALTER TABLE app_internal.password_reset_request
  ADD COLUMN IF NOT EXISTS token_hash TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_request_token_hash_idx
  ON app_internal.password_reset_request(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS password_reset_request_active_expiry_idx
  ON app_internal.password_reset_request(expires_at)
  WHERE status = 'ISSUED';

REVOKE ALL ON TABLE app_internal.password_reset_request FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE app_internal.password_reset_request FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE app_internal.password_reset_request FROM authenticated';
  END IF;
END
$$;

COMMIT;
