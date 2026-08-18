import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Regression coverage for the authorization wiring in `src/routes/`.
///
/// ## The gap these tests close
///
/// `adminScope.test.mjs` proves `can()` evaluates a grant against a resource
/// correctly, and it does so thoroughly. But it never asks the next question:
/// **is that check actually attached to the routes that mutate data?**
///
/// It was not, in eight files. `adminTeams.ts` carried twelve handlers and zero
/// permission checks, including `POST /grants` — so any authenticated account,
/// even one holding only `viewer`, could grant itself `owner`. The comment above
/// that router described the danger precisely while the code failed to prevent
/// it. Unit tests on the decision function cannot catch that class of defect;
/// only an assertion about the wiring can.
///
/// ## Why these are source assertions rather than HTTP tests
///
/// Exercising a real request needs D1, KV, R2, Durable Objects and queues. The
/// suite runs on plain `node --test` with no Workers runtime, so an integration
/// harness would be a separate piece of infrastructure. Reading the router
/// source is a weaker check than a live 403, but it pins the property that
/// actually regressed — a handler added without a guard — and it fails loudly
/// the moment someone writes one.
///
/// A guard registered across two lines would be reported as missing. That is a
/// deliberate bias: a false alarm on this is cheap and obvious to fix, while a
/// missed unguarded mutation is not.

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));

const read = (file) => readFileSync(routesDir + file, 'utf8');

