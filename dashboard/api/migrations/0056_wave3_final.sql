-- Wave 3 final: timeline historic detail + second block/sim, contact sheet ready
PRAGMA foreign_keys=ON;

INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, age_min, age_max, reading_level, interaction_mode, supervision_level, difficulty, is_free, content_pack, status, learning_objective_id) VALUES
('game-wave3-timeline-detail','timeline_map','series-junior-civilizations','رحلة الحضارة',9,12,'independent','mixed','none','hard',1,
'{"pack_version":1,"engine_id":"timeline_map","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"mode":"both","events":[{"id":"e1","label":"تأسيس قرطاج","year": -814,"image":"asset-color-mountain"},{"id":"e2","label":"افتتاح بيت الحكمة","year": 830,"image":"asset-color-book"},{"id":"e3","label":"رحلة ابن بطوطة","year": 1325,"image":"asset-color-boat"}],"timeline":{"min_year":-1000,"max_year":1500},"map":{"center":[36.8,10.1],"zoom":4},"tolerance_years":50,"tolerance_km":200}],"assets":{"images":["asset-color-mountain","asset-color-book","asset-color-boat"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave3-block-advanced','block_code','series-junior-robo-codes','مسار متقدم',9,12,'independent','independent','none','hard',1,
'{"pack_version":1,"engine_id":"block_code","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"grid":[5,5],"start":[0,0],"goal":[4,4],"direction":"east","obstacles":[[1,1],[2,2],[3,1]],"blocks":["move","turn_right","repeat","if_path"],"palette":["move","turn_right","repeat","if_path"],"program":[],"optimal":8}],"assets":{"images":["asset-complete-robot"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form'),

('game-wave3-sim-saturating','sim_lab','series-junior-future-lab','توازن الماء',9,12,'independent','mixed','required','medium',1,
'{"pack_version":1,"engine_id":"sim_lab","supports_dpad":true,"progression":{"levels_to_finish":1},"accessibility":{"simplified_motor":{"tolerance_dp":44,"coverage_required":0.6},"sequential_tap_alternative":true,"min_touch_target_dp":48},"levels":[{"level":1,"mode":"experiment","variables":[{"id":"v1","label":"ملح","min":0,"max":10,"value":5}],"relationship":"saturating","question":"ماذا يحدث للإذابة عند زيادة الملح؟","options":["تزيد ثم تثبت","تقل"],"answer":"تزيد ثم تثبت","safety_notes":"إشراف الكبار عند استخدام الماء الساخن"}],"assets":{"images":["asset-oloom-leaf-bg"],"audio":[]},"voice_manifest":{}}','published','objective-world-shape-trace_form')
;

INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status) VALUES
('game-wave3-timeline-detail','ar','رحلة الحضارة','ضع الأحداث على الخط والخريطة','{}','{}','ready'),
('game-wave3-block-advanced','ar','مسار متقدم','استخدم التكرار والشرط للوصول','{}','{}','ready'),
('game-wave3-sim-saturating','ar','توازن الماء','جرب ولاحظ التشبع','{}','{}','ready');
