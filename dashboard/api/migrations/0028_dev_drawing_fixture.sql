-- 0028 — a published drawing fixture for end-to-end verification.
--
-- ## Why a fixture rather than publishing real content
--
-- Every authored drawing pack is correctly `draft`: their artwork is not produced,
-- their voice-over is not recorded, and the Arabic letter pack needs a reviewer.
-- Flipping one to `published` to make a test pass would be faking exactly the
-- readiness the validator exists to protect.
--
-- So this adds a dedicated fixture whose assets genuinely are `ready`, on a series
-- marked `content_class = 'test_fixture'`. `lib/contentClass.ts` already excludes
-- that class from the public catalogue unless `INCLUDE_TEST_FIXTURES` is set, and
-- refuses the opt-in outright when `ENVIRONMENT = production`. The mechanism is the
-- one Mazen & Thaaloub already uses; this reuses it rather than inventing a second
-- way to hide content.
--
-- The pack is `tc-shapes-basic`'s circle: a language-neutral shape needing no
-- linguistic review, so the fixture is publishable without pretending a human
-- approved anything.

-- 1. The fixture series ------------------------------------------------------
INSERT OR IGNORE INTO series (
  id, title_ar, title_en, slug, planet_id, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, description_ar,
  visual_style, difficulty, production_level, status, sort_order, content_class
) VALUES (
  'series-drawing-fixture', 'حزمة تحقّق الرسم', 'Drawing Verification Fixture',
  'drawing-verification-fixture', 'alam', 'standalone', 3, 5,
  'pre_reader', 'tap', 'none',
  'سلسلة تحقّق تقنية للرسم. ليست محتوى مجرة ولا تُعرض في الإنتاج.',
  'Soft 2D', 'easy', 'motion_story', 'published', 999, 'test_fixture'
);

-- 2. Assets that are genuinely ready -----------------------------------------
--
-- Minimal rows: `status = 'ready'` is what the publish gate checks. They carry no
-- r2_key, so the delivery endpoint reports them as unavailable rather than minting
-- a token for a file that does not exist - which is the honest outcome and is
-- asserted by the round-trip script.
INSERT OR IGNORE INTO content_assets (id, kind, visibility, status, original_filename)
VALUES
  ('asset-vo-fixture-intro', 'audio', 'private', 'ready', 'fixture-intro.mp3'),
  ('asset-vo-fixture-instruction', 'audio', 'private', 'ready', 'fixture-instruction.mp3'),
  ('asset-vo-fixture-instruction-slow', 'audio', 'private', 'ready', 'fixture-instruction-slow.mp3'),
  ('asset-vo-fixture-stroke-complete', 'audio', 'private', 'ready', 'fixture-stroke.mp3'),
  ('asset-vo-fixture-coloring-intro', 'audio', 'private', 'ready', 'fixture-coloring.mp3'),
  ('asset-vo-fixture-level-complete', 'audio', 'private', 'ready', 'fixture-level.mp3'),
  ('asset-vo-fixture-game-complete', 'audio', 'private', 'ready', 'fixture-game.mp3'),
  ('asset-vo-fixture-exit-confirm', 'audio', 'private', 'ready', 'fixture-exit.mp3');

-- 3. The published fixture game ----------------------------------------------
INSERT OR IGNORE INTO games (
  id, engine_id, series_id, episode_id, title_ar, learning_objective_id,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  safety_notes, difficulty, content_pack, instructions_ar, max_attempts,
  help_system, is_free, status
) VALUES (
  'game-fixture-trace-circle', 'trace_color', 'series-drawing-fixture', NULL,
  'دائرة التحقّق', 'objective-world-shape-trace_form',
  3, 5, 'pre_reader', 'tap', 'none', NULL, 'easy',
  '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "fixture-trace-circle",
  "localization": "language_neutral",
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
      "mode": "shape",
      "scoring": "geometric",
      "prompt_key": "game.fixture.circle.prompt",
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
    }
  ],
  "assets": { "images": [], "audio": [] },
  "voice_manifest": {
    "vo.intro": "asset-vo-fixture-intro",
    "vo.instruction": "asset-vo-fixture-instruction",
    "vo.instruction_repeat": "asset-vo-fixture-instruction-slow",
    "vo.stroke_complete": "asset-vo-fixture-stroke-complete",
    "vo.coloring_intro": "asset-vo-fixture-coloring-intro",
    "vo.level_complete": "asset-vo-fixture-level-complete",
    "vo.game_complete": "asset-vo-fixture-game-complete",
    "vo.exit_confirm": "asset-vo-fixture-exit-confirm"
  }
}',
  'اتبع الطريق حتى تكمل الدائرة، ثم لوّن كما تحب.',
  NULL, '{}', 1, 'published'
);

INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, status, translated_from, is_machine_translated) VALUES
  ('game-fixture-trace-circle', 'ar', 'دائرة التحقّق', 'اتبع الطريق حتى تكمل الدائرة.',
   json_object('game.fixture.circle.prompt', 'هذه دائرة. ضع إصبعك على النقطة واتبع الطريق.'), 'ready', NULL, 0),
  ('game-fixture-trace-circle', 'en', 'Verification circle', 'Follow the path to finish the circle.',
   json_object('game.fixture.circle.prompt', 'This is a circle. Put your finger on the dot and follow the path.'), 'ready', 'ar', 0),
  ('game-fixture-trace-circle', 'fr', 'Cercle de vérification', 'Suis le chemin pour terminer le cercle.',
   json_object('game.fixture.circle.prompt', 'C''est un cercle. Pose ton doigt sur le point et suis le chemin.'), 'ready', 'ar', 0);
