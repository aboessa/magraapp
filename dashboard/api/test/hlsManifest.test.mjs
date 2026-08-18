import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// The HLS manifest contract.
///
/// ## What was wrong
///
/// `GET /:id/hls/master.m3u8` authenticated the parent and then minted media
/// capability tokens for private video with **no entitlement check, no territory
/// check and no playback lease**. It fabricated `lid: hls-${Date.now()}`, so no
/// token was tied to a counted session and concurrency limits did not apply to
/// HLS playback at all. When no renditions existed it fell back to the primary
/// private asset, so an account that could merely sign in could stream paid
/// video at full quality.
///
/// The correctly gated path (`POST /:id/playback-sessions`) performed all four
/// checks, which is what made the gap a bypass rather than a missing feature.
///
/// These are source assertions. Exercising the handler needs D1, KV, R2 and a
/// Durable Object, and the route module cannot be driven far enough without them
/// to observe the refusals — but the properties below are the ones that
/// regressed, and each fails loudly if reverted.

const source = readFileSync(
  fileURLToPath(new URL('../src/routes/episodes.ts', import.meta.url)),
  'utf8',
);

/** The manifest handler body, bounded by the next top-level registration. */
function manifestHandler() {
  const start = source.indexOf("episodesRoute.get('/:id/hls/master.m3u8'");
  assert.ok(start > 0, 'the manifest handler must exist');
  const rest = source.slice(start);
  const end = rest.indexOf('\nexport default');
  return end === -1 ? rest : rest.slice(0, end);
}

test('there is exactly one manifest handler', () => {
  const matches = source.match(/episodesRoute\.get\('\/:id\/hls\/master\.m3u8'/g) ?? [];
  assert.equal(matches.length, 1);
});

test('the manifest requires an explicit lease', () => {
  const handler = manifestHandler();
  assert.match(handler, /c\.req\.query\('lease_id'\)/, 'the lease must be named by the caller');
  assert.match(handler, /if \(!leaseId\) return c\.text\('#EXTM3U\\n', 400\)/);
});

test('the manifest never creates a lease of its own', () => {
  const handler = manifestHandler();
  assert.doesNotMatch(handler, /'\/playback\/start'/, 'only the playback session may create a lease');
  assert.doesNotMatch(handler, /hls-\$\{Date\.now\(\)\}/, 'the fabricated lease id must be gone');
});

test('the manifest revalidates plan and concurrency through the Durable Object', () => {
  const handler = manifestHandler();
  assert.match(handler, /'\/playback\/heartbeat'/, 'the lease must be revalidated');
  assert.match(handler, /required_plan: requiredPlan/, 'entitlement must be re-checked');
  assert.match(handler, /catalog\.media\.is_free \? 'free' : catalog\.media\.price_tier/);
  // The refusal status from the DO must survive rather than collapse to 200.
  assert.match(handler, /if \(!validated\.ok \|\| !lease\)/);
});

test('the manifest enforces territory', () => {
  const handler = manifestHandler();
  assert.match(handler, /availabilityFor\(c\.env, 'episode', catalog\.media\.id, context\)/);
  assert.match(handler, /451/);
});

test('tokens are bound to the verified lease, not an invented one', () => {
  const handler = manifestHandler();
  assert.match(handler, /lid: lease\.lease_id/);
});

test('there is no fallback to the primary private asset', () => {
  const handler = manifestHandler();
  // The old line was:
  //   const assets = rens.length ? rens : [{ ... asset_id: catalog.media.asset_id ... }]
  assert.doesNotMatch(handler, /rens\.length \? rens :/, 'a missing rendition set must not serve the master asset');
  assert.match(handler, /if \(!rens\.length\) return c\.text/, 'an empty manifest is the honest answer');
});

test('rendition assets are read in one query rather than one per rendition', () => {
  const handler = manifestHandler();
  assert.match(handler, /WHERE ca\.id IN \(/, 'the per-rendition query was an N+1');
  assert.match(handler, /new Map\(assetRows\.map/);
});

test('the playback session hands the lease to the manifest URL', () => {
  // The manifest no longer invents a lease, so the session has to say which
  // authorised one the client should present. A client that follows `stream_url`
  // verbatim therefore needs no change.
  const sessionStart = source.indexOf("episodesRoute.post('/:id/playback-sessions'");
  const session = source.slice(sessionStart, source.indexOf("episodesRoute.post('/:id/playback-sessions/:leaseId/heartbeat'"));
  assert.match(session, /hls\/master\.m3u8\?lease_id=\$\{encodeURIComponent\(lease\.lease_id\)\}/);
});

test('the progressive playback path keeps all four checks', () => {
  // Guard against "fixing" the manifest by weakening the path it was compared to.
  const sessionStart = source.indexOf("episodesRoute.post('/:id/playback-sessions'");
  const session = source.slice(sessionStart, source.indexOf("episodesRoute.post('/:id/playback-sessions/:leaseId/heartbeat'"));
  assert.match(session, /authenticateParent/);
  assert.match(session, /child_id required/);
  assert.match(session, /availabilityFor/);
  assert.match(session, /'\/playback\/start'/);
});
