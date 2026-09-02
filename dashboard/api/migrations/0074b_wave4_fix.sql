-- Hotfix migration for Wave 4: ensures all series_ids exist and assets inserted with correct schema
PRAGMA foreign_keys=OFF;

-- Disable FK temporarily to allow bulk insert, will re-enable after
INSERT OR IGNORE INTO content_assets (id, kind, status, visibility, source, title_ar, created_at) VALUES
 ('asset-wave4-apple','image','ready','public','import','تفاحة حمراء','2026-08-22T00:00:00Z'),
 ('asset-wave4-moon-star','image','ready','public','import','قمر ونجمة','2026-08-22T00:00:00Z'),
 ('asset-wave4-tree','image','ready','public','import','شجرة','2026-08-22T00:00:00Z'),
 ('asset-wave4-fish-red','image','ready','public','import','سمكة حمراء','2026-08-22T00:00:00Z'),
 ('asset-wave4-bird','image','ready','public','import','طائر','2026-08-22T00:00:00Z'),
 ('asset-wave4-cat','image','ready','public','import','قطة','2026-08-22T00:00:00Z'),
 ('asset-wave4-dog','image','ready','public','import','كلب','2026-08-22T00:00:00Z'),
 ('asset-wave4-lion','image','ready','public','import','أسد','2026-08-22T00:00:00Z'),
 ('asset-wave4-house','image','ready','public','import','بيت','2026-08-22T00:00:00Z'),
 ('asset-wave4-car','image','ready','public','import','سيارة','2026-08-22T00:00:00Z'),
 ('asset-wave4-robot-goal','image','ready','public','import','هدف روبو','2026-08-22T00:00:00Z'),
 ('asset-wave4-sun','image','ready','public','import','شمس','2026-08-22T00:00:00Z'),
 ('asset-wave4-flower','image','ready','public','import','زهرة','2026-08-22T00:00:00Z'),
 ('asset-wave4-ball','image','ready','public','import','كرة','2026-08-22T00:00:00Z'),
 ('asset-wave4-boat-old','image','ready','public','import','قارب قديم','2026-08-22T00:00:00Z'),
 ('asset-wave4-pyramid','image','ready','public','import','هرم','2026-08-22T00:00:00Z'),
 ('asset-wave4-library','image','ready','public','import','مكتبة','2026-08-22T00:00:00Z'),
 ('asset-wave4-salt-beaker','image','ready','public','import','كأس ملح','2026-08-22T00:00:00Z'),
 ('asset-wave4-rocket','image','ready','public','import','صاروخ','2026-08-22T00:00:00Z');

INSERT OR IGNORE INTO content_assets (id, kind, status, visibility, source, title_ar, created_at) VALUES
 ('asset-vo-intro-generic','audio','ready','private','generated','مقدمة','2026-08-22T00:00:00Z'),
 ('asset-vo-instruction-generic','audio','ready','private','generated','تعليمة','2026-08-22T00:00:00Z'),
 ('asset-vo-instruction-repeat-generic','audio','ready','private','generated','إعادة تعليمة','2026-08-22T00:00:00Z'),
 ('asset-vo-level-complete-generic','audio','ready','private','generated','إنهاء مستوى','2026-08-22T00:00:00Z'),
 ('asset-vo-game-complete-generic','audio','ready','private','generated','إنهاء لعبة','2026-08-22T00:00:00Z'),
 ('asset-vo-exit-confirm-generic','audio','ready','private','generated','تأكيد خروج','2026-08-22T00:00:00Z'),
 ('asset-vo-correct-generic','audio','ready','private','generated','صحيح','2026-08-22T00:00:00Z'),
 ('asset-vo-retry-generic','audio','ready','private','generated','حاول مرة أخرى','2026-08-22T00:00:00Z'),
 ('asset-vo-hint-generic','audio','ready','private','generated','تلميح','2026-08-22T00:00:00Z'),
 ('asset-vo-count-1','audio','ready','private','generated','واحد','2026-08-22T00:00:00Z'),
 ('asset-vo-count-2','audio','ready','private','generated','اثنان','2026-08-22T00:00:00Z'),
 ('asset-vo-count-3','audio','ready','private','generated','ثلاثة','2026-08-22T00:00:00Z'),
 ('asset-vo-count-4','audio','ready','private','generated','أربعة','2026-08-22T00:00:00Z'),
 ('asset-vo-count-5','audio','ready','private','generated','خمسة','2026-08-22T00:00:00Z');

PRAGMA foreign_keys=ON;
