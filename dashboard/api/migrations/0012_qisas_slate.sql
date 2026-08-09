-- 0012 — qisas planet: schema prerequisites and the default visual style.
--
-- CORRECTED 2026-08-08. This migration previously could not be applied at all:
-- it inserted into `books` using `visual_style_id`, `languages` and `default_language`,
-- none of which any migration ever added, so it failed with
--   "table books has no column named visual_style_id: SQLITE_ERROR"
-- and blocked 0013 through 0017 behind it. It has never been applied in any environment,
-- because it cannot be: the columns do not exist in the schema 0001-0011 produce.
--
-- Two changes were made:
--
-- 1. The three missing columns are now added here, before they are used. That is the
--    real fix and it unblocks the whole chain.
--
-- 2. The 16 placeholder books it inserted were removed. They were explicitly labelled
--    "16 قصة placeholder" and modelled stories as `books` rows with `pages = '[]'`.
--    The qisas slate is now authored properly as `stories` + `story_pages` +
--    `story_page_localizations` under docs/content/planets/05-qisas/, with real
--    page-by-page text. Re-inserting placeholder duplicates would create two competing
--    sources of truth for the same content.
--
-- See 0013 for the matching correction to the page data.

ALTER TABLE books ADD COLUMN visual_style_id TEXT REFERENCES visual_styles(id) ON DELETE SET NULL;
ALTER TABLE books ADD COLUMN languages TEXT NOT NULL DEFAULT '["ar"]';
ALTER TABLE books ADD COLUMN default_language TEXT NOT NULL DEFAULT 'ar';

-- The default qisas visual style is legitimate and is kept.
INSERT OR IGNORE INTO visual_styles (id, slug, name_ar, name_en, medium, prompt_fragment, production_level, age_tracks, is_active)
VALUES ('style-qisas-default', 'qisas-default', 'أسلوب القصص الدافئ', 'Warm Stories', '2d', 'warm soft colors, gentle lighting, child-friendly', 'motion_story', '["preschool","kids","junior"]', 1);
