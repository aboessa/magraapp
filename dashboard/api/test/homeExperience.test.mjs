import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  CONFIG_KEYS,
  HOME_BLOCK_TYPES,
  SYSTEM_BLOCK_TYPES,
  TARGETING_DIMENSIONS,
  compareVersions,
  homeContextFromQuery,
  isScheduleOpen,
  isSystemBlock,
  parseBlockConfig,
  parseTargeting,
  parseVersionEnvelope,
  resolveHomeBlocks,
  snapshotFromRow,
} from '../src/lib/homeExperience.ts';

/// The Home Builder (ADMIN-002).
///
/// ## The defects these tests pin
///
/// The builder stored configuration that nothing read, and its own screen could
/// not save. Specifically: Save/Cancel/Publish/Rollback and the content picker
/// were all `disabled`; the version table was two invented rows; `PATCH` returned
/// 200 for an id that did not exist; `POST` built ids from `Date.now()`; the
/// resolver existed twice with different rules so the preview did not match
/// production; "rollback" restored a snapshot that had never captured targeting or
/// config and therefore erased both; and the Flutter app rendered a hardcoded
/// sliver order, ignoring the configuration entirely.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const row = (overrides = {}) => ({
  id: 'block-1',
  block_type: 'hero_slider',
  title_ar: 'الهيرو',
  sort_order: 0,
  is_active: 1,
  is_draft: 0,
  scheduled_at: null,
  expires_at: null,
  version: 1,
  targeting_json: '{}',
  config_json: '{}',
  ...overrides,
});

const context = (overrides = {}) => ({
  track: 'kids', language: 'ar', country: 'EG', plan: 'family',
  platform: 'phone', appVersion: '2.5.0', isNewUser: false,
  ...overrides,
});

const NOW = '2026-08-15T12:00:00.000Z';

/* ---------------------------------------------------- the block vocabulary */

test('the accepted block types are exactly the ones the table allows', () => {
  // Checked against the migration rather than duplicated by hand: the admin used
  // to offer `continue_journey` and `featured_series`, neither of which the CHECK
  // constraint accepts, so creating one failed with an opaque database error.
  const migration = read('migrations/0051_home_builder_resolved.sql');
  const constraint = migration.slice(
    migration.indexOf('block_type TEXT NOT NULL CHECK'),
    migration.indexOf('title_ar TEXT'),
  );
  const declared = [...constraint.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
  assert.deepEqual([...HOME_BLOCK_TYPES].sort(), [...new Set(declared)].sort());
});

test('system blocks are the ones whose contents the server computes', () => {
  assert.equal(isSystemBlock('continue_watching', {}), true);
  assert.equal(isSystemBlock('hero_slider', {}), false);
  // The seeded rows carry `{"system":true}` in config, so that must win.
  assert.equal(isSystemBlock('games', { system: true }), true);
  for (const type of SYSTEM_BLOCK_TYPES) {
    assert.ok(HOME_BLOCK_TYPES.includes(type), `${type} must be a real block type`);
  }
});

/* --------------------------------------------------------------- targeting */

test('an unsupported targeting dimension is refused, not silently stored', () => {
  // `age_min`/`age_max` were rendered by the admin as a targeting sentence and
  // read by no resolver: a rule typed there was saved, displayed back as if in
  // force, and ignored on every request.
  const parsed = parseTargeting({ age_min: 3, age_max: 5 });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unsupported targeting dimension/);
  assert.match(parsed.error, /age_min/);
});

test('every advertised dimension is actually accepted', () => {
  const values = {
    track: ['kids'], language: ['ar'], country: ['EG'], plan: ['family'],
    platform: ['phone'], min_app_version: '2.4', is_new_user: true,
  };
  for (const dimension of TARGETING_DIMENSIONS) {
    const parsed = parseTargeting({ [dimension]: values[dimension] });
    assert.equal(parsed.ok, true, `${dimension} must parse`);
  }
});

test('a single value is normalized to a list, and codes are normalized in case', () => {
  const parsed = parseTargeting({ country: 'eg', language: 'AR', track: 'KIDS' });
  assert.deepEqual(parsed.value.country, ['EG']);
  assert.deepEqual(parsed.value.language, ['ar']);
  assert.deepEqual(parsed.value.track, ['kids']);
});

