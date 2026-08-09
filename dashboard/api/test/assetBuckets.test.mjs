import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALWAYS_PRIVATE_KINDS,
  assetPlacementIsConsistent,
  bucketForAsset,
  BUCKET_NAMES,
  isAlwaysPrivateKind,
  keyScopeForAsset,
  PRIVATE_BUCKET,
  PUBLIC_BUCKET,
  rekeyForAsset,
} from '../src/lib/assetBuckets.ts';

/// Regression coverage for the bucket architecture.
///
/// The defect: `bucket` was a caller-supplied column defaulting to 'media', so
/// public catalogue artwork was stored in the private bucket. Verified against
/// local D1 at the time: 18 assets were visibility='public' with public/ keys but
/// bucket='media'. Pointing the CDN at that bucket to make them resolve would
/// have exposed every private episode video.

test('the public bucket is THUMBS and the private bucket is MEDIA', () => {
  assert.equal(PUBLIC_BUCKET, 'thumbs');
  assert.equal(PRIVATE_BUCKET, 'media');
  assert.deepEqual([...BUCKET_NAMES], ['media', 'thumbs']);
});

test('public catalogue artwork lands in the public artwork bucket', () => {
  for (const kind of ['image', 'audio', 'subtitle', 'document', 'manifest']) {
    assert.equal(bucketForAsset({ visibility: 'public', kind }), 'thumbs', kind);
  }
});

test('private media lands in the private bucket', () => {
  for (const kind of ['image', 'audio', 'video', 'archive', 'document']) {
    assert.equal(bucketForAsset({ visibility: 'private', kind }), 'media', kind);
  }
});

test('video can never reach the CDN-fronted bucket even if mislabelled public', () => {
  // The whole point of the split: a mislabelled row must not put a stream behind
  // an anonymous CDN hostname.
  assert.equal(bucketForAsset({ visibility: 'public', kind: 'video' }), 'media');
  assert.equal(keyScopeForAsset({ visibility: 'public', kind: 'video' }), 'private');
});

test('game packs (archives) can never reach the public bucket either', () => {
  assert.equal(bucketForAsset({ visibility: 'public', kind: 'archive' }), 'media');
  assert.equal(keyScopeForAsset({ visibility: 'public', kind: 'archive' }), 'private');
});

test('always-private kinds are exactly video and archive', () => {
  assert.deepEqual([...ALWAYS_PRIVATE_KINDS], ['video', 'archive']);
  assert.equal(isAlwaysPrivateKind('video'), true);
  assert.equal(isAlwaysPrivateKind('archive'), true);
  assert.equal(isAlwaysPrivateKind('image'), false);
  assert.equal(isAlwaysPrivateKind(null), false);
  assert.equal(isAlwaysPrivateKind(undefined), false);
});

test('missing or unknown visibility fails closed to private', () => {
  assert.equal(bucketForAsset({}), 'media');
  assert.equal(bucketForAsset({ visibility: null, kind: 'image' }), 'media');
  assert.equal(bucketForAsset({ visibility: 'PUBLIC', kind: 'image' }), 'media');
  assert.equal(bucketForAsset({ visibility: 'unknown', kind: 'image' }), 'media');
});

test('the key scope prefix always agrees with the chosen bucket', () => {
  const cases = [
    { visibility: 'public', kind: 'image' },
    { visibility: 'private', kind: 'image' },
    { visibility: 'public', kind: 'video' },
    { visibility: 'private', kind: 'archive' },
    { visibility: null, kind: null },
  ];
  for (const asset of cases) {
    const bucket = bucketForAsset(asset);
    const scope = keyScopeForAsset(asset);
    assert.equal(scope === 'public', bucket === 'thumbs', JSON.stringify(asset));
  }
});

test('placement is consistent only when bucket and key prefix both agree', () => {
  assert.equal(assetPlacementIsConsistent({
    visibility: 'public', kind: 'image', bucket: 'thumbs', r2_key: 'public/catalog/a.webp',
  }), true);

  // The exact shape of the 212 mis-keyed rows found in D1.
  assert.equal(assetPlacementIsConsistent({
    visibility: 'private', kind: 'image', bucket: 'media', r2_key: 'private/catalog/a.webp',
  }), true, 'self-consistent even though the classification is wrong');

  assert.equal(assetPlacementIsConsistent({
    visibility: 'public', kind: 'image', bucket: 'media', r2_key: 'public/catalog/a.webp',
  }), false, 'public asset parked in the private bucket');

  assert.equal(assetPlacementIsConsistent({
    visibility: 'public', kind: 'image', bucket: 'thumbs', r2_key: 'private/catalog/a.webp',
  }), false, 'key prefix contradicts the bucket');

  assert.equal(assetPlacementIsConsistent({
    visibility: 'private', kind: 'video', bucket: 'media', r2_key: 'private/catalog/video/ep.mp4',
  }), true, 'the Mazen stream shape');
});

test('a not-yet-uploaded asset is consistent once its bucket is right', () => {
  assert.equal(assetPlacementIsConsistent({
    visibility: 'public', kind: 'image', bucket: 'thumbs', r2_key: null,
  }), true);
  assert.equal(assetPlacementIsConsistent({
    visibility: 'public', kind: 'image', bucket: 'media', r2_key: null,
  }), false);
});

test('rekey swaps the scope prefix and preserves the rest of the path', () => {
  assert.equal(
    rekeyForAsset('private/catalog/assets/images/series/posters/x.webp', { visibility: 'public', kind: 'image' }),
    'public/catalog/assets/images/series/posters/x.webp',
  );
  assert.equal(
    rekeyForAsset('public/catalog/video/ep.mp4', { visibility: 'public', kind: 'video' }),
    'private/catalog/video/ep.mp4',
    'video is forced back to a private key',
  );
});

test('rekey is idempotent, so the migration can be re-run safely', () => {
  const asset = { visibility: 'public', kind: 'image' };
  const once = rekeyForAsset('private/catalog/a.webp', asset);
  const twice = rekeyForAsset(once, asset);
  assert.equal(once, twice);
  assert.equal(rekeyForAsset(twice, asset), twice);
});

test('rekey tolerates leading slashes and unprefixed legacy keys', () => {
  assert.equal(
    rekeyForAsset('/private/catalog/a.webp', { visibility: 'public', kind: 'image' }),
    'public/catalog/a.webp',
  );
  assert.equal(
    rekeyForAsset('catalog/legacy/a.webp', { visibility: 'public', kind: 'image' }),
    'public/catalog/legacy/a.webp',
  );
});

test('rekeyed keys always satisfy the placement invariant', () => {
  // Property check across the shapes actually present in the catalogue.
  const keys = [
    'private/catalog/assets/images/series/posters/p.webp',
    'public/catalog/assets/images/landing/hero.png',
    'private/catalog/video/series/mazen-wa-thaaloub/ep-01.mp4',
    'catalog/unprefixed.webp',
  ];
  const assets = [
    { visibility: 'public', kind: 'image' },
    { visibility: 'private', kind: 'image' },
    { visibility: 'public', kind: 'video' },
    { visibility: 'private', kind: 'archive' },
  ];
  for (const key of keys) {
    for (const asset of assets) {
      const migrated = {
        visibility: bucketForAsset(asset) === 'thumbs' ? 'public' : 'private',
        kind: asset.kind,
        bucket: bucketForAsset(asset),
        r2_key: rekeyForAsset(key, asset),
      };
      assert.equal(assetPlacementIsConsistent(migrated), true, `${key} + ${JSON.stringify(asset)}`);
    }
  }
});
