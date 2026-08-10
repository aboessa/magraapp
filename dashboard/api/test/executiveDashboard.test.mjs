/// Tests for the executive dashboard aggregate.
///
/// ## What is worth pinning on a read-only screen
///
/// Nothing here writes, so a defect cannot corrupt data — it misinforms, on the most-read
/// screen in the product. Three properties are therefore asserted:
///
/// 1. **Every actionable metric has a destination.** A count with no `drill` is a number
///    whose follow-up question ("which ones?") has no answer, which is what made the
///    previous home screen read-only in practice.
/// 2. **A limit is declared, not implied.** The devices module counts a projection the
///    registration path no longer writes; if that fact lives only in a code comment, an
///    operator reads a stale number as current.
/// 3. **Zero and unknown stay distinguishable.** A missing row must render as `0` for a
///    genuine count, and `limits` must name what cannot be computed at all, rather than
///    letting a reader assume a missing module means "nothing wrong".
///
/// The handler is reached through the router with a stubbed D1, so dispatch, SQL shape
/// and the post-processing are all exercised on `node --test`.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/routes/adminExecutive.ts', import.meta.url)), 'utf8');

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
      async first() { const rows = run(); return rows.length ? rows[0] : null; },
      async all() { return { results: run() }; },
      async run() { run(); return { meta: { changes: 1 } }; },
    };
  };
  return {
    queries,
    prepare(sql) {
      return { bind: (...params) => terminals(sql, params), ...terminals(sql, []) };
    },
  };
}