test('invalid dimension values are refused with the allowed set named', () => {
  assert.match(parseTargeting({ track: ['toddler'] }).error, /allowed: preschool, kids, junior/);
  assert.match(parseTargeting({ country: ['EGY'] }).error, /alpha-2/);
  assert.match(parseTargeting({ min_app_version: 'v2.4' }).error, /min_app_version/);
  assert.match(parseTargeting({ is_new_user: 'yes' }).error, /boolean/);
});

test('minimum app version is a numeric comparison, not a string equality', () => {
  // The old resolver did `t.app_version !== appVersion` while the screen displayed
  // "≥ 2.4", so a block targeted at 2.4 was hidden from 2.5 — the opposite of what
  // the UI promised.
  assert.ok(compareVersions('2.5.0', '2.4') > 0);
  assert.equal(compareVersions('2.4', '2.4.0'), 0);
  assert.ok(compareVersions('2.10', '2.9') > 0, 'ten is after nine, not before');

  const blocks = resolveHomeBlocks(
    [row({ targeting_json: JSON.stringify({ min_app_version: '2.4' }) })],
    context({ appVersion: '2.5.0' }), NOW,
  );
  assert.equal(blocks.length, 1, 'a newer client must receive the block');
  assert.equal(
    resolveHomeBlocks(
      [row({ targeting_json: JSON.stringify({ min_app_version: '2.4' }) })],
      context({ appVersion: '2.3.9' }), NOW,
    ).length,
    0,
  );
});

test('an unknown country cannot satisfy a country rule', () => {
  // Geo lookup can fail. The old resolver's `&& country` meant an unknown country
  // passed every country rule, so a territory-restricted row was shown to
  // everyone whose country could not be determined.
  const blocks = resolveHomeBlocks(
    [row({ targeting_json: JSON.stringify({ country: ['EG'] }) })],
    context({ country: '' }), NOW,
  );
  assert.equal(blocks.length, 0);
});

test('an empty dimension means everyone', () => {
  const blocks = resolveHomeBlocks([row()], context({ track: 'junior', country: '' }), NOW);
  assert.equal(blocks.length, 1);
});

/* ------------------------------------------------------------------ config */

test('an unsupported config key is refused', () => {
  const parsed = parseBlockConfig({ mysteryFlag: true });
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /unsupported config key/);
  for (const key of CONFIG_KEYS) {
    assert.ok(typeof key === 'string' && key.length);
  }
});

test('config bounds are enforced', () => {
  assert.match(parseBlockConfig({ maxItems: 0 }).error, /between 1 and 60/);
  assert.match(parseBlockConfig({ card_style: 'diagonal' }).error, /card_style/);
  assert.equal(parseBlockConfig({ maxItems: 6, card_style: 'story' }).ok, true);
});

/* -------------------------------------------------------------- resolution */

test('inactive and draft blocks never resolve', () => {
  const rows = [
    row({ id: 'a' }),
    row({ id: 'b', is_active: 0 }),
    row({ id: 'c', is_draft: 1 }),
  ];
  assert.deepEqual(resolveHomeBlocks(rows, context(), NOW).map((block) => block.id), ['a']);
});

test('a scheduled block is hidden before its start and after its end', () => {
  const future = row({ id: 'future', scheduled_at: '2026-12-01T00:00:00.000Z' });
  const past = row({ id: 'past', expires_at: '2026-01-01T00:00:00.000Z' });
  const open = row({ id: 'open', scheduled_at: '2026-01-01T00:00:00.000Z', expires_at: '2027-01-01T00:00:00.000Z' });

  assert.equal(isScheduleOpen(future, NOW), false);
  assert.equal(isScheduleOpen(past, NOW), false);
  assert.equal(isScheduleOpen(open, NOW), true);
  assert.deepEqual(
    resolveHomeBlocks([future, past, open], context(), NOW).map((block) => block.id),
    ['open'],
  );
});

test('order is deterministic and positions are renumbered from zero', () => {
  // The seeded rows contain duplicate `sort_order` values, so without a
  // deterministic tie-break the same request could return different orders.
  const rows = [
    row({ id: 'z', sort_order: 1 }),
    row({ id: 'a', sort_order: 1 }),
    row({ id: 'm', sort_order: 0 }),
  ];
  const first = resolveHomeBlocks(rows, context(), NOW);
  const second = resolveHomeBlocks([...rows].reverse(), context(), NOW);
  assert.deepEqual(first.map((block) => block.id), ['m', 'a', 'z']);
  assert.deepEqual(second.map((block) => block.id), first.map((block) => block.id));
  assert.deepEqual(first.map((block) => block.position), [0, 1, 2]);
});

