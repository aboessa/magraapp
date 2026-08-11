-- 0027 — drawing content on the planets where it is educationally justified.
--
-- Sources are the existing editorial content, not new invention. Each pack below
-- exists because a script or family activity already asks the child to draw:
--
--   QISAS   a-calm-tale/story-01-bird-home  «ارسموا معًا بيتًا واحدًا لحيوان يحبّه»
--   OLOOM   try-it-at-home/ep-04-seed-grows «كل يوم: انظر، وارسم، واكتب ما ترى»
--   ALAM    aalami-akbar/ep-01-how-far-which-way «ارسما معًا خريطة غرفة واحدة من أعلى»
--   MAHARAT ufakkir-khutwa-khutwa/ep-05     «ارسم ستّ نجوم متشابهة على ورقة»
--
-- ## What is deliberately absent
--
-- TARIKH: its drawing is junior-age, needs scale fidelity, and is explicitly a
-- paper activity; `timeline_map` covers the on-screen need.
-- ISLAMIC (09): figurative-depiction governance makes an open canvas there a
-- content-safety question, not a feature question. No pack is authored.
-- Adding either to raise coverage would be exactly the forcing the brief forbids.
--
-- ## Scoring
--
-- Three of the four are `scoring: "none"` and carry NO learning objective. A
-- wholly unscored pack measures nothing, so attaching an objective would create a
-- mastery level for "creative reflection" — which is how a keepsake turns into a
-- grade. Only the MAHARAT copy-pattern pack is scored, because copying a discrete
-- authored pattern is objectively checkable.

-- 1. QISAS — creative response to a story ------------------------------------
--
-- Free drawing, no objective, no score. The story's own family activity is the
-- prompt, and the contract for this planet is that the observation is enough.
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) VALUES (
  'game-qisas-story-response', 'trace_color', 'series-preschool-calm-tale', NULL,
  'ارسم من الحكاية', NULL,
  3, 5, 'pre_reader', 'tap', 'none', NULL, 'easy',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "qs-story-response",
  "localization": "translatable",
  "supports_dpad": false,
  "supervision_level": "none",
  "progression": { "levels_to_finish": 1, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 44, "coverage_required": 0.6 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 64
  },
  "review": { "linguistic_review": { "status": "not_required" } },
  "levels": [
    {
      "level": 1,
      "mode": "draw_from_prompt",
      "scoring": "none",
      "prompt_key": "game.qisas_response.bird_home.prompt",
      "completion": { "rule": "child_taps_done" },
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"]
      }
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-qs-response-intro",
    "vo.instruction": "asset-vo-qs-response-instruction",
    "vo.instruction_repeat": "asset-vo-qs-response-instruction-slow",
    "vo.coloring_intro": "asset-vo-coloring-intro",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}',
  'ارسم ما تحب من الحكاية. لا يوجد رسم صحيح وآخر خاطئ.',
  NULL, '{}', 1, 'draft'
);

