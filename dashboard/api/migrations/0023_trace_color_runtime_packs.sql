-- 0023 — move trace_color runtime geometry out of Markdown and into the packs.
--
-- ## Why
--
-- `games.content_pack` for the only two authored tracing games held the
-- *editorial* manifest: pack_id, engine_justification, prose level goals. The
-- runtime needs stroke geometry, and there was none. Verified before this
-- migration: `stroke_paths`, `tolerance_dp` and `coverage_required` appeared
-- zero times anywhere under `dashboard/`. The real coordinates existed only in
-- docs/content/planets/01-abjad/games/game-letter-tracing.md, which no code can
-- read.
--
-- The editorial narrative is not lost: it stays in the Markdown, which is where
-- authors read it, and the superseded pack is recorded in `audit_logs` below so
-- the change is traceable.
--
-- ## Where the numbers come from
--
-- Every coordinate below is copied from the authored spec, not invented:
--   alif / lam  -> docs/content/planets/01-abjad/game-packs.md  (pack tc-luna-ep4)
--   baa         -> docs/games/engines/02-trace-color.md          (contract example)
--   noon        -> docs/content/planets/01-abjad/games/game-letter-tracing.md
-- Thresholds tolerance_dp 24 / coverage 0.8, and the simplified motor mode
-- 40dp / 0.6, are the values the engine contract and the accessibility document
-- already specify.
--
-- ## What is deliberately not claimed
--
-- `review.linguistic_review.status` is `pending`, not `approved`. No qualified
-- Arabic reviewer has signed off the stroke order, and the pack validator
-- refuses to publish a letter pack that is not approved. Both games therefore
-- stay `draft` after this migration, which is the honest state.

-- 1. ABJAD — game-letter-tracing (pack tc-luna-ep4) -------------------------
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
SELECT 'audit-0023-glt-supersede', 'migration-0023', 'update', 'game', 'game-letter-tracing',
       json_object('reason', 'content_pack replaced with trace_color.v1 runtime shape',
                   'superseded_pack', content_pack)
  FROM games WHERE id = 'game-letter-tracing';

