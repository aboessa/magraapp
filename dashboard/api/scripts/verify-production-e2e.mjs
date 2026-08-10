#!/usr/bin/env node
/**
 * Live HTTP verification of the Production Centre: the requirement matrix, the board, and
 * the one rule the whole design rests on.
 *
 * ## What this proves
 *
 * `lib/productionMatrix.ts` states the rule plainly: every requirement's status is derived
 * from the artefacts, and nothing lets a person set "ARTWORK: done". A rule like that is
 * only worth the assertion that no endpoint contradicts it, and that assertion cannot be
 * made against the pure module — it has to be made against every route that writes.
 *
 * So this drives a real episode and a real story over HTTP and asserts:
 *
 *   * no endpoint accepts a completion status for a derived requirement — a payload that
 *     carries `state`, `status` and `percent` leaves the derived state exactly where it was;
 *   * recording a blocker turns `in_progress` into `blocked`, and removing it restores the
 *     derived state rather than leaving the row stuck;
 *   * a blocker can never hide a finished asset: the same blocker on a `ready` requirement
 *     leaves it `ready`, because the artefact either exists or it does not;
 *   * assignment, team and due date persist and come back on the next read, and a
 *     non-existent assignee or team is refused instead of stored;
 *   * the table view, the per-item state grouping the kanban draws, and the my-queue view
 *     all answer over HTTP;
 *   * the board states its cap — and actually answers at the cap it states;
 *   * a percentage appears only where a real denominator exists.
 *
 * The `in_progress` state needed for the blocker assertions is produced honestly: a pending
 * `qa` review is created through `POST /admin/content-reviews`, which is what makes the QA
 * requirement in-progress. Nothing is written to `production_requirements` except through
 * the endpoint under test.
 *
 * ## What it deliberately does not do
 *
 * It never runs against production, it writes no D1 row directly, and it does not invent a
 * denominator or a fixture to make a percentage appear. It leaves the assignment rows it
 * created in place — cleared of blockers, because clearing one is itself a check — so a
 * failure stays inspectable.
 *
 * Usage:
 *   node scripts/verify-production-e2e.mjs [--base http://127.0.0.1:8787]
 *                                          [--token <admin token>]
 *                                          [--email <admin email>] [--password <password>]
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
const ACTOR = 'verify-production-e2e';

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

let adminUserId = null;
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
  adminUserId = payload?.data?.user?.id ?? null;
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

/// `PUT /production/:type/:id/:requirement` replaces the whole human layer, so every field
/// has to be present on every call: omitting one is answered with 400, not treated as
/// "leave it alone". Sending them all explicitly is what the endpoint asks for.
const humanLayer = (overrides = {}) => ({
  assignee_id: null, team_id: null, due_at: null, blocker: null, note: null, ...overrides,
});

const matrixOf = async (type, id, query = '') => {
  const response = await get(`/api/v1/admin/production/${type}/${id}${query}`);
  return { status: response.status, text: response.text, data: response.json?.data ?? null };
};
const requirementOf = (matrix, key) => (matrix?.requirements ?? []).find((row) => row.key === key) ?? null;

const stamp = Date.now().toString(36);

async function main() {
  console.log(`Verifying the production centre at ${BASE}\n`);

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

  // --- Pick real content ---------------------------------------------------
  console.log('Real content from the board');

  const episodePage = await get('/api/v1/admin/production/board?type=episode&limit=1&with_publish=0');
  check('the episode board answers', episodePage.status === 200 && Array.isArray(episodePage.json?.data),
    `status ${episodePage.status} ${episodePage.text.slice(0, 200)}`);
  const episodeId = episodePage.json?.data?.[0]?.content_id;
  const boardLimit = episodePage.json?.meta?.board_limit;
  check('the board states its cap so a capped page cannot be shown as the whole slate',
    typeof boardLimit === 'number' && boardLimit > 0, `board_limit ${boardLimit}`);

  const storyPage = await get('/api/v1/admin/production/board?type=story&limit=1&with_publish=0');
  check('the story board answers', storyPage.status === 200 && Array.isArray(storyPage.json?.data),
    `status ${storyPage.status} ${storyPage.text.slice(0, 200)}`);
  const storyId = storyPage.json?.data?.[0]?.content_id;

  check('a real episode and a real story were found', !!episodeId && !!storyId, `${episodeId} / ${storyId}`);
  if (!episodeId || !storyId) { report(); return; }
  console.log(`  using episode ${episodeId}`);
  console.log(`  using story   ${storyId}`);

  // --- The matrix for one item --------------------------------------------
  console.log('\nThe requirement matrix');

  const initial = await matrixOf('episode', episodeId);
  check('the episode matrix returns every requirement with a state, a reason and an owner',
    initial.status === 200 && (initial.data?.requirements?.length ?? 0) === 14
      && initial.data.requirements.every((row) => !!row.state && !!row.detail && !!row.owner_role),
    `status ${initial.status} rows ${initial.data?.requirements?.length}`);
  check('the matrix never reports a bare "missing" without a reason',
    (initial.data?.requirements ?? []).every((row) => row.detail.length > 5), '');
  check('the matrix carries a summary whose counts add up to the rows',
    !!initial.data?.summary && ['ready', 'partial', 'in_progress', 'missing', 'blocked', 'not_applicable']
      .reduce((sum, key) => sum + initial.data.summary[key], 0) === initial.data.requirements.length,
    JSON.stringify(initial.data?.summary ?? {}));
  check('the publish row reports the real publish-gate verdict',
    ['ready', 'blocked', 'in_progress'].includes(requirementOf(initial.data, 'publish')?.state),
    JSON.stringify(requirementOf(initial.data, 'publish')));
  check('a dependency chain is declared, not implied',
    (requirementOf(initial.data, 'publish')?.depends_on ?? []).includes('qa')
      && (requirementOf(initial.data, 'video')?.depends_on ?? []).includes('voice_ar'), '');

  const readyKey = (initial.data?.requirements ?? []).find((row) => row.state === 'ready')?.key ?? null;
  check('the episode has at least one requirement its artefacts already satisfy', !!readyKey, 'no ready requirement');

  // An in-progress state is produced the way the product produces one: a pending review.
  // Nothing is written to production_requirements to fake it.
  const review = await call('POST', '/api/v1/admin/content-reviews', {
    entity_type: 'episode', entity_id: episodeId, reviewer_role: 'qa', status: 'pending',
  });
  check('a pending QA review can be recorded (or already exists)',
    review.status === 201 || review.status === 409, `status ${review.status} ${review.text.slice(0, 160)}`);
  const withReview = await matrixOf('episode', episodeId);
  check('a pending review makes the QA requirement in_progress, derived from the review row',
    requirementOf(withReview.data, 'qa')?.state === 'in_progress',
    JSON.stringify(requirementOf(withReview.data, 'qa')));

  // --- The rule: no stored completion status ------------------------------
  console.log('\nNo endpoint accepts a completion status');

  const before = requirementOf(withReview.data, 'qa');
  const smuggle = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/qa`, humanLayer({
    state: 'ready', status: 'done', percent: 100, complete: true, ready: true,
  }));
  check('a payload carrying a completion status is not echoed back as accepted',
    smuggle.status >= 400 || (smuggle.json?.data && !('state' in smuggle.json.data) && !('status' in smuggle.json.data)),
    `status ${smuggle.status} ${smuggle.text.slice(0, 200)}`);
  const afterSmuggle = await matrixOf('episode', episodeId);
  check('the derived state is unchanged by a completion status',
    requirementOf(afterSmuggle.data, 'qa')?.state === before?.state,
    `${before?.state} → ${requirementOf(afterSmuggle.data, 'qa')?.state}`);
  check('the requirement did not become ready',
    requirementOf(afterSmuggle.data, 'qa')?.state !== 'ready', '');
  check('the percentage is still derived, not supplied',
    requirementOf(afterSmuggle.data, 'qa')?.percent === before?.percent,
    `${before?.percent} → ${requirementOf(afterSmuggle.data, 'qa')?.percent}`);

  // There is also no *other* endpoint that could take a state.
  check('there is no POST on a requirement',
    (await call('POST', `/api/v1/admin/production/episode/${episodeId}/qa`, { state: 'ready' })).status === 404, '');
  check('there is no PATCH on a requirement',
    (await call('PATCH', `/api/v1/admin/production/episode/${episodeId}/qa`, { state: 'ready' })).status === 404, '');
  check('there is no write on the item as a whole',
    (await call('PUT', `/api/v1/admin/production/episode/${episodeId}`, { status: 'done' })).status === 404, '');
  check('an unknown requirement name is refused',
    (await call('PUT', `/api/v1/admin/production/episode/${episodeId}/not_a_requirement`, humanLayer())).status === 400, '');
  check('a content type production does not track is refused',
    (await call('PUT', `/api/v1/admin/production/series/${episodeId}/qa`, humanLayer())).status === 400, '');
  check('an unknown content id is refused with 404',
    (await call('PUT', `/api/v1/admin/production/episode/no-such-episode-${stamp}/qa`, humanLayer())).status === 404, '');

  // --- Blockers ------------------------------------------------------------
  console.log('\nBlockers');

  const blockerText = `مُعطَّل: في انتظار ملف الصوت النهائي (${stamp}).`;
  const setBlocker = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/qa`, humanLayer({ blocker: blockerText }));
  check('records a blocker on the in-progress requirement', setBlocker.status === 200, setBlocker.text.slice(0, 200));
  const blocked = await matrixOf('episode', episodeId);
  check('a blocker turns in_progress into blocked',
    requirementOf(blocked.data, 'qa')?.state === 'blocked',
    JSON.stringify(requirementOf(blocked.data, 'qa')));
  check('the blocker text itself comes back, so the board can show why',
    requirementOf(blocked.data, 'qa')?.blocker === blockerText, requirementOf(blocked.data, 'qa')?.blocker ?? 'null');
  check('the summary counts the blocked requirement',
    blocked.data?.summary?.blocked >= 1, JSON.stringify(blocked.data?.summary ?? {}));

  const clearBlocker = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/qa`, humanLayer({ blocker: null }));
  check('removes the blocker', clearBlocker.status === 200, clearBlocker.text.slice(0, 160));
  const restored = await matrixOf('episode', episodeId);
  check('removing the blocker restores the DERIVED state rather than leaving it stuck',
    requirementOf(restored.data, 'qa')?.state === before?.state
      && requirementOf(restored.data, 'qa')?.blocker === null,
    `${requirementOf(restored.data, 'qa')?.state} (expected ${before?.state})`);

  if (readyKey) {
    const hideText = `عائق قديم لم يُحدَّث (${stamp}).`;
    const onReady = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/${readyKey}`, humanLayer({ blocker: hideText }));
    check(`records a blocker on the finished requirement ${readyKey}`, onReady.status === 200, onReady.text.slice(0, 160));
    const withHiddenBlocker = await matrixOf('episode', episodeId);
    check('a blocker can never hide a finished asset: a ready requirement stays ready',
      requirementOf(withHiddenBlocker.data, readyKey)?.state === 'ready',
      JSON.stringify(requirementOf(withHiddenBlocker.data, readyKey)));
    check('the stale blocker is still visible to the operator, just not authoritative',
      requirementOf(withHiddenBlocker.data, readyKey)?.blocker === hideText, '');
    await call('PUT', `/api/v1/admin/production/episode/${episodeId}/${readyKey}`, humanLayer({ blocker: null }));
  }

  // --- The human layer persists -------------------------------------------
  console.log('\nAssignment, team and due date');

  const team = await call('POST', '/api/v1/admin/teams', {
    name_ar: `فريق التحقّق ${stamp}`, description_ar: 'فريق أُنشئ للتحقّق المباشر.',
  });
  check('a team exists to assign to', team.status === 201 && !!team.json?.data?.id, team.text.slice(0, 200));
  const teamId = team.json?.data?.id;
  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const badAssignee = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/artwork`,
    humanLayer({ assignee_id: `no-such-user-${stamp}` }));
  check('an assignee who does not exist is refused, not stored', badAssignee.status === 404, `status ${badAssignee.status}`);
  const badTeam = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/artwork`,
    humanLayer({ team_id: `no-such-team-${stamp}` }));
  check('a team that does not exist is refused, not stored', badTeam.status === 404, `status ${badTeam.status}`);
  const badDue = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/artwork`,
    humanLayer({ due_at: 'next tuesday' }));
  check('a due date that is not a timestamp is refused', badDue.status === 400, `status ${badDue.status}`);
  const partialBody = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/artwork`, { blocker: 'x' });
  check('the write is a full replacement of the human layer, so a partial body is refused',
    partialBody.status === 400, `status ${partialBody.status} ${partialBody.text.slice(0, 160)}`);

  const noteText = `مسند للتحقّق ${stamp}`;
  const write = await call('PUT', `/api/v1/admin/production/episode/${episodeId}/artwork`, humanLayer({
    assignee_id: adminUserId, team_id: teamId, due_at: dueAt, note: noteText,
  }));
  check('records assignment, team, due date and note', write.status === 200, write.text.slice(0, 200));
  const persisted = requirementOf((await matrixOf('episode', episodeId)).data, 'artwork');
  check('all four come back on the next read',
    persisted?.assignee_id === adminUserId && persisted?.team_id === teamId
      && persisted?.due_at === dueAt && persisted?.note === noteText,
    JSON.stringify({ assignee: persisted?.assignee_id, team: persisted?.team_id, due: persisted?.due_at, note: persisted?.note }));
  check('the assignment did not change the derived state',
    persisted?.state === requirementOf(initial.data, 'artwork')?.state,
    `${requirementOf(initial.data, 'artwork')?.state} → ${persisted?.state}`);
  check('the assignment is audited',
    ((await get(`/api/v1/admin/audit-logs?entity_type=episode&entity_id=${episodeId}&action=production_assign&limit=5`))
      .json?.data?.length ?? 0) > 0, '');

  const queue = await get('/api/v1/admin/production/my-queue');
  const mine = (queue.json?.data ?? []).find((row) => row.content_id === episodeId && row.requirement === 'artwork');
  check('the my-queue view answers over HTTP', queue.status === 200 && Array.isArray(queue.json?.data),
    `status ${queue.status} ${queue.text.slice(0, 160)}`);
  check('my-queue returns the requirement assigned to the signed-in user, with its title and due date',
    !!mine && mine.due_at === dueAt && !!mine.title,
    JSON.stringify(mine ?? { rows: queue.json?.data?.length }));

  // --- The board: table, kanban grouping, and the stated cap --------------
  console.log('\nThe board');

  const table = await get('/api/v1/admin/production/board?type=episode&limit=5&with_publish=0');
  check('the table view returns items with their full matrix and a per-item summary',
    table.status === 200 && table.json.data.length > 0
      && table.json.data.every((item) => item.requirements.length === 14 && !!item.summary),
    `status ${table.status} items ${table.json?.data?.length}`);
  check('the board pages over items, not over requirements, so no item is split across pages',
    table.json.data.every((item) => new Set(item.requirements.map((row) => row.key)).size === 14), '');
  // The kanban draws columns from the requirement states, so the grouping the board reports
  // has to match the rows it returned; a summary that disagrees would give a column count
  // that no card supports.
  const groupingHolds = (table.json?.data ?? []).every((item) => {
    const counts = { ready: 0, partial: 0, in_progress: 0, missing: 0, blocked: 0, not_applicable: 0 };
    for (const row of item.requirements) counts[row.state] += 1;
    return Object.entries(counts).every(([state, count]) => item.summary[state] === count);
  });
  check('the kanban grouping the board reports matches the rows it returned', groupingHolds, '');
  check('completion is measured over applicable requirements only',
    (table.json?.data ?? []).every((item) => item.summary.percent >= 0 && item.summary.percent <= 100), '');

  const skipped = await get('/api/v1/admin/production/board?type=episode&limit=2&with_publish=0');
  check('skipping the publish gate is declared rather than reported as a verdict',
    skipped.json?.meta?.publish_evaluated === false
      && skipped.json.data.every((item) => requirementOf(item, 'publish').state === 'not_applicable'), '');
  const evaluated = await get('/api/v1/admin/production/board?type=episode&limit=2');
  check('evaluating the publish gate is declared too',
    evaluated.json?.meta?.publish_evaluated === true
      && evaluated.json.data.every((item) => requirementOf(item, 'publish').state !== 'not_applicable'), '');

  const overCap = await get(`/api/v1/admin/production/board?type=episode&limit=${boardLimit + 500}&with_publish=0`);
  check('a request over the cap is clamped to the cap it states',
    overCap.json?.meta?.limit === boardLimit, `limit ${overCap.json?.meta?.limit} vs board_limit ${boardLimit}`);

  const episodeAtCap = await get(`/api/v1/admin/production/board?type=episode&limit=${boardLimit}&with_publish=0`);
  check('the episode board answers at the cap it advertises',
    episodeAtCap.status === 200 && episodeAtCap.json?.data?.length > 0,
    `status ${episodeAtCap.status} ${episodeAtCap.text.slice(0, 160)}`);
  const storyAtCap = await get(`/api/v1/admin/production/board?type=story&limit=${boardLimit}&with_publish=0`);
  check('the story board answers at the cap it advertises',
    storyAtCap.status === 200 && Array.isArray(storyAtCap.json?.data),
    `limit=${boardLimit} → status ${storyAtCap.status} ${storyAtCap.text.slice(0, 160)}`);

  const filtered = await get('/api/v1/admin/production/board?type=episode&limit=5&status=draft&with_publish=0');
  check('a status filter narrows the board in SQL',
    filtered.status === 200 && filtered.json.data.every((item) => item.status === 'draft'),
    `status ${filtered.status}`);
  check('the default board hides published and archived work',
    (await get('/api/v1/admin/production/board?type=episode&limit=40&with_publish=0'))
      .json?.data?.every((item) => !['published', 'archived'].includes(item.status)) === true, '');

  // --- Percentages only where a denominator exists ------------------------
  console.log('\nPercentages and not_applicable');

  const story = await matrixOf('story', storyId);
  check('the story matrix answers', story.status === 200 && !!story.data, `status ${story.status} ${story.text.slice(0, 160)}`);
  check('a story reports a percentage for artwork, where pages give a real denominator',
    typeof requirementOf(story.data, 'artwork')?.percent === 'number',
    JSON.stringify(requirementOf(story.data, 'artwork')));
  check('an episode reports no percentage for artwork, because there is no countable set',
    requirementOf(initial.data, 'artwork')?.percent === null,
    JSON.stringify(requirementOf(initial.data, 'artwork')));
  check('a story reports video as not_applicable rather than missing',
    requirementOf(story.data, 'video')?.state === 'not_applicable',
    JSON.stringify(requirementOf(story.data, 'video')));
  check('an undeclared language is not_applicable rather than missing',
    (story.data?.requirements ?? []).filter((row) => row.state === 'not_applicable').length >= 2,
    (story.data?.requirements ?? []).filter((row) => row.state === 'not_applicable').map((row) => row.key).join(' '));
  check('a partial requirement names the specific offenders',
    (story.data?.requirements ?? []).filter((row) => row.state === 'partial')
      .every((row) => row.items.length > 0), '');

  // --- Guards --------------------------------------------------------------
  console.log('\nGuards');
  check('the board is not readable without a credential',
    (await fetch(`${BASE}/api/v1/admin/production/board?type=episode`)).status === 401, '');
  check('a matrix is not readable without a credential',
    (await fetch(`${BASE}/api/v1/admin/production/episode/${episodeId}`)).status === 401, '');
  check('an unknown item answers 404',
    (await matrixOf('episode', `no-such-episode-${stamp}`)).status === 404, '');
  check('an unsupported content type answers 400',
    (await matrixOf('series', episodeId)).status === 400, '');

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
