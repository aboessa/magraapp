-- Allow generated/uploaded cover assets to link directly to seeded books.
-- SQLite CHECK constraints require rebuilding the table.
CREATE TABLE asset_links_v2 (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('landing', 'planet', 'category', 'series', 'season', 'episode', 'character', 'story', 'story_page', 'game', 'book', 'project')),
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (asset_id, entity_type, entity_id, role, language)
);

INSERT INTO asset_links_v2 (id, asset_id, entity_type, entity_id, role, language, sort_order, created_at)
SELECT id, asset_id, entity_type, entity_id, role, language, sort_order, created_at
FROM asset_links;

DROP TABLE asset_links;
ALTER TABLE asset_links_v2 RENAME TO asset_links;
CREATE INDEX idx_asset_links_entity ON asset_links(entity_type, entity_id, role);
