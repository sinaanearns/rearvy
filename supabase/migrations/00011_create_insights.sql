-- Insights (auto-detected business events and anomalies)
CREATE TABLE insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  insight_type    TEXT NOT NULL CHECK (insight_type IN ('anomaly', 'trend', 'milestone', 'opportunity', 'risk', 'sync_event')),
  severity        TEXT NOT NULL CHECK (severity IN ('info', 'notable', 'important', 'critical')),
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  data_snapshot   JSONB DEFAULT '{}',
  metric_refs     JSONB DEFAULT '[]',
  related_entity  JSONB,
  is_read         BOOLEAN DEFAULT FALSE,
  is_dismissed    BOOLEAN DEFAULT FALSE,
  generated_at    TIMESTAMPTZ DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_insights_user_unread ON insights(user_id, generated_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_insights_user_all ON insights(user_id, generated_at DESC);

ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own insights"
  ON insights FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
