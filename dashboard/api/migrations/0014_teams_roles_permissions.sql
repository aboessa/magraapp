-- نظام التصاريح والأدوار والمستخدمين - 4 طبقات: دور + نطاق + نوع محتوى + لغة

-- المستخدمون الداخليون (لوحة التحكم) - منفصل عن parents (المستخدمين النهائيين)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  is_external INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الفرق (فريق كوكب القصص -> قسم القصص المصورة)
CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  description_ar TEXT,
  planet_id TEXT REFERENCES planets(id),
  section TEXT,
  team_lead_id TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  PRIMARY KEY (team_id, user_id)
);

-- الأدوار والصلاحيات
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL UNIQUE,
  description_ar TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL UNIQUE,
  description_ar TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- المنح الأساسي: user/team + role + scope + contentType + language + صلاحية زمنية
CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY,
  grantee_type TEXT NOT NULL CHECK (grantee_type IN ('user', 'team')),
  grantee_id TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform', 'planet', 'section', 'series', 'content', 'page', 'language')),
  scope_id TEXT,
  content_type TEXT,
  language TEXT,
  valid_from TEXT NOT NULL DEFAULT (datetime('now')),
  valid_until TEXT,
  granted_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- تعيينات المشاريع (سلسلة/قصة محددة)
CREATE TABLE IF NOT EXISTS content_assignments (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES admin_users(id),
  role TEXT NOT NULL,
  assigned_by TEXT REFERENCES admin_users(id),
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_type, content_id, user_id)
);

-- Workflow
CREATE TABLE IF NOT EXISTS workflow_templates (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  content_type TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  template_id TEXT REFERENCES workflow_templates(id),
  current_step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'approved', 'rejected', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_type, content_id)
);

CREATE TABLE IF NOT EXISTS workflow_step_reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  reviewer_id TEXT REFERENCES admin_users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'changes_requested')),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- المهام
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title_ar TEXT NOT NULL,
  content_type TEXT,
  content_id TEXT,
  assignee_id TEXT REFERENCES admin_users(id),
  planet_id TEXT REFERENCES planets(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'review', 'changes_requested', 'approved', 'done', 'late')),
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- التعليقات
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  page_id TEXT,
  author_id TEXT NOT NULL REFERENCES admin_users(id),
  body TEXT NOT NULL,
  is_resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- الإصدارات
CREATE TABLE IF NOT EXISTS content_versions (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_type, content_id, version_number)
);

-- البذور: الصلاحيات
INSERT OR IGNORE INTO permissions (id, action, description_ar) VALUES
('view', 'View', 'عرض'),
('create', 'Create', 'إنشاء'),
('edit_metadata', 'Edit Metadata', 'تعديل البيانات'),
('edit_text', 'Edit Text', 'تعديل النصوص'),
('upload_images', 'Upload Images', 'رفع الصور'),
('upload_audio', 'Upload Audio', 'رفع الصوت'),
('upload_zip', 'Upload ZIP', 'رفع ZIP'),
('manage_pages', 'Manage Pages', 'إدارة الصفحات'),
('delete_draft', 'Delete Draft', 'حذف المسودة'),
('assign_members', 'Assign Members', 'توزيع المهام'),
('submit_for_review', 'Submit for Review', 'إرسال للمراجعة'),
('request_changes', 'Request Changes', 'طلب تعديلات'),
('review', 'Review', 'مراجعة'),
('approve', 'Approve', 'اعتماد'),
('schedule', 'Schedule', 'جدولة'),
('publish', 'Publish', 'نشر'),
('unpublish', 'Unpublish', 'إلغاء نشر'),
('archive', 'Archive', 'أرشفة'),
('manage_team', 'Manage Team', 'إدارة الفريق'),
('manage_permissions', 'Manage Permissions', 'إدارة الصلاحيات'),
('view_audit_log', 'View Audit Log', 'عرض سجل العمليات');

-- البذور: الأدوار
INSERT OR IGNORE INTO roles (id, name_ar, is_system) VALUES
('owner', 'مالك المنصة', 1),
('system_admin', 'مدير النظام', 1),
('content_manager', 'مدير المحتوى', 1),
('planet_manager', 'مدير الكوكب', 1),
('section_lead', 'قائد القسم', 1),
('content_creator', 'منشئ المحتوى', 1),
('illustrator', 'الرسام', 1),
('sound_engineer', 'مهندس الصوت', 1),
('translator', 'المترجم', 1),
('reviewer', 'المراجع', 1),
('publisher', 'مسؤول النشر', 1),
('viewer', 'مشاهدة فقط', 1);

-- ربط الأدوار بالصلاحيات (مصفوفة مبسطة من الملف)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
-- content_creator
('content_creator', 'view'), ('content_creator', 'create'), ('content_creator', 'edit_metadata'), ('content_creator', 'edit_text'), ('content_creator', 'upload_images'), ('content_creator', 'upload_audio'), ('content_creator', 'upload_zip'), ('content_creator', 'manage_pages'), ('content_creator', 'submit_for_review'),
-- section_lead
('section_lead', 'view'), ('section_lead', 'create'), ('section_lead', 'edit_metadata'), ('section_lead', 'edit_text'), ('section_lead', 'upload_images'), ('section_lead', 'upload_audio'), ('section_lead', 'manage_pages'), ('section_lead', 'assign_members'), ('section_lead', 'submit_for_review'), ('section_lead', 'request_changes'), ('section_lead', 'manage_team'),
-- reviewer
('reviewer', 'view'), ('reviewer', 'review'), ('reviewer', 'request_changes'), ('reviewer', 'approve'),
-- publisher
('publisher', 'view'), ('publisher', 'schedule'), ('publisher', 'publish'), ('publisher', 'unpublish'), ('publisher', 'archive'),
-- owner/system_admin/content_manager/planet_manager
('owner', 'view'), ('owner', 'create'), ('owner', 'edit_metadata'), ('owner', 'manage_team'), ('owner', 'manage_permissions'), ('owner', 'publish'), ('owner', 'view_audit_log'),
('content_manager', 'view'), ('content_manager', 'create'), ('content_manager', 'assign_members'), ('content_manager', 'approve'), ('content_manager', 'publish');

-- قالب Workflow افتراضي للقصة المصورة
INSERT OR IGNORE INTO workflow_templates (id, name_ar, content_type, steps_json) VALUES
('wf-illustrated-story', 'مسار القصة المصورة', 'illustrated_story', '["draft","in_production","ready_for_review","content_review","lang_review","image_review","audio_review","quality_check","approved","scheduled","published"]');