-- 2. OLOOM — observation drawing ---------------------------------------------
--
-- The book teaches the method: draw the same branch a week apart and compare your
-- two drawings, not yours against another child's. Nothing here is scored, and
-- nothing compares one child to another.
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) VALUES (
  'game-oloom-observation-draw', 'trace_color', 'series-kids-home', NULL,
  'انظر وارسم', NULL,
  6, 8, 'emerging', 'guided', 'recommended',
  'الرسم على الشاشة فقط. أي ملاحظة لنبات أو حيوان تكون بحضور بالغ وبلا لمس.',
  'easy',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "ol-observation-draw",
  "localization": "translatable",
  "supports_dpad": false,
  "supervision_level": "recommended",
  "progression": { "levels_to_finish": 1, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 40, "coverage_required": 0.6 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 56
  },
  "review": { "linguistic_review": { "status": "not_required" } },
  "levels": [
    {
      "level": 1,
      "mode": "free_draw",
      "scoring": "none",
      "prompt_key": "game.oloom_observe.seed.prompt",
      "completion": { "rule": "child_taps_done" }
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-ol-observe-intro",
    "vo.instruction": "asset-vo-ol-observe-instruction",
    "vo.instruction_repeat": "asset-vo-ol-observe-instruction-slow",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}',
  'ارسم ما رأيته كما رأيته. قارن رسمك اليوم برسمك السابق، لا برسم غيرك.',
  NULL, '{}', 0, 'draft'
);

-- 3. ALAM — a room from above ------------------------------------------------
--
-- Spatial, not artistic: the episode fixes north once and draws an arrow, and the
-- skill it exercises is `map_reading`, which already exists. Still unscored,
-- because "is this a good map of your room" is not something software can judge.
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) VALUES (
  'game-alam-room-map', 'trace_color', 'series-kids-explorers', NULL,
  'ارسم غرفتك من أعلى', NULL,
  6, 8, 'emerging', 'guided', 'none', NULL, 'medium',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "al-room-map",
  "localization": "translatable",
  "supports_dpad": false,
  "supervision_level": "none",
  "progression": { "levels_to_finish": 1, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 40, "coverage_required": 0.6 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 56
  },
  "review": { "linguistic_review": { "status": "not_required" } },
  "levels": [
    {
      "level": 1,
      "mode": "free_draw",
      "scoring": "none",
      "prompt_key": "game.alam_map.room.prompt",
      "completion": { "rule": "child_taps_done" }
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-al-map-intro",
    "vo.instruction": "asset-vo-al-map-instruction",
    "vo.instruction_repeat": "asset-vo-al-map-instruction-slow",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}',
  'ارسم غرفتك كما تراها من أعلى. حدّد الشمال مرّة واحدة وارسم سهمًا.',
  NULL, '{}', 0, 'draft'
);

-- 4. MAHARAT — copy the pattern ----------------------------------------------
--
-- The one scored pack here. `ufakkir-khutwa-khutwa` ep-05 asks for six similar
-- stars: a repeated discrete unit, which is objectively checkable, so `discrete`
-- scoring is honest. The objective is pattern recognition, which migration 0022
-- registered.
INSERT OR IGNORE INTO learning_objectives
  (id, code, title_ar, description_ar, skill_id, age_min, age_max, measurable_criteria)
VALUES (
  'objective-skill-pattern-copy_unit', 'skill.pattern.copy_unit',
  'ينسخ الطفل وحدة متكرّرة كما هي',
  'يرسم نفس الوحدة عددًا من المرّات محافظًا على شكلها.',
  'pattern_recognition', 6, 8,
  'ينسخ 4 وحدات من 6 بتغطية ≥ 70% لكل وحدة، بلا حدّ للمحاولات وبلا مؤقّت.'
);

INSERT OR IGNORE INTO learning_objective_tracks (objective_id, track_id)
VALUES ('objective-skill-pattern-copy_unit', 'kids');

INSERT OR IGNORE INTO learning_objective_skills (objective_id, skill_id, role) VALUES
  ('objective-skill-pattern-copy_unit', 'pattern_recognition', 'primary'),
  ('objective-skill-pattern-copy_unit', 'fine_motor', 'secondary'),
  ('objective-skill-pattern-copy_unit', 'visual_motor_integration', 'secondary');

-- The MAHARAT pack hangs off `series-ufakkir-khutwa-khutwa`, which is authored
-- content that exists in some environments and not others — production carries
-- five series and that is not one of them. `games.series_id` is a foreign key, and
-- `INSERT OR IGNORE` does not suppress a foreign-key violation (the OR IGNORE
-- conflict clause covers UNIQUE, CHECK and NOT NULL only), so a `VALUES` insert
-- naming an absent series aborts the migration and blocks every later one.
--
-- `SELECT ... WHERE EXISTS` keeps the pack conditional on its parent. The three
-- packs above are unconditional because their series (qisas, oloom, alam) are
-- launch content present everywhere.
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) SELECT
  'game-maharat-copy-pattern', 'trace_color', 'series-ufakkir-khutwa-khutwa', NULL,
  'انسخ النمط', 'objective-skill-pattern-copy_unit',
  6, 8, 'emerging', 'guided', 'none', NULL, 'medium',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "mh-copy-pattern",
  "localization": "translatable",
  "supports_dpad": false,
  "supervision_level": "none",
  "progression": { "levels_to_finish": 2, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 46, "coverage_required": 0.55 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 56
  },
  "review": { "linguistic_review": { "status": "not_required" } },
  "levels": [
    {
      "level": 1,
      "mode": "copy_pattern",
      "scoring": "geometric",
      "prompt_key": "game.maharat_pattern.zigzag.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "tolerance_dp": 34,
      "coverage_required": 0.7,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.15,0.60],[0.30,0.35],[0.45,0.60],[0.60,0.35],[0.75,0.60],[0.85,0.45]] }
      ]
    },
    {
      "level": 2,
      "mode": "copy_pattern",
      "scoring": "geometric",
      "prompt_key": "game.maharat_pattern.arches.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "tolerance_dp": 34,
      "coverage_required": 0.7,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.14,0.62],[0.24,0.40],[0.34,0.62],[0.44,0.40],[0.54,0.62],[0.64,0.40],[0.74,0.62]] }
      ]
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-mh-pattern-intro",
    "vo.instruction": "asset-vo-mh-pattern-instruction",
    "vo.instruction_repeat": "asset-vo-mh-pattern-instruction-slow",
    "vo.hint": "asset-vo-mh-pattern-hint",
    "vo.stroke_complete": "asset-vo-stroke-complete",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}',
  'انسخ النمط كما هو، وحدة بعد وحدة.',
  NULL, '{}', 0, 'draft'
WHERE EXISTS (SELECT 1 FROM series WHERE id = 'series-ufakkir-khutwa-khutwa');

