-- Phase 1 adaptive delivery — normalized renditions + HLS manifest helper
-- Keep quality_renditions JSON for backward compat, but also normalized for integrity

CREATE TABLE episode_renditions (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- 1080p,720p,480p,360p,auto
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  bitrate_kbps INTEGER CHECK (bitrate_kbps IS NULL OR bitrate_kbps > 0),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_episode_renditions_episode ON episode_renditions(episode_id, sort_order);
CREATE UNIQUE INDEX idx_episode_renditions_label ON episode_renditions(episode_id, label);

-- Backfill from JSON where possible (no-op if empty)
-- Will be synced via admin API on next save
