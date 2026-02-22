-- Integrations (OAuth tokens for connected platforms)
CREATE TABLE integrations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN (
    'shopify', 'youtube', 'instagram', 'tiktok', 'stripe', 'google_analytics'
  )),
  provider_account_id   TEXT,
  provider_account_name TEXT,
  access_token_enc      TEXT NOT NULL,
  refresh_token_enc     TEXT,
  token_iv              TEXT NOT NULL,
  scopes                TEXT[] DEFAULT '{}',
  token_expires_at      TIMESTAMPTZ,
  status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_synced_at        TIMESTAMPTZ,
  sync_cursor           JSONB,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own integrations"
  ON integrations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
