-- Business metrics (normalized time-series data from all integrations)
CREATE TABLE business_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id  UUID REFERENCES integrations(id) ON DELETE SET NULL,
  metric_type     TEXT NOT NULL CHECK (metric_type IN (
    'revenue', 'orders', 'units_sold', 'refunds',
    'page_views', 'sessions', 'bounce_rate', 'conversion_rate',
    'followers', 'subscribers', 'likes', 'comments', 'shares', 'video_views',
    'impressions', 'reach', 'engagement_rate',
    'average_order_value', 'customer_count', 'repeat_customer_rate'
  )),
  metric_value    NUMERIC NOT NULL,
  dimensions      JSONB DEFAULT '{}',
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  granularity     TEXT DEFAULT 'daily' CHECK (granularity IN ('hourly', 'daily', 'weekly', 'monthly')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bm_user_type_period ON business_metrics(user_id, metric_type, period_start DESC);
CREATE INDEX idx_bm_dimensions ON business_metrics USING GIN(dimensions);

ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own business metrics"
  ON business_metrics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
