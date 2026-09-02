-- B2B School Accounts — Classroom, school and district level with privacy isolation
-- Requirements from audit: teacher scoped to own classroom progress only,
-- data isolation (teachers cannot see parent email/phone, parents cannot see other students),
-- anonymisation in aggregated reports above minimum student count

CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('public','private','international','charter')) DEFAULT 'public',
  country TEXT NOT NULL,
  region TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  billing_contact_name TEXT,
  billing_contact_email TEXT,
  student_capacity INTEGER,
  subscription_plan TEXT NOT NULL DEFAULT 'family' CHECK (subscription_plan IN ('free','family','family_plus','school_basic','school_premium','district')),
  subscription_status TEXT NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active','suspended','expired','pending')),
  subscription_expires_at TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived','pending')),
  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS classrooms (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  grade_level TEXT NOT NULL CHECK (grade_level IN ('kg1','kg2','grade1','grade2','grade3','grade4','grade5','grade6','grade7','grade8','grade9','grade10','grade11','grade12')),
  section TEXT,
  academic_year TEXT NOT NULL,
  teacher_id TEXT REFERENCES admin_users(id),
  assistant_teacher_id TEXT REFERENCES admin_users(id),
  student_capacity INTEGER DEFAULT 30,
  current_students INTEGER DEFAULT 0,
  -- Privacy settings
  anonymize_reports BOOLEAN NOT NULL DEFAULT 1,
  min_anonymize_threshold INTEGER NOT NULL DEFAULT 5,
  parent_visibility TEXT NOT NULL DEFAULT 'own_child_only' CHECK (parent_visibility IN ('own_child_only','aggregated_only','none')),
  teacher_can_see_parent_contact BOOLEAN NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','pending')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(school_id, code)
);

CREATE TABLE IF NOT EXISTS school_enrollments (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  -- Link to family_projection / child_projection — not direct foreign key to allow eventual consistency
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  enrollment_status TEXT NOT NULL DEFAULT 'active' CHECK (enrollment_status IN ('active','suspended','graduated','transferred','archived')),
  enrolled_at TEXT NOT NULL DEFAULT (datetime('now')),
  enrolled_by TEXT REFERENCES admin_users(id),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(classroom_id, child_id)
);

CREATE TABLE IF NOT EXISTS school_teachers (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher','assistant','coordinator','principal','admin')),
  classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL,
  permissions TEXT NOT NULL DEFAULT '["view_classroom_progress","view_aggregated_reports"]',
  is_active BOOLEAN NOT NULL DEFAULT 1,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  assigned_by TEXT REFERENCES admin_users(id),
  UNIQUE(school_id, teacher_id, classroom_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_schools_country ON schools(country, status);
CREATE INDEX IF NOT EXISTS idx_schools_type ON schools(type, status);
CREATE INDEX IF NOT EXISTS idx_classrooms_school ON classrooms(school_id, status);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher ON classrooms(teacher_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_school ON school_enrollments(school_id, enrollment_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom ON school_enrollments(classroom_id, enrollment_status);
CREATE INDEX IF NOT EXISTS idx_enrollments_child ON school_enrollments(child_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_parent ON school_enrollments(parent_id);
CREATE INDEX IF NOT EXISTS idx_school_teachers_school ON school_teachers(school_id, is_active);
CREATE INDEX IF NOT EXISTS idx_school_teachers_teacher ON school_teachers(teacher_id, is_active);

-- Seed demo school for development (safe, anonymized)
INSERT OR IGNORE INTO schools (id, code, name_ar, name_en, type, country, city, status)
VALUES ('school-demo-cairo-1', 'EG-CAI-001', 'مدرسة مجرة التجريبية - القاهرة', 'Majarra Demo School - Cairo', 'private', 'EG', 'Cairo', 'active');

INSERT OR IGNORE INTO classrooms (id, school_id, code, name_ar, name_en, grade_level, section, academic_year, student_capacity)
VALUES 
  ('class-demo-g2a', 'school-demo-cairo-1', 'G2-A', 'الصف الثاني - أ', 'Grade 2 - A', 'grade2', 'A', '2025-2026', 30),
  ('class-demo-g3b', 'school-demo-cairo-1', 'G3-B', 'الصف الثالث - ب', 'Grade 3 - B', 'grade3', 'B', '2025-2026', 30);
