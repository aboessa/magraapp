-- 0101 — what a child liked or saved, for recommendations (`APP-209`).
--
-- Projection of `favorite.updated` for series: `entity_type = 'series'` is the
-- existing «احفظ» (watchlist) and `'series_like'` is the new «عجبني». The
-- authority stays in `FamilyState.favorites`; before this, nothing in D1 knew
-- either, so recommendations could not use them.
--
-- One row per (child, series, kind); removal deletes it. `last_event_at_ms`
-- orders out-of-order deliveries: an older add cannot resurrect a newer remove
-- because the remove leaves a tombstone row (`active = 0`).
--
-- Replaces nothing: the 0001 `favorites` table is unused (dead FK to
-- `children_profiles`, 0090) and is left alone.

CREATE TABLE IF NOT EXISTS child_series_signals (
  child_id TEXT NOT NULL,
  series_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('like', 'save')),
  parent_id TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_event_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, series_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_child_series_signals_child
  ON child_series_signals (child_id, active);
