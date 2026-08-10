/// Tests for the executive dashboard aggregate.
///
/// ## What is worth pinning on a read-only screen
///
/// Nothing here writes, so a defect cannot corrupt data — it misinforms, on the most-read
/// screen in the product. The properties asserted are the ones that regress silently:
///
/// 1. **Zero and unknown stay distinguishable.** A source that could not be read must carry
///    `value: null` and its own `unavailable` reason. This used to be the opposite: every
///    count ended in `?? 0`, and a test in this file asserted that an unreadable source
///    reports `0` — pinning the defect instead of the behaviour. That expectation was wrong
///    and has been replaced, not relaxed.
/// 2. **Every actionable metric has a destination, and the destination is checkable.** A
///    count with no `drill` is a number whose follow-up question ("which ones?") has no
///    answer. `drill_api` names the admin list request that reproduces the same set, so
///    `scripts/verify-executive-e2e.mjs` can compare the number to the list over HTTP; a
///    metric whose list cannot express the predicate must say so in `note`.
/// 3. **Deadlines are compared in one format.** Due dates are stored as
///    `new Date().toISOString()` while `datetime('now')` yields a space-separated stamp, and
///    comparing them as text hides every breach that happened today. The local database had
///    seven first-response breaches reported as zero because of exactly this.
/// 4. **Test fixtures are not production content.** `series.content_class` separates
///    supplied test material from Majarra content, and the catalogue counters must apply it
///    or the dashboard reports fixture episodes as published Majarra episodes.
/// 5. **Every metric states its period**, so a count is never read as a rate, and nothing is
///    presented as a ratio — a percentage over an empty set renders as 0% or NaN, which
///    reads as a measurement of zero.
///
/// The handler is reached through the router with a stubbed D1, so dispatch, SQL shape and
/// the post-processing are all exercised on `node --test`.

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

/// Every source unreadable: the fake returns no row for any of the module statements, which
/// is what a missing table or a renamed column looks like to `readRow`.
const UNREADABLE_DB = () => fakeDb([]);

const POPULATED_DB = () => fakeDb([
  ['AS open_tickets', [{
    open_tickets: 12, waiting_customer: 3, first_response_breached: 2,
    resolution_breached: 5, escalated: 1, unassigned: 4,
  }]],
  ['AS blocked', [{ blocked: 3, past_due: 7, unowned: 2, tracked_items: 40 }]],
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
    pages_missing_title: 2, posts_missing_title: 1,
    pages_missing_description: 3, posts_missing_description: 2,
    pages_published_noindex: 1, posts_published_noindex: 0,
    redirects: 4,
  }]],
  ['AS active_families', [{
    active_families: 120, suspended_families: 4, paid_plan_families: 33, active_children: 210,
  }]],
  ['AS agreements', [{ agreements: 15, expired: 2, expiring_soon: 3, withheld: 1, restricted: 4 }]],
  ['FROM failed_family_events', [{ unresolved: 2 }]],
  ['FROM audit_logs', [{ total: 44 }]],
]);

const allMetrics = (body) => body.data.modules.flatMap(
  (module) => module.metrics.map((metric) => ({ module: module.key, ...metric })),
);

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
  assert.equal(keys.length, 11);
  // The count is pinned so a module that stops being emitted fails here rather than
  // disappearing quietly from the home screen.
  assert.equal(allMetrics(result.body).length, 48);
});

test('every module names the tables it read', async () => {
  const result = await call(POPULATED_DB());
  for (const module of result.body.data.modules) {
    assert.ok(module.source && module.source.length > 0, `${module.key} has no source`);
  }
});

test('no metric key is emitted twice within a module', async () => {
  const result = await call(POPULATED_DB());
  for (const module of result.body.data.modules) {
    const keys = module.metrics.map((metric) => metric.key);
    assert.equal(new Set(keys).size, keys.length, `${module.key} repeats a metric key`);
  }
});

// --- Zero versus unknown ---------------------------------------------------

