-- Failed family events were acknowledged and dropped.
--
-- queue/dlq.ts logged each message to the console and then called `msg.ack()`.
-- An ack tells the queue the message is handled, so it is removed. Nothing was
-- written to D1, which means a family event that failed every retry left no
-- trace beyond a log line that ages out. The projection for that family stays
-- permanently behind with no way to notice or repair it.
--
-- The comment there promised recovery via `/admin/family-projection/reconcile`.
-- That route does not exist anywhere in the codebase, so the documented path
-- back was fiction.
--
-- This table is the durable record. The DLQ still acks — retrying inside the
-- dead-letter consumer would loop the same failure — but the payload survives,
-- so it can be inspected and replayed.
CREATE TABLE IF NOT EXISTS failed_family_events (
  -- Not the event id: a malformed message may have none, and the same event id
  -- can legitimately arrive twice after separate delivery attempts.
  id TEXT PRIMARY KEY,
  -- Nullable because an unparseable body has no recoverable identity. Recording
  -- the failure with null fields is more useful than discarding it.
  event_id TEXT,
  event_type TEXT,
  parent_id TEXT,
  occurred_at_ms INTEGER,
  -- The raw body, so replay does not depend on this table having parsed it
  -- correctly at capture time.
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  failed_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- 'pending' until somebody acts on it. 'replayed' once reprocessed
  -- successfully, 'discarded' when judged unrecoverable.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'replayed', 'discarded')),
  resolved_at TEXT,
  resolved_by TEXT,
  resolution_note TEXT
);

-- The operator question is "what is still broken", so the pending set is the
-- one that must stay fast as the table grows.
CREATE INDEX IF NOT EXISTS idx_failed_family_events_pending
  ON failed_family_events(status, failed_at DESC);

-- "Is this family's projection stale?" during a support conversation.
CREATE INDEX IF NOT EXISTS idx_failed_family_events_parent
  ON failed_family_events(parent_id);
