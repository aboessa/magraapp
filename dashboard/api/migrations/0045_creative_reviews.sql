-- 0045 human review assignments for Creative Studio — pending, not approved
-- Do not self-approve; leave pending for real reviewer.

-- Arabic letter tracing requires linguistic review
INSERT OR IGNORE INTO content_reviews (id, entity_type, entity_id, reviewer_role, status, created_at) VALUES
 ('review-letter-alif-ling','game','game-letter-tracing','linguistic','pending', datetime('now')),
 ('review-letter-baa-ling','game','game-letter-tracing','linguistic','pending', datetime('now'));

-- Reference activities require editorial + art review
INSERT OR IGNORE INTO content_reviews (id, entity_type, entity_id, reviewer_role, status, created_at) VALUES
 ('review-ref-cat-art','reference_activity','ref-cat','art','pending', datetime('now')),
 ('review-ref-cat-editorial','reference_activity','ref-cat','editorial','pending', datetime('now')),
 ('review-ref-rocket-art','reference_activity','ref-rocket','art','pending', datetime('now'));

-- Oloom observation requires scientific review
INSERT OR IGNORE INTO content_reviews (id, entity_type, entity_id, reviewer_role, status, created_at) VALUES
 ('review-oloom-sci','game','game-oloom-observation-draw','scientific','pending', datetime('now'));

-- Coloring templates art review (representative)
INSERT OR IGNORE INTO content_reviews (id, entity_type, entity_id, reviewer_role, status, created_at) VALUES
 ('review-color-bird-art','coloring_template','color-bird','art','pending', datetime('now')),
 ('review-color-cat-art','coloring_template','color-cat','art','pending', datetime('now'));
