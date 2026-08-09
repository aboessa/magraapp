-- 0026 — the two declared launch packs that had never been authored.
--
-- `docs/games/engines/02-trace-color.md` declares three launch packs. Only the
-- Arabic letters one had any content, and that lived in Markdown until migration
-- 0023. This authors the other two with real geometry:
--
--   tc-shapes-basic   أشكال أولى   3-4   language_neutral
--   tc-numbers-1-10   أرقامي       4-5   near language_neutral
--
-- ## Why these two can be published and the letters cannot
--
-- Shapes and Western-Arabic numerals need no stroke-order judgement from an
-- Arabic linguist: a circle has no correct starting point to get wrong, and
-- numeral forms are not letter forms. `review.linguistic_review.status` is
-- therefore `not_required` and the validator does not gate them.
--
-- Arabic letters remain `pending` and remain draft. That distinction is the whole
-- point of the review gate.
--
-- ## Objectives
--
-- Both packs get a real objective with a measurable criterion and the right
-- primary skill from migration 0022, so tracing a shape is legible as
-- shape_recognition plus fine motor rather than as writing.

-- 1. Objectives ------------------------------------------------------------
INSERT OR IGNORE INTO learning_objectives
  (id, code, title_ar, description_ar, skill_id, age_min, age_max, measurable_criteria)
VALUES
  ('objective-world-shape-trace_form', 'world.shape.trace_form',
   'يتتبّع الطفل شكلًا مغلقًا بسيطًا',
   'يتتبّع الدائرة والمربع والمثلث بتغطية لا تقل عن 80% من المسار.',
   'shape_recognition', 3, 5,
   'يكمل تتبّع شكلين من ثلاثة بتغطية ≥ 80% وانحراف ≤ 28dp، بلا حدّ للمحاولات.'),
  ('objective-math-number-form_trace', 'math.number.form_trace',
   'يرسم الطفل شكل الرقم بترتيب صحيح',
   'يتتبّع الأرقام من 1 إلى 5 بترتيب رسم صحيح وبلا انعكاس.',
   'number_formation', 4, 5,
   'يكمل تتبّع 3 أرقام من 5 بتغطية ≥ 80% وانحراف ≤ 26dp.');

INSERT OR IGNORE INTO learning_objective_tracks (objective_id, track_id) VALUES
  ('objective-world-shape-trace_form', 'preschool'),
  ('objective-math-number-form_trace', 'preschool');

-- Primary skills mirror learning_objectives.skill_id, secondaries add the motor
-- side that a single column could not express.
INSERT OR IGNORE INTO learning_objective_skills (objective_id, skill_id, role) VALUES
  ('objective-world-shape-trace_form', 'shape_recognition', 'primary'),
  ('objective-world-shape-trace_form', 'fine_motor', 'secondary'),
  ('objective-world-shape-trace_form', 'visual_motor_integration', 'secondary'),
  ('objective-world-shape-trace_form', 'spatial_awareness', 'secondary'),
  ('objective-math-number-form_trace', 'number_formation', 'primary'),
  ('objective-math-number-form_trace', 'fine_motor', 'secondary'),
  ('objective-math-number-form_trace', 'hand_eye_coordination', 'secondary');

-- 2. tc-shapes-basic --------------------------------------------------------
--
-- Three closed shapes, each one stroke that returns to its start. Coordinates are
-- inscribed in the 0..1 square with a margin so a 40dp visual path is not clipped
-- at the canvas edge. Circles are approximated with 12 points, which reads as
-- smooth once the painter's midpoint smoothing is applied.
--
-- Tolerance widens slightly for the triangle: corners are the hardest part of a
-- closed shape for a three-year-old, and the contract's answer to difficulty is a
-- wider road, never a failure.
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) VALUES (
  'game-tc-shapes-basic', 'trace_color', 'series-preschool-colors', NULL,
  'أشكال أولى', 'objective-world-shape-trace_form',
  3, 5, 'pre_reader', 'tap', 'none', NULL, 'easy',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "tc-shapes-basic",
  "localization": "language_neutral",
  "supports_dpad": false,
  "supervision_level": "none",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
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
      "mode": "shape",
      "scoring": "geometric",
      "prompt_key": "game.shapes_basic.circle.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "tolerance_dp": 28,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.50,0.15],[0.68,0.22],[0.80,0.38],[0.85,0.50],[0.80,0.62],[0.68,0.78],[0.50,0.85],[0.32,0.78],[0.20,0.62],[0.15,0.50],[0.20,0.38],[0.32,0.22],[0.50,0.15]] }
      ],
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"]
      }
    },
    {
      "level": 2,
      "mode": "shape",
      "scoring": "geometric",
      "prompt_key": "game.shapes_basic.square.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "tolerance_dp": 28,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.20,0.20],[0.50,0.20],[0.80,0.20],[0.80,0.50],[0.80,0.80],[0.50,0.80],[0.20,0.80],[0.20,0.50],[0.20,0.20]] }
      ],
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"]
      }
    },
    {
      "level": 3,
      "mode": "shape",
      "scoring": "geometric",
      "prompt_key": "game.shapes_basic.triangle.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "tolerance_dp": 32,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.50,0.16],[0.65,0.48],[0.82,0.82],[0.50,0.82],[0.18,0.82],[0.35,0.48],[0.50,0.16]] }
      ],
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"]
      }
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-tcshapes-intro",
    "vo.instruction": "asset-vo-tcshapes-instruction",
    "vo.instruction_repeat": "asset-vo-tcshapes-instruction-slow",
    "vo.hint": "asset-vo-tcshapes-hint",
    "vo.stroke_complete": "asset-vo-stroke-complete",
    "vo.coloring_intro": "asset-vo-coloring-intro",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}',
  'ضع إصبعك على النقطة، واتبع الطريق حتى تكمل الشكل. ثم لوّن كما تحب.',
  NULL, '{}', 1, 'draft'
);

