-- Wave 1: clean legacy + canonical engines + 9 production packs
PRAGMA foreign_keys=ON;

-- 0. Canonical engines (12) — trace_color already exists via 0026
INSERT OR IGNORE INTO game_engines (id, name_ar, description, mechanics) VALUES
 ('memory_flip','الذاكرة','محرك الذاكرة زوجي','{"mechanics":["flip_pairs"],"declared_tracks":["preschool","kids"],"contract":"docs/games/engines/memory_flip.md"}'),
 ('match_pairs','المطابقة','مطابقة ثنائية','{"mechanics":["tap","drag_match"],"contract":"docs/games/engines/match_pairs.md"}'),
 ('sort_bins','التصنيف','تصنيف في سلال','{"mechanics":["drag_match"],"contract":"docs/games/engines/sort_bins.md"}'),
 ('sequence_order','الترتيب','ترتيب تسلسلي','{"mechanics":["drag_order"],"contract":"docs/games/engines/sequence_order.md"}'),
 ('count_quantity','العد','عد وكمية','{"mechanics":["tap"],"contract":"docs/games/engines/count_quantity.md"}'),
 ('logic_pattern','النمط','مصفوفة نمط','{"mechanics":["tap"],"contract":"docs/games/engines/logic_pattern.md"}'),
 ('word_build','بناء الكلمة','بناء كلمة عربية','{"mechanics":["drag","tap"],"contract":"docs/games/engines/word_build.md"}'),
 ('rhythm_tap','الإيقاع','إيقاع','{"mechanics":["tap"],"contract":"docs/games/engines/rhythm_tap.md"}'),
 ('block_code','البرمجة الكتلية','كتل برمجية','{"mechanics":["drag"],"contract":"docs/games/engines/block_code.md"}'),
 ('sim_lab','المختبر','مختبر محاكاة','{"mechanics":["tap"],"contract":"docs/games/engines/sim_lab.md"}'),
 ('timeline_map','الخريطة الزمنية','خريطة وزمن','{"mechanics":["tap","drag"],"contract":"docs/games/engines/timeline_map.md"}');

-- 1. Fix engine id for letter tracing
UPDATE games SET engine_id='trace_color' WHERE id='game-letter-tracing';

-- 2. Archive 14 spec-only legacy games (content_pack='{}')
UPDATE games SET status='archived', updated_at=datetime('now') WHERE content_pack='{}' AND status='draft';

-- 3. Wave 1 production games — preschool
INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, age_min, age_max, reading_level, interaction_mode, supervision_level, difficulty, is_free, content_pack, status, learning_objective_id) VALUES
('game-wave1-memory-animals','memory_flip','series-preschool-calm-tale','ذاكرة الحيوانات',3,5,'pre_reader','tap','none','easy',1,
'{"pack_version":1,"engine_id":"memory_flip","supports_dpad":true,"progression":{"levels_to_finish":1,"advance_on":"level_complete"},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":64},"levels":[{"level":1,"grid":[2,4],"pair_type":"identical","pairs":[{"a":"asset-color-cat","b":"asset-color-cat","sound_key":"pair.cat"},{"a":"asset-color-bird","b":"asset-color-bird","sound_key":"pair.bird"},{"a":"asset-color-fish","b":"asset-color-fish","sound_key":"pair.fish"},{"a":"asset-color-rabbit","b":"asset-color-rabbit","sound_key":"pair.rabbit"}],"flip_back_delay_ms":1400}],"assets":{"images":["asset-color-cat","asset-color-bird","asset-color-fish","asset-color-rabbit"],"audio":[]},"voice_manifest":{"vo.intro":"asset-vo-memory-intro"}}','published',NULL),

('game-wave1-picture-match','match_pairs','series-preschool-luna-words','طابق الصورة',3,5,'pre_reader','tap','none','easy',1,
'{"pack_version":1,"engine_id":"match_pairs","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":64},"levels":[{"level":1,"match_type":"identical","prompt_key":"game.match.prompt","prompt":"ضع كل صورة عند مثيلها","targets":[{"id":"t1","image":"asset-color-cat","label_key":"label.cat"},{"id":"t2","image":"asset-color-bird","label_key":"label.bird"}],"items":[{"id":"i1","image":"asset-color-cat","target":"t1","label_key":"label.cat"},{"id":"i2","image":"asset-color-bird","target":"t2","label_key":"label.bird"}]}],"assets":{"images":["asset-color-cat","asset-color-bird"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave1-color-sort','sort_bins','series-preschool-colors','صنف الألوان',3,5,'pre_reader','tap','none','easy',1,
'{"pack_version":1,"engine_id":"sort_bins","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":64},"levels":[{"level":1,"criterion_key":"criterion.colour","criterion_type":"color","prompt":"ضع كل شيء في سلّته","bins":[{"id":"b1","label_key":"bin.red","image":"asset-color-apple"},{"id":"b2","label_key":"bin.blue","image":"asset-color-fish"}],"items":[{"id":"i1","image":"asset-color-apple","bin":"b1"},{"id":"i2","image":"asset-color-fish","bin":"b2"},{"id":"i3","image":"asset-color-rocket","bin":"b1"},{"id":"i4","image":"asset-color-tree","bin":"b2"}]}],"assets":{"images":["asset-color-apple","asset-color-fish","asset-color-rocket","asset-color-tree"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave1-count-place','count_quantity','series-preschool-count','عد وضع',3,5,'pre_reader','tap','none','easy',1,
'{"pack_version":1,"engine_id":"count_quantity","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":64},"levels":[{"level":1,"mode":"count_and_pick","range":[1,5],"numeral_system":"auto","items":[{"id":"q1","items":[{"image":"asset-color-stars","count":3}],"options":[2,3,4],"answer":3,"question_key":"game.count.prompt"}]}],"assets":{"images":["asset-color-stars"],"audio":[]},"voice_manifest":{}}','published','objective-math-number-form_trace');

