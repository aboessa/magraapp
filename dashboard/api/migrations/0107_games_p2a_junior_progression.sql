-- 0107 — P2-A: three-level progression for the two verified junior block-code games.
-- Voice references are resolved from stable ready r2_key values because asset ids differ by environment.
-- Missing any required voice file leaves that game's existing pack untouched.
WITH packs(game_id, content_pack) AS (
  VALUES
  ('game-wave1-block-code', '{"pack_version":1,"engine_id":"block_code","pack_id":"wave1-block-code-p2a","localization":"language_neutral","supports_dpad":true,"supervision_level":"none","progression":{"levels_to_finish":3,"advance_on":"level_complete"},"accessibility":{"sequential_tap_alternative":true,"reduced_motion_supported":true,"repeat_instructions_button":true,"min_touch_target_dp":64},"levels":[{"level":1,"grid":{"w":4,"h":4,"walls":[],"start":[0,0],"facing":"east","goal":[3,0],"collectibles":[]},"allowed_blocks":["move"],"block_limit":6,"optimal_blocks":3,"step_delay_ms":500,"show_grid_coordinates":false,"reference_solution":["move","move","move"]},{"level":2,"grid":{"w":4,"h":4,"walls":[],"start":[0,0],"facing":"east","goal":[3,2],"collectibles":[]},"allowed_blocks":["move","turn_right"],"block_limit":8,"optimal_blocks":6,"step_delay_ms":500,"show_grid_coordinates":false,"reference_solution":["move","move","move","turn_right","move","move"]},{"level":3,"grid":{"w":5,"h":5,"walls":[[2,0]],"start":[0,0],"facing":"east","goal":[4,2],"collectibles":[]},"allowed_blocks":["move","turn_left","turn_right","repeat"],"block_limit":10,"optimal_blocks":6,"step_delay_ms":500,"show_grid_coordinates":false,"reference_solution":["turn_right","repeat:2","move","turn_left","repeat:4","move"]}],"assets":{"images":[],"audio":[]},"voice_manifest":{"vo.intro":"private/audio/games/block-code/ar/vo-intro-ar.wav","vo.instruction":"private/audio/games/block-code/ar/vo-instruction-ar.wav","vo.instruction_repeat":"private/audio/games/block-code/ar/vo-instruction-repeat-ar.wav","vo.level_complete":"private/audio/games/block-code/ar/vo-level-complete-ar.wav","vo.game_complete":"private/audio/games/block-code/ar/vo-game-complete-ar.wav","vo.exit_confirm":"private/audio/games/block-code/ar/vo-exit-confirm-ar.wav","vo.correct":"private/audio/games/block-code/ar/vo-correct-ar.wav","vo.retry":"private/audio/games/block-code/ar/vo-retry-ar.wav","vo.hint":"private/audio/games/block-code/ar/vo-hint-ar.wav","vo.block.move":"private/audio/games/block-code/ar/vo-block-move-ar.wav","vo.block.turn_left":"private/audio/games/block-code/ar/vo-block-turn-left-ar.wav","vo.block.turn_right":"private/audio/games/block-code/ar/vo-block-turn-right-ar.wav","vo.block.repeat":"private/audio/games/block-code/ar/vo-block-repeat-ar.wav","vo.block.if_path":"private/audio/games/block-code/ar/vo-block-if-path-ar.wav","vo.block.collect":"private/audio/games/block-code/ar/vo-block-collect-ar.wav","vo.collision":"private/audio/games/block-code/ar/vo-collision-ar.wav","vo.star_optimal":"private/audio/games/block-code/ar/vo-star-optimal-ar.wav"}}'),
  ('game-wave3-block-advanced', '{"pack_version":1,"engine_id":"block_code","pack_id":"wave3-block-advanced-p2a","localization":"language_neutral","supports_dpad":true,"supervision_level":"none","progression":{"levels_to_finish":3,"advance_on":"level_complete"},"accessibility":{"sequential_tap_alternative":true,"reduced_motion_supported":true,"repeat_instructions_button":true,"min_touch_target_dp":64},"levels":[{"level":1,"grid":{"w":5,"h":5,"walls":[],"start":[0,0],"facing":"east","goal":[4,2],"collectibles":[]},"allowed_blocks":["move","turn_right","repeat"],"block_limit":10,"optimal_blocks":6,"step_delay_ms":500,"show_grid_coordinates":false,"reference_solution":["repeat:4","move","turn_right","repeat:2","move"]},{"level":2,"grid":{"w":5,"h":5,"walls":[],"start":[0,0],"facing":"east","goal":[4,2],"collectibles":[[4,0]]},"allowed_blocks":["move","turn_right","repeat","collect"],"block_limit":10,"optimal_blocks":7,"step_delay_ms":500,"show_grid_coordinates":false,"reference_solution":["repeat:4","move","collect","turn_right","repeat:2","move"]},{"level":3,"grid":{"w":3,"h":3,"walls":[[1,0]],"start":[0,0],"facing":"east","goal":[0,1],"collectibles":[]},"allowed_blocks":["move","turn_right","if_path"],"block_limit":6,"optimal_blocks":4,"step_delay_ms":500,"show_grid_coordinates":false,"reference_solution":["if_path","move","turn_right","move"]}],"assets":{"images":[],"audio":[]},"voice_manifest":{"vo.intro":"private/audio/games/block-code/ar/vo-intro-ar.wav","vo.instruction":"private/audio/games/block-code/ar/vo-instruction-ar.wav","vo.instruction_repeat":"private/audio/games/block-code/ar/vo-instruction-repeat-ar.wav","vo.level_complete":"private/audio/games/block-code/ar/vo-level-complete-ar.wav","vo.game_complete":"private/audio/games/block-code/ar/vo-game-complete-ar.wav","vo.exit_confirm":"private/audio/games/block-code/ar/vo-exit-confirm-ar.wav","vo.correct":"private/audio/games/block-code/ar/vo-correct-ar.wav","vo.retry":"private/audio/games/block-code/ar/vo-retry-ar.wav","vo.hint":"private/audio/games/block-code/ar/vo-hint-ar.wav","vo.block.move":"private/audio/games/block-code/ar/vo-block-move-ar.wav","vo.block.turn_left":"private/audio/games/block-code/ar/vo-block-turn-left-ar.wav","vo.block.turn_right":"private/audio/games/block-code/ar/vo-block-turn-right-ar.wav","vo.block.repeat":"private/audio/games/block-code/ar/vo-block-repeat-ar.wav","vo.block.if_path":"private/audio/games/block-code/ar/vo-block-if-path-ar.wav","vo.block.collect":"private/audio/games/block-code/ar/vo-block-collect-ar.wav","vo.collision":"private/audio/games/block-code/ar/vo-collision-ar.wav","vo.star_optimal":"private/audio/games/block-code/ar/vo-star-optimal-ar.wav"}}')
),
resolved AS (
  SELECT
    p.game_id,
    json_set(
      p.content_pack,
      '$.voice_manifest',
      json((
        SELECT json_group_object(v.key, ca.id)
          FROM json_each(json_extract(p.content_pack, '$.voice_manifest')) AS v
          JOIN content_assets AS ca
            ON ca.r2_key = v.value
           AND ca.status = 'ready'
      ))
    ) AS content_pack,
    (SELECT COUNT(*) FROM json_each(json_extract(p.content_pack, '$.voice_manifest'))) AS required_voice_count,
    (
      SELECT COUNT(*)
        FROM json_each(json_extract(p.content_pack, '$.voice_manifest')) AS v
        JOIN content_assets AS ca
          ON ca.r2_key = v.value
         AND ca.status = 'ready'
    ) AS resolved_voice_count
  FROM packs AS p
)
UPDATE games
   SET content_pack = resolved.content_pack
  FROM resolved
 WHERE games.id = resolved.game_id
   AND resolved.resolved_voice_count = resolved.required_voice_count;
