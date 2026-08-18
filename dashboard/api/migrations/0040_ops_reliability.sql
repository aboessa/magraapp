-- Operations Reliability: Service Registry, Alerts, Incidents, SLA, Telemetry capability
PRAGMA foreign_keys = ON;

-- Service Registry (operational services, not content)
CREATE TABLE IF NOT EXISTS ops_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('critical','high','medium','low')),
  description TEXT,
  dependencies TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Health checks (periodic, not per-request fan-out)
CREATE TABLE IF NOT EXISTS ops_health_checks (
  id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES ops_services(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('healthy','degraded','partial_outage','outage','unknown')),
  latency_ms INTEGER,
  error_rate REAL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  details TEXT
);

CREATE INDEX IF NOT EXISTS idx_ops_health_service ON ops_health_checks(service_id, checked_at DESC);

-- Alerts (from health evaluation, deduplicated by fingerprint)
CREATE TABLE IF NOT EXISTS ops_alerts (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  service_id TEXT REFERENCES ops_services(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low','info')),
  condition_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  acknowledged_at TEXT,
  acknowledged_by TEXT,
  resolved_at TEXT,
  incident_id TEXT REFERENCES ops_incidents(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_status ON ops_alerts(status, severity, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_fingerprint ON ops_alerts(fingerprint, status);

-- Incidents (lightweight, not auto-created)
CREATE TABLE IF NOT EXISTS ops_incidents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','identified','monitoring','resolved')),
  affected_services TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  detected_at TEXT,
  resolved_at TEXT,
  owner_id TEXT,
  impact TEXT,
  resolution TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_status ON ops_incidents(status, started_at DESC);

CREATE TABLE IF NOT EXISTS ops_incident_timeline (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES ops_incidents(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('note','alert','failed_event','change','status')),
  body TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- SLA policies (per domain, not universal timer)
CREATE TABLE IF NOT EXISTS sla_policies (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('support','content_review','workflow','production','queue','incident')),
  name TEXT NOT NULL,
  applies_to TEXT, -- e.g. priority high, review_type edu
  priority TEXT,
  first_response_minutes INTEGER,
  resolution_minutes INTEGER,
  business_calendar TEXT, -- JSON: {timezone, working_days, holidays}
  pause_condition TEXT, -- e.g. waiting_customer for support
  escalation_rules TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sla_policies_domain ON sla_policies(domain, is_active);

CREATE TABLE IF NOT EXISTS sla_escalation_log (
  id TEXT PRIMARY KEY,
  policy_id TEXT REFERENCES sla_policies(id) ON DELETE SET NULL,
  work_item_id TEXT NOT NULL,
  rule_index INTEGER NOT NULL,
  triggered_at TEXT NOT NULL DEFAULT (datetime('now')),
  action TEXT NOT NULL,
  target TEXT,
  outcome TEXT
);

-- Telemetry capability matrix (what we can measure vs not)
CREATE TABLE IF NOT EXISTS telemetry_sources (
  id TEXT PRIMARY KEY,
  signal TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','unavailable','degraded')),
  last_data_at TEXT,
  retention TEXT,
  required_for TEXT
);

-- Queue operations view (metadata, not live Cloudflare Queue API)
CREATE TABLE IF NOT EXISTS queue_health (
  queue_name TEXT PRIMARY KEY,
  pending INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  oldest_age_seconds INTEGER,
  last_success_at TEXT,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy','degraded','unknown')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed service registry with real operational services
INSERT OR IGNORE INTO ops_services (id, name, tier, description, dependencies) VALUES
  ('admin_api','Admin API','critical','Dashboard admin API (D1, auth, content)','["D1","FamilyState"]'),
  ('public_api','Public API','critical','Public content + family routes','["D1","R2"]'),
  ('website_renderer','Website renderer','high','Public site SSR (majarra.app)','["D1","CACHE"]'),
  ('d1','D1','critical','Primary database','[]'),
  ('r2_media','R2 media','high','Media buckets (media/thumbs/creations)','[]'),
  ('cdn','CDN','high','cdn.majarra.app','["R2"]'),
  ('queue_family_events','Queue family_events','high','Family outbox → D1 projections','["D1"]'),
  ('familystate','FamilyState','critical','Durable Object family authority','[]'),
  ('queue_dlq','Queue DLQ','medium','Dead-letter storage (failed_family_events)','["D1"]'),
  ('support_crm','Support CRM','medium','Tickets + SLA','["D1"]'),
  ('workflow_engine','Workflow engine','medium','Runs + stages + SLA','["D1"]'),
  ('production_center','Production Center','medium','Requirements + assignments','["D1"]');

-- Seed SLA policies (preserve support dual clocks)
INSERT OR IGNORE INTO sla_policies (id, domain, name, applies_to, priority, first_response_minutes, resolution_minutes, pause_condition, escalation_rules) VALUES
  ('support-high','support','Support high priority','priority=high','high',60,1440,'waiting_customer','[{"at":"75%","action":"notify_team"},{"at":"breach","action":"escalate_team"}]'),
  ('support-normal','support','Support normal','priority=normal','normal',240,2880,'waiting_customer','[{"at":"breach","action":"escalate"}]'),
  ('review-edu','content_review','Edu review','review_type=edu',NULL,1440,4320,NULL,'[{"at":"breach","action":"notify_reviewer"}]'),
  ('workflow-default','workflow','Workflow stage','',NULL,720,4320,NULL,'[{"at":"breach","action":"escalate"}]'),
  ('queue-family','queue','Queue family_events','queue=family_events',NULL,NULL,30,NULL,'[{"at":"breach","action":"alert_ops"}]'),
  ('incident-critical','incident','Incident critical','severity=critical','critical',15,240,NULL,'[{"at":"75%","action":"page_owner"}]');

-- Seed telemetry capability
INSERT OR IGNORE INTO telemetry_sources (id, signal, source, status, required_for) VALUES
  ('http_health','HTTP health checks','Worker fetch','available','API/Workers health'),
  ('d1_query','D1 status','D1 query','available','DB health'),
  ('queue_backlog','Queue backlog','D1 failed_family_events + queue_health','available','Queue health'),
  ('family_probe','FamilyState probe','DO fetch /admin/inspect','available','FamilyState health'),
  ('cdn_probe','CDN probe','fetch cdn.majarra.app','available','CDN health'),
  ('latency','API latency p50/p95/p99','Analytics Engine','unavailable','Latency'),
  ('error_rate','Error rate 4xx/5xx','Analytics Engine','unavailable','Error rate'),
  ('analytics_telemetry','Analytics telemetry','Analytics Engine','unavailable','Full observability');

-- Seed queue health
INSERT OR IGNORE INTO queue_health (queue_name, pending, failed, status) VALUES
  ('family_events',0,0,'healthy'),
  ('family_events-dlq',0,0,'unknown');
