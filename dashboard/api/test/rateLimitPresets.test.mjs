/// The admin rate limit, pinned against the value that made the dashboard unusable.
///
/// ## What happened
///
/// `adminLimit` was 30 requests per minute. Each admin screen issues between three and
/// seven requests (a list, its taxonomy, its stats, its audit trail), so around the sixth
/// screen the worker starts answering 429. The front end treated any failed session probe
/// as "signed out", so an operator was returned to the login screen mid-edit. Both halves
/// were fixed; this test keeps the server half from being quietly reverted, because the
/// symptom looks like an authentication bug and gets debugged in the wrong place.
///
/// The auth limit is pinned in the other direction: it protects a password endpoint and
/// must stay tight.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../src/lib/rateLimit.ts', import.meta.url)), 'utf8');

const preset = (name) => {
  const match = source.match(new RegExp(`export const ${name} = rateLimit\\(\\{([^}]+)\\}\\)`));
  assert.ok(match, `${name} preset not found`);
  const window = Number(match[1].match(/windowMs:\s*([\d_]+)/)?.[1].replace(/_/g, ''));
  const max = Number(match[1].match(/max:\s*([\d_]+)/)?.[1].replace(/_/g, ''));
  return { window, max };
};

test('the admin quota allows a real session, not six screens', () => {
  const admin = preset('adminLimit');
  assert.equal(admin.window, 60_000);
  // A screen costs up to seven requests; a working session opens dozens of screens and
  // re-reads lists after every save. 30 was under a dozen screens' worth.
  assert.ok(admin.max >= 300, `adminLimit max is ${admin.max}, which throttles normal use`);
});

test('the admin quota is still a quota', () => {
  const admin = preset('adminLimit');
  // Not unlimited: it still bounds a scraper or a runaway loop.
  assert.ok(admin.max <= 2000, `adminLimit max is ${admin.max}, which is no longer a limit`);
});

test('the password endpoint quota stays tight', () => {
  const auth = preset('strictAuthLimit');
  assert.equal(auth.window, 60_000);
  assert.ok(auth.max <= 10, `strictAuthLimit max is ${auth.max}; a login endpoint must stay tight`);
});

test('a throttled response is a 429 with Retry-After, not a silent failure', () => {
  assert.match(source, /Retry-After/);
  assert.match(source, /429/);
});
