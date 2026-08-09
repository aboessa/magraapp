-- 0018 — separate test fixtures from production content, and make activities attachable.
--
-- Three problems this fixes, all found by the catalogue audit.
--
-- 1. There is no way to tell platform test material apart from real Majarra content.
--    The Mazen & Thaaloub series and its 14 videos were supplied only as external test
--    material for the upload / R2 / asset-link / streaming / playback path. It is not a
--    Majarra original and must not be counted in production content targets, reported as
--    Majarra Original, or shipped in a public release. Relying on the slug to spot it
--    would be a naming convention, not a mechanism, so this adds an explicit column.
--
--    `content_class` sits on `series` because series is the parent of episodes, stories,
--    books, games and characters — one flag reaches all of them through a join, and there
--    is no second place to keep in sync.
--
-- 2. `projects` could not be attached to anything. It had no series_id, no episode_id and
--    no planet_id, so an activity authored for a specific episode had nowhere to record
--    that. Activities could never be surfaced in context.
--
-- 3. The `skills` vocabulary had eight rows and none covered fine motor control, self
--    regulation or craft transmission, so authored objectives in those areas had to carry
--    a NULL skill. Computational-thinking objectives were all being forced onto `coding`,
--    which reads as a contradiction in a parent report for a series that is explicitly
--    not programming.

-- 1. production vs test content -------------------------------------------------------
ALTER TABLE series ADD COLUMN content_class TEXT NOT NULL DEFAULT 'production'
  CHECK (content_class IN ('production', 'test_fixture'));

CREATE INDEX IF NOT EXISTS idx_series_content_class ON series(content_class);
CREATE INDEX IF NOT EXISTS idx_series_class_status ON series(content_class, status);

-- 2. activities can be attached to the content they belong to --------------------------
ALTER TABLE projects ADD COLUMN series_id TEXT REFERENCES series(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN episode_id TEXT REFERENCES episodes(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);

CREATE INDEX IF NOT EXISTS idx_projects_series ON projects(series_id);
CREATE INDEX IF NOT EXISTS idx_projects_episode ON projects(episode_id);

-- 3. skills the authored curriculum actually needs --------------------------------------
INSERT OR IGNORE INTO skills (id, name_ar, category, description) VALUES
  ('computational_thinking', 'التفكير الحاسوبي', 'cognitive', 'تفكيك المهمة إلى خطوات مرتّبة، وتتبّعها، وإيجاد الخطأ فيها — بلا رموز برمجية.'),
  ('fine_motor', 'المهارة الحركية الدقيقة', 'motor', 'ضبط الأصابع واليد لأداء عمل يحتاج دقّة وقوّة مناسبة.'),
  ('self_regulation', 'تنظيم الذات', 'social', 'الانتظار، والعودة إلى الترتيب، وإتمام ما بُدئ به.'),
  ('craft', 'الصنعة والحرفة', 'cognitive', 'إدراك أن المهارة معرفة تُنقَل من شخص إلى شخص، وأن الأثر يدلّ على صاحبه.'),
  ('measurement', 'القياس', 'numeracy', 'اختيار الوحدة المناسبة وتقدير المعقول قبل الحساب.'),
  ('data_reading', 'قراءة البيانات', 'numeracy', 'استخراج قيمة من جدول أو رسم بياني والإجابة بها.'),
  ('empathy', 'التعاطف', 'social', 'إعادة صياغة موقف الآخر من وجهة نظره.'),
  ('map_reading', 'قراءة الخريطة', 'cognitive', 'استخدام المقياس والاتجاه لوصف مسار أو موقع.');

-- 4. mark the supplied test material ----------------------------------------------------
UPDATE series SET content_class = 'test_fixture', updated_at = datetime('now')
  WHERE slug = 'mazen-wa-thaaloub';
