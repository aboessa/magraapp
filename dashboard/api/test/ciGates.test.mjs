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
  for (const job of ['secrets:', 'dependencies:', 'migrations:', 'deploy:']) {
    assert.match(workflow, new RegExp(`^  ${job}`, 'm'), `missing job: ${job}`);
  }
  // The scanner's own rules are verified before the repository is scanned.
  assert.match(workflow, /scan-secrets\.mjs --self-test/);
  assert.match(workflow, /node tools\/ci\/scan-secrets\.mjs\s*$/m);
});

test('the referential integrity sweep runs on the from-zero database', () => {
  // `DB-103`: وموضعه يهمّ — القاعدة في وظيفة `migrations` نتاجُ الترحيلات وحدها،
  // فأي عطلٍ يجده يُنسَب إلى ما يمكن إصلاحه لا إلى بيانات بيئةٍ قديمة.
  const job = workflow.slice(workflow.indexOf('  migrations:'), workflow.indexOf('  content-pacing:'));
  assert.match(job, /node tools\/ops\/referential-integrity\.mjs/);
  assert.ok(
    job.indexOf('migrate:local') < job.indexOf('referential-integrity'),
    'الفحص يلي بناء القاعدة',
  );
});

test('the mojibake gate runs', () => {
  assert.match(workflow, /node tools\/ci\/mojibake-scan\.mjs --check/);
});

test('the document classification gate runs', () => {
  // `DOCS-101`: نفس درس الدفعة 42 — أداةٌ غير مربوطة بالمسار ليست بوابة.
  assert.match(workflow, /node tools\/ci\/docs-classified\.mjs --check/);
});

test('the bundle size gates run, and the size one runs after the build', () => {
  // `PERF-101`: أداةٌ موجودة وغير مربوطة بالمسار ليست بوابة — وهو ما وقع فعلًا
  // مع `feature-matrix --check` (الدفعة 42). فالحرس هنا على **الربط**.
  const job = workflow.slice(workflow.indexOf('  flutter:'), workflow.indexOf('  worker:'));
  assert.match(job, /node tools\/ci\/assets-declared\.mjs --check/);
  assert.match(job, /node tools\/ci\/aab-size\.mjs/);
  // والترتيب جزءٌ من الصحّة: قياسُ الحزمة قبل بنائها يقيس حزمةً قديمة أو لا
  // شيء. الأداة تفشل على الغياب، وهذا يضمن ألّا يُعاد الترتيب بلا انتباه.
  assert.ok(
    job.indexOf('flutter build appbundle') < job.indexOf('aab-size.mjs'),
    'قياس الحزمة يجب أن يلي بناءها',
  );
});

test('the secret scan sees history, not just the tip', () => {
  const job = workflow.slice(workflow.indexOf('  secrets:'), workflow.indexOf('  dependencies:'));
  // A secret is usually introduced by one commit and deleted by the next, so a
  // tip-only scan would miss the majority of real leaks.
  assert.match(job, /fetch-depth: 0/);
});

test('critical advisories fail the dependency job while lesser ones only report', () => {
  const job = workflow.slice(workflow.indexOf('  dependencies:'), workflow.indexOf('\n  deploy:'));
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
  const job = workflow.slice(workflow.indexOf('\n  deploy:'));
  const needs = job.match(/needs: \[([^\]]+)\]/);
  assert.ok(needs, 'the deploy gate must declare its dependencies');
  const declared = needs[1].split(',').map((name) => name.trim());
  // Every test job must gate it; a deploy that can outrun the suites is not a gate.
  // `migrations` joined the list in `DB-104`: shipping a bundle whose schema cannot
  // be built from the repository is the same class of unverified release.
  for (const name of ['flutter', 'worker', 'admin', 'migrations', 'content-pacing',
    'secrets', 'dependencies']) {
    assert.ok(declared.includes(name), `deploy does not wait for ${name}`);
  }
  /* Both branch names, and that is a fix for a measured defect (2026-09-23).

     This pinned `refs/heads/master` alone. Measured on the remote: the only remote
     branch is `main` (`origin/HEAD -> origin/main`); `master` is local-only and
     points at the same commit. So the deploy job was conditioned on a ref that does
     not exist on the server — a deploy that could never fire, under seven green
     jobs that read as "shipped".

     It is `OPS-001` inverted. That fix added `master` to the triggers because the
     workflow listed only `main`; the truth is that `main` is the one that exists.
     The remedy that does not recur is accepting both names in both places. */
  assert.match(
    job,
    /if: \(github\.ref == 'refs\/heads\/master' \|\| github\.ref == 'refs\/heads\/main'\) && github\.event_name == 'push'/,
  );
  assert.match(job, /--env production/);
  // `OPS-105`: it deploys for real when the credentials exist, and dry-runs when they
  // do not. Both paths must be present — a job that only ever dry-runs passes
  // vacuously, and one that only ever deploys fails every run until a token exists.
  assert.match(job, /npx wrangler deploy --env production 2>&1/);
  assert.match(job, /wrangler deploy --dry-run/);
  assert.match(job, /steps\.creds\.outputs\.present/);
  // The old comment promised a file edit as the switch-on. The switch is now the
  // secret itself, so the promise must not survive as documentation.
  assert.equal(workflow.includes('To make it a real deploy'), false);
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
  // Tolerated by name, not by pattern. Each of these reads a value the deploy has
  // *already* completed without: the Cloudflare version id for the record, and the
  // live commit inside a retry loop that fails loudly by itself after six attempts.
  // Failing a successful deploy because a version string could not be parsed would
  // trade a real release for a bookkeeping detail.
  //
  // The list is exact so that a new `||` anywhere still fails this test.
  const tolerated = [
    "grep -oiE 'version id:",
    'npx wrangler versions list --env production --json',
    'console.log(v?.[0]?.id ?? "")',
    'curl -fsS --max-time 15 https://api.majarra.app/version',
    'console.log(JSON.parse(s).commit ?? "")',
  ];
  const lines = workflow.split('\n');
  for (const [index, line] of lines.entries()) {
    // Comments discussing the old masked command are not themselves steps.
    if (/^\s*#/.test(line)) continue;
    // An `if:` condition is a GitHub expression, not a shell command: `||` there is
    // boolean OR over refs and cannot mask an exit code. The deploy gate needs it to
    // accept both `master` and `main` — see the branch-name defect above. Narrowed to
    // `if:` specifically rather than tolerating the literal, so a future `run:` line
    // with `||` still fails this test.
    if (/^\s*if:/.test(line)) continue;
    if (!/\|\|/.test(line)) continue;
    if (tolerated.some((allowed) => line.includes(allowed))) continue;
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
