-- Workflow engine: stages, assignments, dependencies, SLA and transition history.
--
-- ## What existed and why it was not an engine
--
-- Migration 0014 created `workflow_templates(steps_json)`, `workflow_runs(current_step)`
-- and `workflow_step_reviews`. In practice that is a decision *log*: a run holds a
-- single `current_step` string, a review row records an opinion about it, and
-- nothing advances, assigns, blocks or expires. The 2026-08-09 audit stated it
-- plainly — «سجل قرارات فقط» — and the consequence was that a content row could
-- reach `status = 'published'` without any stage having been approved, because the
-- status column and the workflow were unrelated pieces of data.
--
-- Three things were missing and each is a table here rather than a JSON field:
--
--  * **Stages as rows** (`workflow_stages`). `steps_json` is a list of names, so a
--    stage could not carry an order, a required role, an SLA or a dependency
--    without every reader parsing and re-validating the same blob. Rows also let a
--    stage be queried — "which stages are overdue across the catalogue" is one
--    query here and impossible against JSON.
--  * **Per-run stage state** (`workflow_run_stages`). `current_step` cannot express
--    "translation is approved, illustration is in progress, narration is blocked on
--    illustration". A single cursor forces a strictly linear process onto work that
--    is genuinely parallel, and the workaround is people not using the tool.
--  * **A publish-blocking flag** (`workflow_stages.blocks_publish`). This is the
--    column that connects the workflow to the publish gate. Without it, the gate
--    would have to guess which stages matter, and a guess in that direction lets
--    content publish past a required review.
--
-- `workflow_step_reviews` is kept and still written on every decision, so the
-- existing history endpoint keeps working and there is one audit trail rather than
-- two.

