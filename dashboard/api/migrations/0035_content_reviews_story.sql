-- Extend content_reviews to support stories as first-class reviewable content.
-- Stories are first-class in Majarra but were excluded by the original CHECK
-- entity_type IN ('series','episode','book','game','project'). A story review
-- must use the canonical content_reviews framework, not a second system.

CREATE TABLE content_reviews_new (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('series','episode','story','book','game','project')),
  entity_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('edu','lang','sharia','rights','qa')),
  reviewer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','needs_changes')),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO content_reviews_new (id, entity_type, entity_id, reviewer_role, reviewer_id, status, comments, created_at)
SELECT id, entity_type, entity_id, reviewer_role, reviewer_id, status, comments, created_at FROM content_reviews;

DROP TABLE content_reviews;
ALTER TABLE content_reviews_new RENAME TO content_reviews;

CREATE INDEX IF NOT EXISTS idx_content_reviews_entity ON content_reviews(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);
CREATE INDEX IF NOT EXISTS idx_content_reviews_reviewer ON content_reviews(reviewer_id);