-- 5. Localizations -----------------------------------------------------------
INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, status, translated_from, is_machine_translated) VALUES
  ('game-qisas-story-response', 'ar', 'ارسم من الحكاية', 'ارسم ما تحب من الحكاية.',
   json_object('game.qisas_response.bird_home.prompt', 'أيّ حيوان أحببتَ في الحكاية؟ ارسم له بيتًا.'), 'draft', NULL, 0),
  ('game-qisas-story-response', 'en', 'Draw from the story', 'Draw whatever you liked from the story.',
   json_object('game.qisas_response.bird_home.prompt', 'Which animal did you like in the story? Draw it a home.'), 'draft', 'ar', 0),
  ('game-qisas-story-response', 'fr', 'Dessine l''histoire', 'Dessine ce que tu as aimé dans l''histoire.',
   json_object('game.qisas_response.bird_home.prompt', 'Quel animal as-tu aimé dans l''histoire ? Dessine-lui une maison.'), 'draft', 'ar', 0),

  ('game-oloom-observation-draw', 'ar', 'انظر وارسم', 'ارسم ما رأيته كما رأيته.',
   json_object('game.oloom_observe.seed.prompt', 'انظر إلى البذرة اليوم، وارسم ما ترى. غدًا ارسمها مرّة أخرى.'), 'draft', NULL, 0),
  ('game-oloom-observation-draw', 'en', 'Look and draw', 'Draw what you saw, as you saw it.',
   json_object('game.oloom_observe.seed.prompt', 'Look at the seed today and draw what you see. Draw it again tomorrow.'), 'draft', 'ar', 0),
  ('game-oloom-observation-draw', 'fr', 'Regarde et dessine', 'Dessine ce que tu as vu, comme tu l''as vu.',
   json_object('game.oloom_observe.seed.prompt', 'Regarde la graine aujourd''hui et dessine ce que tu vois. Redessine-la demain.'), 'draft', 'ar', 0),

  ('game-alam-room-map', 'ar', 'ارسم غرفتك من أعلى', 'ارسم غرفتك كما تراها من أعلى.',
   json_object('game.alam_map.room.prompt', 'ارسم غرفتك من أعلى. ضع البابَ أولًا، ثم حدّد الشمال بسهم.'), 'draft', NULL, 0),
  ('game-alam-room-map', 'en', 'Map your room', 'Draw your room as if seen from above.',
   json_object('game.alam_map.room.prompt', 'Draw your room from above. Put the door in first, then mark north with an arrow.'), 'draft', 'ar', 0),
  ('game-alam-room-map', 'fr', 'Dessine ta chambre vue d''en haut', 'Dessine ta chambre comme vue d''en haut.',
   json_object('game.alam_map.room.prompt', 'Dessine ta chambre vue d''en haut. Place la porte, puis indique le nord par une flèche.'), 'draft', 'ar', 0);

-- The MAHARAT localizations are a separate statement because their game is itself
-- conditional above. Leaving them in the list with the three unconditional packs
-- meant one absent parent invalidated the whole multi-row insert, so the qisas,
-- oloom and alam translations were lost to a dependency none of them had.
--
-- `game_localizations.game_id` cascades from `games`, so the guard is the same
-- question asked once per row set: does the parent pack exist here.
INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, status, translated_from, is_machine_translated)
SELECT * FROM (
  SELECT 'game-maharat-copy-pattern' AS game_id, 'ar' AS language, 'انسخ النمط' AS title, 'انسخ النمط كما هو.' AS instructions,
    json_object(
      'game.maharat_pattern.zigzag.prompt', 'هذا نمط متكرّر. اتبعه كما هو: أعلى، أسفل، أعلى.',
      'game.maharat_pattern.arches.prompt', 'أقواس متشابهة. اتبعها واحدًا بعد الآخر.'
    ) AS prompts, 'draft' AS status, NULL AS translated_from, 0 AS is_machine_translated
  UNION ALL
  SELECT 'game-maharat-copy-pattern', 'en', 'Copy the pattern', 'Copy the pattern exactly.',
    json_object(
      'game.maharat_pattern.zigzag.prompt', 'This pattern repeats. Follow it as it is: up, down, up.',
      'game.maharat_pattern.arches.prompt', 'Matching arches. Follow them one after another.'
    ), 'draft', 'ar', 0
  UNION ALL
  SELECT 'game-maharat-copy-pattern', 'fr', 'Copie le motif', 'Copie le motif tel quel.',
    json_object(
      'game.maharat_pattern.zigzag.prompt', 'Ce motif se répète. Suis-le tel quel : haut, bas, haut.',
      'game.maharat_pattern.arches.prompt', 'Des arches identiques. Suis-les l''une après l''autre.'
    ), 'draft', 'ar', 0
)
WHERE EXISTS (SELECT 1 FROM games WHERE id = 'game-maharat-copy-pattern');
