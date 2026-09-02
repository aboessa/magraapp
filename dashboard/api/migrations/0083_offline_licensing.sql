-- ENC-001 — إسقاط تراخيص الاستخدام دون إنترنت في D1.
--
-- ## ما هي السلطة وما هو الإسقاط
--
-- السلطة في `FamilyState` (جدولا `offline_licenses` و`offline_license_assets`
-- داخل الكائن): الإصدار عدٌّ ثم إدراج على حدود مشتركة، وهذا الكائن هو الموضع
-- الوحيد المُسلسَل لكل أسرة. هذه الجداول **إسقاط** يكتبه مستهلك الطابور، وغرضه
-- الإجابة على أسئلة إدارية عابرة للأسر: كم ترخيصًا نشطًا اليوم، وأي جهاز يحمل
-- أكثر من غيره، ومتى سُحب ماذا. لا مسار كتابة إليها من الطلبات.
--
-- ## ثلاثة جداول لا أربعة — وهذا انحراف مقصود عن الخطة
--
-- الخطة (`تشفير المحتوي.md:19`) تطلب `download_sessions` و`media_licenses`
-- و`child_downloads` و`download_events`. الجلسة والترخيص هنا **شيء واحد**: جلسة
-- التنزيل تُصدر ترخيصًا وتنتهي، والحالة التي تُتابَع بعدها هي حالة الترخيص
-- (`pending` أي يُنزَّل الآن → `active` أي اكتمل). جدول جلسات منفصل كان سيحمل
-- نفس المفتاح ونفس دورة الحياة وصفًّا واحدًا لكل ترخيص، أي حقيقة ثانية عن
-- الشيء نفسه — وهو ما يُنتج تناقضًا لا معلومة.
--
-- ## لا FK إلى الأسرة
--
-- `parent_id` نصّ بلا مرجع: الأسرة ليست في D1 أصلًا (سلطتها Durable Object)،
-- و`family_projection` نفسه إسقاط قد يتأخّر عن هذا. FK إلى إسقاط آخر كان
-- سيُفشل كتابة ترخيص وصل حدثه قبل حدث الأسرة.

CREATE TABLE IF NOT EXISTS media_licenses (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_auth_epoch INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1,
  rights TEXT NOT NULL DEFAULT 'offline_playback',
  required_plan TEXT NOT NULL,
  -- نفس حالات السلطة. `expired`/`revoked`/`superseded` نهائية: المستهلك لا
  -- يكتب فوقها، والتجديد يُنشئ صفًّا جديدًا يشير إلى القديم.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'superseded')),
  signature_key_id TEXT,
  renewed_from TEXT,
  issued_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  revoked_at_ms INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_media_licenses_parent
  ON media_licenses(parent_id, status);
CREATE INDEX IF NOT EXISTS idx_media_licenses_device
  ON media_licenses(device_id, status);
CREATE INDEX IF NOT EXISTS idx_media_licenses_expiry
  ON media_licenses(status, expires_at_ms);

-- ما نُزِّل فعلًا لكل ترخيص.
--
-- المفتاح المركّب (license_id, asset_id) وFK إلى `media_licenses` هو ما يفرض
-- معيار القبول: «كل صف `child_downloads` يطابق ترخيصًا لنفس الأسرة والطفل
-- والجهاز والأصل والإصدار». الأعمدة المكرّرة (parent/child/device/version)
-- مكرّرة عن قصد: بلا تكرارها يصير كل استعلام إداري JOIN، ومع FK لا يمكن أن
-- تنفصل عن ترخيصها.
CREATE TABLE IF NOT EXISTS child_downloads (
  license_id TEXT NOT NULL REFERENCES media_licenses(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL,
  parent_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  content_id TEXT NOT NULL,
  content_version INTEGER NOT NULL DEFAULT 1,
  byte_size INTEGER,
  source_sha256 TEXT,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (license_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_child_downloads_parent
  ON child_downloads(parent_id, child_id);

-- سجل أحداث التنزيل: append-only، ولا يُحدَّث صفّه أبدًا.
--
-- منفصل عن `media_licenses` لأن الأخير حالةٌ حاضرة والآخر تاريخ. حالة واحدة
-- تُعاد كتابتها تفقد «كم مرة جُدِّد هذا الترخيص ومتى»، وهو أول ما يُسأل عنه في
-- شكوى أسرة.
CREATE TABLE IF NOT EXISTS download_events (
  id TEXT PRIMARY KEY,
  license_id TEXT,
  parent_id TEXT NOT NULL,
  child_id TEXT,
  device_id TEXT,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '{}',
  occurred_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_download_events_license
  ON download_events(license_id, occurred_at_ms);
CREATE INDEX IF NOT EXISTS idx_download_events_parent
  ON download_events(parent_id, occurred_at_ms DESC);
