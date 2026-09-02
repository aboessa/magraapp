-- AI provider registry: which vendors exist, which models they expose, and which
-- model serves which platform task.
--
-- ## What this table set is, and what it deliberately is not
--
-- It is **configuration**, not credentials. `ai_providers.credential_ref` holds the
-- NAME of a Worker secret (for example `GOOGLE_AI_API_KEY`), never its value. This follows
-- the rule already written in `src/lib/db.ts`: `platform_settings.value` is plaintext
-- TEXT (migration 0017), so a key placed in D1 would be readable by anything with
-- database access and would appear in every backup. Model, routing, price and cap
-- choices are safe in D1; the credential is not.
--
-- Consequence, stated so it is not discovered later: adding a brand-new vendor needs
-- `wrangler secret put` plus one line in the `Env` interface plus a deploy. Adding a
-- model, repointing a task, or changing a daily cap needs neither.
--
-- ## Why tasks are seeded here and not created by the admin
--
-- A task is a capability this codebase actually implements. If the dashboard
-- could invent one, it would render a dropdown with nothing behind it — configured to
-- the eye, inert in fact. So `ai_tasks` is code-owned: rows arrive by migration, and
-- `is_wired` says whether a code path consults this registry for that task yet.
-- Every task below lands with `is_wired = 0`. A task flips to 1 in the same migration
-- that ships the code reading it, so the screen can never promise more than exists.
--
-- ## Money
--
-- Prices and caps are integer micros, matching `0057_content_factory.sql`, because
-- floating-point currency drifts. `price_micros IS NULL` means unpriced, and unpriced
-- is a state the UI must show rather than silently treat as free.

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------ providers

CREATE TABLE ai_providers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,

  -- How the credential is presented. Each value maps to one branch in
  -- `services/aiText.ts`; an unmapped mode is a 400, not a silent no-auth call.
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('api_key_header', 'bearer', 'service_account')),

  -- HTTPS only, enforced here as well as in the route: a provider row is the one
  -- place that decides where platform credentials get sent.
  base_url TEXT NOT NULL CHECK (base_url LIKE 'https://%'),

  -- The NAME of a Worker secret, never a secret.
  --
  -- The two GLOBs pin it to the shape of an environment variable so a pasted API key —
  -- which carries lowercase letters, dashes or dots — cannot be stored in this column
  -- at all. Written as "starts with an uppercase letter" plus "contains no character
  -- outside the set", because the GLOB `*` is a wildcard for any sequence: a single
  -- combined pattern would happily match a lowercase, dash-bearing key.
  credential_ref TEXT NOT NULL CHECK (
    credential_ref GLOB '[A-Z]*'
    AND credential_ref NOT GLOB '*[^A-Z0-9_]*'
    AND length(credential_ref) <= 80
  ),

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  notes_ar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- -------------------------------------------------------------------- models

CREATE TABLE ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,

  -- The model string the vendor publishes, sent verbatim on the wire.
  model_id TEXT NOT NULL,
  name_ar TEXT NOT NULL,

  -- What the model PRODUCES, which is what a task needs to match. A text model
  -- cannot serve an image task no matter how it is routed.
  modality TEXT NOT NULL CHECK (modality IN ('text', 'image', 'video', 'audio')),

  -- Guaranteed-schema support (OpenAI strict json_schema, Gemini responseSchema).
  -- Tasks that must return structured JSON refuse to route through a model without it,
  -- rather than parsing free prose and failing halfway through a batch.
  supports_json_schema INTEGER NOT NULL DEFAULT 0 CHECK (supports_json_schema IN (0, 1)),

  max_input_tokens INTEGER CHECK (max_input_tokens IS NULL OR max_input_tokens > 0),
  max_output_tokens INTEGER CHECK (max_output_tokens IS NULL OR max_output_tokens > 0),

  -- Unpriced is NULL, not zero: zero would read as free.
  price_micros INTEGER CHECK (price_micros IS NULL OR price_micros >= 0),
  price_unit TEXT CHECK (price_unit IS NULL OR price_unit IN (
    'per_1k_input_tokens', 'per_1k_output_tokens', 'per_1k_characters',
    'per_image', 'per_second'
  )),

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),

  -- Last connectivity probe. Kept on the model rather than derived from ai_call_log so
  -- the registry read stays one statement; the log remains the full history.
  last_probe_at TEXT,
  last_probe_status TEXT CHECK (last_probe_status IS NULL OR last_probe_status IN ('ok', 'failed')),
  last_probe_detail TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,

  UNIQUE (provider_id, model_id),
  -- An amount without a unit is not a price, and a unit without an amount is not
  -- either. They are written together or not at all.
  --
  -- Placed with the table constraints rather than beside the price columns: SQLite
  -- cannot resume parsing column definitions once a table constraint has started, so a
  -- standalone CHECK in the middle of the column list fails at the next column.
  CHECK ((price_micros IS NULL) = (price_unit IS NULL))
);

