-- 0062 — Publish drawing packs (OPS-002 / DECIDE-001 closed)
--
-- Ledger parity: 0058/0059/0060 dwell now recorded locally (62) and remotely
-- (62 after INSERT OR IGNORE recovery). This file was present in both ledgers
-- with no side-effect (idempotent UPDATE WHERE status IN (...)), validated in
-- the verified baseline where local already showed published shapes+numbers.
-- DECIDE-001 resolved as Option (a): read-only inspection -> ledger repair ->
-- additive publish. No staging env needed (package.json staging scripts
-- remain but are documented dead; wrangler.jsonc defines only production).
--
-- Idempotency: every UPDATE is WHERE status IN (draft,ready,review_*,qa),
-- every asset_links is INSERT OR REPLACE on stable id (al-*). Re-running
-- preserves IDs.

PRAGMA foreign_keys = ON;

-- 1) Drawing packs -> published (shapes + numbers vetted, SVGs ready since 0042/43/61)
UPDATE games SET status='published', updated_at=datetime('now')
WHERE id IN ('game-tc-shapes-basic','game-tc-numbers-1-10')
  AND status IN ('draft','ready','review_edu','review_lang','review_sharia','qa');

-- Cross-planet creative packs -> ready (sharia review pending for qisas is
-- editorial; ready surfaces in Creative Studio which filters ready+published)
UPDATE games SET status='ready', updated_at=datetime('now')
WHERE id IN ('game-qisas-story-response','game-oloom-observation-draw','game-alam-room-map')
  AND status IN ('draft','writing','review_edu','review_lang','production','qa');

-- Letter tracing stays draft (linguistic review pending — not bypassed).

-- 2) Reference activities -> published (0044 SVGs + 0061 asset_links)
UPDATE reference_activities SET status='published', updated_at=datetime('now')
WHERE status='ready';

-- 3) Authoritative asset_links for the drawing registry (Phase 4)
--    Stable IDs: al-{entity}-{role}. INSERT OR REPLACE preserves FK uniqueness.

-- Game covers / thumbnails
INSERT OR REPLACE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES
  ('al-tc-shapes-cover','asset-shape-cover','game','game-tc-shapes-basic','cover','',1),
  ('al-tc-shapes-thumb','asset-shape-cover','game','game-tc-shapes-basic','thumbnail','',2),
  ('al-tc-numbers-cover','asset-numbers-cover','game','game-tc-numbers-1-10','cover','',1),
  ('al-tc-numbers-thumb','asset-numbers-cover','game','game-tc-numbers-1-10','thumbnail','',2),
  ('al-qisas-cover','asset-qisas-cover','game','game-qisas-story-response','cover','',1),
  ('al-oloom-cover','asset-oloom-cover','game','game-oloom-observation-draw','cover','',1),
  ('al-alam-cover','asset-alam-map-cover','game','game-alam-room-map','cover','',1),
  ('al-letter-cover','asset-letters-cover','game','game-letter-tracing','cover','',1);
-- Number glyph templates (cover fallback is numbers-cover; templates are per-level)
INSERT OR REPLACE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES
  ('al-number-1-glyph','asset-number-1','game','game-tc-numbers-1-10','template','',10),
  ('al-number-2-glyph','asset-number-2','game','game-tc-numbers-1-10','template','',11),
  ('al-number-3-glyph','asset-number-3','game','game-tc-numbers-1-10','template','',12),
  ('al-number-4-glyph','asset-number-4','game','game-tc-numbers-1-10','template','',13),
  ('al-number-5-glyph','asset-number-5','game','game-tc-numbers-1-10','template','',14),
  ('al-number-6-glyph','asset-number-6','game','game-tc-numbers-1-10','template','',15),
  ('al-number-7-glyph','asset-number-7','game','game-tc-numbers-1-10','template','',16),
  ('al-number-8-glyph','asset-number-8','game','game-tc-numbers-1-10','template','',17),
  ('al-number-9-glyph','asset-number-9','game','game-tc-numbers-1-10','template','',18),
  ('al-number-10-glyph','asset-number-10','game','game-tc-numbers-1-10','template','',19);

-- Coloring templates (authoritative — 40 SVGs from 0043/61)
INSERT OR REPLACE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES
  ('al-coloring-bird','asset-color-bird','coloring_template','color-bird','template','',1),
  ('al-coloring-turtle','asset-color-turtle','coloring_template','color-turtle','template','',2),
  ('al-coloring-butterfly','asset-color-butterfly','coloring_template','color-butterfly','template','',3),
  ('al-coloring-cat','asset-color-cat','coloring_template','color-cat','template','',4),
  ('al-coloring-house','asset-color-house','coloring_template','color-house','template','',5),
  ('al-coloring-rocket','asset-color-rocket','coloring_template','color-rocket','template','',6);
