import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MIN_PASSWORD_LENGTH,
  hasPermission,
  normalizeEmail,
  validatePassword,
} from '../src/lib/adminUsers.ts';

/// Regression coverage for admin account authentication.
///
/// These tests pin the pure parts of the auth module. The session and password
/// paths need a D1 binding and are covered by the runtime verification in
/// scripts/verify-admin-auth.mjs instead — asserting them here would require a
/// fake database whose behaviour could drift from the real one.
///
/// ## The defect this replaces
///
/// Dashboard access was a single shared ADMIN_API_KEY held by everyone on the
/// team. It carried no identity, so the audit actor came from an unauthenticated
/// X-Admin-Actor header that any caller could set to any name; it could not be
/// revoked per person; and it granted everything, so a reviewer and an owner
/// were indistinguishable.

test('email is lowercased and trimmed so login is case insensitive', () => {
  assert.equal(normalizeEmail('  Person@Example.COM '), 'person@example.com');
  assert.equal(normalizeEmail('ABOESSA101@GMAIL.COM'), 'aboessa101@gmail.com');
});

test('malformed email addresses are rejected', () => {
  for (const bad of ['', '   ', 'no-at-sign', 'a@b', 'a@b.c', '@example.com', 'person@', 'a b@c.com']) {
    assert.equal(normalizeEmail(bad), null, JSON.stringify(bad));
  }
});

test('non-string email input is rejected rather than coerced', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.equal(normalizeEmail(bad), null, JSON.stringify(bad));
  }
});

test('email is capped so an oversized value cannot bloat a row', () => {
  const long = `${'a'.repeat(400)}@example.com`;
  assert.equal(normalizeEmail(long)?.length, 254);
});

test('passwords shorter than the minimum are rejected', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 10);
  assert.ok(validatePassword('short') !== null);
  assert.ok(validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1)) !== null);
});

test('a password of exactly the minimum length is accepted', () => {
  // Length is the requirement, not symbol classes: complexity rules push people
  // toward predictable patterns like Password1!
  assert.equal(validatePassword('correct-horse'), null);
  assert.equal(validatePassword('abcd123456'), null);
});

test('a long single-character password is rejected despite passing length', () => {
  // 'aaaaaaaaaaaa' clears the length check but resists nothing
  assert.ok(validatePassword('a'.repeat(30)) !== null);
  assert.ok(validatePassword('abab'.repeat(10)) !== null, 'three distinct characters is still too few');
});

test('missing or non-string passwords are rejected', () => {
  for (const bad of [null, undefined, '', 42, {}]) {
    assert.ok(validatePassword(bad) !== null, JSON.stringify(bad));
  }
});

test('an absurdly long password is rejected before hashing', () => {
  // PBKDF2 over an unbounded input is a cheap way to burn CPU on the worker
  assert.ok(validatePassword('a1b2c3d4e5'.repeat(30)) !== null);
});

test('rejection reasons are returned in Arabic for the operator', () => {
  const reason = validatePassword('short');
  assert.ok(typeof reason === 'string' && /[\u0600-\u06FF]/.test(reason), String(reason));
});

/* ------------------------------------------------------------ الصلاحيات */

const reviewer = {
  id: 'u1', email: 'r@example.com', display_name: 'Reviewer',
  roles: ['reviewer'], permissions: ['view', 'review', 'approve'],
  must_change_password: false,
};

test('a role grants only its own permissions', () => {
  assert.equal(hasPermission(reviewer, 'review'), true);
  assert.equal(hasPermission(reviewer, 'approve'), true);
  assert.equal(hasPermission(reviewer, 'publish'), false);
  assert.equal(hasPermission(reviewer, 'manage_permissions'), false);
});

test('owner and system_admin bypass the permission list entirely', () => {
  // Migration 0014 seeded system_admin with zero role_permissions rows, so a
  // naive lookup granted the platform administrator nothing at all. 0019 fills
  // the matrix, and this bypass is the second line of defence.
  for (const role of ['owner', 'system_admin']) {
    const user = { ...reviewer, roles: [role], permissions: [] };
    assert.equal(hasPermission(user, 'manage_permissions'), true, role);
    assert.equal(hasPermission(user, 'publish'), true, role);
    assert.equal(hasPermission(user, 'anything_at_all'), true, role);
  }
});

test('a user with no roles has no permissions', () => {
  const user = { ...reviewer, roles: [], permissions: [] };
  assert.equal(hasPermission(user, 'view'), false);
  assert.equal(hasPermission(user, 'manage_permissions'), false);
});

test('permission names are matched exactly, not by prefix', () => {
  const user = { ...reviewer, roles: ['viewer'], permissions: ['view'] };
  assert.equal(hasPermission(user, 'view'), true);
  // 'view_audit_log' starts with 'view' but is a separate permission
  assert.equal(hasPermission(user, 'view_audit_log'), false);
});

test('a role named like owner does not inherit the bypass', () => {
  // Only the exact seeded role ids bypass; a lookalike must not.
  const user = { ...reviewer, roles: ['owner_assistant', 'Owner'], permissions: [] };
  assert.equal(hasPermission(user, 'publish'), false);
});