-- --------------------------------------------------------------------- tasks

CREATE TABLE ai_tasks (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  description_ar TEXT NOT NULL,
  required_modality TEXT NOT NULL CHECK (required_modality IN ('text', 'image', 'video', 'audio')),
  requires_json_schema INTEGER NOT NULL DEFAULT 0 CHECK (requires_json_schema IN (0, 1)),

  -- Whether a production code path resolves this task through the registry yet.
  -- 0 means routing can be configured but nothing calls it, and the dashboard says so
  -- instead of implying the task is live.
  is_wired INTEGER NOT NULL DEFAULT 0 CHECK (is_wired IN (0, 1)),

  sort_order INTEGER NOT NULL DEFAULT 0
);

-- -------------------------------------------------------------------- routes

CREATE TABLE ai_task_routes (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES ai_tasks(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,

  -- 1 is the primary; 2 and up are fallbacks tried in order when a higher priority is
  -- unconfigured, disabled, or over its daily cap. Bounded at 5 because a sixth
  -- fallback is a configuration smell, not a resilience feature.
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5),

  is_enabled INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0, 1)),

  -- Per-route generation parameters (temperature, thinking budget, default negative
  -- prompt). Shape belongs to the calling service, so this stays opaque JSON here.
  params_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(params_json)),

  -- Daily ceilings, counted from ai_call_log for the current UTC date. NULL is no cap.
  daily_call_cap INTEGER CHECK (daily_call_cap IS NULL OR daily_call_cap > 0),
  daily_spend_cap_micros INTEGER CHECK (daily_spend_cap_micros IS NULL OR daily_spend_cap_micros >= 0),

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,

  -- One model per priority, and one priority per model: two rows pointing the same
  -- task at the same model differ only by a number nobody can act on.
  UNIQUE (task_id, priority),
  UNIQUE (task_id, model_id)
);

-- ----------------------------------------------------------------- call log

