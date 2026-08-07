-- Majarra content CMS expansion
-- Adds editable taxonomy, reusable visual-style presets, stories/pages and an R2 asset pipeline.
-- Existing launch content and free-text visual_style values remain unchanged.

PRAGMA foreign_keys = ON;

CREATE TABLE visual_styles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  medium TEXT NOT NULL CHECK (medium IN ('2d', '3d', 'mixed', 'stop_motion', 'live', 'graphic')),
  description_ar TEXT,
  prompt_fragment TEXT NOT NULL,
  negative_prompt TEXT,
  production_level TEXT NOT NULL DEFAULT 'motion_story' CHECK (production_level IN ('motion_story', 'limited_2d', 'full_2d', 'live', 'stylized_3d')),
  age_tracks TEXT NOT NULL DEFAULT '["preschool","kids","junior"]',
  source_reference TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  color_hex TEXT NOT NULL DEFAULT '#4ECDC4',
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE series_categories (
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  PRIMARY KEY (series_id, category_id)
);

CREATE TABLE content_assets (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'video', 'subtitle', 'document', 'manifest', 'archive')),
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('catalog', 'upload', 'generated', 'import')),
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'uploading', 'processing', 'ready', 'failed', 'archived')),
  original_filename TEXT,
  expected_path TEXT UNIQUE,
  r2_key TEXT UNIQUE,
  bucket TEXT CHECK (bucket IS NULL OR bucket IN ('media', 'thumbs')),
  mime_type TEXT,
  size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  checksum_sha256 TEXT,
  etag TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  language TEXT,
  quality TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  expected_width INTEGER CHECK (expected_width IS NULL OR expected_width > 0),
  expected_height INTEGER CHECK (expected_height IS NULL OR expected_height > 0),
  aspect_ratio TEXT,
  prompt TEXT,
  visual_style_id TEXT REFERENCES visual_styles(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE asset_links (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('landing', 'planet', 'category', 'series', 'season', 'episode', 'character', 'story', 'story_page', 'game', 'project')),
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (asset_id, entity_type, entity_id, role, language)
);

CREATE TABLE asset_uploads (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  upload_id TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('media', 'thumbs')),
  r2_key TEXT NOT NULL,
  expected_size INTEGER NOT NULL CHECK (expected_size > 0),
  link_entity_type TEXT,
  link_entity_id TEXT,
  link_role TEXT,
  link_language TEXT,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'completed', 'aborted', 'failed')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE asset_upload_parts (
  upload_session_id TEXT NOT NULL REFERENCES asset_uploads(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL CHECK (part_number BETWEEN 1 AND 10000),
  etag TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (upload_session_id, part_number)
);

CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description_ar TEXT,
  description_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('picture_book', 'audio_story', 'interactive', 'comic')),
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  reading_level TEXT NOT NULL DEFAULT 'emerging' CHECK (reading_level IN ('pre_reader', 'emerging', 'independent')),
  interaction_mode TEXT NOT NULL DEFAULT 'guided' CHECK (interaction_mode IN ('tap', 'guided', 'mixed', 'independent')),
  supervision_level TEXT NOT NULL DEFAULT 'recommended' CHECK (supervision_level IN ('none', 'recommended', 'required')),
  visual_style_id TEXT REFERENCES visual_styles(id) ON DELETE SET NULL,
  default_language TEXT NOT NULL DEFAULT 'ar',
  languages TEXT NOT NULL DEFAULT '["ar"]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived')),
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  price_tier TEXT NOT NULL DEFAULT 'family' CHECK (price_tier IN ('free', 'family', 'family_plus')),
  safety_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE story_pages (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  layout TEXT NOT NULL DEFAULT 'full_bleed' CHECK (layout IN ('full_bleed', 'split', 'panels', 'text_focus')),
  image_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  background_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms > 0),
  transition TEXT NOT NULL DEFAULT 'fade',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (story_id, page_number)
);

