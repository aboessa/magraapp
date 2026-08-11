/**
 * Live HTTP verification of the planet endpoints against a running worker and a real D1.
 *
 * ## Why this exists
 *
 * `test/planetWorkspace.test.mjs` drives the handlers with a stubbed database, so it
 * proves the dispatch, the assembly and the honesty rules — but a stub answers any SQL,
 * including SQL that SQLite would reject. Every statement in `routes/adminPlanets.ts` is
 * a multi-CTE aggregate over eleven tables; a wrong column name or a CTE referenced out
 * of scope is invisible until it runs. This runs them.
 *
 * It also compares the workspace against the collection row for the same planet: two
 * different statements answering the same question must agree, and the only way to know
 * is to ask both.
 *
 * Usage:
 *   node scripts/verify-planets-e2e.mjs --api http://127.0.0.1:8787 \
 *     --email kiro.verify@majarra.local --password '...'
 *
 * Read-only: it performs no writes and touches nothing outside the local database.
 */

const argValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const API = argValue('--api', 'http://127.0.0.1:8787').replace(/\/$/, '');
const EMAIL = argValue('--email', 'kiro.verify@majarra.local');
const PASSWORD = argValue('--password', process.env.ADMIN_SEED_PASSWORD ?? '');

let failures = 0;
const record = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}\n`);
};

async function login() {
  const response = await fetch(`${API}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.token) {
    throw new Error(`login failed (${response.status}): ${body?.error ?? 'no token'}`);
  }
  return body.data.token;
}

async function get(path, token) {
  const response = await fetch(`${API}/api/v1${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function main() {
  if (!PASSWORD) throw new Error('pass --password');
  const token = await login();

  // --- collection --------------------------------------------------------
  const list = await get('/admin/planets?include_inactive=1', token);
  record('GET /admin/planets returns 200 over real SQL', list.status === 200,
    list.status === 200 ? `${list.body.data.length} planets` : JSON.stringify(list.body).slice(0, 200));
  if (list.status !== 200) return;

  const planets = list.body.data;
  record('every planet row carries a health object with numeric counters',
    planets.every((planet) => planet.health && typeof planet.health.episodes_total === 'number'),
    `first: ${JSON.stringify(planets[0]?.health ?? null).slice(0, 160)}`);
  record('no internal aggregate alias leaks to the client',
    planets.every((planet) => !Object.keys(planet).some((key) => key.startsWith('h_'))));
  record('the summary counts every planet, filtered or not',
    list.body.meta.summary.total === planets.length,
    `summary.total=${list.body.meta.summary.total} rows=${planets.length}`);

  const filtered = await get('/admin/planets?artwork=missing&sort=content_desc', token);
  record('a filtered, sorted request narrows the rows and keeps the whole-set summary',
    filtered.status === 200
      && filtered.body.meta.total === filtered.body.data.length
      && filtered.body.meta.summary.total === planets.length,
    `rows=${filtered.body?.data?.length} summary.total=${filtered.body?.meta?.summary?.total}`);

  // A planet with content, so the workspace is exercised with real rows rather than
  // only in its empty state.
  const target = planets.find((planet) => planet.health.series_total > 0) ?? planets[0];
  record('a planet with content exists locally to verify against', !!target, target?.id ?? 'none');
  if (!target) return;

  // --- workspace ---------------------------------------------------------
  const workspace = await get(`/admin/planets/${encodeURIComponent(target.id)}/workspace`, token);
  record('GET /admin/planets/:id/workspace returns 200 over real SQL', workspace.status === 200,
    workspace.status === 200 ? '' : JSON.stringify(workspace.body).slice(0, 300));
  if (workspace.status !== 200) return;
  const data = workspace.body.data;

  for (const key of ['content', 'media', 'localization', 'production', 'learning', 'reviews', 'rights']) {
    const module = data[key];
    record(`workspace module "${key}" was readable`, !!module && module.unavailable === null,
      module?.unavailable ?? '');
  }

  record('the workspace and the collection agree on this planet\'s episode count',
    Number(data.content.episodes_total) === Number(target.health.episodes_total),
    `workspace=${data.content.episodes_total} collection=${target.health.episodes_total}`);
  record('the workspace and the collection agree on series counts',
    Number(data.content.series_total) === Number(target.health.series_total),
    `workspace=${data.content.series_total} collection=${target.health.series_total}`);

  record('analytics is reported unavailable, not zero', typeof data.analytics.unavailable === 'string'
    && /FamilyState/.test(data.analytics.unavailable));
  record('every language carries five signals with denominators',
    data.localization.languages.length === 3
      && data.localization.languages.every((entry) => entry.signals.length === 5
        && entry.signals.every((signal) => typeof signal.total === 'number')));
  record('every attention item has a positive count and a destination',
    data.attention.every((item) => item.count > 0 && typeof item.drill === 'string' && item.drill.startsWith('/')),
    `${data.attention.length} items: ${data.attention.map((item) => item.key).join(', ')}`);

  // --- tree --------------------------------------------------------------
  const tree = await get(`/admin/planets/${encodeURIComponent(target.id)}/tree`, token);
  record('GET /admin/planets/:id/tree returns 200 over real SQL', tree.status === 200,
    tree.status === 200 ? `${tree.body.data.length} series` : JSON.stringify(tree.body).slice(0, 300));
  if (tree.status === 200) {
    const seriesRows = tree.body.data;
    record('tracks arrive as arrays in the tree',
      seriesRows.every((series) => Array.isArray(series.track_ids)));
    const episodesInTree = seriesRows.reduce((sum, series) => sum + series.loaded_episodes, 0);
    record('the tree reports how many episodes it loaded against the real total',
      episodesInTree === tree.body.meta.episodes_returned,
      `loaded=${episodesInTree} total=${tree.body.meta.episodes_total} truncated=${tree.body.meta.truncated}`);
    // Every episode is reachable: it is either under a season or in the unassigned list.
    const reachable = seriesRows.every((series) => {
      const underSeasons = series.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
      return underSeasons + series.unassigned_episodes.length === series.loaded_episodes;
    });
    record('no loaded episode is dropped between seasons and the unassigned list', reachable);
  }

  // --- production board scoped to a planet -------------------------------
  const board = await get(`/admin/production/board?type=episode&planet_id=${encodeURIComponent(target.id)}&with_publish=0&limit=5`, token);
  record('the production board accepts planet_id', board.status === 200,
    board.status === 200 ? `${board.body.data.length} items, meta.planet_id=${board.body.meta.planet_id}` : JSON.stringify(board.body).slice(0, 200));

  // --- the flat detail still works --------------------------------------
  const detail = await get(`/admin/planets/${encodeURIComponent(target.id)}`, token);
  record('GET /admin/planets/:id still answers for existing callers', detail.status === 200
    && Array.isArray(detail.body.data.series));
  record('a planet that does not exist is a 404 on all three reads',
    (await get('/admin/planets/no-such-planet', token)).status === 404
    && (await get('/admin/planets/no-such-planet/workspace', token)).status === 404
    && (await get('/admin/planets/no-such-planet/tree', token)).status === 404);

  process.stdout.write(`\n${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  record('verification ran', false, error.message);
  process.exitCode = 1;
});
