-- Refunds — financial refund records linked to original billing transactions
-- Previously: no refund data existed (audit noted "no refund data exists in any source")
-- Now: separate table with amount, reason, channel, original transaction linkage

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  parent_id TEXT NOT NULL,
  original_transaction_id TEXT,
  original_purchase_id TEXT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('requested_by_customer','duplicate_charge','fraud','service_issue','other')),
  reason_details TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('google_play','app_store','stripe','manual','bank_transfer')) DEFAULT 'manual',
  status TEXT NOT NULL CHECK (status IN ('pending','processing','completed','failed','cancelled')) DEFAULT 'pending',
  provider_refund_id TEXT,
  refunded_at TEXT,
  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_refunds_parent ON refunds(parent_id, status);
CREATE INDEX IF NOT EXISTS idx_refunds_original_tx ON refunds(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status, created_at);
CREATE INDEX IF NOT EXISTS idx_refunds_currency ON refunds(currency);

-- Extend audit trail for refunds
-- No seed data — honest empty state, not invented numbers
