-- 0104 — manual payments: mobile wallets and InstaPay, approved by an operator.
--
-- `manual_payment_settings`: one row (`id = 1`). The receiving numbers, the
-- prices per plan and period, and a master switch. Written only through
-- `PUT /admin/billing/manual/settings` (`manage_billing`), read by the app
-- through the authenticated `GET /billing/manual/options`. Starts disabled
-- with no methods, so nothing is shown until an operator fills it in.
--
-- `manual_payment_requests`: one row per transfer a parent reports. The amount
-- and the number of days are copied from the settings at submission, so a
-- later price change does not alter a pending request. Approving it grants a
-- `manual` entitlement in FamilyState (the authority); the row only records
-- who approved what. The optional receipt lives in the private creations
-- bucket under `billing/receipts/`, never behind the CDN.
CREATE TABLE IF NOT EXISTS manual_payment_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  methods_json TEXT NOT NULL DEFAULT '[]',
  prices_json TEXT NOT NULL DEFAULT '{}',
  instructions TEXT NOT NULL DEFAULT '',
  receipt_required INTEGER NOT NULL DEFAULT 0 CHECK (receipt_required IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO manual_payment_settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS manual_payment_requests (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('family', 'family_plus')),
  period TEXT NOT NULL CHECK (period IN ('monthly', 'annual')),
  days INTEGER NOT NULL CHECK (days BETWEEN 1 AND 400),
  amount_egp INTEGER NOT NULL CHECK (amount_egp > 0),
  method_code TEXT NOT NULL,
  sender TEXT NOT NULL,
  reference TEXT,
  receipt_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reject_reason TEXT,
  entitlement_id TEXT,
  starts_at_ms INTEGER,
  expires_at_ms INTEGER,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_status ON manual_payment_requests (status, created_at);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_parent ON manual_payment_requests (parent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_manual_payment_requests_expiry ON manual_payment_requests (status, expires_at_ms);
