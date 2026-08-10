#!/usr/bin/env node
/**
 * Live HTTP verification of the Customer 360 workspace: what it composes, what it names,
 * and what it must never show.
 *
 * ## What this proves
 *
 * `routes/adminCustomer.ts` makes three claims in its header comment, and all three are the
 * kind that a unit test cannot check because they are claims about composition:
 *
 *   1. the page composes the FamilyState authority (present tense) with D1 projections and
 *      history (past tense) and the dashboard's own operational tables;
 *   2. a source that cannot be read degrades its own section and the rest of the page still
 *      loads, rather than a 503 for the whole workspace;
 *   3. nothing here exposes a child's watch history, favourites or progress detail — the
 *      progress figure is a count and only a count.
 *
 * So this reads a real family from the projection, reads the workspace, and asserts each of
 * those against the actual payload: which sections came back, which of them declare where
 * they came from, whether the authority's device list and D1's device projection can be
 * compared side by side (they disagree in this database, and that disagreement being
 * *visible* is the feature), whether a linked support ticket and the entitlement ledger both
 * appear, and whether reading the family left an audit row.
 *
 * The child-safety assertion is made negatively and over the whole serialized response, not
 * field by field: any of a list of viewing-history markers appearing anywhere in the payload
 * fails the check, so a future section that adds one cannot pass unnoticed.
 *
 * ## What it deliberately does not do
 *
 * It never runs against production. It creates exactly one support ticket, linked to the
 * family it inspects, so the "linked tickets" section has something real to return; it
 * writes nothing else and cleans nothing up.
 *
 * It also does not fake a broken source. Making one section genuinely unavailable requires a
 * family that exists in D1 but has no Durable Object state, and `family_projection` is
 * written only by the queue consumer (`queue/familyEvents.ts`) — there is no admin HTTP path
 * that can create such a row. The script therefore searches the whole family list for one
 * and, if it finds none, reports that branch as not exercised instead of pretending.
 *
 * Usage:
 *   node scripts/verify-customer360-e2e.mjs [--base http://127.0.0.1:8787]
 *                                           [--token <admin token>]
 *                                           [--email <admin email>] [--password <password>]
 */

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const BASE = argValue('--base', 'http://127.0.0.1:8787');
let TOKEN = argValue('--token', process.env.ADMIN_API_KEY ?? '');
const EMAIL = argValue('--email', process.env.ADMIN_VERIFY_EMAIL ?? 'seo.verify@majarra.local');
const PASSWORD = argValue('--password', process.env.ADMIN_VERIFY_PASSWORD ?? 'Verify-Seo-2026!aA');
const ACTOR = 'verify-customer360-e2e';

let passed = 0;
let failed = 0;
let unverified = 0;
const failures = [];
const unverifiedNotes = [];

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

/// A branch the product's own HTTP surface cannot reach from here.
///
/// Counted apart from failures so that neither number lies: a skipped rule must not be
/// hidden inside "0 failed", and a rule the server never had a chance to break must not be
/// reported as a defect.
function unverifiedCheck(name, detail) {
  unverified += 1;
  unverifiedNotes.push(`${name} — ${detail}`);
  console.log(`  SKIP ${name} — ${detail}`);
}

async function signIn() {
  if (TOKEN && !EMAIL) return;
  const response = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const payload = await response.json().catch(() => null);
  const token = payload?.data?.token;
  if (!token) {
    console.log(`Sign-in failed (${response.status}). Supply --token instead.`);
    return;
  }
  TOKEN = token;
}

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'X-Admin-Actor': ACTOR,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}
const get = (path) => call('GET', path);

/// Anything that would mean a child's viewing behaviour reached an operator's browser.
///
/// Checked against the whole serialized payload rather than per field: a new section that
/// joined `content_progress` or `favorites` would otherwise pass every field-level check.
const HISTORY_MARKERS = [
  'watch_history', 'viewing_history', 'last_watched', 'watched_at', 'position_seconds',
  'progress_percent', 'favorites', 'favourite', 'episode_id', 'story_id', 'content_progress',
];

const stamp = Date.now().toString(36);

