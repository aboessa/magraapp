-- Majarra launch content structure
-- Seeds only concepts established by the content plan and generated asset catalog.
-- Final scripts, narration, and internal story pages remain drafts until supplied and reviewed.

PRAGMA foreign_keys = ON;

-- Faith & Manners series represented by the completed poster set. ------------
INSERT OR IGNORE INTO series (
  id, title_ar, title_en, slug, planet_id, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, description_ar,
  visual_style, visual_style_id, difficulty, production_level, status, sort_order
) VALUES
  ('series-faith-preschool-noor', 'نور قلبي', 'Light in My Heart', 'noor-qalbi', 'islamic', 'knowledge', 3, 5, 'pre_reader', 'tap', 'recommended', 'وحدات قرآن صوتية وبصرية بمعنى واحد مناسب للبراعـم، ولا تنشر قبل الاعتماد الشرعي.', 'Soft 2D', 'style-soft-2d', 'easy', 'motion_story', 'draft', 101),
  ('series-faith-preschool-manners', 'أذكاري وآدابي وصلاتي', 'My Adhkar, Manners and Prayer', 'preschool-adhkar-manners-prayer', 'islamic', 'anthology', 3, 5, 'pre_reader', 'tap', 'recommended', 'بطاقات وقصص بصرية قصيرة للأذكار والآداب والتهيؤ للصلاة.', 'Painterly Storybook', 'style-painterly', 'easy', 'motion_story', 'draft', 102),
  ('series-faith-kids-quran', 'كنوز القرآن', 'Quran Treasures', 'quran-treasures', 'islamic', 'knowledge', 6, 8, 'emerging', 'guided', 'recommended', 'معانٍ ميسرة موثقة وأنشطة فهم قصيرة، مع نص رسمي ومراجعة مستقلة.', 'Cinematic Infographic', 'style-infographic', 'medium', 'motion_story', 'draft', 103),
  ('series-faith-kids-prophets', 'قصص الأنبياء للصغار', 'Prophets Stories for Children', 'prophets-stories-kids', 'islamic', 'anthology', 6, 8, 'emerging', 'guided', 'recommended', 'سرد موثق بالمكان والأشياء وآثار الأحداث من دون تجسيد الأنبياء أو الغيب.', 'Painterly Storybook', 'style-painterly', 'medium', 'motion_story', 'draft', 104),
  ('series-faith-kids-prayer', 'صلاتي خطوة بخطوة', 'Prayer Step by Step', 'prayer-step-by-step', 'islamic', 'knowledge', 6, 8, 'emerging', 'guided', 'recommended', 'وحدات بصرية متدرجة لأصول الصلاة المتفق عليها.', 'Soft 2D', 'style-soft-2d', 'easy', 'limited_2d', 'draft', 105),
  ('series-faith-junior-quran', 'في رحاب القرآن', 'Understanding the Quran', 'quran-understanding-junior', 'islamic', 'knowledge', 9, 12, 'independent', 'independent', 'none', 'سياق ومفردات ومعانٍ ميسرة موثقة للقراءة المستقلة.', 'Cinematic Infographic', 'style-infographic', 'medium', 'motion_story', 'draft', 106),
  ('series-faith-junior-seerah', 'رحلة في السيرة', 'Journey through Seerah', 'seerah-journey-junior', 'islamic', 'knowledge', 9, 12, 'independent', 'independent', 'none', 'محطات محققة من السيرة تعرض الأماكن والآثار من دون تجسيد مقدس.', 'Painterly Storybook', 'style-painterly', 'medium', 'motion_story', 'draft', 107),
  ('series-faith-junior-worship', 'عبادتي بعلم', 'Worship with Knowledge', 'worship-with-knowledge', 'islamic', 'knowledge', 9, 12, 'independent', 'independent', 'recommended', 'أصول العبادة المتفق عليها بلغة واضحة ومصدر موثق.', 'Cinematic Infographic', 'style-infographic', 'medium', 'motion_story', 'draft', 108);

INSERT OR IGNORE INTO series_tracks (series_id, track_id) VALUES
  ('series-faith-preschool-noor', 'preschool'),
  ('series-faith-preschool-manners', 'preschool'),
  ('series-faith-kids-quran', 'kids'),
  ('series-faith-kids-prophets', 'kids'),
  ('series-faith-kids-prayer', 'kids'),
  ('series-faith-junior-quran', 'junior'),
  ('series-faith-junior-seerah', 'junior'),
  ('series-faith-junior-worship', 'junior');