-- 3. tc-numbers-1-10 -------------------------------------------------------
--
-- Numerals 1 to 5. Western-Arabic digits, drawn top-down as they are written.
-- The 4 and the 5 are two strokes each, ordered, which is why the level scoring is
-- `geometric_ordered`: drawing the crossbar of a 4 before its stem produces a
-- shape that is not a 4.
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) VALUES (
  'game-tc-numbers-1-10', 'trace_color', 'series-preschool-count', NULL,
  'أرقامي', 'objective-math-number-form_trace',
  4, 5, 'pre_reader', 'tap', 'none', NULL, 'easy',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "tc-numbers-1-10",
  "localization": "translatable",
  "supports_dpad": false,
  "supervision_level": "none",
  "progression": { "levels_to_finish": 5, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 42, "coverage_required": 0.6 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 64
  },
  "review": { "linguistic_review": { "status": "not_required" } },
  "levels": [
    {
      "level": 1,
      "mode": "number",
      "scoring": "geometric",
      "prompt_key": "game.numbers.one.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "glyph": "1",
      "guide_audio": "asset-vo-number-one",
      "tolerance_dp": 26,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.50,0.18],[0.50,0.45],[0.50,0.82]] }
      ]
    },
    {
      "level": 2,
      "mode": "number",
      "scoring": "geometric",
      "prompt_key": "game.numbers.two.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "glyph": "2",
      "guide_audio": "asset-vo-number-two",
      "tolerance_dp": 26,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.30,0.28],[0.42,0.18],[0.60,0.20],[0.66,0.34],[0.56,0.50],[0.38,0.66],[0.28,0.80],[0.50,0.80],[0.72,0.80]] }
      ]
    },
    {
      "level": 3,
      "mode": "number",
      "scoring": "geometric",
      "prompt_key": "game.numbers.three.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "glyph": "3",
      "guide_audio": "asset-vo-number-three",
      "tolerance_dp": 26,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.32,0.22],[0.50,0.17],[0.65,0.26],[0.58,0.42],[0.44,0.48],[0.60,0.54],[0.68,0.68],[0.52,0.82],[0.32,0.78]] }
      ]
    },
    {
      "level": 4,
      "mode": "number",
      "scoring": "geometric_ordered",
      "prompt_key": "game.numbers.four.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "glyph": "4",
      "guide_audio": "asset-vo-number-four",
      "tolerance_dp": 26,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.60,0.18],[0.34,0.56],[0.72,0.56]] },
        { "id": "s2", "order": 2, "type": "stroke", "direction": "forward",
          "points": [[0.60,0.36],[0.60,0.60],[0.60,0.82]] }
      ]
    },
    {
      "level": 5,
      "mode": "number",
      "scoring": "geometric_ordered",
      "prompt_key": "game.numbers.five.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "glyph": "5",
      "guide_audio": "asset-vo-number-five",
      "tolerance_dp": 26,
      "coverage_required": 0.8,
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward",
          "points": [[0.66,0.20],[0.40,0.20],[0.38,0.44],[0.56,0.44],[0.68,0.58],[0.60,0.78],[0.38,0.80]] },
        { "id": "s2", "order": 2, "type": "stroke", "direction": "forward",
          "points": [[0.40,0.20],[0.53,0.20],[0.66,0.20]] }
      ]
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-tcnumbers-intro",
    "vo.instruction": "asset-vo-tcnumbers-instruction",
    "vo.instruction_repeat": "asset-vo-tcnumbers-instruction-slow",
    "vo.hint": "asset-vo-tcnumbers-hint",
    "vo.stroke_complete": "asset-vo-stroke-complete",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}',
  'هذا الرقم. ضع إصبعك على النقطة، واتبع الطريق.',
  NULL, '{}', 0, 'draft'
);