/// Comments are removed before asserting on code, because prose *about* a fixed
/// defect otherwise reads as the defect itself. This is not hypothetical: the
/// doc comment on the workflow-review handler quotes the old
/// `body.reviewer_id || 'admin'` expression, and a naive substring search
/// reports the bug as still present.
///
/// ## Order matters, and getting it wrong hid real routes
///
/// Line comments must go first. `adminFamilyProjection.ts` contains the path
/// `/api/v1/admin/*` inside a `///` comment; that `/*` pairs with the next `*/`
/// in the file and the block rule then deletes everything between them —
/// including three live `route.post('/children', ...)` registrations.
///
/// This is the sweep silently examining less than it claims to, which is the one
/// failure mode that makes a guard test worthless. `test('the guard sweep
/// actually inspected the routers')` exists to catch the general case.
function stripComments(source) {
  return source
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

const adminRouterFiles = readdirSync(routesDir)
  .filter((name) => name.startsWith('admin') && name.endsWith('.ts'))
  .sort();

/// Every other router. These serve the app, not the dashboard.
///
/// ## Why the sweep could not stay admin-only
///
/// The filter above is a file-name test, so a mutation placed in a non-admin
/// file was structurally invisible to this suite. That is not hypothetical:
/// `recommendations.ts` carried `POST /admin` with no authentication at all —
/// its only authorization was a comment reading "reuse requireAdmin via
/// parentAuth? simple check" — and it wrote rows that
/// `GET /api/v1/recommendations` serves straight into children's home rails.
/// An anonymous caller could pin arbitrary content into every child's feed, and
/// the one test written to catch exactly this class of defect skipped the file
/// because of its name.
///
/// Public routers guard inside the handler rather than with router middleware,
/// so the assertion differs: a mutating handler must reach an authentication
/// helper somewhere in its body, or be listed as deliberately anonymous.
const publicRouterFiles = readdirSync(routesDir)
  .filter((name) => name.endsWith('.ts') && !name.startsWith('admin'))
  .sort();

const MUTATING = ['post', 'put', 'patch', 'delete'];

/// Every mutating handler in a router, paired with whatever guard sits between
/// its path and its callback.
function mutatingHandlers(file) {
  const source = stripComments(read(file));
  const pattern = new RegExp(String.raw`\.(${MUTATING.join('|')})\(\s*'([^']+)'`, 'g');
  const found = [];

  for (const match of source.matchAll(pattern)) {
    const rest = source.slice(match.index + match[0].length);
    // Bounded at the line end: see the note above on multi-line registrations.
    const argumentList = rest.slice(0, rest.indexOf('\n') === -1 ? rest.length : rest.indexOf('\n'));
    const permission = argumentList.match(/requirePermission\('([a-z_]+)'\)/);

    found.push({
      file,
      method: match[1].toUpperCase(),
      path: match[2],
      permission: permission ? permission[1] : null,
      // `readOnly` returns 405 unconditionally, so it is guarded by refusing
      // the whole verb rather than by checking a permission.
      readOnly: /\breadOnly\b/.test(argumentList),
      signature: `${file} ${match[1].toUpperCase()} ${match[2]}`,
    });
  }

  return found;
}

const allMutations = adminRouterFiles.flatMap(mutatingHandlers);

/// Handlers that legitimately carry no `requirePermission`, each with the reason.
///
/// An allowlist rather than a blanket exemption for the file: adding a new
/// mutation to `adminAuth.ts` or `adminUsers.ts` must still fail this suite
/// until it is either guarded or consciously listed here.
const UNGUARDED_BY_DESIGN = new Map([
  // A permission check needs a session, and these are what create or destroy
  // one. Requiring a content permission to log in would be circular.
  ['adminAuth.ts POST /login', 'issues the session a permission check would read'],
  ['adminAuth.ts POST /logout', 'revokes the caller\u2019s own session'],
  ['adminAuth.ts POST /logout-all', 'revokes the caller\u2019s own sessions'],
  ['adminAuth.ts POST /change-password', 'acts on the caller\u2019s own credentials'],

  // Self-scoped session management. There is no user id in the path: each handler
  // resolves the caller from the presented token and constrains every statement
  // to that `user_id`, so there is nothing to authorise beyond holding the
  // session. Requiring a content permission would hide a security screen from
  // ordinary administrators, which is why the pre-existing
  // `GET /users/:id/sessions` (behind manage_permissions, for managing *others*)
  // could not be reused for "my sessions".
  ['adminAuth.ts DELETE /sessions/:id', 'revokes one of the caller\u2019s own sessions'],
  ['adminAuth.ts POST /sessions/revoke-others', 'revokes the caller\u2019s own other sessions'],

  // adminUsers.ts predates requirePermission and guards every mutation with a
  // local canManage() built on hasPermission(user, 'manage_permissions'). The
  // coverage is real; the mechanism differs. Asserted separately below.
  ['adminUsers.ts POST /users', 'canManage(): manage_permissions'],
  ['adminUsers.ts PATCH /users/:id', 'canManage(): manage_permissions'],
  ['adminUsers.ts POST /users/:id/reset-password', 'canManage(): manage_permissions'],
  ['adminUsers.ts POST /users/:id/grants', 'canManage(): manage_permissions'],
  ['adminUsers.ts DELETE /users/:id/grants/:grantId', 'canManage(): manage_permissions'],
  ['adminUsers.ts POST /users/:id/revoke-sessions', 'canManage(): manage_permissions'],
]);

test('every mutating admin handler carries an authorization guard', () => {
  const unguarded = allMutations.filter((handler) => (
    !handler.permission
    && !handler.readOnly
    && !UNGUARDED_BY_DESIGN.has(handler.signature)
  ));

  assert.deepEqual(
    unguarded.map((handler) => handler.signature),
    [],
    'a mutating admin route has no permission check, no 405 refusal, and no recorded exemption',
  );
});

/// Mutating handlers in a public router, paired with the authentication helper
/// reachable inside the handler body.
///
/// The body is bounded by the next route registration rather than by brace
/// counting: a regex cannot balance braces, and stopping at the next
/// `<router>.<verb>(` is both simple and conservative — it can only ever
/// include *more* text than the handler, never less, so a missing auth call is
/// never masked by a truncated window.
const AUTH_MARKERS = /authenticateParent|requireAdmin|requirePermission|verifyMediaToken|verifyGooglePubSubToken|readOnly/;

/// Names of top-level helpers in this file that themselves authenticate.
///
/// Public routers wrap `authenticateParent` in a local helper — `family.ts` uses
/// `principal(c)`, `creations.ts` resolves ownership through its own guard — so a
/// literal search for the imported helper reports every one of those handlers as
/// unauthenticated. Resolving one level of indirection removes ~11 false alarms
/// without weakening the check: the wrapper still has to reach a real helper.
///
/// Declarations are bounded by a closing brace in column zero, which is what a
/// top-level function looks like in this codebase.
function localAuthHelpers(source) {
  const names = new Set();
  const declaration = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/gm;

  for (const match of source.matchAll(declaration)) {
    const name = match[1] ?? match[2];
    const rest = source.slice(match.index);
    const end = rest.search(/\n\}/);
    const body = end === -1 ? rest : rest.slice(0, end);
    if (AUTH_MARKERS.test(body)) names.add(name);
  }

  return names;
}

