import assert from 'node:assert/strict';
import test from 'node:test';
import {
  can,
  hasPermission,
  isSuperuser,
  SCOPE_TYPES,
} from '../src/lib/adminUsers.ts';

/// Regression coverage for scoped authorization.
///
/// ## The defect these tests pin
///
/// `loadUserAccess` used to `SELECT ag.role_id, p.id AS action` and flatten the
/// result into two flat string arrays. A grant scoped to a single series and a
/// platform-wide grant collapsed to the identical value, so three of the plan's
/// four layers — scope, content type, language — were written to D1 and then
/// discarded at read time. They enforced nothing.
///
/// `can()` now takes the resource being acted on and requires a grant that
/// carries the permission *and* matches that resource.

const grant = (over = {}) => ({
  role_id: 'content_creator',
  scope_type: 'platform',
  scope_id: null,
  content_type: null,
  language: null,
  permissions: ['view', 'create', 'edit_text'],
  ...over,
});

test('the seven scope levels match the migration', () => {
  assert.deepEqual(
    [...SCOPE_TYPES],
    ['platform', 'planet', 'section', 'series', 'content', 'page', 'language'],
  );
});

/* ------------------------------------------------------------ deny by default */

test('a user with no grants is denied everything', () => {
  // This is the inversion that mattered: before, an authenticated account with
  // zero grants could create, edit, publish and archive all content.
  const user = { roles: [], grants: [] };
  assert.equal(can(user, 'view'), false);
  assert.equal(can(user, 'create'), false);
  assert.equal(can(user, 'publish'), false);
});

test('a user whose grants omit the action is denied that action', () => {
  const user = { roles: ['content_creator'], grants: [grant()] };
  assert.equal(can(user, 'create'), true);
  assert.equal(can(user, 'publish'), false, 'creating does not imply publishing');
  assert.equal(can(user, 'approve'), false);
});

/* ------------------------------------------------------------- scope matching */

test('a platform grant reaches every resource', () => {
  const user = { roles: ['content_creator'], grants: [grant({ scope_type: 'platform' })] };
  assert.equal(can(user, 'create', { planetId: 'qisas', seriesId: 'series-1' }), true);
  assert.equal(can(user, 'create', {}), true);
});

test('a planet grant does not reach another planet', () => {
  const user = {
    roles: ['content_creator'],
    grants: [grant({ scope_type: 'planet', scope_id: 'qisas' })],
  };
  assert.equal(can(user, 'create', { planetId: 'qisas' }), true);
  assert.equal(can(user, 'create', { planetId: 'oloom' }), false);
});

test('a series grant does not reach another series in the same planet', () => {
  // The precise case the old code allowed: one series grant meant edit-everywhere.
  const user = {
    roles: ['content_creator'],
    grants: [grant({ scope_type: 'series', scope_id: 'series-zaid' })],
  };
  assert.equal(can(user, 'edit_text', { seriesId: 'series-zaid' }), true);
  assert.equal(can(user, 'edit_text', { seriesId: 'series-nader' }), false);
});

test('a scoped grant fails when the resource does not declare that dimension', () => {
  // Allowing an unspecified dimension would make the constraint bypassable by
  // simply omitting the field — the easiest possible evasion.
  const user = {
    roles: ['content_creator'],
    grants: [grant({ scope_type: 'planet', scope_id: 'qisas' })],
  };
  assert.equal(can(user, 'create', {}), false);
  assert.equal(can(user, 'create', { planetId: null }), false);
});

test('a null scope_id means every resource at that level', () => {
  const user = {
    roles: ['content_creator'],
    grants: [grant({ scope_type: 'planet', scope_id: null })],
  };
  assert.equal(can(user, 'create', { planetId: 'qisas' }), true);
  assert.equal(can(user, 'create', { planetId: 'oloom' }), true);
});

/* ------------------------------------------------- content type and language */

