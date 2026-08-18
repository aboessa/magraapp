import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { scanText } from '../../../tools/ci/scan-secrets.mjs';

/// CI gates (OPS-004).
///
/// ## What was missing
///
/// Nothing prevented a credential or a vulnerable dependency from being committed,
/// and no release gate tied a deploy to a verified build. The pipeline ran
/// lint/test/build only — and until OPS-001 it had never run at all, because it
/// triggered on a branch that does not exist.
///
/// This is preventative rather than remedial: the audit found no hardcoded
/// credential in tracked source and confirmed the local secret files are ignored.
/// The gap was that hygiene rested entirely on individual discipline.

const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8');

/* -------------------------------------------------------- the secret scanner */

test('a committed private key is caught', () => {
  const findings = scanText([
    'const serviceAccount = {',
    '  private_key: "-----BEGIN PRIVATE KEY-----',
    'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ",',
    '};',
  ].join('\n'));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'google_private_key');
});

test('each credential shape this project handles is caught', () => {
  const cases = [
    ['AUTH_TOKEN_SECRET = "8f2b91c4a7de035619bb"', 'private_signing_secret'],
    ['MEDIA_TOKEN_SECRET: "c19e77aa4b20d8f3e551"', 'private_signing_secret'],
    ['ADMIN_API_KEY="a41d9c7fb2e850613aa9"', 'private_signing_secret'],
    ['RESEND_API_KEY = "re_9f13cc7ab24e6d5081aa"', 'private_signing_secret'],
    ['CLOUDFLARE_API_TOKEN=0123456789abcdef0123456789abcdef01234567', 'cloudflare_api_token'],
    ['const id = "AKIAIOSFODNN7EXAMPLE"', 'aws_access_key'],
    ['key: "AIzaSyD-1234567890abcdefghijklmnopqrstu"', 'google_api_key'],
    ['token: "xoxb-1234567890-abcdefghijkl"', 'slack_token'],
  ];
  for (const [line, rule] of cases) {
    const findings = scanText(line);
    assert.ok(findings.length > 0, `not caught: ${line}`);
    assert.equal(findings[0].rule, rule, line);
  }
});

test('the shapes this repository legitimately contains are not flagged', () => {
  // A scanner that fires on ordinary code gets disabled, and a disabled gate reads
  // as coverage. Every line here appears in the real tree.
  const benign = [
    "const encoded = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\s/g, '');",
    'AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET,',
    'const secret = env.AUTH_TOKEN_SECRET;',
    "GOOGLE_PUBSUB_AUDIENCE: 'https://api.example.com/api/v1/billing/google-play/rtdn',",
    "GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'play-rtdn@example-project.iam.gserviceaccount.com',",
    "h['Authorization'] = 'Bearer $token';",
    'password: formValue.password,',
    'final token = await getAccessToken();',
    "await hashPassword('correct horse battery staple')",
  ];
  for (const line of benign) {
    assert.deepEqual(scanText(line), [], `false positive: ${line}`);
  }
});

test('an exemption must be explicit and greppable', () => {
  const line = 'AUTH_TOKEN_SECRET = "9f2c1baa77de4013bb5a" // secret-scan:allow fixture';
  assert.deepEqual(scanText(line), [], 'the marker must suppress the finding');
  // And without it, the same line fires — so the marker is doing the work rather
  // than the value looking benign.
  assert.equal(scanText(line.replace(' // secret-scan:allow fixture', '')).length, 1);
});

test('the scanner reports the line number so a finding can be located', () => {
  const findings = scanText(['clean', 'clean', 'const id = "AKIAIOSFODNN7EXAMPLE"'].join('\n'));
  assert.equal(findings[0].line, 3);
});

/* ------------------------------------------------------------- the workflow */

