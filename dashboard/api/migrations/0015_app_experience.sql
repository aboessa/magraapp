-- مركز بناء الصفحة الرئيسية والتطبيق + الحقوق + Remote Config

CREATE TABLE IF NOT EXISTS home_experience_blocks (
  id TEXT PRIMARY KEY,
  block_type TEXT NOT NULL CHECK (block_type IN ('hero_slider','content_rail','planet_orbit','feature_banner','learning_journey','audio_rail','character_orbit','seasonal_banner','welcome','coming_soon','watch_free','new_releases','most_watched')),
  title_ar TEXT,
  sort_order INTEGER NOT NULL DEFAULT 99,
  is_active INTEGER NOT NULL DEFAULT 1,
  targeting_json TEXT NOT NULL DEFAULT '{}',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS remote_config (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  rollout_percent INTEGER NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  targeting_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rights_licenses (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  license_type TEXT NOT NULL DEFAULT 'exclusive',
  countries TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '[]',
  devices TEXT NOT NULL DEFAULT '[]',
  expiry_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  targeting_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO home_experience_blocks (id, block_type, title_ar, sort_order, targeting_json, config_json) VALUES
('block-hero', 'hero_slider', 'الهيرو', 0, '{}', '{"maxItems":5}'),
('block-worlds', 'planet_orbit', 'الكواكب', 1, '{}', '{}'),
('block-coming-soon', 'coming_soon', 'قريباً', 2, '{}', '{}'),
('block-watch-free', 'watch_free', 'شاهد مجاناً', 3, '{}', '{}');

INSERT OR IGNORE INTO remote_config (key, value_json) VALUES
('maintenance_message', '"نعمل على تحسين مجرة"'),
('min_app_version', '"1.0.0"'),
('offline_enabled', 'true');
