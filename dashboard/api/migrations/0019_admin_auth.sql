-- مصادقة حقيقية للوحة الإدارة: بريد وكلمة مرور وجلسات وأدوار.
--
-- ## العلّة التي تعالجها هذه المهاجرة
--
-- كان الدخول للوحة بمفتاح واحد مشترك (ADMIN_API_KEY) يحمله كل من يعمل على
-- المنصّة. ثلاث مشكلات مباشرة:
--   ١. لا هوية: سجل التدقيق يعتمد على ترويسة X-Admin-Actor يكتبها المتصل
--      بنفسه بلا تحقّق، فأي شخص يمكنه انتحال أي اسم.
--   ٢. لا صلاحيات: من يدخل يملك كل شيء، فلا يمكن توظيف مراجع أو رسّام
--      بصلاحيات محدودة.
--   ٣. لا سحب: تسريب المفتاح يعني تبديله لكل الفريق في وقت واحد.
--
-- الجداول التالية موجودة من المهاجرة 0014 وتُعاد استخدامها كما هي:
--   admin_users · roles · permissions · role_permissions · access_grants
-- كان ناقصها أمران فقط: أعمدة بيانات الدخول، وجدول جلسات.

-- ---------------------------------------------------------------- الاعتمادات

-- SQLite لا يدعم ADD COLUMN IF NOT EXISTS، وD1 يوقف الملف عند أول خطأ.
-- لذلك يُنشأ جدول اعتمادات منفصل بدل تعديل admin_users: نفس النتيجة، وقابل
-- لإعادة التشغيل بأمان، ويُبقي بيانات الهوية منفصلة عن أسرار الدخول.
CREATE TABLE IF NOT EXISTS admin_credentials (
  user_id TEXT PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
  -- صيغة pbkdf2-sha256$100000$salt$hash من lib/security.ts، نفس ما يستخدمه
  -- تسجيل أولياء الأمور، فلا خوارزمية ثانية تُصان.
  password_hash TEXT NOT NULL,
  password_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- يُلزم المستخدم بتغيير كلمة المرور عند أول دخول. الحساب المبذور يبدأ
  -- بكلمة مؤقتة، وتركها فعّالة إلى الأبد أسوأ من عدم بذرها.
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  -- قفل بعد محاولات فاشلة، بنفس منطق IdentityState للأهل
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------------ الجلسات

-- الجلسة صف في D1 لا حمولة في الرمز.
--
-- الرمز الموقَّع وحده لا يمكن سحبه قبل انتهائه: تعطيل موظف اليوم يبقيه داخلًا
-- حتى تنتهي صلاحية رمزه. التحقق من صف عند كل طلب يجعل «تسجيل الخروج من كل
-- الأجهزة» و«تعطيل الحساب» فوريَّين.
--
-- يُخزَّن ملخّص SHA-256 للرمز لا الرمز نفسه، فسرقة نسخة من قاعدة البيانات
-- لا تمنح جلسات صالحة.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  -- للتشخيص وسحب جلسة بعينها، لا للتتبّع
  user_agent TEXT,
  source_ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expiry ON admin_sessions (expires_at);

-- --------------------------------------------------- إصلاح مصفوفة الصلاحيات

-- المهاجرة 0014 بذرت ١٢ دورًا لكن ربطت ٦ منها بصلاحيات فقط. الأخطر أن
-- system_admin و owner كانا بلا صلاحيات كافية: أي فحص صلاحية حقيقي كان
-- سيمنع مدير النظام من كل شيء.
--
-- owner يحصل على كل صلاحية موجودة، وهو معنى الملكية. الاستعلام يقرأ من
-- permissions فلا تُنسى صلاحية تُضاف لاحقًا.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'owner', id FROM permissions;

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'system_admin', id FROM permissions;

-- مدير الكوكب: كل شيء داخل نطاقه عدا إدارة الصلاحيات
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 'planet_manager', id FROM permissions WHERE id <> 'manage_permissions';

-- أدوار التنفيذ المتخصّصة: كانت مبذورة بلا أي صلاحية فكانت عديمة الفائدة
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('illustrator', 'view'), ('illustrator', 'upload_images'), ('illustrator', 'edit_metadata'), ('illustrator', 'submit_for_review'),
('sound_engineer', 'view'), ('sound_engineer', 'upload_audio'), ('sound_engineer', 'edit_metadata'), ('sound_engineer', 'submit_for_review'),
('translator', 'view'), ('translator', 'edit_text'), ('translator', 'submit_for_review'),
('viewer', 'view');

-- مدير المحتوى يحتاج التعديل والمراجعة كذلك
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('content_manager', 'edit_metadata'), ('content_manager', 'edit_text'), ('content_manager', 'review'),
('content_manager', 'request_changes'), ('content_manager', 'schedule'), ('content_manager', 'unpublish'),
('content_manager', 'archive'), ('content_manager', 'manage_team'), ('content_manager', 'view_audit_log');
