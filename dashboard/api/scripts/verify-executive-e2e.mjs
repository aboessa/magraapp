#!/usr/bin/env node
/**
 * Live HTTP verification of every metric served by `GET /admin/dashboard/executive`.
 *
 * ## What this proves
 *
 * 1. The aggregate answers with eleven modules and forty-eight metrics, by key, in one
 *    request — so a module that silently stopped being emitted is a failure here rather
 *    than a gap nobody notices on the home screen.
 * 2. Every metric carries a number **or** an explicit `unavailable` reason, never both and
 *    never neither. A source that cannot be read must not report `0`: "none" and "we cannot
 *    tell" lead to opposite decisions, and conflating them is the defect this file hunts
 *    hardest for.
 * 3. Every metric states the period it covers (`window`), so a count is never read as a
 *    rate, and every value is a whole count rather than a percentage with no denominator.
 * 4. Every metric names an admin screen (`drill`) and an admin list request (`drill_api`),
 *    and every one of those list requests answers 200 with its filter applied.
 * 5. Where a metric claims `drill_match: 'exact'`, the list request returns **the same
 *    number**. That is the check that catches a counter and its list drifting apart — the
 *    "12 overdue tickets" badge opening a list of three.
 * 6. Where it claims `related`, the payload must say why in `note`, so a metric cannot be
 *    quietly downgraded to an unverifiable one.
 * 7. Two cross-source checks with real semantics: the SEO counters are compared against the
 *    issue ids returned by `GET /admin/seo/audit`, and the catalogue counters are compared
 *    against the admin catalogue lists, which have no `content_class` filter and therefore
 *    still include the supplied test fixtures.
 *
 * ## What it deliberately does not do
 *
 * It does not write anything: every request here is a GET, so the numbers it reads are the
 * numbers an operator would see, not numbers this script created. It therefore cannot prove
 * behaviour on data that does not exist locally — a database with no expiring licence
 * cannot demonstrate the 60-day window, and that is reported as a limit rather than
 * simulated. It does not touch production, and it does not render the dashboard: the front
 * end is verified separately, and the known gap that several admin screens do not yet read
 * their URL filters is stated in the payload's own `limits`.
 *
 * Usage:
 *   node scripts/verify-executive-e2e.mjs [--base http://127.0.0.1:8787]
 *                                         [--email <admin email> --password <password>]
 *                                         [--token <admin token>]
 */

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const BASE = argValue('--base', 'http://127.0.0.1:8787');
let TOKEN = argValue('--token', process.env.ADMIN_API_KEY ?? 'dev-admin-key');
const EMAIL = argValue('--email', process.env.ADMIN_VERIFY_EMAIL ?? '');
const PASSWORD = argValue('--password', process.env.ADMIN_VERIFY_PASSWORD ?? '');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/// Signs in when credentials are supplied.
///
/// The shared-key path in `lib/adminAuth.ts` stops working once the first admin user is
/// seeded — deliberately, so there is never a second door without an identity. A local
/// database with real users therefore needs a real session.
async function signIn() {
  if (!EMAIL || !PASSWORD) return;
  const response = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const payload = await response.json().catch(() => null);
  const token = payload?.data?.token ?? payload?.token ?? payload?.data?.session?.token;
  if (!token) {
    console.log(`Sign-in failed (${response.status}). Falling back to the shared key.`);
    return;
  }
  TOKEN = token;
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Admin-Actor': 'verify-executive-e2e',
    },
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}

/// The number of rows a list endpoint reports for the filter it was given.
///
/// `meta.total` when the endpoint counts, the array length when it does not. Both shapes
/// exist in this codebase, and a check that only understood one would silently skip the
/// other.
const listTotal = (payload) => {
  if (typeof payload?.meta?.total === 'number') return payload.meta.total;
  if (Array.isArray(payload?.data)) return payload.data.length;
  return null;
};

const EXPECTED_MODULES = [
  'support', 'production', 'workflow', 'catalogue', 'website', 'blog', 'seo',
  'customers', 'devices', 'rights', 'platform',
];
const EXPECTED_MODULE_COUNT = 11;
const EXPECTED_METRIC_COUNT = 48;
const WINDOWS = ['current_state', 'last_24h', 'next_60_days'];
const MATCHES = ['exact', 'related'];