-- Kids
INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, age_min, age_max, reading_level, interaction_mode, supervision_level, difficulty, is_free, content_pack, status, learning_objective_id) VALUES
('game-wave1-sequence-kids','sequence_order','series-kids-body','رتّب المراحل',6,8,'emerging','mixed','none','easy',1,
'{"pack_version":1,"engine_id":"sequence_order","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"sequence_type":"process","prompt":"رتّب الخطوات","direction":"reading_order","panels":[{"id":"p1","image":"asset-color-cat","position":1},{"id":"p2","image":"asset-color-tree","position":2},{"id":"p3","image":"asset-color-apple","position":3}],"accepted_orders":[["p1","p2","p3"]]}],"assets":{"images":["asset-color-cat","asset-color-tree","asset-color-apple"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),
('game-wave1-logic-kids','logic_pattern','series-kids-numbers','أكمل النمط',6,8,'emerging','mixed','none','medium',1,
'{"pack_version":1,"engine_id":"logic_pattern","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"mode":"matrix","grid":[2,2],"items":["asset-color-cat","asset-color-bird","asset-color-cat",null],"options":["asset-color-bird","asset-color-fish"],"answer":"asset-color-bird","rule_key":"rule.alternate"}],"assets":{"images":["asset-color-cat","asset-color-bird","asset-color-fish"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),
('game-wave1-word-kids','word_build','series-kids-numbers','كوّن الكلمة',6,8,'emerging','mixed','none','medium',1,
'{"pack_version":1,"engine_id":"word_build","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"word":"بيت","language":"ar","slots":3,"letters":["ب","ي","ت","ا"],"options":["ب","ي","ت"],"prompt":"كوّن الكلمة"}],"assets":{"images":["asset-color-house"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form')
;

-- Junior
INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, age_min, age_max, reading_level, interaction_mode, supervision_level, difficulty, is_free, content_pack, status, learning_objective_id) VALUES
('game-wave1-block-code','block_code','series-junior-robo-codes','برمج الروبوت',9,12,'independent','independent','none','hard',1,
'{"pack_version":1,"engine_id":"block_code","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"grid":[4,4],"start":[0,0],"goal":[3,3],"direction":"east","obstacles":[[1,1]],"blocks":["move","turn_right","repeat"],"palette":["move","turn_right","repeat"],"program":[]}],"assets":{"images":["asset-complete-robot"],"audio":[]},"voice_manifest":{}}','published',NULL),
('game-wave1-sim-lab','sim_lab','series-junior-future-lab','المختبر',9,12,'independent','independent','none','medium',1,
'{"pack_version":1,"engine_id":"sim_lab","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"mode":"predict","variables":[{"id":"v1","label":"حرارة","min":0,"max":100,"value":50}],"question":"ماذا يحدث عند زيادة الحرارة؟","options":["يزيد","يقل"],"answer":"يزيد"}],"assets":{"images":["asset-oloom-leaf-bg"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form')
;

-- Ensure assets exist for new packs (reuse ready assets, no new R2 needed)
-- Covers already ready via 0042/43

-- Localizations for Wave 1 (AR complete, EN/FR pending honestly as warn)
INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status) VALUES
('game-wave1-memory-animals','ar','ذاكرة الحيوانات','اقلب البطاقات وابحث عن المتطابق','{}','{}','ready'),
('game-wave1-picture-match','ar','طابق الصورة','ضع كل صورة عند مثيلها','{}','{}','ready'),
('game-wave1-color-sort','ar','صنف الألوان','ضع كل شيء في سلّته','{}','{}','ready'),
('game-wave1-count-place','ar','عد وضع','كم عدد النجوم؟','{}','{}','ready'),
('game-wave1-sequence-kids','ar','رتب المراحل','رتب الخطوات بالترتيب','{}','{}','ready'),
('game-wave1-logic-kids','ar','أكمل النمط','أكمل المصفوفة','{}','{}','ready'),
('game-wave1-word-kids','ar','كون الكلمة','كون كلمة بيت','{}','{}','ready'),
('game-wave1-block-code','ar','برمج الروبوت','حرك الروبوت إلى الهدف','{}','{}','ready'),
('game-wave1-sim-lab','ar','المختبر','تنبأ بالنتيجة','{}','{}','ready');
