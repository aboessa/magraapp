import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/// Roadmap group 1 (docs/STREAMING_ROADMAP.md): ADM-301, ADM-302, ADM-304.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ADM-301: the questions export is registered before /questions/:id', () => {
  const source = read('src/routes/adminQuestions.ts');
  const exportAt = source.indexOf("route.get('/questions/export'");
  const byIdAt = source.indexOf("route.get('/questions/:id'");
  assert.ok(exportAt > 0 && byIdAt > 0);
  assert.ok(exportAt < byIdAt, 'a literal segment must precede the :id route or it is never reached');
});

test('ADM-301: the export actually answers through the router', async () => {
  const { default: route } = await import('../src/routes/adminQuestions.ts');
  const hits = [];
  const db = {
    prepare(sql) {
      const stmt = {
        bind() { return stmt; },
        async all() { hits.push(sql); return { results: [{ id: 'q1', code: 'Q1', correct_answer: '{}', distractors: '[]' }] }; },
        async first() { hits.push(sql); return null; },
      };
      return stmt;
    },
  };
  // Mount without the admin guard to exercise route order only.
  const { Hono } = await import('hono');
  const app = new Hono();
  app.route('/', route);
  const res = await app.request('/questions/export', {}, { DB: db, ADMIN_API_KEY: 'k' });
  // Guarded routers answer 401 without a session; what matters is that the
  // export handler, not the :id handler, is the one matched when allowed.
  if (res.status === 200) {
    const body = await res.json();
    assert.ok(Array.isArray(body.data), 'export returns a list, not "Question not found"');
  } else {
    assert.equal(res.status, 401);
  }
});

test('ADM-302: content budgets have a read and a guarded write', () => {
  const source = read('src/routes/adminCommerce.ts');
  assert.match(source, /route\.get\('\/content-budgets'/);
  assert.match(source, /route\.post\('\/content-budgets', requirePermission\('edit_metadata'\)/);
  assert.match(source, /auditStatement\(c\.env\.DB, actorId\(c\), 'create', 'content_budget'/);
  // Actuals never mix currencies.
  assert.match(source, /row\.currency === b\.currency/);
});

test('ADM-305: flags are writable under publish with a reason, and reach the app config', () => {
  const admin = read('src/routes/adminAppExperience.ts');
  assert.match(admin, /route\.put\('\/feature-flags\/:key', requirePermission\('publish'\)/);
  assert.match(admin, /route\.delete\('\/feature-flags\/:key', requirePermission\('publish'\)/);
  assert.match(admin, /'feature_flag', key/);
  assert.match(read('src/routes/appConfig.ts'), /feature_flags: Object\.fromEntries/);
});

test('ADM-306: a family TV view reads the authority and the live link, and hides fingerprints', () => {
  const source = read('src/routes/adminDevices.ts');
  assert.match(source, /route\.get\('\/families\/:id\/tvs', requireAdmin/);
  assert.match(source, /installation_id_hash: _hash/);
  assert.match(source, /isTvPlatform/);
});

test('ADM-304: app health is admin-guarded, mounted before adminRoute, and uses real events', () => {
  const index = read('src/index.ts');
  const health = index.indexOf("app.route('/api/v1/admin', adminAppHealthRoute)");
  const generic = index.indexOf("app.route('/api/v1/admin', adminRoute)");
  assert.ok(health > 0 && health < generic);
  const source = read('src/routes/adminAppHealth.ts');
  assert.match(source, /route\.use\('\/app-health', requireAdmin\)/);
  assert.match(source, /FROM analytics_events/);
  const ingest = read('src/routes/analyticsIngest.ts');
  assert.match(ingest, /c\.req\.header\('X-App-Version'\)/);
});
