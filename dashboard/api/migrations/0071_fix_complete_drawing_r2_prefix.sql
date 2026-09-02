-- 0071 Fix complete-drawing R2 keys — add the missing `public/studio/` prefix
--
-- WHY
-- ---
-- 0069 seeded all 50 "أكمل الرسمة" rows with keys like
--     complete-drawing/butterfly-01/challenge.png
-- but every other creative_drawings row, and the CDN layout itself, uses
--     public/studio/{category}/...
-- The result: all 50 rows returned HTTP 200 from the API while every single
-- image URL 404'd on cdn.majarra.app (verified: coloring 12/12 ok,
-- draw_like_me 51/51 ok, complete 0/50 ok).
--
-- The prefix is authoritative from three places, not a guess:
--   1. adminCreativeStudio.ts:14 documents `public/studio/{category}/{id}.{ext}`
--      and r2KeyFor() builds exactly that for every admin upload.
--   2. The live coloring / draw_like_me rows serve `public/studio/...` and 200.
--   3. app_main/assets/data/complete_items.json already expects
--      `public/studio/complete-drawing/{id}/challenge.png`.
-- The 150 objects are uploaded at that prefix, so D1 is the last piece that
-- still disagrees.
--
-- 0069 is left untouched on purpose: it is already applied to production, and
-- rewriting applied migration history would leave fresh databases and existing
-- ones on different code paths. This migration corrects forward instead.
--
-- Idempotent: each statement is guarded by a LIKE on the unprefixed form, so
-- re-running it (or running it on a fresh DB right after 0069) cannot
-- double-prefix a key.

UPDATE creative_drawings
SET r2_key = 'public/studio/' || r2_key
WHERE category = 'complete'
  AND r2_key LIKE 'complete-drawing/%';

UPDATE creative_drawings
SET thumb_r2_key = 'public/studio/' || thumb_r2_key
WHERE category = 'complete'
  AND thumb_r2_key LIKE 'complete-drawing/%';

-- extra_json carries the answer-key path ("reference_full"), which the reader
-- needs alongside the challenge image.
UPDATE creative_drawings
SET extra_json = replace(extra_json, '"complete-drawing/', '"public/studio/complete-drawing/')
WHERE category = 'complete'
  AND extra_json LIKE '%"complete-drawing/%';
