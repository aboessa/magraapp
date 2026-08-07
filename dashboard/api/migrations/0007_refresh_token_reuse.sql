-- Preserve digests of rotated refresh tokens so reuse can revoke the session.
-- Raw refresh tokens are never stored.
CREATE TABLE used_refresh_tokens (
  token_hash TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES parent_auth_sessions(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_used_refresh_tokens_session ON used_refresh_tokens(session_id, expires_at);
