-- End-to-end verification of the drawing content chain.
SELECT '--- trace_color games ---' AS section;
SELECT g.id,
       json_valid(g.content_pack) AS pack_valid,
       json_array_length(g.content_pack, '$.levels') AS levels,
       json_extract(g.content_pack, '$.review.linguistic_review.status') AS review,
       json_extract(g.content_pack, '$.localization') AS localization,
       g.status
  FROM games g WHERE g.engine_id = 'trace_color' ORDER BY g.id;

SELECT '--- full chain: series -> episode -> game -> objective -> skills -> localizations ---' AS section;
SELECT g.id AS game,
       s.slug AS series,
       g.episode_id AS episode,
       lo.code AS objective,
       lo.skill_id AS primary_skill,
       (SELECT group_concat(los.skill_id) FROM learning_objective_skills los
         WHERE los.objective_id = lo.id AND los.role = 'secondary') AS secondary_skills,
       (SELECT group_concat(gl.language) FROM game_localizations gl WHERE gl.game_id = g.id) AS languages,
       (SELECT count(*) FROM learning_objective_tracks t WHERE t.objective_id = lo.id) AS tracks
  FROM games g
  LEFT JOIN series s ON s.id = g.series_id
  LEFT JOIN learning_objectives lo ON lo.id = g.learning_objective_id
 WHERE g.engine_id = 'trace_color' ORDER BY g.id;

SELECT '--- geometry actually present ---' AS section;
SELECT g.id,
       json_extract(g.content_pack, '$.levels[0].stroke_paths[0].points[0][0]') AS first_x,
       json_extract(g.content_pack, '$.levels[0].tolerance_dp') AS tol,
       json_extract(g.content_pack, '$.levels[0].coverage_required') AS cov,
       json_extract(g.content_pack, '$.accessibility.simplified_motor.tolerance_dp') AS simp_tol,
       json_extract(g.content_pack, '$.accessibility.sequential_tap_alternative') AS tap_alt,
       json_extract(g.content_pack, '$.supports_dpad') AS dpad
  FROM games g WHERE g.engine_id = 'trace_color' ORDER BY g.id;

SELECT '--- fine_motor is used ---' AS section;
SELECT (SELECT count(*) FROM learning_objectives WHERE skill_id = 'fine_motor') AS primary_uses,
       (SELECT count(*) FROM learning_objective_skills WHERE skill_id = 'fine_motor') AS total_uses,
       (SELECT count(*) FROM skills) AS skills_total,
       (SELECT count(*) FROM game_localizations) AS localization_rows;

SELECT '--- consent types ---' AS section;
SELECT sql LIKE '%child_creations%' AS has_creations_consent
  FROM sqlite_master WHERE name = 'parental_consents';
