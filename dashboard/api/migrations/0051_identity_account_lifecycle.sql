-- Canonical identity locator and account-lifecycle projection.
--
-- Email addresses remain inside IdentityState. `email_hash` is a versioned,
-- domain-separated HMAC and `identity_name` is an authenticated-encryption
-- envelope for the historical Durable Object name. Neither value can be
-- matched against candidate email addresses from a leaked D1 copy without the
-- server-side auth secret. Column names are retained for migration compatibility.
PRAGMA foreign_keys = ON;

CREATE TABLE identity_directory (
  parent_id TEXT PRIMARY KEY,
  email_hash TEXT NOT NULL UNIQUE,
  identity_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deletion_pending', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_identity_directory_email
  ON identity_directory(email_hash, status);

-- Operational projection only. FamilyState remains the coordinator and source
-- of truth; this row lets support see whether a retryable deletion is pending
-- without exposing credentials, child data, or deletion receipts.
CREATE TABLE account_lifecycle_projection (
  request_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('child', 'account')),
  child_id TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  requested_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  last_error_code TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_account_lifecycle_parent
  ON account_lifecycle_projection(parent_id, requested_at_ms DESC);

-- Terminal projection watermarks. Deletion is irreversible: delayed queue
-- delivery must never let an older initialization/update recreate family or
-- child PII after its tombstone has been applied.
CREATE TABLE family_deletion_watermarks (
  parent_id TEXT PRIMARY KEY,
  deleted_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE child_deletion_watermarks (
  child_id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  deleted_at_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_child_deletion_watermarks_parent
  ON child_deletion_watermarks(parent_id, deleted_at_ms);
