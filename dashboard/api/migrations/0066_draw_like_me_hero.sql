-- 0066 Draw Like Me — Hero + screenshot-matched grid (nano banana 2)
-- Hero banner: kid at desk drawing bird, navy cosmic. Grid 6: عصفور/سيارة/فراشة/صاروخ/قطة/نجمة
-- All under draw_like_me, R2 THUMBS_BUCKET public/studio/draw_like_me/*
INSERT OR IGNORE INTO creative_drawings (id, category, title_ar, title_en, age_min, age_max, difficulty, r2_key, thumb_r2_key, transparent_r2_key, status, is_featured, is_new, sort_order, tags, asset_id) VALUES
  ('hero-draw-like-me','draw_like_me','ارسم مثلي — راقب ثم ارسم','Draw Like Me Hero',3,12,'سهل','public/studio/heroes/draw-like-me-hero.webp','public/studio/heroes/draw-like-me-hero.webp',NULL,'ready',1,1,0,'hero,ارسم مثلي','hero-draw-like-me'),
  ('ref-bird','draw_like_me','عصفور','Bird',4,6,'سهل','public/studio/draw_like_me/bird.png','public/studio/draw_like_me/thumbs/bird.webp','public/studio/draw_like_me/bird-transparent.png','ready',1,1,1,'طبيعة,طيور,سهل','asset-color-bird'),
  ('ref-star','draw_like_me','نجمة','Star',3,5,'سهل','public/studio/draw_like_me/star.png','public/studio/draw_like_me/thumbs/star.webp','public/studio/draw_like_me/star-transparent.png','ready',1,1,2,'فضاء,نجوم,سهل','asset-color-star'),
  ('ref-cat-v2','draw_like_me','قطة','Cat',4,6,'سهل','public/studio/draw_like_me/cat.png','public/studio/draw_like_me/thumbs/cat.webp','public/studio/draw_like_me/cat-transparent.png','ready',1,0,3,'حيوانات,سهل','asset-color-cat'),
  ('ref-rocket-v2','draw_like_me','صاروخ','Rocket',5,7,'متوسط','public/studio/draw_like_me/rocket.png','public/studio/draw_like_me/thumbs/rocket.webp','public/studio/draw_like_me/rocket-transparent.png','ready',1,0,4,'فضاء,متوسط','asset-color-rocket'),
  ('ref-car-v2','draw_like_me','سيارة','Car',4,6,'سهل','public/studio/draw_like_me/car.png','public/studio/draw_like_me/thumbs/car.webp','public/studio/draw_like_me/car-transparent.png','ready',1,0,5,'مركبات,سهل','asset-color-car'),
  ('ref-butterfly-v2','draw_like_me','فراشة','Butterfly',5,7,'متوسط','public/studio/draw_like_me/butterfly.png','public/studio/draw_like_me/thumbs/butterfly.webp','public/studio/draw_like_me/butterfly-transparent.png','ready',1,0,6,'حيوانات,متوسط','asset-color-butterfly');

-- Update existing ref-* to published if they were seeded as draft elsewhere
UPDATE creative_drawings SET status='ready' WHERE id IN ('ref-cat','ref-rocket','ref-butterfly','ref-car') AND status='draft';
