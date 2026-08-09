-- طلبات الشراكة الواردة من صفحة الهبوط، وإعدادات عامة للمنصّة تُضبط من اللوحة.
--
-- الطلبات تُخزَّن دائمًا قبل محاولة إرسال البريد، فسقوط مزوّد البريد
-- لا يفقد الطلب. حالة الإرسال محفوظة في عمود منفصل لتظهر في اللوحة.

CREATE TABLE IF NOT EXISTS partnership_requests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('school', 'nursery', 'publisher', 'producer', 'creator', 'other')),
  name TEXT NOT NULL,
  organization TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  country TEXT,
  message TEXT NOT NULL,
  -- لغة الزائر عند الإرسال، حتى يُردّ عليه بلغته
  locale TEXT NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en', 'fr')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_review', 'contacted', 'accepted', 'declined', 'spam')),
  -- ملاحظة داخلية للفريق، لا تُعرض للمُرسل
  admin_note TEXT,
  email_status TEXT NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'failed', 'skipped')),
  email_error TEXT,
  -- للتشخيص ومكافحة الإساءة، لا للتتبّع
  source_ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_partnership_requests_status
  ON partnership_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partnership_requests_created
  ON partnership_requests (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partnership_requests_email
  ON partnership_requests (email);

-- إعدادات عامة بمفتاح/قيمة، حتى تُضاف إعدادات لاحقة بلا مهاجرة جديدة
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- بريد استقبال طلبات الشراكة. القيمة فارغة حتى يضبطها المسؤول من اللوحة،
-- ولا نضع بريدًا افتراضيًا مخترعًا حتى لا تُرسل الطلبات إلى عنوان لا يقرأه أحد.
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('partnership_inbox_email', '');
-- عنوان المُرسل، اختياري: عند تركه فارغًا يُستخدم EMAIL_FROM من إعداد الـWorker
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('partnership_from_email', '');
-- نسخة كربونية اختيارية، عناوين مفصولة بفاصلة
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('partnership_cc_emails', '');