async function main() {
  console.log(`Verifying the executive dashboard at ${BASE}\n`);

  const health = await get('/health');
  if (health.status !== 200) {
    console.log('The worker is not reachable. Start it with: npm run dev');
    process.exit(1);
  }
  check('worker responds to /health', health.json?.status === 'ok', `status ${health.status}`);

  await signIn();

  // --- The aggregate -------------------------------------------------------
  console.log('\nAggregate shape');

  const overview = await get('/api/v1/admin/dashboard/executive');
  check('the executive aggregate answers 200', overview.status === 200, overview.text.slice(0, 200));
  if (overview.status !== 200) return report();

  const data = overview.json?.data;
  const modules = data?.modules ?? [];
  const metrics = modules.flatMap((module) => module.metrics.map((metric) => ({ module: module.key, ...metric })));

  check('the response is timestamped so a stale tab is detectable',
    !Number.isNaN(Date.parse(data?.generated_at ?? '')), String(data?.generated_at));
  check(`it reports ${EXPECTED_MODULE_COUNT} modules`, modules.length === EXPECTED_MODULE_COUNT,
    `got ${modules.length}`);
  check(`it reports ${EXPECTED_METRIC_COUNT} metrics`, metrics.length === EXPECTED_METRIC_COUNT,
    `got ${metrics.length}`);
  for (const key of EXPECTED_MODULES) {
    check(`module ${key} is present`, modules.some((module) => module.key === key), '');
  }
  check('every module names the source it read',
    modules.every((module) => typeof module.source === 'string' && module.source.length > 0), '');
  check('no metric key is emitted twice',
    new Set(metrics.map((metric) => `${metric.module}.${metric.key}`)).size === metrics.length, '');

  // --- Zero is not "unknown" ----------------------------------------------
  console.log('\nZero and unknown stay distinguishable');

  const unavailableMetrics = metrics.filter((metric) => metric.unavailable);
  check('at least one metric declares an unavailable source',
    unavailableMetrics.length > 0,
    'if every source became readable this check should be re-derived, not deleted');
  for (const metric of unavailableMetrics) {
    check(`${metric.module}.${metric.key} reports unavailable, not 0`, metric.value === null,
      `value ${JSON.stringify(metric.value)}`);
    check(`${metric.module}.${metric.key} states why it is unavailable`,
      typeof metric.unavailable === 'string' && metric.unavailable.length > 20,
      String(metric.unavailable));
  }
  for (const metric of metrics.filter((entry) => !entry.unavailable)) {
    check(`${metric.module}.${metric.key} carries a whole, finite count`,
      Number.isInteger(metric.value) && metric.value >= 0, `value ${JSON.stringify(metric.value)}`);
  }

  // `account_devices` has no writer anywhere in the codebase (proved by
  // scripts/verify-device-e2e.mjs), so a device count read from D1 is unknowable rather
  // than zero. This is the specific case that used to render as "0 active devices".
  const devices = modules.find((module) => module.key === 'devices');
  check('the devices module declares its projection has no writer',
    typeof devices?.unavailable === 'string' && devices.unavailable.includes('account_devices'),
    String(devices?.unavailable));
  check('neither device counter reports 0',
    devices?.metrics.every((metric) => metric.value === null && metric.unavailable), '');

  // --- Periods, not rates --------------------------------------------------
  console.log('\nEvery metric states its period');

  for (const metric of metrics) {
    check(`${metric.module}.${metric.key} states a known window`, WINDOWS.includes(metric.window),
      String(metric.window));
  }
  const rateLike = metrics.filter((metric) => /%|rate|percent|نسبة|معدّل/i.test(`${metric.label_ar} ${metric.label_en}`));
  // Nothing here is a ratio, and nothing may become one without a denominator: a percentage
  // over an empty set renders as 0% or NaN, which reads as a real measurement of zero.
  check('no metric is presented as a ratio or a percentage', rateLike.length === 0,
    rateLike.map((metric) => `${metric.module}.${metric.key}`).join(', '));
  const audit = metrics.find((metric) => metric.key === 'audit_last_day');
  check('the 24-hour counter says so in its window', audit?.window === 'last_24h', String(audit?.window));
  const expiring = metrics.find((metric) => metric.key === 'expiring_soon');
  check('the 60-day counter says so in its window', expiring?.window === 'next_60_days',
    String(expiring?.window));

  // --- Drill-down contract -------------------------------------------------
  console.log('\nEvery metric names a destination');

  for (const metric of metrics) {
    const label = `${metric.module}.${metric.key}`;
    check(`${label} has an in-dashboard drill path`,
      typeof metric.drill === 'string' && metric.drill.startsWith('/') && !metric.drill.includes('://'),
      String(metric.drill));
    check(`${label} names the admin list request that reproduces it`,
      typeof metric.drill_api === 'string' && metric.drill_api.startsWith('/api/v1/admin/'),
      String(metric.drill_api));
    check(`${label} declares how closely the list matches`, MATCHES.includes(metric.drill_match),
      String(metric.drill_match));
    if (metric.drill_match === 'related') {
      check(`${label} explains why the list is not the same set`,
        typeof metric.note === 'string' && metric.note.length > 20, String(metric.note));
    }
  }

  const support = modules.find((module) => module.key === 'support');
  const firstResponse = support?.metrics.find((metric) => metric.key === 'first_response_breached');
  const resolution = support?.metrics.find((metric) => metric.key === 'resolution_breached');
  // The two SLA clocks must stay separate all the way to the link. `overdue=1` on the ticket
  // list is the resolution clock only, which is why the first-response counter cannot use it.
  check('the resolution breach drills into the list filter that reproduces it',
    resolution?.drill.includes('overdue=1') && resolution?.drill_match === 'exact',
    `${resolution?.drill} (${resolution?.drill_match})`);
  check('the two SLA clocks do not share one destination',
    firstResponse?.drill !== resolution?.drill, String(firstResponse?.drill));
  for (const key of ['website', 'blog']) {
    const scheduled = modules.find((module) => module.key === key)
      ?.metrics.find((metric) => metric.key === 'scheduled');
    check(`${key} scheduled drills into the calendar view`, scheduled?.drill.includes('view=calendar'),
      String(scheduled?.drill));
  }

  // --- Every list request answers, and exact ones agree --------------------
  console.log('\nDrill targets answer, and exact counters agree with their list');

  const totals = new Map();
  for (const path of [...new Set(metrics.map((metric) => metric.drill_api))]) {
    const response = await get(path);
    check(`GET ${path} answers 200`, response.status === 200,
      `status ${response.status} ${response.text.slice(0, 120)}`);
    totals.set(path, response.status === 200 ? listTotal(response.json) : null);
  }

  for (const metric of metrics.filter((entry) => entry.drill_match === 'exact' && entry.value !== null)) {
    const total = totals.get(metric.drill_api);
    check(`${metric.module}.${metric.key} equals its list (${metric.value})`, total === metric.value,
      `metric ${metric.value} vs list ${JSON.stringify(total)} at ${metric.drill_api}`);
  }

  // --- SEO: the counters against the audit that owns the definition --------
  console.log('\nSEO counters against the full audit');

  const auditResponse = await get('/api/v1/admin/seo/audit');
  const issues = auditResponse.json?.data?.issues ?? [];
  check('the SEO audit answers with an issue list', Array.isArray(issues) && auditResponse.status === 200,
    `status ${auditResponse.status}`);
  const issueCount = (id) => issues.filter((issue) => issue.id === id).length;
  for (const [key, issueId] of [
    ['missing_title', 'missing_title'],
    ['missing_description', 'missing_description'],
    ['published_noindex', 'published_noindex'],
  ]) {
    const metric = modules.find((module) => module.key === 'seo')?.metrics.find((entry) => entry.key === key);
    check(`seo.${key} matches the audit's ${issueId} findings`, metric?.value === issueCount(issueId),
      `metric ${metric?.value} vs audit ${issueCount(issueId)}`);
  }

  // --- Catalogue: test fixtures are not production content ----------------
  console.log('\nCatalogue counters exclude the supplied test fixtures');

  const catalogue = modules.find((module) => module.key === 'catalogue');
  const value = (key) => catalogue?.metrics.find((metric) => metric.key === key)?.value;
  for (const [key, path] of [
    ['published_series', '/api/v1/admin/series?status=published&limit=1'],
    ['published_episodes', '/api/v1/admin/episodes?status=published&limit=1'],
    ['published_stories', '/api/v1/admin/stories?status=published&limit=1'],
    ['published_games', '/api/v1/admin/games?status=published&limit=1'],
  ]) {
    const total = totals.get(path);
    // The admin catalogue lists have no `content_class` filter, so they include fixtures.
    // The executive counter must therefore never exceed the list, and the difference is
    // exactly the test material this dashboard must not present as Majarra content.
    check(`catalogue.${key} does not exceed the unfiltered list`, value(key) <= total,
      `metric ${value(key)} vs list ${JSON.stringify(total)}`);
    if (value(key) < total) {
      console.log(`       note: ${total - value(key)} test-fixture row(s) excluded from ${key}`);
    }
  }

  // --- Declared limits ----------------------------------------------------
  console.log('\nWhat the dashboard cannot say is named in the payload');

  const limits = (data?.limits ?? []).join(' ');
  for (const [name, needle] of [
    ['no payment provider', 'مزوّد دفع'],
    ['no Analytics Engine binding', 'Analytics Engine'],
    ['no Search Console integration', 'Search Console'],
    ['production completion is derived per item', 'مركز الإنتاج'],
    ['the device projection has no writer', 'account_devices'],
    ['the publish-gate rights table has no admin writer', 'content_rights'],
  ]) {
    check(`limits name that ${name}`, limits.includes(needle), '');
  }

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  process.exit(failed ? 1 : 0);
}

await main();
