-- Regional checkout methods exposed by the billing catalogue.
-- This table stores public routing metadata only. Provider credentials and
-- webhook secrets must remain Worker secrets, never D1 rows or API responses.

PRAGMA foreign_keys = ON;

-- ISO-4217 minor-unit precision belongs to the price row; assuming 100 minor
-- units per major unit breaks currencies such as JPY (0) and KWD (3).
ALTER TABLE plan_pricing ADD COLUMN currency_exponent INTEGER NOT NULL DEFAULT 2
  CHECK (currency_exponent BETWEEN 0 AND 3);

CREATE TABLE IF NOT EXISTS billing_payment_methods (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (
    provider IN ('google_play', 'app_store', 'stripe', 'payment_gateway')
  ),
  method_code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  country TEXT NOT NULL CHECK (
    country = 'GLOBAL' OR (
      length(country) = 2 AND country = upper(country)
    )
  ),
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  checkout_mode TEXT NOT NULL CHECK (
    checkout_mode IN ('native_store', 'hosted_checkout', 'redirect')
  ),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'active', 'disabled')
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, method_code, country, platform)
);

CREATE INDEX IF NOT EXISTS idx_billing_payment_methods_catalog
  ON billing_payment_methods(platform, country, status, sort_order);

-- Deliberately no seed rows. Vodafone Cash, InstaPay, cards, or any other
-- method becomes visible only after its provider, signed callback, status
-- reconciliation, and production credentials are configured and the row is
-- explicitly activated by an operator.
