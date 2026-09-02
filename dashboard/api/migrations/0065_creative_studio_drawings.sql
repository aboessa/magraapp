-- 0065 Creative Studio Drawings — R2-first catalog for all studio activities
-- 0064 كان ai_providers meta، تم حل التعارض بتغيير رقم هذا الملف.
-- No assets bundled in APK; all loaded from THUMBS_BUCKET via PUBLIC_ASSET_BASE_URL (cdn.majarra.app).
-- Supports all 10 studio categories: coloring, trace, letters, numbers,
-- connect_dots, complete, copy_pattern, free_draw, prompt_draw, draw_like_me
-- + legacy coloring sub buckets birds/animals/vehicles/space/flowers/sea/fruits/toys -> كلها R2.

CREATE TABLE IF NOT EXISTS creative_drawings (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN (
    'coloring','trace','letters','numbers','connect_dots','complete',
    'copy_pattern','free_draw','prompt_draw','draw_like_me',
    'birds','animals','vehicles','space','flowers','sea','fruits','toys'
  )),
  sub_category TEXT,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  description_ar TEXT,
  age_min INTEGER NOT NULL DEFAULT 3 CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL DEFAULT 12 CHECK (age_max BETWEEN 3 AND 12),
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard','سهل','متوسط','مفصل')),
  -- R2 keys in THUMBS_BUCKET (public CDN). Never MEDIA_BUCKET (entitlements).
  -- Example: public/studio/coloring/bird.png, public/studio/trace/zebra-trace.png
  r2_key TEXT NOT NULL,
  thumb_r2_key TEXT,
  transparent_r2_key TEXT,
  original_url TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'thumbs' CHECK (storage_bucket IN ('thumbs','media')),
  -- payload per category
  palette_json TEXT,
  geometry_json TEXT,
  extra_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','ready','published','archived')),
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_new INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  tags TEXT,
  prompt_key TEXT,
  background_asset TEXT,
  asset_id TEXT,
  playveo_job_id TEXT,
  playveo_cost REAL,
  generated_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cd_category ON creative_drawings(category);
CREATE INDEX IF NOT EXISTS idx_cd_status ON creative_drawings(status);
CREATE INDEX IF NOT EXISTS idx_cd_featured ON creative_drawings(is_featured, status);
CREATE INDEX IF NOT EXISTS idx_cd_subcat ON creative_drawings(sub_category);
CREATE INDEX IF NOT EXISTS idx_cd_sort ON creative_drawings(sort_order);

-- Trigger moved to separate statement after initial deploy to avoid wrangler single-statement splitter issue
-- Applied manually via: CREATE TRIGGER ... — see below (removed from batch to fix SQLITE_ERROR 7500)