-- 4. Localizations ---------------------------------------------------------
--
-- Both packs are language-neutral in geometry, so all three languages share the
-- same coordinates and differ only here.
INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, status, translated_from, is_machine_translated) VALUES
  ('game-tc-shapes-basic', 'ar', 'أشكال أولى', 'اتبع الطريق حتى تكمل الشكل، ثم لوّن كما تحب.',
   json_object(
     'game.shapes_basic.circle.prompt', 'هذه دائرة. ضع إصبعك على النقطة واتبع الطريق حتى تعود إلى البداية.',
     'game.shapes_basic.square.prompt', 'هذا مربّع. اتبع الطريق، وعند كل زاوية غيّر الاتجاه.',
     'game.shapes_basic.triangle.prompt', 'هذا مثلّث. له ثلاث زوايا. اتبع الطريق.'
   ), 'draft', NULL, 0),
  ('game-tc-shapes-basic', 'en', 'First shapes', 'Follow the path to finish the shape, then colour it in.',
   json_object(
     'game.shapes_basic.circle.prompt', 'This is a circle. Put your finger on the dot and follow the path back to the start.',
     'game.shapes_basic.square.prompt', 'This is a square. Follow the path, and turn at every corner.',
     'game.shapes_basic.triangle.prompt', 'This is a triangle. It has three corners. Follow the path.'
   ), 'draft', 'ar', 0),
  ('game-tc-shapes-basic', 'fr', 'Premières formes', 'Suis le chemin pour terminer la forme, puis colorie-la.',
   json_object(
     'game.shapes_basic.circle.prompt', 'C''est un cercle. Pose ton doigt sur le point et suis le chemin jusqu''au départ.',
     'game.shapes_basic.square.prompt', 'C''est un carré. Suis le chemin et tourne à chaque coin.',
     'game.shapes_basic.triangle.prompt', 'C''est un triangle. Il a trois coins. Suis le chemin.'
   ), 'draft', 'ar', 0),
  ('game-tc-numbers-1-10', 'ar', 'أرقامي', 'اتبع الطريق لترسم الرقم.',
   json_object(
     'game.numbers.one.prompt', 'هذا الرقم واحد. خطّ واحد من الأعلى إلى الأسفل.',
     'game.numbers.two.prompt', 'هذا الرقم اثنان. ابدأ من الأعلى، ثم اتبع الطريق إلى الخطّ السفلي.',
     'game.numbers.three.prompt', 'هذا الرقم ثلاثة. قوسان، الواحد فوق الآخر.',
     'game.numbers.four.prompt', 'هذا الرقم أربعة. ارسم الزاوية أولًا، ثم الخطّ النازل.',
     'game.numbers.five.prompt', 'هذا الرقم خمسة. ارسم الجسم أولًا، ثم الخطّ العلوي.'
   ), 'draft', NULL, 0),
  ('game-tc-numbers-1-10', 'en', 'My numbers', 'Follow the path to draw the number.',
   json_object(
     'game.numbers.one.prompt', 'This is number one. One line, from the top down.',
     'game.numbers.two.prompt', 'This is number two. Start at the top, then follow the path to the bottom line.',
     'game.numbers.three.prompt', 'This is number three. Two curves, one above the other.',
     'game.numbers.four.prompt', 'This is number four. Draw the corner first, then the line down.',
     'game.numbers.five.prompt', 'This is number five. Draw the body first, then the line on top.'
   ), 'draft', 'ar', 0),
  ('game-tc-numbers-1-10', 'fr', 'Mes chiffres', 'Suis le chemin pour tracer le chiffre.',
   json_object(
     'game.numbers.one.prompt', 'C''est le chiffre un. Une ligne, du haut vers le bas.',
     'game.numbers.two.prompt', 'C''est le chiffre deux. Commence en haut, puis suis le chemin jusqu''à la ligne du bas.',
     'game.numbers.three.prompt', 'C''est le chiffre trois. Deux courbes, l''une au-dessus de l''autre.',
     'game.numbers.four.prompt', 'C''est le chiffre quatre. Trace le coin d''abord, puis la ligne qui descend.',
     'game.numbers.five.prompt', 'C''est le chiffre cinq. Trace le corps d''abord, puis la ligne du haut.'
   ), 'draft', 'ar', 0);
