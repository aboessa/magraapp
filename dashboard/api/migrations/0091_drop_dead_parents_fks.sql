-- DB-106: إسقاط مفاتيح أجنبية إلى `parents` — الجدول الميت الثاني.
--
-- ## كيف ظهر، ولماذا لم يظهر قبل الآن
--
-- ظهر أثناء **التحقّق من `0090`** لا من شكوى مستخدم. و`0090` نفسه هو من أخطأ:
-- أسقط `REFERENCES children_profiles(id)` وأبقى `REFERENCES parents(id)` على
-- `analytics_events` و`notifications`، وعلّل الإبقاء بأن «`parents` جدول حيّ».
--
-- والتعليل كان **استنتاجًا لا قياسًا**: `parents` مذكور في الترحيلات ومقروء في
-- الكود، فبدا حيًّا. وعدّ الصفوف على الإنتاج يقول غير ذلك:
--
-- | الجدول | الصفوف |
-- |---|---|
-- | `parents` | **0** |
-- | `parent_credentials` | **0** |
-- | `parent_auth_sessions` | **0** |
-- | `account_devices` | **0** |
-- | `family_projection` | **2** |
-- | `child_projection` | **21** |
--
-- ولا `INSERT INTO parents` في المصدر كلّه. قارئه الوحيد سطرٌ واحد:
-- `parentalControls.ts:126` — `SELECT timezone FROM parents WHERE id = ?` وهو
-- ملفوف بـ`.catch(() => null)`، فيُرجع `null` دائمًا ويسقط إلى المنطقة الافتراضية
-- بلا شكوى. أي أن الجدول لا يُقرأ فعليًّا كذلك.
--
-- ## القياس، لا الافتراض
--
-- على قاعدة الإنتاج، إدراجان متطابقان إلا في `parent_id`:
--
--   * بمعرّف أب **حقيقي** (`424b891b-…`):
--     `FOREIGN KEY constraint failed: SQLITE_CONSTRAINT_FOREIGNKEY [code: 7500]`
--   * بـ`parent_id = NULL`: **نجح**، ثمّ حُذف الصفّ.
--
-- فالمفتاح الرافض هو `parents(id)` قطعًا، لا عمود الطفل — وقد صار حرًّا بـ`0090`.
--
-- ## وهذا موصوف في المستودع أصلًا
--
-- `FamilyState.ts:507` يقول العطل بالحرف: «‏D1 فيه `parental_consents` من `0001`،
-- لكن `parent_id` فيه مفتاح إلى `parents(id)`، وحساب وليّ الأمر يسكن الكائن الدائم
-- ولا يُكتب في جدول D1 ذاك — فالقيد لا يُستوفى أبدًا وكل إدراج يفشل بـ500».
--
-- ولذلك نُقلت الموافقات إلى `consents` داخل الكائن الدائم. فالعلّة كانت مُشخَّصة
-- ومُتجنَّبة في موضع واحد، وبقيت قائمة في هذين الجدولين.
--
-- ## لماذا الأثر صامت لا 500 مرئيًّا
--
-- خلافًا لـ`child_settings`، لا يرى وليّ الأمر شيئًا:
--
-- | الكاتب | ما يحدث |
-- |---|---|
-- | `analyticsIngest.ts:200` | العميل يلفّ النداء بـ`catch (_) { return {'success': false} }` (`majarra_api_client.dart` ~1286)، فيُرمى كل حدث لمستخدم **مُسجَّل** بلا أثر |
-- | `notifications.ts:70` | مسار اختبار يدوي (`POST /notifications/test`)، يفشل بـ500 عند استدعائه |
--
-- والأحداث **المجهولة** تُكتب بنجاح، لأن `parentId` فيها `NULL` عن قصد
-- (`analyticsIngest.ts` يُصرّح: لا تُؤخذ النسبة من المُنادي). أي أن المقياس يفقد
-- بيانات المستخدمين المسجّلين وحدهم — وهو أسوأ من انقطاع كامل، لأنه لا يُلاحَظ.
--
-- ## ولماذا جدولان فقط من أحد عشر
--
-- أحد عشر جدولًا يشير إلى `parents`. المُصلَح ما **يُكتب من كود حيّ في D1**، وهو
-- هذان. والباقي لا يُمَسّ ولسببٍ مُعلَن لا إغفال:
--
--   * `playback_leases` — كتابته في `FamilyState:3287` على `state.storage.sql`،
--     تخزين الكائن الدائم لا D1، فمخطَّط D1 ليس مسار كتابته.
--   * `parental_consents` — مهجور بقرار موثَّق في `FamilyState.ts:507`.
--   * `account_devices`, `data_requests`, `google_play_purchases`,
--     `subscription_entitlements`, `children_profiles`, `parent_credentials`,
--     `parent_auth_sessions` — صفر صفًّا ولا `INSERT` لها في `src/`.
--
-- إسقاط قيودها تنظيفٌ منفصل لا إصلاح عطل، ولا يُخلَط بهذا.
--
-- ## ما لا يُسقط
--
-- `series(id)` يبقى في `home_recommendations`: جدول مزروع عامر، وقيده يمنع خطأً
-- حقيقيًّا. الإصلاح ليس «إسقاط كل مفتاح» — بل إسقاط ما يشير إلى جدولٍ لا كاتب له.
--
-- ## شكل التنفيذ
--
-- الجدولان **صفر صفًّا** على الإنتاج، فلا نقل بيانات: إعادة بناء مباشرة.
-- و`DROP TABLE` يُسقط الفهارس معه بصمت، فتُعاد الخمسة.

/* --------------------------------------------------------- analytics_events */

DROP TABLE IF EXISTS analytics_events;

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  -- بلا `REFERENCES`: سلطة الحقيقة `family_projection`، والنسبة تُؤخذ من الرمز
  -- المُوثَّق (`auth.principal.parentId`) لا من جسم الطلب، وهي بوابة أقوى.
  parent_id TEXT,
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
  parent_id TEXT,
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
