-- 0044 reference drawing activities + steps for Draw Like This
CREATE TABLE IF NOT EXISTS reference_activities (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title_ar TEXT NOT NULL,
  title_en TEXT,
  title_fr TEXT,
  description_ar TEXT,
  category TEXT NOT NULL CHECK (category IN ('حيوانات','فضاء','طبيعة','مركبات','بيت','زخارف','حيوانات سهلة','فضاء سهل')),
  age_min INTEGER NOT NULL CHECK (age_min BETWEEN 3 AND 12),
  age_max INTEGER NOT NULL CHECK (age_max BETWEEN 3 AND 12),
  difficulty TEXT NOT NULL CHECK (difficulty IN ('سهل','متوسط','مفصل')),
  reference_asset_id TEXT NOT NULL,
  thumbnail_asset_id TEXT NOT NULL,
  supported_modes TEXT NOT NULL, -- JSON array ["beside","ghost","steps"]
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','ready','published','archived')),
  content_class TEXT DEFAULT 'original',
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reference_steps (
  id TEXT PRIMARY KEY,
  activity_id TEXT NOT NULL REFERENCES reference_activities(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  title_ar TEXT,
  instruction_ar TEXT NOT NULL,
  instruction_en TEXT,
  instruction_fr TEXT,
  reference_asset_id TEXT,
  overlay_asset_id TEXT,
  audio_asset_id TEXT,
  UNIQUE(activity_id, step_order)
);

-- Seed 30 reference activities (using coloring asset ids as reference art, already ready)
INSERT OR IGNORE INTO reference_activities (id, slug, title_ar, title_en, category, age_min, age_max, difficulty, reference_asset_id, thumbnail_asset_id, supported_modes, status) VALUES
 ('ref-cat','cat','قطة','Cat','حيوانات',4,5,'سهل','asset-color-cat','asset-color-cat','["beside","ghost","steps"]','ready'),
 ('ref-lion','lion','أسد','Lion','حيوانات',6,7,'متوسط','asset-color-lion','asset-color-lion','["beside","ghost"]','ready'),
 ('ref-turtle','turtle','سلحفاة','Turtle','حيوانات',4,5,'سهل','asset-color-turtle','asset-color-turtle','["beside","ghost","steps"]','ready'),
 ('ref-butterfly','butterfly','فراشة','Butterfly','حيوانات',6,7,'متوسط','asset-color-butterfly','asset-color-butterfly','["beside","ghost"]','ready'),
 ('ref-rabbit','rabbit','أرنب','Rabbit','حيوانات',4,5,'سهل','asset-color-rabbit','asset-color-rabbit','["beside","ghost"]','ready'),
 ('ref-elephant','elephant','فيل','Elephant','حيوانات',8,9,'مفصل','asset-color-elephant','asset-color-elephant','["beside"]','ready'),
 ('ref-owl','owl','بومة','Owl','حيوانات',6,7,'متوسط','asset-color-owl','asset-color-owl','["beside","ghost"]','ready'),
 ('ref-horse','horse','حصان','Horse','حيوانات',8,9,'مفصل','asset-color-horse','asset-color-horse','["beside"]','ready'),
 ('ref-rocket','rocket','صاروخ','Rocket','فضاء',6,7,'متوسط','asset-color-rocket','asset-color-rocket','["beside","ghost","steps"]','ready'),
 ('ref-planet','planet','كوكب','Planet','فضاء',4,5,'سهل','asset-color-planet','asset-color-planet','["beside","ghost"]','ready'),
 ('ref-moon','moon','قمر','Moon','فضاء',4,5,'سهل','asset-color-moon','asset-color-moon','["beside","ghost"]','ready'),
 ('ref-astronaut','astronaut','رائد فضاء','Astronaut','فضاء',8,9,'مفصل','asset-color-astronaut','asset-color-astronaut','["beside"]','ready'),
 ('ref-telescope','telescope','تلسكوب','Telescope','فضاء',6,7,'متوسط','asset-color-telescope','asset-color-telescope','["beside"]','ready'),
 ('ref-tree','tree','شجرة','Tree','طبيعة',4,5,'سهل','asset-color-tree','asset-color-tree','["beside","ghost","steps"]','ready'),
 ('ref-flower','flower','زهرة','Flower','طبيعة',4,5,'سهل','asset-color-flower','asset-color-flower','["beside","ghost","steps"]','ready'),
 ('ref-sea','sea','بحر','Sea','طبيعة',6,7,'متوسط','asset-color-sea','asset-color-sea','["beside"]','ready'),
 ('ref-mountain','mountain','جبل','Mountain','طبيعة',6,7,'متوسط','asset-color-mountain','asset-color-mountain','["beside"]','ready'),
 ('ref-rainbow','rainbow','قوس قزح','Rainbow','طبيعة',8,9,'مفصل','asset-color-rainbow','asset-color-rainbow','["beside"]','ready'),
 ('ref-car','car','سيارة','Car','مركبات',4,5,'سهل','asset-color-car','asset-color-car','["beside","ghost","steps"]','ready'),
 ('ref-train','train','قطار','Train','مركبات',6,7,'متوسط','asset-color-train','asset-color-train','["beside"]','ready'),
 ('ref-airplane','airplane','طائرة','Airplane','مركبات',6,7,'متوسط','asset-color-airplane','asset-color-airplane','["beside"]','ready'),
 ('ref-boat','boat','قارب','Boat','مركبات',4,5,'سهل','asset-color-boat','asset-color-boat','["beside","ghost"]','ready'),
 ('ref-apple','apple','تفاحة','Apple','بيت',4,5,'سهل','asset-color-apple','asset-color-apple','["beside","ghost"]','ready'),
 ('ref-book','book','كتاب','Book','بيت',4,5,'سهل','asset-color-book','asset-color-book','["beside"]','ready'),
 ('ref-house2','house2','منزل','House','بيت',6,7,'متوسط','asset-color-house','asset-color-house','["beside","ghost","steps"]','ready'),
 ('ref-lamp','lamp','مصباح','Lamp','بيت',6,7,'متوسط','asset-color-lamp','asset-color-lamp','["beside"]','ready'),
 ('ref-mosque','mosque','مسجد مبسط','Mosque','زخارف',8,9,'مفصل','asset-color-mosque','asset-color-mosque','["beside"]','ready'),
 ('ref-lantern','lantern','فانوس','Lantern','زخارف',6,7,'متوسط','asset-color-lantern','asset-color-lantern','["beside"]','ready'),
 ('ref-crescent','crescent','هلال ونجمة','Crescent','زخارف',4,5,'سهل','asset-color-crescent','asset-color-crescent','["beside","ghost"]','ready'),
 ('ref-arabesque','arabesque','زخرفة','Arabesque','زخارف',8,9,'مفصل','asset-color-arabesque','asset-color-arabesque','["beside"]','ready');

-- Steps for 8 step activities
INSERT OR IGNORE INTO reference_steps (id, activity_id, step_order, instruction_ar) VALUES
 ('step-cat-1','ref-cat',1,'ارسم الرأس دائرة'),
 ('step-cat-2','ref-cat',2,'أضف الأذنين'),
 ('step-cat-3','ref-cat',3,'ارسم الجسم بيضاوي'),
 ('step-cat-4','ref-cat',4,'أضف الذيل والأرجل'),
 ('step-cat-5','ref-cat',5,'ارسم الوجه'),
 ('step-house-1','ref-house2',1,'ارسم الجدران مربع'),
 ('step-house-2','ref-house2',2,'أضف السقف مثلث'),
 ('step-house-3','ref-house2',3,'ارسم الباب'),
 ('step-house-4','ref-house2',4,'أضف النوافذ'),
 ('step-rocket-1','ref-rocket',1,'ارسم الجسم'),
 ('step-rocket-2','ref-rocket',2,'أضف النافذة'),
 ('step-rocket-3','ref-rocket',3,'ارسم الزعانف'),
 ('step-rocket-4','ref-rocket',4,'أضف اللهب'),
 ('step-fish-1','ref-boat',1,'ارسم الجسم بيضاوي'),
 ('step-fish-2','ref-boat',2,'أضف الذيل'),
 ('step-fish-3','ref-boat',3,'ارسم الزعانف'),
 ('step-flower-1','ref-flower',1,'ارسم المركز دائرة'),
 ('step-flower-2','ref-flower',2,'أضف بتلة'),
 ('step-flower-3','ref-flower',3,'أضف باقي البتلات'),
 ('step-flower-4','ref-flower',4,'ارسم الساق'),
 ('step-tree-1','ref-tree',1,'ارسم الجذع'),
 ('step-tree-2','ref-tree',2,'ارسم الأوراق دائرة كبيرة'),
 ('step-tree-3','ref-tree',3,'أضف تفاصيل'),
 ('step-car-1','ref-car',1,'ارسم الجسم'),
 ('step-car-2','ref-car',2,'أضف العجلات'),
 ('step-car-3','ref-car',3,'ارسم النوافذ'),
 ('step-butterfly-1','ref-butterfly',1,'ارسم الجسم'),
 ('step-butterfly-2','ref-butterfly',2,'أضف الجناح العلوي'),
 ('step-butterfly-3','ref-butterfly',3,'أضف الجناح السفلي');

CREATE INDEX IF NOT EXISTS idx_ref_activity_category ON reference_activities(category);
CREATE INDEX IF NOT EXISTS idx_ref_activity_age ON reference_activities(age_min, age_max);
CREATE INDEX IF NOT EXISTS idx_ref_steps_activity ON reference_steps(activity_id, step_order);
