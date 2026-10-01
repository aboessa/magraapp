-- 0099 — first-party crash reports (`OPS-202`).
--
-- One row per report from the app's single error funnel (`CrashReporter`).
-- Written only by `routes/crashIngest.ts`, read only by `routes/adminAppHealth.ts`.
--
-- Deliberately no error message and no free text: messages routinely carry
-- request payloads and, in a children's app, names. A report is the error's
-- *type*, app stack frames (file:line only), and the surface context. The
-- fingerprint (SHA-256 of type + top frames) groups identical crashes.
--
-- Retention: the ingest route deletes rows older than 30 days opportunistically.

CREATE TABLE IF NOT EXISTS app_crash_reports (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  error_type TEXT NOT NULL,
  frames_json TEXT NOT NULL,
  context TEXT,
  fatal INTEGER NOT NULL DEFAULT 0 CHECK (fatal IN (0, 1)),
  app_version TEXT,
  platform TEXT,
  device_kind TEXT,
  parent_id TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_app_crash_reports_created ON app_crash_reports (created_at);
CREATE INDEX IF NOT EXISTS idx_app_crash_reports_fingerprint ON app_crash_reports (fingerprint, created_at);
