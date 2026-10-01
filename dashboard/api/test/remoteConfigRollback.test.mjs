import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

/// ADM-308 — remote-config changes record the value they replace, and can be
/// rolled back to it. Runs the real route against an in-memory SQLite D1.

function d1(db) {
  const wrap = (sql, params = []) => ({
    sql, params,
    bind: (...next) => wrap(sql, next),
    async first() { return db.prepare(sql).get(...params) ?? null; },
    async all() { return { results: db.prepare(sql).all(...params) }; },
    async run() { db.prepare(sql).run(...params); return { meta: { changes: 1 } }; },
  });
  return {
    prepare: (sql) => wrap(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try { for (const s of statements) db.prepare(s.sql).run(...s.params); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

function setup() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE remote_config (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, rollout_percent INTEGER NOT NULL DEFAULT 100, targeting_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT);
    CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, details TEXT DEFAULT '{}', created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f','now')));
    INSERT INTO remote_config (key, value_json) VALUES ('min_app_version', '"0.1.0"');
    CREATE TABLE admin_credentials (id TEXT);
    CREATE TABLE admin_sessions (id TEXT, token_hash TEXT, admin_id TEXT, expires_at TEXT, revoked_at TEXT);
  `);
  return { db, env: { DB: d1(db) } };
}

async function call(env, method, path, body) {
  // The real worker, as `homeBuilderE2E.test.mjs` does: development with no
  // admin credentials seeded admits the request, so the real guards run.
  const { default: worker } = await import('../src/index.ts');
  const res = await worker.fetch(new Request(`https://api.majarra.app/api/v1/admin${path}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }), { ENVIRONMENT: 'development', API_VERSION: 'v1', CACHE: { async get() { return null; }, async put() {} }, ...env },
  { waitUntil() {}, passThroughOnException() {} });
  return { status: res.status, body: await res.json().catch(() => null) };
}
test('a change records the value it replaced, and rolls back to it', async () => {
  const { db, env } = setup();
  const put = await call(env, 'PUT', '/remote-config/min_app_version', { value: '0.2.0', reason: 'release' });
  assert.equal(put.status, 200);

  const history = await call(env, 'GET', '/remote-config/history?key=min_app_version');
  const [changeRow] = history.body.data;
  assert.equal(changeRow.restorable, true);
  assert.equal(changeRow.before.value, '0.1.0');
  assert.equal(changeRow.after.value, '0.2.0');
  assert.equal(changeRow.reason, 'release');

  const refused = await call(env, 'POST', '/remote-config/min_app_version/rollback', { change_id: changeRow.id });
  assert.equal(refused.status, 400, 'a reason is required');

  const rolled = await call(env, 'POST', '/remote-config/min_app_version/rollback', { change_id: changeRow.id, reason: 'broke old phones' });
  assert.equal(rolled.status, 200);
  assert.equal(db.prepare('SELECT value_json FROM remote_config WHERE key = ?').get('min_app_version').value_json, '"0.1.0"');

  // The rollback is itself a change that can be undone.
  const after = await call(env, 'GET', '/remote-config/history?key=min_app_version');
  assert.equal(after.body.data[0].action, 'rollback');
  assert.equal(after.body.data[0].before.value, '0.2.0');
});

test('an old change without the previous value is not restorable', async () => {
  const { db, env } = setup();
  db.prepare(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES ('old', 'x', 'update', 'remote_config', 'min_app_version', '{"value":"0.0.9","rollout_percent":100}')`).run();
  const res = await call(env, 'POST', '/remote-config/min_app_version/rollback', { change_id: 'old', reason: 'try' });
  assert.equal(res.status, 400);
  const history = await call(env, 'GET', '/remote-config/history');
  assert.equal(history.body.data[0].restorable, false);
});

test('a change id from another key is refused', async () => {
  const { db, env } = setup();
  db.prepare(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES ('other', 'x', 'update', 'remote_config', 'offline_enabled', '{"format":"remote_config_v2","before":{"value":true,"rollout_percent":100,"targeting":{}}}')`).run();
  const res = await call(env, 'POST', '/remote-config/min_app_version/rollback', { change_id: 'other', reason: 'try it' });
  assert.equal(res.status, 404);
});
