-- Support CRM: tickets, timeline, tags, SLA policies and saved views.
--
-- ## Why this is a new set of tables and not a widening of something existing
--
-- The support surface before this migration was a single audited *lookup*: an
-- operator typed a family id and read a deliberately narrow projection. That is a
-- useful screen and it is not a CRM. Nothing recorded that a conversation happened,
-- what was promised, who owns it, when it is due, or what was done — so the same
-- question arriving twice was answered twice from scratch, and no one could say how
-- long the second answer took.
--
-- `tasks` (migration 0014) was considered as the home for this and rejected. A task
-- is internal work with an assignee and a due date; a ticket additionally has a
-- *counterparty*, a first-response clock that is distinct from its resolution clock,
-- a category that drives both, and a timeline that must survive reassignment. Forcing
-- those onto `tasks` would have meant six nullable columns that mean nothing for a
-- content task, and a `content_type` of `'support'` pretending a family is content.
--
-- ## What is deliberately absent
--
-- **Customer messaging.** No table here stores an outbound message, because none is
-- sent. Sending one needs the parent's email address, which is deliberately not in
-- any D1 projection (`family_projection` carries no address, and `lib/auditLog.ts`
-- redacts one if it ever appears). A `messages` table with no transport is exactly
-- the kind of shell that makes an operator believe a customer was told something.
-- Notes are internal, and `support_ticket_events.is_internal` exists to make that
-- explicit rather than implied.
--
-- **Operational actions as data only.** `kind = 'action'` records what an operator
-- did, and the route only accepts actions whose capability actually exists today.
-- Device revoke is not one of them: `do/FamilyState.ts` checks a parent session on
-- its revoke path, so no operator can perform it, and offering it here would be a
-- control that always fails.

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  -- Short human reference. Operators read ids aloud and type them from notes; a UUID
  -- is unusable for that, and using the UUID prefix would collide often enough to be
  -- worse than useless.
  reference TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  -- What the operator recorded when opening the ticket. Not a customer message: see
  -- the note above.
  body TEXT,

  category TEXT NOT NULL CHECK (category IN (
    'billing', 'subscription', 'playback', 'downloads', 'account',
    'device', 'child_profile', 'content', 'privacy', 'bug', 'other'
  )),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  -- `waiting_customer` stops the resolution clock in reports without closing the
  -- ticket, which is the difference between "we are slow" and "we are waiting".
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'
  )),

  -- Links. No foreign keys: `family_projection` is queue-fed and can legitimately lag
  -- behind a ticket about an account that was created seconds ago, and a FK would
  -- refuse the ticket at exactly the moment it is most needed.
  family_id TEXT,
  subscription_ref TEXT,
  purchase_ref TEXT,
  device_id TEXT,

  assignee_id TEXT REFERENCES admin_users(id),
  team_id TEXT REFERENCES teams(id),

  -- Two clocks, not one. A ticket answered in ten minutes and resolved in three days
  -- is a good support experience; a ticket resolved in three days with no reply for
  -- two of them is not, and a single "resolution SLA" cannot tell them apart.
  first_response_due_at TEXT,
  resolution_due_at TEXT,
  first_response_at TEXT,
  resolved_at TEXT,
  closed_at TEXT,
  escalated_at TEXT,
  escalation_reason TEXT,

  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The three questions asked daily: what is open, what is mine, what is late.
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status, priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON support_tickets (assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_family ON support_tickets (family_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_due ON support_tickets (resolution_due_at, status);

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'note', 'status_change', 'assignment', 'priority_change', 'escalation', 'action', 'link'
  )),
  body TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  actor_id TEXT REFERENCES admin_users(id),
  -- Every event is internal today, because there is no customer-facing channel. The
  -- column exists so that when one arrives, an internal note cannot be mistaken for
  -- something the customer saw — a distinction that is impossible to reconstruct
  -- afterwards.
  is_internal INTEGER NOT NULL DEFAULT 1 CHECK (is_internal IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_events_ticket ON support_ticket_events (ticket_id, created_at);

-- Tags as rows rather than a JSON column, so "every refund ticket this month" is an
-- index lookup instead of a LIKE over serialised text.
CREATE TABLE IF NOT EXISTS support_ticket_tags (
  ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (ticket_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_support_tags_tag ON support_ticket_tags (tag);

-- SLA policy, resolved most-specific-first: (category, priority) then ('any',
-- priority). Stored rather than hard-coded because these are commitments that change
-- without a deploy, and a commitment living in code is one nobody outside
-- engineering can read.
CREATE TABLE IF NOT EXISTS support_sla_policies (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  first_response_minutes INTEGER NOT NULL CHECK (first_response_minutes > 0),
  resolution_minutes INTEGER NOT NULL CHECK (resolution_minutes > 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (category, priority)
);

CREATE TABLE IF NOT EXISTS support_saved_views (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES admin_users(id),
  name TEXT NOT NULL,
  filters_json TEXT NOT NULL DEFAULT '{}',
  -- A shared view is visible to everyone; a private one only to its owner. Without
  -- the distinction, either every operator's experiment pollutes the team's list or
  -- nobody can share the one filter the team actually works from.
  is_shared INTEGER NOT NULL DEFAULT 0 CHECK (is_shared IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_views_owner ON support_saved_views (owner_id, is_shared);

-- Baseline policy, one row per priority, category-agnostic.
--
-- The numbers are the conventional shape (the more urgent, the faster the first
-- reply, with resolution allowed to take longer than the reply) and are seeded so the
-- feature is usable on day one. They are editable data, not a claim about a
-- contractual commitment nobody has signed.
INSERT OR IGNORE INTO support_sla_policies
  (id, category, priority, first_response_minutes, resolution_minutes) VALUES
('sla-any-urgent', 'any', 'urgent', 30, 240),
('sla-any-high', 'any', 'high', 120, 1440),
('sla-any-normal', 'any', 'normal', 480, 4320),
('sla-any-low', 'any', 'low', 1440, 10080),
-- Billing and privacy are tightened deliberately: a family that has been charged and
-- cannot watch, and a data-deletion request, are the two categories where delay has a
-- cost beyond annoyance.
('sla-billing-normal', 'billing', 'normal', 240, 1440),
('sla-privacy-normal', 'privacy', 'normal', 240, 1440),
('sla-privacy-high', 'privacy', 'high', 60, 720);
