-- ============================================================
-- DATABASE V2 - منصة مجرة | أعمار 3–12 وملفات أطفال متعددة
-- PostgreSQL / Supabase conceptual schema
-- المرجع: AGE_EXPERIENCE_PLAN_3_12.md
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE age_track AS ENUM ('preschool', 'kids', 'junior');
CREATE TYPE subscription_plan AS ENUM ('free', 'family', 'family_plus');
CREATE TYPE content_entity_type AS ENUM ('series', 'episode', 'book', 'game', 'project');

-- حساب ولي الأمر. id يطابق auth.users.id في Supabase.
CREATE TABLE parents (
  id UUID PRIMARY KEY,
  display_name TEXT,
  plan subscription_plan NOT NULL DEFAULT 'free',
  locale TEXT NOT NULL DEFAULT 'ar',
  timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- يحسب العمر والمسار على الخادم؛ لا يقبل age_track من العميل كمصدر حقيقة.
-- بما أننا نخزن شهر/سنة فقط، يحدث الانتقال في أول يوم من شهر الميلاد.
CREATE OR REPLACE FUNCTION derive_age_track(
  p_birth_month SMALLINT,
  p_birth_year SMALLINT,
  p_reference_date DATE DEFAULT CURRENT_DATE
) RETURNS age_track
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_age INTEGER;
BEGIN
  IF p_birth_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'birth_month must be between 1 and 12';
  END IF;
  IF p_birth_year NOT BETWEEN 1900 AND EXTRACT(YEAR FROM p_reference_date)::INTEGER THEN
    RAISE EXCEPTION 'birth_year is invalid';
  END IF;

  v_age := EXTRACT(YEAR FROM AGE(
    p_reference_date,
    MAKE_DATE(p_birth_year, p_birth_month, 1)
  ))::INTEGER;

  IF v_age BETWEEN 3 AND 5 THEN RETURN 'preschool'; END IF;
  IF v_age BETWEEN 6 AND 8 THEN RETURN 'kids'; END IF;
  IF v_age BETWEEN 9 AND 12 THEN RETURN 'junior'; END IF;
  RAISE EXCEPTION 'Majarra supports children aged 3–12; calculated age: %', v_age;
END;
$$;

CREATE TABLE children_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL CHECK (char_length(trim(nickname)) BETWEEN 1 AND 40),
  birth_month SMALLINT NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_year SMALLINT NOT NULL,
  age_track age_track NOT NULL,
  avatar_id TEXT NOT NULL,
  interests TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  language TEXT NOT NULL DEFAULT 'ar',
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, nickname)
);

CREATE OR REPLACE FUNCTION set_child_age_track()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.age_track := derive_age_track(NEW.birth_month, NEW.birth_year, CURRENT_DATE);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER children_profiles_set_age_track
BEFORE INSERT OR UPDATE OF birth_month, birth_year
ON children_profiles
FOR EACH ROW EXECUTE FUNCTION set_child_age_track();

-- يمنع تجاوز طفل واحد في Free وأربعة في Family / Family Plus داخل transaction واحدة.
CREATE OR REPLACE FUNCTION enforce_children_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 0));
  SELECT plan INTO v_plan FROM parents WHERE id = NEW.parent_id FOR UPDATE;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;

  v_limit := CASE WHEN v_plan = 'free' THEN 1 ELSE 4 END;
  SELECT count(*) INTO v_count
  FROM children_profiles
  WHERE parent_id = NEW.parent_id AND id <> NEW.id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'child profile limit reached for plan % (maximum %)', v_plan, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER children_profiles_enforce_limit
BEFORE INSERT OR UPDATE OF parent_id
ON children_profiles
FOR EACH ROW EXECUTE FUNCTION enforce_children_limit();

-- تستدعيها مهمة يومية أو عملية تسجيل الدخول لتحديث انتقال 5→6 و8→9.
CREATE OR REPLACE FUNCTION refresh_child_age_tracks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE children_profiles
  SET age_track = derive_age_track(birth_month, birth_year, CURRENT_DATE),
      updated_at = NOW()
  WHERE age_track IS DISTINCT FROM derive_age_track(birth_month, birth_year, CURRENT_DATE);
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- 1. العوالم/التصنيفات
CREATE TABLE planets (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  description_ar TEXT,
  color_hex TEXT DEFAULT '#4ECDC4',
  icon_url TEXT,
  sort_order INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Taxonomy المهارات والأهداف
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE learning_objectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  skill_id TEXT REFERENCES skills(id),
  age_min SMALLINT NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max SMALLINT NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  track_ids age_track[] NOT NULL,
  measurable_criteria TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_max >= age_min),
  CHECK (cardinality(track_ids) > 0)
);

-- 3. السلاسل والمواسم والحلقات
CREATE TABLE series (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  slug TEXT UNIQUE NOT NULL,
  planet_id TEXT REFERENCES planets(id),
  type TEXT NOT NULL CHECK (type IN ('continuous','anthology','knowledge','presenter','standalone')),
  age_min SMALLINT NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max SMALLINT NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  track_ids age_track[] NOT NULL,
  reading_level TEXT CHECK (reading_level IN ('pre_reader','emerging','independent')),
  interaction_mode TEXT NOT NULL CHECK (interaction_mode IN ('tap','guided','mixed','independent')),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none','recommended','required')),
  cover_url TEXT,
  logo_url TEXT,
  trailer_url TEXT,
  description_ar TEXT,
  description_en TEXT,
  visual_style TEXT,
  learning_goals UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  languages TEXT[] NOT NULL DEFAULT ARRAY['ar'],
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  production_level TEXT CHECK (production_level IN ('motion_story','limited_2d','full_2d','live')),
  status TEXT NOT NULL CHECK (status IN ('draft','writing','review_edu','review_lang','review_sharia','production','qa','ready','scheduled','published','archived')) DEFAULT 'draft',
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  price_tier subscription_plan NOT NULL DEFAULT 'family',
  safety_notes TEXT,
  rights_owner TEXT,
  rights_territories TEXT[],
  rights_licenses TEXT[],
  rights_expiry DATE,
  bible_url TEXT,
  sort_order INTEGER,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_max >= age_min),
  CHECK (cardinality(track_ids) > 0)
);

CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL CHECK (season_number > 0),
  title_ar TEXT,
  theme_ar TEXT,
  description_ar TEXT,
  episode_count INTEGER CHECK (episode_count >= 0),
  watch_order TEXT NOT NULL CHECK (watch_order IN ('sequential','any')) DEFAULT 'any',
  learning_goals UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  release_date DATE,
  UNIQUE(series_id, season_number)
);

CREATE TABLE episodes (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season_id UUID REFERENCES seasons(id) ON DELETE SET NULL,
  episode_number INTEGER CHECK (episode_number > 0),
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  video_master_url TEXT,
  video_hls_1080 TEXT,
  video_hls_480 TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER CHECK (duration_seconds > 0),
  captions_ar_url TEXT,
  dubs TEXT[] NOT NULL DEFAULT ARRAY['ar'],
  age_min SMALLINT NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max SMALLINT NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  track_ids age_track[] NOT NULL,
  reading_level TEXT CHECK (reading_level IN ('pre_reader','emerging','independent')),
  interaction_mode TEXT NOT NULL CHECK (interaction_mode IN ('tap','guided','mixed','independent')),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none','recommended','required')),
  safety_notes TEXT,
  learning_objective_id UUID REFERENCES learning_objectives(id),
  new_words TEXT[],
  skills TEXT[],
  prerequisites UUID[],
  mastery_criteria TEXT,
  parent_guide_ar TEXT,
  questions JSONB,
  linked_game_id TEXT,
  linked_book_id TEXT,
  printable_url TEXT,
  family_activity_ar TEXT,
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard')),
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_max >= age_min),
  CHECK (cardinality(track_ids) > 0)
);

CREATE TABLE characters (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  role TEXT CHECK (role IN ('hero','side','villain','narrator','presenter')),
  age INTEGER,
  description_ar TEXT,
  traits TEXT[],
  speech_style TEXT,
  reference_images TEXT[],
  expressions JSONB,
  outfits TEXT[],
  voice_actor TEXT,
  languages TEXT[],
  rights_owner TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. الكتب والألعاب والمشروعات
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  title_ar TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('picture_book','audio_story','interactive','comic')),
  pages JSONB,
  age_min SMALLINT NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max SMALLINT NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  track_ids age_track[] NOT NULL,
  reading_level TEXT NOT NULL CHECK (reading_level IN ('pre_reader','emerging','independent')),
  interaction_mode TEXT NOT NULL CHECK (interaction_mode IN ('tap','guided','mixed','independent')),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none','recommended','required')),
  safety_notes TEXT,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_max >= age_min),
  CHECK (cardinality(track_ids) > 0)
);

CREATE TABLE game_engines (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  description TEXT,
  mechanics TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  engine_id TEXT NOT NULL REFERENCES game_engines(id),
  series_id TEXT REFERENCES series(id) ON DELETE SET NULL,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  title_ar TEXT NOT NULL,
  learning_objective_id UUID REFERENCES learning_objectives(id),
  age_min SMALLINT NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max SMALLINT NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  track_ids age_track[] NOT NULL,
  reading_level TEXT NOT NULL CHECK (reading_level IN ('pre_reader','emerging','independent')),
  interaction_mode TEXT NOT NULL CHECK (interaction_mode IN ('tap','guided','mixed','independent')),
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none','recommended','required')),
  safety_notes TEXT,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard')),
  content_pack JSONB NOT NULL,
  instructions_ar TEXT,
  max_attempts INTEGER CHECK (max_attempts > 0),
  help_system JSONB,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_max >= age_min),
  CHECK (cardinality(track_ids) > 0)
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  description_ar TEXT,
  age_min SMALLINT NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max SMALLINT NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  track_ids age_track[] NOT NULL,
  supervision_level TEXT NOT NULL CHECK (supervision_level IN ('none','recommended','required')),
  safety_notes TEXT,
  materials JSONB,
  steps JSONB NOT NULL,
  learning_objective_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  cover_url TEXT,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (age_max >= age_min),
  CHECK (cardinality(track_ids) > 0)
);

-- 5. كل بيانات التجربة التالية معزولة إلزاميًا بواسطة child_id.
CREATE TABLE child_settings (
  child_id UUID PRIMARY KEY REFERENCES children_profiles(id) ON DELETE CASCADE,
  daily_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 180),
  autoplay BOOLEAN NOT NULL DEFAULT FALSE,
  captions_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  audio_language TEXT NOT NULL DEFAULT 'ar',
  allowed_planets TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mastery (
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  objective_id UUID NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('not_started','introduced','practicing','assisted','independent','needs_review')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  correct_attempts INTEGER NOT NULL DEFAULT 0 CHECK (correct_attempts >= 0),
  last_attempt_at TIMESTAMPTZ,
  PRIMARY KEY (child_id, objective_id),
  CHECK (correct_attempts <= attempts)
);

CREATE TABLE watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  progress_seconds INTEGER NOT NULL DEFAULT 0 CHECK (progress_seconds >= 0),
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  watch_count INTEGER NOT NULL DEFAULT 1 CHECK (watch_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, episode_id)
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
  score INTEGER CHECK (score >= 0),
  max_score INTEGER CHECK (max_score > 0),
  answers JSONB,
  time_spent_seconds INTEGER CHECK (time_spent_seconds >= 0),
  help_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (episode_id IS NOT NULL OR game_id IS NOT NULL),
  CHECK (score IS NULL OR max_score IS NULL OR score <= max_score)
);

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, entity_type, entity_id)
);

CREATE TABLE child_watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  title_ar TEXT NOT NULL,
  created_by_parent UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(id, child_id)
);

CREATE TABLE child_watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL,
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (watchlist_id, child_id) REFERENCES child_watchlists(id, child_id) ON DELETE CASCADE,
  UNIQUE(watchlist_id, entity_type, entity_id)
);

CREATE TABLE child_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','downloading','ready','expired','failed')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, entity_type, entity_id, device_id)
);

CREATE TABLE child_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, period_start, period_end),
  CHECK (period_end >= period_start)
);

CREATE TABLE child_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  rank_score NUMERIC(8,5) NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(child_id, entity_type, entity_id)
);

CREATE TABLE child_reward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  reward_code TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, reward_code, source_type, source_id)
);

CREATE TABLE child_screen_time_daily (
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  watched_seconds INTEGER NOT NULL DEFAULT 0 CHECK (watched_seconds >= 0),
  played_seconds INTEGER NOT NULL DEFAULT 0 CHECK (played_seconds >= 0),
  read_seconds INTEGER NOT NULL DEFAULT 0 CHECK (read_seconds >= 0),
  PRIMARY KEY (child_id, activity_date)
);

-- 6. الموافقات والخصوصية والحقوق
CREATE TABLE parental_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('data_collection','analytics','voice','personalization')),
  version TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_address INET
);

CREATE TABLE data_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children_profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export','delete')),
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','rejected')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE content_rights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  territories TEXT[],
  licenses TEXT[],
  expiry DATE,
  contract_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, owner)
);

CREATE TABLE content_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('edu','lang','sharia','rights','qa')),
  reviewer_id UUID,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','needs_changes')),
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. RLS: ولي الأمر لا يصل إلا إلى حسابه وأطفاله وبياناتهم.
CREATE OR REPLACE FUNCTION parent_owns_child(p_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM children_profiles
    WHERE id = p_child_id AND parent_id = auth.uid()
  );
$$;

ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE children_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_reward_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_screen_time_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE parental_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY parents_self ON parents
FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY children_profiles_parent ON children_profiles
FOR ALL USING (parent_id = auth.uid()) WITH CHECK (parent_id = auth.uid());

