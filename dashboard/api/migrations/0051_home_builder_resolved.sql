-- Home Builder authoritative resolved Home
-- Expands block_type enum, adds targeting/scheduling columns, seeds system/editorial blocks

-- Rebuild table to expand CHECK constraint
CREATE TABLE home_experience_blocks_new (
  id TEXT PRIMARY KEY,
  block_type TEXT NOT NULL CHECK (block_type IN (
    'hero_slider','content_rail','planet_orbit','feature_banner','learning_journey','audio_rail','character_orbit','seasonal_banner','welcome','coming_soon','watch_free','new_releases','most_watched',
    'continue_watching','continue_drawing','explore_majarra','creative_studio','new_episodes','recently_added','games','stories','audio','recommended','because_you_watched','seasonal'
  )),
  title_ar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 99,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_draft INTEGER NOT NULL DEFAULT 0,
  scheduled_at TEXT,
  expires_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  targeting_json TEXT NOT NULL DEFAULT '{}',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO home_experience_blocks_new (id, block_type, title_ar, sort_order, is_active, targeting_json, config_json, created_at, updated_at)
  SELECT id, block_type, title_ar, sort_order, is_active, targeting_json, config_json, created_at, updated_at FROM home_experience_blocks;

DROP TABLE home_experience_blocks;
ALTER TABLE home_experience_blocks_new RENAME TO home_experience_blocks;

-- Version history for rollback
CREATE TABLE IF NOT EXISTS home_experience_versions (
  id TEXT PRIMARY KEY,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed canonical system/editorial blocks (idempotent)
INSERT OR IGNORE INTO home_experience_blocks (id, block_type, title_ar, sort_order, is_active, is_draft, targeting_json, config_json) VALUES
  ('block-continue-watching', 'continue_watching', 'أكمل ما بدأت', 1, 1, 0, '{}', '{"system":true}'),
  ('block-explore', 'explore_majarra', 'استكشف مجرة', 2, 1, 0, '{}', '{"system":true}'),
  ('block-creative', 'creative_studio', 'استوديو الإبداع', 3, 1, 0, '{}', '{"system":true}'),
  ('block-continue-drawing', 'continue_drawing', 'أكمل رسمتك', 4, 1, 0, '{}', '{"system":true}'),
  ('block-games', 'games', 'العب الآن', 5, 1, 0, '{}', '{"card_style":"square","maxItems":6}'),
  ('block-stories', 'stories', 'حكايات وقصص', 6, 1, 0, '{}', '{"card_style":"story","maxItems":6}'),
  ('block-planets', 'planet_orbit', 'استكشف الكواكب', 7, 1, 0, '{}', '{}'),
  ('block-new-episodes', 'new_episodes', 'حلقات جديدة', 8, 1, 0, '{}', '{"freshnessDays":14}'),
  ('block-recently', 'recently_added', 'جديد في مجرة', 9, 1, 0, '{}', '{}'),
  ('block-recommended', 'recommended', 'اخترنا لك', 10, 1, 0, '{}', '{"system":true}');

-- Example editorial seasonal demo (scheduled)
INSERT OR IGNORE INTO home_experience_blocks (id, block_type, title_ar, sort_order, is_active, is_draft, scheduled_at, expires_at, targeting_json, config_json) VALUES
  ('block-seasonal-winter', 'seasonal', 'موسم الشتاء', 90, 1, 0, '2026-12-01T00:00:00Z', '2027-02-28T23:59:59Z', '{"season":"winter"}', '{"bannerAsset":"assets/images/seasonal/winter.webp"}');
