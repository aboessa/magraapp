-- Phase 3 analytics & in-app notifications
PRAGMA foreign_keys=ON;

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES parents(id) ON DELETE SET NULL,
  child_id TEXT REFERENCES children_profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_analytics_parent ON analytics_events(parent_id, created_at);
CREATE INDEX idx_analytics_child ON analytics_events(child_id, created_at);
CREATE INDEX idx_analytics_name ON analytics_events(event_name, created_at);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('new_episode','new_series','continue_watching','download_complete','subscription_issue','creative_update')),
  title_ar TEXT NOT NULL,
  body_ar TEXT,
  deep_link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_parent ON notifications(parent_id, is_read, created_at);
CREATE INDEX idx_notifications_child ON notifications(child_id, is_read, created_at);
