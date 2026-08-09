import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Regression coverage for the audit log date range filter.
///
/// GET /admin/audit-logs previously accepted actor_id/entity_type/action but
/// no date range at all, so "what changed between these two dates" had no
/// server-side answer despite created_at existing on every row. This file
/// pins that `from`/`to` are validated as ISO 8601 (never interpolated
/// unchecked into SQL), that an inverted range is rejected rather than
/// silently returning an unfiltered page, and that a date-only bound expands
/// to the start/end of that day so the day itself is not excluded.
///
/// Same convention as workflowReview.test.mjs / routeGuards.test.mjs: a source
/// assertion, not an HTTP test, because the suite runs on plain `node --test`
/// with no Workers/D1 runtime.
const routePath = fileURLToPath(new URL('../src/routes/adminTeams.ts', import.meta.url));
const source = readFileSync(routePath, 'utf8');
const code = source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('the audit log route validates from/to as ISO dates before using them in SQL', () => {
  assert.match(code, /const isoDatePattern = \/\^\\d\{4\}-\\d\{2\}-\\d\{2\}/);
  assert.match(code, /if \(from && !isoDatePattern\.test\(from\)\)/);
  assert.match(code, /if \(to && !isoDatePattern\.test\(to\)\)/);
});

test('an inverted date range is rejected rather than silently ignored', () => {
  assert.match(code, /if \(from && to && from > to\)/);
});

test('a date-only bound expands to the start or end of that day', () => {
  assert.match(code, /from\.length === 10 \? `\$\{from\} 00:00:00` : from/);
  assert.match(code, /to\.length === 10 \? `\$\{to\} 23:59:59` : to/);
});

test('the date filter compares against created_at with parameterized bounds, not string interpolation', () => {
  assert.match(code, /clauses\.push\('created_at >= \?'\); params\.push\(/);
  assert.match(code, /clauses\.push\('created_at <= \?'\); params\.push\(/);
});
