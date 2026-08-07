-- Parent authentication, device controls, subscription entitlements, and
-- short-lived playback leases. No client-supplied purchase is an entitlement.
PRAGMA foreign_keys = ON;

CREATE TABLE parent_credentials (
  parent_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE,
  email_normalized TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  email_verified_at TEXT,
  auth_epoch INTEGER NOT NULL DEFAULT 1 CHECK (auth_epoch >= 1),
  failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE subscription_plan_limits (
  plan TEXT PRIMARY KEY CHECK (plan IN ('free', 'family', 'family_plus')),
  max_child_profiles INTEGER NOT NULL CHECK (max_child_profiles >= 1),
  max_registered_devices INTEGER NOT NULL CHECK (max_registered_devices >= 1),
  max_concurrent_streams INTEGER NOT NULL CHECK (max_concurrent_streams >= 1),
  max_download_devices INTEGER NOT NULL CHECK (max_download_devices >= 0),
  policy_version INTEGER NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO subscription_plan_limits (
  plan, max_child_profiles, max_registered_devices, max_concurrent_streams, max_download_devices
) VALUES
  ('free', 1, 1, 1, 0),
  ('family', 4, 4, 2, 2),
  ('family_plus', 4, 8, 4, 4);

CREATE TABLE account_devices (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  installation_id_hash TEXT NOT NULL,
  display_name TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'android_tv', 'ios', 'tvos', 'web')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  auth_epoch INTEGER NOT NULL DEFAULT 1 CHECK (auth_epoch >= 1),
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  UNIQUE (parent_id, installation_id_hash)
);

CREATE TABLE parent_auth_sessions (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  device_id TEXT REFERENCES account_devices(id) ON DELETE SET NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  auth_epoch INTEGER NOT NULL CHECK (auth_epoch >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

-- The raw Google Play purchase token is never stored. It is validated server-side
-- before an entitlement can be written, and only its SHA-256 digest is retained
-- for idempotency and audit correlation.
CREATE TABLE google_play_purchases (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  purchase_token_hash TEXT NOT NULL UNIQUE,
  provider_purchase_id TEXT,
  purchase_state TEXT NOT NULL CHECK (purchase_state IN ('pending', 'purchased', 'cancelled', 'expired', 'revoked')),
  purchased_at TEXT,
  expires_at TEXT,
  raw_response_hash TEXT,
  last_verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE subscription_entitlements (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('google_play', 'admin_grant')),
  plan TEXT NOT NULL CHECK (plan IN ('free', 'family', 'family_plus')),
  provider_purchase_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'revoked')),
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source, provider_purchase_id)
);

CREATE TABLE playback_leases (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES account_devices(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES parent_auth_sessions(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('episode', 'story', 'book', 'game', 'project')),
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE INDEX idx_credentials_email ON parent_credentials(email_normalized);
CREATE INDEX idx_devices_parent_status ON account_devices(parent_id, status);
CREATE INDEX idx_sessions_parent_status ON parent_auth_sessions(parent_id, status, expires_at);
CREATE INDEX idx_google_play_parent_state ON google_play_purchases(parent_id, purchase_state, expires_at);
CREATE INDEX idx_entitlements_parent_status ON subscription_entitlements(parent_id, status, expires_at);
CREATE INDEX idx_playback_parent_active ON playback_leases(parent_id, status, expires_at);
CREATE INDEX idx_playback_lease_asset ON playback_leases(id, asset_id, status, expires_at);