test('a row with unparseable targeting resolves to targeting nobody in particular', () => {
  const blocks = resolveHomeBlocks([row({ targeting_json: '{not json' })], context(), NOW);
  assert.equal(blocks.length, 1);
  assert.deepEqual(blocks[0].targeting, {});
});

test('the resolved shape carries the fields the client needs', () => {
  const [block] = resolveHomeBlocks(
    [row({ block_type: 'games', config_json: JSON.stringify({ card_style: 'square', subtitle: 'العب', maxItems: 6 }) })],
    context(), NOW,
  );
  assert.equal(block.type, 'games');
  assert.equal(block.card_style, 'square');
  assert.equal(block.subtitle, 'العب');
  assert.equal(block.source, 'editorial');
  assert.equal(block.is_system, false);
  assert.equal(block.config.maxItems, 6);
});

test('the request context defaults do not invent a version', () => {
  const query = homeContextFromQuery(() => undefined);
  // `0.0.0` is older than any published minimum, so a client that sends no version
  // receives only untargeted blocks rather than everything.
  assert.equal(query.appVersion, '0.0.0');
  assert.equal(query.country, '', 'an unknown country stays unknown');
});

/* ------------------------------------------------------------ the versions */

test('a snapshot captures everything a restore needs', () => {
  const snapshot = snapshotFromRow(row({
    targeting_json: JSON.stringify({ country: ['EG'] }),
    config_json: JSON.stringify({ maxItems: 4 }),
  }));
  // The old snapshot held `{id, block_type, title_ar}` only, so restoring it wrote
  // `snap.targeting || {}` and erased the block's targeting and config.
  assert.deepEqual(snapshot.targeting, { country: ['EG'] });
  assert.deepEqual(snapshot.config, { maxItems: 4 });
  for (const key of ['sort_order', 'is_active', 'is_draft', 'scheduled_at', 'expires_at']) {
    assert.ok(key in snapshot, `${key} must be captured`);
  }
});

test('legacy snapshots are not readable as versions', () => {
  // Rows written by the previous implementation must not be presented as history,
  // because restoring one would destroy state.
  assert.equal(parseVersionEnvelope(JSON.stringify({ id: 'block-1', title_ar: 'x' })), null);
  assert.equal(parseVersionEnvelope('{not json'), null);
  const envelope = parseVersionEnvelope(JSON.stringify({
    format: 'home_block_v1', block_id: 'block-1', action: 'update',
    actor_id: 'admin-1', before: null, after: null,
  }));
  assert.equal(envelope.action, 'update');
});

/* ------------------------------------------------- the surfaces, by source */

