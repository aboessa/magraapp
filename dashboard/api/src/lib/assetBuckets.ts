/// Which R2 bucket an asset belongs in, derived from what the asset *is*.
///
/// ## The architecture
///
/// | Bucket           | Binding         | Contents                                              | Public CDN |
/// |------------------|-----------------|-------------------------------------------------------|------------|
/// | `majarra-media`  | `MEDIA_BUCKET`  | episode video, streams, downloadables, protected audio | **never**  |
/// | `majarra-thumbs` | `THUMBS_BUCKET` | series posters, episode thumbnails/stills, banners, covers, public catalogue images | yes |
///
/// `THUMBS_BUCKET` is the origin for `PUBLIC_ASSET_BASE_URL` (cdn.majarra.app).
/// `MEDIA_BUCKET` is never fronted by a CDN; its objects are reachable only
/// through `POST /episodes/:id/playback-sessions`, which mints a short-lived
/// signed capability consumed by `routes/media.ts`.
///
/// ## The defect this fixes
///
/// `bucket` used to be a caller-supplied column defaulting to `'media'`, wholly
/// decoupled from `visibility`. Verified against local D1: 18 assets were
/// `visibility='public'` with `public/` keys yet sat in `bucket='media'`. Once a
/// CDN is pointed at the public bucket those objects 404, and worse, pointing the
/// CDN at `MEDIA_BUCKET` instead — the only way to make them resolve — would
/// expose every private episode video to anonymous download.
///
/// The bucket is therefore no longer an input. It is a pure function of
/// visibility, and the two can no longer drift.

export type BucketName = 'media' | 'thumbs';

export const PUBLIC_BUCKET: BucketName = 'thumbs';
export const PRIVATE_BUCKET: BucketName = 'media';

export const BUCKET_NAMES: readonly BucketName[] = ['media', 'thumbs'];

/// Kinds that must never be public regardless of how they were classified.
/// Streams and game packs are entitlement controlled.
export const ALWAYS_PRIVATE_KINDS = ['video', 'archive'] as const;

export function isAlwaysPrivateKind(kind: string | null | undefined): boolean {
  return !!kind && (ALWAYS_PRIVATE_KINDS as readonly string[]).includes(kind);
}

/// The single authority mapping an asset to its bucket.
///
/// Video and archives are forced private even if `visibility` claims otherwise,
/// so a mislabelled row cannot land a stream in the CDN-fronted bucket.
export function bucketForAsset(asset: {
  visibility?: string | null;
  kind?: string | null;
}): BucketName {
  if (isAlwaysPrivateKind(asset.kind)) return PRIVATE_BUCKET;
  return asset.visibility === 'public' ? PUBLIC_BUCKET : PRIVATE_BUCKET;
}

/// The scope prefix R2 keys are minted with, matching [bucketForAsset].
export function keyScopeForAsset(asset: {
  visibility?: string | null;
  kind?: string | null;
}): 'public' | 'private' {
  return bucketForAsset(asset) === PUBLIC_BUCKET ? 'public' : 'private';
}

/// True when an asset's stored bucket/key/visibility triple is self-consistent.
/// Used by the migration to decide what needs repair and by tests to assert the
/// invariant holds for every row.
export function assetPlacementIsConsistent(asset: {
  visibility?: string | null;
  kind?: string | null;
  bucket?: string | null;
  r2_key?: string | null;
}): boolean {
  const expectedBucket = bucketForAsset(asset);
  if ((asset.bucket ?? null) !== expectedBucket) return false;
  const key = String(asset.r2_key ?? '');
  if (!key) return true; // nothing uploaded yet
  return key.startsWith(`${keyScopeForAsset(asset)}/`);
}

/// Rewrites a key so its scope prefix matches the asset's real classification,
/// preserving the rest of the path so logical grouping and filenames survive
/// migration. Returns the key unchanged when it is already correct.
export function rekeyForAsset(
  key: string,
  asset: { visibility?: string | null; kind?: string | null },
): string {
  const scope = keyScopeForAsset(asset);
  const trimmed = key.replace(/^\/+/, '');
  if (trimmed.startsWith(`${scope}/`)) return trimmed;
  const withoutScope = trimmed.replace(/^(public|private)\//, '');
  return `${scope}/${withoutScope}`;
}
