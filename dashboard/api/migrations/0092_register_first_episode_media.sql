-- 0092_register_first_episode_media.sql
--
-- `DATA-201`: تسجيل وسائط الحلقات الأولى الـ33 — من SQL يدويّ إلى ترحيلٍ مُسجَّل.
--
-- ## العلّة
--
-- إنتاج الفيديو في 2026-09-03 سجّل وسائطه في الإنتاج بأربعة ملفات SQL شُغِّلت
-- **بيدٍ** من `tools/ops/`، وكلّها **غير متتبَّعة في git**:
--
--   link-episodes.sql             66 رابط أصل (33 stream + 33 thumbnail)
--   thumbs-register.sql           33 أصل مصغَّرة
--   update-sizes.sql              33 تحديث حجم
--   mark-33-episodes-english.sql  وسم اللغة + مسارات صوت إنجليزية
--
-- والمستودع يملك سجلّ ترحيلات وحرسًا في CI وبوابة بناءٍ من الصفر، وُجدت كلّها
-- لأن بناء القاعدة من الصفر كان مستحيلًا (`DB-104`). ثم صار تسجيل المحتوى يجري
-- من خارج `migrations/` وخارج git — فالقدرة التي دُفع ثمنها، إعادة بناء الإنتاج
-- من المستودع، تُنقَض كلّما شُغِّل أحد هذه الملفات، ولا شيء يسجّل أنه شُغِّل.
--
-- ## ما لا يفعله هذا الترحيل، ولماذا
--
-- **لا يُنشئ صفوف أصول الفيديو `ca-episode-*-1080p` ولا `episode_renditions`.**
-- قِيس: لا ملف في المستودع كلّه يُنشئها — لا في `tools/` ولا في `migrations/`.
-- أي أن صفوفًا في الإنتاج **أصلُها غير قابل للتوليد من المستودع**، وهذا هو الضرر
-- الحقيقي في `DATA-201` لا عَرَضه. ولم أختلق لها r2_key ولا mime ولا حجمًا:
-- بياناتٌ مُختلَقة في ترحيل أسوأ من فجوةٍ مُعلَنة.
--
-- ## لماذا كل عبارة آمنة على قاعدةٍ بُنيت من الصفر
--
-- * أصول المصغَّرات: `INSERT OR IGNORE`، ولا تعتمد على شيء.
-- * الروابط: `INSERT ... SELECT ... WHERE EXISTS(episode) AND EXISTS(asset)` —
--   فعلى قاعدةٍ بلا أصول فيديو تصير الـ33 رابط stream **لا-عملية** بدل انتهاك
--   مفتاح أجنبي يوقف `migrate:local` كما أوقفه `0074` من قبل.
-- * الأحجام ووسم اللغة: `UPDATE ... WHERE` — تمسّ ما يوجد ولا تُنشئ شيئًا.
-- * مسارات الصوت: `INSERT OR IGNORE ... SELECT FROM episode_renditions` — فارغة
--   حين لا renditions.
--
-- والإعادة آمنة: `OR IGNORE` على المفاتيح، و`UPDATE` إلى نفس القيمة.

