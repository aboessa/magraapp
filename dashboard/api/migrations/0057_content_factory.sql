-- Content factory: immutable plans, spend approvals, resumable attempts, cost exposure and QC evidence.
-- No provider request is permitted by this schema alone; HTTP and Queue code must also require
-- explicit allow_paid. Integer microcredits avoid floating-point budget drift.

PRAGMA foreign_keys = ON;

CREATE TABLE content_factory_runs (
  id TEXT PRIMARY KEY,
  manifest_id TEXT NOT NULL,
  schema_version TEXT NOT NULL CHECK (schema_version = 'content-factory.production-manifest/v1'),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('episode','story','story_page')),
  entity_id TEXT NOT NULL,
  planet_slug TEXT NOT NULL,
  series_slug TEXT NOT NULL,
  pipeline_profile TEXT NOT NULL CHECK (pipeline_profile IN (
    'cartoon_video_model_audio','motion_story_video','illustrated_read_to_me','live_action'
  )),
  source_sha256 TEXT NOT NULL CHECK (length(source_sha256) = 64),
  plan_sha256 TEXT NOT NULL CHECK (length(plan_sha256) = 64),
  inventory_sha256 TEXT CHECK (inventory_sha256 IS NULL OR length(inventory_sha256) = 64),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  state TEXT NOT NULL CHECK (state IN (
    'planned','blocked','awaiting_spend_approval','approved','queued','running','paused',
    'awaiting_qc','awaiting_human_review','partially_failed','failed','completed','cancelled'
  )),
  blocker_count INTEGER NOT NULL DEFAULT 0 CHECK (blocker_count >= 0),
  unpriced_job_count INTEGER NOT NULL DEFAULT 0 CHECK (unpriced_job_count >= 0),
  estimate_low_micros INTEGER NOT NULL CHECK (estimate_low_micros >= 0),
  estimate_high_micros INTEGER NOT NULL CHECK (estimate_high_micros >= estimate_low_micros),
  estimate_with_contingency_micros INTEGER NOT NULL CHECK (estimate_with_contingency_micros >= estimate_high_micros),
  approved_ceiling_micros INTEGER CHECK (approved_ceiling_micros IS NULL OR approved_ceiling_micros >= 0),
  spend_approval_sha256 TEXT CHECK (spend_approval_sha256 IS NULL OR length(spend_approval_sha256) = 64),
  created_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  dispatched_by TEXT,
  dispatched_at TEXT,
  dispatch_idempotency_key TEXT UNIQUE,
  last_error_code TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(manifest_id, plan_sha256)
);

CREATE TABLE content_factory_spend_approvals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_factory_runs(id) ON DELETE CASCADE,
  plan_sha256 TEXT NOT NULL CHECK (length(plan_sha256) = 64),
  ceiling_micros INTEGER NOT NULL CHECK (ceiling_micros >= 0),
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  expires_at TEXT,
  approval_sha256 TEXT NOT NULL UNIQUE CHECK (length(approval_sha256) = 64),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved','revoked','expired')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, plan_sha256, status)
);

CREATE TABLE content_factory_jobs (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_factory_runs(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('video','image','narration','package')),
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  dependencies_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(dependencies_json)),
  input_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_json)),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  item_count INTEGER CHECK (item_count IS NULL OR item_count > 0),
  page_index INTEGER CHECK (page_index IS NULL OR page_index > 0),
  state TEXT NOT NULL DEFAULT 'planned' CHECK (state IN (
    'planned','queued','submitting','submitted','provider_pending','provider_processing',
    'provider_completed','downloading','downloaded','validating','automated_qc_failed',
    'awaiting_human_review','human_review_rejected','approved','submission_failed',
    'provider_failed','provider_cancelled','polling_failed','timed_out','download_failed',
    'validation_failed','archived'
  )),
  estimate_low_micros INTEGER NOT NULL CHECK (estimate_low_micros >= 0),
  estimate_high_micros INTEGER NOT NULL CHECK (estimate_high_micros >= estimate_low_micros),
  reserved_micros INTEGER NOT NULL DEFAULT 0 CHECK (reserved_micros >= 0),
  current_attempt_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, job_id)
);

