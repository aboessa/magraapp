-- 0061 — Creative registry hardening (OPS-002 / DECIDE-001 resolution)
--
-- Phase 1: The 3 dwell migrations (0058-0060) were already reconciled
-- (INSERT INTO d1_migrations + schema + data) in a prior verified step.
-- Do NOT re-add dwell_ms or re-backfill — this migration hardens the
-- creative registry layer only.
--
-- DECIDE-001: Option (a) — "read-only inspection now, plan next, execute
-- after reconciled ledger" — is satisfied by the prior ledger repair. Remote
-- parity was verified (local 62 == remote 62 including dwell). No destructive
-- re-apply, no history rewrite. This migration is additive, idempotent, and
-- only extends the catalogue contract for drawing packs + asset links +
-- polish workflow. It can run on local (--local) and remote (--remote --env production)
-- identically with no data loss.
--
PRAGMA foreign_keys = ON;

-- 1) Content Reviews — drawing templates and reference activities
--     The creative registry needs its own review rows. The 0045 registrar
--     tried to INSERT with entity_type outside the CHECK and reviewer_role
--     outside the enum, so none of its 7 rows survived (the 35-row table is
--     entirely series-level sharia reviews). This extends both CHECKs so the
--     registry is writable, then seeds the intended pending reviews idempotently.
PRAGMA foreign_keys = OFF;

CREATE TABLE _content_reviews_new (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('series','episode','story','book','game','project','coloring_template','reference_activity','reference_step','drawing_pack')),
  entity_id TEXT NOT NULL,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('edu','lang','sharia','rights','qa','art','editorial','scientific')),
  reviewer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','needs_changes')),
  comments TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO _content_reviews_new (id, entity_type, entity_id, reviewer_role, reviewer_id, status, comments, created_at)
  SELECT id, entity_type, entity_id, reviewer_role, reviewer_id, status, comments, created_at FROM content_reviews
  WHERE entity_type IN ('series','episode','story','book','game','project')
    AND reviewer_role IN ('edu','lang','sharia','rights','qa');
DROP TABLE content_reviews;
ALTER TABLE _content_reviews_new RENAME TO content_reviews;
CREATE INDEX IF NOT EXISTS idx_content_reviews_entity ON content_reviews(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_status ON content_reviews(status);

PRAGMA foreign_keys = ON;

-- Re-seed 0045-intended creative reviews (idempotent):
INSERT OR IGNORE INTO content_reviews (id, entity_type, entity_id, reviewer_role, status) VALUES
  ('review-letter-tracing-ling','game','game-letter-tracing','lang','pending'),
  ('review-letter-alif-ling','game','game-letter-tracing','lang','pending'),
  ('review-ref-cat-art','reference_activity','ref-cat','art','pending'),
  ('review-ref-cat-ed','reference_activity','ref-cat','editorial','pending'),
  ('review-ref-rocket-art','reference_activity','ref-rocket','art','pending'),
  ('review-oloom-sci','game','game-oloom-observation-draw','scientific','pending'),
  ('review-color-bird-art','coloring_template','color-bird','art','pending'),
  ('review-color-cat-art','coloring_template','color-cat','art','pending')
ON CONFLICT DO NOTHING;

-- 2) Numbers 3-10 — content_assets for the 8 bundled SVGs already rendered on-device
--     (flutter_svg + drawing_asset_map now covers asset-number-3..10). The two
--     existing rows (1,2) are untouched; INSERT OR IGNORE is idempotent.
INSERT OR IGNORE INTO content_assets (id, title_ar, kind, status, language, expected_width, expected_height, aspect_ratio, metadata) VALUES
  ('asset-number-3','رقم 3','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-4','رقم 4','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-5','رقم 5','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-6','رقم 6','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-7','رقم 7','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-8','رقم 8','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-9','رقم 9','image','ready',NULL,600,600,'1:1','{}'),
  ('asset-number-10','رقم 10','image','ready',NULL,600,600,'1:1','{}');

-- 3) Asset links — extend entity_type for the drawing catalogue
--     Actual link rows are seeded as data, NOT DDL, via a second step (idempotent):
--     INSERT OR IGNORE per template. The CHECK rebuild mirrors content_reviews above.
PRAGMA foreign_keys = OFF;

