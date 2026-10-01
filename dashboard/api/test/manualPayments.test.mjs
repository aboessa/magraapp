import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  loadManualSettings, manualExpiry, publicManualOptions, receiptKey, sniffReceiptType, validateManualSettings,
} from '../src/lib/manualPayments.ts';
import { runFamilyNotifications } from '../src/scheduled/notifications.ts';

/// Manual payments (wallets / InstaPay) — migration 0104.

function d1(db) {
  const wrap = (sql, params = []) => ({
    bind: (...next) => wrap(sql, next),
    async first() { return db.prepare(sql).get(...params) ?? null; },
    async all() { return { results: db.prepare(sql).all(...params) }; },
    async run() { const r = db.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; },
  });
  return { prepare: (sql) => wrap(sql) };
}

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0103_push_notifications.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../migrations/0104_manual_payments.sql', import.meta.url), 'utf8'));
  return { db, env: { DB: d1(db) } };
}

const VALID = {
  enabled: true,
  receipt_required: false,
  instructions: 'حوّل المبلغ وابعت رقمك',
  methods: [
    { code: 'vodafone_cash', account: '010 1234 5678', holder: 'مجرة' },
    { code: 'instapay', account: 'Majarra@InstaPay', holder: '' },
    { code: 'orange_cash', account: '01212345678', holder: '', enabled: false },
  ],
  prices: { family: { monthly: 99, annual: 899 }, family_plus: { monthly: null } },
};

test('settings are validated and normalised', () => {
  const ok = validateManualSettings(VALID);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.methods[0].account, '01012345678');
  assert.equal(ok.value.methods[1].account, 'majarra@instapay');
  assert.equal(ok.value.methods[2].enabled, false);
  assert.deepEqual(ok.value.prices.family_plus, { monthly: null, annual: null });

  const bad = (patch) => validateManualSettings({ ...VALID, ...patch });
  assert.equal(bad({ methods: [{ code: 'vodafone_cash', account: '123' }] }).ok, false);
  assert.equal(bad({ methods: [{ code: 'vodafone_cash', account: 'x@instapay' }] }).ok, false, 'an InstaPay address is not a wallet');
  assert.equal(bad({ methods: [{ code: 'paypal', account: '01012345678' }] }).ok, false);
  assert.equal(bad({ prices: { family: { monthly: 9.5 } } }).ok, false);
  assert.equal(bad({ prices: { family: { monthly: 0 } } }).ok, false);
  assert.equal(bad({ extra: 1 }).ok, false);
  assert.equal(bad({ prices: {} }).ok, false, 'cannot switch on without a price');
  assert.equal(validateManualSettings({ ...VALID, enabled: false, prices: {}, methods: [] }).ok, true, 'saving while off is fine');
});

test('a fresh install shows nothing, and the switch hides everything', async () => {
  const { db, env } = setup();
  const fresh = publicManualOptions(await loadManualSettings(env));
  assert.equal(fresh.enabled, false);
  assert.deepEqual(fresh.methods, []);

  const value = validateManualSettings(VALID).value;
  db.prepare('UPDATE manual_payment_settings SET enabled = 1, methods_json = ?, prices_json = ? WHERE id = 1')
    .run(JSON.stringify(value.methods), JSON.stringify(value.prices));
  const on = publicManualOptions(await loadManualSettings(env));
  assert.equal(on.enabled, true);
  assert.deepEqual(on.methods.map((m) => m.code), ['vodafone_cash', 'instapay'], 'disabled methods are not shown');
  assert.deepEqual(on.offers.map((o) => `${o.plan}:${o.period}:${o.amount_egp}:${o.days}`), ['family:monthly:99:30', 'family:annual:899:365']);

  db.prepare('UPDATE manual_payment_settings SET enabled = 0 WHERE id = 1').run();
  const off = publicManualOptions(await loadManualSettings(env));
  assert.equal(off.enabled, false);
  assert.deepEqual(off.offers, []);
});

test('an early renewal is added after the current period', async () => {
  const { db, env } = setup();
  const now = Date.UTC(2026, 9, 1);
  assert.equal(await manualExpiry(env, 'p1', 'family', 30, now), now + 30 * 86_400_000);
  db.prepare(`INSERT INTO manual_payment_requests (id, parent_id, plan, period, days, amount_egp, method_code, sender, status, expires_at_ms)
              VALUES ('a', 'p1', 'family', 'monthly', 30, 99, 'vodafone_cash', '01000000000', 'approved', ?)`).run(now + 10 * 86_400_000);
  assert.equal(await manualExpiry(env, 'p1', 'family', 30, now), now + 40 * 86_400_000);
  // Another plan or another family is not stacked on.
  assert.equal(await manualExpiry(env, 'p1', 'family_plus', 30, now), now + 30 * 86_400_000);
  assert.equal(await manualExpiry(env, 'p2', 'family', 30, now), now + 30 * 86_400_000);
});