UPDATE games SET content_pack = '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "tc-luna-ep4",
  "localization": "language_specific",
  "supports_dpad": false,
  "supervision_level": "none",
  "progression": { "levels_to_finish": 4, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 40, "coverage_required": 0.6 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 48
  },
  "review": {
    "linguistic_review": {
      "status": "pending",
      "reviewer": null,
      "reviewed_at": null,
      "notes": "Stroke order for alif, lam, baa and noon requires certified Arabic review before publish."
    }
  },
  "levels": [
    {
      "level": 1,
      "mode": "letter",
      "scoring": "geometric_ordered",
      "prompt_key": "game.letter_tracing.alif.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "language": "ar",
      "glyph": "ا",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.50,0.22],[0.50,0.74]] }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-alif",
      "background_asset": "asset-glyph-alif",
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"],
        "template_asset": "asset-glyph-alif"
      }
    },
    {
      "level": 2,
      "mode": "letter",
      "scoring": "geometric_ordered",
      "prompt_key": "game.letter_tracing.lam.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "language": "ar",
      "glyph": "ل",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.55,0.20],[0.55,0.62],[0.40,0.75],[0.30,0.68]] }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-lam",
      "background_asset": "asset-glyph-lam",
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"],
        "template_asset": "asset-glyph-lam"
      }
    },
    {
      "level": 3,
      "mode": "letter",
      "scoring": "geometric_ordered",
      "prompt_key": "game.letter_tracing.baa.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "language": "ar",
      "glyph": "ب",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.80,0.45],[0.55,0.62],[0.30,0.45]] },
        { "id": "s2", "order": 2, "type": "dot", "points": [[0.55,0.78]] }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-baa",
      "background_asset": "asset-glyph-baa",
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"],
        "template_asset": "asset-glyph-baa"
      }
    },
    {
      "level": 4,
      "mode": "letter",
      "scoring": "geometric_ordered",
      "prompt_key": "game.letter_tracing.noon.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "language": "ar",
      "glyph": "ن",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.68,0.42],[0.62,0.62],[0.50,0.70],[0.38,0.62],[0.32,0.42]] },
        { "id": "s2", "order": 2, "type": "dot", "points": [[0.50,0.28]] }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-noon",
      "background_asset": "asset-glyph-noon",
      "coloring": {
        "enabled": true,
        "regions": ["r1"],
        "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"],
        "template_asset": "asset-glyph-noon"
      }
    }
  ],
  "assets": {
    "images": ["asset-glyph-alif","asset-glyph-lam","asset-glyph-baa","asset-glyph-noon"],
    "audio": ["asset-vo-sound-alif","asset-vo-sound-lam","asset-vo-sound-baa","asset-vo-sound-noon"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-glt-intro",
    "vo.instruction": "asset-vo-glt-instruction",
    "vo.instruction_repeat": "asset-vo-glt-instruction-slow",
    "vo.hint": "asset-vo-glt-hint",
    "vo.stroke_complete": "asset-vo-stroke-complete",
    "vo.coloring_intro": "asset-vo-coloring-intro",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}', updated_at = datetime('now')
WHERE id = 'game-letter-tracing';

-- 2. MAHARAT — game-yt-pinch-place ------------------------------------------
--
-- The editorial pack was {targets, path_width:"wide", timer, penalty_off_path,
-- audio_prompt}: closer to runnable than the ABJAD one but still not the engine
-- contract. "wide" is expressed here as a real tolerance in dp, and the three
-- repeated targets from the manifest become three levels whose tolerance
-- narrows, which is the manifest's own progression note
-- ("المسار يضيق قليلًا بين الهدف الأول والثالث").
--
-- coverage_required is 0.5, the schema floor, because the manifest's success
-- rule is explicitly forgiving: the finger reaches the basket after passing over
-- the path "ولو خرج عنه" — even if it left it.
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
SELECT 'audit-0023-ytpp-supersede', 'migration-0023', 'update', 'game', 'game-yt-pinch-place',
       json_object('reason', 'content_pack replaced with trace_color.v1 runtime shape',
                   'superseded_pack', content_pack)
  FROM games WHERE id = 'game-yt-pinch-place';

UPDATE games SET content_pack = '{
  "pack_version": 1,
  "engine_id": "trace_color",
  "pack_id": "yt-pinch-place",
  "localization": "translatable",
  "supports_dpad": false,
  "supervision_level": "required",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "accessibility": {
    "simplified_motor": { "tolerance_dp": 56, "coverage_required": 0.4 },
    "sequential_tap_alternative": true,
    "reduced_motion_supported": true,
    "min_touch_target_dp": 64
  },
  "review": { "linguistic_review": { "status": "not_required" } },
  "levels": [
    {
      "level": 1,
      "mode": "path",
      "scoring": "geometric",
      "prompt_key": "game.pinch_place.peg_to_basket.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.20,0.50],[0.45,0.50],[0.70,0.50]] }
      ],
      "tolerance_dp": 48,
      "coverage_required": 0.5,
      "guide_audio": "asset-vo-yt-pack1-instruction",
      "background_asset": "asset-yt-tool-peg"
    },
    {
      "level": 2,
      "mode": "path",
      "scoring": "geometric",
      "prompt_key": "game.pinch_place.peg_to_basket.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.20,0.62],[0.42,0.52],[0.68,0.44]] }
      ],
      "tolerance_dp": 42,
      "coverage_required": 0.5,
      "guide_audio": "asset-vo-yt-pack1-instruction",
      "background_asset": "asset-yt-tool-peg"
    },
    {
      "level": 3,
      "mode": "path",
      "scoring": "geometric",
      "prompt_key": "game.pinch_place.peg_to_basket.prompt",
      "completion": { "rule": "all_strokes_complete" },
      "stroke_paths": [
        { "id": "s1", "order": 1, "type": "stroke", "direction": "forward", "points": [[0.18,0.70],[0.34,0.56],[0.52,0.48],[0.72,0.40]] }
      ],
      "tolerance_dp": 36,
      "coverage_required": 0.5,
      "guide_audio": "asset-vo-yt-pack1-instruction",
      "background_asset": "asset-yt-tool-basket"
    }
  ],
  "assets": {
    "images": ["asset-yt-tool-peg","asset-yt-tool-basket"],
    "audio": ["asset-vo-yt-pack1-instruction"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-yt-pack1-intro",
    "vo.instruction": "asset-vo-yt-pack1-instruction",
    "vo.instruction_repeat": "asset-vo-yt-pack1-instruction-slow",
    "vo.stroke_complete": "asset-vo-stroke-complete",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}', updated_at = datetime('now')
WHERE id = 'game-yt-pinch-place';

-- 3. The safety notes that supervision_level "required" implies --------------
--
-- `game-yt-pinch-place` is supervision_level 'required' with safety_notes NULL,
-- which mandatory rule 12 of the data contract forbids. The series safety
-- constraint is already documented and governs the whole of yadi-tasnaa: every
-- piece longer than the child's palm, wooden clothes peg at least 7cm, and no
-- beads, buttons, pulses, button cells or magnets at any point.
UPDATE games
   SET safety_notes = 'يحتاج وجود بالغ. كل قطعة تُستعمل مع اللعبة أطول من كفّ الطفل: مشبك ملابس خشبي 7 سم أو أكثر. ممنوع منعًا مطلقًا: الخرز والأزرار والبقوليات وكرات الصوف الصغيرة والبطاريات الزرّية والمغناطيس.',
       updated_at = datetime('now')
 WHERE id = 'game-yt-pinch-place' AND (safety_notes IS NULL OR trim(safety_notes) = '');
