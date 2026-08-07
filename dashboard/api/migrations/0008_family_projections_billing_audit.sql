-- Read-only administrative projections fed from the FamilyDO outbox, plus
-- permanent Google Play verification audit. These tables are not family state
-- sources of truth and must never be written by public family routes.
PRAGMA foreign_keys = ON;

CREATE TABLE family_projection (
  parent_id TEXT PRIMARY KEY,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'family', 'family_plus')),
  created_at_ms INTEGER,
  last_event_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE child_projection (
  child_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  nickname TEXT,
  age_track TEXT CHECK (age_track IS NULL OR age_track IN ('preschool', 'kids', 'junior')),
  avatar_id TEXT,
  language TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at_ms INTEGER,
  last_event_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE processed_family_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE billing_audit (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google_play')),
  product_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('family', 'family_plus')),
  purchase_token_hash TEXT NOT NULL UNIQUE,
  provider_purchase_id TEXT,
  provider_state TEXT NOT NULL,
  entitlement_status TEXT NOT NULL CHECK (entitlement_status IN ('active', 'grace', 'expired', 'revoked')),
  starts_at_ms INTEGER,
  expires_at_ms INTEGER,
  raw_response_hash TEXT NOT NULL,
  verified_at_ms INTEGER NOT NULL,
  projection_applied_at_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_family_projection_status_plan ON family_projection(status, plan, last_event_at_ms);
CREATE INDEX idx_child_projection_parent_status ON child_projection(parent_id, status, last_event_at_ms);
CREATE INDEX idx_child_projection_track_status ON child_projection(age_track, status, last_event_at_ms);
CREATE INDEX idx_processed_family_events_parent ON processed_family_events(parent_id, occurred_at_ms);
CREATE INDEX idx_billing_audit_parent_verified ON billing_audit(parent_id, verified_at_ms);
CREATE INDEX idx_billing_audit_state_expiry ON billing_audit(entitlement_status, expires_at_ms);