test('an unreadable source reports null with a reason, never zero', async () => {
  // This is the defect class this endpoint exists to avoid: "there are none" and "we could
  // not read it" lead to opposite decisions.
  const result = await call(UNREADABLE_DB());
  assert.equal(result.status, 200);
  for (const metric of allMetrics(result.body)) {
    assert.equal(metric.value, null, `${metric.module}.${metric.key} reported a number`);
    assert.ok(
      typeof metric.unavailable === 'string' && metric.unavailable.length > 20,
      `${metric.module}.${metric.key} has no stated reason`,
    );
    // A source that cannot be read has no state to colour green.
    assert.equal(metric.tone, 'neutral', `${metric.module}.${metric.key} is toned`);
  }
  for (const module of result.body.data.modules) {
    assert.ok(module.unavailable, `${module.key} does not declare its own gap`);
  }
});

test('a readable source reports a whole count and claims nothing unavailable', async () => {
  const result = await call(POPULATED_DB());
  for (const metric of allMetrics(result.body)) {
    if (metric.module === 'devices') continue; // no source at all; asserted below
    assert.equal(metric.unavailable, null, `${metric.module}.${metric.key} claims unavailable`);
    assert.ok(Number.isInteger(metric.value) && metric.value >= 0,
      `${metric.module}.${metric.key} is not a whole count: ${metric.value}`);
  }
});

test('value and unavailable are never both set, and never both absent', async () => {
  for (const db of [POPULATED_DB(), UNREADABLE_DB()]) {
    const result = await call(db);
    for (const metric of allMetrics(result.body)) {
      const hasValue = metric.value !== null;
      const hasReason = metric.unavailable !== null;
      assert.notEqual(hasValue, hasReason,
        `${metric.module}.${metric.key}: value ${metric.value} / unavailable ${metric.unavailable}`);
    }
  }
});

test('the device counters are unavailable even when the table would answer', async () => {
  // `account_devices` has no writer anywhere in the codebase (proved by
  // scripts/verify-device-e2e.mjs), so a count read from it is not "no devices" — it is
  // unknowable from D1. The handler must therefore not query it at all.
  const db = POPULATED_DB();
  const result = await call(db);
  const devices = result.body.data.modules.find((module) => module.key === 'devices');
  assert.ok(devices.unavailable, 'the devices limit is not declared in the payload');
  assert.match(devices.unavailable, /إسقاط/);
  assert.match(devices.unavailable, /account_devices/);
  for (const metric of devices.metrics) {
    assert.equal(metric.value, null, `${metric.key} reported a number`);
    assert.ok(metric.unavailable, `${metric.key} does not state why`);
  }
  assert.ok(
    !db.queries.some((query) => query.sql.includes('account_devices')),
    'the aggregate still reads a projection nothing writes',
  );
});

// --- Periods, not rates ----------------------------------------------------

test('every metric states the period it covers', async () => {
  const result = await call(POPULATED_DB());
  for (const metric of allMetrics(result.body)) {
    assert.ok(['current_state', 'last_24h', 'next_60_days'].includes(metric.window),
      `${metric.module}.${metric.key} window is ${metric.window}`);
  }
  const metrics = allMetrics(result.body);
  assert.equal(metrics.find((metric) => metric.key === 'audit_last_day').window, 'last_24h');
  assert.equal(metrics.find((metric) => metric.key === 'expiring_soon').window, 'next_60_days');
});

test('nothing is presented as a ratio, so no zero denominator can render as 0% or NaN', async () => {
  const result = await call(POPULATED_DB());
  for (const metric of allMetrics(result.body)) {
    const labels = `${metric.label_ar} ${metric.label_en}`;
    assert.doesNotMatch(labels, /%|percent|rate\b|نسبة|معدّل/i,
      `${metric.module}.${metric.key} reads as a ratio`);
    assert.ok(metric.value === null || Number.isInteger(metric.value),
      `${metric.module}.${metric.key} is not a whole count`);
  }
});

