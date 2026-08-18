import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Publishing for stories, books, games and projects.
///
/// ## The gap these tests close
///
/// Only four publish endpoints existed in the whole API — series, episodes,
/// website pages and blog posts — so stories, books, games and projects could be
/// authored and marked ready and then never published. That is the mechanical
/// reason the database held **0 published stories, 0 books and 0 projects**: not a
/// missing asset, a missing endpoint.
///
/// The readiness gate already understood all six types. Nothing called it for four
/// of them.

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const writes = [];

/// A database where the entity exists in `status`, and every readiness query the
/// gate makes answers "nothing recorded".
function fakeDb(status = 'ready') {
  return {
    prepare(sql) {
      const statement = {
        bind: (...params) => ({
          async first() {
            if (/SELECT status FROM \w+ WHERE id = \?/.test(sql)) {
              return status === null ? null : { status };
            }
            if (sql.includes('FROM admin_credentials')) return { total: 1 };
            return null;
          },
          async all() { return { results: [] }; },
          async run() { writes.push({ sql, params }); return { meta: { changes: 1 } }; },
        }),
        async first() {
          if (sql.includes('FROM admin_credentials')) return { total: 1 };
          return null;
        },
        async all() { return { results: [] }; },
        async run() { writes.push({ sql, params: [] }); return { meta: { changes: 1 } }; },
      };
      return statement;
    },
    async batch(statements) {
      writes.push({ sql: 'BATCH', params: statements.length });
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

/// The legacy shared-key path is the only way to reach a handler without a real
/// session, and it is deliberately limited to a fresh install — so the seeded
/// check must report zero credentials for these tests to exercise the handler.
function freshInstallDb(status = 'ready') {
  const db = fakeDb(status);
  const inner = db.prepare.bind(db);
  db.prepare = (sql) => {
    if (sql.includes('FROM admin_credentials')) {
      return {
        bind: () => ({ async first() { return { total: 0 }; }, async all() { return { results: [] }; }, async run() { return { meta: { changes: 0 } }; } }),
        async first() { return { total: 0 }; },
        async all() { return { results: [] }; },
        async run() { return { meta: { changes: 0 } }; },
      };
    }
    return inner(sql);
  };
  return db;
}

const env = (db) => ({
  DB: db,
  ENVIRONMENT: 'development',
  CACHE: { async get() { return null; }, async put() {} },
});

async function publish(path, db) {
  const { default: route } = await import('../src/routes/adminPublish.ts');
  return route.request(path, { method: 'POST' }, env(db));
}

test('every publishable type has a publish endpoint', () => {
  const source = readFileSync(`${ROOT}src/routes/adminPublish.ts`, 'utf8');
  for (const path of ['/stories/:id/publish', '/books/:id/publish', '/games/:id/publish', '/projects/:id/publish']) {
    assert.ok(source.includes(`route.post('${path}'`), `${path} is missing`);
  }
});

test('the six publishable types now all have an endpoint somewhere', () => {
  // `lib/publishGate.ts` declares the set; this asserts the API caught up with it.
  const gate = readFileSync(`${ROOT}src/lib/publishGate.ts`, 'utf8');
  const declared = /PUBLISHABLE_TYPES = \[([^\]]+)\]/.exec(gate)[1]
    .split(',')
    .map((entry) => entry.trim().replace(/'/g, ''))
    .filter(Boolean);
  assert.deepEqual(declared.sort(), ['book', 'episode', 'game', 'project', 'series', 'story']);

  const routes = readdirSync(`${ROOT}src/routes`)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => readFileSync(`${ROOT}src/routes/${name}`, 'utf8'))
    .join('\n');

  const plural = { story: 'stories', book: 'books', game: 'games', project: 'projects', series: 'series', episode: 'episodes' };
  for (const type of declared) {
    assert.match(
      routes,
      new RegExp(String.raw`'\/${plural[type]}\/:id\/publish'`),
      `${type} is publishable by the gate but has no publish endpoint`,
    );
  }
});

test('publishing requires the publish permission', () => {
  const source = readFileSync(`${ROOT}src/routes/adminPublish.ts`, 'utf8');
  const handlers = source.match(/route\.post\('[^']+', requirePermission\('publish'\)/g) ?? [];
  assert.equal(handlers.length, 4, 'each publish endpoint must carry requirePermission');
  assert.match(source, /route\.use\('\*', requireAdmin\)/, 'mounted directly, so it guards itself');
});

test('an anonymous caller is refused once an administrator exists', async () => {
  const res = await publish('/stories/story-1/publish', fakeDb('ready'));
  assert.equal(res.status, 401);
});

test('a missing entity is a 404', async () => {
  writes.length = 0;
  const res = await publish('/books/book-missing/publish', freshInstallDb(null));
  assert.equal(res.status, 404);
  assert.equal(writes.filter((write) => write.sql === 'BATCH').length, 0);
});

test('an archived entity cannot be published', async () => {
  writes.length = 0;
  const res = await publish('/games/game-1/publish', freshInstallDb('archived'));
  assert.equal(res.status, 409);
  const payload = await res.json();
  assert.match(payload.error, /Archived/);
  assert.equal(writes.filter((write) => write.sql === 'BATCH').length, 0);
});

test('publishing something already published changes nothing and says so', async () => {
  writes.length = 0;
  const res = await publish('/projects/project-1/publish', freshInstallDb('published'));
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload.data.published, false, 'the operation is idempotent, not a second publish');
  assert.equal(writes.filter((write) => write.sql === 'BATCH').length, 0);
});

test('a publish the gate cannot evaluate is refused, not allowed through', async () => {
  // The series and episode handlers treat a null gate result as `'not evaluated'`
  // and publish anyway. This handler fails closed: existence is already
  // established, so a gate that cannot evaluate means the gate did not run, and
  // publishing unevaluated content is the exact failure the gate prevents.
  writes.length = 0;
  const res = await publish('/stories/story-1/publish', freshInstallDb('ready'));

  assert.equal(res.status, 409);
  const payload = await res.json();
  assert.equal(payload.success, false);
  assert.match(payload.error, /readiness could not be evaluated/);

  const audited = writes.some((write) => /INSERT INTO audit_logs/.test(write.sql));
  assert.ok(audited, 'a blocked publish must still be attributable');
  assert.equal(
    writes.filter((write) => /UPDATE stories SET status = 'published'/.test(write.sql)).length,
    0,
    'a blocked publish must not change status',
  );
});

test('the fail-closed branch is explicit in the source', () => {
  const source = readFileSync(`${ROOT}src/routes/adminPublish.ts`, 'utf8');
  assert.match(source, /if \(!gate\) \{/, 'a null gate result must be handled explicitly');
  assert.match(source, /readiness_not_evaluable/);
  // And the blocked path must still exist for a gate that ran and refused.
  assert.match(source, /if \(!gate\.publishable\) \{/);
  assert.match(source, /gateRefusal\(gate\)/);
});

test('only stories carry published_at, and the statement reflects that', () => {
  // Writing a column that does not exist fails the whole statement, so the shape
  // is declared per table rather than assumed.
  const source = readFileSync(`${ROOT}src/routes/adminPublish.ts`, 'utf8');
  assert.match(source, /story:\s*\{[^}]*hasPublishedAt: true/);
  for (const key of ['book', 'game', 'project']) {
    assert.match(source, new RegExp(String.raw`${key}:\s*\{[^}]*hasPublishedAt: false`));
  }
  assert.match(source, /published_at = COALESCE\(published_at, \?\)/);
});

test('the table name never comes from request input', () => {
  const source = readFileSync(`${ROOT}src/routes/adminPublish.ts`, 'utf8');
  // Interpolated, so this matters: the value must originate in the literal map.
  assert.match(source, /FROM \$\{spec\.table\} WHERE id = \?/);
  assert.match(source, /const PUBLISHABLE = \{/);
  assert.doesNotMatch(source, /\$\{c\.req\./, 'no request value may reach the SQL text');
});

test('the publish and blocked-publish audit actions are recorded distinctly', () => {
  const source = readFileSync(`${ROOT}src/routes/adminPublish.ts`, 'utf8');
  assert.match(source, /'publish_blocked'/);
  assert.match(source, /actorId\(c\), 'publish', spec\.type/);
  assert.match(source, /warnings: gate\.warnings\.map/, 'warnings must be recorded with the publish, not discarded');
});
