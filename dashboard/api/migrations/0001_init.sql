-- Majarra D1 schema
-- SQLite / Cloudflare D1 implementation for ages 3-12.
-- Birth track derivation and runtime UUID generation are enforced by the API.

PRAGMA foreign_keys = ON;

-- Family accounts -----------------------------------------------------------
CREATE TABLE parents (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'family', 'family_plus')),
  locale TEXT NOT NULL DEFAULT 'ar',
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE children_profiles (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL CHECK (length(trim(nickname)) BETWEEN 1 AND 40),
  birth_month INTEGER NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_year INTEGER NOT NULL CHECK (birth_year BETWEEN 1900 AND 9999),
  age_track TEXT NOT NULL CHECK (age_track IN ('preschool', 'kids', 'junior')),
  avatar_id TEXT NOT NULL,
  interests TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'ar',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  onboarding_completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (parent_id, nickname)
);

-- Free allows one active child; paid family plans allow four.
-- Wrangler's remote D1 migration parser cannot reliably apply CREATE TRIGGER
-- blocks (error 7500). These two constraints are applied idempotently after
-- migrations from scripts/child-profile-limit-triggers.sql.

-- Content taxonomy ----------------------------------------------------------
CREATE TABLE planets (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  color_hex TEXT NOT NULL DEFAULT '#4ECDC4',
  icon_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE learning_objectives (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  measurable_criteria TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE learning_objective_tracks (
  objective_id TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL CHECK (track_id IN ('preschool', 'kids', 'junior')),
  PRIMARY KEY (objective_id, track_id)
);

-- Series network ------------------------------------------------------------
CREATE TABLE series (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  planet_id TEXT NOT NULL REFERENCES planets(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('continuous', 'anthology', 'knowledge', 'presenter', 'standalone')),
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  reading_level TEXT NOT NULL DEFAULT 'emerging' CHECK (reading_level IN ('pre_reader', 'emerging', 'independent')),
  interaction_mode TEXT NOT NULL DEFAULT 'guided' CHECK (interaction_mode IN ('tap', 'guided', 'mixed', 'independent')),
  supervision_level TEXT NOT NULL DEFAULT 'recommended' CHECK (supervision_level IN ('none', 'recommended', 'required')),
  cover_url TEXT,
  logo_url TEXT,
  trailer_url TEXT,
  description_ar TEXT,
  description_en TEXT,
  visual_style TEXT,
  learning_goals TEXT NOT NULL DEFAULT '[]',
  languages TEXT NOT NULL DEFAULT '["ar"]',
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  production_level TEXT NOT NULL DEFAULT 'motion_story' CHECK (production_level IN ('motion_story', 'limited_2d', 'full_2d', 'live', 'stylized_3d')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived')),
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  price_tier TEXT NOT NULL DEFAULT 'family' CHECK (price_tier IN ('free', 'family', 'family_plus')),
  safety_notes TEXT,
  rights_owner TEXT,
  rights_territories TEXT NOT NULL DEFAULT '[]',
  rights_licenses TEXT NOT NULL DEFAULT '[]',
  rights_expiry TEXT,
  bible_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE series_tracks (
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL CHECK (track_id IN ('preschool', 'kids', 'junior')),
  PRIMARY KEY (series_id, track_id)
);

CREATE TABLE seasons (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL CHECK (season_number > 0),
  title_ar TEXT,
  theme_ar TEXT,
  description_ar TEXT,
  episode_count INTEGER NOT NULL DEFAULT 0 CHECK (episode_count >= 0),
  watch_order TEXT NOT NULL DEFAULT 'any' CHECK (watch_order IN ('sequential', 'any')),
  learning_goals TEXT NOT NULL DEFAULT '[]',
  release_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (series_id, season_number)
);

CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  episode_number INTEGER CHECK (episode_number IS NULL OR episode_number > 0),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  video_master_url TEXT,
  video_hls_1080 TEXT,
  video_hls_480 TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  captions_ar_url TEXT,
  dubs TEXT NOT NULL DEFAULT '["ar"]',
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  reading_level TEXT NOT NULL DEFAULT 'emerging' CHECK (reading_level IN ('pre_reader', 'emerging', 'independent')),
  interaction_mode TEXT NOT NULL DEFAULT 'guided' CHECK (interaction_mode IN ('tap', 'guided', 'mixed', 'independent')),
  supervision_level TEXT NOT NULL DEFAULT 'recommended' CHECK (supervision_level IN ('none', 'recommended', 'required')),
  safety_notes TEXT,
  learning_objective_id TEXT REFERENCES learning_objectives(id) ON DELETE SET NULL,
  new_words TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  prerequisites TEXT NOT NULL DEFAULT '[]',
  mastery_criteria TEXT,
  parent_guide_ar TEXT,
  questions TEXT NOT NULL DEFAULT '[]',
  linked_game_id TEXT,
  linked_book_id TEXT,
  printable_url TEXT,
  family_activity_ar TEXT,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived')),
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE episode_tracks (
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  track_id TEXT NOT NULL CHECK (track_id IN ('preschool', 'kids', 'junior')),
  PRIMARY KEY (episode_id, track_id)
);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  role TEXT CHECK (role IN ('hero', 'side', 'villain', 'narrator', 'presenter')),
  age INTEGER,
  description_ar TEXT,
  traits TEXT NOT NULL DEFAULT '[]',
  speech_style TEXT,
  reference_images TEXT NOT NULL DEFAULT '[]',
  expressions TEXT NOT NULL DEFAULT '{}',
  outfits TEXT NOT NULL DEFAULT '[]',
  voice_actor TEXT,
  languages TEXT NOT NULL DEFAULT '["ar"]',
  rights_owner TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  title_ar TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('picture_book', 'audio_story', 'interactive', 'comic')),
  pages TEXT NOT NULL DEFAULT '[]',
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  reading_level TEXT NOT NULL CHECK (reading_level IN ('pre_reader', 'emerging', 'independent')),
  interaction_mode TEXT NOT NULL CHECK (interaction_mode IN ('tap', 'guided', 'mixed', 'independent')),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none', 'recommended', 'required')),
  safety_notes TEXT,
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE game_engines (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  description TEXT,
  mechanics TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  engine_id TEXT NOT NULL REFERENCES game_engines(id) ON DELETE RESTRICT,
  series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  title_ar TEXT NOT NULL,
  learning_objective_id TEXT REFERENCES learning_objectives(id) ON DELETE SET NULL,
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  reading_level TEXT NOT NULL CHECK (reading_level IN ('pre_reader', 'emerging', 'independent')),
  interaction_mode TEXT NOT NULL CHECK (interaction_mode IN ('tap', 'guided', 'mixed', 'independent')),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none', 'recommended', 'required')),
  safety_notes TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  content_pack TEXT NOT NULL DEFAULT '{}',
  instructions_ar TEXT,
  max_attempts INTEGER CHECK (max_attempts IS NULL OR max_attempts > 0),
  help_system TEXT NOT NULL DEFAULT '{}',
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none', 'recommended', 'required')),
  safety_notes TEXT,
  materials TEXT NOT NULL DEFAULT '[]',
  steps TEXT NOT NULL DEFAULT '[]',
  learning_objective_ids TEXT NOT NULL DEFAULT '[]',
  cover_url TEXT,
  is_free INTEGER NOT NULL DEFAULT 0 CHECK (is_free IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

-- Child-specific learning data ---------------------------------------------
CREATE TABLE child_settings (
  child_id TEXT PRIMARY KEY REFERENCES children_profiles(id) ON DELETE CASCADE,
  daily_minutes INTEGER NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 180),
  autoplay INTEGER NOT NULL DEFAULT 0 CHECK (autoplay IN (0, 1)),
  captions_enabled INTEGER NOT NULL DEFAULT 0 CHECK (captions_enabled IN (0, 1)),
  audio_language TEXT NOT NULL DEFAULT 'ar',
  allowed_planets TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE mastery (
  child_id TEXT NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  objective_id TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct_attempts INTEGER NOT NULL DEFAULT 0 CHECK (correct_attempts >= 0),
  last_attempt_at TEXT,
  PRIMARY KEY (child_id, objective_id),
  CHECK (correct_attempts <= attempts)
);

CREATE TABLE watch_progress (
  child_id TEXT NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  completed_at TEXT,
  watch_count INTEGER NOT NULL DEFAULT 1 CHECK (watch_count > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, episode_id)
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
  score INTEGER CHECK (score IS NULL OR score >= 0),
  max_score INTEGER CHECK (max_score IS NULL OR max_score > 0),
  answers TEXT NOT NULL DEFAULT '[]',
  time_spent_seconds INTEGER NOT NULL DEFAULT 0 CHECK (time_spent_seconds >= 0),
  help_used INTEGER NOT NULL DEFAULT 0 CHECK (help_used IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (episode_id IS NOT NULL OR game_id IS NOT NULL),
  CHECK (score IS NULL OR max_score IS NULL OR score <= max_score)
);

CREATE TABLE favorites (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('series', 'episode', 'book', 'game', 'project')),
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (child_id, entity_type, entity_id)
);

CREATE TABLE child_screen_time_daily (
  child_id TEXT NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  activity_date TEXT NOT NULL,
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  played_seconds INTEGER NOT NULL DEFAULT 0 CHECK (played_seconds >= 0),
  read_seconds INTEGER NOT NULL DEFAULT 0 CHECK (read_seconds >= 0),
  PRIMARY KEY (child_id, activity_date)
);

-- Privacy, governance, and admin audit -------------------------------------
CREATE TABLE parental_consents (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('data_collection', 'analytics', 'voice', 'personalization')),
  version TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  ip_address TEXT
);

CREATE TABLE data_requests (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children_profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE TABLE content_rights (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('series', 'episode', 'book', 'game', 'project')),
  entity_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  territories TEXT NOT NULL DEFAULT '[]',
  licenses TEXT NOT NULL DEFAULT '[]',
  expiry TEXT,
  contract_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entity_type, entity_id, owner)
);

CREATE TABLE content_reviews (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('series', 'episode', 'book', 'game', 'project')),
  entity_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('edu', 'lang', 'sharia', 'rights', 'qa')),
  reviewer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'needs_changes')),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Query indexes -------------------------------------------------------------
