import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyArtworkUrl,
  artworkFromRow,
  artworkSelect,
  EPISODE_THUMBNAIL_ROLES,
  isPubliclyServableAsset,
  keyPrefixMatchesVisibility,
  publicAssetBaseUrl,
  publicAssetUrl,
  PLANET_COVER_ROLES,
  PLANET_ICON_ROLES,
  resolveArtworkUrl,
  SERIES_COVER_ROLES,
  stripArtworkColumns,
} from '../src/lib/assetUrls.ts';

const BASE = 'https://cdn.majarra.app';

const readyPublicImage = {
  r2_key: 'public/catalog/series/posters/adventures.webp',
  visibility: 'public',
  status: 'ready',
  kind: 'image',
};

test('catalogue artwork resolves to a public CDN URL', () => {
  assert.equal(
    publicAssetUrl(BASE, readyPublicImage),
    'https://cdn.majarra.app/public/catalog/series/posters/adventures.webp',
  );
});

test('private assets never resolve to a public URL', () => {
  // This is the regression that mattered: a linked, ready poster that is still
  // marked private must not become a guessable anonymous URL.
  assert.equal(publicAssetUrl(BASE, { ...readyPublicImage, visibility: 'private' }), null);
});

test('entitlement-controlled kinds are never publicly addressable', () => {
  // Even if someone mislabels a stream as public, it must stay behind the
  // capability-token playback route.
  for (const kind of ['video', 'archive']) {
    assert.equal(
      publicAssetUrl(BASE, { ...readyPublicImage, kind }),
      null,
      `${kind} must not be publicly addressable`,
    );
  }
});

test('assets that are not ready do not resolve', () => {
  for (const status of ['planned', 'uploading', 'processing', 'failed', 'archived']) {
    assert.equal(publicAssetUrl(BASE, { ...readyPublicImage, status }), null);
  }
});

test('missing or blank r2_key does not resolve', () => {
  assert.equal(publicAssetUrl(BASE, { ...readyPublicImage, r2_key: null }), null);
  assert.equal(publicAssetUrl(BASE, { ...readyPublicImage, r2_key: '   ' }), null);
  assert.equal(publicAssetUrl(BASE, null), null);
});

test('an unconfigured CDN base yields null rather than a broken URL', () => {
  assert.equal(publicAssetUrl(null, readyPublicImage), null);
  assert.equal(publicAssetBaseUrl({}), null);
  assert.equal(publicAssetBaseUrl({ PUBLIC_ASSET_BASE_URL: '   ' }), null);
});

test('base URL and key are joined with exactly one slash', () => {
  assert.equal(publicAssetBaseUrl({ PUBLIC_ASSET_BASE_URL: `${BASE}///` }), BASE);
  assert.equal(
    publicAssetUrl(BASE, { ...readyPublicImage, r2_key: '/leading/slash.webp' }),
    'https://cdn.majarra.app/leading/slash.webp',
  );
});

test('isPubliclyServableAsset agrees with publicAssetUrl', () => {
  assert.equal(isPubliclyServableAsset(readyPublicImage), true);
  assert.equal(isPubliclyServableAsset({ ...readyPublicImage, visibility: 'private' }), false);
  assert.equal(isPubliclyServableAsset(undefined), false);
});

test('the asset projection wins over the deprecated stored column', () => {
  const resolved = resolveArtworkUrl(BASE, readyPublicImage, 'https://legacy.example/old.png');
  assert.equal(resolved, `${BASE}/${readyPublicImage.r2_key}`);
});

test('the deprecated column is still honoured when no asset resolves', () => {
  // Backwards compatibility: rows that predate asset_links keep working.
  assert.equal(
    resolveArtworkUrl(BASE, null, 'https://legacy.example/old.png'),
    'https://legacy.example/old.png',
  );
  assert.equal(resolveArtworkUrl(BASE, null, '  '), null);
  assert.equal(resolveArtworkUrl(BASE, null, null), null);
});