CREATE POLICY child_settings_parent ON child_settings
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY mastery_parent ON mastery
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY watch_progress_parent ON watch_progress
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY attempts_parent ON attempts
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY favorites_parent ON favorites
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY child_watchlists_parent ON child_watchlists
FOR ALL USING (parent_owns_child(child_id))
WITH CHECK (parent_owns_child(child_id) AND created_by_parent = auth.uid());
CREATE POLICY child_watchlist_items_parent ON child_watchlist_items
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY child_downloads_parent ON child_downloads
FOR ALL USING (parent_owns_child(child_id)) WITH CHECK (parent_owns_child(child_id));
CREATE POLICY child_reports_parent ON child_reports
FOR SELECT USING (parent_owns_child(child_id));
CREATE POLICY child_recommendations_parent ON child_recommendations
FOR SELECT USING (parent_owns_child(child_id));
CREATE POLICY child_reward_events_parent ON child_reward_events
FOR SELECT USING (parent_owns_child(child_id));
CREATE POLICY child_screen_time_parent ON child_screen_time_daily
FOR SELECT USING (parent_owns_child(child_id));
CREATE POLICY parental_consents_parent ON parental_consents
FOR ALL USING (parent_id = auth.uid())
WITH CHECK (parent_id = auth.uid() AND (child_id IS NULL OR parent_owns_child(child_id)));
CREATE POLICY data_requests_parent ON data_requests
FOR ALL USING (parent_id = auth.uid())
WITH CHECK (parent_id = auth.uid() AND (child_id IS NULL OR parent_owns_child(child_id)));

-- فهارس الاستعلامات حسب الطفل والمسار
CREATE INDEX idx_children_profiles_parent ON children_profiles(parent_id);
CREATE INDEX idx_children_profiles_track ON children_profiles(age_track);
CREATE INDEX idx_series_tracks ON series USING GIN(track_ids);
CREATE INDEX idx_episodes_tracks ON episodes USING GIN(track_ids);
CREATE INDEX idx_books_tracks ON books USING GIN(track_ids);
CREATE INDEX idx_games_tracks ON games USING GIN(track_ids);
CREATE INDEX idx_attempts_child_created ON attempts(child_id, created_at DESC);
CREATE INDEX idx_reports_child_period ON child_reports(child_id, period_end DESC);
CREATE INDEX idx_recommendations_child_rank ON child_recommendations(child_id, rank_score DESC);

-- بيانات أولية
INSERT INTO planets (id, name_ar, color_hex, sort_order) VALUES
('abjad', 'أبجد', '#FF6B6B', 1),
('arqam', 'أرقام', '#4ECDC4', 2),
('oloom', 'علوم', '#45B7D1', 3),
('qiyam', 'قيم', '#96CEB4', 4),
('qisas', 'قصص', '#FECA57', 5),
('maharat', 'مهارات', '#A29BFE', 6),
('tarikh', 'تاريخ', '#E17055', 7),
('alam', 'العالم حولنا', '#00B894', 8);

INSERT INTO skills (id, name_ar, category) VALUES
('reading', 'القراءة', 'literacy'),
('writing', 'الكتابة', 'literacy'),
('counting', 'العد', 'numeracy'),
('addition', 'الجمع', 'numeracy'),
('observation', 'الملاحظة', 'cognitive'),
('memory', 'الذاكرة', 'cognitive'),
('honesty', 'الصدق', 'social');

-- معايير تحقق التنفيذ قبل اعتماد migration:
-- أعمار 3/5 => preschool، 6/8 => kids، 9/12 => junior، ورفض 2 و13.
-- لا يستطيع parent قراءة/تعديل child_id تابع لحساب آخر.
-- الانتقال 5→6 و8→9 يغير age_track فقط ولا يحذف أي تقدم أو تقرير.
-- حذف طفل يحذف كل بياناته المعزولة عبر ON DELETE CASCADE.

-- 8. استحقاقات الأجهزة والتشغيل والتراخيص
-- حدود ملفات الأطفال مستقلة عن حدود الأجهزة والتشغيل والتنزيل.
CREATE TYPE device_platform AS ENUM ('android', 'ios', 'ipados', 'android_tv', 'tvos', 'web', 'other_tv', 'other');
CREATE TYPE device_registration_status AS ENUM ('active', 'revoked');
CREATE TYPE playback_session_status AS ENUM ('active', 'ended', 'expired', 'revoked');
CREATE TYPE media_license_kind AS ENUM ('online', 'offline');
CREATE TYPE media_license_status AS ENUM ('active', 'expired', 'revoked');

CREATE TABLE subscription_plan_limits (
  plan subscription_plan PRIMARY KEY,
  max_child_profiles SMALLINT NOT NULL CHECK (max_child_profiles > 0),
  max_registered_devices SMALLINT NOT NULL CHECK (max_registered_devices > 0),
  max_concurrent_streams SMALLINT NOT NULL CHECK (max_concurrent_streams > 0),
  max_download_devices SMALLINT NOT NULL CHECK (max_download_devices >= 0),
  policy_version TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (max_download_devices <= max_registered_devices)
);

INSERT INTO subscription_plan_limits (
  plan, max_child_profiles, max_registered_devices,
  max_concurrent_streams, max_download_devices, policy_version
) VALUES
  ('free', 1, 1, 1, 0, 'devices-v1'),
  ('family', 4, 4, 2, 2, 'devices-v1'),
  ('family_plus', 4, 8, 4, 4, 'devices-v1');

-- id معرف تثبيت opaque يولده الخادم؛ لا يستخدم IMEI أو advertising ID.
CREATE TABLE account_devices (
  id TEXT PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  installation_id_hash TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 80),
  platform device_platform NOT NULL,
  status device_registration_status NOT NULL DEFAULT 'active',
  download_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  secure_playback_capable BOOLEAN NOT NULL DEFAULT FALSE,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (parent_id, installation_id_hash),
  CHECK ((status = 'active' AND revoked_at IS NULL) OR status = 'revoked')
);

CREATE TABLE playback_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES account_devices(id) ON DELETE CASCADE,
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  cast_target BOOLEAN NOT NULL DEFAULT FALSE,
  status playback_session_status NOT NULL DEFAULT 'active',
  session_token_hash TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  CHECK (lease_expires_at > started_at),
  CHECK ((status = 'active' AND ended_at IS NULL) OR status <> 'active')
);

CREATE TABLE media_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children_profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL REFERENCES account_devices(id) ON DELETE CASCADE,
  entity_type content_entity_type NOT NULL,
  entity_id TEXT NOT NULL,
  kind media_license_kind NOT NULL,
  status media_license_status NOT NULL DEFAULT 'active',
  provider_license_hash TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > issued_at),
  CHECK ((status = 'active' AND revoked_at IS NULL) OR status <> 'active')
);

CREATE OR REPLACE FUNCTION enforce_device_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_device_limit SMALLINT;
  v_download_limit SMALLINT;
  v_active_count INTEGER;
  v_download_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 11));
  SELECT p.plan, l.max_registered_devices, l.max_download_devices
  INTO v_plan, v_device_limit, v_download_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
  FOR UPDATE OF p;

  IF v_plan IS NULL THEN RAISE EXCEPTION 'parent or plan limits not found'; END IF;

  SELECT count(*) INTO v_active_count
  FROM account_devices
  WHERE parent_id = NEW.parent_id AND status = 'active' AND id <> NEW.id;
  IF v_active_count >= v_device_limit THEN
    RAISE EXCEPTION 'registered device limit reached for plan % (maximum %)', v_plan, v_device_limit;
  END IF;

  IF NEW.download_enabled THEN
    SELECT count(*) INTO v_download_count
    FROM account_devices
    WHERE parent_id = NEW.parent_id
      AND status = 'active' AND download_enabled = TRUE AND id <> NEW.id;
    IF v_download_count >= v_download_limit THEN
      RAISE EXCEPTION 'download device limit reached for plan % (maximum %)', v_plan, v_download_limit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER account_devices_enforce_plan_limits
BEFORE INSERT OR UPDATE OF parent_id, status, download_enabled
ON account_devices
FOR EACH ROW EXECUTE FUNCTION enforce_device_plan_limits();

CREATE OR REPLACE FUNCTION enforce_playback_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_stream_limit SMALLINT;
  v_active_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 12));

  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id AND parent_id = NEW.parent_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'device is not active for this parent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM children_profiles
    WHERE id = NEW.child_id AND parent_id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'child is not owned by this parent';
  END IF;

  UPDATE playback_sessions
  SET status = 'expired', ended_at = COALESCE(ended_at, NOW())
  WHERE parent_id = NEW.parent_id AND status = 'active' AND lease_expires_at <= NOW();

  SELECT p.plan, l.max_concurrent_streams
  INTO v_plan, v_stream_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
  FOR UPDATE OF p;

  SELECT count(*) INTO v_active_count
  FROM playback_sessions
  WHERE parent_id = NEW.parent_id
    AND status = 'active' AND lease_expires_at > NOW() AND id <> NEW.id;
  IF v_active_count >= v_stream_limit THEN
    RAISE EXCEPTION 'concurrent playback limit reached for plan % (maximum %)', v_plan, v_stream_limit;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER playback_sessions_enforce_plan_limits
BEFORE INSERT OR UPDATE OF parent_id, child_id, device_id, status, lease_expires_at
ON playback_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_playback_plan_limits();

CREATE OR REPLACE FUNCTION enforce_media_license_device()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id
      AND parent_id = NEW.parent_id
      AND status = 'active'
      AND (NEW.kind = 'online' OR download_enabled = TRUE)
  ) THEN
    RAISE EXCEPTION 'device is not eligible for this media license';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM children_profiles
    WHERE id = NEW.child_id AND parent_id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'child is not owned by this parent';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER media_licenses_enforce_device
BEFORE INSERT OR UPDATE OF parent_id, child_id, device_id, kind, status
ON media_licenses
FOR EACH ROW EXECUTE FUNCTION enforce_media_license_device();

ALTER TABLE child_downloads
  ADD CONSTRAINT child_downloads_registered_device_fk
  FOREIGN KEY (device_id) REFERENCES account_devices(id) ON DELETE CASCADE;

ALTER TABLE account_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE playback_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_licenses ENABLE ROW LEVEL SECURITY;

-- القراءة لولي الأمر؛ التسجيل والإلغاء وبدء التشغيل ومنح الترخيص عبر RPC/Edge Function خادمية فقط.
CREATE POLICY account_devices_parent_read ON account_devices
FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY playback_sessions_parent_read ON playback_sessions
FOR SELECT USING (parent_id = auth.uid());
CREATE POLICY media_licenses_parent_read ON media_licenses
FOR SELECT USING (parent_id = auth.uid());

CREATE INDEX idx_account_devices_parent_status
  ON account_devices(parent_id, status, last_seen_at DESC);
CREATE INDEX idx_playback_sessions_active_lease
  ON playback_sessions(parent_id, lease_expires_at)
  WHERE status = 'active';
CREATE INDEX idx_media_licenses_device_status
  ON media_licenses(device_id, status, expires_at);

-- معايير قبول إضافية:
-- Free/Family/Family Plus تفرض على الترتيب 1/4/8 أجهزة، 1/2/4 تشغيلات، و0/2/4 أجهزة تنزيل.
-- تسجيلان أو تشغيلان متزامنان لا يتجاوزان الحد تحت race condition.
-- heartbeat المنتهي يحرر مقعد التشغيل، وإلغاء الجهاز يوقف heartbeat ويسحب كل تراخيصه.
-- Cast/AirPlay يحتسب تشغيلًا واحدًا؛ تطبيق TV المسجل يحتسب جهازًا.
-- لا يخزن معرف إعلاني أو IMEI أو nickname طفل في الأجهزة أو التراخيص.

-- 9. تقوية أمان الاستحقاقات ومعالجة نتائج مراجعة الاتساق

-- ملفات تتجاوز حد باقة مخفضة تبقى محفوظة وقابلة للإدارة/التصدير، لكن Child Session لا يفعلها.
ALTER TABLE children_profiles
  ADD COLUMN entitlement_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- تدوير epoch يبطل رموز الجهاز في طبقة المصادقة عند الإلغاء.
ALTER TABLE account_devices
  ADD COLUMN auth_epoch INTEGER NOT NULL DEFAULT 0 CHECK (auth_epoch >= 0);

-- جدول الحدود مرجع خادمي للقراءة فقط؛ لا يستطيع العميل تعديل أرقام الباقات.
ALTER TABLE subscription_plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plan_limits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_plan_limits FROM anon, authenticated;
GRANT SELECT ON subscription_plan_limits TO authenticated;
CREATE POLICY subscription_plan_limits_authenticated_read
ON subscription_plan_limits FOR SELECT TO authenticated USING (TRUE);

-- فصل قراءة/إنشاء/تعديل ملف ولي الأمر ومنع تعديل plan من العميل.
DROP POLICY IF EXISTS parents_self ON parents;
CREATE POLICY parents_self_select ON parents
FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY parents_self_insert_free ON parents
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND plan = 'free');
CREATE POLICY parents_self_update_profile ON parents
FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
REVOKE INSERT, UPDATE ON parents FROM anon, authenticated;
GRANT INSERT (id, display_name, locale, timezone) ON parents TO authenticated;
GRANT UPDATE (display_name, locale, timezone, updated_at) ON parents TO authenticated;