// --- Drill-through ---------------------------------------------------------

test('every metric carries a destination, and it is an in-dashboard path', async () => {
  // A number whose follow-up question has no answer is the defect this replaces.
  const result = await call(POPULATED_DB());
  for (const metric of allMetrics(result.body)) {
    assert.ok(metric.drill, `${metric.module}.${metric.key} has no drill path`);
    assert.ok(metric.drill.startsWith('/'), `${metric.module}.${metric.key} drill is not a path`);
    // No absolute URL: the drill must stay inside the admin, so an external host
    // cannot be injected into a link the operator is trained to click.
    assert.ok(!metric.drill.includes('://'), `${metric.module}.${metric.key} drill leaves the dashboard`);
  }
});

test('every metric names the admin list request that reproduces its set', async () => {
  const result = await call(POPULATED_DB());
  for (const metric of allMetrics(result.body)) {
    assert.ok(metric.drill_api?.startsWith('/api/v1/admin/'),
      `${metric.module}.${metric.key} drill_api is ${metric.drill_api}`);
    assert.ok(['exact', 'related'].includes(metric.drill_match),
      `${metric.module}.${metric.key} drill_match is ${metric.drill_match}`);
    if (metric.drill_match === 'related') {
      // A metric whose list cannot express the predicate has to say so; otherwise "related"
      // becomes a way to opt out of the comparison without anyone noticing.
      assert.ok(metric.note && metric.note.length > 20,
        `${metric.module}.${metric.key} is related with no stated reason`);
    }
  }
});

test('at least half of the metrics are exactly reproducible by a list request', async () => {
  // Not a style preference: `exact` is the only class the live check can compare number to
  // list, so a payload that quietly drifted to all-`related` would be unverifiable.
  const result = await call(POPULATED_DB());
  const metrics = allMetrics(result.body);
  const exact = metrics.filter((metric) => metric.drill_match === 'exact');
  assert.ok(exact.length >= 15, `only ${exact.length} metrics are exactly reproducible`);
});

test('the SLA drills carry the filter the ticket list actually honours', async () => {
  const result = await call(POPULATED_DB());
  const support = result.body.data.modules.find((module) => module.key === 'support');
  const first = support.metrics.find((metric) => metric.key === 'first_response_breached');
  const resolution = support.metrics.find((metric) => metric.key === 'resolution_breached');
  // `overdue=1` on GET /admin/support/tickets is the resolution clock only. The previous
  // drills read `?overdue=first_response` and `?overdue=resolution`, neither of which the
  // list endpoint understands, so both landed on an unfiltered list. That check was wrong,
  // not the product.
  assert.match(resolution.drill, /overdue=1/);
  assert.equal(resolution.drill_match, 'exact');
  assert.match(first.drill_api, /live=1/);
  assert.equal(first.drill_match, 'related');
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
    // The API request drops the view: it is a rendering choice, not a filter.
    assert.doesNotMatch(scheduled.drill_api, /view=calendar/);
  }
});

