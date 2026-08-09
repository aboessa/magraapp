import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Contract checks for the deliberately limited workflow review record.
///
/// The Node suite has no Workers/D1 HTTP harness. These source assertions pin
/// the authorization and persistence boundaries that must not regress into a
/// false workflow-completion or publishing signal.
const routePath = fileURLToPath(new URL('../src/routes/adminTeams.ts', import.meta.url));
const source = readFileSync(routePath, 'utf8');
const code = source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('workflow reviews are authenticated, server-step records with an audit row', () => {
  assert.match(code, /route\.post\('\/workflows\/runs\/:id\/review', requirePermission\('approve'\)/);
  assert.match(code, /const reviewerId = actorId\(c\)/);
  assert.match(code, /SELECT content_type, content_id, current_step, status FROM workflow_runs/);
  assert.match(code, /\.bind\(id, runId, run\.current_step, reviewerId, decision, comment \|\| null\)/);
  assert.match(code, /auditStatement\(c\.env\.DB, reviewerId, 'review', 'workflow_run', runId/);
  assert.match(code, /has_comment: Boolean\(comment\)/);
});

test('workflow reviews neither trust a client step nor complete the workflow', () => {
  assert.doesNotMatch(code, /body\.step/);
  assert.doesNotMatch(code, /UPDATE workflow_runs SET current_step='approved', status='approved'/);
  assert.match(code, /if \(run\.status !== 'running'\) return c\.json\(\{ success: false, error: 'Workflow run is not accepting review records' \}, 409\)/);
});

test('workflow review audit metadata excludes free-text comments', () => {
  const auditStart = code.indexOf("auditStatement(c.env.DB, reviewerId, 'review', 'workflow_run', runId");
  assert.ok(auditStart >= 0, 'review writes a centralized audit record');
  const auditCall = code.slice(auditStart, code.indexOf('])', auditStart));
  assert.doesNotMatch(auditCall, /\n\s*comment\s*[:,]/);
});
