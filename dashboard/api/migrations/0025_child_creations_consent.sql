-- 0025 — parental consent for storing child-created images.
--
-- ## Why a new consent type
--
-- `parental_consents.consent_type` allowed exactly:
--   'data_collection' | 'analytics' | 'voice' | 'personalization'
--
-- None of these covers keeping a picture a child drew. `data_collection` is
-- about telemetry the platform gathers; a drawing is content the *child* made,
-- and a parent may reasonably accept the former and refuse the latter. Folding
-- creations into `data_collection` would mean a family that agreed to progress
-- tracking had also, without being asked, agreed to image retention.
--
-- ## Default is off
--
-- No row is inserted for any existing family. Absence of a consent row means no
-- consent, so cloud saving stays unavailable until a parent grants it explicitly.
-- Drawings remain on the device, which is the product default anyway.
--
-- ## Why the table is rebuilt
--
-- SQLite cannot alter a CHECK constraint in place. The table is recreated with
-- the extra value and the rows copied. Verified safe: no route, DO or script in
-- the codebase reads or writes `parental_consents`, and nothing references it by
-- foreign key, so this cannot break a live read path.

CREATE TABLE parental_consents_new (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES children_profiles(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN (
    'data_collection',
    'analytics',
    'voice',
    'personalization',
    -- Storing an image the child drew in private family storage. Covers upload,
    -- retention and parent viewing. Never covers publishing or sharing, because
    -- no such feature exists and none is planned.
    'child_creations'
  )),
  version TEXT NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT,
  ip_address TEXT
);

INSERT INTO parental_consents_new (id, parent_id, child_id, consent_type, version, granted_at, revoked_at, ip_address)
SELECT id, parent_id, child_id, consent_type, version, granted_at, revoked_at, ip_address
  FROM parental_consents;

DROP TABLE parental_consents;

ALTER TABLE parental_consents_new RENAME TO parental_consents;

CREATE INDEX IF NOT EXISTS idx_consents_parent ON parental_consents(parent_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consents_child ON parental_consents(child_id, consent_type);