test('artworkSelect inlines only allowlisted roles and orders by priority', () => {
  const sql = artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES);
  assert.match(sql, /al\.entity_type = 'series'/);
  assert.match(sql, /al\.entity_id = s\.id/);
  assert.match(sql, /al\.role IN \('poster', 'cover'\)/);
  // poster must sort ahead of cover
  assert.match(sql, /WHEN 'poster' THEN 0/);
  assert.match(sql, /WHEN 'cover' THEN 1/);
  assert.match(sql, /LIMIT 1\) AS cover_asset_r2_key/);
  // The picker must only consider servable assets, so a private or unfinished
  // link cannot shadow a usable public one.
  assert.match(sql, /ca\.status = 'ready'/);
  assert.match(sql, /ca\.visibility = 'public'/);
  assert.match(sql, /ca\.kind NOT IN \('video', 'archive'\)/);
  assert.match(sql, /ca\.r2_key IS NOT NULL/);
  // all four columns the row mapper expects
  for (const column of ['r2_key', 'visibility', 'status', 'kind']) {
    assert.match(sql, new RegExp(`AS cover_asset_${column}`));
  }
});

test('artworkSelect cannot smuggle request input into SQL', () => {
  // Roles come only from the module allowlists, never from a request. Assert the
  // allowlists themselves are plain identifiers so inlining stays safe.
  for (const role of [...SERIES_COVER_ROLES, ...EPISODE_THUMBNAIL_ROLES]) {
    assert.match(role, /^[a-z_]+$/, `role ${role} must be a bare identifier`);
  }
});

test('episode thumbnails prefer thumbnail over still and cover', () => {
  assert.deepEqual([...EPISODE_THUMBNAIL_ROLES], ['thumbnail', 'still', 'cover']);
  const sql = artworkSelect('thumb_asset', 'episode', 'e.id', EPISODE_THUMBNAIL_ROLES);
  assert.match(sql, /WHEN 'thumbnail' THEN 0/);
  assert.match(sql, /al\.entity_type = 'episode'/);
});

test('row mapping reads the aliased columns and then removes them', () => {
  const row = {
    id: 'series-kids-numbers',
    cover_url: null,
    cover_asset_r2_key: readyPublicImage.r2_key,
    cover_asset_visibility: 'public',
    cover_asset_status: 'ready',
    cover_asset_kind: 'image',
  };
  assert.deepEqual(artworkFromRow('cover_asset', row), readyPublicImage);

  applyArtworkUrl(row, 'cover_asset', 'cover_url', BASE);
  assert.equal(row.cover_url, `${BASE}/${readyPublicImage.r2_key}`);
  // internal columns must not leak to API consumers
  for (const column of ['r2_key', 'visibility', 'status', 'kind']) {
    assert.equal(`cover_asset_${column}` in row, false);
  }
});

test('stripArtworkColumns removes every internal column', () => {
  const row = {
    thumb_asset_r2_key: 'x',
    thumb_asset_visibility: 'public',
    thumb_asset_status: 'ready',
    thumb_asset_kind: 'image',
    keep: 1,
  };
  stripArtworkColumns('thumb_asset', row);
  assert.deepEqual(Object.keys(row), ['keep']);
});

test('a public asset whose key still carries the private prefix fails closed', () => {
  // Regression guard for the exact drift observed locally: an asset imported as
  // private, later flipped to public, keeps its private/ R2 key. Emitting a URL
  // would either 404 or advertise a private path on an anonymous CDN.
  const drifted = {
    r2_key: 'private/catalog/assets/images/series/posters/adventures-of-numbers-poster.png',
    visibility: 'public',
    status: 'ready',
    kind: 'image',
  };
  assert.equal(keyPrefixMatchesVisibility(drifted), false);
  assert.equal(isPubliclyServableAsset(drifted), false);
  assert.equal(publicAssetUrl(BASE, drifted), null);
});

