-- Products (synced from Shopify and other e-commerce platforms)
CREATE TABLE products (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id      UUID REFERENCES integrations(id) ON DELETE SET NULL,
  external_id         TEXT,
  title               TEXT NOT NULL,
  description         TEXT,
  price               NUMERIC,
  compare_at_price    NUMERIC,
  currency            TEXT DEFAULT 'USD',
  inventory_quantity  INTEGER,
  status              TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  product_type        TEXT,
  vendor              TEXT,
  tags                TEXT[] DEFAULT '{}',
  image_url           TEXT,
  handle              TEXT,
  variants_count      INTEGER DEFAULT 1,
  metadata            JSONB DEFAULT '{}',
  synced_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_products_external ON products(user_id, external_id);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own products"
  ON products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
