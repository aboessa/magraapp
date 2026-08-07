-- Islamic world governance: 11 conditional fields blocking publish without approval
-- source_type, source_reference, verse_surah/ayah, hadith_collection/number/grade, reviewer, version, approved_at, visual_restrictions

ALTER TABLE series ADD COLUMN source_type TEXT CHECK (source_type IN ('quran', 'hadith', 'sira', 'adab', 'general'));
ALTER TABLE series ADD COLUMN source_reference TEXT;
ALTER TABLE series ADD COLUMN verse_surah INTEGER;
ALTER TABLE series ADD COLUMN verse_ayah INTEGER;
ALTER TABLE series ADD COLUMN hadith_collection TEXT;
ALTER TABLE series ADD COLUMN hadith_number TEXT;
ALTER TABLE series ADD COLUMN hadith_grade TEXT;
ALTER TABLE series ADD COLUMN religious_reviewer_id TEXT;
ALTER TABLE series ADD COLUMN religious_reviewer_version INTEGER DEFAULT 1;
ALTER TABLE series ADD COLUMN religious_approved_at TEXT;
ALTER TABLE series ADD COLUMN visual_restrictions TEXT; -- JSON array

ALTER TABLE episodes ADD COLUMN source_type TEXT CHECK (source_type IN ('quran', 'hadith', 'sira', 'adab', 'general'));
ALTER TABLE episodes ADD COLUMN source_reference TEXT;
ALTER TABLE episodes ADD COLUMN religious_reviewer_id TEXT;
ALTER TABLE episodes ADD COLUMN religious_approved_at TEXT;

-- Validation trigger: block publish without religious approval when track includes islamic world
-- Enforcement is in adminContent.ts before-publish validator; this migration only adds columns
CREATE INDEX IF NOT EXISTS idx_series_islamic_review ON series(religious_reviewer_id, religious_approved_at);
CREATE INDEX IF NOT EXISTS idx_episodes_islamic_review ON episodes(religious_reviewer_id, religious_approved_at);