test('key prefix and visibility must agree in both directions', () => {
  assert.equal(keyPrefixMatchesVisibility({ r2_key: 'public/a.webp', visibility: 'public' }), true);
  assert.equal(keyPrefixMatchesVisibility({ r2_key: 'public/a.webp', visibility: 'private' }), false);
  assert.equal(keyPrefixMatchesVisibility({ r2_key: 'private/a.mp4', visibility: 'private' }), true);
  assert.equal(keyPrefixMatchesVisibility({ r2_key: 'private/a.webp', visibility: 'public' }), false);
  // Unprefixed legacy keys are accepted.
  assert.equal(keyPrefixMatchesVisibility({ r2_key: 'legacy/a.webp', visibility: 'public' }), true);
});

test('a private linked asset falls back to null, not to the private key', () => {
  // End-to-end shape of the confirmed defect: the series has a ready poster
  // linked, but it is private, so the response must carry null rather than
  // leaking private/catalog/... to anonymous callers.
  const row = {
    cover_url: null,
    cover_asset_r2_key: 'private/catalog/assets/images/series/posters/adventures-of-numbers-poster.png',
    cover_asset_visibility: 'private',
    cover_asset_status: 'ready',
    cover_asset_kind: 'image',
  };
  applyArtworkUrl(row, 'cover_asset', 'cover_url', BASE);
  assert.equal(row.cover_url, null);
});


// --- planet artwork projection -------------------------------------------------
// GET /api/v1/planets used to select the planets.icon_url column directly. That
// column is NULL for every row, so planets reported no artwork even when a ready,
// public icon was attached through asset_links. Verified against local D1: all
// nine planets had icon_url null while six already had an 'icon' asset link.

test('PLANET_ICON_ROLES only accepts the icon role', () => {
  assert.deepEqual([...PLANET_ICON_ROLES], ['icon']);
});

test('PLANET_COVER_ROLES prefers a cover over a banner', () => {
  assert.deepEqual([...PLANET_COVER_ROLES], ['cover', 'banner']);
});

test('artworkSelect supports the planet entity type', () => {
  const sql = artworkSelect('icon_asset', 'planet', 'planets.id', PLANET_ICON_ROLES);
  assert.match(sql, /al\.entity_type = 'planet'/);
  assert.match(sql, /al\.entity_id = planets\.id/);
  assert.match(sql, /al\.role IN \('icon'\)/);
  assert.match(sql, /AS icon_asset_r2_key/);
  // The servability gate must be present for planets exactly as for series.
  assert.match(sql, /ca\.status = 'ready'/);
  assert.match(sql, /ca\.visibility = 'public'/);
  assert.match(sql, /ca\.kind NOT IN \('video', 'archive'\)/);
});

test('planet icon resolves from the asset projection, not the legacy column', () => {
  const row = {
    id: 'tarikh',
    icon_url: null,
    icon_asset_r2_key: 'public/catalog/assets/images/planets/planet-tarikh.webp',
    icon_asset_visibility: 'public',
    icon_asset_status: 'ready',
    icon_asset_kind: 'image',
  };
  applyArtworkUrl(row, 'icon_asset', 'icon_url', 'https://cdn.majarra.app');
  assert.equal(
    row.icon_url,
    'https://cdn.majarra.app/public/catalog/assets/images/planets/planet-tarikh.webp',
  );
  assert.equal('icon_asset_r2_key' in row, false);
});

test('a private planet asset never becomes a public icon url', () => {
  const row = {
    id: 'alam',
    icon_url: null,
    icon_asset_r2_key: 'private/catalog/assets/images/planets/planet-alamna.webp',
    icon_asset_visibility: 'private',
    icon_asset_status: 'ready',
    icon_asset_kind: 'image',
  };
  applyArtworkUrl(row, 'icon_asset', 'icon_url', 'https://cdn.majarra.app');
  assert.equal(row.icon_url, null);
});
