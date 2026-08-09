-- Territory / availability policy for catalogue content.
--
-- ## Why this is not `content_rights`
--
-- `content_rights` (migration 0001) records *what a contract says*: owner,
-- territories, licences, expiry, contract URL. It is a registry, and the audit of
-- 2026-08-09 confirmed the consequence: nothing consulted it. A row saying
-- "licensed for SA and AE only" did not stop the catalogue, search, the home
-- builder or playback from serving that series to a child in France.
--
-- Making `content_rights` itself the enforcement source was rejected for three
-- reasons:
--
--  1. It is keyed `UNIQUE (entity_type, entity_id, owner)`, so an entity has one
--     row *per rights holder*. Availability is a single effective answer, and
--     deriving it by intersecting several contracts silently is exactly the kind
--     of hidden computation that makes a wrong answer impossible to explain to a
--     lawyer.
--  2. Not every restriction is contractual. Content can be withheld for
--     commercial reasons (a launch window), editorial reasons (a seasonal story
--     out of season) or legal reasons unrelated to a licence. Recording those as
--     fake licences corrupts the rights registry.
--  3. `content_rights.territories` has no mode. "['SA','AE']" cannot express
--     "everywhere except SA", which is a normal shape for a distribution deal.
--
-- So this table holds the *decision*, with an explicit mode and an explicit
-- reason, and `content_rights` stays the record of the contract behind it. The
-- publish gate already blocks on an expired `content_rights.expiry`; this governs
-- who can see what while it is live.
--
-- ## Inheritance
--
-- One row per entity at most (`UNIQUE (entity_type, entity_id)`), and resolution
-- walks outward: episode → season → series → planet → global. The nearest row
-- wins outright rather than being intersected with its ancestors, because an
-- override that cannot loosen is not an override: a series restricted for a
-- licence may legitimately contain one episode released worldwide as a trailer,
-- and an operator who sets that must see it take effect.
--
-- `entity_type = 'global'` with `entity_id = 'global'` is the platform default,
-- and no row at all means available — the alternative, defaulting the whole
-- catalogue to unavailable, would hide every existing row the moment this
-- migration ran.

CREATE TABLE IF NOT EXISTS content_availability (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'global', 'planet', 'series', 'season', 'episode', 'story', 'book', 'game', 'project'
  )),
  entity_id TEXT NOT NULL,

  -- worldwide        : available everywhere
  -- worldwide_except : available everywhere except `countries`
  -- selected_only    : available only in `countries`
  -- unavailable      : withheld everywhere, whatever `countries` says
  mode TEXT NOT NULL CHECK (mode IN ('worldwide', 'worldwide_except', 'selected_only', 'unavailable')),

  -- ISO 3166-1 alpha-2, upper case, as a JSON array. Cloudflare reports request
  -- country in exactly that form (`request.cf.country`), so storing it any other
  -- way would mean normalising on every request.
  countries TEXT NOT NULL DEFAULT '[]',
  -- Optional narrowing. Empty array means "no restriction on this axis", which is
  -- different from a list containing every value and is why absence is not
  -- modelled as NULL.
  languages TEXT NOT NULL DEFAULT '[]',
  platforms TEXT NOT NULL DEFAULT '[]',

  -- Availability window, independent of the licence window in content_rights: a
  -- launch date is a commercial decision that can move without the contract
  -- changing.
  starts_at TEXT,
  ends_at TEXT,

  -- Why the restriction exists. Not decoration: "unavailable in FR" is actionable
  -- for a rights manager and noise for an editor, and the reverse for an editorial
  -- hold. It also decides who is asked when the restriction is questioned.
  reason TEXT NOT NULL CHECK (reason IN ('rights', 'commercial', 'editorial', 'legal')),
  note TEXT,

  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entity_type, entity_id)
);

-- Resolution reads by (entity_type, entity_id) for up to five ancestors on every
-- request, so the lookup must be an index hit rather than a scan.
CREATE INDEX IF NOT EXISTS idx_content_availability_entity
  ON content_availability (entity_type, entity_id);

-- The platform default, stated explicitly.
--
-- Seeded as `worldwide` rather than left absent so the admin surface has a row to
-- show and edit from day one, and so "why is this available?" has an answer that
-- names a policy instead of "because nothing said otherwise".
INSERT OR IGNORE INTO content_availability
  (id, entity_type, entity_id, mode, reason, note)
VALUES
  ('availability-global', 'global', 'global', 'worldwide', 'commercial',
   'الافتراضي للمنصة: متاح عالميًا ما لم يُقيَّد على مستوى الكوكب أو السلسلة أو العنصر.');