test('a language-restricted grant cannot touch another language', () => {
  // The plan's translator role: English only, and must not edit the Arabic original.
  const user = {
    roles: ['translator'],
    grants: [grant({ role_id: 'translator', permissions: ['view', 'edit_text'], language: 'en' })],
  };
  assert.equal(can(user, 'edit_text', { language: 'en' }), true);
  assert.equal(can(user, 'edit_text', { language: 'ar' }), false);
  assert.equal(can(user, 'edit_text', {}), false, 'unspecified language does not bypass the limit');
});

test('a content-type-restricted grant cannot touch another type', () => {
  const user = {
    roles: ['content_creator'],
    grants: [grant({ content_type: 'illustrated_story' })],
  };
  assert.equal(can(user, 'create', { contentType: 'illustrated_story' }), true);
  assert.equal(can(user, 'create', { contentType: 'game' }), false);
});

test('all four layers must match together', () => {
  const user = {
    roles: ['content_creator'],
    grants: [grant({
      scope_type: 'section',
      scope_id: 'illustrated-stories',
      content_type: 'illustrated_story',
      language: 'ar',
    })],
  };
  const full = { sectionId: 'illustrated-stories', contentType: 'illustrated_story', language: 'ar' };
  assert.equal(can(user, 'edit_text', full), true);
  assert.equal(can(user, 'edit_text', { ...full, language: 'en' }), false, 'wrong language');
  assert.equal(can(user, 'edit_text', { ...full, contentType: 'game' }), false, 'wrong content type');
  assert.equal(can(user, 'edit_text', { ...full, sectionId: 'comics' }), false, 'wrong section');
});

/* ------------------------------------------------------------- multiple grants */

test('two grants are evaluated independently, not merged', () => {
  // The plan's example: editor on Stories, viewer on Faith. Merging them would
  // grant editing on Faith.
  const user = {
    roles: ['content_creator', 'viewer'],
    grants: [
      grant({ scope_type: 'planet', scope_id: 'qisas', permissions: ['view', 'create', 'edit_text'] }),
      grant({ role_id: 'viewer', scope_type: 'planet', scope_id: 'islamic', permissions: ['view'] }),
    ],
  };
  assert.equal(can(user, 'edit_text', { planetId: 'qisas' }), true);
  assert.equal(can(user, 'view', { planetId: 'islamic' }), true);
  assert.equal(can(user, 'edit_text', { planetId: 'islamic' }), false, 'view-only on Faith');
});

/* ----------------------------------------------------------------- superusers */

test('owner and system_admin bypass scope entirely', () => {
  for (const role of ['owner', 'system_admin']) {
    const user = { roles: [role], grants: [] };
    assert.equal(isSuperuser(user), true, role);
    assert.equal(can(user, 'publish', { planetId: 'anything' }), true, role);
    assert.equal(can(user, 'manage_permissions'), true, role);
  }
});

test('a role that merely looks like owner does not bypass', () => {
  const user = { roles: ['owner_assistant', 'Owner'], grants: [] };
  assert.equal(isSuperuser(user), false);
  assert.equal(can(user, 'publish'), false);
});

/* ------------------------------------------------------- unscoped hasPermission */

test('hasPermission ignores scope and is only for non-content actions', () => {
  const user = { roles: ['content_manager'], permissions: ['view', 'assign_members'] };
  assert.equal(hasPermission(user, 'assign_members'), true);
  assert.equal(hasPermission(user, 'publish'), false);
});

test('hasPermission tolerates a missing permissions array', () => {
  assert.equal(hasPermission({ roles: [] }, 'view'), false);
  assert.equal(hasPermission({ roles: ['owner'] }, 'view'), true);
});

test('can tolerates a missing grants array rather than throwing', () => {
  // resolveSession always supplies grants, but a stale cached shape must fail
  // closed instead of crashing the guard.
  assert.equal(can({ roles: [] }, 'view'), false);
});

test('an unknown scope_type fails closed', () => {
  // loadUserAccess maps an unrecognised scope_type to the narrowest level, so a
  // corrupt row cannot widen access.
  const user = {
    roles: ['content_creator'],
    grants: [grant({ scope_type: 'galaxy', scope_id: 'x' })],
  };
  assert.equal(can(user, 'create', { planetId: 'qisas' }), false);
});
