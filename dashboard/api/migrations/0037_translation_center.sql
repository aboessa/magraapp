-- Translation Center — source version → translation → review → approved localization

PRAGMA foreign_keys = ON;

CREATE TABLE translation_units (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('planet','series','season','episode','story','story_page','book','book_page','game','game_level','question','website_page','blog_post','campaign')),
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'ar' CHECK (source_language IN ('ar','en','fr')),
  source_text TEXT NOT NULL,
  source_version INTEGER NOT NULL DEFAULT 1,
  target_language TEXT NOT NULL CHECK (target_language IN ('ar','en','fr')),
  target_text TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_translation','ready_for_review','changes_requested','approved','stale')),
  translator_id TEXT,
  reviewer_id TEXT,
  is_reauthor INTEGER NOT NULL DEFAULT 0 CHECK (is_reauthor IN (0,1)),
  due_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(entity_type, entity_id, field, target_language)
);

CREATE TABLE glossary_terms (
  id TEXT PRIMARY KEY,
  source_term TEXT NOT NULL,
  source_language TEXT NOT NULL DEFAULT 'ar',
  translations TEXT NOT NULL DEFAULT '{}',
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global','planet','series','game','religious')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('character','planet','educational','islamic','scientific','ui','general')),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('draft','approved','deprecated')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_term, scope)
);

CREATE TABLE translation_memory (
  id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  target_text TEXT NOT NULL,
  entity_type TEXT,
  usage_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_text, source_language, target_language)
);

CREATE TABLE translation_reviews (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES translation_units(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('lang','edu','sharia','qa')),
  reviewer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','needs_changes')),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_translation_units_entity ON translation_units(entity_type, entity_id);
CREATE INDEX idx_translation_units_status ON translation_units(status, target_language);
CREATE INDEX idx_translation_units_stale ON translation_units(status) WHERE status='stale';
CREATE INDEX idx_glossary_term ON glossary_terms(source_term);
CREATE INDEX idx_tm_source ON translation_memory(source_text, source_language, target_language);

-- Seed glossary: character names and islamic terms that must not be auto-translated
INSERT OR IGNORE INTO glossary_terms (id, source_term, source_language, translations, scope, category, status, notes) VALUES
  ('gloss-luna','لونا','ar','{"en":"Luna","fr":"Luna"}','global','character','approved','Planet abjad character — do not translate literally'),
  ('gloss-nour','نورا','ar','{"en":"Noura","fr":"Noura"}','global','character','approved','Character name'),
  ('gloss-basmala','بسم الله الرحمن الرحيم','ar','{"en":"In the name of Allah, the Most Gracious, the Most Merciful","fr":"Au nom d’Allah, le Tout Miséricordieux, le Très Miséricordieux"}','global','islamic','approved','Quranic phrase — approved translation only, requires sharia review'),
  ('gloss-game-start','ابدأ اللعب','ar','{"en":"Start playing","fr":"Commencer à jouer"}','global','ui','approved','Game UI term');
