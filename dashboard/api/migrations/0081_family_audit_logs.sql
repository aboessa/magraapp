-- PRIV-102: سجل تدقيق لعمليات مسار العميل (الأسرة).
--
-- ## لماذا جدول مستقل ولا يُعاد استخدام audit_logs
--
-- `audit_logs` هو سجل اللوحة: كل صفوفه فاعلها مسؤول، وشاشة
-- `GET /admin/audit-logs` تقرؤه كما هو بلا تمييز نوع فاعل (لا عمود
-- `actor_kind` فيه). لو كُتبت فيه أفعال أولياء الأمور لاختلط سجل الرقابة
-- بسجل المُراقَبين: يصير «من فعل ماذا في اللوحة» غير قابل للإجابة إلا
-- بتصفية هشّة على `entity_type`، وتُسرَّب حركة الأسرة إلى كل من يملك
-- `view_audit_log`.
--
-- هذا الجدول يفصل المسارين، ويصرّح بنوع الفاعل عمودًا أول درجة:
--   * `parent`   — فعل من داخل جلسة وليّ أمر مُصادَقة.
--   * `operator` — فعل إداري على الأسرة (يحمل `operator_id` و`reason`).
--   * `system`   — تنفيذ مؤجَّل داخل الـDO (وظائف الحذف على المنبّه).
--
-- ## الخصوصية
--
-- `details` يُكتب عبر نفس منقّح `lib/auditLog.ts` (`redactForAudit`)، فلا
-- توكن ولا رابط مُوقَّع كامل ولا `nickname`/شهر أو سنة ميلاد
-- (تشفير المحتوي.md:1213). `child_id` مُعرّف مستعار ومسموح.
--
-- ## المفتاح الأساسي
--
-- `event_id` من الـoutbox هو المفتاح، لا معرّف جديد: الطابور at-least-once،
-- وإعادة تسليم نفس الحدث يجب أن تُنتج صفًّا واحدًا. `INSERT OR IGNORE`
-- عليه يجعل الكتابة idempotent بلا قراءة سابقة.

CREATE TABLE IF NOT EXISTS family_audit_logs (
  event_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('parent', 'operator', 'system')),
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  occurred_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الاستعلام السائد: سجل أسرة واحدة بترتيب زمني عكسي (Customer 360).
CREATE INDEX IF NOT EXISTS idx_family_audit_parent
  ON family_audit_logs(parent_id, occurred_at_ms DESC);

-- الاستعلام الثاني: «كل عمليات نوع كذا في نافذة زمنية» للتحقيقات.
CREATE INDEX IF NOT EXISTS idx_family_audit_action
  ON family_audit_logs(action, occurred_at_ms DESC);

-- صلاحية قراءة السجل: منفصلة عن `view_audit_log` لأن المحتوى مختلف
-- (حركة أسرة، لا حركة لوحة)، فمن يراجع تصرّفات المسؤولين ليس بالضرورة
-- من يحقّ له تتبّع أسرة.
INSERT OR IGNORE INTO permissions (id, action, description_ar)
VALUES (
  'view_family_audit',
  'View Family Audit',
  'قراءة سجل تدقيق عمليات الأسرة (الجلسات والأجهزة والترخيص ودورة حياة الحساب)'
);

-- `owner` و`system_admin` فقط، كما في 0079. لا دور دعم في جدول الأدوار
-- الحالي (12 دورًا، لا `support_lead`)، والدورين يتخطّيان النطاق أصلًا في
-- `lib/adminUsers.ts:isSuperuser`، فهذا تصريح يُظهر الصلاحية في شاشة الأدوار
-- ويجعل منحها لدور دعم مستقبلًا بلا ترحيل جديد.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES ('owner', 'view_family_audit'), ('system_admin', 'view_family_audit');
