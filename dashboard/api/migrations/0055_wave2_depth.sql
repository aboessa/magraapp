-- Wave 2: depth + timeline + rhythm + second packs, fix block_code objective
PRAGMA foreign_keys=ON;

-- Fix block_code Wave1 missing objective (scored engine needs objective) -> attach existing world objective
UPDATE games SET learning_objective_id='objective-world-shape-trace_form' WHERE id='game-wave1-block-code' AND learning_objective_id IS NULL;

-- Wave 2 games — 6 depth + 2 new engines
INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, age_min, age_max, reading_level, interaction_mode, supervision_level, difficulty, is_free, content_pack, status, learning_objective_id) VALUES
('game-wave2-memory-2','memory_flip','series-kids-explorers','ذاكرة ثانية',6,8,'emerging','tap','none','medium',1,
'{"pack_version":1,"engine_id":"memory_flip","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"grid":[2,3],"pair_type":"identical","pairs":[{"a":"asset-color-lion","b":"asset-color-lion","sound_key":"pair.lion"},{"a":"asset-color-turtle","b":"asset-color-turtle","sound_key":"pair.turtle"},{"a":"asset-color-owl","b":"asset-color-owl","sound_key":"pair.owl"}],"flip_back_delay_ms":1400}],"assets":{"images":["asset-color-lion","asset-color-turtle","asset-color-owl"],"audio":[]},"voice_manifest":{}}','published',NULL),

('game-wave2-match-2','match_pairs','series-kids-numbers','مطابقة ثانية',6,8,'emerging','tap','none','medium',1,
'{"pack_version":1,"engine_id":"match_pairs","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"match_type":"identical","prompt":"طابق الشكل","targets":[{"id":"t1","image":"asset-color-moon","label_key":"label.moon"},{"id":"t2","image":"asset-color-rainbow","label_key":"label.rainbow"}],"items":[{"id":"i1","image":"asset-color-moon","target":"t1"},{"id":"i2","image":"asset-color-rainbow","target":"t2"}]}],"assets":{"images":["asset-color-moon","asset-color-rainbow"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave2-sort-junior','sort_bins','series-junior-future-lab','صندوق التصنيف',9,12,'independent','tap','none','hard',1,
'{"pack_version":1,"engine_id":"sort_bins","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"criterion_key":"criterion.shape","criterion_type":"shape","prompt":"صنف حسب الشكل","bins":[{"id":"b1","label_key":"bin.circle","image":"asset-color-moon"},{"id":"b2","label_key":"bin.star","image":"asset-color-stars"}],"items":[{"id":"i1","image":"asset-color-moon","bin":"b1"},{"id":"i2","image":"asset-color-stars","bin":"b2"},{"id":"i3","image":"asset-color-moon","bin":"b1"},{"id":"i4","image":"asset-color-stars","bin":"b2"}]}],"assets":{"images":["asset-color-moon","asset-color-stars"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave2-count-drag','count_quantity','series-kids-numbers','اسحب العدد',6,8,'emerging','tap','none','medium',1,
'{"pack_version":1,"engine_id":"count_quantity","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"mode":"drag_amount","range":[1,10],"items":[{"id":"q1","items":[{"image":"asset-color-apple","count":4}],"options":[3,4,5],"answer":4,"question_key":"game.count.drag"}]}],"assets":{"images":["asset-color-apple"],"audio":[]},"voice_manifest":{}}','published','objective-math-number-form_trace'),

('game-wave2-timeline','timeline_map','series-junior-civilizations','خط الحضارات',9,12,'independent','mixed','none','medium',1,
'{"pack_version":1,"engine_id":"timeline_map","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"mode":"timeline","events":[{"id":"e1","label":"بناء الأهرام","year": -2600,"image":"asset-color-mountain"},{"id":"e2","label":"افتتاح المكتبة","year": -300,"image":"asset-color-book"}],"tolerance_years":100}],"assets":{"images":["asset-color-mountain","asset-color-book"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave2-rhythm','rhythm_tap','series-kids-body','أنشودة الإيقاع',6,8,'emerging','tap','none','easy',1,
'{"pack_version":1,"engine_id":"rhythm_tap","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":72},"levels":[{"level":1,"track":"track-simple","lanes":2,"notes":[{"time_ms":500,"lane":0},{"time_ms":1000,"lane":1},{"time_ms":1500,"lane":0}],"hit_window_ms":400}],"assets":{"images":[],"audio":[]},"voice_manifest":{}}','published',NULL)
;

INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status) VALUES
('game-wave2-memory-2','ar','ذاكرة ثانية','اقلب وابحث','{}','{}','ready'),
('game-wave2-match-2','ar','مطابقة ثانية','طابق الشكل','{}','{}','ready'),
('game-wave2-sort-junior','ar','صندوق التصنيف','صنف حسب الشكل','{}','{}','ready'),
('game-wave2-count-drag','ar','اسحب العدد','اسحب العدد الصحيح','{}','{}','ready'),
('game-wave2-timeline','ar','خط الحضارات','ضع الأحداث على الخط الزمني','{}','{}','ready'),
('game-wave2-rhythm','ar','أنشودة الإيقاع','انقر مع الإيقاع','{}','{}','ready');
