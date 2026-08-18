-- Phase 2 parental controls — per-child time, bedtime, autoplay/speed, Home recommendations support
PRAGMA foreign_keys=ON;

-- Extend child_settings with bedtime and session limits (additive)
ALTER TABLE child_settings ADD COLUMN bedtime_start TEXT; -- HH:MM 24h or NULL
ALTER TABLE child_settings ADD COLUMN bedtime_end TEXT;
ALTER TABLE child_settings ADD COLUMN max_session_minutes INTEGER CHECK (max_session_minutes IS NULL OR max_session_minutes BETWEEN 5 AND 180);
ALTER TABLE child_settings ADD COLUMN allow_speed_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_speed_change IN (0,1));
ALTER TABLE child_settings ADD COLUMN autoplay_override TEXT CHECK (autoplay_override IS NULL OR autoplay_override IN ('off','on','inherit'));

-- Home recommendations editorial table
CREATE TABLE home_recommendations (
  id TEXT PRIMARY KEY,
  child_id TEXT REFERENCES children_profiles(id) ON DELETE CASCADE, -- NULL = global editorial
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'editorial',
  priority INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_home_recs_child ON home_recommendations(child_id, priority);

-- Seed global editorial (popular by planet) — honest picks from existing series
INSERT OR IGNORE INTO home_recommendations (id, child_id, series_id, reason, priority, is_pinned) VALUES
  ('rec-global-1', NULL, 'series-kids-wisdom', 'editorial', 100, 1),
  ('rec-global-2', NULL, 'series-kids-numbers', 'editorial', 90, 0),
  ('rec-global-3', NULL, 'series-preschool-luna-words', 'editorial', 80, 0);
