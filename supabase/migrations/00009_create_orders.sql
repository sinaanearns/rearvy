-- Orders (synced from Shopify)
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id    UUID REFERENCES integrations(id) ON DELETE SET NULL,
  external_id       TEXT,
  order_number      TEXT,
  total_price       NUMERIC NOT NULL,
  subtotal_price    NUMERIC,
  total_tax         NUMERIC DEFAULT 0,
  total_discount    NUMERIC DEFAULT 0,
  shipping_cost     NUMERIC DEFAULT 0,
  currency          TEXT DEFAULT 'USD',
  financial_status  TEXT CHECK (financial_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'partially_refunded', 'voided')),
  fulfillment_status TEXT CHECK (fulfillment_status IN ('unfulfilled', 'partial', 'fulfilled', 'restocked')),
  customer_email    TEXT,
  customer_name     TEXT,
  line_items        JSONB DEFAULT '[]',
  tags              TEXT[] DEFAULT '{}',
  placed_at         TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_user_placed ON orders(user_id, placed_at DESC);
CREATE INDEX idx_orders_external ON orders(user_id, external_id);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own orders"
  ON orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
