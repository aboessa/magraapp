-- DB-105: إسقاط مفاتيح أجنبية إلى `children_profiles` — جدولٌ صفر صفًّا يُسقِط الطلبات.
--
-- ## العطل كما ظهر
--
-- `GET /api/v1/child-settings/:childId` يُرجع **500** لكل طفل في كل أسرة. والمسار
-- سليم منطقًا: يتحقّق من الملكية في `child_projection`، فلا يجد صفًّا في
-- `child_settings`، فيُنشئه بشكل بطيء:
--
--     INSERT INTO child_settings (child_id) VALUES (?)
--
-- وهذا الإدراج **يفشل دائمًا**. لأن العمود مُعرَّف:
--
--     child_id TEXT PRIMARY KEY REFERENCES children_profiles(id) ON DELETE CASCADE
--
-- و`children_profiles` فيه **صفر صفًّا** ولا `INSERT` له في المصدر كلّه (أسقط
-- `0086` آخر قارئ له، وسلطة الحقيقة صارت الكائن الدائم وإسقاطه `child_projection`
-- ‏— وفيه ٢١ صفًّا). فكل معرّف طفل حقيقي هو مرجعٌ **غير موجود** بمقياس المفتاح.
--
-- ثم لا `catch` حول الإدراج، فيصل الاستثناء إلى `app.onError` ويصير
-- «Internal server error». أي أن وليّ الأمر يرى «تعذر تحميل الإعدادات» لا لعطلٍ
-- في الإعدادات، بل لأن الجدول يشترط أبًا مرجعيًّا هُجر.
--
-- ## الإنفاذ قائم، وهذا مقيس لا مفترض
--
-- كان يمكن افتراض أن D1 لا يفرض المفاتيح فيكون السبب غيرَ هذا. القياس على
-- **قاعدة الإنتاج نفسها**:
--
--   * `PRAGMA foreign_keys` = `1`.
--   * `PRAGMA foreign_key_list(child_settings)` = `children_profiles(id)`.
--   * وإدراج معرّف غير موجود رُفض بـ:
--     `FOREIGN KEY constraint failed: SQLITE_CONSTRAINT_FOREIGNKEY [code: 7500]`
--
-- وهو ما يُثبته `test/referentialIntegrity.test.mjs` أصلًا: الإنفاذ في D1 قائم
-- **ولا يُعطَّل من SQL**. فلا مخرج بـ`PRAGMA foreign_keys=OFF`.
--
-- ## لماذا الإسقاط لا إحياء `children_profiles`
--
-- إحياؤه يعني كاتبًا جديدًا يُضاعف صفوف الأطفال في موضعين، وقد نُقلت السلطة إلى
-- الكائن الدائم عن قصد. و«زرع صفٍّ لكل طفل ليرضى المفتاح» أسوأ: يجعل جدولًا ميتًا
-- يبدو حيًّا، وهو الفخّ الذي وصفه `0085` بعينه.
--
-- والمرجع هنا **لم يكن يحمي شيئًا**: الملكية تُفحَص في المعالِج قبل الإدراج
-- (`child_projection` + `parent_id` + `status='active'`)، وهي بوابة أقوى من
-- المفتاح لأنها تعرف الأسرة لا الوجود فقط. فما أسقطه هذا الترحيل هو **قيد يمنع
-- الصحيح ولا يمنع الخطأ**.
--
-- وهذا نمط `0086` المُعلَن: جداول الإسقاط بلا مفاتيح أجنبية.
--
-- ## ولماذا أربعة جداول لا `child_settings` وحده
--
-- ثلاثة عشر جدولًا يشير إلى `children_profiles`. المُصلَح منها ما **يُكتب فعلًا من
-- كود حيّ**، وهي أربعة — أي أربعة أعطال من نفس الطبقة، أحدها ظهر والثلاثة تنتظر
-- أول نداء:
--
-- | الجدول | الكاتب | حالته قبل الإصلاح |
-- |---|---|---|
-- | `child_settings` | `routes/childSettings.ts:45` | **ظاهر**: 500 على كل قراءة |
-- | `analytics_events` | `routes/analyticsIngest.ts:200` | كامن: يُدرج `child_id` بعد تحقّق الملكية، فيفشل حتمًا |
-- | `notifications` | `routes/notifications.ts:70` | كامن: يفشل متى مُرّر `child_id` |
-- | `home_recommendations` | `routes/adminRecommendations.ts:141` | كامن: يفشل متى استُهدف طفل |
--
-- والباقي (`attempts`, `mastery`, `favorites`, `playback_leases`) **لا يُمَسّ**:
-- كتابته في `FamilyState` على `state.storage.sql` — تخزين الكائن الدائم لا D1 —
-- فمخطَّط D1 هذا ليس مسار كتابتها. وإسقاط قيودها تنظيفٌ منفصل لا إصلاح عطل، ولا
-- يُخلَط بهذا.
--
-- ## شكل التنفيذ
--
-- SQLite لا يحذف قيدًا بـ`ALTER TABLE`، فالسبيل إعادة البناء. و`child_settings`
-- و`analytics_events` و`notifications` **صفر صفًّا** فلا نقل فيها. أمّا
-- `home_recommendations` ففيه ثلاثة صفوف (كلّها `child_id IS NULL` — توصيات
-- تحريرية عامّة) وتُنقل بـ`INSERT ... SELECT` لا بإعادة زرع.
--
-- ومراجع `parents(id)` و`series(id)` **تبقى**: كلاهما جدول حيّ مزروع، وقيدهما
-- يمنع خطأً حقيقيًّا.