-- تحديث الأعمار المؤهلة فقط؛ بلوغ 13 لا يعطل تحديث بقية الملفات.
CREATE OR REPLACE FUNCTION refresh_child_age_tracks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH calculated_ages AS (
    SELECT
      id,
      EXTRACT(YEAR FROM AGE(
        CURRENT_DATE,
        MAKE_DATE(birth_year, birth_month, 1)
      ))::INTEGER AS calculated_age
    FROM children_profiles
  ), eligible AS (
    SELECT
      id,
      CASE
        WHEN calculated_age BETWEEN 3 AND 5 THEN 'preschool'::age_track
        WHEN calculated_age BETWEEN 6 AND 8 THEN 'kids'::age_track
        WHEN calculated_age BETWEEN 9 AND 12 THEN 'junior'::age_track
      END AS next_track
    FROM calculated_ages
    WHERE calculated_age BETWEEN 3 AND 12
  )
  UPDATE children_profiles AS cp
  SET age_track = eligible.next_track,
      updated_at = NOW()
  FROM eligible
  WHERE cp.id = eligible.id
    AND cp.age_track IS DISTINCT FROM eligible.next_track;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- حد ملفات الأطفال يقرأ المرجع نفسه بدل قيمة hard-coded.
CREATE OR REPLACE FUNCTION enforce_children_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_limit SMALLINT;
  v_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 0));
  SELECT p.plan, l.max_child_profiles
  INTO v_plan, v_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
  FOR UPDATE OF p;

  IF v_plan IS NULL THEN RAISE EXCEPTION 'parent or plan limits not found'; END IF;

  SELECT count(*) INTO v_count
  FROM children_profiles
  WHERE parent_id = NEW.parent_id AND id <> NEW.id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'child profile limit reached for plan % (maximum %)', v_plan, v_limit;
  END IF;
  RETURN NEW;
END;
$$;

-- تطبيع الإلغاء وفرض الحدود؛ trigger الموجود يستدعي هذه النسخة الجديدة تلقائيًا.
CREATE OR REPLACE FUNCTION enforce_device_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_device_limit SMALLINT;
  v_download_limit SMALLINT;
  v_active_count INTEGER;
  v_download_count INTEGER;
BEGIN
  IF NEW.status = 'revoked' THEN
    NEW.revoked_at := COALESCE(NEW.revoked_at, NOW());
    NEW.download_enabled := FALSE;
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
      NEW.auth_epoch := OLD.auth_epoch + 1;
    END IF;
    RETURN NEW;
  END IF;

  NEW.revoked_at := NULL;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 11));
  SELECT p.plan, l.max_registered_devices, l.max_download_devices
  INTO v_plan, v_device_limit, v_download_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
  FOR UPDATE OF p;

  IF v_plan IS NULL THEN RAISE EXCEPTION 'parent or plan limits not found'; END IF;

  SELECT count(*) INTO v_active_count
  FROM account_devices
  WHERE parent_id = NEW.parent_id AND status = 'active' AND id <> NEW.id;
  IF v_active_count >= v_device_limit THEN
    RAISE EXCEPTION 'registered device limit reached for plan % (maximum %)', v_plan, v_device_limit;
  END IF;

  IF NEW.download_enabled THEN
    SELECT count(*) INTO v_download_count
    FROM account_devices
    WHERE parent_id = NEW.parent_id
      AND status = 'active' AND download_enabled = TRUE AND id <> NEW.id;
    IF v_download_count >= v_download_limit THEN
      RAISE EXCEPTION 'download device limit reached for plan % (maximum %)', v_plan, v_download_limit;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- إلغاء الجهاز أو تعطيل تنزيله يسحب الجلسات والتراخيص والتنزيلات في المعاملة نفسها.
CREATE OR REPLACE FUNCTION cascade_device_entitlement_revocation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status = 'revoked' THEN
    UPDATE playback_sessions
    SET status = 'revoked', ended_at = COALESCE(ended_at, NOW())
    WHERE device_id = NEW.id AND status = 'active';

    UPDATE media_licenses
    SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW())
    WHERE device_id = NEW.id AND status = 'active';

    UPDATE child_downloads
    SET status = 'expired', expires_at = COALESCE(expires_at, NOW())
    WHERE device_id = NEW.id AND status IN ('queued', 'downloading', 'ready');
  ELSIF OLD.download_enabled AND NOT NEW.download_enabled THEN
    UPDATE media_licenses
    SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW())
    WHERE device_id = NEW.id AND kind = 'offline' AND status = 'active';

    UPDATE child_downloads
    SET status = 'expired', expires_at = COALESCE(expires_at, NOW())
    WHERE device_id = NEW.id AND status IN ('queued', 'downloading', 'ready');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_devices_cascade_revocation ON account_devices;
CREATE TRIGGER account_devices_cascade_revocation
AFTER UPDATE OF status, download_enabled ON account_devices
FOR EACH ROW EXECUTE FUNCTION cascade_device_entitlement_revocation();

ALTER TABLE playback_sessions
  ADD CONSTRAINT playback_lease_after_heartbeat
  CHECK (lease_expires_at > last_heartbeat_at);

-- لا تُجدد جلسة انتهت، ولا يحدث تنظيف leases الصف الجاري من داخل trigger نفسه.
CREATE OR REPLACE FUNCTION enforce_playback_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_stream_limit SMALLINT;
  v_active_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' AND OLD.lease_expires_at <= NOW() THEN
    RAISE EXCEPTION 'playback lease expired; start a new session';
  END IF;
  IF NEW.lease_expires_at <= NEW.last_heartbeat_at THEN
    RAISE EXCEPTION 'lease_expires_at must be after last_heartbeat_at';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 12));

  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id AND parent_id = NEW.parent_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'device is not active for this parent';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM children_profiles
    WHERE id = NEW.child_id
      AND parent_id = NEW.parent_id
      AND entitlement_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'child is not entitled for this parent';
  END IF;

  UPDATE playback_sessions
  SET status = 'expired', ended_at = COALESCE(ended_at, NOW())
  WHERE parent_id = NEW.parent_id
    AND id <> NEW.id
    AND status = 'active'
    AND lease_expires_at <= NOW();

  SELECT p.plan, l.max_concurrent_streams
  INTO v_plan, v_stream_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
  FOR UPDATE OF p;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'parent or plan limits not found'; END IF;

  SELECT count(*) INTO v_active_count
  FROM playback_sessions
  WHERE parent_id = NEW.parent_id
    AND status = 'active' AND lease_expires_at > NOW() AND id <> NEW.id;
  IF v_active_count >= v_stream_limit THEN
    RAISE EXCEPTION 'concurrent playback limit reached for plan % (maximum %)', v_plan, v_stream_limit;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS playback_sessions_enforce_plan_limits ON playback_sessions;
CREATE TRIGGER playback_sessions_enforce_plan_limits
BEFORE INSERT OR UPDATE OF parent_id, child_id, device_id, status, last_heartbeat_at, lease_expires_at
ON playback_sessions
FOR EACH ROW EXECUTE FUNCTION enforce_playback_plan_limits();

-- الترخيص النشط يتطلب طفلًا مفعّلًا وجهازًا مؤهلًا وباقة تسمح بالتنزيل عند offline.
CREATE OR REPLACE FUNCTION enforce_media_license_device()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_download_limit SMALLINT;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  IF NEW.expires_at <= NOW() THEN RAISE EXCEPTION 'media license must expire in the future'; END IF;

  SELECT l.max_download_devices INTO v_download_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id;
  IF v_download_limit IS NULL THEN RAISE EXCEPTION 'parent or plan limits not found'; END IF;
  IF NEW.kind = 'offline' AND v_download_limit = 0 THEN
    RAISE EXCEPTION 'offline licenses are not included in this plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id
      AND parent_id = NEW.parent_id
      AND status = 'active'
      AND (NEW.kind = 'online' OR download_enabled = TRUE)
  ) THEN
    RAISE EXCEPTION 'device is not eligible for this media license';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM children_profiles
    WHERE id = NEW.child_id
      AND parent_id = NEW.parent_id
      AND entitlement_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'child is not entitled for this parent';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_licenses_enforce_device ON media_licenses;
CREATE TRIGGER media_licenses_enforce_device
BEFORE INSERT OR UPDATE OF parent_id, child_id, device_id, kind, status, expires_at
ON media_licenses
FOR EACH ROW EXECUTE FUNCTION enforce_media_license_device();

-- يمنع ربط تنزيل طفل بجهاز تابع لأسرة أخرى أو غير مفعل للتنزيل.
CREATE OR REPLACE FUNCTION enforce_child_download_device_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_child_parent UUID;
  v_device_parent UUID;
  v_device_active BOOLEAN;
  v_download_enabled BOOLEAN;
BEGIN
  SELECT parent_id INTO v_child_parent
  FROM children_profiles WHERE id = NEW.child_id AND entitlement_enabled = TRUE;
  SELECT parent_id, status = 'active', download_enabled
  INTO v_device_parent, v_device_active, v_download_enabled
  FROM account_devices WHERE id = NEW.device_id;

  IF v_child_parent IS NULL OR v_device_parent IS NULL OR v_child_parent <> v_device_parent THEN
    RAISE EXCEPTION 'download child and device must belong to the same parent';
  END IF;
  IF NOT v_device_active OR NOT v_download_enabled THEN
    RAISE EXCEPTION 'device is not eligible for downloads';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS child_downloads_enforce_device_owner ON child_downloads;
CREATE TRIGGER child_downloads_enforce_device_owner
BEFORE INSERT OR UPDATE OF child_id, device_id ON child_downloads
FOR EACH ROW EXECUTE FUNCTION enforce_child_download_device_owner();