CREATE INDEX idx_children_parent_status ON children_profiles(parent_id, status);
CREATE INDEX idx_children_track ON children_profiles(age_track);
CREATE INDEX idx_series_planet_status ON series(planet_id, status);
CREATE INDEX idx_series_status_order ON series(status, sort_order);
CREATE INDEX idx_series_tracks_track ON series_tracks(track_id, series_id);
CREATE INDEX idx_episodes_series_status ON episodes(series_id, status);
CREATE INDEX idx_episodes_published ON episodes(is_published, published_at);
CREATE INDEX idx_episode_tracks_track ON episode_tracks(track_id, episode_id);
CREATE INDEX idx_attempts_child_created ON attempts(child_id, created_at);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Canonical launch catalog --------------------------------------------------
INSERT INTO planets (id, name_ar, name_en, color_hex, sort_order) VALUES
  ('abjad', 'أبجد', 'Language', '#FF6B6B', 1),
  ('arqam', 'أرقام', 'Numbers', '#4ECDC4', 2),
  ('oloom', 'علوم', 'Science', '#45B7D1', 3),
  ('qiyam', 'قيم', 'Values', '#96CEB4', 4),
  ('qisas', 'قصص', 'Stories', '#FECA57', 5),
  ('maharat', 'مهارات', 'Skills', '#A29BFE', 6),
  ('tarikh', 'تاريخ', 'History', '#E17055', 7),
  ('alam', 'العالم حولنا', 'Our World', '#00B894', 8);