async function call(db) {
  const { default: route } = await import('../src/routes/adminExecutive.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request('/dashboard/executive', {}, env);
  return { status: response.status, body: await response.json().catch(() => null) };
}

const EMPTY_DB = () => fakeDb([]);

const POPULATED_DB = () => fakeDb([
  ['AS open_tickets', [{
    open_tickets: 12, waiting_customer: 3, first_response_breached: 2,
    resolution_breached: 5, escalated: 1, unassigned: 4,
  }]],
  ['AS blocked', [{ blocked: 3, overdue: 7, unowned: 2, tracked_items: 40 }]],
  ['AS running', [{ running: 6, overdue_stages: 4, changes_requested: 1, pending_reviews: 9 }]],
  ['AS published_series', [{
    published_series: 8, pipeline_series: 4, published_episodes: 55,
    ready_unpublished_episodes: 3, published_stories: 12, published_games: 6,
  }]],
  ['AS published_empty', [{ published: 19, draft: 5, review: 2, scheduled: 1, published_empty: 1 }]],
  ['AS without_author', [{
    published: 7, draft: 2, review: 1, scheduled: 2, without_author: 1, awaiting_religious_review: 2,
  }]],
  ['AS pages_missing_title', [{
    pages_missing_title: 2, pages_missing_description: 3, posts_missing_title: 1,
    published_noindex: 1, redirects: 4,
  }]],
  ['AS active_families', [{
    active_families: 120, suspended_families: 4, paid_families: 33, active_children: 210,
  }]],
  ['AS active_devices', [{ active_devices: 90, revoked_devices: 7 }]],
  ['AS agreements', [{ agreements: 15, expired: 2, expiring_soon: 3, withheld: 1, restricted: 4 }]],
  ['AS unresolved_dlq', [{ unresolved_dlq: 2, audit_last_day: 44 }]],
]);

// --- Shape -----------------------------------------------------------------

test('the aggregate answers every module in one request', async () => {
  const result = await call(POPULATED_DB());
  assert.equal(result.status, 200);
  const keys = result.body.data.modules.map((module) => module.key);
  for (const expected of [
    'support', 'production', 'workflow', 'catalogue', 'website', 'blog', 'seo',
    'customers', 'devices', 'rights', 'platform',
  ]) {
    assert.ok(keys.includes(expected), `module ${expected} missing`);
  }
});

test('every module names the tables it read', async () => {
  const result = await call(POPULATED_DB());
  for (const module of result.body.data.modules) {
    assert.ok(module.source && module.source.length > 0, `${module.key} has no source`);
  }
});

// --- Drill-through ---------------------------------------------------------

test('every metric carries a destination, and it is an in-dashboard path', async () => {
  // A number whose follow-up question has no answer is the defect this replaces.
  const result = await call(POPULATED_DB());
  for (const module of result.body.data.modules) {
    for (const metric of module.metrics) {
      assert.ok(metric.drill, `${module.key}.${metric.key} has no drill path`);
      assert.ok(metric.drill.startsWith('/'), `${module.key}.${metric.key} drill is not a path`);
      // No absolute URL: the drill must stay inside the admin, so an external host
      // cannot be injected into a link the operator is trained to click.
      assert.ok(!metric.drill.includes('://'), `${module.key}.${metric.key} drill leaves the dashboard`);
    }
  }
});

test('the SLA drill paths carry the filter that reproduces the count', async () => {
  const result = await call(POPULATED_DB());
  const support = result.body.data.modules.find((module) => module.key === 'support');
  const first = support.metrics.find((metric) => metric.key === 'first_response_breached');
  const resolution = support.metrics.find((metric) => metric.key === 'resolution_breached');
  assert.match(first.drill, /overdue=first_response/);
  assert.match(resolution.drill, /overdue=resolution/);
  // The two clocks stay separate all the way to the link: one "overdue" filter would
  // make the two numbers open the same list and look like a bug in one of them.
  assert.notEqual(first.drill, resolution.drill);
});

test('scheduled counts drill into the calendar view, not a table', async () => {
  const result = await call(POPULATED_DB());
  for (const key of ['website', 'blog']) {
    const module = result.body.data.modules.find((entry) => entry.key === key);
    const scheduled = module.metrics.find((metric) => metric.key === 'scheduled');
    assert.match(scheduled.drill, /view=calendar/);
  }
});

// --- Tone ------------------------------------------------------------------

test('a zero alert counter is good, and a non-zero one is not', async () => {
  const populated = await call(POPULATED_DB());
  const support = populated.body.data.modules.find((module) => module.key === 'support');
  assert.equal(support.metrics.find((metric) => metric.key === 'resolution_breached').tone, 'danger');
  assert.equal(support.metrics.find((metric) => metric.key === 'unassigned').tone, 'warn');

  const empty = await call(EMPTY_DB());
  const emptySupport = empty.body.data.modules.find((module) => module.key === 'support');
  assert.equal(emptySupport.metrics.find((metric) => metric.key === 'resolution_breached').tone, 'good');
  // An open-ticket count is not an alert: zero open tickets is not "good", it is a
  // number. Colouring it green would train people to read green as "done".
  assert.equal(emptySupport.metrics.find((metric) => metric.key === 'open').tone, 'neutral');
});

test('a missing row is reported as zero, never as null or NaN', async () => {
  const result = await call(EMPTY_DB());
  for (const module of result.body.data.modules) {
    for (const metric of module.metrics) {
      assert.equal(typeof metric.value, 'number', `${module.key}.${metric.key} is not a number`);
      assert.ok(Number.isFinite(metric.value), `${module.key}.${metric.key} is not finite`);
      assert.equal(metric.value, 0);
    }
  }
});

// --- Declared limits -------------------------------------------------------

test('the devices module declares that its count comes from a projection', async () => {
  const result = await call(POPULATED_DB());
  const devices = result.body.data.modules.find((module) => module.key === 'devices');
  assert.ok(devices.unavailable, 'the devices limit is not declared in the payload');
  assert.match(devices.unavailable, /إسقاط/);
});

test('what the dashboard cannot say is named in the payload', async () => {
  const result = await call(POPULATED_DB());
  const limits = result.body.data.limits.join(' ');
  // Each of these would otherwise be an invented number on the most-read screen.
  assert.match(limits, /مزوّد دفع/);
  assert.match(limits, /Analytics Engine/);
  assert.match(limits, /Search Console/);
  assert.ok(result.body.data.limits.length >= 4);
});

test('the response is timestamped so a stale tab is detectable', async () => {
  const result = await call(POPULATED_DB());
  assert.ok(!Number.isNaN(Date.parse(result.body.data.generated_at)));
});

// --- SQL properties --------------------------------------------------------

test('the resolution clock stops for tickets waiting on the customer', () => {
  // "We are slow" and "we are waiting for a reply" are different facts. Counting the
  // second as an SLA breach makes the number unusable for either.
  const resolution = source.slice(source.indexOf('AS first_response_breached'), source.indexOf('AS escalated'));
  assert.match(resolution, /waiting_customer/);
});

test('the first-response breach only counts tickets with no reply yet', () => {
  const clause = source.slice(source.indexOf('AS open_tickets'), source.indexOf('AS resolution_breached'));
  assert.match(clause, /first_response_at IS NULL/);
});

test('no revenue, latency or index-status metric is emitted', async () => {
  const result = await call(POPULATED_DB());
  const keys = result.body.data.modules.flatMap((module) => module.metrics.map((metric) => metric.key));
  for (const forbidden of ['revenue', 'mrr', 'arpu', 'churn', 'conversion', 'latency', 'indexed_pages']) {
    assert.ok(!keys.includes(forbidden), `${forbidden} has no data source and must not be emitted`);
  }
});

test('the aggregate is read-only', () => {
  // A dashboard that writes is a dashboard that can break the thing it reports on.
  for (const statement of ['INSERT INTO', 'UPDATE ', 'DELETE FROM']) {
    assert.ok(!source.includes(statement), `the executive aggregate must not run ${statement.trim()}`);
  }
});
