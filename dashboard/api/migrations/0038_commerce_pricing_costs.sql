-- Commerce pricing + content economics (plans/pricing/rights/revenue/finance)
-- Extends 0008 billing_audit + FamilyState entitlement authority without creating second truth.

PRAGMA foreign_keys = ON;

-- Store product mapping: external provider product → Majarra plan
CREATE TABLE store_products (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('google_play','app_store','stripe','manual')),
  store_product_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('free','family','family_plus')),
  billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly','annual','lifetime','weekly')),
  base_country TEXT, -- NULL = global default
  currency TEXT,     -- e.g. EGP, SAR, USD (ISO 4217)
  base_price_minor INTEGER, -- price in minor units (cents) — NULL if unavailable
  trial_days INTEGER CHECK (trial_days IS NULL OR trial_days >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','deprecated')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(provider, store_product_id)
);

-- Country/store/currency pricing catalogue (plan × country × store)
CREATE TABLE plan_pricing (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('free','family','family_plus')),
  store_product_id TEXT NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  country TEXT NOT NULL, -- ISO 3166-1 alpha-2, e.g. EG, SA, US; 'GLOBAL' for default
  currency TEXT NOT NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  effective_from TEXT NOT NULL DEFAULT (datetime('now')),
  effective_until TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','scheduled','expired','draft')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(plan, country, store_product_id, effective_from)
);

-- Promotions / offers (separate from base plan)
CREATE TABLE promotions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE, -- promo code if applicable
  name_ar TEXT NOT NULL,
  description TEXT,
  plan TEXT CHECK (plan IS NULL OR plan IN ('free','family','family_plus')),
  store_product_id TEXT REFERENCES store_products(id) ON DELETE SET NULL,
  discount_type TEXT CHECK (discount_type IN ('percent','fixed','trial_extension')),
  discount_value REAL,
  country TEXT, -- NULL = all
  starts_at TEXT,
  ends_at TEXT,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','expired','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Content / production costs (real persisted costing model)
CREATE TABLE content_costs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('series','season','episode','story','story_page','book','book_page','game','project','planet')),
  entity_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('writing','illustration','animation','video','audio','translation','qa','licensing','external','marketing','technology','other')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  vendor TEXT, -- internal or external vendor/source
  incurred_at TEXT NOT NULL DEFAULT (datetime('now')),
  period TEXT, -- e.g. 2026-Q1
  allocation_basis TEXT, -- e.g. per_episode, per_minute, flat
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE content_budgets (
  id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('planet','series','global')),
  scope_id TEXT, -- NULL for global
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'EGP',
  period TEXT NOT NULL, -- e.g. 2026-Q1 or 2026
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','committed','actual','forecast')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_store_products_provider ON store_products(provider, plan, status);
CREATE INDEX idx_plan_pricing_plan_country ON plan_pricing(plan, country, status, effective_from);
CREATE INDEX idx_content_costs_entity ON content_costs(entity_type, entity_id, category);
CREATE INDEX idx_content_costs_period ON content_costs(period, currency);
CREATE INDEX idx_content_budgets_scope ON content_budgets(scope_type, scope_id, period);

-- Seed store products for existing plans (honest: price unknown, needs configuration)
INSERT OR IGNORE INTO store_products (id, provider, store_product_id, plan, billing_period, currency, base_price_minor, status)
VALUES
  ('sp-family-monthly', 'google_play', 'majarra.family.monthly', 'family', 'monthly', 'EGP', NULL, 'inactive'),
  ('sp-family-plus-monthly', 'google_play', 'majarra.family_plus.monthly', 'family_plus', 'monthly', 'EGP', NULL, 'inactive'),
  ('sp-family-annual', 'google_play', 'majarra.family.annual', 'family', 'annual', 'EGP', NULL, 'inactive');

-- Seed example content cost categories (no fake amounts)
-- (actual costs inserted via admin UI)