INSERT INTO skills (id, name_ar, category) VALUES
  ('reading', 'القراءة', 'literacy'),
  ('writing', 'الكتابة', 'literacy'),
  ('counting', 'العد', 'numeracy'),
  ('addition', 'الجمع', 'numeracy'),
  ('observation', 'الملاحظة', 'cognitive'),
  ('memory', 'الذاكرة', 'cognitive'),
  ('honesty', 'الصدق', 'social'),
  ('coding', 'التفكير البرمجي', 'cognitive');

INSERT INTO series (
  id, title_ar, title_en, slug, planet_id, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, description_ar,
  visual_style, difficulty, production_level, status, sort_order
) VALUES
  ('series-preschool-luna-words', 'لونا تكتشف الكلمات', 'Luna Discovers Words', 'luna-discovers-words', 'abjad', 'continuous', 3, 5, 'pre_reader', 'tap', 'none', 'تعلم صوتي بصري للكلمات العربية مع لونا.', 'Soft 2D', 'easy', 'limited_2d', 'draft', 1),
  ('series-preschool-colors', 'ألوان حولنا', 'Colors Around Us', 'colors-around-us', 'alam', 'knowledge', 3, 5, 'pre_reader', 'tap', 'none', 'اكتشاف الألوان في البيئة المحيطة بأنشطة لمسية بسيطة.', 'Soft 2D', 'easy', 'motion_story', 'draft', 2),
  ('series-preschool-count', 'عدّ معي', 'Count With Me', 'count-with-me', 'arqam', 'presenter', 3, 5, 'pre_reader', 'tap', 'recommended', 'مواقف قصيرة تساعد الطفل على العد والتصنيف.', 'Soft 2D', 'easy', 'motion_story', 'draft', 3),
  ('series-preschool-calm-tale', 'حكاية هادئة', 'A Calm Tale', 'a-calm-tale', 'qisas', 'anthology', 3, 5, 'pre_reader', 'tap', 'none', 'قصص قصيرة هادئة بكثافة بصرية وصوتية منخفضة.', 'Painterly 2D', 'easy', 'motion_story', 'draft', 4),

  ('series-kids-wisdom', 'حكاية وحكمة', 'A Tale and Wisdom', 'hekaya-wa-hikma', 'qiyam', 'anthology', 6, 8, 'emerging', 'guided', 'recommended', 'حكايات مستقلة تربط المواقف اليومية بقيم قابلة للتطبيق.', 'Watercolor Motion Story', 'easy', 'motion_story', 'draft', 5),
  ('series-kids-numbers', 'مغامرات الأرقام', 'Adventures of Numbers', 'adventures-of-numbers', 'arqam', 'continuous', 6, 8, 'emerging', 'guided', 'recommended', 'تخوض نوما وعدّاد مغامرات في العد والأنماط والأشكال.', 'Limited 2D', 'medium', 'limited_2d', 'draft', 6),
  ('series-kids-body', 'اكتشف جسمك', 'Discover Your Body', 'discover-your-body', 'oloom', 'knowledge', 6, 8, 'emerging', 'guided', 'recommended', 'شرح آمن ومبسط لأعضاء الجسم والحواس.', 'Cinematic Infographic', 'medium', 'stylized_3d', 'draft', 7),
  ('series-kids-bedtime', 'حكايات قبل النوم', 'Bedtime Stories', 'bedtime-stories', 'qisas', 'anthology', 6, 8, 'emerging', 'guided', 'none', 'قصص عربية مطمئنة قبل النوم بلا إثارة زائدة.', 'Painterly Storybook', 'easy', 'motion_story', 'draft', 8),
  ('series-kids-home', 'جرّب في البيت', 'Try It at Home', 'try-it-at-home', 'oloom', 'presenter', 6, 8, 'emerging', 'mixed', 'required', 'تجارب منزلية آمنة تقدمها سلمى بمشاركة ولي الأمر.', 'Family Program', 'medium', 'live', 'draft', 9),
  ('series-kids-explorers', 'مغامرات المستكشفين', 'Explorers Adventures', 'explorers-adventures', 'alam', 'continuous', 6, 8, 'emerging', 'guided', 'recommended', 'مغامرات زينة وياسين لاكتشاف العالم وحل المشكلات.', 'Adventure 2D', 'medium', 'limited_2d', 'draft', 10),

  ('series-junior-future-lab', 'مختبر المستقبل', 'Future Lab', 'future-lab', 'oloom', 'knowledge', 9, 12, 'independent', 'independent', 'recommended', 'علوم ومشروعات متعددة الخطوات للروّاد.', 'Stylized 3D', 'hard', 'stylized_3d', 'draft', 11),
  ('series-junior-robo-codes', 'روبو يبرمج', 'Robo Codes', 'robo-codes', 'maharat', 'continuous', 9, 12, 'independent', 'independent', 'none', 'تحديات برمجة ومنطق يقودها روبو تدريجيًا.', 'Tech 2D', 'hard', 'limited_2d', 'draft', 12),
  ('series-junior-civilizations', 'رحلة الحضارات', 'Journey of Civilizations', 'journey-of-civilizations', 'tarikh', 'knowledge', 9, 12, 'independent', 'independent', 'none', 'رحلات معرفية موثوقة إلى حضارات ومحطات تاريخية.', 'Cinematic Infographic', 'medium', 'stylized_3d', 'draft', 13),
  ('series-junior-science-minute', 'علوم في دقيقة', 'Science in a Minute', 'science-in-a-minute', 'oloom', 'presenter', 9, 12, 'independent', 'independent', 'none', 'مفاهيم علمية مركزة بلغة واضحة ومصطلحات مشروحة.', 'Motion Graphics', 'medium', 'motion_story', 'draft', 14);

INSERT INTO series_tracks (series_id, track_id)
SELECT id,
  CASE
    WHEN age_max <= 5 THEN 'preschool'
    WHEN age_max <= 8 THEN 'kids'
    ELSE 'junior'
  END
FROM series;
