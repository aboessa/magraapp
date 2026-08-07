-- Add the shared content lifecycle to books, games, and projects.
-- updated_at is backfilled separately because SQLite cannot add a column
-- with a non-constant datetime default to an existing table.
ALTER TABLE books ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived'));
ALTER TABLE books ADD COLUMN updated_at TEXT;
UPDATE books SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE games ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived'));
ALTER TABLE games ADD COLUMN updated_at TEXT;
UPDATE games SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published', 'archived'));
ALTER TABLE projects ADD COLUMN updated_at TEXT;
UPDATE projects SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX idx_books_status_updated ON books(status, updated_at);
CREATE INDEX idx_games_status_updated ON games(status, updated_at);
CREATE INDEX idx_projects_status_updated ON projects(status, updated_at);