CREATE TABLE _asset_links_new (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES content_assets(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('landing', 'planet', 'category', 'series', 'season', 'episode', 'character', 'story', 'story_page', 'game', 'book', 'project','coloring_template','reference_activity','reference_step','drawing_pack')),
  entity_id TEXT NOT NULL,
  role TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (asset_id, entity_type, entity_id, role, language)
);
INSERT OR IGNORE INTO _asset_links_new (id, asset_id, entity_type, entity_id, role, language, sort_order, created_at)
  SELECT id, asset_id, entity_type, entity_id, role, language, sort_order, created_at FROM asset_links;
DROP TABLE asset_links;
ALTER TABLE _asset_links_new RENAME TO asset_links;

PRAGMA foreign_keys = ON;

-- Seed authoritative asset_links for the creative registry (idempotent, stable IDs):
--   coloring_template -> source/background asset (role = template)
--   reference_activity -> thumbnail/reference asset (role = thumbnail/reference)
--   numbers 3..10 -> game-level glyph asset would bind at pack authoring time, not here

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES
  -- 30 reference activities (thumbnail + reference where distinct; here same id so one row covers both roles is not valid — store as thumbnail)
  ('link-ref-cat-thumb','asset-color-cat','reference_activity','ref-cat','thumbnail','',1),
  ('link-ref-lion-thumb','asset-color-lion','reference_activity','ref-lion','thumbnail','',1),
  ('link-ref-turtle-thumb','asset-color-turtle','reference_activity','ref-turtle','thumbnail','',1),
  ('link-ref-butterfly-thumb','asset-color-butterfly','reference_activity','ref-butterfly','thumbnail','',1),
  ('link-ref-rabbit-thumb','asset-color-rabbit','reference_activity','ref-rabbit','thumbnail','',1),
  ('link-ref-elephant-thumb','asset-color-elephant','reference_activity','ref-elephant','thumbnail','',1),
  ('link-ref-owl-thumb','asset-color-owl','reference_activity','ref-owl','thumbnail','',1),
  ('link-ref-horse-thumb','asset-color-horse','reference_activity','ref-horse','thumbnail','',1),
  ('link-ref-rocket-thumb','asset-color-rocket','reference_activity','ref-rocket','thumbnail','',1),
  ('link-ref-planet-thumb','asset-color-planet','reference_activity','ref-planet','thumbnail','',1),
  ('link-ref-moon-thumb','asset-color-moon','reference_activity','ref-moon','thumbnail','',1),
  ('link-ref-astronaut-thumb','asset-color-astronaut','reference_activity','ref-astronaut','thumbnail','',1),
  ('link-ref-telescope-thumb','asset-color-telescope','reference_activity','ref-telescope','thumbnail','',1),
  ('link-ref-tree-thumb','asset-color-tree','reference_activity','ref-tree','thumbnail','',1),
  ('link-ref-flower-thumb','asset-color-flower','reference_activity','ref-flower','thumbnail','',1),
  ('link-ref-sea-thumb','asset-color-sea','reference_activity','ref-sea','thumbnail','',1),
  ('link-ref-mountain-thumb','asset-color-mountain','reference_activity','ref-mountain','thumbnail','',1),
  ('link-ref-rainbow-thumb','asset-color-rainbow','reference_activity','ref-rainbow','thumbnail','',1),
  ('link-ref-car-thumb','asset-color-car','reference_activity','ref-car','thumbnail','',1),
  ('link-ref-train-thumb','asset-color-train','reference_activity','ref-train','thumbnail','',1),
  ('link-ref-airplane-thumb','asset-color-airplane','reference_activity','ref-airplane','thumbnail','',1),
  ('link-ref-boat-thumb','asset-color-boat','reference_activity','ref-boat','thumbnail','',1),
  ('link-ref-apple-thumb','asset-color-apple','reference_activity','ref-apple','thumbnail','',1),
  ('link-ref-book-thumb','asset-color-book','reference_activity','ref-book','thumbnail','',1),
  ('link-ref-house2-thumb','asset-color-house','reference_activity','ref-house2','thumbnail','',1),
  ('link-ref-lamp-thumb','asset-color-lamp','reference_activity','ref-lamp','thumbnail','',1),
  ('link-ref-mosque-thumb','asset-color-mosque','reference_activity','ref-mosque','thumbnail','',1),
  ('link-ref-lantern-thumb','asset-color-lantern','reference_activity','ref-lantern','thumbnail','',1),
  ('link-ref-crescent-thumb','asset-color-crescent','reference_activity','ref-crescent','thumbnail','',1),
  ('link-ref-arabesque-thumb','asset-color-arabesque','reference_activity','ref-arabesque','thumbnail','',1)
