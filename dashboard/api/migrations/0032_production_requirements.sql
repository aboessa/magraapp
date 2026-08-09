-- Production requirements: the human layer only.
--
-- ## Why there is no status column here
--
-- Every requirement's *state* — script written, artwork ready, video processed, QA
-- approved — is derived on read from the artefacts themselves (`lib/productionMatrix
-- .ts`). This table stores what cannot be derived: who owns a requirement, when it is
-- due, what is blocking them, and any note.
--
-- A stored status was considered and rejected. It drifts from reality the moment an
-- asset is replaced, archived or never uploaded, and a board reading `ARTWORK: done`
-- over an episode with no artwork is worse than no board at all — people stop trusting
-- it and go back to asking in chat. This dashboard has already shipped that failure:
-- pages showing invented completion figures were removed in an earlier session
-- precisely because nobody could tell which numbers were real.
--
-- `blocker` is the one field that influences the displayed state, and only in one
-- direction: a recorded blocker can turn `in_progress` into `blocked`, and can never
-- turn `ready` into anything else. A person saying they are stuck is information the
-- artefacts do not carry; a stale blocker note hiding a finished asset is the same lie
-- in reverse.
--
-- No foreign key on `content_id`: the same table serves episodes and stories, and a
-- polymorphic reference cannot be enforced by SQLite. `content_type` is constrained
-- instead, so a typo cannot create rows nothing will ever read.

CREATE TABLE IF NOT EXISTS production_requirements (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('episode', 'story')),
  content_id TEXT NOT NULL,
  -- Matches PRODUCTION_REQUIREMENTS in lib/productionMatrix.ts. Not a CHECK list,
  -- because the derived set grows with the pipeline and a migration per new
  -- requirement would make the lib and the schema drift; the route validates against
  -- the lib, which is the single definition.
  requirement TEXT NOT NULL,

  assignee_id TEXT REFERENCES admin_users(id),
  team_id TEXT REFERENCES teams(id),
  due_at TEXT,
  -- Free text, deliberately: "waiting for the voice studio to re-record page 4" is the
  -- useful form, and an enum of blocker types would force that into "other".
  blocker TEXT,
  note TEXT,

  updated_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (content_type, content_id, requirement)
);

-- "What is assigned to me" and "what is overdue" are the two queries the board runs.
CREATE INDEX IF NOT EXISTS idx_production_requirements_content
  ON production_requirements (content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_production_requirements_assignee
  ON production_requirements (assignee_id);
CREATE INDEX IF NOT EXISTS idx_production_requirements_due
  ON production_requirements (due_at);