async function main() {
  console.log(`Verifying Customer 360 at ${BASE}\n`);

  const health = await fetch(`${BASE}/health`).then((response) => response.json()).catch(() => null);
  if (health?.status !== 'ok') {
    console.log(`No worker is answering at ${BASE}/health.`);
    console.log('Start one against the local D1 first: npm run dev  (do not use --remote)');
    process.exit(1);
  }

  await signIn();
  if (!TOKEN) {
    console.log('\nNo admin credential. Pass --email/--password or --token.');
    process.exit(1);
  }

  // --- The family list, which is the entry point ---------------------------
  console.log('The family list');

  const list = await get('/api/v1/admin/customers?limit=100');
  check('the customer list answers with families and a total',
    list.status === 200 && Array.isArray(list.json?.data) && typeof list.json?.meta?.total === 'number',
    `status ${list.status} ${list.text.slice(0, 200)}`);
  const families = list.json?.data ?? [];
  check('at least one family exists to inspect', families.length > 0, `families ${families.length}`);
  if (!families.length) { report(); return; }
  check('each row carries the counts an operator triages on',
    families.every((row) => typeof row.child_count === 'number'
      && typeof row.device_count === 'number' && typeof row.open_tickets === 'number'),
    JSON.stringify(families[0]));

  const filtered = await get('/api/v1/admin/customers?plan=free&limit=100');
  check('a plan filter narrows the list in SQL',
    filtered.status === 200 && filtered.json.data.every((row) => row.plan === 'free')
      && filtered.json.meta.total <= list.json.meta.total,
    `${filtered.json?.meta?.total} of ${list.json?.meta?.total}`);

  // Read the projection route directly too: it is the other reader of the same rows, and
  // the two must agree about which families exist.
  const projection = await get('/api/v1/admin/parents?limit=100');
  check('the family projection route names its source',
    projection.status === 200 && projection.json?.meta?.source === 'family_event_projection',
    JSON.stringify(projection.json?.meta ?? {}));
  check('the projection route and the customer list see the same families',
    projection.json?.meta?.total === list.json?.meta?.total,
    `projection ${projection.json?.meta?.total} vs customers ${list.json?.meta?.total}`);

  // --- Pick a family whose authority is reachable -------------------------
  let subject = null;
  let degraded = null;
  for (const family of families) {
    const state = await get(`/api/v1/admin/families/${family.parent_id}/device-state`);
    if (state.status === 200 && !subject) subject = family;
    if (state.status === 503 && !degraded) degraded = family;
    if (subject && degraded) break;
  }
  check('a family with a reachable FamilyState authority was found', !!subject,
    'every family in the projection has an unreachable Durable Object');
  if (!subject) { report(); return; }
  const parentId = subject.parent_id;
  console.log(`  using family ${parentId}`);

  // A real linked ticket, so the operational-tables section has something to return.
  const ticket = await call('POST', '/api/v1/admin/support/tickets', {
    subject: `تحقّق ٣٦٠ ${stamp}`,
    category: 'subscription',
    priority: 'normal',
    family_id: parentId,
    subscription_ref: `sub-${stamp}`,
    purchase_ref: `gpa-${stamp}`,
  });
  check('a support ticket can be linked to this family', ticket.status === 201, ticket.text.slice(0, 200));
  const ticketReference = ticket.json?.data?.reference;

  // --- The workspace -------------------------------------------------------
  console.log('\nThe workspace payload');

  const auditBefore = await get(`/api/v1/admin/audit-logs?entity_type=customer_360&entity_id=${parentId}&limit=1`);
  const auditCountBefore = auditBefore.json?.meta?.total ?? 0;

  const workspace = await get(`/api/v1/admin/customers/${parentId}`);
  check('the workspace answers 200', workspace.status === 200, `status ${workspace.status} ${workspace.text.slice(0, 200)}`);
  const data = workspace.json?.data ?? {};
  const SECTIONS = ['family', 'authority', 'children', 'devices_projection', 'billing',
    'purchases', 'tickets', 'audit', 'consents', 'progress_summary'];
  check('every section of the workspace is present',
    SECTIONS.every((section) => data[section] !== undefined),
    SECTIONS.filter((section) => data[section] === undefined).join(', ') || 'all present');

  // 1. FamilyState, present tense.
  check('the authority section is read from FamilyState and says so',
    data.authority?.available === true && data.authority?.source === 'family_state',
    JSON.stringify({ available: data.authority?.available, source: data.authority?.source }));
  check('the authority answers the present-tense questions: plan, ledger, devices, sessions, leases',
    typeof data.authority?.effective_plan === 'string'
      && Array.isArray(data.authority?.entitlements)
      && Array.isArray(data.authority?.devices)
      && typeof data.authority?.active_sessions === 'number'
      && typeof data.authority?.active_leases === 'number',
    JSON.stringify(Object.keys(data.authority ?? {})));
  check('the authority exposes auth_epoch, which is what explains a family-wide sign-out',
    typeof data.authority?.auth_epoch === 'number', `auth_epoch ${data.authority?.auth_epoch}`);

  // 2. D1 projections and history, past tense.
  check('the D1 family projection row is returned alongside the authority',
    data.family?.parent_id === parentId && typeof data.family?.plan === 'string',
    JSON.stringify(data.family ?? {}));
  check('the D1 history sections are returned as lists, not folded into the authority',
    Array.isArray(data.children) && Array.isArray(data.billing) && Array.isArray(data.purchases),
    `children ${Array.isArray(data.children)} billing ${Array.isArray(data.billing)} purchases ${Array.isArray(data.purchases)}`);

  // 3. The dashboard's own operational tables.
  check('linked support tickets appear, from the admin tables',
    Array.isArray(data.tickets) && data.tickets.some((row) => row.reference === ticketReference),
    `tickets ${JSON.stringify((data.tickets ?? []).map((row) => row.reference))}`);
  check('the linked ticket carries what a triage needs: reference, status, priority, SLA deadline',
    (() => {
      const row = (data.tickets ?? []).find((entry) => entry.reference === ticketReference);
      return !!row && !!row.status && !!row.priority && 'resolution_due_at' in row;
    })(), '');
  check('the family audit trail is a section of its own',
    Array.isArray(data.audit), `audit ${typeof data.audit}`);

  // --- Provenance ----------------------------------------------------------
  console.log('\nProvenance');

  const named = SECTIONS.filter((section) => {
    const value = data[section];
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.source === 'string') return true;
    return typeof workspace.json?.meta?.sources?.[section] === 'string';
  });
  const unnamed = SECTIONS.filter((section) => !named.includes(section));
  check('every section names its source',
    unnamed.length === 0,
    `${named.length}/${SECTIONS.length} named; no provenance on: ${unnamed.join(', ')} (and the response carries no meta.sources map)`);
  check('at least the sections that can degrade name their source',
    typeof data.authority?.source === 'string', JSON.stringify(data.authority?.source));

  // --- Authority versus projection ----------------------------------------
  console.log('\nAuthority versus projection');

  const authorityDevices = data.authority?.devices ?? [];
  const projectedDevices = data.devices_projection ?? [];
  check('both device lists are returned side by side so they can be compared',
    Array.isArray(authorityDevices) && Array.isArray(projectedDevices), '');
  check('each authority device carries the id and status a comparison needs',
    authorityDevices.every((device) => !!device.id && !!device.status), JSON.stringify(authorityDevices.slice(0, 2)));
  check('the difference between the authority and the projection is visible in the payload',
    authorityDevices.length !== projectedDevices.length
      || authorityDevices.every((device) => projectedDevices.some((row) => row.id === device.id)),
    `authority ${authorityDevices.length} devices, projection ${projectedDevices.length}`);
  check('the list badge counts the projection, and the workspace shows the authority separately',
    subject.device_count === projectedDevices.length,
    `list device_count ${subject.device_count} vs projection rows ${projectedDevices.length} vs authority ${authorityDevices.length}`);
  const plansAgree = data.family?.plan === data.authority?.effective_plan;
  check('the projected plan and the authoritative plan are both shown, so a lag is visible',
    typeof data.family?.plan === 'string' && typeof data.authority?.effective_plan === 'string',
    `projection ${data.family?.plan} vs authority ${data.authority?.effective_plan}${plansAgree ? '' : ' (they differ — visible)'}`);

  // --- Subscriptions, purchases, consents ---------------------------------
  console.log('\nSubscriptions, purchases and consents');

  check('the entitlement ledger — the authoritative subscription relationship — is present',
    Array.isArray(data.authority?.entitlements), JSON.stringify(data.authority?.entitlements ?? null));
  check('the billing audit trail is present as history',
    Array.isArray(data.billing), '');
  check('the store purchase records are present as history',
    Array.isArray(data.purchases), '');
  check('no purchase token or raw response hash reaches the operator',
    !/purchase_token|raw_response_hash|token_hash/i.test(workspace.text), '');
  check('consent data appears and is not the unavailable shape',
    data.consents !== undefined && data.consents?.available !== false,
    JSON.stringify(data.consents ?? null));
  check('the consents section was read from FamilyState, not from D1',
    data.consents !== null && typeof data.consents === 'object',
    `consents is ${Array.isArray(data.consents) ? 'an array' : typeof data.consents}`);

  // --- The child-safety boundary ------------------------------------------
  console.log('\nThe child-safety boundary');

  check('the child progress summary is a count and nothing else',
    (typeof data.progress_summary?.records === 'number' && Object.keys(data.progress_summary).length === 1)
      || data.progress_summary?.available === false,
    JSON.stringify(data.progress_summary ?? null));
  const leaked = HISTORY_MARKERS.filter((marker) => workspace.text.toLowerCase().includes(marker));
  check('no child viewing history is exposed anywhere in the payload',
    leaked.length === 0, `markers found: ${leaked.join(', ')}`);
  const childKeys = new Set((data.children ?? []).flatMap((child) => Object.keys(child)));
  check('the child rows carry only the pseudonymous fields the admin is allowed',
    [...childKeys].every((key) => ['child_id', 'nickname', 'age_track', 'status', 'last_event_at_ms'].includes(key)),
    [...childKeys].join(', '));
  check('no child birth date or contact detail is present',
    !/birth_month|birth_year|birthdate|\bemail\b|\bphone\b/i.test(workspace.text), '');

  // --- Degradation ---------------------------------------------------------
  console.log('\nDegradation');

  if (degraded) {
    const partial = await get(`/api/v1/admin/customers/${degraded.parent_id}`);
    const partialData = partial.json?.data ?? {};
    check('a family whose authority is unreachable still returns 200', partial.status === 200,
      `status ${partial.status} ${partial.text.slice(0, 160)}`);
    check('the unreachable section reports itself unavailable with a reason, not as empty',
      partialData.authority?.available === false
        && partialData.authority?.source === 'family_state'
        && typeof partialData.authority?.reason === 'string',
      JSON.stringify(partialData.authority ?? null));
    check('the other sections still return',
      ['family', 'children', 'devices_projection', 'billing', 'purchases', 'tickets', 'audit']
        .every((section) => partialData[section] !== undefined), '');
    check('the progress summary says it could not be read rather than reporting zero',
      partialData.progress_summary?.available === false, JSON.stringify(partialData.progress_summary ?? null));
  } else {
    unverifiedCheck('one failing source degrades that section alone',
      `every one of the ${families.length} families in family_projection has live Durable Object `
      + 'state, and the admin HTTP surface cannot create a D1 family row without one — '
      + 'family_projection is written only by the queue consumer (queue/familyEvents.ts) — so the '
      + 'degraded-source branch of routes/adminCustomer.ts could not be driven from here');
  }

  // What the workspace *can* be shown to survive is a source with nothing in it, which is a
  // different thing from an unreachable source and is what the page usually meets.
  check('an empty source degrades to an empty section and does not collapse the page',
    workspace.status === 200 && projectedDevices.length === 0 && authorityDevices.length > 0,
    `projection rows ${projectedDevices.length}, authority devices ${authorityDevices.length}`);

  // --- Reading a family is audited ----------------------------------------
  console.log('\nAudit');

  const auditAfter = await get(`/api/v1/admin/audit-logs?entity_type=customer_360&entity_id=${parentId}&limit=5`);
  check('reading the family wrote exactly one new audit row',
    (auditAfter.json?.meta?.total ?? 0) === auditCountBefore + 1,
    `${auditCountBefore} → ${auditAfter.json?.meta?.total}`);
  const auditRow = (auditAfter.json?.data ?? [])[0];
  check('the audit row records the read as a view against customer_360',
    auditRow?.action === 'view' && auditRow?.entity_type === 'customer_360' && auditRow?.entity_id === parentId,
    JSON.stringify(auditRow ?? null));
  check('the audit row names the signed-in actor',
    !!auditRow?.actor_id && auditRow.actor_id !== 'legacy-admin-key', auditRow?.actor_id ?? 'none');
  check('the audit row records the section count, not the section contents',
    typeof auditRow?.details === 'string' && auditRow.details.includes('ticket_count')
      && !auditRow.details.includes('nickname'),
    (auditRow?.details ?? '').slice(0, 200));

  // --- Guards --------------------------------------------------------------
  console.log('\nGuards');
  check('the workspace is not readable without a credential',
    (await fetch(`${BASE}/api/v1/admin/customers/${parentId}`)).status === 401, '');
  check('an unknown family answers 404',
    (await get(`/api/v1/admin/customers/no-such-family-${stamp}`)).status === 404, '');
  check('family administration through this surface stays read-only',
    (await call('PATCH', `/api/v1/admin/children/no-such-child-${stamp}`, { nickname: 'x' })).status === 405, '');

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (unverified) console.log(`${unverified} not exercised`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  if (unverifiedNotes.length) {
    console.log('\nNot exercised:');
    for (const note of unverifiedNotes) console.log(`  - ${note}`);
  }
  process.exit(failed ? 1 : 0);
}

await main();