CREATE TABLE content_factory_attempts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_factory_runs(id) ON DELETE CASCADE,
  factory_job_id TEXT NOT NULL REFERENCES content_factory_jobs(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  state TEXT NOT NULL CHECK (state IN (
    'planned','submitting','submitted','provider_pending','provider_processing',
    'provider_completed','downloading','downloaded','validating','automated_qc_failed',
    'awaiting_human_review','human_review_rejected','approved','submission_failed',
    'provider_failed','provider_cancelled','polling_failed','timed_out','download_failed',
    'validation_failed','archived'
  )),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider_job_id TEXT,
  provider_model TEXT,
  provider_declared_gross_micros INTEGER CHECK (
    provider_declared_gross_micros IS NULL OR provider_declared_gross_micros >= 0
  ),
  refund_status TEXT NOT NULL DEFAULT 'unknown' CHECK (refund_status IN ('unknown','not_applicable','requested','confirmed','denied')),
  refund_confirmed_micros INTEGER NOT NULL DEFAULT 0 CHECK (refund_confirmed_micros >= 0),
  private_asset_key TEXT,
  asset_sha256 TEXT CHECK (asset_sha256 IS NULL OR length(asset_sha256) = 64),
  automated_qc_sha256 TEXT CHECK (automated_qc_sha256 IS NULL OR length(automated_qc_sha256) = 64),
  human_review_sha256 TEXT CHECK (human_review_sha256 IS NULL OR length(human_review_sha256) = 64),
  submission_outcome TEXT CHECK (submission_outcome IS NULL OR submission_outcome IN ('acknowledged','provider_rejected','unknown')),
  error_code TEXT,
  error_detail TEXT,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  submitted_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(factory_job_id, sequence)
);

CREATE TABLE content_factory_cost_ledger (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_factory_runs(id) ON DELETE CASCADE,
  factory_job_id TEXT REFERENCES content_factory_jobs(id) ON DELETE CASCADE,
  attempt_id TEXT REFERENCES content_factory_attempts(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'reservation','reservation_release','provider_gross','refund_confirmed','approved_actual'
  )),
  amount_micros INTEGER NOT NULL CHECK (amount_micros >= 0),
  source_ref TEXT NOT NULL,
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, entry_type, source_ref)
);

CREATE TABLE content_factory_qc_evidence (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_factory_runs(id) ON DELETE CASCADE,
  factory_job_id TEXT REFERENCES content_factory_jobs(id) ON DELETE CASCADE,
  attempt_id TEXT REFERENCES content_factory_attempts(id) ON DELETE CASCADE,
  gate_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed','warning','failed','not_applicable')),
  plan_sha256 TEXT NOT NULL CHECK (length(plan_sha256) = 64),
  asset_sha256 TEXT CHECK (asset_sha256 IS NULL OR length(asset_sha256) = 64),
  evidence_sha256 TEXT NOT NULL CHECK (length(evidence_sha256) = 64),
  evidence_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(attempt_id, gate_id, evidence_sha256)
);

CREATE TABLE content_factory_human_reviews (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES content_factory_runs(id) ON DELETE CASCADE,
  factory_job_id TEXT REFERENCES content_factory_jobs(id) ON DELETE CASCADE,
  attempt_id TEXT REFERENCES content_factory_attempts(id) ON DELETE CASCADE,
  gate_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  reviewer_id TEXT NOT NULL,
  plan_sha256 TEXT NOT NULL CHECK (length(plan_sha256) = 64),
  asset_sha256 TEXT NOT NULL CHECK (length(asset_sha256) = 64),
  automated_qc_sha256 TEXT NOT NULL CHECK (length(automated_qc_sha256) = 64),
  review_sha256 TEXT NOT NULL UNIQUE CHECK (length(review_sha256) = 64),
  notes TEXT,
  reviewed_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(attempt_id, gate_id, review_sha256)
);

