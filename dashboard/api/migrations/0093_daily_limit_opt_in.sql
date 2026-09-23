-- ‏0093 — الحدّ اليومي صار **اختياريًّا يفعّله ولي الأمر** لا مفروضًا بالافتراض.
--
-- ## القرار (المالك، 2026-09-23)
--
-- «لا وقت نوم وكدا، لازم ولي الأمر يفعّل الموضوع ده.» أي أن ضوابط الوقت لا
-- تُفرَض إلا بتفعيلٍ صريح من ولي الأمر. وهذا يُغلق `DECIDE-108`.
--
-- ## ما كان يجري فعلًا، وهو أوضح خرقٍ لهذا القرار
--
-- `daily_minutes INTEGER NOT NULL DEFAULT 30 CHECK (BETWEEN 5 AND 180)`.
--
-- ثلاثة قيود مجتمعة تجعل «لا حدّ» **غير قابل للتمثيل في القاعدة**:
--   1. `NOT NULL` فلا قيمة تعني «غير مفعَّل».
--   2. `DEFAULT 30` فكل صفٍّ جديد يحمل حدًّا.
--   3. `CHECK (BETWEEN 5 AND 180)` فلا حتى صفرٌ يُعبّر عن الإلغاء.
--
-- والصفّ يُنشأ من **مجرّد فتح الشاشة**: `GET /child-settings/:childId` يُدرج صفًّا
-- بالافتراضات إن لم يجده (`childSettings.ts`). فزيارةُ ولي الأمر لشاشة الإعدادات
-- كانت تُنتج حدًّا يوميًّا 30 دقيقة لم يطلبه، ثم **لا يملك إلغاءه**: مخطَّط `PUT`
-- يقبل 5–180 ولا يقبل `null`، والشاشة في `parent_dashboard_page.dart:540`
-- مؤشّرٌ (`Slider`) من 5 إلى 180 بلا موضع «مُطفأ».
--
-- وهذا مفروضٌ على الفيديو **اليوم**: `startPlayback` و`heartbeatPlayback` في
-- `FamilyState` يقرآن الحدّ ويرفضان عليه. فالعطل قائم لا نظريّ.
--
-- ## الشكل الجديد
--
-- `daily_minutes` بلا `NOT NULL` وبلا `DEFAULT`، و`CHECK` يقبل `NULL` — أي نفس
-- شكل `max_session_minutes` المجاور له، فيصير للعمودين تعريفٌ واحد لـ«غير
-- مفعَّل» بدل تعريفين.
--
-- و`NULL` يعني **لم يفعّله ولي الأمر**، ويقرؤه `loadScreenTimePolicy` كذلك:
-- `dailyMinutes: null` ⇒ لا فحص. وكانت الدالّة تستبدل 30 مكان الغياب، وقد
-- صُحِّحت مع هذا الترحيل ويحرسها اختبار.
--
-- ## الصفوف القائمة تُنقل بقيمها، ولا تُصفَّر
--
-- صفٌّ يحمل 30 **لا يُفرَّق** في البيانات عن صفٍّ اختار ولي أمره 30: لا عمود
-- يسجّل «مَن كتب هذه القيمة»، و`updated_at` له `DEFAULT (datetime('now'))` فهو
-- مكتوبٌ في الحالتين. فتصفيرُ كل 30 كان سيرفع حدًّا اختاره أبٌ فعلًا، وهو ضررٌ
-- في الاتجاه الأخطر.
--
-- والقياس يجعل المسألة نظرية هنا: `child_settings` **صفر صفًّا** على القاعدة
-- المحلية (و`child_projection` و`parents` صفر أيضًا — المنصّة قبل الإطلاق).
-- وعلى الإنتاج **لم يُقَس**: يحتاج `wrangler d1 execute --remote`، وهو فعل مالك.
-- فإن وُجدت هناك صفوفٌ بالافتراض 30 فهي تبقى محدودة حتى يغيّرها ولي أمرها —
-- وذلك مُعلَن في `LEDGER.md` لا مُرقَّع بتخمين.
--
-- ## لماذا إعادة بناء
--
-- SQLite لا يحذف `NOT NULL` ولا `DEFAULT` ولا `CHECK` بـ`ALTER TABLE`. وهذا نفس
-- شكل `0090` على هذا الجدول بعينه، والتعريف أدناه منقول عنه حرفيًّا فيما عدا
-- سطر `daily_minutes`.

ALTER TABLE child_settings RENAME TO child_settings_pre_0093;

CREATE TABLE child_settings (
  -- بلا `REFERENCES`: المصدر `child_projection`، والملكية تُفحَص في المعالِج.
  child_id TEXT PRIMARY KEY,
  -- ‏`NULL` = لم يفعّل ولي الأمر حدًّا يوميًّا. لا `DEFAULT`: الصفّ الذي يُنشئه
  -- `GET /child-settings/:childId` لمجرّد فتح الشاشة يجب أن يخرج **بلا حدّ**.
  daily_minutes INTEGER CHECK (daily_minutes IS NULL OR daily_minutes BETWEEN 5 AND 180),
  autoplay INTEGER NOT NULL DEFAULT 0 CHECK (autoplay IN (0, 1)),
  captions_enabled INTEGER NOT NULL DEFAULT 0 CHECK (captions_enabled IN (0, 1)),
  audio_language TEXT NOT NULL DEFAULT 'ar',
  allowed_planets TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  bedtime_start TEXT,
  bedtime_end TEXT,
  max_session_minutes INTEGER CHECK (max_session_minutes IS NULL OR max_session_minutes BETWEEN 5 AND 180),
  allow_speed_change INTEGER NOT NULL DEFAULT 0 CHECK (allow_speed_change IN (0, 1)),
  autoplay_override TEXT CHECK (autoplay_override IS NULL OR autoplay_override IN ('off', 'on', 'inherit'))
);

INSERT INTO child_settings (
  child_id, daily_minutes, autoplay, captions_enabled, audio_language,
  allowed_planets, updated_at, bedtime_start, bedtime_end, max_session_minutes,
  allow_speed_change, autoplay_override
)
SELECT
  child_id, daily_minutes, autoplay, captions_enabled, audio_language,
  allowed_planets, updated_at, bedtime_start, bedtime_end, max_session_minutes,
  allow_speed_change, autoplay_override
FROM child_settings_pre_0093;

DROP TABLE child_settings_pre_0093;
