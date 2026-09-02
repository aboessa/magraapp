-- Google Play is the live source of subscription prices. These records are
-- reviewable drafts and publication receipts, never a second price authority.
CREATE TABLE IF NOT EXISTS google_play_price_drafts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  base_plan_id TEXT NOT NULL,
  region_code TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  units TEXT NOT NULL,
  nanos INTEGER NOT NULL DEFAULT 0,
  observed_price_json TEXT,
  observed_regions_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','failed')),
  created_by TEXT,
  published_by TEXT,
  published_at TEXT,
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_google_play_price_drafts_status
  ON google_play_price_drafts(status, product_id, base_plan_id, region_code, created_at DESC);