-- Seed coloring v2 entries — placeholders CDN-ready. Real PNGs transparent after remove-background upload to R2.
INSERT OR IGNORE INTO creative_drawings (id, category, sub_category, title_ar, title_en, age_min, age_max, difficulty, r2_key, thumb_r2_key, palette_json, status, is_featured, is_new, sort_order, tags, asset_id) VALUES
 ('coloring-bird',   'coloring','birds','عصفور صغير','Little Bird',3,5,'سهل','public/studio/coloring/bird.png','public/studio/coloring/thumbs/bird.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',1,1,1,'طيور,حيوانات','asset-color-bird'),
 ('coloring-cat',    'coloring','animals','قطة لطيفة','Cute Cat',3,5,'سهل','public/studio/coloring/cat.png','public/studio/coloring/thumbs/cat.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',1,1,2,'حيوانات,قطط','asset-color-cat'),
 ('coloring-dino',   'coloring','animals','ديناصور','Dino',4,7,'سهل','public/studio/coloring/dino.png','public/studio/coloring/thumbs/dino.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',1,1,3,'حيوانات,ديناصور',''),
 ('coloring-fish',   'coloring','sea','سمكة','Fish',3,5,'سهل','public/studio/coloring/fish.png','public/studio/coloring/thumbs/fish.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',1,1,4,'بحر,اسماك',''),
 ('coloring-vehicles','coloring','vehicles','مركبات','Vehicles',4,8,'متوسط','public/studio/coloring/vehicles.png','public/studio/coloring/thumbs/vehicles.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',1,1,5,'مركبات,سيارات',''),
 ('coloring-space',  'coloring','space','الفضاء','Space',5,9,'متوسط','public/studio/coloring/space.png','public/studio/coloring/thumbs/space.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',1,0,6,'فضاء,صواريخ',''),
 ('coloring-flowers','coloring','flowers','زهور','Flowers',3,6,'سهل','public/studio/coloring/flowers.png','public/studio/coloring/thumbs/flowers.webp','["#FF7E3A","#FFD400","#FF3E78","#2EAC5A","#6A3DF2"]','ready',1,0,7,'زهور,طبيعة',''),
 ('coloring-animals','coloring','animals','حيوانات','Animals',3,6,'متوسط','public/studio/coloring/animals.png','public/studio/coloring/thumbs/animals.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',0,0,10,'حيوانات',''),
 ('coloring-birds',  'coloring','birds','طيور','Birds',3,6,'متوسط','public/studio/coloring/birds.png','public/studio/coloring/thumbs/birds.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2","#FF3E78","#111111","#FF8F2A"]','ready',0,0,11,'طيور',''),
 ('coloring-sea',    'coloring','sea','حيوانات بحرية','Sea Animals',4,8,'متوسط','public/studio/coloring/sea.png','public/studio/coloring/thumbs/sea.webp','["#2B5AD8","#00D6F5","#FFD400","#2EAC5A","#6A3DF2"]','ready',0,0,12,'بحر,اخطبوط',''),
 ('coloring-fruits', 'coloring','fruits','فواكه','Fruits',3,5,'سهل','public/studio/coloring/fruits.png','public/studio/coloring/thumbs/fruits.webp','["#FF3E78","#FFD400","#2EAC5A","#FF7E3A","#6A3DF2"]','ready',0,0,13,'فواكه,طعام',''),
 ('coloring-toys',   'coloring','toys','ألعاب','Toys',3,5,'سهل','public/studio/coloring/toys.png','public/studio/coloring/thumbs/toys.webp','["#2B5AD8","#FF7E3A","#FFD400","#2EAC5A","#6A3DF2"]','ready',0,0,14,'ألعاب,دمى','');

-- Hero for coloring home page (free_draw category, tagged is_hero)
INSERT OR IGNORE INTO creative_drawings (id, category, title_ar, title_en, age_min, age_max, difficulty, r2_key, status, is_featured, is_new, sort_order, extra_json) VALUES
 ('hero-coloring','free_draw','صورة هيرو التلوين','Coloring Hero',3,12,'سهل','public/studio/heroes/coloring-hero.png','ready',1,0,0,'{"is_hero":true}');

-- Initial rows for other studio activities (trace / letters / numbers / connect_dots / complete / copy_pattern)
-- These start as draft so admin can upload / generate later without blocking launch.
INSERT OR IGNORE INTO creative_drawings (id, category, title_ar, title_en, age_min, age_max, difficulty, r2_key, status, sort_order) VALUES
 ('trace-cat','trace','تتبّع قطة','Trace Cat',3,6,'سهل','public/studio/trace/trace-cat.png','draft',1),
 ('trace-star','trace','تتبّع نجمة','Trace Star',3,6,'سهل','public/studio/trace/trace-star.png','draft',2),
 ('letters-alif','letters','حرف الألف','Letter Alif',3,6,'سهل','public/studio/letters/alif.png','draft',1),
 ('numbers-one','numbers','رقم 1','Number One',3,6,'سهل','public/studio/numbers/one.png','draft',1),
 ('connect-dots-1','connect_dots','وصل النقاط - نجمة','Connect Dots Star',4,8,'متوسط','public/studio/connect_dots/dots-star.png','draft',1),
 ('complete-house','complete','أكمل البيت','Complete House',4,8,'متوسط','public/studio/complete/house.png','draft',1);