-- ═══ 1) أصول المصغَّرات (33) ═══
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-body-01-heart-thumb','episode-body-01-heart thumb','image','generated','ready','episode-body-01-heart.jpg','public/episodes/episode-body-01-heart/thumb.jpg','thumbs','image/jpeg',79782,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-body-02-five-senses-thumb','episode-body-02-five-senses thumb','image','generated','ready','episode-body-02-five-senses.jpg','public/episodes/episode-body-02-five-senses/thumb.jpg','thumbs','image/jpeg',86988,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-body-03-breathing-thumb','episode-body-03-breathing thumb','image','generated','ready','episode-body-03-breathing.jpg','public/episodes/episode-body-03-breathing/thumb.jpg','thumbs','image/jpeg',94813,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-hekaya-01-lost-bag-thumb','episode-hekaya-01-lost-bag thumb','image','generated','ready','episode-hekaya-01-lost-bag.jpg','public/episodes/episode-hekaya-01-lost-bag/thumb.jpg','thumbs','image/jpeg',119282,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-hekaya-02-sharing-colors-thumb','episode-hekaya-02-sharing-colors thumb','image','generated','ready','episode-hekaya-02-sharing-colors.jpg','public/episodes/episode-hekaya-02-sharing-colors/thumb.jpg','thumbs','image/jpeg',116244,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-hekaya-03-waiting-turn-thumb','episode-hekaya-03-waiting-turn thumb','image','generated','ready','episode-hekaya-03-waiting-turn.jpg','public/episodes/episode-hekaya-03-waiting-turn/thumb.jpg','thumbs','image/jpeg',128451,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-hekaya-04-plant-responsibility-thumb','episode-hekaya-04-plant-responsibility thumb','image','generated','ready','episode-hekaya-04-plant-responsibility.jpg','public/episodes/episode-hekaya-04-plant-responsibility/thumb.jpg','thumbs','image/jpeg',102434,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-home-01-walking-water-thumb','episode-home-01-walking-water thumb','image','generated','ready','episode-home-01-walking-water.jpg','public/episodes/episode-home-01-walking-water/thumb.jpg','thumbs','image/jpeg',95354,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-home-02-magnet-test-thumb','episode-home-02-magnet-test thumb','image','generated','ready','episode-home-02-magnet-test.jpg','public/episodes/episode-home-02-magnet-test/thumb.jpg','thumbs','image/jpeg',126291,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-home-03-float-or-sink-thumb','episode-home-03-float-or-sink thumb','image','generated','ready','episode-home-03-float-or-sink.jpg','public/episodes/episode-home-03-float-or-sink/thumb.jpg','thumbs','image/jpeg',102759,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-home-04-growing-seed-thumb','episode-home-04-growing-seed thumb','image','generated','ready','episode-home-04-growing-seed.jpg','public/episodes/episode-home-04-growing-seed/thumb.jpg','thumbs','image/jpeg',97881,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-civilizations-01-water-engineering-thumb','episode-junior-civilizations-01-water-engineering thumb','image','generated','ready','episode-junior-civilizations-01-water-engineering.jpg','public/episodes/episode-junior-civilizations-01-water-engineering/thumb.jpg','thumbs','image/jpeg',110906,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-civilizations-02-observatory-thumb','episode-junior-civilizations-02-observatory thumb','image','generated','ready','episode-junior-civilizations-02-observatory.jpg','public/episodes/episode-junior-civilizations-02-observatory/thumb.jpg','thumbs','image/jpeg',115948,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-code-01-sequence-path-thumb','episode-junior-code-01-sequence-path thumb','image','generated','ready','episode-junior-code-01-sequence-path.jpg','public/episodes/episode-junior-code-01-sequence-path/thumb.jpg','thumbs','image/jpeg',111250,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-code-02-debug-the-route-thumb','episode-junior-code-02-debug-the-route thumb','image','generated','ready','episode-junior-code-02-debug-the-route.jpg','public/episodes/episode-junior-code-02-debug-the-route/thumb.jpg','thumbs','image/jpeg',116871,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-future-01-solar-rover-thumb','episode-junior-future-01-solar-rover thumb','image','generated','ready','episode-junior-future-01-solar-rover.jpg','public/episodes/episode-junior-future-01-solar-rover/thumb.jpg','thumbs','image/jpeg',109534,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-future-02-strong-bridge-thumb','episode-junior-future-02-strong-bridge thumb','image','generated','ready','episode-junior-future-02-strong-bridge.jpg','public/episodes/episode-junior-future-02-strong-bridge/thumb.jpg','thumbs','image/jpeg',96786,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-minute-01-light-refraction-thumb','episode-junior-minute-01-light-refraction thumb','image','generated','ready','episode-junior-minute-01-light-refraction.jpg','public/episodes/episode-junior-minute-01-light-refraction/thumb.jpg','thumbs','image/jpeg',68998,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-junior-minute-02-air-pressure-thumb','episode-junior-minute-02-air-pressure thumb','image','generated','ready','episode-junior-minute-02-air-pressure.jpg','public/episodes/episode-junior-minute-02-air-pressure/thumb.jpg','thumbs','image/jpeg',86596,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-kids-explorers-01-picture-clues-thumb','episode-kids-explorers-01-picture-clues thumb','image','generated','ready','episode-kids-explorers-01-picture-clues.jpg','public/episodes/episode-kids-explorers-01-picture-clues/thumb.jpg','thumbs','image/jpeg',83039,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-kids-explorers-02-teamwork-bridge-thumb','episode-kids-explorers-02-teamwork-bridge thumb','image','generated','ready','episode-kids-explorers-02-teamwork-bridge.jpg','public/episodes/episode-kids-explorers-02-teamwork-bridge/thumb.jpg','thumbs','image/jpeg',135894,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-numbers-01-counting-stars-thumb','episode-numbers-01-counting-stars thumb','image','generated','ready','episode-numbers-01-counting-stars.jpg','public/episodes/episode-numbers-01-counting-stars/thumb.jpg','thumbs','image/jpeg',129027,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-numbers-02-more-or-less-thumb','episode-numbers-02-more-or-less thumb','image','generated','ready','episode-numbers-02-more-or-less.jpg','public/episodes/episode-numbers-02-more-or-less/thumb.jpg','thumbs','image/jpeg',122391,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-numbers-03-shape-bridge-thumb','episode-numbers-03-shape-bridge thumb','image','generated','ready','episode-numbers-03-shape-bridge.jpg','public/episodes/episode-numbers-03-shape-bridge/thumb.jpg','thumbs','image/jpeg',98651,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-numbers-04-combining-groups-thumb','episode-numbers-04-combining-groups thumb','image','generated','ready','episode-numbers-04-combining-groups.jpg','public/episodes/episode-numbers-04-combining-groups/thumb.jpg','thumbs','image/jpeg',86409,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-calm-01-bird-home-thumb','episode-preschool-calm-01-bird-home thumb','image','generated','ready','episode-preschool-calm-01-bird-home.jpg','public/episodes/episode-preschool-calm-01-bird-home/thumb.jpg','thumbs','image/jpeg',97162,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-calm-02-goodnight-toys-thumb','episode-preschool-calm-02-goodnight-toys thumb','image','generated','ready','episode-preschool-calm-02-goodnight-toys.jpg','public/episodes/episode-preschool-calm-02-goodnight-toys/thumb.jpg','thumbs','image/jpeg',118760,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-colors-01-find-yellow-thumb','episode-preschool-colors-01-find-yellow thumb','image','generated','ready','episode-preschool-colors-01-find-yellow.jpg','public/episodes/episode-preschool-colors-01-find-yellow/thumb.jpg','thumbs','image/jpeg',127946,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-colors-02-sort-two-colors-thumb','episode-preschool-colors-02-sort-two-colors thumb','image','generated','ready','episode-preschool-colors-02-sort-two-colors.jpg','public/episodes/episode-preschool-colors-02-sort-two-colors/thumb.jpg','thumbs','image/jpeg',106040,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-count-01-one-for-each-thumb','episode-preschool-count-01-one-for-each thumb','image','generated','ready','episode-preschool-count-01-one-for-each.jpg','public/episodes/episode-preschool-count-01-one-for-each/thumb.jpg','thumbs','image/jpeg',85108,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-count-02-three-friends-thumb','episode-preschool-count-02-three-friends thumb','image','generated','ready','episode-preschool-count-02-three-friends.jpg','public/episodes/episode-preschool-count-02-three-friends/thumb.jpg','thumbs','image/jpeg',110861,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-words-01-picture-to-object-thumb','episode-preschool-words-01-picture-to-object thumb','image','generated','ready','episode-preschool-words-01-picture-to-object.jpg','public/episodes/episode-preschool-words-01-picture-to-object/thumb.jpg','thumbs','image/jpeg',102768,'public','ar');
INSERT OR IGNORE INTO content_assets (id,title_ar,kind,source,status,original_filename,r2_key,bucket,mime_type,size_bytes,visibility,language) VALUES ('ca-episode-preschool-words-02-listen-and-find-thumb','episode-preschool-words-02-listen-and-find thumb','image','generated','ready','episode-preschool-words-02-listen-and-find.jpg','public/episodes/episode-preschool-words-02-listen-and-find/thumb.jpg','thumbs','image/jpeg',93855,'public','ar');