CREATE TABLE story_page_localizations (
  page_id TEXT NOT NULL REFERENCES story_pages(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  body_text TEXT,
  alt_text TEXT,
  narration_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  timing_cues TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (page_id, language)
);

CREATE TABLE story_bubbles (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES story_pages(id) ON DELETE CASCADE,
  character_id TEXT REFERENCES characters(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'dialogue' CHECK (kind IN ('dialogue', 'thought', 'caption', 'sound')),
  position_x REAL NOT NULL DEFAULT 0 CHECK (position_x BETWEEN 0 AND 100),
  position_y REAL NOT NULL DEFAULT 0 CHECK (position_y BETWEEN 0 AND 100),
  width REAL NOT NULL DEFAULT 30 CHECK (width > 0 AND width <= 100),
  height REAL NOT NULL DEFAULT 20 CHECK (height > 0 AND height <= 100),
  localized_text TEXT NOT NULL DEFAULT '{}',
  audio_tracks TEXT NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE series ADD COLUMN visual_style_id TEXT REFERENCES visual_styles(id) ON DELETE SET NULL;
ALTER TABLE seasons ADD COLUMN status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived'));
ALTER TABLE characters ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived'));

CREATE INDEX idx_categories_active_order ON categories(is_active, sort_order);
CREATE INDEX idx_series_categories_category ON series_categories(category_id, series_id);
CREATE INDEX idx_assets_status_kind ON content_assets(status, kind);
CREATE INDEX idx_assets_expected_path ON content_assets(expected_path);
CREATE INDEX idx_asset_links_entity ON asset_links(entity_type, entity_id, role);
CREATE INDEX idx_asset_uploads_status ON asset_uploads(status, expires_at);
CREATE INDEX idx_stories_status_order ON stories(status, sort_order);
CREATE INDEX idx_stories_series ON stories(series_id, status);
CREATE INDEX idx_story_pages_story_order ON story_pages(story_id, page_number);
CREATE INDEX idx_story_bubbles_page_order ON story_bubbles(page_id, sort_order);

-- Original, reusable style presets. Brand-name imitation is deliberately avoided.
INSERT INTO visual_styles (id, slug, name_ar, name_en, medium, description_ar, prompt_fragment, negative_prompt, production_level, age_tracks, source_reference) VALUES
  ('style-soft-2d', 'soft-2d', 'رسوم ثنائية ناعمة', 'Soft 2D', '2d', 'أشكال كبيرة وتفاصيل هادئة مناسبة للمحتوى المبكر.', 'original soft 2D children illustration, rounded shapes, calm expressions, clean silhouettes, gentle cinematic depth', 'brand imitation, famous characters, visual clutter, harsh shadows', 'limited_2d', '["preschool","kids"]', 'Majarra launch plan'),
  ('style-limited-2d', 'limited-2d', 'تحريك ثنائي محدود', 'Limited 2D', '2d', 'شخصيات ثابتة وبيئات قابلة لإعادة الاستخدام.', 'premium original limited 2D animation key art, production-ready character consistency, layered reusable background', 'brand imitation, inconsistent character proportions, excessive detail', 'limited_2d', '["kids","junior"]', 'Majarra launch plan'),
  ('style-watercolor', 'watercolor-motion-story', 'حكاية مائية دافئة', 'Watercolor Motion Story', '2d', 'ألوان مائية دافئة للحكايات والقيم.', 'original warm watercolor storybook illustration, subtle paper texture, expressive Arab characters, cinematic composition', 'copied book illustration, muddy colors, illegible details', 'motion_story', '["preschool","kids"]', 'Majarra launch plan'),
  ('style-painterly', 'painterly-storybook', 'كتاب قصصي مرسوم', 'Painterly Storybook', '2d', 'مشاهد مرسومة بإضاءة مطمئنة للقصص الهادئة.', 'original painterly storybook scene, tactile brushwork, calm premium lighting, clear child-safe focal point', 'famous illustration style, horror, dark mood, clutter', 'motion_story', '["preschool","kids"]', 'Majarra launch plan'),
  ('style-adventure-2d', 'adventure-2d', 'مغامرة ثنائية', 'Adventure 2D', '2d', 'تكوين ديناميكي مضبوط للمغامرات التعليمية.', 'original cinematic 2D educational adventure, dynamic but readable staging, expressive team action, controlled detail', 'franchise imitation, weapons, peril, chaotic action', 'limited_2d', '["kids"]', 'Majarra launch plan'),
  ('style-tech-2d', 'tech-2d', 'تقني ثنائي', 'Tech 2D', '2d', 'رسوم تقنية واضحة للبرمجة والمنطق.', 'original clean tech 2D animation, modular shapes, friendly robotics, deep navy interface-free environment', 'existing robot likeness, readable code, excessive neon', 'limited_2d', '["junior"]', 'Majarra launch plan'),
  ('style-motion-graphics', 'motion-graphics', 'موشن جرافيك', 'Motion Graphics', 'graphic', 'أشكال ومخططات متحركة للمفاهيم السريعة.', 'premium original educational motion graphics keyframe, geometric visual explanation, clean hierarchy, no readable text', 'template look, logos, dense interface, unreadable labels', 'motion_story', '["kids","junior"]', 'Majarra launch plan'),
  ('style-infographic', 'cinematic-infographic', 'إنفوجرافيك سينمائي', 'Cinematic Infographic', 'mixed', 'تبسيط علمي بصري بعمق سينمائي آمن.', 'original cinematic educational infographic scene, simplified scientific forms, clear scale, controlled volumetric light', 'medical horror, graphic anatomy, UI text, false labels', 'stylized_3d', '["kids","junior"]', 'Majarra launch plan'),
  ('style-original-3d', 'cinematic-stylized-3d', 'ثلاثي أبعاد سينمائي أصلي', 'Original Cinematic Stylized 3D', '3d', 'ثلاثي أبعاد عائلي عالي الجودة بهوية أصلية، من دون محاكاة استوديو بعينه.', 'premium original stylized 3D family animation, appealing rounded forms, expressive faces, cinematic lighting, unique character design', 'Disney style, Pixar style, DreamWorks style, famous character likeness, studio imitation', 'stylized_3d', '["preschool","kids","junior"]', 'Optional future preset'),
  ('style-felt-puppet', 'felt-puppet', 'عرائس لباد', 'Felt Puppet', 'stop_motion', 'شخصيات مصنوعة من اللباد بخياطة يدوية واضحة وحركة آمنة.', 'original handcrafted felt puppet world, visible soft stitching, tactile wool fibers, miniature practical set, stop-motion lighting', 'existing puppet likeness, television franchise imitation, plastic skin, photoreal child', 'motion_story', '["preschool","kids"]', 'Optional future preset'),
  ('style-cloth-doll', 'cloth-doll', 'دمى قماش', 'Cloth Doll', 'stop_motion', 'دمى قماشية ناعمة في ديكورات مصغرة.', 'original handmade cloth doll characters, woven fabric texture, embroidered facial details, cozy miniature Arab environment', 'existing doll brand, button-eye horror, torn fabric, frightening expression', 'motion_story', '["preschool","kids"]', 'Optional future preset'),
  ('style-puppet-stage', 'puppet-stage', 'مسرح عرائس', 'Puppet Stage', 'stop_motion', 'مسرح عرائس أصلي للمواقف التعليمية والحوار.', 'original educational puppet theatre, handcrafted foam and fabric puppets, warm stage lighting, culturally grounded miniature set', 'famous puppet show likeness, visible operators, horror puppet, copied characters', 'live', '["preschool","kids"]', 'Optional future preset'),
  ('style-clay-stop-motion', 'clay-stop-motion', 'صلصال بإيقاف الحركة', 'Clay Stop Motion', 'stop_motion', 'مجسمات صلصال أصلية بحركة إطار بإطار.', 'original clay stop-motion educational scene, handcrafted fingerprints, charming simplified forms, practical miniature lighting', 'existing clay franchise likeness, melting anatomy, horror, copied characters', 'motion_story', '["preschool","kids","junior"]', 'Optional future preset'),
  ('style-paper-cutout', 'paper-cutout', 'قصاصات ورقية', 'Paper Cutout', 'stop_motion', 'طبقات ورقية وقصاصات مناسبة للحكايات والتاريخ.', 'original layered paper cutout animation, tactile card stock, elegant depth shadows, handcrafted educational composition', 'copied paper artist style, readable text, flat template look', 'motion_story', '["preschool","kids","junior"]', 'Optional future preset'),
  ('style-family-live', 'family-live-program', 'برنامج عائلي مصور', 'Family Live Program', 'live', 'تصوير حي آمن للتجارب والأنشطة المنزلية.', 'premium original Arab family educational program, softly cinematic practical lighting, safe supervised activity, authentic home', 'advertising brand, unsafe experiment, visible trademarks', 'live', '["kids","junior"]', 'Majarra launch plan');

INSERT INTO categories (id, slug, name_ar, name_en, color_hex, sort_order) VALUES
  ('category-language', 'language', 'اللغة والقراءة', 'Language & Literacy', '#FF6B6B', 1),
  ('category-numbers', 'numbers', 'الأرقام والرياضيات', 'Numbers & Math', '#4ECDC4', 2),
  ('category-science', 'science', 'العلوم والاكتشاف', 'Science & Discovery', '#45B7D1', 3),
  ('category-values', 'values', 'القيم والسلوك', 'Values & Character', '#96CEB4', 4),
  ('category-stories', 'stories', 'القصص والحكايات', 'Stories & Tales', '#FECA57', 5),
  ('category-skills', 'skills', 'المهارات والإبداع', 'Skills & Creativity', '#A29BFE', 6),
  ('category-history', 'history', 'التاريخ والحضارات', 'History & Civilizations', '#E17055', 7),
  ('category-world', 'our-world', 'العالم حولنا', 'Our World', '#00B894', 8),
  ('category-faith', 'faith-manners', 'الإيمان والآداب', 'Faith & Manners', '#2FBF8F', 9);

INSERT OR IGNORE INTO planets (id, name_ar, name_en, description_ar, color_hex, sort_order)
VALUES ('islamic', 'الإيمان والآداب', 'Faith & Manners', 'محتوى موثق للقرآن والأذكار والسيرة والعبادات والأخلاق والآداب.', '#2FBF8F', 9);

INSERT INTO series_categories (series_id, category_id, is_primary)
SELECT s.id,
  CASE s.planet_id
    WHEN 'abjad' THEN 'category-language'
    WHEN 'arqam' THEN 'category-numbers'
    WHEN 'oloom' THEN 'category-science'
    WHEN 'qiyam' THEN 'category-values'
    WHEN 'qisas' THEN 'category-stories'
    WHEN 'maharat' THEN 'category-skills'
    WHEN 'tarikh' THEN 'category-history'
    WHEN 'alam' THEN 'category-world'
    WHEN 'islamic' THEN 'category-faith'
  END,
  1
FROM series s
WHERE s.planet_id IN ('abjad', 'arqam', 'oloom', 'qiyam', 'qisas', 'maharat', 'tarikh', 'alam', 'islamic');

UPDATE series SET visual_style_id = 'style-soft-2d' WHERE lower(visual_style) = 'soft 2d';
UPDATE series SET visual_style_id = 'style-limited-2d' WHERE lower(visual_style) = 'limited 2d';
UPDATE series SET visual_style_id = 'style-watercolor' WHERE lower(visual_style) = 'watercolor motion story';
UPDATE series SET visual_style_id = 'style-painterly' WHERE lower(visual_style) IN ('painterly 2d', 'painterly storybook');
UPDATE series SET visual_style_id = 'style-adventure-2d' WHERE lower(visual_style) = 'adventure 2d';
UPDATE series SET visual_style_id = 'style-tech-2d' WHERE lower(visual_style) = 'tech 2d';
UPDATE series SET visual_style_id = 'style-motion-graphics' WHERE lower(visual_style) = 'motion graphics';
UPDATE series SET visual_style_id = 'style-infographic' WHERE lower(visual_style) = 'cinematic infographic';
UPDATE series SET visual_style_id = 'style-original-3d' WHERE lower(visual_style) = 'stylized 3d';
UPDATE series SET visual_style_id = 'style-family-live' WHERE lower(visual_style) = 'family program';
