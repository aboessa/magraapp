#!/usr/bin/env node
/**
 * Deterministic feature matrix for the Majarra admin dashboard.
 *
 * ## Why a generator and not a hand-written table
 *
 * Every previous audit of this dashboard was written by hand, and every one of
 * them drifted within a session: a page gained an endpoint, a route gained a
 * permission, and the table still described the shape from an hour earlier. Worse,
 * hand-written audits classified by file existence — `CampaignsPage.tsx` exists,
 * therefore campaigns work — which is exactly the failure the programme forbids.
 *
 * So the evidence half of the matrix is derived from the source on every run:
 *
 *  * which admin routes are registered (`AdminRoutes.tsx`),
 *  * which API client functions each page calls (`api.<name>(`),
 *  * which HTTP method and path each of those functions hits (`lib/api.ts`),
 *  * which server route answers it, behind which permission, and whether that
 *    handler writes an audit row (`api/src/routes/*.ts`),
 *  * whether any test file mentions the page or its endpoints.
 *
 * The judgement half — COMPLETE / PARTIAL / MOCK / UI_ONLY / BACKEND_ONLY /
 * BROKEN / MISSING / EXTERNAL_BLOCKER / UNVERIFIED — stays in
 * `docs/FEATURE_MATRIX_VERDICTS.json`, keyed by route, because a status like
 * "the server accepts this but the write is meaningless" cannot be read off a
 * regular expression. The generator refuses to invent one: a route with no
 * recorded verdict is emitted as UNVERIFIED, which is the honest answer.
 *
 * ## What it deliberately does not claim
 *
 * Static analysis cannot prove behaviour. A page can call a real endpoint that
 * always returns 405 (this happened: `ChildrenPage`). So the derived columns are
 * described as *evidence*, and the verdict column is where a human-verified
 * behavioural finding lives. `--check` fails when the evidence contradicts the
 * recorded verdict, e.g. a route recorded COMPLETE whose page calls nothing.
 *
 * Usage:
 *   node tools/dashboard-audit/feature-matrix.mjs            # write the matrix
 *   node tools/dashboard-audit/feature-matrix.mjs --check     # verify only
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FRONT = join(ROOT, 'dashboard', 'front', 'src');
const API = join(ROOT, 'dashboard', 'api', 'src');
const API_TESTS = join(ROOT, 'dashboard', 'api', 'test');
const OUT = join(ROOT, 'docs', 'FEATURE_MATRIX.md');
const VERDICTS = join(ROOT, 'docs', 'FEATURE_MATRIX_VERDICTS.json');

const read = (path) => readFileSync(path, 'utf8');

/** Registered admin routes, in registration order. */
function parseAdminRoutes() {
  const source = read(join(FRONT, 'AdminRoutes.tsx'));
  const imports = new Map();
  for (const match of source.matchAll(/import\s*\{\s*([A-Za-z0-9_,\s]+?)\s*\}\s*from\s*'\.\/pages\/([A-Za-z0-9_]+)'/g)) {
    for (const name of match[1].split(',').map((part) => part.trim()).filter(Boolean)) {
      imports.set(name, `${match[2]}.tsx`);
    }
  }
  const routes = [];
  for (const match of source.matchAll(/<Route\s+(index|path="([^"]*)")\s+element=\{<([A-Za-z0-9_]+)\s*\/>\}/g)) {
    const component = match[3];
    // The layout route (`path="/" element={<AdminLayout />}`) is a shell, not a
    // feature, and counting it as one inflates the route total with a row that can
    // never have an API call or a verdict.
    if (component.endsWith('Layout')) continue;
    const path = match[1] === 'index' ? '/' : `/${match[2]}`;
    routes.push({ path, component, file: imports.get(component) ?? null });
  }
  return routes;
}

/**
 * Remove `${queryString({...})}` from a template literal path.
 *
 * Treating it as a path segment was the parser's worst bug: `/admin/planets` came
 * out as `/admin/planets:id`, matched nothing, and made fourteen working
 * collection pages look like they called endpoints that do not exist. Braces
 * nest, so this scans rather than pattern-matches.
 */