CREATE UNIQUE INDEX idx_content_factory_current_attempt
  ON content_factory_attempts(factory_job_id) WHERE is_current = 1;
CREATE INDEX idx_content_factory_runs_state ON content_factory_runs(state, updated_at DESC);
CREATE INDEX idx_content_factory_runs_entity ON content_factory_runs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_content_factory_jobs_run_state ON content_factory_jobs(run_id, state);
CREATE INDEX idx_content_factory_attempts_run_state ON content_factory_attempts(run_id, state, updated_at DESC);
CREATE INDEX idx_content_factory_cost_run ON content_factory_cost_ledger(run_id, entry_type, created_at);
CREATE INDEX idx_content_factory_qc_run ON content_factory_qc_evidence(run_id, status, gate_id);
CREATE INDEX idx_content_factory_reviews_run ON content_factory_human_reviews(run_id, decision, gate_id);

-- A plan fingerprint is an immutable approval boundary. Runtime state can change;
-- source, manifest, estimates, entity and pipeline cannot.
CREATE TRIGGER content_factory_run_plan_immutable
BEFORE UPDATE OF manifest_id, schema_version, revision, entity_type, entity_id,
  planet_slug, series_slug, pipeline_profile, source_sha256, plan_sha256,
  manifest_json, estimate_low_micros, estimate_high_micros,
  estimate_with_contingency_micros, blocker_count, unpriced_job_count
ON content_factory_runs
BEGIN
  SELECT RAISE(ABORT, 'content_factory_plan_is_immutable');
END;

-- Defence in depth: even a future route that forgets the application checks cannot
-- queue paid work without a clear plan, exact spend approval and sufficient ceiling.
CREATE TRIGGER content_factory_paid_dispatch_gate
BEFORE UPDATE OF state ON content_factory_runs
WHEN NEW.state IN ('queued','running') AND (
  OLD.state NOT IN ('approved','queued','running','paused','partially_failed','failed')
  OR NEW.blocker_count <> 0
  OR NEW.unpriced_job_count <> 0
  OR NEW.approved_ceiling_micros IS NULL
  OR NEW.spend_approval_sha256 IS NULL
  OR NEW.approved_ceiling_micros < NEW.estimate_with_contingency_micros
)
BEGIN
  SELECT RAISE(ABORT, 'content_factory_paid_dispatch_not_approved');
END;

