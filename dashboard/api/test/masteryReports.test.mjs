import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Regression coverage for the mastery and attempts reports.
///
/// ## Why this file exists
///
/// `routes/adminMastery.ts` was written to close the last disabled item in the
/// sidebar, and shipped with no test. That is the same exposure that let four
/// logic defects survive in `routes/adminBackup.ts` until they were found by
/// reading the code rather than by a failing test.
///
/// The reports are read-only, so a defect here does not corrupt data — it
/// misinforms. An objective that nobody has attempted rendering as "0% success"
/// reads as "every child fails this objective", which is the opposite of the
/// truth and is exactly the kind of thing a content decision gets made on.
///
/// ## What is asserted
///
/// The handlers are reached through the router with a stubbed D1, so the
/// dispatch, the SQL shape, the enum guards and the post-processing are all
/// exercised. No Workers runtime is needed; the suite stays on `node --test`.

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));
const source = readFileSync(routesDir + 'adminMastery.ts', 'utf8');

/// Strips comments before asserting on code.
///
/// Line comments first: a `///` comment containing a path such as
/// `/api/v1/admin/*` otherwise pairs its `/*` with a later `*/` and deletes real
/// code in between. That ordering bug once hid three live routes from a sweep.
function stripComments(text) {
  return text
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

const code = stripComments(source);

/* ------------------------------------------------------------------ D1 stub */

/// D1 stub driven by a matcher list of `[substring, rows]`.
///
/// The most specific needle wins, measured by length, so declaration order does
/// not matter. Needles must still be unique: two of these queries both contain
/// `FROM mastery`, so the count query and the report query need distinguishable
/// fragments (`COUNT(*) AS total` versus `GROUP BY`).
/// ## The stub must answer with and without `bind()`
///
/// `lib/db.ts` skips binding when there are no parameters:
///
///   const result = params.length ? await stmt.bind(...params).first() : await stmt.first();
///
/// So an unfiltered report calls `prepare(sql).first()` and never touches
/// `bind()`. A stub that only exposes the terminal methods after `bind()` throws
/// on exactly those requests, which surfaces as a 500 and reads like a handler
/// defect. The terminal methods are therefore attached at both levels.
/// ## The auth probe must not be answered by a report matcher
///
/// `requireAdmin` calls `hasAnyAdminUser`, which runs:
///
///   SELECT COUNT(*) AS total FROM admin_credentials
///
/// A test matcher keyed on `COUNT(*) AS total` therefore answers the auth probe
/// as well as the report's own count, reporting that admin users exist. The
/// shared-key path is then refused and every request 401s — a harness fault that
/// reads exactly like a broken guard.
///
/// The default below answers that probe with zero, which is what puts
/// `requireAdmin` on its documented frictionless development path. It is longer
/// than the generic needle, so longest-match keeps it authoritative.
const NO_ADMIN_USERS = ['FROM admin_credentials', [{ total: 0 }]];

function fakeDb(matchers = []) {
  const queries = [];
  const ranked = [...matchers, NO_ADMIN_USERS].sort((a, b) => b[0].length - a[0].length);

  const terminals = (sql, params) => {
    const run = () => {
      queries.push({ sql, params });
      const hit = ranked.find(([needle]) => sql.includes(needle));
      return hit ? hit[1] : [];
    };
    return {
      async first() {
        const rows = run();
        return rows.length ? rows[0] : null;
      },
      async all() {
        return { results: run() };
      },
      async run() {
        run();
        return { meta: { changes: 1 } };
      },
    };
  };

  return {
    queries,
    prepare(sql) {
      return {
        bind: (...params) => terminals(sql, params),
        ...terminals(sql, []),
      };
    },
  };
}

/// Builds the router with a stub env and issues one request.
///
/// `requireAdmin` runs for real. With no `ADMIN_API_KEY`, no admin users and
/// `ENVIRONMENT === 'development'` it takes the documented frictionless path, so
/// these tests exercise the handlers rather than the guard, which
/// `routeGuards.test.mjs` covers.
async function call(path, db) {
  const { default: route } = await import('../src/routes/adminMastery.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request(path, {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

/* ------------------------------------------------- null is not zero */

test('an objective with no attempts reports a null success rate', async () => {
  // This is the defect that matters most in a read-only report. Rendering 0%
  // for an untried objective inverts its meaning: "nobody tried this" becomes
  // "everybody fails this".
  const report = await call('/mastery/by-objective', fakeDb([
    ['GROUP BY lo.id', [{
      id: 'lo-1', code: 'LO-1', title_ar: 'هدف', skill_id: null, skill_name: null,
      children_count: 0, independent_count: 0, needs_review_count: 0, not_started_count: 0,
      attempts: 0, correct_attempts: 0, last_attempt_at: null,
    }]],
    ['COUNT(*) AS total', [{ total: 1 }]],
  ]));

  assert.equal(report.status, 200);
  assert.equal(report.body.data[0].success_rate, null);
  assert.notEqual(report.body.data[0].success_rate, 0);
});

test('a child with no attempts reports a null success rate', async () => {
  const report = await call('/mastery/by-child', fakeDb([
    ['GROUP BY cp.id', [{
      child_id: 'c-1', nickname: 'سعاد', age_track: 'kids', parent_id: 'p-1',
      objectives_count: 0, independent_count: 0, needs_review_count: 0,
      attempts: 0, correct_attempts: 0, last_attempt_at: null,
    }]],
    ['COUNT(*) AS total', [{ total: 1 }]],
  ]));

  assert.equal(report.body.data[0].success_rate, null);
});

test('a success rate is a rounded percentage of correct over total', async () => {
  const report = await call('/mastery/by-objective', fakeDb([
    ['GROUP BY lo.id', [{
      id: 'lo-1', code: 'LO-1', title_ar: 'هدف',
      attempts: 7, correct_attempts: 3, // 42.857…
      children_count: 2, independent_count: 0, needs_review_count: 0, not_started_count: 0,
    }]],
    ['COUNT(*) AS total', [{ total: 1 }]],
  ]));

  assert.equal(report.body.data[0].success_rate, 43);
});

test('the rate is computed in SQL over all rows, not over the page', async () => {
  // Summing in the handler after LIMIT would yield the page's rate, not the
  // objective's. The aggregate must be in the query.
  assert.match(code, /COALESCE\(SUM\(m\.attempts\), 0\) AS attempts/);
  assert.match(code, /COALESCE\(SUM\(m\.correct_attempts\), 0\) AS correct_attempts/);
  assert.match(code, /GROUP BY lo\.id/);
});

/* ------------------------------------------------------------- enum guards */

test('an unknown mastery level is refused with the valid list', async () => {
  const report = await call('/mastery/by-objective?level=mastered', fakeDb());
  assert.equal(report.status, 400);
  for (const level of ['not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review']) {
    assert.match(report.body.error, new RegExp(level));
  }
});

test('every level in the CHECK constraint is accepted', async () => {
  // The list must match migration 0001 exactly; a missing level would make a
  // real filter unusable, and an extra one would 400 at the database instead.
  for (const level of ['not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review']) {
    const report = await call(`/mastery/by-objective?level=${level}`, fakeDb([
      ['COUNT(*) AS total', [{ total: 0 }]],
    ]));
    assert.equal(report.status, 200, level);
  }
});

test('an unknown track is refused', async () => {
  const report = await call('/mastery/by-child?track=teens', fakeDb());
  assert.equal(report.status, 400);
  assert.match(report.body.error, /preschool/);
});

test('the available levels are returned with the list', async () => {
  // The UI would otherwise hardcode them and drift from the constraint.
  const report = await call('/mastery/by-objective', fakeDb([
    ['COUNT(*) AS total', [{ total: 0 }]],
  ]));
  assert.deepEqual(report.body.meta.levels, [
    'not_started', 'introduced', 'practicing', 'assisted', 'independent', 'needs_review',
  ]);
});

/* --------------------------------------------------------------- filtering */

/// The auth probe (`FROM admin_credentials`) runs on every request, so
/// assertions must target the report's own queries rather than "every query".
const reportQueries = (db) => db.queries.filter((q) => !q.sql.includes('admin_credentials'));

test('the level filter matches objectives having any child at that level', async () => {
  // Filtering the aggregate would hide an objective where one child is stuck.
  // The EXISTS subquery keeps it visible and lets its counter show the scale.
  const db = fakeDb([['COUNT(*) AS total', [{ total: 0 }]]]);
  await call('/mastery/by-objective?level=needs_review', db);

  const filtered = reportQueries(db).find((q) => q.sql.includes('learning_objectives lo'));
  assert.ok(filtered, 'the objective count query was not issued');
  assert.match(filtered.sql, /EXISTS \(SELECT 1 FROM mastery m2/);
  assert.ok(filtered.params.includes('needs_review'));
});

test('archived children are excluded from the child report', async () => {
  // Measuring mastery on a stopped profile is meaningless.
  const db = fakeDb([['COUNT(*) AS total', [{ total: 0 }]]]);
  await call('/mastery/by-child', db);

  const queries = reportQueries(db);
  assert.ok(queries.length > 0, 'no report query was issued');
  for (const query of queries) {
    assert.match(query.sql, /cp\.status = 'active'/);
  }
});

test('filters are bound as parameters, never interpolated', async () => {
  const db = fakeDb([['COUNT(*) AS total', [{ total: 0 }]]]);
  await call('/mastery/by-child?parent_id=p-1&track=kids', db);

  const query = db.queries.find((q) => q.sql.includes('GROUP BY cp.id'));
  assert.ok(query.params.includes('p-1'));
  assert.ok(query.params.includes('kids'));
  // The value must not appear in the SQL text itself.
  assert.doesNotMatch(query.sql, /p-1/);
});

test('attempts can be filtered by child, game or episode', async () => {
  for (const [name, query] of [['child_id', 'child_id=c-1'], ['game_id', 'game_id=g-1'], ['episode_id', 'episode_id=e-1']]) {
    const db = fakeDb([['COUNT(*) AS total', [{ total: 0 }]]]);
    await call(`/attempts?${query}`, db);
    const listed = db.queries.find((q) => q.sql.includes('FROM attempts a'));
    assert.match(listed.sql, new RegExp(`a\\.${name} = \\?`), name);
  }
});

/* ---------------------------------------------------------------- attempts */

test('help_used is a boolean, not the raw integer', async () => {
  // D1 stores it as 0/1. Leaking that to the UI invites `if (help_used)` to be
  // true for the string "0" after a JSON round trip elsewhere.
  const report = await call('/attempts', fakeDb([
    ['FROM attempts a', [
      { id: 'a-1', child_id: 'c-1', help_used: 1, score: null, max_score: null, time_spent_seconds: 10 },
      { id: 'a-2', child_id: 'c-1', help_used: 0, score: null, max_score: null, time_spent_seconds: 10 },
    ]],
    ['COUNT(*) AS total', [{ total: 2 }]],
  ]));

  assert.equal(report.body.data[0].help_used, true);
  assert.equal(report.body.data[1].help_used, false);
});

test('a score with no ceiling yields no percentage', async () => {
  // score without max_score cannot be expressed as a percentage. Inventing a
  // denominator would fabricate a result.
  const report = await call('/attempts', fakeDb([
    ['FROM attempts a', [
      { id: 'a-1', child_id: 'c-1', score: 7, max_score: null, help_used: 0, time_spent_seconds: 5 },
      { id: 'a-2', child_id: 'c-1', score: 7, max_score: 10, help_used: 0, time_spent_seconds: 5 },
      // A zero ceiling would divide by zero.
      { id: 'a-3', child_id: 'c-1', score: 0, max_score: 0, help_used: 0, time_spent_seconds: 5 },
    ]],
    ['COUNT(*) AS total', [{ total: 3 }]],
  ]));

  assert.equal(report.body.data[0].score_percent, null);
  assert.equal(report.body.data[1].score_percent, 70);
  assert.equal(report.body.data[2].score_percent, null);
});

test('a zero score is reported, not treated as missing', async () => {
  // `score: 0` is a real result. A truthiness check would drop it.
  const report = await call('/attempts', fakeDb([
    ['FROM attempts a', [
      { id: 'a-1', child_id: 'c-1', score: 0, max_score: 10, help_used: 0, time_spent_seconds: 5 },
    ]],
    ['COUNT(*) AS total', [{ total: 1 }]],
  ]));
  assert.equal(report.body.data[0].score_percent, 0);
});

test('child answers are never returned', async () => {
  // `attempts.answers` is unbounded JSON of a child's responses. It widens
  // child-data exposure without helping the dashboard.
  assert.doesNotMatch(code, /a\.answers/);
  assert.doesNotMatch(code, /SELECT \* FROM attempts/);

  const db = fakeDb([['COUNT(*) AS total', [{ total: 0 }]]]);
  await call('/attempts', db);
  const listed = db.queries.find((q) => q.sql.includes('FROM attempts a'));
  assert.doesNotMatch(listed.sql, /answers/);
});

test('no report selects whole rows from a child table', async () => {
  // `SELECT *` on children_profiles would leak birth_month and birth_year.
  assert.doesNotMatch(code, /SELECT \* FROM children_profiles/);
  assert.doesNotMatch(code, /cp\.\*/);
  assert.doesNotMatch(code, /birth_month/);
  assert.doesNotMatch(code, /birth_year/);
});

/* ---------------------------------------------------------------- ordering */

test('the worst cases are ordered first', async () => {
  // An operator opens these reports to find what needs attention. Ordering by
  // needs_review descending puts that at the top rather than making them page.
  assert.match(code, /ORDER BY needs_review_count DESC, lo\.code/);
  assert.match(code, /ORDER BY needs_review_count DESC, cp\.nickname/);
  // Attempts are an event log, so recency is the useful order.
  assert.match(code, /ORDER BY a\.created_at DESC/);
});

/* -------------------------------------------------------------- pagination */

test('every report is bounded and reports a real total', async () => {
  // An unbounded list looks fine until the table grows. `meta.total` is what
  // lets the UI say how many rows exist rather than implying the page is all.
  for (const path of ['/mastery/by-objective', '/mastery/by-child', '/attempts']) {
    const db = fakeDb([['COUNT(*) AS total', [{ total: 137 }]]]);
    const report = await call(path, db);
    assert.equal(report.body.meta.total, 137, path);
    assert.equal(report.body.meta.limit, 200, path);
    assert.equal(report.body.meta.offset, 0, path);

    const listed = db.queries.find((q) => q.sql.includes('LIMIT ? OFFSET ?'));
    assert.ok(listed, `${path} is not paginated`);
  }
});

test('an explicit page size is honoured within the ceiling', async () => {
  const within = await call('/attempts?limit=50&offset=100', fakeDb([
    ['COUNT(*) AS total', [{ total: 0 }]],
  ]));
  assert.equal(within.body.meta.limit, 50);
  assert.equal(within.body.meta.offset, 100);

  // The ceiling still holds.
  const over = await call('/attempts?limit=9999', fakeDb([
    ['COUNT(*) AS total', [{ total: 0 }]],
  ]));
  assert.equal(over.body.meta.limit, 500);
});

test('the reports share the pagination helper rather than redefining it', () => {
  // Two copies drift, and the generous default exists precisely so newly
  // bounded endpoints agree on it.
  assert.match(source, /UNBOUNDED_LIST_PAGINATION/);
  assert.match(source, /from '\.\.\/lib\/catalogueValidation(\.ts)?'/);
});

/* ------------------------------------------------------------------- guard */

test('the router authenticates itself', () => {
  // Reached through admin.ts today, but these paths expose child nicknames and
  // progress. Relying on another file's mount order is not acceptable for that.
  assert.match(code, /route\.use\('\*', requireAdmin\)/);
});

test('an empty result is an empty list, not an error', async () => {
  // "No data yet" is the normal state for a new deployment.
  for (const path of ['/mastery/by-objective', '/mastery/by-child', '/attempts']) {
    const report = await call(path, fakeDb());
    assert.equal(report.status, 200, path);
    assert.deepEqual(report.body.data, [], path);
    assert.equal(report.body.meta.total, 0, path);
  }
});
