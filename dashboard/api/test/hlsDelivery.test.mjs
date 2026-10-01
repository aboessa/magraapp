import assert from 'node:assert/strict';
import test from 'node:test';

import { createHlsToken, hlsTokenTtlSeconds, verifyHlsToken, createMediaToken } from '../src/lib/parentAuth.ts';

/// CONTENT-001 — HLS delivery under a prefix-bound capability.

const SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef'; // secret-scan:allow test fixture
const PREFIX = 'private/episodes/episode-body-01-heart/hls/';

function env(objects = {}) {
  return {
    MEDIA_TOKEN_SECRET: SECRET,
    MEDIA_BUCKET: {
      async get(key) {
        if (!(key in objects)) return null;
        const body = objects[key];
        return {
          body, size: body.length, httpEtag: '"e"',
          writeHttpMetadata() {},
        };
      },
    },
    requested: [],
  };
}

const claims = { sub: 'parent_1', sid: 's1', lid: 'lease_1', aid: 'ca-hls', prefix: PREFIX, bucket: 'media' };

async function get(e, path) {
  const { default: route } = await import('../src/routes/media.ts');
  return route.request(path, {}, e);
}

test('a playlist and a rendition file are served under the token path', async () => {
  const e = env({ [`${PREFIX}master.m3u8`]: '#EXTM3U', [`${PREFIX}720p/media.mp4`]: 'mp4bytes' });
  const token = await createHlsToken(e, claims, 1800);
  const master = await get(e, `/hls/${token}/master.m3u8`);
  assert.equal(master.status, 200);
  assert.equal(master.headers.get('Content-Type'), 'application/vnd.apple.mpegurl');
  const media = await get(e, `/hls/${token}/720p/media.mp4`);
  assert.equal(media.status, 200);
  assert.equal(media.headers.get('Content-Type'), 'video/mp4');
  assert.equal(media.headers.get('Cache-Control'), 'private, no-store');
});

test('nothing outside the closed file shape is reachable', async () => {
  const e = env({ [`${PREFIX}master.m3u8`]: '#EXTM3U' });
  const token = await createHlsToken(e, claims, 1800);
  for (const bad of ['../1080p.mp4', '720p/../../x.mp4', 'secret.txt', '720p/index.m3u8x', 'a/b/c.mp4']) {
    const res = await get(e, `/hls/${token}/${bad}`);
    assert.notEqual(res.status, 200, bad);
  }
});

test('an ordinary media token, a forged or an expired token are refused', async () => {
  const e = env({ [`${PREFIX}master.m3u8`]: '#EXTM3U' });
  const mp4Token = await createMediaToken(e, { ...claims, r2_key: `${PREFIX}master.m3u8`, bucket: 'media', mime_type: null, filename: null, asset_version: 1, etag: null });
  assert.equal((await get(e, `/hls/${mp4Token}/master.m3u8`)).status, 401);
  const token = await createHlsToken(e, claims, 1800);
  assert.equal((await get(e, `/hls/${token.slice(0, -2)}xx/master.m3u8`)).status, 401);
  assert.equal(await verifyHlsToken(e, await createHlsToken(e, claims, -10)), null);
});

test('the capability cannot be minted for a prefix outside an episode HLS folder', async () => {
  const e = env();
  for (const prefix of ['private/episodes/x/', 'private/', 'private/episodes/x/hls/../']) {
    await assert.rejects(createHlsToken(e, { ...claims, prefix }, 1800));
  }
});

test('the lifetime covers the episode with margin, bounded', () => {
  assert.equal(hlsTokenTtlSeconds(42), 1800);
  assert.equal(hlsTokenTtlSeconds(900), 3600);
  assert.equal(hlsTokenTtlSeconds(100_000), 4 * 3600);
  assert.equal(hlsTokenTtlSeconds(null), 1800);
});

test('HLS stays off the offline download roles', async () => {
  const { readFileSync } = await import('node:fs');
  const downloads = readFileSync(new URL('../src/routes/downloads.ts', import.meta.url), 'utf8');
  assert.match(downloads, /episode: \['stream', 'video'\]/);
  const episodes = readFileSync(new URL('../src/routes/episodes.ts', import.meta.url), 'utf8');
  assert.match(episodes, /al\.role = 'hls'/);
});
