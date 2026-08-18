-- Question Bank — canonical assessment question model
-- Part of Learning Framework overhaul (Objectives → Content → Assessment → Attempt → Evidence → Mastery)

PRAGMA foreign_keys = ON;

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('MULTIPLE_CHOICE','TRUE_FALSE','ORDERING','MATCHING','IMAGE_CHOICE')),
  prompt_ar TEXT NOT NULL,
  prompt_en TEXT,
  explanation_ar TEXT,
  learning_objective_id TEXT REFERENCES learning_objectives(id) ON DELETE SET NULL,
  skill_id TEXT REFERENCES skills(id) ON DELETE SET NULL,
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','archived')),
  correct_answer TEXT NOT NULL DEFAULT '{}',
  distractors TEXT NOT NULL DEFAULT '[]',
  media_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  media_asset_ids TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (age_max >= age_min)
);

CREATE TABLE question_localizations (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ar','en','fr')),
  prompt TEXT NOT NULL,
  correct_answer TEXT NOT NULL DEFAULT '{}',
  distractors TEXT NOT NULL DEFAULT '[]',
  explanation TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (question_id, language)
);

CREATE TABLE question_reviews (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('edu','lang','sharia','qa')),
  reviewer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','needs_changes')),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE question_usage (
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('game','episode','project','story')),
  entity_id TEXT NOT NULL,
  PRIMARY KEY (question_id, entity_type, entity_id)
);

CREATE INDEX idx_questions_objective ON questions(learning_objective_id, status);
CREATE INDEX idx_questions_skill ON questions(skill_id, status);
CREATE INDEX idx_questions_type_status ON questions(type, status);
CREATE INDEX idx_questions_age ON questions(age_min, age_max);
CREATE INDEX idx_questions_created ON questions(created_at);
CREATE INDEX idx_question_localizations_lang ON question_localizations(language);
