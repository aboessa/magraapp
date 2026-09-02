-- API-105: إسقاط تقدّم حقيقي، وإسقاط جدولين بلا كاتب.
--
-- ## ما كان
--
-- `watch_progress` و`child_screen_time_daily` و`children_profiles` كلها **صفر
-- صفًّا**، ولا `INSERT` لأيّها في المصدر كلّه. سلطة الحقيقة انتقلت إلى الكائن
-- الدائم، والإسقاط لم يُكتب قطّ. فبقيت شاشات تقرأ جداول لا يكتبها شيء — وهي
-- تعرض «صفر» الذي يُقرأ «لا نشاط» بينما معناه «لا بيانات».
--
-- ## لماذا جدول جديد لا إحياء `watch_progress`
--
-- `watch_progress` جدولٌ من عصر ما قبل الكائن الدائم، وشكله يخالف ما يُنتجه:
--
--   * مفتاحه `(child_id, episode_id)` — والكائن يسجّل `(child_id, content_type,
--     content_id)`. فالكتب والقصص والألعاب لا موضع لها فيه، وقد صار نصف المحتوى.
--   * وحدته ثوانٍ — والكائن يسجّل مللي ثانية. والتحويل عند الكتابة يُفقد الدقّة
--     التي يحتاجها استكمال المشاهدة من موضعها.
--   * فيه مفتاحان أجنبيان إلى `children_profiles(id)` و`episodes(id)`، والأوّل
--     جدولٌ بلا كاتب أيضًا. أي أن إحياءه يحتاج إحياء سلسلة كاملة.
--
-- و`child_progress_projection` يتبع نمط `0008` المُعلَن: بلا مفاتيح أجنبية، بأعمدة
-- تقبل الفراغ، وبعلامة زمنية `*_at_ms` تحمي من إعادة ترتيب الطابور.
--
-- ## و`child_screen_time_daily` يُسقَط بلا بديل
--
-- **صفر قارئ في المصدر كلّه.** وقت الشاشة يُحتسَب داخل الكائن الدائم
-- (`screen_time_daily`) لأن الحدّ اليومي قراءة-تعديل-كتابة تحتاج تسلسلًا لكل
-- أسرة، ولا حدث في الـoutbox يُصدره. فالجدول كان وعدًا بتقرير لم يُطلَب بعد.
-- وحين يُطلب، يُنشأ بنمط الإسقاط لا بشكل 2019.
--
-- `children_profiles` **لا يُسقَط في هذه الدفعة**: مفاتيح أجنبية من `attempts`
-- و`favorites` و`parental_consents` و`data_requests` تشير إليه، وإسقاطه سلسلة
-- قرارات مستقلّة. المُنفَّذ هنا أن **لا قارئ يبقى له** — وهو ما يجعل إسقاطه لاحقًا
-- تنظيفًا لا تغييرًا في السلوك.

-- تقدّم الطفل كما يُسقطه الطابور من الكائن الدائم.
--
-- المفتاح ثلاثي مثل مصدره: نوع المحتوى جزء من الهوية لا صفة. وحلقةٌ ولعبةٌ
-- بنفس المعرّف — وهو ممكن — صفّان لا صفّ واحد يطمس أحدهما الآخر.
CREATE TABLE IF NOT EXISTS child_progress_projection (
  child_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  position_ms INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  /* عدد مرّات الإكمال. يزيد عند كل حدث `content.completed` جديد، فيبقى
     «شاهدها ثلاث مرّات» قابلًا للقول — وهو ما كان `watch_count` يعنيه. */
  completions INTEGER NOT NULL DEFAULT 0,
  first_seen_at_ms INTEGER,
  completed_at_ms INTEGER,
  /* علامة الترتيب. الطابور لا يضمن الترتيب، وحدثٌ قديم يصل متأخّرًا لا يجوز أن
     يُرجِع الموضع إلى الوراء. */
  last_event_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (child_id, content_type, content_id)
);

-- «ما يُكمِله الطفل الآن» و«تابع المشاهدة»: كلاهما استعلام بالطفل وبالأحدث.
CREATE INDEX IF NOT EXISTS idx_child_progress_recent
  ON child_progress_projection(child_id, last_event_at_ms DESC);

-- «الأكثر مشاهدة»: عدٌّ بالمحتوى عبر الأسر.
CREATE INDEX IF NOT EXISTS idx_child_progress_content
  ON child_progress_projection(content_type, content_id, completed);

DROP TABLE IF EXISTS watch_progress;
DROP TABLE IF EXISTS child_screen_time_daily;