/* ------------------------------------------------------------ child_settings */

DROP TABLE IF EXISTS child_settings;

CREATE TABLE child_settings (
  -- بلا `REFERENCES`: المصدر `child_projection`، والملكية تُفحَص في المعالِج.
  child_id TEXT PRIMARY KEY,
  daily_minutes INTEGER NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 180),
  autoplay INTEGER NOT NULL DEFAULT 0 CHECK (autoplay IN (0, 1)),
  captions_enabled INTEGER NOT NULL DEFAULT 0 CHECK (captions_enabled IN (0, 1)),
  audio_language TEXT NOT NULL DEFAULT 'ar',
  allowed_planets TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- أعمدة `0049`. تُعلَن هنا في التعريف لا بـ`ALTER` لأن الجدول يُبنى من جديد،
  -- وقيودها منقولة حرفيًّا عن المخطَّط الحيّ.
  bedtime_start TEXT,
  bedtime_end TEXT,
  max_session_minutes INTEGER CHECK (max_session_minutes IS NULL OR max_session_minutes BETWEEN 5 AND 180),
  allow_speed_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_speed_change IN (0, 1)),
  autoplay_override TEXT CHECK (autoplay_override IS NULL OR autoplay_override IN ('off', 'on', 'inherit'))
);

/* --------------------------------------------------------- analytics_events */

DROP TABLE IF EXISTS analytics_events;

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  -- `parents` جدول حيّ، فمرجعه يبقى.
  parent_id TEXT REFERENCES parents(id) ON DELETE SET NULL,
  child_id TEXT,
  event_name TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_analytics_parent ON analytics_events(parent_id, created_at);
CREATE INDEX idx_analytics_child ON analytics_events(child_id, created_at);
CREATE INDEX idx_analytics_name ON analytics_events(event_name, created_at);

/* ------------------------------------------------------------- notifications */

DROP TABLE IF EXISTS notifications;

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('new_episode', 'new_series', 'continue_watching', 'download_complete', 'subscription_issue', 'creative_update')),
  title_ar TEXT NOT NULL,
  body_ar TEXT,
  deep_link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_parent ON notifications(parent_id, is_read, created_at);
CREATE INDEX idx_notifications_child ON notifications(child_id, is_read, created_at);

/* ------------------------------------------------------ home_recommendations */

-- الصفوف تُنقل لا تُزرع: ثلاثة صفوف تحريرية قائمة، وإعادة زرعها تعني كتابة
-- محتوى إنتاج في ترحيل بنية.
CREATE TABLE home_recommendations_new (
  id TEXT PRIMARY KEY,
  child_id TEXT,
  -- `series` جدول حيّ مزروع، فمرجعه يبقى.
  series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'editorial',
  priority INTEGER NOT NULL DEFAULT 0,
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  is_hidden INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO home_recommendations_new (id, child_id, series_id, reason, priority, is_pinned, is_hidden, created_at)
SELECT id, child_id, series_id, reason, priority, is_pinned, is_hidden, created_at FROM home_recommendations;

DROP TABLE home_recommendations;

ALTER TABLE home_recommendations_new RENAME TO home_recommendations;

CREATE INDEX idx_home_recs_child ON home_recommendations(child_id, priority);
