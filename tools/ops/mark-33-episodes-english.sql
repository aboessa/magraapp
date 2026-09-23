-- mark-33-episodes-english.sql
-- Purpose: the 33 uploaded first-episode videos in content/series/_video/ contain
-- SPOKEN ENGLISH voiceover (confirmed via faster-whisper: en 90-98% across body/junior/preschool).
-- This marks the existing uploaded rendition as the ENGLISH edition so the player exposes
-- these episodes when the user selects English, unblocking the separate Arabic-dub track later.
-- Idempotent: UPDATE is naturally re-runnable; audio-track INSERTs use OR IGNORE (UNIQUE episode_id,language).
-- Scope: exactly the 33 episodes that already have a role='stream' asset_link with a 1080p video asset.
-- Non-destructive: no deletes; only sets a blank language to 'en' and adds an 'en' audio-track row.

-- 1) Tag the existing stream links as English (only the blank-language ones for these episodes).
UPDATE asset_links
SET language = 'en'
WHERE entity_type = 'episode'
  AND role = 'stream'
  AND (language = '' OR language IS NULL)
  AND asset_id LIKE 'ca-episode-%-1080p';

-- 2) Register a normalized English audio track per episode, pointing at the same uploaded
--    video asset (the audio is muxed inside the 1080p mp4). Default track = English for now.
--    Deterministic id 'eat-<episode_id>-en' keeps this idempotent under OR IGNORE.
INSERT OR IGNORE INTO episode_audio_tracks (id, episode_id, language, asset_id, label, is_default, sort_order, status)
SELECT
  'eat-' || r.episode_id || '-en',
  r.episode_id,
  'en',
  r.asset_id,
  'English',
  1,
  0,
  'ready'
FROM episode_renditions r
WHERE r.label = '1080p'
  AND r.asset_id LIKE 'ca-episode-%-1080p';
