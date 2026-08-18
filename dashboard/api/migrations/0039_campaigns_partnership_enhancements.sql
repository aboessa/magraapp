-- Campaigns & Partnership enhancements: real operating models without fake push

PRAGMA foreign_keys = ON;

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','website_banner','email')),
  audience_json TEXT NOT NULL DEFAULT '{}',
  creative_json TEXT NOT NULL DEFAULT '{}',
  deep_link TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','scheduled','sending','completed','paused','cancelled','failed')),
  scheduled_at TEXT,
  sent_at TEXT,
  eligible_count INTEGER,
  sent_count INTEGER,
  delivered_count INTEGER,
  opened_count INTEGER,
  clicked_count INTEGER,
  owner_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE campaign_delivery_log (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','sent','delivered','opened','clicked','failed')),
  recipient_family_id TEXT,
  recipient_count INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_campaigns_status_scheduled ON campaigns(status, scheduled_at);
CREATE INDEX idx_campaign_delivery_campaign ON campaign_delivery_log(campaign_id, created_at);

-- Partnership enhancements: add lead pipeline fields if missing
ALTER TABLE partnership_requests ADD COLUMN owner_id TEXT;
ALTER TABLE partnership_requests ADD COLUMN team_id TEXT;
ALTER TABLE partnership_requests ADD COLUMN priority TEXT CHECK (priority IN ('low','normal','high','urgent'));
ALTER TABLE partnership_requests ADD COLUMN next_action TEXT;
ALTER TABLE partnership_requests ADD COLUMN due_at TEXT;

CREATE TABLE partnership_notes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES partnership_requests(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 1,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE partnership_tasks (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES partnership_requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee_id TEXT,
  team_id TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_partnership_notes_request ON partnership_notes(request_id, created_at);
CREATE INDEX idx_partnership_tasks_request ON partnership_tasks(request_id, status);
