-- 68 صفحة لـ 16 قصة (4-6 لكل قصة) - كل صفحة 3:4 مع نص وصورة افتراضية

-- Helper: نستخدم story_pages مع layout full_bleed و page_number

INSERT INTO story_pages (id, story_id, page_number, layout, image_asset_id, sort_order) VALUES
-- book-qisas-p1 (4 صفحات)
('page-p1-1', 'book-qisas-p1', 1, 'full_bleed', NULL, 1), ('page-p1-2', 'book-qisas-p1', 2, 'full_bleed', NULL, 2), ('page-p1-3', 'book-qisas-p1', 3, 'full_bleed', NULL, 3), ('page-p1-4', 'book-qisas-p1', 4, 'full_bleed', NULL, 4),
-- p2
('page-p2-1', 'book-qisas-p2', 1, 'full_bleed', NULL, 1), ('page-p2-2', 'book-qisas-p2', 2, 'full_bleed', NULL, 2), ('page-p2-3', 'book-qisas-p2', 3, 'full_bleed', NULL, 3), ('page-p2-4', 'book-qisas-p2', 4, 'full_bleed', NULL, 4),
-- p3 audio
('page-p3-1', 'book-qisas-p3', 1, 'full_bleed', NULL, 1), ('page-p3-2', 'book-qisas-p3', 2, 'full_bleed', NULL, 2), ('page-p3-3', 'book-qisas-p3', 3, 'full_bleed', NULL, 3), ('page-p3-4', 'book-qisas-p3', 4, 'full_bleed', NULL, 4),
-- p4
('page-p4-1', 'book-qisas-p4', 1, 'full_bleed', NULL, 1), ('page-p4-2', 'book-qisas-p4', 2, 'full_bleed', NULL, 2), ('page-p4-3', 'book-qisas-p4', 3, 'full_bleed', NULL, 3), ('page-p4-4', 'book-qisas-p4', 4, 'full_bleed', NULL, 4),
-- k1 5 صفحات
('page-k1-1', 'book-qisas-k1', 1, 'full_bleed', NULL, 1), ('page-k1-2', 'book-qisas-k1', 2, 'full_bleed', NULL, 2), ('page-k1-3', 'book-qisas-k1', 3, 'full_bleed', NULL, 3), ('page-k1-4', 'book-qisas-k1', 4, 'full_bleed', NULL, 4), ('page-k1-5', 'book-qisas-k1', 5, 'full_bleed', NULL, 5),
-- k2 interactive 5
('page-k2-1', 'book-qisas-k2', 1, 'full_bleed', NULL, 1), ('page-k2-2', 'book-qisas-k2', 2, 'split', NULL, 2), ('page-k2-3', 'book-qisas-k2', 3, 'full_bleed', NULL, 3), ('page-k2-4', 'book-qisas-k2', 4, 'split', NULL, 4), ('page-k2-5', 'book-qisas-k2', 5, 'full_bleed', NULL, 5),
-- k3 comic 6
('page-k3-1', 'book-qisas-k3', 1, 'panels', NULL, 1), ('page-k3-2', 'book-qisas-k3', 2, 'panels', NULL, 2), ('page-k3-3', 'book-qisas-k3', 3, 'panels', NULL, 3), ('page-k3-4', 'book-qisas-k3', 4, 'panels', NULL, 4), ('page-k3-5', 'book-qisas-k3', 5, 'panels', NULL, 5), ('page-k3-6', 'book-qisas-k3', 6, 'panels', NULL, 6),
-- k4 audio 4
('page-k4-1', 'book-qisas-k4', 1, 'full_bleed', NULL, 1), ('page-k4-2', 'book-qisas-k4', 2, 'full_bleed', NULL, 2), ('page-k4-3', 'book-qisas-k4', 3, 'full_bleed', NULL, 3), ('page-k4-4', 'book-qisas-k4', 4, 'full_bleed', NULL, 4),
-- k5 4
('page-k5-1', 'book-qisas-k5', 1, 'full_bleed', NULL, 1), ('page-k5-2', 'book-qisas-k5', 2, 'full_bleed', NULL, 2), ('page-k5-3', 'book-qisas-k5', 3, 'full_bleed', NULL, 3), ('page-k5-4', 'book-qisas-k5', 4, 'full_bleed', NULL, 4),
-- k6 audio 4
('page-k6-1', 'book-qisas-k6', 1, 'full_bleed', NULL, 1), ('page-k6-2', 'book-qisas-k6', 2, 'full_bleed', NULL, 2), ('page-k6-3', 'book-qisas-k6', 3, 'full_bleed', NULL, 3), ('page-k6-4', 'book-qisas-k6', 4, 'full_bleed', NULL, 4),
-- k7 interactive 5
('page-k7-1', 'book-qisas-k7', 1, 'full_bleed', NULL, 1), ('page-k7-2', 'book-qisas-k7', 2, 'split', NULL, 2), ('page-k7-3', 'book-qisas-k7', 3, 'full_bleed', NULL, 3), ('page-k7-4', 'book-qisas-k7', 4, 'split', NULL, 4), ('page-k7-5', 'book-qisas-k7', 5, 'full_bleed', NULL, 5),
-- j1 comic 6
('page-j1-1', 'book-qisas-j1', 1, 'panels', NULL, 1), ('page-j1-2', 'book-qisas-j1', 2, 'panels', NULL, 2), ('page-j1-3', 'book-qisas-j1', 3, 'panels', NULL, 3), ('page-j1-4', 'book-qisas-j1', 4, 'panels', NULL, 4), ('page-j1-5', 'book-qisas-j1', 5, 'panels', NULL, 5), ('page-j1-6', 'book-qisas-j1', 6, 'panels', NULL, 6),
-- j2 interactive 6
('page-j2-1', 'book-qisas-j2', 1, 'full_bleed', NULL, 1), ('page-j2-2', 'book-qisas-j2', 2, 'split', NULL, 2), ('page-j2-3', 'book-qisas-j2', 3, 'panels', NULL, 3), ('page-j2-4', 'book-qisas-j2', 4, 'split', NULL, 4), ('page-j2-5', 'book-qisas-j2', 5, 'full_bleed', NULL, 5), ('page-j2-6', 'book-qisas-j2', 6, 'full_bleed', NULL, 6),
-- j3 5
('page-j3-1', 'book-qisas-j3', 1, 'full_bleed', NULL, 1), ('page-j3-2', 'book-qisas-j3', 2, 'full_bleed', NULL, 2), ('page-j3-3', 'book-qisas-j3', 3, 'full_bleed', NULL, 3), ('page-j3-4', 'book-qisas-j3', 4, 'full_bleed', NULL, 4), ('page-j3-5', 'book-qisas-j3', 5, 'full_bleed', NULL, 5),
-- j4 comic 6
('page-j4-1', 'book-qisas-j4', 1, 'panels', NULL, 1), ('page-j4-2', 'book-qisas-j4', 2, 'panels', NULL, 2), ('page-j4-3', 'book-qisas-j4', 3, 'panels', NULL, 3), ('page-j4-4', 'book-qisas-j4', 4, 'panels', NULL, 4), ('page-j4-5', 'book-qisas-j4', 5, 'panels', NULL, 5), ('page-j4-6', 'book-qisas-j4', 6, 'panels', NULL, 6),
-- j5 audio 4
('page-j5-1', 'book-qisas-j5', 1, 'full_bleed', NULL, 1), ('page-j5-2', 'book-qisas-j5', 2, 'full_bleed', NULL, 2), ('page-j5-3', 'book-qisas-j5', 3, 'full_bleed', NULL, 3), ('page-j5-4', 'book-qisas-j5', 4, 'full_bleed', NULL, 4);

-- Localizations: نص قصير لكل صفحة (60/250/500 كلمة مختصرة)
INSERT INTO story_page_localizations (page_id, language, body_text, alt_text) VALUES
('page-p1-1', 'ar', 'كان يا ما كان أرنوب يحب الجزر', 'أرنب صغير في غابة'),
('page-p1-2', 'ar', 'وجد جزرة ذهبية لامعة', 'جزرة ذهبية'),
('page-k1-1', 'ar', 'حكاية الصدق تبدأ بسؤال', 'طفل يفكر'),
('page-j1-1', 'ar', 'كوميكس الأبطال - لوحة 1', 'بطل يقفز');
