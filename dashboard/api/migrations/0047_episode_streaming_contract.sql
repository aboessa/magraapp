-- Phase 0 streaming contract — additive, no destructive drops.
-- Audio/subtitle tracks normalized with content_assets identity.
-- Intro/recap/credits editorial timestamps + preview sprite + quality renditions.
-- Legacy dubs + captions_ar_url preserved for backward compatibility.

PRAGMA foreign_keys = ON;

-- Editorial timestamps + preview sprite (nullable) ---------------------------
ALTER TABLE episodes ADD COLUMN intro_start_ms INTEGER CHECK (intro_start_ms IS NULL OR intro_start_ms >= 0);
ALTER TABLE episodes ADD COLUMN intro_end_ms INTEGER CHECK (intro_end_ms IS NULL OR intro_end_ms >= 0);
ALTER TABLE episodes ADD COLUMN recap_start_ms INTEGER CHECK (recap_start_ms IS NULL OR recap_start_ms >= 0);
ALTER TABLE episodes ADD COLUMN recap_end_ms INTEGER CHECK (recap_end_ms IS NULL OR recap_end_ms >= 0);
ALTER TABLE episodes ADD COLUMN credits_start_ms INTEGER CHECK (credits_start_ms IS NULL OR credits_start_ms >= 0);
ALTER TABLE episodes ADD COLUMN preview_sprite_url TEXT;
ALTER TABLE episodes ADD COLUMN preview_sprite_vtt_url TEXT;

-- Quality renditions as JSON array: [{label,url}] or empty until Phase 1 transcode
ALTER TABLE episodes ADD COLUMN quality_renditions TEXT NOT NULL DEFAULT '[]';

-- Normalized audio tracks ---------------------------------------------------
CREATE TABLE episode_audio_tracks (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ar','en','fr')),
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  label TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (episode_id, language)
);

-- Normalized subtitle tracks ------------------------------------------------
CREATE TABLE episode_subtitle_tracks (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ar','en','fr')),
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE RESTRICT,
  label TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'vtt' CHECK (format IN ('vtt','srt')),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (episode_id, language)
);

CREATE INDEX idx_episode_audio_episode ON episode_audio_tracks(episode_id, language);
CREATE INDEX idx_episode_subtitle_episode ON episode_subtitle_tracks(episode_id, language);

-- Backfill legacy subtitle: if captions_ar_url present, create a public subtitle asset placeholder link is not needed;
-- we keep legacy read path. No fake EN/FR rows inserted.

-- Validation helper note: intro_end > intro_start, end <= duration enforced at API layer, not CHECK (duration may be null).