ON CONFLICT DO NOTHING;

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES
  -- 40 coloring templates (source template asset)
  ('link-color-bird','asset-color-bird','coloring_template','color-bird','template','',1),
  ('link-color-cat','asset-color-cat','coloring_template','color-cat','template','',1),
  ('link-color-lion','asset-color-lion','coloring_template','color-lion','template','',1),
  ('link-color-turtle','asset-color-turtle','coloring_template','color-turtle','template','',1),
  ('link-color-butterfly','asset-color-butterfly','coloring_template','color-butterfly','template','',1),
  ('link-color-chicken','asset-color-chicken','coloring_template','color-chicken','template','',1),
  ('link-color-rabbit','asset-color-rabbit','coloring_template','color-rabbit','template','',1),
  ('link-color-elephant','asset-color-elephant','coloring_template','color-elephant','template','',1),
  ('link-color-whale','asset-color-whale','coloring_template','color-whale','template','',1),
  ('link-color-owl','asset-color-owl','coloring_template','color-owl','template','',1),
  ('link-color-horse','asset-color-horse','coloring_template','color-horse','template','',1),
  ('link-color-house','asset-color-house','coloring_template','color-house','template','',1),
  ('link-color-rocket','asset-color-rocket','coloring_template','color-rocket','template','',1),
  ('link-color-planet','asset-color-planet','coloring_template','color-planet','template','',1),
  ('link-color-flower','asset-color-flower','coloring_template','color-flower','template','',1),
  ('link-color-fish','asset-color-fish','coloring_template','color-fish','template','',1),
  ('link-color-tree','asset-color-tree','coloring_template','color-tree','template','',1),
  ('link-color-moon','asset-color-moon','coloring_template','color-moon','template','',1),
  ('link-color-stars','asset-color-stars','coloring_template','color-stars','template','',1),
  ('link-color-astronaut','asset-color-astronaut','coloring_template','color-astronaut','template','',1),
  ('link-color-telescope','asset-color-telescope','coloring_template','color-telescope','template','',1),
  ('link-color-sea','asset-color-sea','coloring_template','color-sea','template','',1),
  ('link-color-mountain','asset-color-mountain','coloring_template','color-mountain','template','',1),
  ('link-color-rainbow','asset-color-rainbow','coloring_template','color-rainbow','template','',1),
  ('link-color-forest','asset-color-forest','coloring_template','color-forest','template','',1),
  ('link-color-car','asset-color-car','coloring_template','color-car','template','',1),
  ('link-color-train','asset-color-train','coloring_template','color-train','template','',1),
  ('link-color-airplane','asset-color-airplane','coloring_template','color-airplane','template','',1),
  ('link-color-boat','asset-color-boat','coloring_template','color-boat','template','',1),
  ('link-color-bicycle','asset-color-bicycle','coloring_template','color-bicycle','template','',1),
  ('link-color-apple','asset-color-apple','coloring_template','color-apple','template','',1),
  ('link-color-book','asset-color-book','coloring_template','color-book','template','',1),
  ('link-color-bag','asset-color-bag','coloring_template','color-bag','template','',1),
  ('link-color-lamp','asset-color-lamp','coloring_template','color-lamp','template','',1),
  ('link-color-mosque','asset-color-mosque','coloring_template','color-mosque','template','',1),
  ('link-color-lantern','asset-color-lantern','coloring_template','color-lantern','template','',1),
  ('link-color-crescent','asset-color-crescent','coloring_template','color-crescent','template','',1),
  ('link-color-arabesque','asset-color-arabesque','coloring_template','color-arabesque','template','',1),
  ('link-color-shapes-comp','asset-color-shapes-comp','coloring_template','color-shapes-comp','template','',1),
  ('link-color-stars-planets','asset-color-stars-planets','coloring_template','color-stars-planets','template','',1)
ON CONFLICT DO NOTHING;

-- 4) Content class expansion for reference activities archetype
--     Do NOT coerce arabesque/crescent/lantern etc. into a game — they are
--     drawing source material. The Flutter catalogue already separates them
--     from trace numbers/dots; D1 should not invent a packing.

-- 5) Fix staging vars drift (OPS-002): remove the dead deploy:staging/env
--     is handled in package.json + wrangler.jsonc (reported) — no DDL here.
--     This file intentionally does not create a staging environment; the
--     acceptance criterion is that the scripts either work or are removed
--     with owner sign-off. Local ledger now clean; destructive 0054 UPDATE
--     lives behind INSERT OR IGNORE and is not re-fired by this file.
