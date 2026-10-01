-- 0100 — watch time per child, per local day, per content (`ADM-309`).
--
-- Projection of the `watch_time.credited` event, which `FamilyState` emits in
-- the same transaction that adds the seconds to its `screen_time_daily` counter.
-- So this table is exactly the screen-time counter, broken down by content, and
-- cannot drift from what the limits enforce.
--
-- `activity_date` is the family's local date (as the limits use it), not UTC.
-- `age_track` is the child's track when the time was credited, so a later
-- track transition does not rewrite history.
--
-- Additive: the consumer adds seconds only when the event id is not yet in
-- `processed_family_events`, in the same D1 batch, so a redelivery never counts
-- twice. No foreign keys, like every projection (0086).
--
-- Named deliberately not `child_screen_time_daily`: that table was dropped in
-- 0086 and a test forbids referencing it again.

CREATE TABLE IF NOT EXISTS child_watch_time_daily (
  activity_date TEXT NOT NULL,
  child_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  age_track TEXT,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  last_event_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (activity_date, child_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_child_watch_time_content
  ON child_watch_time_daily (content_type, content_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_child_watch_time_child
  ON child_watch_time_daily (child_id, activity_date);
