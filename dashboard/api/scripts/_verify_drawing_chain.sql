-- End-to-end verification of the drawing content chain.
SELECT '--- drawing games by planet, mode and scoring ---' AS section;
SELECT g.id,
       s.planet_id,
       json_extract(g.content_pack, '$.levels[0].mode') AS first_mode,
       json_extract(g.content_pack, '$.levels[0].scoring') AS first_scoring,
       CASE WHEN g.learning_objective_id IS NULL THEN 0 ELSE 1 END AS has_objective,
       g.status
  FROM games g LEFT JOIN series s ON s.id = g.series_id
 WHERE g.engine_id = 'trace_color'
 ORDER BY s.planet_id, g.id;

SELECT '--- unscored packs must carry no objective ---' AS section;
SELECT count(*) AS violations
  FROM games g
 WHERE g.engine_id = 'trace_color'
   AND g.learning_objective_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM json_each(g.content_pack, '$.levels')
      WHERE json_extract(json_each.value, '$.scoring') <> 'none'
   );

SELECT '--- no drawing content on tarikh or islamic ---' AS section;
SELECT count(*) AS forbidden_planet_packs
  FROM games g JOIN series s ON s.id = g.series_id
 WHERE g.engine_id = 'trace_color' AND s.planet_id IN ('tarikh', 'islamic');

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

SELECT '--- creations are not catalogue media ---' AS section;
-- Child creations live in FamilyState and CREATIONS_BUCKET. If one ever reached
-- content_assets the admin media library would classify it as catalogue artwork
-- and bucketForAsset could place it in the public bucket.
SELECT count(*) AS creations_leaked_into_content_assets
  FROM content_assets
 WHERE r2_key LIKE 'family/%'
    OR id LIKE 'creation-%'
    OR kind = 'creation';

SELECT '--- no public asset carries a family-scoped key ---' AS section;
SELECT count(*) AS public_assets_with_family_key
  FROM content_assets
 WHERE visibility = 'public' AND r2_key LIKE '%family/%';

SELECT '--- consent types ---' AS section;
SELECT sql LIKE '%child_creations%' AS has_creations_consent
  FROM sqlite_master WHERE name = 'parental_consents';
