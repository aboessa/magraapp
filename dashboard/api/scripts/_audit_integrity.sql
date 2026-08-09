SELECT 'published episode with no stream' AS chk, count(*) AS n FROM episodes e WHERE e.status='published' AND e.is_published=1 AND NOT EXISTS(SELECT 1 FROM asset_links al WHERE al.entity_type='episode' AND al.entity_id=e.id AND al.role IN ('stream','video'))
UNION ALL SELECT 'published series with 0 published episodes', count(*) FROM series s WHERE s.status='published' AND NOT EXISTS(SELECT 1 FROM episodes e WHERE e.series_id=s.id AND e.status='published' AND e.is_published=1)
UNION ALL SELECT 'published Majarra series missing poster', count(*) FROM series s WHERE s.status='published' AND s.content_class='production' AND NOT EXISTS(SELECT 1 FROM asset_links al WHERE al.entity_type='series' AND al.entity_id=s.id AND al.role IN ('poster','cover'))
UNION ALL SELECT 'episode with no age track', count(*) FROM episodes e WHERE NOT EXISTS(SELECT 1 FROM episode_tracks t WHERE t.episode_id=e.id)
UNION ALL SELECT 'episode with dangling objective', count(*) FROM episodes e WHERE e.learning_objective_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM learning_objectives o WHERE o.id=e.learning_objective_id)
UNION ALL SELECT 'episode with dangling season', count(*) FROM episodes e WHERE e.season_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM seasons s WHERE s.id=e.season_id)
UNION ALL SELECT 'series with no category', count(*) FROM series s WHERE NOT EXISTS(SELECT 1 FROM series_categories sc WHERE sc.series_id=s.id)
UNION ALL SELECT 'series with no age track', count(*) FROM series s WHERE NOT EXISTS(SELECT 1 FROM series_tracks st WHERE st.series_id=s.id)
UNION ALL SELECT 'duplicate artwork links', count(*) FROM (SELECT 1 FROM asset_links GROUP BY entity_type,entity_id,role HAVING count(*)>1)
UNION ALL SELECT 'orphan episode asset_link', count(*) FROM asset_links al WHERE al.entity_type='episode' AND NOT EXISTS(SELECT 1 FROM episodes e WHERE e.id=al.entity_id)
UNION ALL SELECT 'orphan series asset_link', count(*) FROM asset_links al WHERE al.entity_type='series' AND NOT EXISTS(SELECT 1 FROM series e WHERE e.id=al.entity_id)
UNION ALL SELECT 'objective with no age track', count(*) FROM learning_objectives o WHERE NOT EXISTS(SELECT 1 FROM learning_objective_tracks t WHERE t.objective_id=o.id)
UNION ALL SELECT 'duplicate episode_number in a series', count(*) FROM (SELECT 1 FROM episodes GROUP BY series_id,episode_number HAVING count(*)>1)
UNION ALL SELECT 'episode age range outside its series', count(*) FROM episodes e JOIN series s ON s.id=e.series_id WHERE e.age_min < s.age_min OR e.age_max > s.age_max
UNION ALL SELECT 'public asset whose r2_key is not public/', count(*) FROM content_assets WHERE visibility='public' AND status='ready' AND r2_key NOT LIKE 'public/%'
UNION ALL SELECT 'private asset whose r2_key is not private/', count(*) FROM content_assets WHERE visibility='private' AND status='ready' AND r2_key NOT LIKE 'private/%'
UNION ALL SELECT 'video asset marked public', count(*) FROM content_assets WHERE kind='video' AND visibility='public'
UNION ALL SELECT 'ready asset with no r2_key', count(*) FROM content_assets WHERE status='ready' AND (r2_key IS NULL OR bucket IS NULL);