test('the preview and the app share one resolver', () => {
  const admin = read('src/routes/adminAppExperience.ts');
  const publicRoute = read('src/routes/homeResolved.ts');
  assert.match(admin, /resolveHomeBlocks\(/);
  assert.match(publicRoute, /resolveHomeBlocks\(/);
  // Neither may filter on its own again.
  for (const [name, source] of [['admin', admin], ['public', publicRoute]]) {
    assert.equal(
      /t\.track && t\.track !==/.test(source), false,
      `${name} must not carry its own targeting filter`,
    );
  }
});

test('every mutation records a version and an audit entry', () => {
  const source = read('src/routes/adminAppExperience.ts');
  for (const action of ['create', 'update', 'rollback', 'delete']) {
    assert.match(source, new RegExp(`action: '${action}'`), `${action} must record a version`);
  }
  // Versions are batched with the mutation they describe, so history cannot
  // survive a failed write.
  assert.match(source, /DB\.batch\(\[/);
  assert.match(source, /auditStatement\(c\.env\.DB, actorId\(c\), 'create', 'home_experience_block'/);
  assert.match(source, /auditStatement\(c\.env\.DB, actorId\(c\), 'archive', 'home_experience_block'/);
});

test('a patch to a nonexistent block is a 404, not a reported success', () => {
  const source = read('src/routes/adminAppExperience.ts');
  const patch = source.slice(
    source.indexOf("route.patch('/home-experience/:id'"),
    source.indexOf("route.get('/home-experience/:id/versions'"),
  );
  assert.match(patch, /if \(!existing\) return c\.json\(\{ success: false, error: 'Block not found' \}, 404\)/);
  // Existence is checked before any statement is prepared.
  assert.ok(
    patch.indexOf('Block not found') < patch.indexOf('UPDATE home_experience_blocks'),
    'the existence check must precede the write',
  );
});

test('ids are random, not derived from the clock', () => {
  const source = read('src/routes/adminAppExperience.ts');
  const create = source.slice(
    source.indexOf("route.post('/home-experience'"),
    source.indexOf("route.patch('/home-experience/:id'"),
  );
  assert.match(create, /const id = crypto\.randomUUID\(\)/);
  // The comment above it names the old `Date.now()` form, so the check is on the
  // assignment rather than on the file containing that text.
  assert.equal(
    /const id = `block-\$\{Date\.now\(\)\}`/.test(create), false,
    'the id must not be derived from the clock',
  );
});

test('reorder demands the complete set of ids', () => {
  const source = read('src/routes/adminAppExperience.ts');
  const reorder = source.slice(
    source.indexOf("route.post('/home-experience/reorder'"),
    source.indexOf("route.delete('/home-experience/:id'"),
  );
  assert.match(reorder, /duplicate ids/);
  assert.match(reorder, /unknown block id/);
  assert.match(reorder, /order must list every block/);
  // A partial list assigned indices from zero and collided with the omitted rows.
  assert.match(reorder, /DB\.batch\(\[/);
});

test('rollback requires an explicit version and refuses a creation record', () => {
  const source = read('src/routes/adminAppExperience.ts');
  const rollback = source.slice(
    source.indexOf("route.post('/home-experience/:id/rollback'"),
    source.indexOf("route.post('/home-experience/reorder'"),
  );
  assert.match(rollback, /version_id is required/);
  assert.match(rollback, /no earlier state to restore/);
  assert.match(rollback, /That version does not describe this block/);
  // It restores every field, which is what the previous implementation did not.
  for (const column of ['title_ar', 'sort_order', 'is_active', 'is_draft', 'targeting_json', 'config_json']) {
    assert.ok(rollback.includes(column), `${column} must be restored`);
  }
});

test('the public endpoint reports when it is serving a fallback', () => {
  const source = read('src/routes/homeResolved.ts');
  // A configured Home and a fallback Home were indistinguishable: the old handler
  // caught its own query failure, set `rows = []`, and returned hardcoded blocks
  // inside a success envelope.
  assert.match(source, /fallback: usingFallback/);
  assert.match(source, /configuration_unavailable/);
  assert.match(source, /no_blocks_matched/);
  assert.match(source, /console\.error\('home_resolved_query_failed'/);
});

test('the builder no longer claims Flutter ignores it, and the mutations are guarded', () => {
  const page = readFileSync(
    new URL('../../front/src/pages/AppExperiencePage.tsx', import.meta.url), 'utf8',
  );
  // The self-documented gap is closed, so the banner asserting it would now be
  // false.
  assert.equal(/CLIENT_INTEGRATION_MISSING/.test(page), false);
  assert.equal(/integrationWarn/.test(page), false);
  // No control is present-and-permanently-disabled.
  assert.equal(/<button className="button button--primary" disabled>/.test(page), false);
  assert.equal(/@ts-nocheck/.test(page), false, 'the page must typecheck');
  // The invented version rows are gone.
  assert.equal(/<td>v3<\/td>/.test(page), false);

  const source = read('src/routes/adminAppExperience.ts');
  assert.match(source, /route\.use\('\*', requireAdmin\)/);
  for (const guard of [
    "route.post('/home-experience', requirePermission('create')",
    "route.patch('/home-experience/:id', requirePermission('edit_metadata')",
    "route.post('/home-experience/:id/rollback', requirePermission('publish')",
    "route.post('/home-experience/reorder', requirePermission('edit_metadata')",
    "route.delete('/home-experience/:id', requirePermission('archive')",
  ]) {
    assert.ok(source.includes(guard), `missing guard: ${guard}`);
  }
});
