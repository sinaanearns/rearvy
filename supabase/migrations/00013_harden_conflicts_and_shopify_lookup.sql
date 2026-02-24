-- Normalize and index Shopify domain metadata for safer webhook routing.
UPDATE integrations
SET sync_cursor =
  COALESCE(sync_cursor, '{}'::jsonb) ||
  jsonb_build_object(
    'shop_domain',
    lower(
      trim(
        both ' '
        from substring(provider_account_name from '\(([^)]+)\)')
      )
    )
  )
WHERE provider = 'shopify'
  AND (sync_cursor IS NULL OR sync_cursor->>'shop_domain' IS NULL)
  AND provider_account_name IS NOT NULL
  AND provider_account_name ~ '\([^)]+\)';

CREATE INDEX IF NOT EXISTS idx_integrations_shopify_shop_domain
ON integrations ((lower(sync_cursor->>'shop_domain')))
WHERE provider = 'shopify';

-- Remove duplicate products by (user_id, external_id), keeping the most recent row.
WITH ranked_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, external_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM products
  WHERE external_id IS NOT NULL
)
DELETE FROM products p
USING ranked_products rp
WHERE p.id = rp.id
  AND rp.rn > 1;

-- Remove duplicate orders by (user_id, external_id), keeping the most recent row.
WITH ranked_orders AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, external_id
      ORDER BY placed_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM orders
  WHERE external_id IS NOT NULL
)
DELETE FROM orders o
USING ranked_orders ro
WHERE o.id = ro.id
  AND ro.rn > 1;

-- Ensure ON CONFLICT (user_id, external_id) has matching unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_user_external_unique
ON products (user_id, external_id)
WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_external_unique
ON orders (user_id, external_id)
WHERE external_id IS NOT NULL;