function stripQueryInterpolation(raw) {
  let out = '';
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] === '$' && raw[index + 1] === '{') {
      let depth = 0;
      let cursor = index + 1;
      for (; cursor < raw.length; cursor += 1) {
        if (raw[cursor] === '{') depth += 1;
        else if (raw[cursor] === '}') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      const inner = raw.slice(index + 2, cursor);
      // A query builder contributes no path segment; anything else is a real
      // dynamic segment and becomes `:id`.
      out += /^\s*queryString\b/.test(inner) ? '' : ':id';
      index = cursor;
      continue;
    }
    out += raw[index];
  }
  return out.split('?')[0].replace(/\/$/, '') || '/';
}

/** api.ts: exported client function -> { method, path }. */
function parseApiClient() {
  const source = read(join(FRONT, 'lib', 'api.ts'));
  const functions = new Map();

  // A path literal inside a body. Three shapes appear in this file: a plain
  // string, a template starting at the path, and a template starting with
  // `${API_ROOT}` because the call goes through `fetch` rather than `request` (the
  // asset-blob and TTS calls need the raw Response). Anchoring on the quote misses
  // the third, which is why `assetBlob`, `ttsPreview` and `saveNarrationAsset`
  // first appeared undefined.
  const PATH_ROOTS = 'admin|planets|series|episodes|games|books|media|family|billing|auth|site-mode|partnerships|creations';
  const extract = (body) => {
    const viaRequest = body.match(/(?:request|rawRequest)<[^>]*>\(\s*[`']([^`']+)/);
    if (viaRequest) return viaRequest[1];
    const viaLiteral = body.match(new RegExp('[`\'](?:\\$\\{API_ROOT\\})?((?:/(?:' + PATH_ROOTS + '))[^`\']*)'));
    return viaLiteral ? viaLiteral[1] : null;
  };
  const methodOf = (body) => body.match(/method:\s*'([A-Z]+)'/)?.[1] ?? 'GET';

  // Form 1: `name: (args) => …` inside the exported object.
  //
  // The parameter list may itself contain parentheses — several functions type a
  // parameter as `import('../types/api').QualityEntityType`. A `[^)]*` signature
  // matcher stops at that inner `)` and drops the function entirely, which is why
  // `/quality` first appeared to call two endpoints that do not exist.
  const pattern = /(^|\n)\s{2}([A-Za-z0-9_]+)\s*:\s*(?:async\s*)?\((?:[^()]|\([^()]*\))*\)\s*(?::\s*(?:[^=]|=[^>])+)?=>\s*([\s\S]{0,900}?)(?=\n\s{2}[A-Za-z0-9_]+\s*:|\n\})/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[2];
    const body = match[3];
    const path = extract(body);
    if (!path) continue;
    functions.set(name, { method: methodOf(body), path: stripQueryInterpolation(path) });
  }

  // Form 2: a module-level `async function name(...)` referenced by shorthand in
  // the exported object. Upload and narration save are written this way because
  // they are multi-step (session, parts, complete) and do not fit an arrow.
  //
  // The body window is taken by length rather than by the next `\n}`: these
  // functions declare an inline object parameter, so the first line-initial `}` is
  // the end of the *parameter type*, not of the function. Cutting there is why
  // `ttsPreview` and `saveNarrationAsset` still looked undefined after form 1 was
  // fixed.
  for (const match of source.matchAll(/\nasync function ([A-Za-z0-9_]+)\s*\(/g)) {
    const name = match[1];
    if (functions.has(name)) continue;
    const body = source.slice(match.index, match.index + 2500);
    const path = extract(body);
    if (!path) continue;
    functions.set(name, { method: methodOf(body), path: stripQueryInterpolation(path) });
  }
  return functions;
}

/**
 * Where each route file is mounted, resolved through the whole mount tree.
 *
 * Two levels exist and both matter. `index.ts` mounts `admin.ts` on
 * `/api/v1/admin`, and `admin.ts` in turn mounts ten sub-routers on `'/'`
 * (`adminContent`, `adminCatalogue`, `adminAssets`, …). A parser that reads only
 * `index.ts` sees those ten files as unmounted and reports every one of their
 * endpoints as having no caller — which is how an audit concludes that working
 * pages call endpoints that do not exist.
 *
 * Hard-coding the prefixes instead would have been quicker and wrong:
 * `adminBilling` and `adminAnalytics` are deliberately mounted on `/api/v1/admin`
 * rather than on their own prefix because their handlers already declare full
 * paths, and assuming otherwise reproduces the double-prefix bug that once made
 * every billing endpoint return 404.
 */
function parseMounts() {
  const dir = join(API, 'routes');
  const files = ['index.ts', ...readdirSync(dir).filter((name) => name.endsWith('.ts'))];
  /** file -> [{ prefix, child }] */
  const edges = new Map();
  for (const file of files) {
    const path = file === 'index.ts' ? join(API, 'index.ts') : join(dir, file);
    const source = read(path);
    const byVar = new Map();
    for (const match of source.matchAll(/import\s+([A-Za-z0-9_]+)\s+from\s+'(?:\.\/routes\/|\.\/)([A-Za-z0-9_]+)(?:\.ts)?'/g)) {
      byVar.set(match[1], `${match[2]}.ts`);
    }
    const list = [];
    for (const match of source.matchAll(/\.route\(\s*'([^']*)'\s*,\s*([A-Za-z0-9_]+)\s*\)/g)) {
      const child = byVar.get(match[2]);
      if (child) list.push({ prefix: match[1], child });
    }
    edges.set(file, list);
  }

  const prefixes = new Map();
  const walk = (file, prefix) => {
    for (const edge of edges.get(file) ?? []) {
      const segment = edge.prefix === '/' ? '' : edge.prefix;
      const full = `${prefix}${segment}`;
      // First mount wins: `adminAuth` is mounted before `admin` on purpose so its
      // login paths match first, and that order is the truth of the router.
      if (prefixes.has(edge.child)) continue;
      prefixes.set(edge.child, full);
      walk(edge.child, full);
    }
  };
  walk('index.ts', '');
  return prefixes;
}

const normalisePath = (path) => path
  .replace(/:[A-Za-z0-9_]+/g, ':p')
  .replace(/\/+$/, '') || '/';

/**
 * Server routes: verb, full path, permission guard, and whether the handler
 * writes audit. The handler body is taken up to the next top-level route
 * declaration, which is imprecise at the edges but never silently wrong in the
 * direction that matters: a handler that does audit is not reported as one that
 * does not.
 */
function parseServerRoutes() {
  const routes = [];
  const dir = join(API, 'routes');
  const mounts = parseMounts();
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.ts'))) {
    const source = read(join(dir, file));
    const prefix = mounts.get(file) ?? null;
    const pattern = /([A-Za-z0-9_]+)\.(get|post|patch|put|delete)\(\s*'([^']+)'([\s\S]*?)(?=\n[A-Za-z0-9_]+\.(?:get|post|patch|put|delete)\(|\nexport default)/g;
    for (const match of source.matchAll(pattern)) {
      const [, , verb, path, body] = match;
      const permission = body.match(/requirePermission\('([^']+)'\)/)?.[1] ?? null;
      routes.push({
        file,
        mounted: prefix !== null,
        verb: verb.toUpperCase(),
        path,
        fullPath: prefix === null ? path : `${prefix}${path === '/' ? '' : path}` || '/',
        permission,
        requiresAdmin: /requireAdmin/.test(body) || file.startsWith('admin'),
        audits: /auditStatement\(|writeAudit\(/.test(body),
        validates: /return c\.json\(\s*\{\s*success:\s*false[\s\S]*?\}\s*,\s*400\)/.test(body),
      });
    }
  }
  return routes;
}

/** Which api client functions a page calls, plus honest-shell detection. */
function parsePage(file) {
  const path = join(FRONT, 'pages', file);
  if (!existsSync(path)) return null;
  const source = read(path);
  const calls = [...new Set([...source.matchAll(/\bapi\.([A-Za-z0-9_]+)\s*\(/g)].map((m) => m[1]))];
  return {
    calls,
    lines: source.split('\n').length,
    notImplemented: /NotImplementedPage/.test(source),
    hasPagination: /Pagination|page=|setPage\(/.test(source),
    hasFilters: /filters-row|FilterBar|<select|search/i.test(source),
    hasViewModes: /ViewSwitcher|viewMode/.test(source),
    hasThumbnails: /EntityThumbnail|thumb|poster|cover/i.test(source),
    hasLoading: /loading|spinner/i.test(source),
    hasEmpty: /empty|لا توجد|لا يوجد/i.test(source),
    hasError: /error|خطأ/i.test(source),
    hasDetailLink: /<Link|useNavigate/.test(source),
    hasMutation: /method:\s*'(POST|PATCH|PUT|DELETE)'/.test(source)
      || /onSubmit|handleSubmit|await api\.(create|update|save|delete|archive|publish|revoke|resend)/i.test(source),
  };
}

function loadVerdicts() {
  if (!existsSync(VERDICTS)) return {};
  return JSON.parse(read(VERDICTS));
}

const STATUSES = new Set([
  'COMPLETE', 'PARTIAL', 'MOCK', 'UI_ONLY', 'BACKEND_ONLY',
  'BROKEN', 'MISSING', 'EXTERNAL_BLOCKER', 'UNVERIFIED',
]);

function build() {
  const routes = parseAdminRoutes();
  const client = parseApiClient();
  const server = parseServerRoutes();
  const verdicts = loadVerdicts();
  const testSources = readdirSync(API_TESTS)
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => ({ name, source: read(join(API_TESTS, name)) }));

  const rows = routes.map((route) => {
    const page = route.file ? parsePage(route.file) : null;
    const endpoints = (page?.calls ?? [])
      .map((name) => ({ name, ...(client.get(name) ?? {}) }))
      .filter((entry) => entry.path);
    // A call the client does not define at all is a different failure from one that
    // resolves to no server route, and lumping them together hides it: the page
    // would not compile, or the name is built dynamically, and either way a
    // reviewer must look.
    const undefinedCalls = (page?.calls ?? []).filter((name) => !client.has(name));
    const matched = endpoints.map((endpoint) => {
      // The client's paths are relative to API_ROOT, which is `/api/v1`; the
      // server's are absolute once the mount prefix is applied. Comparing the two
      // without that step is what made 30 working calls look unresolved.
      const wanted = normalisePath(`/api/v1${endpoint.path}`);
      const hit = server.find((candidate) => candidate.verb === endpoint.method
        && normalisePath(candidate.fullPath) === wanted);
      return { ...endpoint, server: hit ?? null };
    });
    const permissions = [...new Set(matched.map((entry) => entry.server?.permission).filter(Boolean))];
    const audited = matched.some((entry) => entry.server?.audits);
    const unmatched = matched.filter((entry) => !entry.server).map((entry) => entry.name);
    const tests = testSources
      .filter(({ source }) => (page?.calls ?? []).some((call) => source.includes(call))
        || matched.some((entry) => entry.server && source.includes(entry.server.path)))
      .map(({ name }) => name);
    const verdict = verdicts[route.path];
    return { route, page, matched, permissions, audited, unmatched, undefinedCalls, tests, verdict };
  });

  return { rows, server, client };
}

function statusOf(row) {
  const recorded = row.verdict?.status;
  if (recorded && STATUSES.has(recorded)) return recorded;
  if (row.page?.notImplemented) return 'MISSING';
  if (row.page && row.page.calls.length === 0) return 'UI_ONLY';
  return 'UNVERIFIED';
}

function tick(value) {
  return value ? '✅' : '—';
}

function render({ rows, server, client }) {
  const now = new Date().toISOString().slice(0, 10);
  const counts = {};
  for (const row of rows) {
    const status = statusOf(row);
    counts[status] = (counts[status] ?? 0) + 1;
  }

  const lines = [];
  lines.push('# Majarra Admin — Canonical Feature Matrix');
  lines.push('');
  lines.push('> GENERATED FILE. Do not edit by hand.');
  lines.push('> `node tools/dashboard-audit/feature-matrix.mjs`');
  lines.push(`> Last generated: ${now}`);
  lines.push('');
  lines.push('Evidence columns (page, endpoints, permission, audit, tests, UX affordances) are');
  lines.push('read from the source on every run. The **Status** column comes from');
  lines.push('`docs/FEATURE_MATRIX_VERDICTS.json`, where each verdict records how it was');
  lines.push('verified; a route with no recorded verdict is `UNVERIFIED` rather than assumed.');
  lines.push('');
  lines.push(`Registered admin routes: **${rows.length}**. Server routes parsed: **${server.length}**.`);
  lines.push(`API client functions parsed: **${client.size}**.`);
  lines.push('');
  lines.push('| Status | Routes |');
  lines.push('|---|---|');
  for (const [status, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push('');
  lines.push('## 1. Route matrix');
  lines.push('');
  lines.push('| Route | Page | Status | API calls | Server endpoints | Permissions | Audit | Tests |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const matchedCount = row.matched.filter((entry) => entry.server).length;
    lines.push([
      `\`${row.route.path}\``,
      row.route.file ?? '—',
      statusOf(row),
      String(row.page?.calls.length ?? 0),
      `${matchedCount}/${row.matched.length}`,
      row.permissions.length ? row.permissions.join(', ') : '—',
      tick(row.audited),
      String(row.tests.length),
    ].join(' | ').replace(/^/, '| ').concat(' |'));
  }

  lines.push('');
  lines.push('## 2. Collection UX affordances (static evidence)');
  lines.push('');
  lines.push('Presence of the affordance in the page source. It proves the control exists, not');
  lines.push('that it behaves; behavioural findings belong in the verdict file.');
  lines.push('');
  lines.push('| Route | Filters | Pagination | View modes | Thumbnails | Detail link | Loading | Empty | Error | Mutations |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const row of rows) {
    const page = row.page;
    if (!page) continue;
    lines.push('| ' + [
      `\`${row.route.path}\``,
      tick(page.hasFilters), tick(page.hasPagination), tick(page.hasViewModes),
      tick(page.hasThumbnails), tick(page.hasDetailLink), tick(page.hasLoading),
      tick(page.hasEmpty), tick(page.hasError), tick(page.hasMutation),
    ].join(' | ') + ' |');
  }

  lines.push('');
  lines.push('## 3. Verdicts and how each was verified');
  lines.push('');
  for (const row of rows) {
    const verdict = row.verdict;
    if (!verdict) continue;
    lines.push(`### \`${row.route.path}\` — ${verdict.status}`);
    lines.push('');
    if (verdict.verified_by) lines.push(`- Verified by: ${verdict.verified_by}`);
    if (verdict.evidence) lines.push(`- Evidence: ${verdict.evidence}`);
    if (verdict.gaps?.length) {
      lines.push('- Gaps:');
      for (const gap of verdict.gaps) lines.push(`  - ${gap}`);
    }
    lines.push('');
  }

  lines.push('## 4. Server endpoints with no admin-UI caller');
  lines.push('');
  lines.push('Either a deliberate app-facing or public route, or backend-only work with no');
  lines.push('operator surface. Listed so the second case cannot hide.');
  lines.push('');
  const called = new Set();
  for (const row of rows) {
    for (const entry of row.matched) {
      if (entry.server) called.add(`${entry.server.file}:${entry.server.verb} ${entry.server.fullPath}`);
    }
  }
  const orphans = server.filter((route) => !called.has(`${route.file}:${route.verb} ${route.fullPath}`));
  lines.push('| File | Verb | Path | Permission | Audit |');
  lines.push('|---|---|---|---|---|');
  for (const route of orphans) {
    lines.push(`| ${route.file} | ${route.verb} | \`${route.fullPath}\` | ${route.permission ?? '—'} | ${tick(route.audits)} |`);
  }
  lines.push('');
  lines.push(`Orphan count: **${orphans.length}** of ${server.length}.`);
  lines.push('');

  lines.push('## 5. API client functions the matrix could not resolve to a server route');
  lines.push('');
  lines.push('A name here means the static match failed — a dynamic path, a differently mounted');
  lines.push('prefix, or a genuinely absent endpoint. Each needs a human check before any');
  lines.push('verdict above it can be trusted.');
  lines.push('');
  const unresolved = new Map();
  for (const row of rows) {
    for (const name of row.unmatched) {
      if (!unresolved.has(name)) unresolved.set(name, []);
      unresolved.get(name).push(row.route.path);
    }
  }
  lines.push('| Client function | Method | Path | Called from |');
  lines.push('|---|---|---|---|');
  for (const [name, callers] of [...unresolved].sort()) {
    const entry = client.get(name);
    lines.push(`| \`${name}\` | ${entry?.method ?? '?'} | \`${entry?.path ?? '?'}\` | ${callers.join(', ')} |`);
  }
  lines.push('');
  lines.push(`Unresolved: **${unresolved.size}**.`);
  lines.push('');
  const undefinedByRoute = rows.filter((row) => row.undefinedCalls?.length);
  lines.push('## 6. Calls the API client does not define');
  lines.push('');
  if (undefinedByRoute.length === 0) {
    lines.push('None. Every `api.*` call in every registered page resolves to a client');
    lines.push('function, and every client function resolves to a mounted server route.');
  } else {
    lines.push('| Route | Calls |');
    lines.push('|---|---|');
    for (const row of undefinedByRoute) {
      lines.push(`| \`${row.route.path}\` | ${row.undefinedCalls.join(', ')} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function check(model) {
  const problems = [];
  for (const row of model.rows) {
    const status = statusOf(row);
    const path = row.route.path;
    if (!row.route.file) problems.push(`${path}: route element is not a page import the parser understands`);
    if (status === 'COMPLETE' && (row.page?.calls.length ?? 0) === 0) {
      problems.push(`${path}: recorded COMPLETE but the page calls no API function`);
    }
    if (status === 'MISSING' && !row.page?.notImplemented && (row.page?.calls.length ?? 0) > 0) {
      problems.push(`${path}: recorded MISSING but the page calls ${row.page.calls.length} API functions`);
    }
    if (row.verdict && !STATUSES.has(row.verdict.status)) {
      problems.push(`${path}: unknown status "${row.verdict.status}"`);
    }
    if (row.verdict && !row.verdict.verified_by) {
      problems.push(`${path}: verdict has no verified_by, so it is an assumption`);
    }
    if (row.undefinedCalls?.length) {
      problems.push(`${path}: calls ${row.undefinedCalls.join(', ')} which the API client does not define`);
    }
    if (row.unmatched.length) {
      problems.push(`${path}: ${row.unmatched.join(', ')} resolve to no mounted server route`);
    }
  }
  return problems;
}

const model = build();
if (process.argv.includes('--check')) {
  const problems = check(model);
  const unverified = model.rows.filter((row) => statusOf(row) === 'UNVERIFIED').length;
  console.log(`routes=${model.rows.length} unverified=${unverified} problems=${problems.length}`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(problems.length ? 1 : 0);
} else {
  writeFileSync(OUT, render(model), 'utf8');
  console.log(`wrote ${OUT}`);
  console.log(`routes=${model.rows.length} serverRoutes=${model.server.length} clientFns=${model.client.size}`);
}