INSERT OR IGNORE INTO series_categories (series_id, category_id, is_primary)
SELECT id, 'category-faith', 1 FROM series WHERE planet_id = 'islamic';

-- First production season for every launch series. --------------------------
INSERT OR IGNORE INTO seasons (id, series_id, season_number, title_ar, theme_ar, episode_count, watch_order, status) VALUES
  ('season-preschool-luna-words-01', 'series-preschool-luna-words', 1, 'الكلمات الأولى', 'الاستماع والمفردات', 6, 'any', 'draft'),
  ('season-preschool-colors-01', 'series-preschool-colors', 1, 'ألوان حولنا', 'الألوان والتصنيف', 5, 'any', 'draft'),
  ('season-preschool-count-01', 'series-preschool-count', 1, 'نعد معًا', 'الكميات 1–5', 5, 'any', 'draft'),
  ('season-preschool-calm-01', 'series-preschool-calm-tale', 1, 'حكايات صغيرة هادئة', 'الطمأنينة قبل النوم', 4, 'any', 'draft'),
  ('season-kids-wisdom-01', 'series-kids-wisdom', 1, 'الصدق والتعاون', 'قيم قابلة للتطبيق', 8, 'any', 'draft'),
  ('season-kids-numbers-01', 'series-kids-numbers', 1, 'رحلة الأرقام', 'العد والأنماط والأشكال', 8, 'sequential', 'draft'),
  ('season-kids-body-01', 'series-kids-body', 1, 'جسمي المدهش', 'الأعضاء والحواس', 6, 'any', 'draft'),
  ('season-kids-bedtime-01', 'series-kids-bedtime', 1, 'حكايات قبل النوم', 'حكايات مطمئنة', 8, 'any', 'draft'),
  ('season-kids-home-01', 'series-kids-home', 1, 'تجارب آمنة', 'الملاحظة والتجربة', 4, 'any', 'draft'),
  ('season-kids-explorers-01', 'series-kids-explorers', 1, 'دلائل ومغامرات', 'حل المشكلات والعمل الجماعي', 6, 'sequential', 'draft'),
  ('season-junior-future-01', 'series-junior-future-lab', 1, 'نبني المستقبل', 'الفرضيات والتصميم', 6, 'sequential', 'draft'),
  ('season-junior-code-01', 'series-junior-robo-codes', 1, 'منطق وتسلسل', 'البرمجة المرئية', 6, 'sequential', 'draft'),
  ('season-junior-civilizations-01', 'series-junior-civilizations', 1, 'ابتكارات الحضارات', 'التاريخ والابتكار', 5, 'any', 'draft'),
  ('season-junior-minute-01', 'series-junior-science-minute', 1, 'ظواهر في دقيقة', 'تفسير الظواهر اليومية', 6, 'any', 'draft'),
  ('season-faith-preschool-noor-01', 'series-faith-preschool-noor', 1, 'نور قلبي', 'معنى واحد وفعل واحد', 4, 'any', 'review_sharia'),
  ('season-faith-preschool-manners-01', 'series-faith-preschool-manners', 1, 'آدابي الأولى', 'ذكر وأدب وصلاة', 12, 'any', 'review_sharia'),
  ('season-faith-kids-quran-01', 'series-faith-kids-quran', 1, 'كنوز القرآن', 'فهم وتطبيق', 6, 'any', 'review_sharia'),
  ('season-faith-kids-prophets-01', 'series-faith-kids-prophets', 1, 'قصص موثقة', 'عبرة وسلوك', 4, 'any', 'review_sharia'),
  ('season-faith-kids-prayer-01', 'series-faith-kids-prayer', 1, 'صلاتي', 'خطوات متدرجة', 4, 'sequential', 'review_sharia'),
  ('season-faith-junior-quran-01', 'series-faith-junior-quran', 1, 'في رحاب القرآن', 'سياق ومفردات', 6, 'any', 'review_sharia'),
  ('season-faith-junior-seerah-01', 'series-faith-junior-seerah', 1, 'رحلة في السيرة', 'محطات محققة', 5, 'sequential', 'review_sharia'),
  ('season-faith-junior-worship-01', 'series-faith-junior-worship', 1, 'عبادتي بعلم', 'أصول متفق عليها', 5, 'sequential', 'review_sharia');