test('receipts: only real images, only under the private receipts prefix', () => {
  assert.equal(sniffReceiptType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffReceiptType(new TextEncoder().encode('<svg></svg>')), null);
  assert.equal(receiptKey('parent-1', 'mp-1', 'image/jpeg'), 'billing/receipts/parent-1/mp-1.jpg');
  assert.equal(receiptKey('../x', 'mp-1', 'image/jpeg'), null);
  assert.equal(receiptKey('parent-1', 'mp-1', 'image/svg+xml'), null);
});

test('the parent is reminded before the last paid period ends, once per stage', async () => {
  const { db, env } = setup();
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  env.FCM_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: 'x', client_email: 'x@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  });
  db.exec(`
    CREATE TABLE series (id TEXT, title_ar TEXT, status TEXT);
    CREATE TABLE episodes (id TEXT, series_id TEXT, title_ar TEXT, status TEXT, is_published INTEGER, published_at TEXT);
    CREATE TABLE child_watch_time_daily (parent_id TEXT, activity_date TEXT, watched_seconds INTEGER);
    INSERT INTO push_tokens (token, parent_id, platform) VALUES ('token-a-aaaaaaaaaaaaaaaaaaaa', 'p1', 'android'), ('token-b-aaaaaaaaaaaaaaaaaaaa', 'p2', 'android');
  `);
  const now = new Date('2026-10-01T16:00:00Z'); // Thursday: no weekly report
  const insert = db.prepare(`INSERT INTO manual_payment_requests (id, parent_id, plan, period, days, amount_egp, method_code, sender, status, expires_at_ms)
                             VALUES (?, ?, 'family', 'monthly', 30, 99, 'vodafone_cash', '01000000000', 'approved', ?)`);
  insert.run('p1-old', 'p1', now.getTime() + 2.5 * 86_400_000);
  // p2 already renewed: the older period ending soon must not trigger a reminder.
  insert.run('p2-old', 'p2', now.getTime() + 2 * 86_400_000);
  insert.run('p2-new', 'p2', now.getTime() + 32 * 86_400_000);

  const sends = [];
  const fetcher = async (url, init) => {
    if (String(url).includes('oauth2')) return Response.json({ access_token: 't', expires_in: 3600 });
    sends.push(JSON.parse(init.body).message);
    return Response.json({ name: 'ok' });
  };
  await runFamilyNotifications(env, now, fetcher);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].token, 'token-a-aaaaaaaaaaaaaaaaaaaa');
  assert.equal(sends[0].data.route, '/membership');
  assert.match(sends[0].notification.body, /3 أيام/);

  sends.length = 0;
  await runFamilyNotifications(env, now, fetcher);
  assert.equal(sends.length, 0, 'same stage is not repeated');
  // A parent who turned every preference off still gets it: it is about the account.
  db.prepare("INSERT INTO push_preferences (parent_id, new_episodes, screen_time, weekly_report) VALUES ('p1', 0, 0, 0)").run();
  await runFamilyNotifications(env, new Date(now.getTime() + 1.8 * 86_400_000), fetcher);
  assert.equal(sends.length, 1);
  assert.match(sends[0].notification.title, /بكرة/);
});

test('routes: proof on every parent write, amount from the server, single approval', () => {
  const parentRoute = readFileSync(new URL('../src/routes/manualPayments.ts', import.meta.url), 'utf8');
  for (const path of ["'/requests'", "'/requests/:id/receipt'", "'/requests/:id/cancel'"]) {
    assert.match(parentRoute, new RegExp(`route\\.post\\(${path.replace(/[/:]/g, (m) => `\\${m}`)}, async \\(c\\) => \\{\\n  const who = await parent\\(c, true\\);`));
  }
  assert.doesNotMatch(parentRoute, /amount_egp:\s*text|amount_egp:\s*integer|days:\s*integer/, 'the client never sends the amount or days');
  const admin = readFileSync(new URL('../src/routes/adminBilling.ts', import.meta.url), 'utf8');
  for (const path of ['/billing/manual/settings', '/billing/manual/requests/:id/approve', '/billing/manual/requests/:id/reject', '/billing/manual/requests/:id/receipt']) {
    assert.ok(admin.split('\n').some((line) => line.includes(`'${path}', requirePermission('manage_billing')`)), path);
  }
  const approve = admin.slice(admin.indexOf("'/billing/manual/requests/:id/approve'"));
  assert.ok(approve.indexOf("WHERE id = ? AND status = 'pending'") < approve.indexOf("'/entitlements/apply'"), 'claim before grant');
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.ok(index.indexOf("app.route('/api/v1/billing/manual'") < index.indexOf("app.route('/api/v1/billing', billingRoute)"));
});
