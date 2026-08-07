-- Slate كوكب القصص: 16 قصة placeholder (5 preschool + 7 kids + 5 junior) - إجمالي 17 مع bedtime-stories الموجودة
-- كل قصة 60/250/500 كلمة حسب المسار، مع visual_style_id و track_ids

-- نحتاج visual_style افتراضي إن لم يكن موجود
INSERT OR IGNORE INTO visual_styles (id, slug, name_ar, name_en, medium, prompt_fragment, production_level, age_tracks, is_active)
VALUES ('style-qisas-default', 'qisas-default', 'أسلوب القصص الدافئ', 'Warm Stories', '2d', 'warm soft colors, gentle lighting, child-friendly', 'motion_story', '["preschool","kids","junior"]', 1);

-- Preschool 4 جديدة (كان 1 موجودة bedtime-stories)
INSERT INTO books (id, title_ar, type, pages, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, visual_style_id, is_free, status, languages, default_language) VALUES
('book-qisas-p1', 'أرنوب والجزرة الذهبية', 'picture_book', '[]', 3, 5, 'pre_reader', 'tap', 'recommended', 'قصة هادئة', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-p2', 'نجمة تنام', 'picture_book', '[]', 3, 5, 'pre_reader', 'tap', 'none', 'قصة قبل النوم', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-p3', 'صوت الغابة', 'audio_story', '[]', 4, 5, 'pre_reader', 'tap', 'recommended', 'صوت هادئ', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-p4', 'ألوان السماء', 'picture_book', '[]', 3, 5, 'pre_reader', 'tap', 'none', 'ألوان', 'style-qisas-default', 1, 'draft', '["ar","en"]', 'ar');

-- Kids 6 جديدة (كان 1 موجودة bedtime-stories تحسب kids أيضاً لكن نضيف 6)
INSERT INTO books (id, title_ar, type, pages, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, visual_style_id, is_free, status, languages, default_language) VALUES
('book-qisas-k1', 'حكاية الصدق', 'picture_book', '[]', 6, 8, 'emerging', 'guided', 'recommended', 'قيمة الصدق', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-k2', 'مغامرة التعاون', 'interactive', '[]', 6, 8, 'emerging', 'mixed', 'recommended', 'اختيارات', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-k3', 'كوميكس الفضاء', 'comic', '[]', 7, 8, 'emerging', 'guided', 'none', 'كوميكس', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-k4', 'أنشودة الحروف', 'audio_story', '[]', 6, 7, 'emerging', 'tap', 'none', 'صوت', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-k5', 'لغز الغابة', 'picture_book', '[]', 6, 8, 'emerging', 'guided', 'recommended', 'لغز', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar'),
('book-qisas-k6', 'أصدقاء البحر', 'audio_story', '[]', 6, 8, 'emerging', 'tap', 'none', 'صوت', 'style-qisas-default', 1, 'draft', '["ar","en"]', 'ar'),
('book-qisas-k7', 'حكاية الشجاعة', 'interactive', '[]', 6, 8, 'emerging', 'mixed', 'recommended', 'شجاعة', 'style-qisas-default', 1, 'draft', '["ar"]', 'ar');

-- Junior 5 جديدة
INSERT INTO books (id, title_ar, type, pages, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, visual_style_id, is_free, status, languages, default_language) VALUES
('book-qisas-j1', 'كوميكس الأبطال', 'comic', '[]', 9, 12, 'independent', 'mixed', 'none', 'أبطال', 'style-qisas-default', 0, 'draft', '["ar"]', 'ar'),
('book-qisas-j2', 'لغز الحضارة', 'interactive', '[]', 9, 11, 'independent', 'mixed', 'none', 'حضارة', 'style-qisas-default', 0, 'draft', '["ar"]', 'ar'),
('book-qisas-j3', 'حكاية المخترع', 'picture_book', '[]', 9, 12, 'independent', 'guided', 'none', 'اختراع', 'style-qisas-default', 0, 'draft', '["ar"]', 'ar'),
('book-qisas-j4', 'كوميكس المستقبل', 'comic', '[]', 10, 12, 'independent', 'guided', 'none', 'مستقبل', 'style-qisas-default', 0, 'draft', '["ar"]', 'ar'),
('book-qisas-j5', 'قصة الصوت والصدى', 'audio_story', '[]', 9, 10, 'independent', 'tap', 'none', 'صوت', 'style-qisas-default', 0, 'draft', '["ar"]', 'ar');
