-- 0098 — platform policy editable from the admin dashboard (`ADMIN-POLICY`).
--
-- One row per policy section: `plan_limits`, `tv_pairing`, `offline_license`.
-- The value is validated JSON written only by `routes/adminPlatformPolicy.ts`,
-- which bounds every number, audits every change and bumps `version`.
--
-- Absence of a row means "the defaults in code". The readers in
-- `lib/platformPolicy.ts` fall back to those defaults (or to the last value they
-- read) when D1 is unreachable, so a D1 outage can neither open a limit nor lock
-- out a paying family.
--
-- No secrets belong here: every value is plain product policy.

CREATE TABLE IF NOT EXISTS platform_policy (
  section TEXT PRIMARY KEY CHECK (section IN ('plan_limits', 'tv_pairing', 'offline_license')),
  value_json TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version >= 1),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
