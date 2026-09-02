-- Harden regional pricing and make the payment-method control plane the
-- authoritative gate for starting new Google Play sales.
PRAGMA foreign_keys = ON;

-- 0075 added the column with DEFAULT 2. Repair currencies whose ISO-4217
-- minor-unit exponent differs from two. Unknown legacy currencies remain at
-- two and cannot be created or edited through the hardened Admin API.
UPDATE plan_pricing
SET currency_exponent = CASE
  WHEN currency IN ('JPY', 'KRW') THEN 0
  WHEN currency IN ('BHD', 'JOD', 'KWD', 'OMR', 'TND') THEN 3
  ELSE 2
END;

-- Scheduling was exposed without a scheduler. Preserve legacy rows as drafts;
-- future creation and transitions are enforced by the API.
UPDATE plan_pricing
SET status = 'draft', updated_at = datetime('now')
WHERE status = 'scheduled';

-- Repair any historical multiple-active condition deterministically before
-- enforcing one active revision per provider product and country.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY store_product_id, country
           ORDER BY datetime(effective_from) DESC, datetime(updated_at) DESC, id DESC
         ) AS position
  FROM plan_pricing
  WHERE status = 'active'
)
UPDATE plan_pricing
SET status = 'expired',
    effective_until = datetime('now'),
    updated_at = datetime('now')
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_pricing_one_active_market
  ON plan_pricing(store_product_id, country)
  WHERE status = 'active';

-- Compatibility seed: after the catalogue starts honoring the operator row,
-- existing configured Android Google Play checkout remains available. An
-- operator can disable this row immediately as the runtime kill switch.
INSERT OR IGNORE INTO billing_payment_methods (
  id, provider, method_code, name_ar, name_en, country, platform,
  checkout_mode, status, sort_order
) VALUES (
  'payment-google-play-global-android',
  'google_play',
  'google_play',
  'Google Play',
  'Google Play',
  'GLOBAL',
  'android',
  'native_store',
  'active',
  0
);