-- Deliberately without foreign keys, unlike content_factory_cost_ledger.
--
-- That ledger is scoped to one run and dies with it. This is a spend and usage
-- history that must outlive the rows it describes: disabling a model or deleting a
-- provider must not erase what was already spent through it. So the provider slug and
-- model string are denormalised into the row, and the ids are plain text.
CREATE TABLE ai_call_log (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  model_id TEXT,
  provider_slug TEXT NOT NULL,
  model_ref TEXT NOT NULL,

  -- A probe is an operator connectivity test; production is real content work.
  -- Separated so a day of debugging does not read as content generation, and so caps
  -- can be applied to production without blocking diagnosis.
  purpose TEXT NOT NULL CHECK (purpose IN ('production', 'probe')),

  status TEXT NOT NULL CHECK (status IN ('ok', 'refused', 'provider_failed', 'invalid_output')),
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cost_micros INTEGER NOT NULL DEFAULT 0 CHECK (cost_micros >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),

  -- The prompt is fingerprinted, never stored. Prompts can carry story text and
  -- editorial direction; a hash is enough to correlate a call with its output.
  prompt_sha256 TEXT CHECK (prompt_sha256 IS NULL OR length(prompt_sha256) = 64),

  entity_type TEXT,
  entity_id TEXT,
  error_code TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ai_models_provider ON ai_models(provider_id, status);
CREATE INDEX idx_ai_task_routes_task ON ai_task_routes(task_id, priority);
CREATE INDEX idx_ai_task_routes_model ON ai_task_routes(model_id);
-- The daily-cap read is (task, purpose, date), so it leads with task_id and orders by
-- time. Without this, every routing decision would scan the whole log.
CREATE INDEX idx_ai_call_log_task_time ON ai_call_log(task_id, created_at DESC);
CREATE INDEX idx_ai_call_log_time ON ai_call_log(created_at DESC);

-- ------------------------------------------------------------------- seeds

-- Two providers whose auth this codebase already knows how to perform. No models are
-- seeded: a model string is a vendor fact that changes without notice, and inventing
-- one here would put an id in the registry that may not exist on the other end. They
-- are added from the dashboard, where the operator types the exact string and probes it.
--
-- PlayVeo is intentionally absent. It is owned by the content factory
-- (`services/contentFactoryProvider.ts`) behind immutable plans, spend approval and
-- idempotency. Listing it here before the factory reads this registry would show a
-- routing control that changes nothing.
INSERT INTO ai_providers (id, slug, name_ar, auth_mode, base_url, credential_ref, status, notes_ar) VALUES
  ('aip-google-ai', 'google-ai', 'Google AI Studio', 'api_key_header',
   'https://generativelanguage.googleapis.com',
   'GOOGLE_AI_API_KEY', 'active',
   'مفتاح مستقل عن GOOGLE_TTS_API_KEY عن قصد: فصل الحدّ اليومي والفاتورة بين توليد النص وتوليد الصوت.'),
  ('aip-openai', 'openai', 'OpenAI', 'bearer',
   'https://api.openai.com',
   'OPENAI_API_KEY', 'active',
   'يدعم Structured Outputs بمخطط صارم، فهو الأقوى ضمانًا للمهام التي تطلب JSON.');

-- The capabilities the platform intends to route. All arrive unwired; each flips to
-- is_wired = 1 in the migration that ships the code consuming it.
INSERT INTO ai_tasks (id, name_ar, description_ar, required_modality, requires_json_schema, is_wired, sort_order) VALUES
  ('story_ideas', 'اقتراح أفكار القصص',
   'يُعيد عدة أفكار منظَّمة مع البطل والمكان والمشكلة والقيمة وتقييم الأصالة.', 'text', 1, 0, 1),
  ('story_script', 'تأليف نص القصة كاملًا',
   'بطاقة القصة والقوس الدرامي وتوزيع الأحداث ونص كل صفحة ووصفها البصري.', 'text', 1, 0, 2),
  ('story_page_rewrite', 'إعادة كتابة صفحة',
   'إعادة صياغة صفحة واحدة بحدود العمر ومستوى القراءة نفسهما.', 'text', 1, 0, 3),
  ('story_alt_text', 'وصف الوصول للصورة',
   'نص بديل يصف صورة الصفحة لقارئ الشاشة.', 'text', 0, 0, 4),
  ('story_image_prompt', 'بناء prompt الصورة',
   'يحوّل وصف المشهد ومراجع الشخصيات إلى prompt وnegative prompt.', 'text', 1, 0, 5),
  ('story_page_image', 'توليد صورة الصفحة',
   'إنتاج رسم الصفحة. يمرّ عبر مصنع المحتوى لأنه عمل مدفوع طويل.', 'image', 0, 0, 6),
  ('character_sheet', 'توليد Character Sheet',
   'أوراق هوية الشخصية: زوايا وتعبيرات وملابس ولوحة ألوان ثابتة.', 'image', 0, 0, 7),
  ('story_narration', 'توليد السرد الصوتي',
   'قراءة نص الصفحة بصوت معتمد وتوجيه أداء. يخدمه اليوم مسار Google TTS المستقل.', 'audio', 0, 0, 8),
  ('story_translation', 'ترجمة نص القصة',
   'ترجمة صفحات القصة مع الحفاظ على مستوى القراءة والمصطلحات المعتمدة.', 'text', 1, 0, 9),
  ('duplicate_check', 'فحص تشابه الأفكار',
   'يقارن فكرة جديدة بفهرس أفكار القصص القائمة ويشرح الفرق.', 'text', 1, 0, 10);

-- ------------------------------------------------------------- the permission

-- Routing decides which vendor receives platform credentials and platform money, so it
-- is not an editorial act. The existing platform-settings writers had to borrow
-- `publish` and said so in a comment (adminSiteMode.ts, adminPartnerships.ts); this one
-- gets its own verb instead of widening what `publish` means.
INSERT OR IGNORE INTO permissions (id, action, description_ar) VALUES
  ('manage_ai_providers', 'Manage AI Providers', 'إدارة مزوّدي الذكاء الاصطناعي وتوجيه المهام');

-- Migration 0019 granted roles their permissions with `SELECT id FROM permissions`,
-- which was a snapshot: a permission added afterwards belongs to nobody, including the
-- owner. So the grant is re-run here for the one permission this migration adds.
--
-- Scoped to owner and system_admin only. planet_manager received everything except
-- manage_permissions in 0019, but provider routing is platform-wide by nature — a
-- planet-scoped grant cannot match a request that names no planet anyway
-- (`grantMatchesScope` in lib/adminUsers.ts), so granting it would be inert and
-- misleading.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
  ('owner', 'manage_ai_providers'),
  ('system_admin', 'manage_ai_providers');
