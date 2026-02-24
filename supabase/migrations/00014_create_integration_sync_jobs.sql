-- Durable integration sync queue with retry metadata.
CREATE TABLE integration_sync_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL CHECK (provider IN ('shopify', 'youtube')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  attempt_count   INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  next_retry_at   TIMESTAMPTZ DEFAULT now(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (integration_id, provider)
);

CREATE INDEX idx_sync_jobs_due
  ON integration_sync_jobs(status, next_retry_at, created_at);

CREATE INDEX idx_sync_jobs_user
  ON integration_sync_jobs(user_id, created_at DESC);

CREATE TRIGGER integration_sync_jobs_updated_at
  BEFORE UPDATE ON integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync jobs"
  ON integration_sync_jobs FOR SELECT
  USING (auth.uid() = user_id);
