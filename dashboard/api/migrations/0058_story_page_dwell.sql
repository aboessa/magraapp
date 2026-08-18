-- 0058 — story page dwell time (illustration viewing after narration).
--
-- Problem: duration_ms was treated as the full page experience time.
-- It must remain the actual narration audio duration only. Illustrated pages
-- need additional viewing time after narration finishes.
--
-- Solution: dwell_ms = authored time the page remains visible AFTER
-- narration completes, before auto-advance. Nullable for backward
-- compatibility — legacy rows work without it.
--
-- Runtime: narration completion event -> dwellMs -> page transition.
-- No bake-silence into WAV, no fake duration_ms, no reduced advertised duration.

PRAGMA foreign_keys = ON;

ALTER TABLE story_pages ADD COLUMN dwell_ms INTEGER
  CHECK (dwell_ms IS NULL OR (dwell_ms >= 0 AND dwell_ms <= 60000));

CREATE INDEX IF NOT EXISTS idx_story_pages_dwell ON story_pages(dwell_ms);
