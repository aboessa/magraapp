-- 0102 — devices across all families, for the admin (`ADM-307`).
--
-- «الأجهزة والتنزيلات» read `account_devices`, which never had a writer (and
-- still carries a foreign key to the empty `parents` table, 0091, so any insert
-- would fail). The authority is `FamilyState.devices`; this is its projection,
-- written by the queue from `session.created`, `device.revoked`,
-- `session.revoked` (operator revoke-all) and `family.resynced` (backfill).
--
-- No installation hash: an operator never needs a device fingerprint.
-- `last_seen_at_ms` is the last sign-in (FamilyState updates `devices.last_seen_at`
-- only then), not the last request. No foreign keys, ms integers, like 0086.

CREATE TABLE IF NOT EXISTS device_projection (
  device_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  display_name TEXT,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  registered_at_ms INTEGER,
  last_seen_at_ms INTEGER,
  revoked_at_ms INTEGER,
  last_event_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_device_projection_parent ON device_projection (parent_id, status);
CREATE INDEX IF NOT EXISTS idx_device_projection_seen ON device_projection (last_seen_at_ms DESC);