function publicMutatingHandlers(file) {
  const source = stripComments(read(file));
  const helpers = localAuthHelpers(source);
  const registration = /(\w+)\.(post|put|patch|delete)\(\s*'([^']+)'/g;
  const found = [];

  for (const match of source.matchAll(registration)) {
    const rest = source.slice(match.index + match[0].length);
    const nextRegistration = rest.search(/\n\s*\w+\.(get|post|put|patch|delete)\(\s*'/);
    const body = nextRegistration === -1 ? rest : rest.slice(0, nextRegistration);
    const viaHelper = [...helpers].some((name) => new RegExp(String.raw`\b${name}\s*\(`).test(body));

    found.push({
      file,
      method: match[2].toUpperCase(),
      path: match[3],
      authenticated: AUTH_MARKERS.test(body) || viaHelper,
      signature: `${file} ${match[2].toUpperCase()} ${match[3]}`,
    });
  }

  return found;
}

const publicMutations = publicRouterFiles.flatMap(publicMutatingHandlers);

/// Endpoints that must work without a session, each with the reason.
///
/// Anything not listed here has to reach an authentication helper. Adding an
/// anonymous mutation therefore requires an explicit, reviewed entry rather
/// than passing silently.
const ANONYMOUS_BY_DESIGN = new Map([
  ['auth.ts POST /register', 'creates the account a session would belong to'],
  ['auth.ts POST /login', 'issues the session'],
  ['auth.ts POST /refresh', 'presents a refresh token, not a session'],
  ['auth.ts POST /verify-email', 'presented with a one-time verification token'],
  ['auth.ts POST /resend-verification', 'the caller cannot yet sign in'],
  ['auth.ts POST /forgot-password', 'the caller has lost access by definition'],
  ['auth.ts POST /reset-password', 'presented with a one-time reset token'],
  ['auth.ts POST /logout', 'revokes the presented refresh token'],

  // Authorized by a capability rather than a session: the caller presents a
  // 43-character deletion receipt whose hash is verified inside FamilyState. A
  // deleted account has no session left to authenticate with, which is the
  // whole point of issuing a receipt.
  ['account.ts POST /deletions/status', 'deletion receipt capability, verified in the DO'],

  // Public enquiry form on the marketing site. It writes a partnership request
  // for staff review and reads nothing.
  ['partnerships.ts POST /', 'public partnership enquiry form'],
]);

test('every mutating public handler authenticates or is a recorded exception', () => {
  const unauthenticated = publicMutations.filter((handler) => (
    !handler.authenticated && !ANONYMOUS_BY_DESIGN.has(handler.signature)
  ));

  assert.deepEqual(
    unauthenticated.map((handler) => handler.signature),
    [],
    'a mutating public route neither authenticates nor is recorded as deliberately anonymous',
  );
});

test('the public sweep actually inspected the routers', () => {
  assert.ok(
    publicRouterFiles.length >= 15,
    `expected the public routers, found ${publicRouterFiles.length}`,
  );
  assert.ok(
    publicMutations.length >= 25,
    `expected the public mutations, found ${publicMutations.length}`,
  );
});

test('editorial recommendation writes are an admin capability', () => {
  // The regression this pins: the write used to live on the public router with
  // no authentication, and the read below serves it to children.
  const publicRouter = stripComments(read('recommendations.ts'));
  assert.doesNotMatch(
    publicRouter,
    /\.(post|put|patch|delete)\(/,
    'recommendations.ts must be read-only; editorial writes belong in an admin router',
  );

  const adminRouter = stripComments(read('adminRecommendations.ts'));
  assert.match(adminRouter, /\.use\(\s*'\*'\s*,\s*requireAdmin\s*\)/, 'mounted directly, so it must guard itself');
  assert.match(adminRouter, /requirePermission\('publish'\)/, 'pinning content for a child is a publishing act');
  assert.match(adminRouter, /auditStatement\(/, 'the write must be attributable');
  assert.match(adminRouter, /SELECT id FROM series WHERE id = \?/, 'the series reference must be validated');
});

test('granting a role cannot exceed the actor\u2019s own privilege', () => {
  // canManage() only asks whether the actor may manage permissions at all, so
  // any holder of manage_permissions could mint an `owner` grant and escalate
  // past their own level. The rule is the standard one: you cannot give away a
  // permission you do not hold.
  const source = stripComments(read('adminUsers.ts'));

  assert.match(source, /async function permissionsBeyondActor\(/, 'the privilege comparison must exist');
  assert.match(
    source,
    /SELECT permission_id FROM role_permissions WHERE role_id = \?/,
    'the comparison must read the granted role\u2019s actual permissions',
  );
  assert.match(source, /isSuperuser\(user\)/, 'owner/system_admin already hold everything');

  // And it must be applied on the grant path, before the insert.
  const grantHandler = source.slice(
    source.indexOf("adminUsersRoute.post('/users/:id/grants'"),
    source.indexOf("adminUsersRoute.delete('/users/:id/grants/:grantId'"),
  );
  assert.ok(grantHandler.length > 0, 'the grant handler must exist');
  assert.match(grantHandler, /await permissionsBeyondActor\(/, 'the grant handler must run the comparison');
  assert.ok(
    grantHandler.indexOf('permissionsBeyondActor') < grantHandler.indexOf('INSERT INTO access_grants'),
    'the comparison must run before the grant is written',
  );
  assert.match(grantHandler, /403/, 'an over-privileged grant must be refused, not downgraded');
});

test('an actor cannot remove their own last permission-management grant', () => {
  // Last-owner protection already existed; this is its self-inflicted
  // counterpart. Removing your own manage_permissions grant locks you out of the
  // only screen that could restore it.
  const source = stripComments(read('adminUsers.ts'));

  assert.match(source, /async function wouldLockOutSelf\(/);
  assert.match(
    source,
    /rp\.permission_id = 'manage_permissions'/,
    'the check must count remaining grants that confer permission management',
  );

  const deleteHandler = source.slice(source.indexOf("adminUsersRoute.delete('/users/:id/grants/:grantId'"));
  assert.match(deleteHandler, /id === actorId\(c\) && await wouldLockOutSelf\(/);
  assert.ok(
    deleteHandler.indexOf('wouldLockOutSelf') < deleteHandler.indexOf('DELETE FROM access_grants'),
    'the check must run before the grant is deleted',
  );
  // The pre-existing last-owner rule must survive alongside it.
  assert.match(deleteHandler, /role_id = 'owner' AND grantee_type = 'user'/);
});

test('the guard sweep actually inspected the routers', () => {
  // Without this, a regex that silently stops matching turns the sweep above
  // into a test that passes by examining nothing.
  assert.ok(adminRouterFiles.length >= 15, `expected the admin routers, found ${adminRouterFiles.length}`);
  assert.ok(allMutations.length >= 90, `expected ~96 mutating handlers, found ${allMutations.length}`);
  assert.ok(
    allMutations.filter((handler) => handler.permission).length >= 80,
    'almost every mutation should resolve to a named permission',
  );
});

/// The mutations where a missing or mis-scoped guard is worst, pinned exactly.
///
/// A sweep proves *a* guard exists. It does not prove the guard is the right
/// one — `POST /grants` behind `view` would satisfy the sweep and still hand out
/// ownership.
const CRITICAL_GUARDS = [
  // Granting a role is the privilege-escalation path. manage_permissions is
  // held only by owner and system_admin: migration 0019 gives planet_manager
  // every permission except this one.
  ['adminTeams.ts', 'POST', '/grants', 'manage_permissions'],
  ['adminTeams.ts', 'DELETE', '/grants/:id', 'manage_permissions'],
  // Approving a workflow step is the separation-of-duties boundary.
  ['adminTeams.ts', 'POST', '/workflows/runs/:id/review', 'approve'],
  ['adminTeams.ts', 'POST', '/teams', 'manage_team'],
  // A remote-config value reaches every live app immediately, with no review
  // and no schedule. That is a publish, not a metadata edit.
  ['adminAppExperience.ts', 'PUT', '/remote-config/:key', 'publish'],
  ['adminAppExperience.ts', 'POST', '/devices/:id/revoke', 'archive'],
  // Toggling site mode hides the platform from every visitor.
  ['adminSiteMode.ts', 'PUT', '/', 'publish'],
  ['adminSiteMode.ts', 'POST', '/reset', 'publish'],
  // Restore is destructive by intent, even while it returns 501.
  ['adminBackup.ts', 'POST', '/restore', 'publish'],
  // Recording a review decision is a quality-control act.
  ['adminCatalogue.ts', 'POST', '/content-reviews', 'review'],
  ['adminCatalogue.ts', 'PATCH', '/content-reviews/:id', 'review'],
  // Narration preview spends real money on a paid Google API per call.
  ['adminTts.ts', 'POST', '/tts/preview', 'upload_audio'],
  // Content-factory spend approval and paid execution are distinct privilege boundaries.
  ['adminContentFactory.ts', 'POST', '/production/factory/:runId/approve-spend', 'approve'],
  ['adminContentFactory.ts', 'POST', '/production/factory/:runId/dispatch', 'publish'],
  ['adminContentFactory.ts', 'POST', '/production/factory/:runId/resume', 'publish'],
  ['adminContentFactory.ts', 'POST', '/production/factory/:runId/retry-failed', 'publish'],
  // Partnership settings redirect where official enquiries are delivered.
  ['adminPartnerships.ts', 'PUT', '/settings', 'publish'],
];

test('the highest-risk mutations carry their exact permission', () => {
  for (const [file, method, path, expected] of CRITICAL_GUARDS) {
    const handler = allMutations.find((entry) => (
      entry.file === file && entry.method === method && entry.path === path
    ));
    assert.ok(handler, `${file} ${method} ${path} is missing; was it renamed?`);
    assert.equal(
      handler.permission,
      expected,
      `${file} ${method} ${path} should require '${expected}', found '${handler.permission}'`,
    );
  }
});

test('child projection writes are refused outright', () => {
  // The projection is rebuilt from family events. Accepting a write to a child
  // row would be overwritten on the next projection pass, so it fails closed.
  //
  // Scoped to the /children paths rather than the whole file: the same router
  // also owns the dead-letter replay routes, which are real mutations behind a
  // permission. Asserting on the file would force this test to be edited every
  // time a legitimate handler is added, which trains people to loosen it.
  const childWrites = allMutations.filter((handler) => (
    handler.file === 'adminFamilyProjection.ts' && handler.path.startsWith('/children')
  ));
  assert.equal(childWrites.length, 3);
  for (const handler of childWrites) {
    assert.ok(handler.readOnly, `${handler.signature} should be refused, not guarded by permission`);
  }
});

test('dead-letter recovery routes are guarded mutations, not refusals', () => {
  // The counterpart to the assertion above: these genuinely write, so they must
  // carry a permission rather than the 405 the /children routes return.
  const recovery = allMutations.filter((handler) => (
    handler.file === 'adminFamilyProjection.ts' && handler.path.startsWith('/failed-family-events')
  ));
  assert.equal(recovery.length, 2, 'expected replay and discard');
  for (const handler of recovery) {
    assert.equal(handler.readOnly, false, `${handler.signature} must not be a blanket refusal`);
    assert.equal(handler.permission, 'publish', `${handler.signature} rewrites projected state`);
  }
});

test('adminUsers guards each mutation with manage_permissions', () => {
  const source = stripComments(read('adminUsers.ts'));
  assert.match(
    source,
    /hasPermission\(user, 'manage_permissions'\)/,
    'canManage() must resolve to manage_permissions, not merely to an authenticated session',
  );

  // Every mutation must consult it. A new handler that forgets is the defect.
  for (const handler of allMutations.filter((entry) => entry.file === 'adminUsers.ts')) {
    const start = source.indexOf(`'${handler.path}'`);
    const body = source.slice(start, start + 700);
    assert.match(body, /canManage\(c\)/, `${handler.signature} does not call canManage`);
  }
});

/// Hono middleware belongs to the router instance it is registered on. Mounting
/// a second router at the same prefix does **not** put it behind the first
/// router's `use()`.
///
/// So a router mounted straight onto the app in `index.ts` is unauthenticated
/// unless it mounts `requireAdmin` itself. The routers reached through
/// `admin.ts` inherit that file's guard legitimately.
const INDEPENDENTLY_MOUNTED = [
  'adminBilling.ts',
  'adminAnalytics.ts',
  'adminPartnerships.ts',
  'adminSiteMode.ts',
  'adminUsers.ts',
];

test('independently mounted admin routers authenticate themselves', () => {
  for (const file of INDEPENDENTLY_MOUNTED) {
    assert.match(
      stripComments(read(file)),
      /\.use\(\s*'\*'\s*,\s*requireAdmin\s*\)/,
      `${file} is mounted directly in index.ts, so it does not inherit adminRoute's guard`,
    );
  }
});

test('the login router is the one place without requireAdmin', () => {
  // Stated as an assertion so the exemption stays visible and narrow.
  assert.doesNotMatch(
    stripComments(read('adminAuth.ts')),
    /\.use\(\s*'\*'\s*,\s*requireAdmin\s*\)/,
    'adminAuth issues sessions; requiring one would lock everybody out',
  );
});

test('self-scoped session endpoints cannot reach another user\u2019s sessions', () => {
  // These carry no permission check by design, so the constraint that makes them
  // safe is that every statement is bound to the resolved caller. A handler that
  // took a user id from the path would be an IDOR with no guard in front of it.
  const source = stripComments(read('adminAuth.ts'));
  const start = source.indexOf("adminAuthRoute.get('/sessions'");
  const block = source.slice(start, source.indexOf("adminAuthRoute.post('/logout-all'"));

  assert.ok(start > 0, 'the self-scoped session listing must exist');
  // No user id may appear in any of these paths.
  assert.doesNotMatch(block, /\/users\/:id/, 'a self-scoped endpoint must not accept a user id');
  // Every read and write is bound to the resolved session's user.
  assert.match(block, /WHERE user_id = \?/);
  assert.match(block, /AND user_id = \?/);
  assert.match(block, /user_id = \? AND revoked_at IS NULL AND token_hash <> \?/, 'revoke-others must spare the current session');
  // The raw token is never returned; the current session is identified by hash.
  assert.match(block, /row\.token_hash === currentHash/);
  assert.doesNotMatch(block, /token_hash: row\.token_hash/, 'a token hash must not be sent to the client');
});

test('workflow review takes the reviewer from the session, not the request body', () => {
  const source = stripComments(read('adminTeams.ts'));

  // The original wrote `body.reviewer_id || 'admin'`, so a reviewer could
  // attribute a decision to a colleague, and the fallback was not even a real
  // row in admin_users.
  assert.doesNotMatch(source, /body\.reviewer_id/, 'reviewer identity must not come from the caller');
  assert.doesNotMatch(source, /reviewer_id:\s*'admin'/, 'the placeholder reviewer must be gone');
  assert.match(source, /const reviewerId = actorId\(c\)/, 'the reviewer must be the authenticated session');

  // Self-approval is refused here, not only in adminCatalogue.ts. This handler
  // was a way around the rule the other file enforces.
  assert.match(source, /checkSelfApproval\(/, 'approving a workflow step must apply separation of duties');
  assert.match(source, /SELF_APPROVAL_ERROR/);
});

test('platform settings record the acting session, not a client header', () => {
  // Both files derived the actor solely from X-Admin-Actor, a header the caller
  // writes, defaulting to 'dashboard-admin' — not an id in admin_users. The
  // audit trail for hiding the site or rerouting partner mail was worthless.
  for (const file of ['adminSiteMode.ts', 'adminPartnerships.ts']) {
    const source = stripComments(read(file));
    assert.match(source, /return actorId\(c\)/, `${file} must resolve the actor from the session`);
    assert.doesNotMatch(
      source,
      /function actor\([^)]*\)\s*\{\s*return c\.req\.header/,
      `${file} must not treat a client-supplied header as identity`,
    );
  }
});

test('the shared admin key is only an escape hatch before the first user exists', () => {
  const source = stripComments(readFileSync(
    fileURLToPath(new URL('../src/lib/adminAuth.ts', import.meta.url)),
    'utf8',
  ));

  // Once one account exists the key must stop working, otherwise there are two
  // doors and one of them carries no identity for the audit log.
  assert.match(source, /hasAnyAdminUser\(/);
  assert.match(source, /if \(usersExist\)/, 'the key must be rejected once an admin user is seeded');

  // requirePermission used to `await next()` whenever no user was resolved,
  // which let every unauthenticated request through.
  const permissionGuard = source.slice(source.indexOf('export function requirePermission'));
  assert.match(
    permissionGuard,
    /adminIsLegacyKey/,
    'the legacy key must pass explicitly, never as a side effect of having no user',
  );
  assert.match(permissionGuard, /'Unauthorized'/, 'a request with no identity and no key must fail closed');
});


test('sensitive administration actions use the shared, redacted audit writer', () => {
  const users = stripComments(read('adminUsers.ts'));
  const partnerships = stripComments(read('adminPartnerships.ts'));
  const siteMode = stripComments(read('adminSiteMode.ts'));

  assert.match(users, /auditStatement\(/, 'user-administration audit entries must use central redaction');
  assert.doesNotMatch(users, /JSON\.stringify\(details/, 'user-administration must not serialize raw request bodies');
  assert.doesNotMatch(users, /header\('X-Admin-Actor'\)/, 'a caller-controlled header cannot choose a user-management audit actor');

  assert.match(partnerships, /'partnership_request'/, 'request updates and resend operations must be attributable');
  assert.match(partnerships, /'resend'/, 'outbound resend must have an explicit audit event');
  assert.match(siteMode, /'reset'/, 'emergency site-mode reset must have an explicit audit event');
});


test('support lookup emits only allow-listed family data and records access', () => {
  const source = stripComments(read('adminAppExperience.ts'));
  const start = source.indexOf("route.get('/support/family/:id'");
  const handler = source.slice(start, source.indexOf('// Rights', start));

  assert.ok(start >= 0, 'support lookup route must exist');
  assert.match(handler, /SELECT\s+parent_id, plan, status\s+FROM family_projection/);
  assert.match(handler, /SELECT\s+child_id, nickname, age_track, status\s+FROM child_projection/);
  assert.match(handler, /SELECT\s+id, display_name, platform, status\s+FROM account_devices/);
  assert.match(handler, /SELECT\s+product_id, plan, entitlement_status, expires_at_ms\s+FROM billing_audit/);
  assert.doesNotMatch(handler, /SELECT \* FROM/);
  assert.match(handler, /auditStatement\(/, 'successful support lookups must be attributed');
  assert.match(handler, /actorId\(c\)/, 'support lookup must use the verified session actor');
});


test('device revoke refuses a stale D1-only operation', () => {
  const source = stripComments(read('adminAppExperience.ts'));
  const start = source.indexOf("route.post('/devices/:id/revoke'");
  const handler = source.slice(start, source.indexOf('/* -------------------------------------------------------- Remote Config', start));

  assert.ok(start >= 0, 'device revoke route must stay explicit while unavailable');
  assert.match(handler, /requirePermission\('archive'\)/);
  assert.match(handler, /501/);
  assert.doesNotMatch(handler, /UPDATE account_devices/, 'D1 must not masquerade as FamilyState authority');
  assert.doesNotMatch(handler, /audit_logged:\s*true/, 'an unavailable operation cannot claim an audit success');
});


test('plans catalogue is authenticated, policy-derived, and read-only', () => {
  const source = stripComments(read('adminPlans.ts'));

  assert.match(source, /\.use\(\s*'\*'\s*,\s*requireAdmin\s*\)/);
  assert.match(source, /import\s+\{\s*PLAN_LIMITS/);
  assert.match(source, /route\.get\('\/plans'/);
  assert.match(source, /source:\s*'family_policy'/);
  assert.match(source, /pricing_available:\s*false/);
  assert.doesNotMatch(source, /\.post\(|\.put\(|\.patch\(|\.delete\(/);
});


test('billing ledger bounds its read and labels projection data honestly', () => {
  const source = stripComments(read('adminBilling.ts'));
  const purchasesStart = source.indexOf("route.get('/billing/purchases'");
  const purchases = source.slice(purchasesStart, source.indexOf("route.get('/billing/entitlements'", purchasesStart));

  assert.ok(purchasesStart >= 0, 'purchase ledger route must exist');
  assert.match(source, /import\s+\{\s*parsePagination\s*\}/);
  assert.match(purchases, /parsePagination\(c\.req\.query\('limit'\), undefined, \{ defaultLimit: 20, maxLimit: 100 \}\)/);
  assert.doesNotMatch(purchases, /Math\.min\(parseInt/);
  assert.match(source, /status\s*=\s*'active'\s+AND\s+plan\s*!=\s*'free'/);
});


test('rights creation validates a real series and records the authenticated actor', () => {
  const source = stripComments(read('adminAppExperience.ts'));
  const start = source.indexOf("route.post('/rights'");
  const handler = source.slice(start, source.indexOf('\n\nexport default route', start));

  assert.ok(start >= 0, 'rights creation route must exist');
  assert.match(handler, /requirePermission\('create'\)/);
  assert.match(handler, /crypto\.randomUUID\(\)/);
  assert.match(handler, /SELECT id FROM series WHERE id = \? AND status <> \?/);
  assert.match(handler, /auditStatement\(c\.env\.DB, actorId\(c\), 'create', 'rights_license'/);
  assert.match(handler, /expiry_date must be an ISO date/);
  assert.match(handler, /countries, languages and devices must be unique, valid lists/);
  assert.doesNotMatch(handler, /rights-\$\{Date\.now\(\)\}/);
});


test('content-review approvals are session-attributed and immutable', () => {
  const source = stripComments(read('adminCatalogue.ts'));

  assert.match(
    source,
    /\.bind\(id, payload\.entityType, payload\.entityId, payload\.reviewerRole, actorId\(c\), payload\.status, payload\.comments\)/,
    'the create route must persist the authenticated reviewer, not a caller-supplied identity',
  );
  assert.match(source, /if \(body\.reviewer_id !== undefined\)/, 'reviewer identity updates must be refused');
  assert.match(source, /if \(isApproval\(finalStatus\)\)/, 'approval transitions must rerun separation of duties');
  assert.match(source, /if \(existing\.status === 'approved'\)/, 'approved decisions must be immutable');
});


test('series and episodes publish only through publish-authorized operations', () => {
  const source = stripComments(read('admin.ts'));
  for (const entity of ['series', 'episodes']) {
    assert.match(source, new RegExp(`adminRoute\\.post\\('\/${entity}\/:id\/publish', requirePermission\\('publish'\\)`));
  }
  assert.match(source, /Create the series in a non-published state, then use the publish operation/);
  assert.match(source, /Create the episode in a non-published state, then use the publish operation/);
  assert.match(source, /Use the publish operation to publish a series/);
  assert.match(source, /Use the publish operation to publish an episode/);
  assert.match(source, /auditStatement\(db, actorId\(c\), 'publish', 'series'/);
  assert.match(source, /auditStatement\(db, actorId\(c\), 'publish', 'episode'/);
});
