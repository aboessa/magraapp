import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { notifyParent, sendPush, wantsPush } from '../src/lib/push.ts';
import { runFamilyNotifications } from '../src/scheduled/notifications.ts';

/// APP-203 — push notifications through FCM.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'majarra-test', client_email: 'sender@majarra-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

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
  db.exec(`
    CREATE TABLE series (id TEXT, title_ar TEXT, status TEXT);
    CREATE TABLE episodes (id TEXT, series_id TEXT, title_ar TEXT, status TEXT, is_published INTEGER, published_at TEXT);
    CREATE TABLE child_watch_time_daily (parent_id TEXT, activity_date TEXT, watched_seconds INTEGER);
    INSERT INTO push_tokens (token, parent_id, platform) VALUES ('token-good-aaaaaaaaaaaaaaaa', 'p1', 'android'), ('token-dead-aaaaaaaaaaaaaaaa', 'p1', 'android');
  `);
  return { db, env: { DB: d1(db), FCM_SERVICE_ACCOUNT_JSON: SERVICE_ACCOUNT } };
}

function fakeFcm() {
  const sends = [];
  const fetcher = async (url, init) => {
    if (String(url).includes('oauth2')) {
      const assertion = new URLSearchParams(init.body).get('assertion');
      assert.equal(assertion.split('.').length, 3, 'a signed JWT');
      return Response.json({ access_token: 'ya29.test', expires_in: 3600 });
    }
    const body = JSON.parse(init.body);
    sends.push(body.message);
    if (body.message.token.startsWith('token-dead')) {
      return new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 });
    }
    return Response.json({ name: 'projects/x/messages/1' });
  };
  return { sends, fetcher };
}

test('a notification reaches every device of the family, once per key', async () => {
  const { db, env } = setup();
  const { sends, fetcher } = fakeFcm();
  const first = await notifyParent(env, 'p1', 'screen_time', 'screen_time:c1:2026-09-29', { title: 't', body: 'b', route: '/parent' }, fetcher);
  assert.equal(first, 1);
  assert.equal(sends.length, 2);
  assert.equal(sends[0].data.route, '/parent');
  // The dead token is removed.
  assert.equal(db.prepare('SELECT COUNT(*) n FROM push_tokens').get().n, 1);
  // The same key again (next heartbeat) sends nothing.
  assert.equal(await notifyParent(env, 'p1', 'screen_time', 'screen_time:c1:2026-09-29', { title: 't', body: 'b' }, fetcher), 0);
  assert.equal(sends.length, 2);
});

test('a kind the parent switched off is not sent', async () => {
  const { db, env } = setup();
  db.prepare("INSERT INTO push_preferences (parent_id, screen_time) VALUES ('p1', 0)").run();
  assert.equal(await wantsPush(env, 'p1', 'screen_time'), false);
  assert.equal(await wantsPush(env, 'p1', 'weekly_report'), true);
  const { sends, fetcher } = fakeFcm();
  assert.equal(await notifyParent(env, 'p1', 'screen_time', 'k', { title: 't', body: 'b' }, fetcher), 0);
  assert.equal(sends.length, 0);
});

test('an unknown route is replaced by home', async () => {
  const { env } = setup();
  const { sends, fetcher } = fakeFcm();
  await sendPush(env, 'token-good-aaaaaaaaaaaaaaaa', { title: 't', body: 'b', route: 'https://evil.example' }, fetcher);
  assert.equal(sends[0].data.route, '/');
});

test('the daily run announces new episodes and, on Friday, the weekly report', async () => {
  const { db, env } = setup();
  const friday = new Date('2026-10-02T16:00:00Z');
  db.exec(`
    INSERT INTO series VALUES ('series-a', 'سلسلة', 'published');
    INSERT INTO episodes VALUES ('e1', 'series-a', 'حلقة', 'published', 1, '2026-10-02 10:00:00');
    INSERT INTO child_watch_time_daily VALUES ('p1', '2026-09-30', 1200);
  `);
  const { sends, fetcher } = fakeFcm();
  const result = await runFamilyNotifications(env, friday, fetcher);
  const titles = sends.map((m) => m.notification.title);
  assert.ok(titles.includes('حلقة جديدة نزلت على مجرة'));
  assert.ok(titles.includes('تقرير الأسبوع جاهز'));
  assert.ok(sends.some((m) => m.notification.body.includes('20 دقيقة')));
  assert.equal(result.families, 1);
  // Running again the same day sends nothing new.
  const again = fakeFcm();
  await runFamilyNotifications(env, friday, again.fetcher);
  assert.equal(again.sends.length, 0);
});

test('without the service account nothing is attempted', async () => {
  const { env } = setup();
  delete env.FCM_SERVICE_ACCOUNT_JSON;
  assert.equal(await notifyParent(env, 'p1', 'screen_time', 'k', { title: 't', body: 'b' }, () => { throw new Error('no'); }), 0);
});

test('televisions are not registered, and preferences need a parent proof', () => {
  const route = readFileSync(new URL('../src/routes/push.ts', import.meta.url), 'utf8');
  assert.match(route, /isTvPlatform\(parsed\.value\.platform\)/);
  assert.match(route, /purpose: 'parent_area'/);
  const index = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  assert.match(index, /cron === NOTIFY_CRON/);
  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  assert.equal((wrangler.match(/"0 16 \* \* \*"/g) ?? []).length, 2);
});
