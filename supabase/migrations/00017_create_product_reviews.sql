-- Product reviews table (supports Shopify native reviews and third-party apps)

CREATE TABLE product_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id      UUID REFERENCES integrations(id) ON DELETE SET NULL,
  product_id          UUID REFERENCES products(id) ON DELETE CASCADE,
  external_review_id  TEXT,
  rating              INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title               TEXT,
  body                TEXT,
  author_name         TEXT,
  author_email        TEXT,
  verified_purchase   BOOLEAN NOT NULL DEFAULT false,
  source              TEXT NOT NULL DEFAULT 'shopify',
  sentiment           TEXT,  -- positive, neutral, negative (can be populated by analysis)
  created_at_source   TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, external_review_id)
);

CREATE INDEX idx_reviews_product ON product_reviews(user_id, product_id);
CREATE INDEX idx_reviews_rating ON product_reviews(user_id, rating);
CREATE INDEX idx_reviews_created ON product_reviews(user_id, created_at_source DESC);

-- RLS Policies
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own product_reviews"
  ON product_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access on product_reviews"
  ON product_reviews FOR ALL USING (auth.role() = 'service_role');