-- تغيير الباقة خدمة موثوقة فقط. عند التخفيض يجب تحديد ما سيبقى؛ لا حذف تلقائي للبيانات.
CREATE OR REPLACE FUNCTION apply_subscription_plan_change(
  p_parent_id UUID,
  p_new_plan subscription_plan,
  p_keep_child_ids UUID[] DEFAULT NULL,
  p_keep_device_ids TEXT[] DEFAULT NULL,
  p_keep_download_device_ids TEXT[] DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_limit SMALLINT;
  v_device_limit SMALLINT;
  v_stream_limit SMALLINT;
  v_download_limit SMALLINT;
  v_total_children INTEGER;
  v_active_devices INTEGER;
  v_download_devices INTEGER;
  v_matched INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  PERFORM 1 FROM parents WHERE id = p_parent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'parent not found'; END IF;

  SELECT max_child_profiles, max_registered_devices,
         max_concurrent_streams, max_download_devices
  INTO v_child_limit, v_device_limit, v_stream_limit, v_download_limit
  FROM subscription_plan_limits WHERE plan = p_new_plan;
  IF v_child_limit IS NULL THEN RAISE EXCEPTION 'plan limits not found'; END IF;

  SELECT count(*) INTO v_total_children
  FROM children_profiles WHERE parent_id = p_parent_id;
  IF v_total_children > v_child_limit THEN
    IF p_keep_child_ids IS NULL
       OR cardinality(p_keep_child_ids) < 1
       OR cardinality(p_keep_child_ids) > v_child_limit THEN
      RAISE EXCEPTION 'downgrade_selection_required: choose up to % child profiles', v_child_limit;
    END IF;
    SELECT count(*) INTO v_matched FROM children_profiles
    WHERE parent_id = p_parent_id AND id = ANY(p_keep_child_ids);
    IF v_matched <> cardinality(p_keep_child_ids) THEN
      RAISE EXCEPTION 'keep_child_ids contains duplicates or unowned profiles';
    END IF;
    UPDATE children_profiles
    SET entitlement_enabled = (id = ANY(p_keep_child_ids)), updated_at = NOW()
    WHERE parent_id = p_parent_id;
  ELSE
    UPDATE children_profiles
    SET entitlement_enabled = TRUE, updated_at = NOW()
    WHERE parent_id = p_parent_id;
  END IF;

  SELECT count(*) INTO v_active_devices FROM account_devices
  WHERE parent_id = p_parent_id AND status = 'active';
  IF v_active_devices > v_device_limit THEN
    IF p_keep_device_ids IS NULL
       OR cardinality(p_keep_device_ids) < 1
       OR cardinality(p_keep_device_ids) > v_device_limit THEN
      RAISE EXCEPTION 'downgrade_selection_required: choose up to % devices', v_device_limit;
    END IF;
    SELECT count(*) INTO v_matched FROM account_devices
    WHERE parent_id = p_parent_id AND status = 'active' AND id = ANY(p_keep_device_ids);
    IF v_matched <> cardinality(p_keep_device_ids) THEN
      RAISE EXCEPTION 'keep_device_ids contains duplicates, inactive, or unowned devices';
    END IF;
    UPDATE account_devices
    SET status = 'revoked', revoked_at = NOW()
    WHERE parent_id = p_parent_id
      AND status = 'active'
      AND NOT (id = ANY(p_keep_device_ids));
  END IF;

  SELECT count(*) INTO v_download_devices FROM account_devices
  WHERE parent_id = p_parent_id AND status = 'active' AND download_enabled = TRUE;
  IF v_download_devices > v_download_limit THEN
    IF v_download_limit = 0 THEN
      UPDATE account_devices SET download_enabled = FALSE
      WHERE parent_id = p_parent_id AND status = 'active' AND download_enabled = TRUE;
    ELSE
      IF p_keep_download_device_ids IS NULL
         OR cardinality(p_keep_download_device_ids) < 1
         OR cardinality(p_keep_download_device_ids) > v_download_limit THEN
        RAISE EXCEPTION 'downgrade_selection_required: choose up to % download devices', v_download_limit;
      END IF;
      SELECT count(*) INTO v_matched FROM account_devices
      WHERE parent_id = p_parent_id
        AND status = 'active' AND download_enabled = TRUE
        AND id = ANY(p_keep_download_device_ids);
      IF v_matched <> cardinality(p_keep_download_device_ids) THEN
        RAISE EXCEPTION 'keep_download_device_ids contains duplicates or ineligible devices';
      END IF;
      UPDATE account_devices
      SET download_enabled = FALSE
      WHERE parent_id = p_parent_id
        AND status = 'active' AND download_enabled = TRUE
        AND NOT (id = ANY(p_keep_download_device_ids));
    END IF;
  END IF;

  -- جميع الجلسات النشطة تعيد طلب ترخيص تحت الحد الجديد؛ لا تُحذف سجلات التاريخ.
  UPDATE playback_sessions
  SET status = 'revoked', ended_at = COALESCE(ended_at, NOW())
  WHERE parent_id = p_parent_id AND status = 'active';

  UPDATE parents SET plan = p_new_plan, updated_at = NOW()
  WHERE id = p_parent_id;
END;
$$;

REVOKE ALL ON FUNCTION apply_subscription_plan_change(UUID, subscription_plan, UUID[], TEXT[], TEXT[])
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION apply_subscription_plan_change(UUID, subscription_plan, UUID[], TEXT[], TEXT[])
TO service_role;

-- قبول التقوية:
-- authenticated لا يستطيع UPDATE parents.plan ولا تعديل subscription_plan_limits.
-- التخفيض لا يحذف طفلًا أو جهازًا؛ يفشل بطلب selection حتى توفر قوائم ضمن الحدود.
-- الجهاز الملغى يرفع auth_epoch ويلغي playback/media licenses/downloads في transaction نفسها.
-- heartbeat لا يجدد lease منتهية، وتنظيف الجلسات يستثني الصف الجاري.
-- offline license وتنزيل الطفل يتطلبان جهازًا نشطًا مفعّلًا وتطابق الأسرة والاستحقاق.

-- 10. إغلاق دورة الاستحقاق: grace period، انتقالات الجلسة، واستحقاق الأصل

ALTER TABLE parents
  ADD COLUMN pending_plan subscription_plan,
  ADD COLUMN plan_change_requested_at TIMESTAMPTZ,
  ADD COLUMN plan_change_effective_at TIMESTAMPTZ,
  ADD CONSTRAINT pending_plan_dates_complete CHECK (
    (pending_plan IS NULL AND plan_change_requested_at IS NULL AND plan_change_effective_at IS NULL)
    OR
    (pending_plan IS NOT NULL AND plan_change_requested_at IS NOT NULL
     AND plan_change_effective_at IS NOT NULL
     AND plan_change_effective_at >= plan_change_requested_at)
  );

-- كل سجل تنزيل يثبت الترخيص offline الذي سمح به لنفس الأصل والجهاز والطفل.
ALTER TABLE child_downloads
  ADD COLUMN media_license_id UUID NOT NULL REFERENCES media_licenses(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION subscription_plan_rank(p_plan subscription_plan)
RETURNS SMALLINT
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE p_plan
    WHEN 'free' THEN 0::SMALLINT
    WHEN 'family' THEN 1::SMALLINT
    WHEN 'family_plus' THEN 2::SMALLINT
  END;
$$;

-- مصدر موحد للتحقق من وجود الأصل ونشره وعمره ومساره ومستوى الباقة.
CREATE OR REPLACE FUNCTION content_is_entitled(
  p_parent_id UUID,
  p_child_id UUID,
  p_entity_type content_entity_type,
  p_entity_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan subscription_plan;
  v_track age_track;
  v_age INTEGER;
BEGIN
  SELECT p.plan,
         c.age_track,
         EXTRACT(YEAR FROM AGE(
           CURRENT_DATE,
           MAKE_DATE(c.birth_year, c.birth_month, 1)
         ))::INTEGER
  INTO v_plan, v_track, v_age
  FROM parents p
  JOIN children_profiles c ON c.parent_id = p.id
  WHERE p.id = p_parent_id
    AND c.id = p_child_id
    AND c.entitlement_enabled = TRUE
    AND (
      p.pending_plan IS NULL
      OR p.plan_change_effective_at > NOW()
    );

  IF v_plan IS NULL OR v_age NOT BETWEEN 3 AND 12 THEN RETURN FALSE; END IF;

  CASE p_entity_type
    WHEN 'series' THEN
      RETURN EXISTS (
        SELECT 1 FROM series s
        WHERE s.id = p_entity_id
          AND s.status = 'published'
          AND v_age BETWEEN s.age_min AND s.age_max
          AND v_track = ANY(s.track_ids)
          AND (s.is_free OR subscription_plan_rank(v_plan) >= subscription_plan_rank(s.price_tier))
      );
    WHEN 'episode' THEN
      RETURN EXISTS (
        SELECT 1
        FROM episodes e
        JOIN series s ON s.id = e.series_id
        WHERE e.id = p_entity_id
          AND e.is_published = TRUE
          AND s.status = 'published'
          AND v_age BETWEEN e.age_min AND e.age_max
          AND v_track = ANY(e.track_ids)
          AND (e.is_free OR s.is_free
               OR subscription_plan_rank(v_plan) >= subscription_plan_rank(s.price_tier))
      );
    WHEN 'book' THEN
      RETURN EXISTS (
        SELECT 1 FROM books b
        WHERE b.id = p_entity_id
          AND v_age BETWEEN b.age_min AND b.age_max
          AND v_track = ANY(b.track_ids)
          AND (b.is_free OR v_plan <> 'free')
      );
    WHEN 'game' THEN
      RETURN EXISTS (
        SELECT 1 FROM games g
        WHERE g.id = p_entity_id
          AND v_age BETWEEN g.age_min AND g.age_max
          AND v_track = ANY(g.track_ids)
          AND (g.is_free OR v_plan <> 'free')
      );
    WHEN 'project' THEN
      RETURN EXISTS (
        SELECT 1 FROM projects pr
        WHERE pr.id = p_entity_id
          AND v_age BETWEEN pr.age_min AND pr.age_max
          AND v_track = ANY(pr.track_ids)
          AND (pr.is_free OR v_plan <> 'free')
      );
  END CASE;
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION content_is_entitled(UUID, UUID, content_entity_type, TEXT)
FROM PUBLIC, anon, authenticated;

-- انتهاء grace period يوقف تسجيل/إعادة تفعيل جهاز حتى تكتمل مصالحة التخفيض.
CREATE OR REPLACE FUNCTION block_device_during_pending_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'revoked' OR (TG_OP = 'UPDATE' AND NOT NEW.download_enabled) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM parents
    WHERE id = NEW.parent_id
      AND pending_plan IS NOT NULL
      AND plan_change_effective_at <= NOW()
  ) THEN
    RAISE EXCEPTION 'subscription reconciliation required before device activation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS account_devices_block_pending_reconciliation ON account_devices;
CREATE TRIGGER account_devices_block_pending_reconciliation
BEFORE INSERT OR UPDATE OF parent_id, status, download_enabled ON account_devices
FOR EACH ROW EXECUTE FUNCTION block_device_during_pending_reconciliation();

-- active هو الوضع الوحيد القابل للنبض؛ ended/expired/revoked حالات نهائية غير قابلة لإعادة التنشيط.
CREATE OR REPLACE FUNCTION enforce_playback_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_stream_limit SMALLINT;
  v_active_count INTEGER;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'new playback session must start active';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal playback session cannot be updated or reactivated';
  END IF;
  IF NEW.status <> 'active' THEN
    NEW.ended_at := COALESCE(NEW.ended_at, NOW());
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.lease_expires_at <= NOW() THEN
    RAISE EXCEPTION 'playback lease expired; start a new session';
  END IF;
  IF NEW.lease_expires_at <= NEW.last_heartbeat_at THEN
    RAISE EXCEPTION 'lease_expires_at must be after last_heartbeat_at';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 12));
  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id AND parent_id = NEW.parent_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'device is not active for this parent';
  END IF;
  IF NOT content_is_entitled(NEW.parent_id, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'content is not entitled for this parent, child, or plan';
  END IF;

  UPDATE playback_sessions
  SET status = 'expired', ended_at = COALESCE(ended_at, NOW())
  WHERE parent_id = NEW.parent_id
    AND id <> NEW.id
    AND status = 'active'
    AND lease_expires_at <= NOW();

  SELECT p.plan, l.max_concurrent_streams
  INTO v_plan, v_stream_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
    AND (p.pending_plan IS NULL OR p.plan_change_effective_at > NOW())
  FOR UPDATE OF p;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'subscription reconciliation required'; END IF;

  SELECT count(*) INTO v_active_count
  FROM playback_sessions
  WHERE parent_id = NEW.parent_id
    AND status = 'active' AND lease_expires_at > NOW() AND id <> NEW.id;
  IF v_active_count >= v_stream_limit THEN
    RAISE EXCEPTION 'concurrent playback limit reached for plan % (maximum %)', v_plan, v_stream_limit;
  END IF;
  RETURN NEW;
END;
$$;

-- Heartbeat لا يقبل إلا session/token نشطين قبل الانتهاء وبمهلة قصيرة محدودة.
CREATE OR REPLACE FUNCTION renew_playback_lease(
  p_session_id UUID,
  p_session_token_hash TEXT,
  p_lease_seconds INTEGER DEFAULT 90
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status playback_session_status;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_lease_seconds NOT BETWEEN 30 AND 120 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 120';
  END IF;

  SELECT status, lease_expires_at INTO v_status, v_expires
  FROM playback_sessions
  WHERE id = p_session_id AND session_token_hash = p_session_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_status <> 'active' OR v_expires <= NOW() THEN RETURN FALSE; END IF;

  UPDATE playback_sessions
  SET last_heartbeat_at = NOW(),
      lease_expires_at = NOW() + make_interval(secs => p_lease_seconds)
  WHERE id = p_session_id;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION renew_playback_lease(UUID, TEXT, INTEGER)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION renew_playback_lease(UUID, TEXT, INTEGER)
TO service_role;

-- التراخيص نهائية بعد انتهاء/إلغاء، وتتحقق من الأصل نفسه لا من الجهاز فقط.
CREATE OR REPLACE FUNCTION enforce_media_license_device()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_download_limit SMALLINT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'new media license must start active';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal media license cannot be updated or reactivated';
  END IF;
  IF NEW.status <> 'active' THEN
    NEW.revoked_at := COALESCE(NEW.revoked_at, NOW());
    RETURN NEW;
  END IF;
  IF NEW.expires_at <= NOW() THEN RAISE EXCEPTION 'media license must expire in the future'; END IF;

  SELECT l.max_download_devices INTO v_download_limit
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
    AND (p.pending_plan IS NULL OR p.plan_change_effective_at > NOW());
  IF v_download_limit IS NULL THEN RAISE EXCEPTION 'subscription reconciliation required'; END IF;
  IF NEW.kind = 'offline' AND v_download_limit = 0 THEN
    RAISE EXCEPTION 'offline licenses are not included in this plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id
      AND parent_id = NEW.parent_id
      AND status = 'active'
      AND (NEW.kind = 'online' OR download_enabled = TRUE)
  ) THEN
    RAISE EXCEPTION 'device is not eligible for this media license';
  END IF;
  IF NOT content_is_entitled(NEW.parent_id, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'content is not entitled for this parent, child, or plan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_licenses_enforce_device ON media_licenses;
CREATE TRIGGER media_licenses_enforce_device
BEFORE INSERT OR UPDATE OF parent_id, child_id, device_id, entity_type, entity_id, kind, status, expires_at
ON media_licenses
FOR EACH ROW EXECUTE FUNCTION enforce_media_license_device();

-- التنزيل يطابق ترخيص offline نشطًا لنفس الأسرة والطفل والجهاز والأصل.
CREATE OR REPLACE FUNCTION enforce_child_download_device_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_child_parent UUID;
BEGIN
  SELECT parent_id INTO v_child_parent
  FROM children_profiles
  WHERE id = NEW.child_id AND entitlement_enabled = TRUE;

  IF v_child_parent IS NULL THEN RAISE EXCEPTION 'child is not entitled'; END IF;
  IF NOT content_is_entitled(v_child_parent, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'download content is not entitled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM media_licenses ml
    JOIN account_devices d ON d.id = ml.device_id AND d.parent_id = ml.parent_id
    WHERE ml.id = NEW.media_license_id
      AND ml.parent_id = v_child_parent
      AND ml.child_id = NEW.child_id
      AND ml.device_id = NEW.device_id
      AND ml.entity_type = NEW.entity_type
      AND ml.entity_id = NEW.entity_id
      AND ml.kind = 'offline'
      AND ml.status = 'active'
      AND ml.expires_at > NOW()
      AND d.status = 'active'
      AND d.download_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'matching active offline license is required for download';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS child_downloads_enforce_device_owner ON child_downloads;
CREATE TRIGGER child_downloads_enforce_device_owner
BEFORE INSERT OR UPDATE OF child_id, device_id, entity_type, entity_id, media_license_id
ON child_downloads
FOR EACH ROW EXECUTE FUNCTION enforce_child_download_device_owner();

-- تنزيلات العميل للقراءة فقط؛ الإنشاء والتعديل والحذف عبر خدمة التراخيص الموثوقة.
DROP POLICY IF EXISTS child_downloads_parent ON child_downloads;
CREATE POLICY child_downloads_parent_read ON child_downloads
FOR SELECT TO authenticated USING (parent_owns_child(child_id));
REVOKE INSERT, UPDATE, DELETE ON child_downloads FROM anon, authenticated;
GRANT SELECT ON child_downloads TO authenticated;

-- جدولة التخفيض تحفظ الباقة الحالية خلال grace period؛ بعد الموعد تتوقف التراخيص الجديدة حتى المصالحة.
CREATE OR REPLACE FUNCTION schedule_subscription_plan_change(
  p_parent_id UUID,
  p_new_plan subscription_plan,
  p_effective_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_plan subscription_plan;
BEGIN
  SELECT plan INTO v_current_plan FROM parents WHERE id = p_parent_id FOR UPDATE;
  IF v_current_plan IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;
  IF subscription_plan_rank(p_new_plan) >= subscription_plan_rank(v_current_plan) THEN
    RAISE EXCEPTION 'only downgrades require scheduling; apply upgrades directly';
  END IF;
  IF p_effective_at < NOW() THEN RAISE EXCEPTION 'effective time cannot be in the past'; END IF;

  UPDATE parents
  SET pending_plan = p_new_plan,
      plan_change_requested_at = NOW(),
      plan_change_effective_at = p_effective_at,
      updated_at = NOW()
  WHERE id = p_parent_id;
END;
$$;

REVOKE ALL ON FUNCTION schedule_subscription_plan_change(UUID, subscription_plan, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION schedule_subscription_plan_change(UUID, subscription_plan, TIMESTAMPTZ)
TO service_role;

-- النسخة النهائية: التطبيق بعد انتهاء grace، والمصالحة تسحب كل التراخيص عند التخفيض.
CREATE OR REPLACE FUNCTION apply_subscription_plan_change(
  p_parent_id UUID,
  p_new_plan subscription_plan,
  p_keep_child_ids UUID[] DEFAULT NULL,
  p_keep_device_ids TEXT[] DEFAULT NULL,
  p_keep_download_device_ids TEXT[] DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_plan subscription_plan;
  v_pending_plan subscription_plan;
  v_effective_at TIMESTAMPTZ;
  v_child_limit SMALLINT;
  v_device_limit SMALLINT;
  v_download_limit SMALLINT;
  v_total_children INTEGER;
  v_active_devices INTEGER;
  v_download_devices INTEGER;
  v_matched INTEGER;
  v_is_downgrade BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  SELECT plan, pending_plan, plan_change_effective_at
  INTO v_old_plan, v_pending_plan, v_effective_at
  FROM parents WHERE id = p_parent_id FOR UPDATE;
  IF v_old_plan IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;

  v_is_downgrade := subscription_plan_rank(p_new_plan) < subscription_plan_rank(v_old_plan);
  IF v_is_downgrade THEN
    IF v_pending_plan IS DISTINCT FROM p_new_plan OR v_effective_at IS NULL THEN
      RAISE EXCEPTION 'downgrade must be scheduled before application';
    END IF;
    IF v_effective_at > NOW() THEN RAISE EXCEPTION 'downgrade grace period is still active'; END IF;
  END IF;

  SELECT max_child_profiles, max_registered_devices, max_download_devices
  INTO v_child_limit, v_device_limit, v_download_limit
  FROM subscription_plan_limits WHERE plan = p_new_plan;
  IF v_child_limit IS NULL THEN RAISE EXCEPTION 'plan limits not found'; END IF;

  SELECT count(*) INTO v_total_children
  FROM children_profiles WHERE parent_id = p_parent_id;
  IF v_total_children > v_child_limit THEN
    IF p_keep_child_ids IS NULL OR cardinality(p_keep_child_ids) < 1
       OR cardinality(p_keep_child_ids) > v_child_limit THEN
      RAISE EXCEPTION 'downgrade_selection_required: choose up to % child profiles', v_child_limit;
    END IF;
    SELECT count(*) INTO v_matched FROM children_profiles
    WHERE parent_id = p_parent_id AND id = ANY(p_keep_child_ids);
    IF v_matched <> cardinality(p_keep_child_ids) THEN
      RAISE EXCEPTION 'keep_child_ids contains duplicates or unowned profiles';
    END IF;
    UPDATE children_profiles
    SET entitlement_enabled = (id = ANY(p_keep_child_ids)), updated_at = NOW()
    WHERE parent_id = p_parent_id;
  ELSE
    UPDATE children_profiles SET entitlement_enabled = TRUE, updated_at = NOW()
    WHERE parent_id = p_parent_id;
  END IF;

  SELECT count(*) INTO v_active_devices FROM account_devices
  WHERE parent_id = p_parent_id AND status = 'active';
  IF v_active_devices > v_device_limit THEN
    IF p_keep_device_ids IS NULL OR cardinality(p_keep_device_ids) < 1
       OR cardinality(p_keep_device_ids) > v_device_limit THEN
      RAISE EXCEPTION 'downgrade_selection_required: choose up to % devices', v_device_limit;
    END IF;
    SELECT count(*) INTO v_matched FROM account_devices
    WHERE parent_id = p_parent_id AND status = 'active' AND id = ANY(p_keep_device_ids);
    IF v_matched <> cardinality(p_keep_device_ids) THEN
      RAISE EXCEPTION 'keep_device_ids contains duplicates, inactive, or unowned devices';
    END IF;
    UPDATE account_devices
    SET status = 'revoked', revoked_at = NOW()
    WHERE parent_id = p_parent_id AND status = 'active'
      AND NOT (id = ANY(p_keep_device_ids));
  END IF;

  SELECT count(*) INTO v_download_devices FROM account_devices
  WHERE parent_id = p_parent_id AND status = 'active' AND download_enabled = TRUE;
  IF v_download_devices > v_download_limit THEN
    IF v_download_limit = 0 THEN
      UPDATE account_devices SET download_enabled = FALSE
      WHERE parent_id = p_parent_id AND status = 'active' AND download_enabled = TRUE;
    ELSE
      IF p_keep_download_device_ids IS NULL OR cardinality(p_keep_download_device_ids) < 1
         OR cardinality(p_keep_download_device_ids) > v_download_limit THEN
        RAISE EXCEPTION 'downgrade_selection_required: choose up to % download devices', v_download_limit;
      END IF;
      SELECT count(*) INTO v_matched FROM account_devices
      WHERE parent_id = p_parent_id AND status = 'active' AND download_enabled = TRUE
        AND id = ANY(p_keep_download_device_ids);
      IF v_matched <> cardinality(p_keep_download_device_ids) THEN
        RAISE EXCEPTION 'keep_download_device_ids contains duplicates or ineligible devices';
      END IF;
      UPDATE account_devices SET download_enabled = FALSE
      WHERE parent_id = p_parent_id AND status = 'active' AND download_enabled = TRUE
        AND NOT (id = ANY(p_keep_download_device_ids));
    END IF;
  END IF;

  UPDATE playback_sessions
  SET status = 'revoked', ended_at = COALESCE(ended_at, NOW())
  WHERE parent_id = p_parent_id AND status = 'active';

  IF v_is_downgrade THEN
    UPDATE media_licenses
    SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW())
    WHERE parent_id = p_parent_id AND status = 'active';

    UPDATE child_downloads cd
    SET status = 'expired', expires_at = COALESCE(cd.expires_at, NOW())
    FROM children_profiles cp
    WHERE cd.child_id = cp.id
      AND cp.parent_id = p_parent_id
      AND cd.status IN ('queued', 'downloading', 'ready');
  END IF;

  UPDATE parents
  SET plan = p_new_plan,
      pending_plan = NULL,
      plan_change_requested_at = NULL,
      plan_change_effective_at = NULL,
      updated_at = NOW()
  WHERE id = p_parent_id;
END;
$$;

-- قبول الإغلاق:
-- grace period ممثل بموعد؛ بعده لا جلسة/ترخيص/جهاز جديد قبل apply والمصالحة.
-- حالات playback وmedia_license النهائية لا تعود active؛ heartbeat فقط عبر RPC خادمية محدودة.
-- كل تشغيل/ترخيص يثبت وجود الأصل ونشره وعمر الطفل ومساره ومستوى الباقة.
-- كل child_download مرتبط بترخيص offline نشط مطابق لنفس الطفل والجهاز والأصل.
-- downgrade يسحب كل التراخيص والتنزيلات ويجبر إعادة الإصدار تحت الخطة الجديدة.

-- 11. تصحيحات نهائية لصلاحية helper ومنع إعادة التفعيل أثناء المصالحة
GRANT EXECUTE ON FUNCTION content_is_entitled(UUID, UUID, content_entity_type, TEXT)
TO service_role;

CREATE OR REPLACE FUNCTION block_device_during_pending_reconciliation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'revoked' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.download_enabled = TRUE
     AND NEW.download_enabled = FALSE THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM parents
    WHERE id = NEW.parent_id
      AND pending_plan IS NOT NULL
      AND plan_change_effective_at <= NOW()
  ) THEN
    RAISE EXCEPTION 'subscription reconciliation required before device activation';
  END IF;
  RETURN NEW;
END;
$$;

-- الجدولة تقصر التراخيص الحالية إلى نهاية grace حتى لا يبقى ترخيص offline بعد موعد التخفيض.
CREATE OR REPLACE FUNCTION schedule_subscription_plan_change(
  p_parent_id UUID,
  p_new_plan subscription_plan,
  p_effective_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_plan subscription_plan;
BEGIN
  SELECT plan INTO v_current_plan FROM parents WHERE id = p_parent_id FOR UPDATE;
  IF v_current_plan IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;
  IF subscription_plan_rank(p_new_plan) >= subscription_plan_rank(v_current_plan) THEN
    RAISE EXCEPTION 'only downgrades require scheduling; apply upgrades directly';
  END IF;
  IF p_effective_at <= NOW() THEN
    RAISE EXCEPTION 'downgrade grace period must end in the future';
  END IF;

  UPDATE parents
  SET pending_plan = p_new_plan,
      plan_change_requested_at = NOW(),
      plan_change_effective_at = p_effective_at,
      updated_at = NOW()
  WHERE id = p_parent_id;

  UPDATE media_licenses
  SET expires_at = LEAST(expires_at, p_effective_at)
  WHERE parent_id = p_parent_id
    AND status = 'active'
    AND expires_at > p_effective_at;
END;
$$;

-- بعد effective_at: لا إعادة تفعيل جهاز، ولا تشغيل/ترخيص جديد، وتنتهي التراخيص القائمة عند الموعد.

-- entitlement_enabled وage_track حقول خادمية؛ ولي الأمر يعدل بيانات الملف المسموح بها فقط.
REVOKE INSERT, UPDATE ON children_profiles FROM authenticated;
GRANT INSERT (
  parent_id, nickname, birth_month, birth_year, avatar_id,
  interests, language, onboarding_completed_at
) ON children_profiles TO authenticated;
GRANT UPDATE (
  nickname, birth_month, birth_year, avatar_id,
  interests, language, onboarding_completed_at, updated_at
) ON children_profiles TO authenticated;

-- لا يستطيع العميل إعادة تفعيل ملف عطله downgrade أو تغيير age_track/parent_id مباشرة.

-- 12. تسلسل موحد للأقفال واستحقاق كامل لكل أنواع المحتوى

-- كل نوع قابل للتشغيل/التنزيل يملك حالة نشر ومستوى باقة، لا السلاسل والحلقات فقط.
ALTER TABLE books
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN price_tier subscription_plan NOT NULL DEFAULT 'family';
ALTER TABLE games
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN price_tier subscription_plan NOT NULL DEFAULT 'family';
ALTER TABLE projects
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN price_tier subscription_plan NOT NULL DEFAULT 'family';

-- الترتيب الإجباري لكل إصدار/إلغاء: قفل الحساب أولًا ثم الجهاز.
CREATE OR REPLACE FUNCTION lock_account_device_serialization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_id UUID;
  v_device_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_parent_id := OLD.parent_id;
    v_device_id := OLD.id;
  ELSE
    v_parent_id := NEW.parent_id;
    v_device_id := NEW.id;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_account_devices_serialization_lock ON account_devices;
CREATE TRIGGER aaa_account_devices_serialization_lock
BEFORE INSERT OR UPDATE OR DELETE ON account_devices
FOR EACH ROW EXECUTE FUNCTION lock_account_device_serialization();

CREATE OR REPLACE FUNCTION lock_entitlement_device_serialization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.device_id, 21));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_playback_device_serialization_lock ON playback_sessions;
CREATE TRIGGER aaa_playback_device_serialization_lock
BEFORE INSERT OR UPDATE OF parent_id, device_id, status, last_heartbeat_at, lease_expires_at
ON playback_sessions
FOR EACH ROW EXECUTE FUNCTION lock_entitlement_device_serialization();

DROP TRIGGER IF EXISTS aaa_media_license_device_serialization_lock ON media_licenses;
CREATE TRIGGER aaa_media_license_device_serialization_lock
BEFORE INSERT OR UPDATE OF parent_id, device_id, status, expires_at
ON media_licenses
FOR EACH ROW EXECUTE FUNCTION lock_entitlement_device_serialization();

CREATE OR REPLACE FUNCTION lock_download_device_serialization()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  SELECT parent_id INTO v_parent_id FROM children_profiles WHERE id = NEW.child_id;
  IF v_parent_id IS NULL THEN RAISE EXCEPTION 'child not found for download lock'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.device_id, 21));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aaa_child_download_device_serialization_lock ON child_downloads;
CREATE TRIGGER aaa_child_download_device_serialization_lock
BEFORE INSERT OR UPDATE OF child_id, device_id, entity_type, entity_id, media_license_id
ON child_downloads
FOR EACH ROW EXECUTE FUNCTION lock_download_device_serialization();

-- النسخة النهائية تفحص النشر ومستوى الباقة لكل نوع.
CREATE OR REPLACE FUNCTION content_is_entitled(
  p_parent_id UUID,
  p_child_id UUID,
  p_entity_type content_entity_type,
  p_entity_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan subscription_plan;
  v_track age_track;
  v_age INTEGER;
BEGIN
  SELECT p.plan, c.age_track,
         EXTRACT(YEAR FROM AGE(
           CURRENT_DATE, MAKE_DATE(c.birth_year, c.birth_month, 1)
         ))::INTEGER
  INTO v_plan, v_track, v_age
  FROM parents p
  JOIN children_profiles c ON c.parent_id = p.id
  WHERE p.id = p_parent_id
    AND c.id = p_child_id
    AND c.entitlement_enabled = TRUE
    AND (p.pending_plan IS NULL OR p.plan_change_effective_at > NOW());

  IF v_plan IS NULL OR v_age NOT BETWEEN 3 AND 12 THEN RETURN FALSE; END IF;

  CASE p_entity_type
    WHEN 'series' THEN
      RETURN EXISTS (
        SELECT 1 FROM series s
        WHERE s.id = p_entity_id AND s.status = 'published'
          AND v_age BETWEEN s.age_min AND s.age_max AND v_track = ANY(s.track_ids)
          AND (s.is_free OR subscription_plan_rank(v_plan) >= subscription_plan_rank(s.price_tier))
      );
    WHEN 'episode' THEN
      RETURN EXISTS (
        SELECT 1 FROM episodes e JOIN series s ON s.id = e.series_id
        WHERE e.id = p_entity_id AND e.is_published = TRUE AND s.status = 'published'
          AND v_age BETWEEN e.age_min AND e.age_max AND v_track = ANY(e.track_ids)
          AND (e.is_free OR s.is_free
               OR subscription_plan_rank(v_plan) >= subscription_plan_rank(s.price_tier))
      );
    WHEN 'book' THEN
      RETURN EXISTS (
        SELECT 1 FROM books b
        WHERE b.id = p_entity_id AND b.is_published = TRUE
          AND v_age BETWEEN b.age_min AND b.age_max AND v_track = ANY(b.track_ids)
          AND (b.is_free OR subscription_plan_rank(v_plan) >= subscription_plan_rank(b.price_tier))
      );
    WHEN 'game' THEN
      RETURN EXISTS (
        SELECT 1 FROM games g
        WHERE g.id = p_entity_id AND g.is_published = TRUE
          AND v_age BETWEEN g.age_min AND g.age_max AND v_track = ANY(g.track_ids)
          AND (g.is_free OR subscription_plan_rank(v_plan) >= subscription_plan_rank(g.price_tier))
      );
    WHEN 'project' THEN
      RETURN EXISTS (
        SELECT 1 FROM projects pr
        WHERE pr.id = p_entity_id AND pr.is_published = TRUE
          AND v_age BETWEEN pr.age_min AND pr.age_max AND v_track = ANY(pr.track_ids)
          AND (pr.is_free OR subscription_plan_rank(v_plan) >= subscription_plan_rank(pr.price_tier))
      );
  END CASE;
  RETURN FALSE;
END;
$$;

-- Heartbeat يأخذ الأقفال بالترتيب نفسه قبل قفل صف الجلسة، فيتجنب سباق/تعطل الإلغاء.
CREATE OR REPLACE FUNCTION renew_playback_lease(
  p_session_id UUID,
  p_session_token_hash TEXT,
  p_lease_seconds INTEGER DEFAULT 90
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_device_id TEXT;
  v_status playback_session_status;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_lease_seconds NOT BETWEEN 30 AND 120 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 120';
  END IF;

  SELECT parent_id, device_id INTO v_parent_id, v_device_id
  FROM playback_sessions
  WHERE id = p_session_id AND session_token_hash = p_session_token_hash;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));

  SELECT status, lease_expires_at INTO v_status, v_expires
  FROM playback_sessions
  WHERE id = p_session_id AND session_token_hash = p_session_token_hash
  FOR UPDATE;
  IF NOT FOUND OR v_status <> 'active' OR v_expires <= NOW() THEN RETURN FALSE; END IF;

  UPDATE playback_sessions
  SET last_heartbeat_at = NOW(),
      lease_expires_at = NOW() + make_interval(secs => p_lease_seconds)
  WHERE id = p_session_id;
  RETURN TRUE;
END;
$$;

-- القفل المشترك يضمن أحد ترتيبين فقط:
-- الإصدار يثبت أولًا ثم يراه cascade الإلغاء ويسحبه، أو الإلغاء يثبت أولًا فيفشل الإصدار عند إعادة الفحص.
-- books/games/projects المسودة أو الأعلى من الباقة لا تحصل على playback/license/download.

-- 13. إغلاق ترتيب الأقفال ودورة حياة التنزيل

-- الجدولة تبدأ بقفل الحساب قبل صف parent وأي صف ترخيص؛ هذا هو آخر تعريف نافذ.
CREATE OR REPLACE FUNCTION schedule_subscription_plan_change(
  p_parent_id UUID,
  p_new_plan subscription_plan,
  p_effective_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_plan subscription_plan;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));

  SELECT plan INTO v_current_plan
  FROM parents
  WHERE id = p_parent_id
  FOR UPDATE;
  IF v_current_plan IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;
  IF subscription_plan_rank(p_new_plan) >= subscription_plan_rank(v_current_plan) THEN
    RAISE EXCEPTION 'only downgrades require scheduling; apply upgrades directly';
  END IF;
  IF p_effective_at <= NOW() THEN
    RAISE EXCEPTION 'downgrade grace period must end in the future';
  END IF;

  UPDATE parents
  SET pending_plan = p_new_plan,
      plan_change_requested_at = NOW(),
      plan_change_effective_at = p_effective_at,
      updated_at = NOW()
  WHERE id = p_parent_id;

  UPDATE media_licenses
  SET expires_at = LEAST(expires_at, p_effective_at)
  WHERE parent_id = p_parent_id
    AND status = 'active'
    AND expires_at > p_effective_at;
