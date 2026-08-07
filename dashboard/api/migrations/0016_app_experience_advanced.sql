-- App Experience: مسودة/جدولة/Rollback + استهداف متقدم

ALTER TABLE home_experience_blocks ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
ALTER TABLE home_experience_blocks ADD COLUMN scheduled_at TEXT;
ALTER TABLE home_experience_blocks ADD COLUMN expires_at TEXT;
ALTER TABLE home_experience_blocks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS home_experience_versions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  snapshot_json TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_home_blocks_schedule ON home_experience_blocks(scheduled_at, expires_at, is_active);