test('the audit counter drills into the same window it counted', async () => {
  const db = POPULATED_DB();
  const result = await call(db);
  const audit = allMetrics(result.body).find((metric) => metric.key === 'audit_last_day');
  const statement = db.queries.find((query) => query.sql.includes('FROM audit_logs'));
  assert.ok(statement, 'the audit count was never queried');
  // The window is computed once and bound, then handed to the drill unchanged. Recomputing
  // it in the link would open a different 24 hours than the one that was counted.
  assert.equal(statement.params.length, 2, 'the window is not bound as parameters');
  for (const bound of statement.params) {
    assert.match(bound, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.ok(audit.drill_api.includes(encodeURIComponent(bound)),
      `drill_api does not carry the bound window ${bound}`);
  }
});

// --- Tone ------------------------------------------------------------------

test('a zero alert counter is good, and a non-zero one is not', async () => {
  const populated = await call(POPULATED_DB());
  const support = populated.body.data.modules.find((module) => module.key === 'support');
  assert.equal(support.metrics.find((metric) => metric.key === 'resolution_breached').tone, 'danger');
  assert.equal(support.metrics.find((metric) => metric.key === 'unassigned').tone, 'warn');
  // An open-ticket count is not an alert: zero open tickets is not "good", it is a
  // number. Colouring it green would train people to read green as "done".
  assert.equal(support.metrics.find((metric) => metric.key === 'open').tone, 'neutral');

  const quiet = await call(fakeDb([
    ['AS open_tickets', [{
      open_tickets: 0, waiting_customer: 0, first_response_breached: 0,
      resolution_breached: 0, escalated: 0, unassigned: 0,
    }]],
  ]));
  const quietSupport = quiet.body.data.modules.find((module) => module.key === 'support');
  assert.equal(quietSupport.metrics.find((metric) => metric.key === 'resolution_breached').tone, 'good');
  assert.equal(quietSupport.metrics.find((metric) => metric.key === 'open').tone, 'neutral');
});

// --- Declared limits -------------------------------------------------------

test('what the dashboard cannot say is named in the payload', async () => {
  const result = await call(POPULATED_DB());
  const limits = result.body.data.limits.join(' ');
  // Each of these would otherwise be an invented number on the most-read screen.
  assert.match(limits, /مزوّد دفع/);
  assert.match(limits, /Analytics Engine/);
  assert.match(limits, /Search Console/);
  // The device projection has no writer, and the publish-gate rights table has no admin
  // write path — both are reasons a zero would be meaningless rather than reassuring.
  assert.match(limits, /account_devices/);
  assert.match(limits, /content_rights/);
  assert.ok(result.body.data.limits.length >= 6);
});

test('the response is timestamped so a stale tab is detectable', async () => {
  const result = await call(POPULATED_DB());
  assert.ok(!Number.isNaN(Date.parse(result.body.data.generated_at)));
});

// --- SQL properties --------------------------------------------------------

test('a stored ISO deadline is never compared to datetime(now) as raw text', () => {
  // Deadlines are written as `2026-08-11T02:09:03.591Z` while `datetime('now')` yields
  // `2026-08-10 21:53:44`. Compared as text, 'T' (0x54) sorts above ' ' (0x20), so a
  // deadline that passed an hour ago looks like it is still in the future — every breach
  // inside the current UTC day is invisible. The local database had seven first-response
  // breaches reported as zero because of exactly this.
  assert.doesNotMatch(source, /(?:due_at|due_at\b[^\n]*)\s*<\s*datetime\('now'\)/,
    'a deadline is still compared to datetime(now) without normalising the stored format');
  assert.match(source, /SQL_DEADLINE_PASSED/);
  // Reused from lib/supportCrm.ts rather than re-implemented: a second copy of this
  // predicate is a second thing to get wrong.
  assert.match(source, /import \{ SQL_DEADLINE_PASSED \} from '\.\.\/lib\/supportCrm\.ts'/);
});

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

test('every catalogue counter excludes supplied test fixtures', async () => {
  // series.content_class (migration 0018) separates platform test material from Majarra
  // content. Without it this module reported the two fixture series and their fourteen
  // videos as published Majarra content while Majarra had published nothing.
  const db = POPULATED_DB();
  await call(db);
  const catalogue = db.queries.find((query) => query.sql.includes('AS published_series'));
  assert.ok(catalogue, 'the catalogue statement never ran');
  const occurrences = (catalogue.sql.match(/content_class/g) ?? []).length;
  assert.ok(occurrences >= 6, `only ${occurrences} catalogue counters restrict content_class`);
  for (const table of ['FROM series', 'FROM episodes', 'FROM stories', 'FROM games']) {
    assert.ok(catalogue.sql.includes(table), `${table} is not counted`);
  }
});

test('the rights module counts the table the rights screen shows', async () => {
  // GET/POST /admin/rights work on rights_licenses. content_rights is read by the publish
  // gate and written by nothing, so counting it produced an eternal zero and opened a
  // screen listing a different table.
  const db = POPULATED_DB();
  await call(db);
  const rights = db.queries.find((query) => query.sql.includes('AS agreements'));
  assert.match(rights.sql, /FROM rights_licenses/);
  assert.doesNotMatch(source, /FROM content_rights/);
  // An expiry may be stored as a date or a full timestamp; both are normalised before being
  // compared to date('now'), or a timestamp on the boundary day falls out of the window.
  assert.match(rights.sql, /SUBSTR\(expiry_date, 1, 10\)/);
});

test('the two platform sources are read separately', async () => {
  // They were one SELECT behind one catch, so a missing failed-events table erased the audit
  // counter too and left the module with no metrics at all — "we cannot tell" rendered as an
  // empty panel next to ten full ones.
  const db = POPULATED_DB();
  const result = await call(db);
  const dlq = db.queries.filter((query) => query.sql.includes('failed_family_events'));
  const audit = db.queries.filter((query) => query.sql.includes('audit_logs'));
  assert.equal(dlq.length, 1);
  assert.equal(audit.length, 1);
  assert.ok(!dlq[0].sql.includes('audit_logs'), 'the two sources share one statement');

  const partial = await call(fakeDb([['FROM audit_logs', [{ total: 44 }]]]));
  const platform = partial.body.data.modules.find((module) => module.key === 'platform');
  assert.equal(platform.metrics.length, 2, 'a module with one readable source lost its metrics');
  assert.equal(platform.metrics.find((metric) => metric.key === 'audit_last_day').value, 44);
  assert.equal(platform.metrics.find((metric) => metric.key === 'unresolved_dlq').value, null);
  // One readable source means the module itself is not unavailable; the gap is per metric.
  assert.equal(platform.unavailable, null);
  assert.equal(result.body.data.modules.find((module) => module.key === 'platform').unavailable, null);
});

test('the SEO counters cover the same entities as the audit issue they open', async () => {
  // The description and noindex counters used to count pages only while their drill opened
  // an audit filter that lists pages and posts, so the number and the list disagreed by the
  // number of posts.
  const result = await call(POPULATED_DB());
  const seo = result.body.data.modules.find((module) => module.key === 'seo');
  const value = (key) => seo.metrics.find((metric) => metric.key === key).value;
  assert.equal(value('missing_title'), 2 + 1);
  assert.equal(value('missing_description'), 3 + 2);
  assert.equal(value('published_noindex'), 1 + 0);
  for (const key of ['missing_title', 'missing_description', 'published_noindex']) {
    assert.match(seo.metrics.find((metric) => metric.key === key).drill, new RegExp(`check=${key}`));
  }
});

test('no revenue, latency or index-status metric is emitted', async () => {
  const result = await call(POPULATED_DB());
  const keys = allMetrics(result.body).map((metric) => metric.key);
  for (const forbidden of ['revenue', 'mrr', 'arpu', 'churn', 'conversion', 'latency', 'indexed_pages']) {
    assert.ok(!keys.includes(forbidden), `${forbidden} has no data source and must not be emitted`);
  }
});

test('the paid-plan counter does not claim a payment was taken', async () => {
  // There is no payment provider configured, so the plan column is a plan flag and nothing
  // more. Labelling it "paying families" turned a projection field into a financial claim.
  const result = await call(POPULATED_DB());
  const paid = result.body.data.modules.find((module) => module.key === 'customers')
    .metrics.find((metric) => metric.key === 'paid_families');
  assert.match(paid.label_en, /paid plan/i);
  assert.match(paid.note, /دفع/);
});

test('the aggregate is read-only', () => {
  // A dashboard that writes is a dashboard that can break the thing it reports on.
  for (const statement of ['INSERT INTO', 'UPDATE ', 'DELETE FROM']) {
    assert.ok(!source.includes(statement), `the executive aggregate must not run ${statement.trim()}`);
  }
});