-- ═══ 2) روابط الأصول (66) — محروسة بوجود الحلقة والأصل ═══
INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-body-01-heart-stream', 'ca-episode-body-01-heart-1080p', 'episode', 'episode-body-01-heart', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-body-01-heart') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-body-01-heart-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-body-01-heart-thumb', 'ca-episode-body-01-heart-thumb', 'episode', 'episode-body-01-heart', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-body-01-heart') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-body-01-heart-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-body-02-five-senses-stream', 'ca-episode-body-02-five-senses-1080p', 'episode', 'episode-body-02-five-senses', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-body-02-five-senses') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-body-02-five-senses-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-body-02-five-senses-thumb', 'ca-episode-body-02-five-senses-thumb', 'episode', 'episode-body-02-five-senses', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-body-02-five-senses') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-body-02-five-senses-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-body-03-breathing-stream', 'ca-episode-body-03-breathing-1080p', 'episode', 'episode-body-03-breathing', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-body-03-breathing') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-body-03-breathing-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-body-03-breathing-thumb', 'ca-episode-body-03-breathing-thumb', 'episode', 'episode-body-03-breathing', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-body-03-breathing') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-body-03-breathing-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-01-lost-bag-stream', 'ca-episode-hekaya-01-lost-bag-1080p', 'episode', 'episode-hekaya-01-lost-bag', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-01-lost-bag') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-01-lost-bag-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-01-lost-bag-thumb', 'ca-episode-hekaya-01-lost-bag-thumb', 'episode', 'episode-hekaya-01-lost-bag', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-01-lost-bag') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-01-lost-bag-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-02-sharing-colors-stream', 'ca-episode-hekaya-02-sharing-colors-1080p', 'episode', 'episode-hekaya-02-sharing-colors', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-02-sharing-colors') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-02-sharing-colors-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-02-sharing-colors-thumb', 'ca-episode-hekaya-02-sharing-colors-thumb', 'episode', 'episode-hekaya-02-sharing-colors', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-02-sharing-colors') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-02-sharing-colors-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-03-waiting-turn-stream', 'ca-episode-hekaya-03-waiting-turn-1080p', 'episode', 'episode-hekaya-03-waiting-turn', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-03-waiting-turn') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-03-waiting-turn-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-03-waiting-turn-thumb', 'ca-episode-hekaya-03-waiting-turn-thumb', 'episode', 'episode-hekaya-03-waiting-turn', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-03-waiting-turn') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-03-waiting-turn-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-04-plant-responsibility-stream', 'ca-episode-hekaya-04-plant-responsibility-1080p', 'episode', 'episode-hekaya-04-plant-responsibility', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-04-plant-responsibility') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-04-plant-responsibility-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-hekaya-04-plant-responsibility-thumb', 'ca-episode-hekaya-04-plant-responsibility-thumb', 'episode', 'episode-hekaya-04-plant-responsibility', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-hekaya-04-plant-responsibility') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-hekaya-04-plant-responsibility-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-01-walking-water-stream', 'ca-episode-home-01-walking-water-1080p', 'episode', 'episode-home-01-walking-water', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-01-walking-water') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-01-walking-water-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-01-walking-water-thumb', 'ca-episode-home-01-walking-water-thumb', 'episode', 'episode-home-01-walking-water', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-01-walking-water') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-01-walking-water-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-02-magnet-test-stream', 'ca-episode-home-02-magnet-test-1080p', 'episode', 'episode-home-02-magnet-test', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-02-magnet-test') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-02-magnet-test-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-02-magnet-test-thumb', 'ca-episode-home-02-magnet-test-thumb', 'episode', 'episode-home-02-magnet-test', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-02-magnet-test') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-02-magnet-test-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-03-float-or-sink-stream', 'ca-episode-home-03-float-or-sink-1080p', 'episode', 'episode-home-03-float-or-sink', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-03-float-or-sink') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-03-float-or-sink-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-03-float-or-sink-thumb', 'ca-episode-home-03-float-or-sink-thumb', 'episode', 'episode-home-03-float-or-sink', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-03-float-or-sink') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-03-float-or-sink-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-04-growing-seed-stream', 'ca-episode-home-04-growing-seed-1080p', 'episode', 'episode-home-04-growing-seed', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-04-growing-seed') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-04-growing-seed-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-home-04-growing-seed-thumb', 'ca-episode-home-04-growing-seed-thumb', 'episode', 'episode-home-04-growing-seed', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-home-04-growing-seed') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-home-04-growing-seed-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-civilizations-01-water-engineering-stream', 'ca-episode-junior-civilizations-01-water-engineering-1080p', 'episode', 'episode-junior-civilizations-01-water-engineering', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-civilizations-01-water-engineering') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-civilizations-01-water-engineering-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-civilizations-01-water-engineering-thumb', 'ca-episode-junior-civilizations-01-water-engineering-thumb', 'episode', 'episode-junior-civilizations-01-water-engineering', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-civilizations-01-water-engineering') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-civilizations-01-water-engineering-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-civilizations-02-observatory-stream', 'ca-episode-junior-civilizations-02-observatory-1080p', 'episode', 'episode-junior-civilizations-02-observatory', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-civilizations-02-observatory') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-civilizations-02-observatory-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-civilizations-02-observatory-thumb', 'ca-episode-junior-civilizations-02-observatory-thumb', 'episode', 'episode-junior-civilizations-02-observatory', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-civilizations-02-observatory') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-civilizations-02-observatory-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-code-01-sequence-path-stream', 'ca-episode-junior-code-01-sequence-path-1080p', 'episode', 'episode-junior-code-01-sequence-path', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-code-01-sequence-path') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-code-01-sequence-path-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-code-01-sequence-path-thumb', 'ca-episode-junior-code-01-sequence-path-thumb', 'episode', 'episode-junior-code-01-sequence-path', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-code-01-sequence-path') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-code-01-sequence-path-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-code-02-debug-the-route-stream', 'ca-episode-junior-code-02-debug-the-route-1080p', 'episode', 'episode-junior-code-02-debug-the-route', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-code-02-debug-the-route') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-code-02-debug-the-route-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-code-02-debug-the-route-thumb', 'ca-episode-junior-code-02-debug-the-route-thumb', 'episode', 'episode-junior-code-02-debug-the-route', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-code-02-debug-the-route') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-code-02-debug-the-route-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-future-01-solar-rover-stream', 'ca-episode-junior-future-01-solar-rover-1080p', 'episode', 'episode-junior-future-01-solar-rover', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-future-01-solar-rover') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-future-01-solar-rover-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-future-01-solar-rover-thumb', 'ca-episode-junior-future-01-solar-rover-thumb', 'episode', 'episode-junior-future-01-solar-rover', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-future-01-solar-rover') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-future-01-solar-rover-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-future-02-strong-bridge-stream', 'ca-episode-junior-future-02-strong-bridge-1080p', 'episode', 'episode-junior-future-02-strong-bridge', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-future-02-strong-bridge') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-future-02-strong-bridge-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-future-02-strong-bridge-thumb', 'ca-episode-junior-future-02-strong-bridge-thumb', 'episode', 'episode-junior-future-02-strong-bridge', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-future-02-strong-bridge') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-future-02-strong-bridge-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-minute-01-light-refraction-stream', 'ca-episode-junior-minute-01-light-refraction-1080p', 'episode', 'episode-junior-minute-01-light-refraction', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-minute-01-light-refraction') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-minute-01-light-refraction-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-minute-01-light-refraction-thumb', 'ca-episode-junior-minute-01-light-refraction-thumb', 'episode', 'episode-junior-minute-01-light-refraction', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-minute-01-light-refraction') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-minute-01-light-refraction-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-minute-02-air-pressure-stream', 'ca-episode-junior-minute-02-air-pressure-1080p', 'episode', 'episode-junior-minute-02-air-pressure', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-minute-02-air-pressure') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-minute-02-air-pressure-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-junior-minute-02-air-pressure-thumb', 'ca-episode-junior-minute-02-air-pressure-thumb', 'episode', 'episode-junior-minute-02-air-pressure', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-junior-minute-02-air-pressure') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-junior-minute-02-air-pressure-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-kids-explorers-01-picture-clues-stream', 'ca-episode-kids-explorers-01-picture-clues-1080p', 'episode', 'episode-kids-explorers-01-picture-clues', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-kids-explorers-01-picture-clues') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-kids-explorers-01-picture-clues-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-kids-explorers-01-picture-clues-thumb', 'ca-episode-kids-explorers-01-picture-clues-thumb', 'episode', 'episode-kids-explorers-01-picture-clues', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-kids-explorers-01-picture-clues') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-kids-explorers-01-picture-clues-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-kids-explorers-02-teamwork-bridge-stream', 'ca-episode-kids-explorers-02-teamwork-bridge-1080p', 'episode', 'episode-kids-explorers-02-teamwork-bridge', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-kids-explorers-02-teamwork-bridge') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-kids-explorers-02-teamwork-bridge-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-kids-explorers-02-teamwork-bridge-thumb', 'ca-episode-kids-explorers-02-teamwork-bridge-thumb', 'episode', 'episode-kids-explorers-02-teamwork-bridge', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-kids-explorers-02-teamwork-bridge') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-kids-explorers-02-teamwork-bridge-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-01-counting-stars-stream', 'ca-episode-numbers-01-counting-stars-1080p', 'episode', 'episode-numbers-01-counting-stars', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-01-counting-stars') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-01-counting-stars-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-01-counting-stars-thumb', 'ca-episode-numbers-01-counting-stars-thumb', 'episode', 'episode-numbers-01-counting-stars', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-01-counting-stars') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-01-counting-stars-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-02-more-or-less-stream', 'ca-episode-numbers-02-more-or-less-1080p', 'episode', 'episode-numbers-02-more-or-less', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-02-more-or-less') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-02-more-or-less-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-02-more-or-less-thumb', 'ca-episode-numbers-02-more-or-less-thumb', 'episode', 'episode-numbers-02-more-or-less', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-02-more-or-less') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-02-more-or-less-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-03-shape-bridge-stream', 'ca-episode-numbers-03-shape-bridge-1080p', 'episode', 'episode-numbers-03-shape-bridge', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-03-shape-bridge') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-03-shape-bridge-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-03-shape-bridge-thumb', 'ca-episode-numbers-03-shape-bridge-thumb', 'episode', 'episode-numbers-03-shape-bridge', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-03-shape-bridge') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-03-shape-bridge-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-04-combining-groups-stream', 'ca-episode-numbers-04-combining-groups-1080p', 'episode', 'episode-numbers-04-combining-groups', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-04-combining-groups') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-04-combining-groups-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-numbers-04-combining-groups-thumb', 'ca-episode-numbers-04-combining-groups-thumb', 'episode', 'episode-numbers-04-combining-groups', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-numbers-04-combining-groups') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-numbers-04-combining-groups-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-calm-01-bird-home-stream', 'ca-episode-preschool-calm-01-bird-home-1080p', 'episode', 'episode-preschool-calm-01-bird-home', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-calm-01-bird-home') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-calm-01-bird-home-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-calm-01-bird-home-thumb', 'ca-episode-preschool-calm-01-bird-home-thumb', 'episode', 'episode-preschool-calm-01-bird-home', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-calm-01-bird-home') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-calm-01-bird-home-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-calm-02-goodnight-toys-stream', 'ca-episode-preschool-calm-02-goodnight-toys-1080p', 'episode', 'episode-preschool-calm-02-goodnight-toys', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-calm-02-goodnight-toys') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-calm-02-goodnight-toys-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-calm-02-goodnight-toys-thumb', 'ca-episode-preschool-calm-02-goodnight-toys-thumb', 'episode', 'episode-preschool-calm-02-goodnight-toys', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-calm-02-goodnight-toys') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-calm-02-goodnight-toys-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-colors-01-find-yellow-stream', 'ca-episode-preschool-colors-01-find-yellow-1080p', 'episode', 'episode-preschool-colors-01-find-yellow', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-colors-01-find-yellow') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-colors-01-find-yellow-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-colors-01-find-yellow-thumb', 'ca-episode-preschool-colors-01-find-yellow-thumb', 'episode', 'episode-preschool-colors-01-find-yellow', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-colors-01-find-yellow') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-colors-01-find-yellow-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-colors-02-sort-two-colors-stream', 'ca-episode-preschool-colors-02-sort-two-colors-1080p', 'episode', 'episode-preschool-colors-02-sort-two-colors', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-colors-02-sort-two-colors') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-colors-02-sort-two-colors-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-colors-02-sort-two-colors-thumb', 'ca-episode-preschool-colors-02-sort-two-colors-thumb', 'episode', 'episode-preschool-colors-02-sort-two-colors', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-colors-02-sort-two-colors') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-colors-02-sort-two-colors-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-count-01-one-for-each-stream', 'ca-episode-preschool-count-01-one-for-each-1080p', 'episode', 'episode-preschool-count-01-one-for-each', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-count-01-one-for-each') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-count-01-one-for-each-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-count-01-one-for-each-thumb', 'ca-episode-preschool-count-01-one-for-each-thumb', 'episode', 'episode-preschool-count-01-one-for-each', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-count-01-one-for-each') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-count-01-one-for-each-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-count-02-three-friends-stream', 'ca-episode-preschool-count-02-three-friends-1080p', 'episode', 'episode-preschool-count-02-three-friends', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-count-02-three-friends') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-count-02-three-friends-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-count-02-three-friends-thumb', 'ca-episode-preschool-count-02-three-friends-thumb', 'episode', 'episode-preschool-count-02-three-friends', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-count-02-three-friends') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-count-02-three-friends-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-words-01-picture-to-object-stream', 'ca-episode-preschool-words-01-picture-to-object-1080p', 'episode', 'episode-preschool-words-01-picture-to-object', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-words-01-picture-to-object') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-words-01-picture-to-object-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-words-01-picture-to-object-thumb', 'ca-episode-preschool-words-01-picture-to-object-thumb', 'episode', 'episode-preschool-words-01-picture-to-object', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-words-01-picture-to-object') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-words-01-picture-to-object-thumb');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-words-02-listen-and-find-stream', 'ca-episode-preschool-words-02-listen-and-find-1080p', 'episode', 'episode-preschool-words-02-listen-and-find', 'stream', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-words-02-listen-and-find') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-words-02-listen-and-find-1080p');

INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order)
SELECT 'al-episode-preschool-words-02-listen-and-find-thumb', 'ca-episode-preschool-words-02-listen-and-find-thumb', 'episode', 'episode-preschool-words-02-listen-and-find', 'thumbnail', '', 0
WHERE EXISTS (SELECT 1 FROM episodes WHERE id = 'episode-preschool-words-02-listen-and-find') AND EXISTS (SELECT 1 FROM content_assets WHERE id = 'ca-episode-preschool-words-02-listen-and-find-thumb');

-- ═══ 3) أحجام الأصول المقيسة ═══
UPDATE content_assets SET size_bytes=15610464, updated_at=datetime('now') WHERE id='ca-episode-body-01-heart-1080p';
UPDATE content_assets SET size_bytes=16714590, updated_at=datetime('now') WHERE id='ca-episode-body-02-five-senses-1080p';
UPDATE content_assets SET size_bytes=13929063, updated_at=datetime('now') WHERE id='ca-episode-body-03-breathing-1080p';
UPDATE content_assets SET size_bytes=16305110, updated_at=datetime('now') WHERE id='ca-episode-hekaya-01-lost-bag-1080p';
UPDATE content_assets SET size_bytes=10631802, updated_at=datetime('now') WHERE id='ca-episode-hekaya-02-sharing-colors-1080p';
UPDATE content_assets SET size_bytes=14786542, updated_at=datetime('now') WHERE id='ca-episode-hekaya-03-waiting-turn-1080p';
UPDATE content_assets SET size_bytes=14474141, updated_at=datetime('now') WHERE id='ca-episode-hekaya-04-plant-responsibility-1080p';
UPDATE content_assets SET size_bytes=12162315, updated_at=datetime('now') WHERE id='ca-episode-home-01-walking-water-1080p';
UPDATE content_assets SET size_bytes=11438701, updated_at=datetime('now') WHERE id='ca-episode-home-02-magnet-test-1080p';
UPDATE content_assets SET size_bytes=13102960, updated_at=datetime('now') WHERE id='ca-episode-home-03-float-or-sink-1080p';
UPDATE content_assets SET size_bytes=14995925, updated_at=datetime('now') WHERE id='ca-episode-home-04-growing-seed-1080p';
UPDATE content_assets SET size_bytes=15826384, updated_at=datetime('now') WHERE id='ca-episode-junior-civilizations-01-water-engineering-1080p';
UPDATE content_assets SET size_bytes=17247863, updated_at=datetime('now') WHERE id='ca-episode-junior-civilizations-02-observatory-1080p';
UPDATE content_assets SET size_bytes=18572619, updated_at=datetime('now') WHERE id='ca-episode-junior-code-01-sequence-path-1080p';
UPDATE content_assets SET size_bytes=16917401, updated_at=datetime('now') WHERE id='ca-episode-junior-code-02-debug-the-route-1080p';
UPDATE content_assets SET size_bytes=17522739, updated_at=datetime('now') WHERE id='ca-episode-junior-future-01-solar-rover-1080p';
UPDATE content_assets SET size_bytes=13023882, updated_at=datetime('now') WHERE id='ca-episode-junior-future-02-strong-bridge-1080p';
UPDATE content_assets SET size_bytes=13625426, updated_at=datetime('now') WHERE id='ca-episode-junior-minute-01-light-refraction-1080p';
UPDATE content_assets SET size_bytes=14473860, updated_at=datetime('now') WHERE id='ca-episode-junior-minute-02-air-pressure-1080p';
UPDATE content_assets SET size_bytes=16122314, updated_at=datetime('now') WHERE id='ca-episode-kids-explorers-01-picture-clues-1080p';
UPDATE content_assets SET size_bytes=16357942, updated_at=datetime('now') WHERE id='ca-episode-kids-explorers-02-teamwork-bridge-1080p';
UPDATE content_assets SET size_bytes=16175084, updated_at=datetime('now') WHERE id='ca-episode-numbers-01-counting-stars-1080p';
UPDATE content_assets SET size_bytes=13563458, updated_at=datetime('now') WHERE id='ca-episode-numbers-02-more-or-less-1080p';
UPDATE content_assets SET size_bytes=14815914, updated_at=datetime('now') WHERE id='ca-episode-numbers-03-shape-bridge-1080p';
UPDATE content_assets SET size_bytes=13692352, updated_at=datetime('now') WHERE id='ca-episode-numbers-04-combining-groups-1080p';
UPDATE content_assets SET size_bytes=13349431, updated_at=datetime('now') WHERE id='ca-episode-preschool-calm-01-bird-home-1080p';
UPDATE content_assets SET size_bytes=11693649, updated_at=datetime('now') WHERE id='ca-episode-preschool-calm-02-goodnight-toys-1080p';
UPDATE content_assets SET size_bytes=15042447, updated_at=datetime('now') WHERE id='ca-episode-preschool-colors-01-find-yellow-1080p';
UPDATE content_assets SET size_bytes=13016265, updated_at=datetime('now') WHERE id='ca-episode-preschool-colors-02-sort-two-colors-1080p';
UPDATE content_assets SET size_bytes=10322703, updated_at=datetime('now') WHERE id='ca-episode-preschool-count-01-one-for-each-1080p';
UPDATE content_assets SET size_bytes=19160718, updated_at=datetime('now') WHERE id='ca-episode-preschool-count-02-three-friends-1080p';
UPDATE content_assets SET size_bytes=12888484, updated_at=datetime('now') WHERE id='ca-episode-preschool-words-01-picture-to-object-1080p';
UPDATE content_assets SET size_bytes=14319804, updated_at=datetime('now') WHERE id='ca-episode-preschool-words-02-listen-and-find-1080p';

-- ═══ 4) وسم النسخة الإنجليزية ومسارات صوتها ═══
UPDATE asset_links
SET language = 'en'
WHERE entity_type = 'episode'
  AND role = 'stream'
  AND (language = '' OR language IS NULL)
  AND asset_id LIKE 'ca-episode-%-1080p';

INSERT OR IGNORE INTO episode_audio_tracks (id, episode_id, language, asset_id, label, is_default, sort_order, status)
SELECT
  'eat-' || r.episode_id || '-en',
  r.episode_id,
  'en',
  r.asset_id,
  'English',
  1,
  0,
  'ready'
FROM episode_renditions r
WHERE r.label = '1080p'
  AND r.asset_id LIKE 'ca-episode-%-1080p';