END;
$$;

-- التنزيلات النهائية تحفظ التاريخ؛ إعادة التنزيل تنشئ صفًا جديدًا بترخيص جديد.
ALTER TABLE child_downloads
  DROP CONSTRAINT IF EXISTS child_downloads_child_id_entity_type_entity_id_device_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_child_downloads_one_live_copy
  ON child_downloads(child_id, entity_type, entity_id, device_id)
  WHERE status IN ('queued', 'downloading', 'ready');

ALTER TABLE child_downloads
  DROP CONSTRAINT IF EXISTS child_downloads_live_expiry_required;
ALTER TABLE child_downloads
  ADD CONSTRAINT child_downloads_live_expiry_required CHECK (
    status IN ('expired', 'failed') OR expires_at IS NOT NULL
  );

-- أي انتقال حي يعيد التحقق من الترخيص والجهاز والأصل؛ terminal لا يعود حيًا.
CREATE OR REPLACE FUNCTION enforce_child_download_device_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_child_parent UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'queued' THEN
    RAISE EXCEPTION 'new child download must start queued';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('expired', 'failed') THEN
      RAISE EXCEPTION 'terminal child download cannot be updated or reactivated';
    END IF;
    IF OLD.status = 'queued'
       AND NEW.status NOT IN ('queued', 'downloading', 'expired', 'failed') THEN
      RAISE EXCEPTION 'invalid child download transition from queued to %', NEW.status;
    END IF;
    IF OLD.status = 'downloading'
       AND NEW.status NOT IN ('downloading', 'ready', 'expired', 'failed') THEN
      RAISE EXCEPTION 'invalid child download transition from downloading to %', NEW.status;
    END IF;
    IF OLD.status = 'ready'
       AND NEW.status NOT IN ('ready', 'expired', 'failed') THEN
      RAISE EXCEPTION 'invalid child download transition from ready to %', NEW.status;
    END IF;
  END IF;

  IF NEW.status IN ('expired', 'failed') THEN
    NEW.expires_at := LEAST(COALESCE(NEW.expires_at, NOW()), NOW());
    RETURN NEW;
  END IF;

  IF NEW.expires_at IS NULL OR NEW.expires_at <= NOW() THEN
    RAISE EXCEPTION 'live child download requires a future expiry';
  END IF;

  SELECT parent_id INTO v_child_parent
  FROM children_profiles
  WHERE id = NEW.child_id AND entitlement_enabled = TRUE;

  IF v_child_parent IS NULL THEN RAISE EXCEPTION 'child is not entitled'; END IF;
  IF NOT content_is_entitled(v_child_parent, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'download content is not entitled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM media_licenses ml
    JOIN account_devices d ON d.id = ml.device_id AND d.parent_id = ml.parent_id
    WHERE ml.id = NEW.media_license_id
      AND ml.parent_id = v_child_parent
      AND ml.child_id = NEW.child_id
      AND ml.device_id = NEW.device_id
      AND ml.entity_type = NEW.entity_type
      AND ml.entity_id = NEW.entity_id
      AND ml.kind = 'offline'
      AND ml.status = 'active'
      AND ml.expires_at >= NEW.expires_at
      AND ml.expires_at > NOW()
      AND d.status = 'active'
      AND d.download_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'matching active offline license is required for live download';
  END IF;
  RETURN NEW;
END;
$$;

-- يشمل القفل والتحقق كل UPDATE، وبالأخص status/expires_at، لا حقول الهوية فقط.
DROP TRIGGER IF EXISTS aaa_child_download_device_serialization_lock ON child_downloads;
CREATE TRIGGER aaa_child_download_device_serialization_lock
BEFORE INSERT OR UPDATE ON child_downloads
FOR EACH ROW EXECUTE FUNCTION lock_download_device_serialization();

DROP TRIGGER IF EXISTS child_downloads_enforce_device_owner ON child_downloads;
CREATE TRIGGER child_downloads_enforce_device_owner
BEFORE INSERT OR UPDATE ON child_downloads
FOR EACH ROW EXECUTE FUNCTION enforce_child_download_device_owner();

-- صلاحية التنزيل قرار حي، لا تعتمد على status المخزنة وحدها عند تسليم الملف أو Signed URL.
CREATE OR REPLACE FUNCTION child_download_is_usable(p_download_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM child_downloads cd
    JOIN children_profiles cp ON cp.id = cd.child_id
    JOIN media_licenses ml ON ml.id = cd.media_license_id
    JOIN account_devices d ON d.id = cd.device_id
    WHERE cd.id = p_download_id
      AND cd.status IN ('queued', 'downloading', 'ready')
      AND cd.expires_at > NOW()
      AND cp.entitlement_enabled = TRUE
      AND ml.parent_id = cp.parent_id
      AND ml.child_id = cd.child_id
      AND ml.device_id = cd.device_id
      AND ml.entity_type = cd.entity_type
      AND ml.entity_id = cd.entity_id
      AND ml.kind = 'offline'
      AND ml.status = 'active'
      AND ml.expires_at >= cd.expires_at
      AND ml.expires_at > NOW()
      AND d.parent_id = cp.parent_id
      AND d.status = 'active'
      AND d.download_enabled = TRUE
      AND content_is_entitled(
        cp.parent_id, cd.child_id, cd.entity_type, cd.entity_id
      )
  );
$$;

-- كل تغيير شرعي على جهاز يبدأ account ثم device قبل DML؛ trigger يصبح دفاعًا إضافيًا.
CREATE OR REPLACE FUNCTION revoke_account_device(
  p_parent_id UUID,
  p_device_id TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id, 21));

  UPDATE account_devices
  SET status = 'revoked', revoked_at = NOW()
  WHERE id = p_device_id AND parent_id = p_parent_id AND status = 'active';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION set_account_device_download_enabled(
  p_parent_id UUID,
  p_device_id TEXT,
  p_enabled BOOLEAN
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id, 21));

  UPDATE account_devices
  SET download_enabled = p_enabled, last_seen_at = NOW()
  WHERE id = p_device_id AND parent_id = p_parent_id AND status = 'active';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION touch_account_device(
  p_parent_id UUID,
  p_device_id TEXT,
  p_display_name TEXT DEFAULT NULL,
  p_secure_playback_capable BOOLEAN DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_device_id, 21));

  UPDATE account_devices
  SET display_name = COALESCE(p_display_name, display_name),
      secure_playback_capable = COALESCE(
        p_secure_playback_capable, secure_playback_capable
      ),
      last_seen_at = NOW()
  WHERE id = p_device_id AND parent_id = p_parent_id AND status = 'active';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION end_playback_session(
  p_parent_id UUID,
  p_session_id UUID,
  p_session_token_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id TEXT;
BEGIN
  SELECT device_id INTO v_device_id
  FROM playback_sessions
  WHERE id = p_session_id
    AND parent_id = p_parent_id
    AND session_token_hash = p_session_token_hash;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));

  UPDATE playback_sessions
  SET status = 'ended', ended_at = NOW()
  WHERE id = p_session_id
    AND parent_id = p_parent_id
    AND device_id = v_device_id
    AND session_token_hash = p_session_token_hash
    AND status = 'active';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION terminate_media_license(
  p_parent_id UUID,
  p_license_id UUID,
  p_terminal_status media_license_status DEFAULT 'revoked'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id TEXT;
BEGIN
  IF p_terminal_status NOT IN ('expired', 'revoked') THEN
    RAISE EXCEPTION 'media license terminal status must be expired or revoked';
  END IF;

  SELECT device_id INTO v_device_id
  FROM media_licenses
  WHERE id = p_license_id AND parent_id = p_parent_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));

  UPDATE media_licenses
  SET status = p_terminal_status,
      revoked_at = COALESCE(revoked_at, NOW())
  WHERE id = p_license_id
    AND parent_id = p_parent_id
    AND device_id = v_device_id
    AND status = 'active';
  RETURN FOUND;
