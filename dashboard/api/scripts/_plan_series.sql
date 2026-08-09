SELECT s.planet_id AS planet, s.slug, s.title_ar, s.type, s.age_min, s.age_max, s.production_level, s.price_tier, s.status, s.description_ar, s.content_class,
  (SELECT st.track_id FROM series_tracks st WHERE st.series_id=s.id LIMIT 1) AS track,
  CASE (SELECT st.track_id FROM series_tracks st WHERE st.series_id=s.id LIMIT 1) WHEN 'preschool' THEN 1 WHEN 'kids' THEN 2 ELSE 3 END AS track_order,
  (SELECT sc.category_id FROM series_categories sc WHERE sc.series_id=s.id LIMIT 1) AS category_id,
  COALESCE((SELECT max(se.episode_count) FROM seasons se WHERE se.series_id=s.id),0) AS planned_items,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='series' AND al.entity_id=s.id AND al.role='poster') AS has_poster,
  (SELECT count(*) FROM asset_links al WHERE al.entity_type='series' AND al.entity_id=s.id AND al.role='banner') AS has_banner
FROM series s ORDER BY s.planet_id, track_order, s.slug;
