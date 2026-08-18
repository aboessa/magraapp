#!/usr/bin/env node
/**
 * Scans tracked files for credential-shaped strings.
 *
 * ## Why a local scanner
 *
 * The patterns below are the secret shapes this repository actually handles:
 * Cloudflare API tokens, Google service-account private keys, the two HMAC signing
 * secrets, and Google Play / Pub/Sub credentials. A generic entropy scanner
 * produces enough false positives on a repository containing base64 image
 * fixtures, hashed test vectors and 119 asset digests that it would be switched
 * off within a week — and a disabled gate is worse than a narrow one, because it
 * reads as coverage.
 *
 * ## What it does not claim
 *
 * It cannot prove the absence of a secret. It catches the shapes that matter here,
 * on every commit, before they reach a remote. Rotating a leaked credential is
 * still the only remedy once one is pushed.
 *
 * Usage:
 *   node tools/ci/scan-secrets.mjs            # scan tracked files at HEAD
 *   node tools/ci/scan-secrets.mjs --staged   # scan staged changes only
 *   node tools/ci/scan-secrets.mjs --self-test
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/// One rule per credential shape. `allow` narrows a rule that would otherwise fire
/// on documentation or a placeholder.
const RULES = [
  {
    id: 'google_private_key',
    label: 'Google service-account private key',
    /**
     * The PEM header, alone on its line.
     *
     * `allow` rejects the two legitimate matches in this repository:
     * `parsePrivateKey` in `googlePlay.ts` and `googleTts.ts` both contain a regex
     * that *strips* the header, so the line carries `-----END` as well. A real key
     * block never has both markers on one line.
     */
    pattern: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    allow: (value, line) => line.includes('-----END')
      // A replace/match expression referencing the header rather than containing a key.
      || /\.replace\(|\.match\(|RegExp\(|includes\(/.test(line),
  },
  {
    id: 'cloudflare_api_token',
    label: 'Cloudflare API token',
    // 40 chars of the Cloudflare alphabet, assigned to a token-shaped name.
    pattern: /(?:CLOUDFLARE|CF)_(?:API_)?TOKEN\s*[:=]\s*['"]?[A-Za-z0-9_-]{40}['"]?/i,
  },
  {
    id: 'aws_access_key',
    label: 'AWS access key id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
  },
  {
    id: 'google_api_key',
    label: 'Google API key',
    pattern: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    id: 'slack_token',
    label: 'Slack token',
    pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/,
  },
  {
    id: 'private_signing_secret',
    label: 'Assigned signing secret',
    /**
     * One of this project's own secret names given a literal value of real length.
     *
     * The names are exact rather than a generic `secret|token|password` sweep: the
     * broad version fires on every `password` form field, every `token` variable
     * and every test fixture, and the resulting noise is what gets a scanner
     * disabled.
     */
    pattern: new RegExp(
      '(AUTH_TOKEN_SECRET|MEDIA_TOKEN_SECRET|ADMIN_API_KEY|GOOGLE_PLAY_SERVICE_ACCOUNT'
      + '|GOOGLE_PUBSUB_[A-Z_]+|RESEND_API_KEY)'
      + '\\s*[:=]\\s*[\'"`]([^\'"`\\n]{16,})[\'"`]',
    ),
    /// A value that is obviously not a secret. Checked against capture group 2.
    ///
    /// `example` is matched anywhere rather than only at the start, because the
    /// reserved example domains appear mid-value: `https://api.example.com/...` and
    /// `play-rtdn@example-project.iam.gserviceaccount.com` are both documentation
    /// values in `test/architecture.test.mjs`, not credentials.
    allow: (value) => /(?:example|localhost|127\.0\.0\.1|\.invalid|\.test\b)/i.test(value)
      || /^(?:\$\{|process\.env|env\.|<|\.\.\.|x{3,}|placeholder|changeme|test[-_]?|dummy|fake|redacted|REPLACE)/i
        .test(value)
      || /^(?:\*+|\.+)$/.test(value),
  },
  {
    id: 'bearer_literal',
    label: 'Hardcoded bearer credential',
    pattern: /Authorization['"]?\s*[:=]\s*['"`]Bearer\s+[A-Za-z0-9._~+/-]{24,}['"`]/,
    allow: (value) => /\$\{|test|fake|dummy|example/i.test(value),
  },
];

/// Paths that legitimately contain secret-shaped strings.
const SKIP_DIRECTORIES = new Set([
  'node_modules', '.git', '.wrangler', '.wrangler-dry-run', '.wrangler-ci',
  'build', 'dist', '.dart_tool', '.audit',
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.mp3', '.wav', '.mp4', '.m4a',
  '.ttf', '.otf', '.woff', '.woff2', '.zip', '.gz', '.pdf', '.lock', '.sqlite',
]);

/// Files whose whole purpose is to describe secret handling.
const SKIP_FILES = new Set([
  path.join('tools', 'ci', 'scan-secrets.mjs'),
  // This test intentionally embeds every credential-shaped fixture to verify
  // the scanner catches it; scanning the fixture source would be recursive.
  path.join('dashboard', 'api', 'test', 'ciGates.test.mjs'),
]);

const MAX_BYTES = 2 * 1024 * 1024;

function trackedFiles(staged) {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR']
    : ['ls-files'];
  return execFileSync('git', args, { encoding: 'utf8' })
    .split('\n').map((line) => line.trim()).filter(Boolean);
}

function shouldSkip(file) {
  const normalized = file.split('/').join(path.sep);
  if (SKIP_FILES.has(normalized)) return true;
  if (file.split('/').some((segment) => SKIP_DIRECTORIES.has(segment))) return true;
  if (SKIP_EXTENSIONS.has(path.extname(file).toLowerCase())) return true;
  return false;
}

/// Every rule violation in one blob of text.
export function scanText(text) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    // A line that opts out explicitly. Kept narrow and greppable so an audit can
    // find every exemption.
    if (line.includes('secret-scan:allow')) return;
    for (const rule of RULES) {
      const match = line.match(rule.pattern);
      if (!match) continue;
      const value = match[2] ?? match[0];
      if (rule.allow?.(value, line)) continue;
      findings.push({ rule: rule.id, label: rule.label, line: index + 1 });
    }
  });
  return findings;
}

function selfTest() {
  const cases = [
    ['-----BEGIN PRIVATE KEY-----', 'google_private_key', true],
    ['AUTH_TOKEN_SECRET = "s3cr3t-value-that-is-long"', 'private_signing_secret', true],
    ['AUTH_TOKEN_SECRET: process.env.AUTH_TOKEN_SECRET', null, false],
    ['AUTH_TOKEN_SECRET = "${AUTH_TOKEN_SECRET}"', null, false],
    ['AUTH_TOKEN_SECRET = "test-secret-value-here"', null, false],
    ['const key = "AKIAIOSFODNN7EXAMPLE"', 'aws_access_key', true],
    ['CLOUDFLARE_API_TOKEN=0123456789abcdef0123456789abcdef01234567', 'cloudflare_api_token', true],
    ['AUTH_TOKEN_SECRET = "real-looking" // secret-scan:allow', null, false],
    ['password: formValue.password', null, false],
    ['const token = await getAccessToken();', null, false],
    // A key block is a real finding; a regex that strips the markers is not.
    ["pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----/g, '')", null, false],
    // Reserved example domains are documentation, wherever they appear in the value.
    ["GOOGLE_PUBSUB_AUDIENCE: 'https://api.example.com/api/v1/billing/rtdn'", null, false],
    ["GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'play-rtdn@example-project.iam.gserviceaccount.com'", null, false],
    // But a real-looking value in the same field still fires.
    ["GOOGLE_PUBSUB_AUDIENCE: 'https://api.majarra.app/hook/9f2c1baa77de'", 'private_signing_secret', true],
  ];
  let failures = 0;
  for (const [text, expectedRule, shouldFlag] of cases) {
    const findings = scanText(text);
    const flagged = findings.length > 0;
    if (flagged !== shouldFlag
      || (expectedRule && findings[0]?.rule !== expectedRule)) {
      failures += 1;
      console.error(`self-test failed: ${JSON.stringify(text)} → ${JSON.stringify(findings)}`);
    }
  }
  if (failures) {
    console.error(`${failures} self-test case(s) failed`);
    process.exit(1);
  }
  console.log(`secret scanner self-test: ${cases.length} cases passed`);
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();

  const staged = process.argv.includes('--staged');
  const files = trackedFiles(staged);
  const findings = [];
  let scanned = 0;

  for (const file of files) {
    if (shouldSkip(file)) continue;
    let size;
    try {
      size = statSync(file).size;
    } catch {
      continue; // deleted between listing and reading
    }
    if (size > MAX_BYTES) continue;
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue; // binary
    }
    scanned += 1;
    for (const finding of scanText(text)) findings.push({ file, ...finding });
  }

  console.log(`scanned ${scanned} tracked file(s)`);
  if (!findings.length) {
    console.log('no credential-shaped strings found');
    return;
  }

  console.error(`\n${findings.length} possible credential(s) found:\n`);
  for (const finding of findings) {
    console.error(`  ${finding.file}:${finding.line}  ${finding.label} [${finding.rule}]`);
  }
  console.error(
    '\nIf a match is a false positive, append `secret-scan:allow` to that line with a'
    + '\nreason. If it is real: remove it, rotate the credential, and move the value to'
    + '\na binding or `.dev.vars` (already gitignored).\n',
  );
  process.exit(1);
}

main();