END;
$$;

-- العامل يستخدم CAS مع القفل الموحد؛ أي انتقال حي يعيد فحص الترخيص بعد انتظار revocation.
CREATE OR REPLACE FUNCTION transition_child_download(
  p_download_id UUID,
  p_expected_status TEXT,
  p_new_status TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_device_id TEXT;
BEGIN
  SELECT cp.parent_id, cd.device_id
  INTO v_parent_id, v_device_id
  FROM child_downloads cd
  JOIN children_profiles cp ON cp.id = cd.child_id
  WHERE cd.id = p_download_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));

  UPDATE child_downloads
  SET status = p_new_status
  WHERE id = p_download_id
    AND device_id = v_device_id
    AND status = p_expected_status;
  RETURN FOUND;
END;
$$;

-- يعالج الانتهاء الزمني؛ الاستدعاء الدوري يحسن الحالة المخزنة، بينما قرار التسليم الحي أعلاه إلزامي دائمًا.
CREATE OR REPLACE FUNCTION expire_child_download_if_invalid(p_download_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_device_id TEXT;
BEGIN
  SELECT cp.parent_id, cd.device_id
  INTO v_parent_id, v_device_id
  FROM child_downloads cd
  JOIN children_profiles cp ON cp.id = cd.child_id
  WHERE cd.id = p_download_id
    AND cd.status IN ('queued', 'downloading', 'ready');
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));

  IF child_download_is_usable(p_download_id) THEN RETURN FALSE; END IF;

  UPDATE child_downloads
  SET status = 'expired', expires_at = NOW()
  WHERE id = p_download_id
    AND device_id = v_device_id
    AND status IN ('queued', 'downloading', 'ready');
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION reconcile_invalid_child_downloads(
  p_limit INTEGER DEFAULT 500
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_download_id UUID;
  v_expired INTEGER := 0;
BEGIN
  IF p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'reconciliation limit must be between 1 and 1000';
  END IF;

  FOR v_download_id IN
    SELECT cd.id
    FROM child_downloads cd
    WHERE cd.status IN ('queued', 'downloading', 'ready')
      AND NOT child_download_is_usable(cd.id)
    ORDER BY cd.id
    LIMIT p_limit
  LOOP
    IF expire_child_download_if_invalid(v_download_id) THEN
      v_expired := v_expired + 1;
    END IF;
  END LOOP;
  RETURN v_expired;
END;
$$;

-- INSERT آمن عبر BEFORE trigger (account ثم device). كل UPDATE/DELETE تطبيقي يمر عبر RPC أعلاه.
REVOKE UPDATE, DELETE ON account_devices, playback_sessions, media_licenses, child_downloads
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION child_download_is_usable(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION revoke_account_device(UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION set_account_device_download_enabled(UUID, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION touch_account_device(UUID, TEXT, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION end_playback_session(UUID, UUID, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION terminate_media_license(UUID, UUID, media_license_status)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION transition_child_download(UUID, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION expire_child_download_if_invalid(UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION reconcile_invalid_child_downloads(INTEGER)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION child_download_is_usable(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION revoke_account_device(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION set_account_device_download_enabled(UUID, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION touch_account_device(UUID, TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION end_playback_session(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION terminate_media_license(UUID, UUID, media_license_status) TO service_role;
GRANT EXECUTE ON FUNCTION transition_child_download(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION expire_child_download_if_invalid(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_invalid_child_downloads(INTEGER) TO service_role;

-- قبول الإغلاق النهائي:
-- لا مسار UPDATE/DELETE تطبيقي يأخذ row lock قبل account/device advisory locks.
-- نجاح revocation يعني أن أي انتقال تنزيل متزامن ينتظر ثم يفشل إعادة التحقق أو يصبح terminal.
-- status المخزنة تُصالح دوريًا، لكن تسليم الملف يعتمد دائمًا child_download_is_usable الحي.
-- انتهاء/إلغاء الترخيص أو الجهاز لا يسمح بملف أو Signed URL حتى لو تأخر عامل المصالحة.


-- مزامنة الترخيص تمنع فجوة بين تقصير/إلغاء الترخيص والحالة المخزنة للتنزيل.
CREATE OR REPLACE FUNCTION cascade_media_license_download_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'active' AND NEW.status <> 'active' THEN
    UPDATE child_downloads
    SET status = 'expired', expires_at = NOW()
    WHERE media_license_id = NEW.id
      AND status IN ('queued', 'downloading', 'ready');
  ELSIF NEW.status = 'active' AND NEW.expires_at < OLD.expires_at THEN
    UPDATE child_downloads
    SET expires_at = LEAST(expires_at, NEW.expires_at)
    WHERE media_license_id = NEW.id
      AND status IN ('queued', 'downloading', 'ready')
      AND expires_at > NEW.expires_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_licenses_cascade_download_state ON media_licenses;
CREATE TRIGGER media_licenses_cascade_download_state
AFTER UPDATE OF status, expires_at ON media_licenses
FOR EACH ROW EXECUTE FUNCTION cascade_media_license_download_state();

-- تقصير الترخيص يحافظ على التنزيل حتى نهاية grace فقط؛ الإلغاء يحوله terminal في المعاملة نفسها.


-- 14. إغلاق grace للإصدارات الجديدة وحذف الجذور خلف قفل الحساب

-- تقصير lease فقط عملية آمنة حتى لو تغير نشر الأصل؛ كل تمديد/إصدار يعيد التحقق الكامل.
CREATE OR REPLACE FUNCTION enforce_playback_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_stream_limit SMALLINT;
  v_active_count INTEGER;
  v_plan_change_effective_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'new playback session must start active';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal playback session cannot be updated or reactivated';
  END IF;
  IF NEW.status <> 'active' THEN
    NEW.ended_at := COALESCE(NEW.ended_at, NOW());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.parent_id = NEW.parent_id
     AND OLD.child_id = NEW.child_id
     AND OLD.device_id = NEW.device_id
     AND OLD.entity_type = NEW.entity_type
     AND OLD.entity_id = NEW.entity_id
     AND OLD.cast_target = NEW.cast_target
     AND OLD.session_token_hash = NEW.session_token_hash
     AND OLD.started_at = NEW.started_at
     AND OLD.last_heartbeat_at = NEW.last_heartbeat_at
     AND OLD.ended_at IS NOT DISTINCT FROM NEW.ended_at
     AND NEW.lease_expires_at <= OLD.lease_expires_at THEN
    IF NEW.lease_expires_at <= NEW.last_heartbeat_at THEN
      RAISE EXCEPTION 'shortened playback lease must remain after last heartbeat';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.lease_expires_at <= NOW() THEN
    RAISE EXCEPTION 'playback lease expired; start a new session';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 12));
  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id AND parent_id = NEW.parent_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'device is not active for this parent';
  END IF;
  IF NOT content_is_entitled(NEW.parent_id, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'content is not entitled for this parent, child, or plan';
  END IF;

  SELECT p.plan, l.max_concurrent_streams, p.plan_change_effective_at
  INTO v_plan, v_stream_limit, v_plan_change_effective_at
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
    AND (p.pending_plan IS NULL OR p.plan_change_effective_at > NOW())
  FOR UPDATE OF p;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'subscription reconciliation required'; END IF;

  IF v_plan_change_effective_at IS NOT NULL THEN
    NEW.lease_expires_at := LEAST(
      NEW.lease_expires_at, v_plan_change_effective_at
    );
  END IF;
  IF NEW.lease_expires_at <= NEW.last_heartbeat_at THEN
    RAISE EXCEPTION 'lease_expires_at must be after last_heartbeat_at';
  END IF;

  UPDATE playback_sessions
  SET status = 'expired', ended_at = COALESCE(ended_at, NOW())
  WHERE parent_id = NEW.parent_id
    AND id <> NEW.id
    AND status = 'active'
    AND lease_expires_at <= NOW();

  SELECT count(*) INTO v_active_count
  FROM playback_sessions
  WHERE parent_id = NEW.parent_id
    AND status = 'active' AND lease_expires_at > NOW() AND id <> NEW.id;
  IF v_active_count >= v_stream_limit THEN
    RAISE EXCEPTION 'concurrent playback limit reached for plan % (maximum %)', v_plan, v_stream_limit;
  END IF;
  RETURN NEW;
END;
$$;

-- ترخيص جديد أثناء grace لا يمكن أن يتجاوز effective_at؛ تقصير قائم لا يحتاج إعادة استحقاق.
CREATE OR REPLACE FUNCTION enforce_media_license_device()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_download_limit SMALLINT;
  v_plan_change_effective_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'new media license must start active';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal media license cannot be updated or reactivated';
  END IF;
  IF NEW.status <> 'active' THEN
    NEW.revoked_at := COALESCE(NEW.revoked_at, NOW());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.parent_id = NEW.parent_id
     AND OLD.child_id = NEW.child_id
     AND OLD.device_id = NEW.device_id
     AND OLD.entity_type = NEW.entity_type
     AND OLD.entity_id = NEW.entity_id
     AND OLD.kind = NEW.kind
     AND OLD.provider_license_hash = NEW.provider_license_hash
     AND OLD.issued_at = NEW.issued_at
     AND OLD.revoked_at IS NOT DISTINCT FROM NEW.revoked_at
     AND NEW.expires_at <= OLD.expires_at
     AND NEW.expires_at > NOW() THEN
    RETURN NEW;
  END IF;

  SELECT l.max_download_devices, p.plan_change_effective_at
  INTO v_download_limit, v_plan_change_effective_at
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
    AND (p.pending_plan IS NULL OR p.plan_change_effective_at > NOW());
  IF v_download_limit IS NULL THEN RAISE EXCEPTION 'subscription reconciliation required'; END IF;

  IF v_plan_change_effective_at IS NOT NULL THEN
    NEW.expires_at := LEAST(NEW.expires_at, v_plan_change_effective_at);
  END IF;
  IF NEW.expires_at <= NOW() THEN
    RAISE EXCEPTION 'media license must expire in the future';
  END IF;
  IF NEW.kind = 'offline' AND v_download_limit = 0 THEN
    RAISE EXCEPTION 'offline licenses are not included in this plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id
      AND parent_id = NEW.parent_id
      AND status = 'active'
      AND (NEW.kind = 'online' OR download_enabled = TRUE)
  ) THEN
    RAISE EXCEPTION 'device is not eligible for this media license';
  END IF;
  IF NOT content_is_entitled(NEW.parent_id, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'content is not entitled for this parent, child, or plan';
  END IF;
  RETURN NEW;
END;
$$;

-- تقصير expires_at فقط لا يمنح وصولًا جديدًا، لذلك لا يفشل إن تغير النشر أثناء المصالحة.
CREATE OR REPLACE FUNCTION enforce_child_download_device_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_child_parent UUID;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'queued' THEN
    RAISE EXCEPTION 'new child download must start queued';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('expired', 'failed') THEN
      RAISE EXCEPTION 'terminal child download cannot be updated or reactivated';
    END IF;
    IF OLD.status = 'queued'
       AND NEW.status NOT IN ('queued', 'downloading', 'expired', 'failed') THEN
      RAISE EXCEPTION 'invalid child download transition from queued to %', NEW.status;
    END IF;
    IF OLD.status = 'downloading'
       AND NEW.status NOT IN ('downloading', 'ready', 'expired', 'failed') THEN
      RAISE EXCEPTION 'invalid child download transition from downloading to %', NEW.status;
    END IF;
    IF OLD.status = 'ready'
       AND NEW.status NOT IN ('ready', 'expired', 'failed') THEN
      RAISE EXCEPTION 'invalid child download transition from ready to %', NEW.status;
    END IF;
  END IF;

  IF NEW.status IN ('expired', 'failed') THEN
    NEW.expires_at := LEAST(COALESCE(NEW.expires_at, NOW()), NOW());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.child_id = NEW.child_id
     AND OLD.entity_type = NEW.entity_type
     AND OLD.entity_id = NEW.entity_id
     AND OLD.device_id = NEW.device_id
     AND OLD.media_license_id = NEW.media_license_id
     AND OLD.created_at = NEW.created_at
     AND NEW.expires_at <= OLD.expires_at
     AND NEW.expires_at > NOW() THEN
    RETURN NEW;
  END IF;

  IF NEW.expires_at IS NULL OR NEW.expires_at <= NOW() THEN
    RAISE EXCEPTION 'live child download requires a future expiry';
  END IF;

  SELECT parent_id INTO v_child_parent
  FROM children_profiles
  WHERE id = NEW.child_id AND entitlement_enabled = TRUE;
  IF v_child_parent IS NULL THEN RAISE EXCEPTION 'child is not entitled'; END IF;
  IF NOT content_is_entitled(v_child_parent, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'download content is not entitled';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM media_licenses ml
    JOIN account_devices d ON d.id = ml.device_id AND d.parent_id = ml.parent_id
    WHERE ml.id = NEW.media_license_id
      AND ml.parent_id = v_child_parent
      AND ml.child_id = NEW.child_id
      AND ml.device_id = NEW.device_id
      AND ml.entity_type = NEW.entity_type
      AND ml.entity_id = NEW.entity_id
      AND ml.kind = 'offline'
      AND ml.status = 'active'
      AND ml.expires_at >= NEW.expires_at
      AND ml.expires_at > NOW()
      AND d.status = 'active'
      AND d.download_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'matching active offline license is required for live download';
  END IF;
  RETURN NEW;
END;
$$;

-- آخر تعريف للجدولة: لا تمديد لمهلة سبق تثبيتها، وتقصير كل lease/license قائم إلى الموعد.
CREATE OR REPLACE FUNCTION schedule_subscription_plan_change(
  p_parent_id UUID,
  p_new_plan subscription_plan,
  p_effective_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_plan subscription_plan;
  v_pending_plan subscription_plan;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));

  SELECT plan, pending_plan
  INTO v_current_plan, v_pending_plan
  FROM parents
  WHERE id = p_parent_id
  FOR UPDATE;
  IF v_current_plan IS NULL THEN RAISE EXCEPTION 'parent not found'; END IF;
  IF v_pending_plan IS NOT NULL THEN
    RAISE EXCEPTION 'a subscription plan change is already scheduled';
  END IF;
  IF subscription_plan_rank(p_new_plan) >= subscription_plan_rank(v_current_plan) THEN
    RAISE EXCEPTION 'only downgrades require scheduling; apply upgrades directly';
  END IF;
  IF p_effective_at <= NOW() THEN
    RAISE EXCEPTION 'downgrade grace period must end in the future';
  END IF;

  UPDATE parents
  SET pending_plan = p_new_plan,
      plan_change_requested_at = NOW(),
      plan_change_effective_at = p_effective_at,
      updated_at = NOW()
  WHERE id = p_parent_id;

  UPDATE playback_sessions
  SET lease_expires_at = LEAST(lease_expires_at, p_effective_at)
  WHERE parent_id = p_parent_id
    AND status = 'active'
    AND lease_expires_at > p_effective_at;

  UPDATE media_licenses
  SET expires_at = LEAST(expires_at, p_effective_at)
  WHERE parent_id = p_parent_id
    AND status = 'active'
    AND expires_at > p_effective_at;
END;
$$;

-- Heartbeat يعيد فحص الموعد تحت account lock ولا يمدد lease بعد نهاية grace.
CREATE OR REPLACE FUNCTION renew_playback_lease(
  p_session_id UUID,
  p_session_token_hash TEXT,
  p_lease_seconds INTEGER DEFAULT 90
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
  v_device_id TEXT;
  v_status playback_session_status;
  v_expires TIMESTAMPTZ;
  v_plan_change_effective_at TIMESTAMPTZ;
  v_next_expires_at TIMESTAMPTZ;
BEGIN
  IF p_lease_seconds NOT BETWEEN 30 AND 120 THEN
    RAISE EXCEPTION 'lease seconds must be between 30 and 120';
  END IF;

  SELECT parent_id, device_id INTO v_parent_id, v_device_id
  FROM playback_sessions
  WHERE id = p_session_id AND session_token_hash = p_session_token_hash;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_parent_id::TEXT, 99));
  PERFORM pg_advisory_xact_lock(hashtextextended(v_device_id, 21));

  SELECT ps.status, ps.lease_expires_at, p.plan_change_effective_at
  INTO v_status, v_expires, v_plan_change_effective_at
  FROM playback_sessions ps
  JOIN parents p ON p.id = ps.parent_id
  WHERE ps.id = p_session_id
    AND ps.session_token_hash = p_session_token_hash
  FOR UPDATE OF ps, p;
  IF NOT FOUND OR v_status <> 'active' OR v_expires <= NOW() THEN RETURN FALSE; END IF;
  IF v_plan_change_effective_at IS NOT NULL
     AND v_plan_change_effective_at <= NOW() THEN
    RETURN FALSE;
  END IF;

  v_next_expires_at := NOW() + make_interval(secs => p_lease_seconds);
  IF v_plan_change_effective_at IS NOT NULL THEN
    v_next_expires_at := LEAST(v_next_expires_at, v_plan_change_effective_at);
  END IF;
  IF v_next_expires_at <= NOW() THEN RETURN FALSE; END IF;

  UPDATE playback_sessions
  SET last_heartbeat_at = NOW(),
      lease_expires_at = v_next_expires_at
  WHERE id = p_session_id;
  RETURN TRUE;
END;
$$;

-- حذف الطفل/الحساب يحتفظ بخصوصية المستخدم لكنه يبدأ account lock قبل أي root row أو cascade.
CREATE OR REPLACE FUNCTION delete_child_profile(
  p_parent_id UUID,
  p_child_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));

  DELETE FROM children_profiles
  WHERE id = p_child_id AND parent_id = p_parent_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION delete_parent_account(p_parent_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));

  DELETE FROM parents WHERE id = p_parent_id;
  RETURN FOUND;
END;
$$;

-- لا يستطيع أي دور تطبيقي تشغيل root cascade خارج مسار account-lock-first.
REVOKE DELETE ON parents, children_profiles
FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION delete_child_profile(UUID, UUID)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION delete_parent_account(UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_child_profile(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION delete_parent_account(UUID) TO service_role;

-- قبول الإغلاق:
-- أي license/playback يبدأ أثناء grace يُحد عند effective_at، وكل heartbeat يعيد فحص الموعد.
-- لا يمكن تمديد مهلة قائمة بإعادة الجدولة؛ الإلغاء/الترقية يعيدان إصدار تراخيص جديدة عند الحاجة.
-- تقصير lease/license/download لا يفشل بسبب تغير نشر الأصل لأنه لا يمنح وصولًا جديدًا.
-- parent/child DELETE المباشر مسحوب؛ حذف الخصوصية يمر فقط عبر RPC يحمل account lock.


-- 15. إغلاق UPDATE الخادمي المباشر وفصل تنظيف الجلسات عن مسار INSERT

-- لا ينظف BEFORE INSERT صفوفًا أخرى؛ المقاعد تحسب فقط leases الحية، والتنظيف عبر RPC أدناه.
CREATE OR REPLACE FUNCTION enforce_playback_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_plan subscription_plan;
  v_stream_limit SMALLINT;
  v_active_count INTEGER;
  v_plan_change_effective_at TIMESTAMPTZ;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'active' THEN
    RAISE EXCEPTION 'new playback session must start active';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal playback session cannot be updated or reactivated';
  END IF;
  IF NEW.status <> 'active' THEN
    NEW.ended_at := COALESCE(NEW.ended_at, NOW());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.parent_id = NEW.parent_id
     AND OLD.child_id = NEW.child_id
     AND OLD.device_id = NEW.device_id
     AND OLD.entity_type = NEW.entity_type
     AND OLD.entity_id = NEW.entity_id
     AND OLD.cast_target = NEW.cast_target
     AND OLD.session_token_hash = NEW.session_token_hash
     AND OLD.started_at = NEW.started_at
     AND OLD.last_heartbeat_at = NEW.last_heartbeat_at
     AND OLD.ended_at IS NOT DISTINCT FROM NEW.ended_at
     AND NEW.lease_expires_at <= OLD.lease_expires_at THEN
    IF NEW.lease_expires_at <= NEW.last_heartbeat_at THEN
      RAISE EXCEPTION 'shortened playback lease must remain after last heartbeat';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.lease_expires_at <= NOW() THEN
    RAISE EXCEPTION 'playback lease expired; start a new session';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.parent_id::TEXT, 12));
  IF NOT EXISTS (
    SELECT 1 FROM account_devices
    WHERE id = NEW.device_id AND parent_id = NEW.parent_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'device is not active for this parent';
  END IF;
  IF NOT content_is_entitled(NEW.parent_id, NEW.child_id, NEW.entity_type, NEW.entity_id) THEN
    RAISE EXCEPTION 'content is not entitled for this parent, child, or plan';
  END IF;

  SELECT p.plan, l.max_concurrent_streams, p.plan_change_effective_at
  INTO v_plan, v_stream_limit, v_plan_change_effective_at
  FROM parents p
  JOIN subscription_plan_limits l ON l.plan = p.plan
  WHERE p.id = NEW.parent_id
    AND (p.pending_plan IS NULL OR p.plan_change_effective_at > NOW())
  FOR UPDATE OF p;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'subscription reconciliation required'; END IF;

  IF v_plan_change_effective_at IS NOT NULL THEN
    NEW.lease_expires_at := LEAST(
      NEW.lease_expires_at, v_plan_change_effective_at
    );
  END IF;
  IF NEW.lease_expires_at <= NEW.last_heartbeat_at THEN
    RAISE EXCEPTION 'lease_expires_at must be after last_heartbeat_at';
  END IF;

  SELECT count(*) INTO v_active_count
  FROM playback_sessions
  WHERE parent_id = NEW.parent_id
    AND status = 'active'
    AND lease_expires_at > NOW()
    AND id <> NEW.id;
  IF v_active_count >= v_stream_limit THEN
    RAISE EXCEPTION 'concurrent playback limit reached for plan % (maximum %)', v_plan, v_stream_limit;
  END IF;
  RETURN NEW;
END;
$$;

-- عامل تنظيف صريح: account ثم device قبل قفل صف كل جلسة.
CREATE OR REPLACE FUNCTION expire_stale_playback_sessions(
  p_parent_id UUID,
  p_limit INTEGER DEFAULT 500
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_expired INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'playback reconciliation limit must be between 1 and 1000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_parent_id::TEXT, 99));

  FOR v_session IN
    SELECT id, device_id
    FROM playback_sessions
    WHERE parent_id = p_parent_id
      AND status = 'active'
      AND lease_expires_at <= NOW()
    ORDER BY id
    LIMIT p_limit
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_session.device_id, 21));

    UPDATE playback_sessions
    SET status = 'expired', ended_at = COALESCE(ended_at, NOW())
    WHERE id = v_session.id
      AND parent_id = p_parent_id
      AND device_id = v_session.device_id
      AND status = 'active'
      AND lease_expires_at <= NOW();
    IF FOUND THEN v_expired := v_expired + 1; END IF;
  END LOOP;
  RETURN v_expired;
END;
$$;

-- تحديث المسار العمري مهمة مالك الدالة فقط، لا يحتاج service_role إلى UPDATE مباشر على الجدول.
CREATE OR REPLACE FUNCTION refresh_child_age_tracks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  WITH calculated_ages AS (
    SELECT
      id,
      EXTRACT(YEAR FROM AGE(
        CURRENT_DATE,
        MAKE_DATE(birth_year, birth_month, 1)
      ))::INTEGER AS calculated_age
    FROM children_profiles
  ), eligible AS (
    SELECT
      id,
      CASE
        WHEN calculated_age BETWEEN 3 AND 5 THEN 'preschool'::age_track
        WHEN calculated_age BETWEEN 6 AND 8 THEN 'kids'::age_track
        WHEN calculated_age BETWEEN 9 AND 12 THEN 'junior'::age_track
      END AS next_track
    FROM calculated_ages
    WHERE calculated_age BETWEEN 3 AND 12
  )
  UPDATE children_profiles AS cp
  SET age_track = eligible.next_track,
      updated_at = NOW()
  FROM eligible
  WHERE cp.id = eligible.id
    AND cp.age_track IS DISTINCT FROM eligible.next_track;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- الباقة وpending وملكية الطفل وحقول الاستحقاق ليست قابلة للتعديل المباشر حتى من service_role.
REVOKE UPDATE ON parents, children_profiles
FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE ON subscription_plan_limits
FROM PUBLIC, anon, authenticated, service_role;

-- إعادة منح أعمدة الملف الآمنة فقط للمستخدم؛ REVOKE الجدولي لا يفتح أي عمود محمي.
GRANT UPDATE (display_name, locale, timezone, updated_at)
ON parents TO authenticated;
GRANT UPDATE (
  nickname, birth_month, birth_year, avatar_id,
  interests, language, onboarding_completed_at, updated_at
) ON children_profiles TO authenticated;

REVOKE ALL ON FUNCTION expire_stale_playback_sessions(UUID, INTEGER)
FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION refresh_child_age_tracks()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION expire_stale_playback_sessions(UUID, INTEGER)
TO service_role;
GRANT EXECUTE ON FUNCTION refresh_child_age_tracks()
TO service_role;

-- قبول الإغلاق النهائي:
-- service_role لا يغير plan/pending أو parent_id/age_track/entitlement_enabled مباشرة.
-- بدء playback يحتاج INSERT فقط ولا يفشل بسبب تنظيف صفوف أخرى؛ التنظيف SECURITY DEFINER مستقل.
-- حدود الباقات ثابتة لأدوار التطبيق وتُغيّر فقط بواسطة migration مالك المخطط.


-- Triggers التي تستخدم SELECT ... FOR UPDATE تنفذ بصلاحية مالك المخطط بعد سحب UPDATE من أدوار التطبيق.
ALTER FUNCTION enforce_children_limit() SECURITY DEFINER;
ALTER FUNCTION enforce_children_limit() SET search_path = public;
ALTER FUNCTION enforce_device_plan_limits() SECURITY DEFINER;
ALTER FUNCTION enforce_device_plan_limits() SET search_path = public;
ALTER FUNCTION enforce_playback_plan_limits() SECURITY DEFINER;
ALTER FUNCTION enforce_playback_plan_limits() SET search_path = public;

REVOKE ALL ON FUNCTION enforce_children_limit()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION enforce_device_plan_limits()
FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION enforce_playback_plan_limits()
FROM PUBLIC, anon, authenticated, service_role;

-- استدعاء trigger لا يعتمد على EXECUTE للمستخدم؛ السحب يمنع أي تعرض مباشر غير مقصود.


-- 16. تحصين SECURITY DEFINER ضد temp-schema shadowing

-- RLS helper يؤهل جدول الحقيقة صراحة؛ auth.uid() مؤهل أصلًا باسم schema.
CREATE OR REPLACE FUNCTION parent_owns_child(p_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children_profiles
    WHERE id = p_child_id AND parent_id = auth.uid()
  );
$$;

-- pg_temp مذكور أخيرًا حتى لا يسبق public ضمن السلوك الضمني لـPostgreSQL.
ALTER FUNCTION parent_owns_child(UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION apply_subscription_plan_change(UUID, subscription_plan, UUID[], TEXT[], TEXT[])
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION content_is_entitled(UUID, UUID, content_entity_type, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION schedule_subscription_plan_change(UUID, subscription_plan, TIMESTAMPTZ)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION renew_playback_lease(UUID, TEXT, INTEGER)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION child_download_is_usable(UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION revoke_account_device(UUID, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION set_account_device_download_enabled(UUID, TEXT, BOOLEAN)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION touch_account_device(UUID, TEXT, TEXT, BOOLEAN)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION end_playback_session(UUID, UUID, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION terminate_media_license(UUID, UUID, media_license_status)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION transition_child_download(UUID, TEXT, TEXT)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION expire_child_download_if_invalid(UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION reconcile_invalid_child_downloads(INTEGER)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION expire_stale_playback_sessions(UUID, INTEGER)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION refresh_child_age_tracks()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION delete_child_profile(UUID, UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION delete_parent_account(UUID)
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION enforce_children_limit()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION enforce_device_plan_limits()
  SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION enforce_playback_plan_limits()
  SET search_path = pg_catalog, public, pg_temp;

-- أدوار التطبيق لا تنشئ كائنات دائمة في public؛ migrations فقط تملك هذا الحق.
REVOKE CREATE ON SCHEMA public
FROM PUBLIC, anon, authenticated, service_role;

-- قبول التحصين:
-- إنشاء temp tables باسم parents/children_profiles/limits لا يغير RLS أو حساب الحدود.
-- كل SECURITY DEFINER يبحث pg_catalog ثم public، ولا يصل pg_temp إلا أخيرًا.