test('the pipeline has a secret gate, a dependency report and a release gate', () => {
  for (const job of ['secrets:', 'dependencies:', 'deploy-gate:']) {
    assert.match(workflow, new RegExp(`^  ${job}`, 'm'), `missing job: ${job}`);
  }
  // The scanner's own rules are verified before the repository is scanned.
  assert.match(workflow, /scan-secrets\.mjs --self-test/);
  assert.match(workflow, /node tools\/ci\/scan-secrets\.mjs\s*$/m);
});

test('the secret scan sees history, not just the tip', () => {
  const job = workflow.slice(workflow.indexOf('  secrets:'), workflow.indexOf('  dependencies:'));
  // A secret is usually introduced by one commit and deleted by the next, so a
  // tip-only scan would miss the majority of real leaks.
  assert.match(job, /fetch-depth: 0/);
});

test('critical advisories fail the dependency job while lesser ones only report', () => {
  const job = workflow.slice(workflow.indexOf('  dependencies:'), workflow.indexOf('  deploy-gate:'));
  assert.match(job, /--audit-level=critical/);
  // Reported for both workspaces.
  assert.match(job, /dashboard\/api/);
  assert.match(job, /dashboard\/front/);
  assert.match(job, /flutter pub outdated/);
  // An advisory published upstream overnight must not block an unrelated fix, so
  // the informational reports tolerate failure and only `critical` gates.
  assert.match(job, /npm audit --omit=dev \|\| true/);
});

test('the deploy gate cannot run on a red pipeline or off master', () => {
  const job = workflow.slice(workflow.indexOf('  deploy-gate:'));
  const needs = job.match(/needs: \[([^\]]+)\]/);
  assert.ok(needs, 'the deploy gate must declare its dependencies');
  const declared = needs[1].split(',').map((name) => name.trim());
  // Every test job must gate it; a deploy that can outrun the suites is not a gate.
  for (const job of ['flutter', 'worker', 'admin', 'content-pacing', 'secrets', 'dependencies']) {
    assert.ok(declared.includes(job), `deploy-gate does not wait for ${job}`);
  }
  assert.match(job, /if: github\.ref == 'refs\/heads\/master' && github\.event_name == 'push'/);
  // It is a dry run, and says so: a real deploy needs a token this repository does
  // not hold, and granting one is an owner decision.
  assert.match(job, /wrangler deploy --dry-run/);
  assert.match(job, /--env production/);
  // The comment explaining how to make it real sits above the job key.
  assert.match(workflow, /To make it a real deploy/);
});

test('every job still runs on the branch that exists', () => {
  // OPS-001's fix must not regress: the workflow triggered only on `main`, which is
  // not this repository's default branch, so no run had ever happened.
  assert.match(workflow, /branches: \[master, main\]/);
  assert.equal((workflow.match(/branches: \[master, main\]/g) ?? []).length, 2);
});

test('no step masks a failure with a fallback', () => {
  // `npm run check 2>/dev/null || npx tsc --noEmit` was how the worker suite came to
  // never run: the first command always failed and the fallback always succeeded.
  // `|| true` is permitted only on the informational advisory reports, which exit
  // non-zero whenever anything is outdated and are not gates.
  const informational = /npm audit|flutter pub outdated/;
  const lines = workflow.split('\n');
  for (const [index, line] of lines.entries()) {
    // Comments discussing the old masked command are not themselves steps.
    if (/^\s*#/.test(line)) continue;
    if (!/\|\|/.test(line)) continue;
    assert.match(
      line, informational,
      `line ${index + 1} masks a failure with a fallback: ${line.trim()}`,
    );
  }
  // And the gating steps must not be among them.
  const gating = ['flutter analyze --fatal-warnings', 'flutter test --no-pub', 'npm test',
    'npm run typecheck:types', 'npx vitest run', 'npm run build',
    'node tools/ci/scan-secrets.mjs', '--audit-level=critical'];
  for (const step of gating) {
    const line = lines.find((candidate) => candidate.includes(step) && !/^\s*#/.test(candidate));
    assert.ok(line, `gating step not found: ${step}`);
    assert.equal(/\|\||2>\/dev\/null/.test(line), false, `${step} must not be maskable`);
  }
});
