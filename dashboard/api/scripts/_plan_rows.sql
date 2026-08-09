SELECT s.planet_id AS planet, s.slug AS series_slug, s.content_class, 'episode' AS kind, 1 AS kind_order,
  e.episode_number AS item_number, e.id AS item_slug, e.title_ar AS title,
  (SELECT o.code FROM learning_objectives o WHERE o.id=e.learning_objective_id) AS objective_code,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='episode' AND al.entity_id=e.id AND al.role IN ('stream','video')) AS has_stream,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='episode' AND al.entity_id=e.id AND al.role IN ('thumbnail','still')) AS has_thumb,
  0 AS pages, 0 AS has_pack, 0 AS has_pages, 0 AS has_steps, 0 AS has_cover
FROM episodes e JOIN series s ON s.id=e.series_id WHERE s.status<>'archived' AND e.status<>'archived';
SELECT s.planet_id AS planet, s.slug AS series_slug, s.content_class, 'story' AS kind, 2 AS kind_order,
  st.sort_order AS item_number, st.slug AS item_slug, st.title_ar AS title,
  NULL AS objective_code, 0 AS has_stream, 0 AS has_thumb,
  (SELECT count(*) FROM story_pages sp WHERE sp.story_id=st.id) AS pages,
  0 AS has_pack, 0 AS has_pages, 0 AS has_steps,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='story' AND al.entity_id=st.id AND al.role='cover') AS has_cover
FROM stories st JOIN series s ON s.id=st.series_id WHERE st.status<>'archived' AND s.status<>'archived';
SELECT s.planet_id AS planet, s.slug AS series_slug, s.content_class, 'book' AS kind, 3 AS kind_order,
  NULL AS item_number, b.id AS item_slug, b.title_ar AS title,
  NULL AS objective_code, 0 AS has_stream, 0 AS has_thumb, 0 AS pages, 0 AS has_pack,
  CASE WHEN b.pages<>'[]' THEN 1 ELSE 0 END AS has_pages, 0 AS has_steps,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='book' AND al.entity_id=b.id AND al.role='cover') AS has_cover
FROM books b JOIN series s ON s.id=b.series_id WHERE s.status<>'archived';
SELECT s.planet_id AS planet, s.slug AS series_slug, s.content_class, 'game' AS kind, 4 AS kind_order,
  NULL AS item_number, g.id AS item_slug, g.title_ar AS title,
  (SELECT o.code FROM learning_objectives o WHERE o.id=g.learning_objective_id) AS objective_code,
  0 AS has_stream, 0 AS has_thumb, 0 AS pages,
  CASE WHEN g.content_pack<>'{}' THEN 1 ELSE 0 END AS has_pack, 0 AS has_pages, 0 AS has_steps,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='game' AND al.entity_id=g.id AND al.role='cover') AS has_cover
FROM games g JOIN series s ON s.id=g.series_id WHERE s.status<>'archived';
