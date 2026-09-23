import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';

import { createMediaToken } from '../src/lib/parentAuth.ts';
import mediaRoute from '../src/routes/media.ts';

const secret = 'media-test-secret-0123456789abcdef0123456789';
const assetId = 'asset-video-1';
const objectKey = 'episodes/episode-1/video.mp4';

function mp4Fixture() {
  const bytes = new Uint8Array(128);
  bytes.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70], 0);
  bytes.set(new TextEncoder().encode('isom'), 8);
  return bytes;
}

function rangeFromHeaders(headers, size) {
  const value = headers?.get?.('Range') ?? headers?.get?.('range');
  const match = /^bytes=(\d+)-(\d*)$/.exec(value ?? '');
  if (!match) return null;
  const offset = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1 };
}

function bucketFor(bytes) {
  return {
    async get(key, options) {
      if (key !== objectKey) return null;
      const range = rangeFromHeaders(options?.range, bytes.length);
      const body = range
        ? bytes.slice(range.offset, range.offset + range.length)
        : bytes;
      return {
        body,
        size: bytes.length,
        range,
        etag: 'fixture-etag',
        httpEtag: '"fixture-etag"',
        writeHttpMetadata(headers) {
          headers.set('Content-Type', 'application/octet-stream');
        },
      };
    },
  };
}

async function fixture() {
  const bytes = mp4Fixture();
  const env = {
    MEDIA_TOKEN_SECRET: secret,
    MEDIA_BUCKET: bucketFor(bytes),
    THUMBS_BUCKET: bucketFor(bytes),
  };
  const token = await createMediaToken(env, {
    sub: 'parent-1',
    sid: 'session-1',
    lid: 'lease-1',
    aid: assetId,
    r2_key: objectKey,
    bucket: 'media',
    mime_type: 'video/mp4',
    filename: 'episode.mp4',
    asset_version: 1,
    etag: null,
  });
  const app = new Hono();
  app.route('/api/v1/media', mediaRoute);
  return { app, env, token };
}

test('Web capability URL serves an exact browser-compatible MP4 byte range', async () => {
  const { app, env, token } = await fixture();
  const response = await app.request(
    `/api/v1/media/assets/${assetId}?token=${encodeURIComponent(token)}`,
    { headers: { Range: 'bytes=0-63' } },
    env,
  );

  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Type'), 'video/mp4');
  assert.equal(response.headers.get('Accept-Ranges'), 'bytes');
  assert.equal(response.headers.get('Content-Range'), 'bytes 0-63/128');
  assert.equal(response.headers.get('Content-Length'), '64');
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');

  const body = new Uint8Array(await response.arrayBuffer());
  assert.equal(body.length, 64);
  assert.equal(new TextDecoder().decode(body.slice(4, 8)), 'ftyp');
});

test('a capability cannot be redeemed for another asset id', async () => {
  const { app, env, token } = await fixture();
  const response = await app.request(
    `/api/v1/media/assets/another-asset?token=${encodeURIComponent(token)}`,
    { headers: { Range: 'bytes=0-63' } },
    env,
  );

  assert.equal(response.status, 401);
  assert.match(response.headers.get('Content-Type') ?? '', /^application\/json/);
});
