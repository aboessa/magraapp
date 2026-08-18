// Majarra — is PlayVeo image-to-image broken, or just cached on the source image?
//
// Established so far: four image-to-image jobs against the SAME reference file
// returned byte-identical output (sha 963168c7cbe5cb0b) even when the prompt was
// "a bright red sports car in a desert". So the prompt had no effect.
//
// But an earlier one-off test on a different source image DID change the subject's
// pose, which a pure passthrough could not do. Both observations fit one
// explanation: the provider caches the result against the SOURCE IMAGE and ignores
// the prompt on a cache hit. The first call for a given source generates; every
// later call for that same source replays the first result.
//
// That distinction decides the whole panel pipeline:
//   * Broken endpoint    -> abandon image-to-image, build panels on text-to-image.
//   * Cached on source   -> salvageable, because the cache can be missed by making
//                           the uploaded bytes unique per request without touching
//                           a single pixel.
//
// The probe makes the bytes unique by appending padding AFTER the JPEG EOI marker
// (FFD9). Everything after EOI is outside the image stream, so every decoder
// returns the identical pixels while the file hash changes. That isolates the
// cache key from the image content: if a byte-unique but pixel-identical upload
// suddenly honours the prompt, the cache key is the file.
//
// Two jobs, 0.15 credits each. Usage:
//   node tools/playveo/probe-cache.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import process from 'node:process';

const BASE = 'https://playveo-api.aboessa101.workers.dev';
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(ROOT, 'assets/images/stories/act-s1-playveo');
const REF = path.join(DIR, 'page-001.jpg');

const KNOWN_CACHED_SHA = '963168c7cbe5cb0b';

// The page-003 restaging request: the bird in open flight, nest small behind him.
// Identical wording in both probes so the ONLY variable is the source bytes.
const RESTAGE_PROMPT =
  'The same baby bird character from the reference image, now flying in open sky '
  + 'with wings spread, seen from further away. His round nest stays visible but small '
  + 'in the background with his mother bird in it. Warm daylight, clear light blue sky. '
  + 'Soft preschool storybook art, no text, no visible teeth, no fear.';

function loadKey() {
  if (process.env.PLAYVEO_API_KEY) return process.env.PLAYVEO_API_KEY.trim();
  const p = path.join(os.homedir(), '.majarra', 'playveo.key');
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  throw new Error('No API key. Set $env:PLAYVEO_API_KEY or create ~/.majarra/playveo.key');
}
const KEY = loadKey();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

async function api(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${route}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function waitFor(id) {
  for (let i = 0; i < 48; i++) {
    await sleep(10_000);
    const r = await api('GET', `/v1/images/${id}`);
    const img = r.image ?? r;
    if (img.status === 'completed') return img;
    if (img.status === 'failed') throw new Error(`failed: ${img.error}`);
  }
  throw new Error('timeout');
}

/// Appends padding after the JPEG End Of Image marker.
///
/// Bytes after EOI are not part of the entropy-coded image data, so the decoded
/// pixels are bit-for-bit unchanged while the file digest differs. This is the
/// cheapest way to present "the same picture, different file".
function padAfterEoi(buf, label) {
  const eoi = buf.lastIndexOf(Buffer.from([0xff, 0xd9]));
  if (eoi === -1) throw new Error('no JPEG EOI marker found');
  const head = buf.subarray(0, eoi + 2);
  const pad = Buffer.from(`\n<!-- majarra-cache-probe ${label} ${Date.now()} -->`, 'ascii');
  return Buffer.concat([head, pad]);
}

async function probe(label, buf) {
  console.log(`\n--- ${label}`);
  console.log(`    upload ${buf.length} bytes  sha=${sha(buf)}`);
  const res = await api('POST', '/v1/images/image-to-image', {
    prompt: RESTAGE_PROMPT,
    aspect_ratio: '16:9',
    count: 1,
    image: `data:image/jpeg;base64,${buf.toString('base64')}`,
  });
  console.log(`    job ${res.id}  cost=${res.creditCost}  strength=${res.strength}`);
  const img = await waitFor(res.id);
  const r = await fetch(img.resultUrls[0], { headers: { Authorization: `Bearer ${KEY}` } });
  const out = Buffer.from(await r.arrayBuffer());
  const file = `_probe-cache-${label}.jpg`;
  fs.writeFileSync(path.join(DIR, file), out);
  const digest = sha(out);
  console.log(`    saved ${file}  ${out.length} bytes  sha=${digest}`);
  console.log(`    ${digest === KNOWN_CACHED_SHA ? 'CACHE HIT — same bytes as every previous call' : 'NEW OUTPUT — the prompt was honoured'}`);
  return digest;
}

async function main() {
  const ref = fs.readFileSync(REF);
  console.log(`reference page-001.jpg  ${ref.length} bytes  sha=${sha(ref)}`);
  console.log(`cached output seen on all 4 previous i2i calls: ${KNOWN_CACHED_SHA}`);

  // Control: the untouched reference, to confirm the cache hit still reproduces.
  const control = await probe('control-unmodified', ref);

  // Test: pixel-identical, byte-unique.
  const padded = padAfterEoi(ref, 'padded');
  const test = await probe('padded-eoi', padded);

  console.log('\n================ VERDICT ================');
  console.log(`control (unmodified source) : ${control}`);
  console.log(`test    (padded source)     : ${test}`);

  if (control === KNOWN_CACHED_SHA && test !== KNOWN_CACHED_SHA) {
    console.log('\n=> CONFIRMED: the provider caches on the source image bytes and ignores the prompt on a hit.');
    console.log('   Workaround is viable: make the reference bytes unique per request.');
    console.log('   Inspect _probe-cache-padded-eoi.jpg to confirm it actually restaged the scene.');
  } else if (test === KNOWN_CACHED_SHA) {
    console.log('\n=> The cache is NOT keyed on the file bytes — padding did not miss it.');
    console.log('   image-to-image stays unusable for restaging. Build panels on text-to-image.');
  } else {
    console.log('\n=> Unexpected: even the unmodified control produced new bytes.');
    console.log('   The endpoint may be nondeterministic rather than cached. Re-read both outputs before deciding.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