-- Approval fields are written together. A partial approval must never look usable.
CREATE TRIGGER content_factory_approval_fields_complete
BEFORE UPDATE OF approved_ceiling_micros, spend_approval_sha256, approved_by, approved_at
ON content_factory_runs
WHEN (
  (NEW.approved_ceiling_micros IS NULL) <> (NEW.spend_approval_sha256 IS NULL)
  OR (NEW.approved_ceiling_micros IS NULL) <> (NEW.approved_by IS NULL)
  OR (NEW.approved_ceiling_micros IS NULL) <> (NEW.approved_at IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'content_factory_approval_fields_incomplete');
END;


-- QC rows are attestations about one immutable attempt, not free-standing notes.
-- Even a future route cannot attach evidence to a different plan or asset.
CREATE TRIGGER content_factory_qc_context_gate
BEFORE INSERT ON content_factory_qc_evidence
WHEN NOT EXISTS (
  SELECT 1
    FROM content_factory_attempts a
    JOIN content_factory_jobs j ON j.id = a.factory_job_id
    JOIN content_factory_runs r ON r.id = a.run_id
   WHERE a.id = NEW.attempt_id
     AND a.run_id = NEW.run_id
     AND a.factory_job_id = NEW.factory_job_id
     AND j.current_attempt_id = a.id
     AND a.is_current = 1
     AND r.plan_sha256 = NEW.plan_sha256
     AND a.asset_sha256 = NEW.asset_sha256
)
BEGIN
  SELECT RAISE(ABORT, 'content_factory_qc_context_mismatch');
END;

-- A human decision is valid only against the current automated-QC fingerprint.
CREATE TRIGGER content_factory_human_review_context_gate
BEFORE INSERT ON content_factory_human_reviews
WHEN NOT EXISTS (
  SELECT 1
    FROM content_factory_attempts a
    JOIN content_factory_jobs j ON j.id = a.factory_job_id
    JOIN content_factory_runs r ON r.id = a.run_id
   WHERE a.id = NEW.attempt_id
     AND a.run_id = NEW.run_id
     AND a.factory_job_id = NEW.factory_job_id
     AND j.current_attempt_id = a.id
     AND a.is_current = 1
     AND r.plan_sha256 = NEW.plan_sha256
     AND a.asset_sha256 = NEW.asset_sha256
     AND a.automated_qc_sha256 = NEW.automated_qc_sha256
)
BEGIN
  SELECT RAISE(ABORT, 'content_factory_human_review_context_mismatch');
END;

-- Downloaded is not approved. A job can become a master only through a current
-- attempt with automated QC and, when the manifest requires it, human review.
CREATE TRIGGER content_factory_job_approval_gate
BEFORE UPDATE OF state ON content_factory_jobs
WHEN NEW.state = 'approved' AND NOT EXISTS (
  SELECT 1
    FROM content_factory_attempts a
    JOIN content_factory_runs r ON r.id = NEW.run_id
   WHERE a.id = NEW.current_attempt_id
     AND a.factory_job_id = NEW.id
     AND a.is_current = 1
     AND a.state = 'approved'
     AND a.asset_sha256 IS NOT NULL
     AND a.automated_qc_sha256 IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM json_each(r.manifest_json, '$.quality.automated_gates') gate
        WHERE json_extract(gate.value, '$.required') = 1
          AND NOT EXISTS (
            SELECT 1 FROM content_factory_qc_evidence qc
             WHERE qc.attempt_id = a.id
               AND qc.gate_id = json_extract(gate.value, '$.gate_id')
               AND qc.status = 'passed'
               AND qc.plan_sha256 = r.plan_sha256
               AND qc.asset_sha256 = a.asset_sha256
          )
     )
     AND (
       NOT EXISTS (
         SELECT 1 FROM json_each(r.manifest_json, '$.quality.human_gates') gate
          WHERE json_extract(gate.value, '$.required') = 1
       )
       OR (
         a.human_review_sha256 IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM json_each(r.manifest_json, '$.quality.human_gates') gate
            WHERE json_extract(gate.value, '$.required') = 1
              AND NOT EXISTS (
                SELECT 1 FROM content_factory_human_reviews review
                 WHERE review.attempt_id = a.id
                   AND review.gate_id = json_extract(gate.value, '$.gate_id')
                   AND review.decision = 'approved'
                   AND review.plan_sha256 = r.plan_sha256
                   AND review.asset_sha256 = a.asset_sha256
                   AND review.automated_qc_sha256 = a.automated_qc_sha256
              )
         )
       )
     )
)
BEGIN
  SELECT RAISE(ABORT, 'content_factory_job_qc_not_approved');
END;

-- Run completion is a projection of approved jobs, never a manual shortcut.
CREATE TRIGGER content_factory_run_completion_gate
BEFORE UPDATE OF state ON content_factory_runs
WHEN NEW.state = 'completed' AND (
  NOT EXISTS (SELECT 1 FROM content_factory_jobs WHERE run_id = NEW.id)
  OR EXISTS (
    SELECT 1 FROM content_factory_jobs WHERE run_id = NEW.id AND state <> 'approved'
  )
)
BEGIN
  SELECT RAISE(ABORT, 'content_factory_run_jobs_not_approved');
END;