-- 0103 — push notifications through FCM (`APP-203`).
--
-- `push_tokens`: one row per device token a signed-in parent registered.
-- Written by `routes/push.ts`, pruned by `lib/push.ts` when FCM answers that a
-- token is no longer valid. Television tokens are never registered (nobody
-- reads a notification on a TV), and the parent chooses which kinds they get.
--
-- `push_preferences`: absence of a row means every kind is on; a parent turns
-- a kind off in the parent area. Changing it needs a parent proof, so a child
-- cannot silence "screen time is almost over".
--
-- `push_log`: one row per (family, dedupe key), so a heartbeat every 30 s or a
-- cron retry cannot send the same notification twice. Kept 30 days.

CREATE TABLE IF NOT EXISTS push_tokens (
  token TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  device_id TEXT,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_parent ON push_tokens (parent_id);

CREATE TABLE IF NOT EXISTS push_preferences (
  parent_id TEXT PRIMARY KEY,
  new_episodes INTEGER NOT NULL DEFAULT 1 CHECK (new_episodes IN (0, 1)),
  screen_time INTEGER NOT NULL DEFAULT 1 CHECK (screen_time IN (0, 1)),
  weekly_report INTEGER NOT NULL DEFAULT 1 CHECK (weekly_report IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_log (
  parent_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (parent_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_push_log_created ON push_log (created_at);