CREATE TABLE IF NOT EXISTS workflow_stages (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  -- Stable machine key, referenced by dependencies and by run rows. Distinct from
  -- the Arabic label so renaming a stage for clarity does not break running work.
  stage_key TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Who may decide this stage.
  --
  -- Both are optional and they are ANDed when both are present: `required_role`
  -- names a role from `roles`, `required_permission` an action from `permissions`.
  -- A stage with neither is decidable by anyone holding the generic `approve`
  -- permission, which is the pre-existing behaviour and therefore the safe default
  -- for templates that do not specify.
  required_role TEXT REFERENCES roles(id),
  required_permission TEXT REFERENCES permissions(id),

  -- Service level in hours from the moment the stage becomes actionable. NULL means
  -- no SLA rather than an infinite one, so "no target" and "a very long target" stay
  -- distinguishable in reports.
  sla_hours INTEGER CHECK (sla_hours IS NULL OR sla_hours > 0),
  -- Hours after the due time at which the stage is escalated. Separate from
  -- sla_hours because a missed target and an escalation are different events with
  -- different audiences.
  escalate_after_hours INTEGER CHECK (escalate_after_hours IS NULL OR escalate_after_hours > 0),

  -- Whether publication is blocked until this stage is approved. The publish gate
  -- reads exactly this.
  blocks_publish INTEGER NOT NULL DEFAULT 1 CHECK (blocks_publish IN (0, 1)),
  -- Stages that must be approved before this one becomes actionable, as a JSON
  -- array of stage_key. Empty array means it depends only on its sort order.
  depends_on TEXT NOT NULL DEFAULT '[]',
  -- Optional guidance shown to whoever picks the stage up.
  instructions_ar TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (template_id, stage_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_template
  ON workflow_stages (template_id, sort_order);

CREATE TABLE IF NOT EXISTS workflow_run_stages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  stage_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'approved', 'rejected', 'changes_requested', 'skipped'
  )),
  assignee_id TEXT REFERENCES admin_users(id),
  assignee_team_id TEXT REFERENCES teams(id),
  due_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  decided_by TEXT REFERENCES admin_users(id),
  decision_comment TEXT,
  -- Why a stage was skipped. Required by the route when status is 'skipped':
  -- an unexplained skip is indistinguishable from a stage nobody noticed.
  skip_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (run_id, stage_key)
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_stages_run ON workflow_run_stages (run_id);
-- "My work" and "what is overdue" are the two queries an operator runs daily.
CREATE INDEX IF NOT EXISTS idx_workflow_run_stages_assignee
  ON workflow_run_stages (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_run_stages_due
  ON workflow_run_stages (due_at, status);

-- Templates. `steps_json` is kept in sync with the stage rows so the pre-existing
-- readers of that column keep working; the rows are the authority.
INSERT OR IGNORE INTO workflow_templates (id, name_ar, content_type, steps_json) VALUES
('wf-episode', 'مسار الحلقة', 'episode',
 '["editorial","educational_review","language_review","translation","media_production","qa","publisher"]'),
('wf-story', 'مسار القصة', 'story',
 '["writer","editor","translation","illustration","narration","qa","publisher"]'),
('wf-islamic', 'مسار المحتوى الإسلامي', 'islamic',
 '["structure","source_verification","sharia_review","language_review","media_review","publisher"]');

-- Episode: Editorial → Educational Review → Language Review → Translation →
-- Media Production → QA → Publisher.
--
-- Translation does not block publication: Arabic is the product's first language
-- and holding a finished Arabic episode for a pending French dub would stop the
-- catalogue shipping for no child's benefit. This mirrors the publish gate, where
-- secondary languages warn and Arabic blocks, so the two cannot disagree.
INSERT OR IGNORE INTO workflow_stages
  (id, template_id, stage_key, name_ar, sort_order, required_role, required_permission,
   sla_hours, escalate_after_hours, blocks_publish, depends_on, instructions_ar) VALUES
('wfs-ep-editorial', 'wf-episode', 'editorial', 'التحرير', 1, 'content_creator', 'edit_text', 72, 48, 1, '[]',
 'كتابة النصّ ومراجعته الأولى قبل إرساله للمراجعة التربوية.'),
('wfs-ep-edu', 'wf-episode', 'educational_review', 'المراجعة التربوية', 2, 'reviewer', 'review', 48, 24, 1, '["editorial"]',
 'التحقق من الهدف التعليمي ومناسبة الفئة العمرية ومعايير الإتقان.'),
('wfs-ep-lang', 'wf-episode', 'language_review', 'المراجعة اللغوية', 3, 'reviewer', 'review', 48, 24, 1, '["educational_review"]',
 'سلامة العربية ومناسبة المفردات لمستوى القراءة.'),
('wfs-ep-translation', 'wf-episode', 'translation', 'الترجمة', 4, 'translator', 'edit_text', 120, 72, 0, '["language_review"]',
 'الإنجليزية والفرنسية. لا تحجب النشر: العربية هي لغة المنتج الأولى.'),
('wfs-ep-media', 'wf-episode', 'media_production', 'إنتاج الوسائط', 5, 'illustrator', 'upload_images', 240, 120, 1, '["language_review"]',
 'الرسوم والتحريك والصوت والمصغّرة، حتى تصبح الأصول جاهزة.'),
('wfs-ep-qa', 'wf-episode', 'qa', 'ضمان الجودة', 6, 'reviewer', 'review', 48, 24, 1, '["media_production"]',
 'التشغيل الفعلي على الأجهزة، التزامن، الترجمة المصاحبة، حدود العمر.'),
('wfs-ep-publisher', 'wf-episode', 'publisher', 'النشر', 7, 'publisher', 'publish', 24, 24, 1, '["qa"]',
 'الفحص النهائي لبوابة الجاهزية ثم النشر.');

-- Story: Writer → Editor → Translation → Illustration → Narration → QA → Publisher.
INSERT OR IGNORE INTO workflow_stages
  (id, template_id, stage_key, name_ar, sort_order, required_role, required_permission,
   sla_hours, escalate_after_hours, blocks_publish, depends_on, instructions_ar) VALUES
('wfs-st-writer', 'wf-story', 'writer', 'الكتابة', 1, 'content_creator', 'edit_text', 96, 48, 1, '[]',
 'نصّ كل صفحة باللغة الأساسية.'),
('wfs-st-editor', 'wf-story', 'editor', 'التحرير', 2, 'section_lead', 'edit_text', 48, 24, 1, '["writer"]',
 'الإيقاع، طول الصفحة، ملاءمة مستوى القراءة.'),
('wfs-st-translation', 'wf-story', 'translation', 'الترجمة', 3, 'translator', 'edit_text', 120, 72, 0, '["editor"]',
 'اللغات المُعلَنة فقط. لغة مُعلَنة بلا نصّ تُظهر للطفل صفحات فارغة.'),
('wfs-st-illustration', 'wf-story', 'illustration', 'الرسم', 4, 'illustrator', 'upload_images', 240, 120, 1, '["editor"]',
 'رسم لكل صفحة، بأسلوب بصري واحد.'),
('wfs-st-narration', 'wf-story', 'narration', 'السرد', 5, 'sound_engineer', 'upload_audio', 120, 72, 1, '["illustration"]',
 'السرد للغة الأساسية. حاجب للقصص الصوتية بطبيعتها.'),
('wfs-st-qa', 'wf-story', 'qa', 'ضمان الجودة', 6, 'reviewer', 'review', 48, 24, 1, '["narration"]',
 'القراءة كاملة على جهاز حقيقي: التزامن، الاتجاه، النصّ البديل.'),
('wfs-st-publisher', 'wf-story', 'publisher', 'النشر', 7, 'publisher', 'publish', 24, 24, 1, '["qa"]',
 'الفحص النهائي لبوابة الجاهزية ثم النشر.');

-- Islamic: Structure → Source Verification → Sharia Review → Language Review →
-- Media Review → Publisher.
--
-- Every stage blocks, including translation-free ones: for religious content the
-- cost of publishing something unverified is not a quality defect, and
-- lib/islamicContent.ts documents that this gate was silently bypassed for the
-- entire catalogue once already.
INSERT OR IGNORE INTO workflow_stages
  (id, template_id, stage_key, name_ar, sort_order, required_role, required_permission,
   sla_hours, escalate_after_hours, blocks_publish, depends_on, instructions_ar) VALUES
('wfs-is-structure', 'wf-islamic', 'structure', 'البنية', 1, 'content_creator', 'edit_text', 96, 48, 1, '[]',
 'تحديد الموضوع والمصادر المقترحة قبل الكتابة.'),
('wfs-is-source', 'wf-islamic', 'source_verification', 'تحقيق المصادر', 2, 'reviewer', 'review', 72, 48, 1, '["structure"]',
 'مطابقة كل نصّ على مصدره: السورة والآية، أو المجموعة ورقم الحديث ودرجته.'),
('wfs-is-sharia', 'wf-islamic', 'sharia_review', 'المراجعة الشرعية', 3, 'reviewer', 'review', 96, 48, 1, '["source_verification"]',
 'موافقة مراجع شرعي معتمد، مسجّلة باسمه وتاريخها.'),
('wfs-is-lang', 'wf-islamic', 'language_review', 'المراجعة اللغوية', 4, 'reviewer', 'review', 48, 24, 1, '["sharia_review"]',
 'سلامة العربية ودقّة الاقتباس.'),
('wfs-is-media', 'wf-islamic', 'media_review', 'مراجعة الوسائط', 5, 'reviewer', 'review', 72, 48, 1, '["language_review"]',
 'الالتزام بقيود التصوير المُعلَنة للسلسلة.'),
('wfs-is-publisher', 'wf-islamic', 'publisher', 'النشر', 6, 'publisher', 'publish', 24, 24, 1, '["media_review"]',
 'الفحص النهائي لبوابة الجاهزية ثم النشر.');