-- Episodes represented in the image catalog, including the 7 images still planned. --
INSERT OR IGNORE INTO episodes (
  id, series_id, season_id, episode_number, title_ar, description_ar,
  age_min, age_max, reading_level, interaction_mode, supervision_level,
  difficulty, status, is_free, is_published
) VALUES
  ('episode-preschool-words-01-picture-to-object', 'series-preschool-luna-words', 'season-preschool-luna-words-01', 1, 'الصورة والشيء', 'مطابقة صورة واضحة بالشيء الذي تمثله.', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 'draft', 1, 0),
  ('episode-preschool-words-02-listen-and-find', 'series-preschool-luna-words', 'season-preschool-luna-words-01', 2, 'استمع وابحث', 'الاستماع إلى كلمة ثم اختيار الشيء الصحيح.', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 'draft', 0, 0),
  ('episode-preschool-colors-01-find-yellow', 'series-preschool-colors', 'season-preschool-colors-01', 1, 'ابحث عن الأصفر', 'اكتشاف اللون الأصفر في مشهد بسيط.', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 'draft', 1, 0),
  ('episode-preschool-colors-02-sort-two-colors', 'series-preschool-colors', 'season-preschool-colors-01', 2, 'صنّف لونين', 'تصنيف عناصر إلى مجموعتين لونيتين.', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 'draft', 0, 0),
  ('episode-preschool-count-01-one-for-each', 'series-preschool-count', 'season-preschool-count-01', 1, 'واحد لكل واحد', 'ربط كل عنصر بمكان واحد.', 3, 5, 'pre_reader', 'tap', 'recommended', 'easy', 'draft', 1, 0),
  ('episode-preschool-count-02-three-friends', 'series-preschool-count', 'season-preschool-count-01', 2, 'ثلاثة أصدقاء', 'عد ثلاثة عناصر بصريًا وصوتيًا.', 3, 5, 'pre_reader', 'tap', 'recommended', 'easy', 'draft', 0, 0),
  ('episode-preschool-calm-01-bird-home', 'series-preschool-calm-tale', 'season-preschool-calm-01', 1, 'بيت الطائر', 'حكاية قصيرة هادئة عن العودة إلى البيت.', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 'draft', 1, 0),
  ('episode-preschool-calm-02-goodnight-toys', 'series-preschool-calm-tale', 'season-preschool-calm-01', 2, 'تصبح على خير يا ألعابي', 'روتين هادئ لترتيب الألعاب والاستعداد للنوم.', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 'draft', 0, 0),

  ('episode-hekaya-01-lost-bag', 'series-kids-wisdom', 'season-kids-wisdom-01', 1, 'الحقيبة المفقودة', 'اختيار التصرف الأمين عند العثور على حقيبة.', 6, 8, 'emerging', 'guided', 'recommended', 'easy', 'draft', 1, 0),
  ('episode-hekaya-02-sharing-colors', 'series-kids-wisdom', 'season-kids-wisdom-01', 2, 'مشاركة الألوان', 'موقف قصصي عن المشاركة والتعاون.', 6, 8, 'emerging', 'guided', 'recommended', 'easy', 'draft', 0, 0),
  ('episode-hekaya-03-waiting-turn', 'series-kids-wisdom', 'season-kids-wisdom-01', 3, 'انتظار الدور', 'التدرب على الصبر واحترام الآخرين.', 6, 8, 'emerging', 'guided', 'recommended', 'easy', 'draft', 0, 0),
  ('episode-hekaya-04-plant-responsibility', 'series-kids-wisdom', 'season-kids-wisdom-01', 4, 'مسؤولية النبتة', 'تحمل مسؤولية رعاية كائن حي.', 6, 8, 'emerging', 'guided', 'recommended', 'easy', 'draft', 0, 0),
  ('episode-numbers-01-counting-stars', 'series-kids-numbers', 'season-kids-numbers-01', 1, 'عدّ النجوم', 'تقدير الكمية ثم العد للتحقق.', 6, 8, 'emerging', 'guided', 'recommended', 'easy', 'draft', 1, 0),
  ('episode-numbers-02-more-or-less', 'series-kids-numbers', 'season-kids-numbers-01', 2, 'أكثر أم أقل؟', 'مقارنة مجموعتين بصريًا.', 6, 8, 'emerging', 'guided', 'recommended', 'easy', 'draft', 0, 0),
  ('episode-numbers-03-shape-bridge', 'series-kids-numbers', 'season-kids-numbers-01', 3, 'جسر الأشكال', 'اختيار الشكل المناسب لإكمال الجسر.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 0, 0),
  ('episode-numbers-04-combining-groups', 'series-kids-numbers', 'season-kids-numbers-01', 4, 'نجمع المجموعات', 'مقدمة بصرية للجمع البسيط.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 0, 0),
  ('episode-body-01-heart', 'series-kids-body', 'season-kids-body-01', 1, 'القلب', 'شرح علمي آمن ومبسط لوظيفة القلب.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 1, 0),
  ('episode-body-02-five-senses', 'series-kids-body', 'season-kids-body-01', 2, 'الحواس الخمس', 'اكتشاف الحواس ووظيفة كل منها.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 0, 0),
  ('episode-body-03-breathing', 'series-kids-body', 'season-kids-body-01', 3, 'كيف نتنفس؟', 'مقدمة آمنة ومبسطة لعملية التنفس.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 0, 0),
  ('episode-home-01-walking-water', 'series-kids-home', 'season-kids-home-01', 1, 'الماء الذي يمشي', 'تجربة منزلية بإشراف ولي الأمر.', 6, 8, 'emerging', 'mixed', 'required', 'medium', 'draft', 0, 0),
  ('episode-home-02-magnet-test', 'series-kids-home', 'season-kids-home-01', 2, 'اختبار المغناطيس', 'توقع المواد التي يجذبها المغناطيس ثم اختبارها.', 6, 8, 'emerging', 'mixed', 'required', 'medium', 'draft', 0, 0),
  ('episode-home-03-float-or-sink', 'series-kids-home', 'season-kids-home-01', 3, 'يطفو أم يغوص؟', 'فرضية وملاحظة آمنة بمشاركة ولي الأمر.', 6, 8, 'emerging', 'mixed', 'required', 'medium', 'draft', 0, 0),
  ('episode-home-04-growing-seed', 'series-kids-home', 'season-kids-home-01', 4, 'بذرة تنمو', 'متابعة نمو بذرة وتوثيق الملاحظة.', 6, 8, 'emerging', 'mixed', 'required', 'medium', 'draft', 0, 0),
  ('episode-kids-explorers-01-picture-clues', 'series-kids-explorers', 'season-kids-explorers-01', 1, 'دلائل الصور', 'تجمع زينة وياسين دلائل بصرية لحل المشكلة.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 1, 0),
  ('episode-kids-explorers-02-teamwork-bridge', 'series-kids-explorers', 'season-kids-explorers-01', 2, 'جسر العمل الجماعي', 'حل تحدٍ بالتعاون وتقسيم المهام.', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 'draft', 0, 0),

  ('episode-junior-future-01-solar-rover', 'series-junior-future-lab', 'season-junior-future-01', 1, 'المركبة الشمسية', 'تصميم مركبة مبسطة تعمل بالطاقة الشمسية.', 9, 12, 'independent', 'independent', 'recommended', 'hard', 'draft', 1, 0),
  ('episode-junior-future-02-strong-bridge', 'series-junior-future-lab', 'season-junior-future-01', 2, 'الجسر القوي', 'اختبار أشكال إنشائية ومقارنة النتائج.', 9, 12, 'independent', 'independent', 'recommended', 'hard', 'draft', 0, 0),
  ('episode-junior-code-01-sequence-path', 'series-junior-robo-codes', 'season-junior-code-01', 1, 'مسار التسلسل', 'ترتيب أوامر للوصول إلى الهدف.', 9, 12, 'independent', 'independent', 'none', 'hard', 'draft', 1, 0),
  ('episode-junior-code-02-debug-the-route', 'series-junior-robo-codes', 'season-junior-code-01', 2, 'صحح المسار', 'اكتشاف الخطأ المنطقي وإصلاحه.', 9, 12, 'independent', 'independent', 'none', 'hard', 'draft', 0, 0),
  ('episode-junior-civilizations-01-water-engineering', 'series-junior-civilizations', 'season-junior-civilizations-01', 1, 'هندسة المياه', 'ابتكارات تاريخية لإدارة المياه من مصادر منتقاة.', 9, 12, 'independent', 'independent', 'none', 'medium', 'draft', 1, 0),
  ('episode-junior-civilizations-02-observatory', 'series-junior-civilizations', 'season-junior-civilizations-01', 2, 'المرصد', 'كيف ساعدت المراصد على فهم السماء والوقت.', 9, 12, 'independent', 'independent', 'none', 'medium', 'draft', 0, 0),
  ('episode-junior-minute-01-light-refraction', 'series-junior-science-minute', 'season-junior-minute-01', 1, 'انكسار الضوء', 'تفسير بصري مركز لظاهرة انكسار الضوء.', 9, 12, 'independent', 'independent', 'none', 'medium', 'draft', 1, 0),
  ('episode-junior-minute-02-air-pressure', 'series-junior-science-minute', 'season-junior-minute-01', 2, 'ضغط الهواء', 'مفهوم ضغط الهواء بمثال يومي آمن.', 9, 12, 'independent', 'independent', 'none', 'medium', 'draft', 0, 0);

INSERT OR IGNORE INTO episode_tracks (episode_id, track_id)
SELECT id, CASE WHEN age_max <= 5 THEN 'preschool' WHEN age_max <= 8 THEN 'kids' ELSE 'junior' END
FROM episodes;

-- Recurring characters with approved catalog reference sheets. -------------
INSERT OR IGNORE INTO characters (id, series_id, name_ar, role, age, description_ar, traits, speech_style, languages, status) VALUES
  ('character-luna', 'series-preschool-luna-words', 'لونا', 'hero', 4, 'بطلة فضولية تكتشف الكلمات بالصوت والصورة.', '["فضولية","مشجعة","هادئة"]', 'عبارات قصيرة وواضحة', '["ar"]', 'active'),
  ('character-nouma', 'series-kids-numbers', 'نوما', 'hero', 7, 'بطلة تحب العد والأنماط وحل المشكلات.', '["فضولية","منطقية","متعاونة"]', 'أسئلة موجهة وتشجيع', '["ar"]', 'active'),
  ('character-addaad', 'series-kids-numbers', 'عدّاد', 'side', NULL, 'روبوت صغير يخطئ ويتعلم مع الطفل.', '["ودود","مرح","يتعلم من الخطأ"]', 'جمل قصيرة وإشارات رقمية', '["ar"]', 'active'),
  ('character-salma', 'series-kids-home', 'سلمى', 'presenter', 28, 'مقدمة علوم تشرح التجارب وتؤكد تعليمات السلامة.', '["موثوقة","هادئة","دقيقة"]', 'شرح بسيط وسؤال قبل التجربة', '["ar"]', 'active'),
  ('character-zaina', 'series-kids-explorers', 'زينة', 'hero', 8, 'مستكشفة تجمع الدلائل وتطرح الأسئلة.', '["ملاحظة","شجاعة","متعاونة"]', 'تفكير بصوت مسموع', '["ar"]', 'active'),
  ('character-yasin', 'series-kids-explorers', 'ياسين', 'hero', 8, 'مستكشف يحب البناء وتجربة الحلول.', '["عملي","متعاون","صبور"]', 'اقتراحات قصيرة', '["ar"]', 'active'),
  ('character-robo', 'series-junior-robo-codes', 'روبو', 'hero', NULL, 'مرشد برمجي يقود تحديات المنطق والتسلسل.', '["منطقي","مشجع","دقيق"]', 'تعليمات متدرجة بلا إعطاء الحل', '["ar"]', 'active');

-- Bedtime covers represent story-level drafts; no internal page text is invented. --
INSERT OR IGNORE INTO stories (
  id, series_id, season_id, slug, title_ar, title_en, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, visual_style_id,
  default_language, languages, status, is_free, price_tier, sort_order
) VALUES
  ('story-bedtime-01-little-moon', 'series-kids-bedtime', 'season-kids-bedtime-01', 'little-moon', 'القمر الصغير', 'The Little Moon', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 1, 'free', 1),
  ('story-bedtime-02-garden-keeper', 'series-kids-bedtime', 'season-kids-bedtime-01', 'garden-keeper', 'حارس الحديقة', 'The Garden Keeper', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 2),
  ('story-bedtime-03-turtle-home', 'series-kids-bedtime', 'season-kids-bedtime-01', 'turtle-home', 'بيت السلحفاة', 'The Turtle Home', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 3),
  ('story-bedtime-04-star-over-palm', 'series-kids-bedtime', 'season-kids-bedtime-01', 'star-over-palm', 'نجمة فوق النخلة', 'A Star over the Palm', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 4),
  ('story-bedtime-05-bird-finds-nest', 'series-kids-bedtime', 'season-kids-bedtime-01', 'bird-finds-nest', 'الطائر يجد عشه', 'The Bird Finds Its Nest', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 5),
  ('story-bedtime-06-paper-boat', 'series-kids-bedtime', 'season-kids-bedtime-01', 'paper-boat', 'القارب الورقي', 'The Paper Boat', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 6),
  ('story-bedtime-07-patient-cloud', 'series-kids-bedtime', 'season-kids-bedtime-01', 'patient-cloud', 'السحابة الصبورة', 'The Patient Cloud', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 7),
  ('story-bedtime-08-library-key', 'series-kids-bedtime', 'season-kids-bedtime-01', 'library-key', 'مفتاح المكتبة', 'The Library Key', 'audio_story', 6, 8, 'emerging', 'guided', 'none', 'style-painterly', 'ar', '["ar","en"]', 'writing', 0, 'family', 8);

-- Books and audio/visual reading units represented by cover art. ------------
INSERT OR IGNORE INTO books (id, series_id, title_ar, type, age_min, age_max, reading_level, interaction_mode, supervision_level, is_free) VALUES
  ('book-arabic-letters', 'series-preschool-luna-words', 'حروفي العربية', 'picture_book', 3, 5, 'pre_reader', 'tap', 'none', 1),
  ('book-counting', 'series-kids-numbers', 'كتاب العد', 'interactive', 6, 8, 'emerging', 'guided', 'recommended', 0),
  ('book-human-body', 'series-kids-body', 'جسمي المدهش', 'picture_book', 6, 8, 'emerging', 'guided', 'recommended', 0),
  ('book-kindness', 'series-kids-wisdom', 'مواقف من اللطف', 'picture_book', 6, 8, 'emerging', 'guided', 'recommended', 1),
  ('book-nature', 'series-kids-explorers', 'نلاحظ الطبيعة', 'picture_book', 6, 8, 'emerging', 'guided', 'recommended', 0),
  ('book-junior-coding-logic', 'series-junior-robo-codes', 'منطق البرمجة', 'interactive', 9, 12, 'independent', 'independent', 'none', 0),
  ('book-junior-everyday-forces', 'series-junior-science-minute', 'القوى من حولنا', 'picture_book', 9, 12, 'independent', 'independent', 'none', 0),
  ('book-junior-solar-rover', 'series-junior-future-lab', 'دليل المركبة الشمسية', 'interactive', 9, 12, 'independent', 'independent', 'recommended', 0),
  ('book-junior-civilization-innovations', 'series-junior-civilizations', 'ابتكارات الحضارات', 'picture_book', 9, 12, 'independent', 'independent', 'none', 0),
  ('book-preschool-count-pictures', 'series-preschool-count', 'نعد بالصور', 'picture_book', 3, 5, 'pre_reader', 'tap', 'none', 1),
  ('book-preschool-first-words', 'series-preschool-luna-words', 'كلماتي الأولى', 'audio_story', 3, 5, 'pre_reader', 'tap', 'none', 1),
  ('book-preschool-little-bird', 'series-preschool-calm-tale', 'الطائر الصغير ينام', 'audio_story', 3, 5, 'pre_reader', 'tap', 'none', 0),
  ('book-preschool-colors', 'series-preschool-colors', 'ألواني', 'interactive', 3, 5, 'pre_reader', 'tap', 'none', 1);

-- Reusable game engines and catalog games. ----------------------------------
INSERT OR IGNORE INTO game_engines (id, name_ar, description, mechanics) VALUES
  ('engine-match', 'المطابقة', 'محرك مطابقة صور وعناصر.', '{"mechanics":["tap","drag_match"]}'),
  ('engine-sequence', 'الترتيب', 'محرك ترتيب خطوات أو أحداث.', '{"mechanics":["drag_order","tap_order"]}'),
  ('engine-memory', 'الذاكرة', 'محرك بطاقات ذاكرة محدود.', '{"mechanics":["flip_pairs"]}'),
  ('engine-maze', 'المسار والمنطق', 'محرك مسارات وتسلسل أوامر.', '{"mechanics":["path","sequence"]}'),
  ('engine-builder', 'البناء والتجربة', 'محرك تركيب واختبار نتيجة.', '{"mechanics":["assemble","test"]}');

INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, age_min, age_max, reading_level, interaction_mode, supervision_level, difficulty, is_free) VALUES
  ('game-letter-tracing', 'engine-match', 'series-preschool-luna-words', 'تتبع الحروف', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 1),
  ('game-number-maze', 'engine-maze', 'series-kids-numbers', 'متاهة الأرقام', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 0),
  ('game-shape-matching', 'engine-match', 'series-kids-numbers', 'مطابقة الأشكال', 6, 8, 'emerging', 'guided', 'none', 'easy', 1),
  ('game-animal-memory', 'engine-memory', 'series-kids-explorers', 'ذاكرة الحيوانات', 6, 8, 'emerging', 'guided', 'none', 'easy', 0),
  ('game-butterfly-sequence', 'engine-sequence', 'series-kids-body', 'دورة الفراشة', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 0),
  ('game-junior-circuit-builder', 'engine-builder', 'series-junior-future-lab', 'ابن الدائرة', 9, 12, 'independent', 'independent', 'recommended', 'hard', 0),
  ('game-junior-civilizations-timeline', 'engine-sequence', 'series-junior-civilizations', 'خط الحضارات', 9, 12, 'independent', 'independent', 'none', 'medium', 0),
  ('game-junior-code-sequence', 'engine-maze', 'series-junior-robo-codes', 'تسلسل الأوامر', 9, 12, 'independent', 'independent', 'none', 'hard', 1),
  ('game-junior-science-evidence', 'engine-match', 'series-junior-science-minute', 'دليل علمي', 9, 12, 'independent', 'independent', 'none', 'medium', 0),
  ('game-kids-explorers-clue-trail', 'engine-maze', 'series-kids-explorers', 'مسار الدلائل', 6, 8, 'emerging', 'guided', 'recommended', 'medium', 0),
  ('game-preschool-color-sort', 'engine-match', 'series-preschool-colors', 'صنف الألوان', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 1),
  ('game-preschool-count-place', 'engine-match', 'series-preschool-count', 'عد وضع', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 1),
  ('game-preschool-listen-find', 'engine-match', 'series-preschool-luna-words', 'استمع وابحث', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 1),
  ('game-preschool-picture-match', 'engine-match', 'series-preschool-luna-words', 'طابق الصورة', 3, 5, 'pre_reader', 'tap', 'none', 'easy', 1);

-- Junior projects and family activities represented by covers. -------------
INSERT OR IGNORE INTO projects (id, title_ar, description_ar, age_min, age_max, supervision_level, materials, steps, is_free) VALUES
  ('project-junior-branching-story', 'قصة متفرعة', 'مشروع كتابة منطقية بخيارات ومسارات متعددة.', 9, 12, 'none', '[]', '[]', 0),
  ('project-junior-family-timeline', 'خط زمني للعائلة', 'مشروع بحث مغلق ومشاركة أسرية يحترم الخصوصية.', 9, 12, 'recommended', '[]', '[]', 0),
  ('project-junior-paper-bridge', 'جسر ورقي', 'تصميم واختبار جسر باستخدام الورق بإشراف مناسب.', 9, 12, 'recommended', '[]', '[]', 1),
  ('project-junior-solar-oven', 'فرن شمسي', 'تجربة طاقة شمسية تتطلب إشراف ولي الأمر وتعليمات سلامة.', 9, 12, 'required', '[]', '[]', 0),
  ('activity-family-kindness', 'نشاط اللطف العائلي', 'نشاط أسري قصير لتطبيق اللطف.', 6, 8, 'recommended', '[]', '[]', 1),
  ('activity-nature-observation', 'ملاحظة الطبيعة', 'بطاقة ملاحظة آمنة في حديقة أو من نافذة المنزل.', 6, 8, 'recommended', '[]', '[]', 0),
  ('activity-safe-experiment', 'تجربة آمنة', 'نشاط علمي منزلي مع إشراف واضح.', 6, 8, 'required', '[]', '[]', 0);

-- Explicit pending religious reviews: no approval is implied by the seed. ----
INSERT OR IGNORE INTO content_reviews (id, entity_type, entity_id, reviewer_role, status, comments)
SELECT 'review-sharia-' || id, 'series', id, 'sharia', 'pending', 'يلزم مصدر موثق واعتماد شرعي قبل الجاهزية أو النشر.'
FROM series WHERE planet_id = 'islamic';
