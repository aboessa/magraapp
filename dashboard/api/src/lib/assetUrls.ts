import type { Env } from './db';

/// Public URL policy for catalogue artwork.
///
/// ## Single source of truth
///
/// `content_assets` + `asset_links` are authoritative for media. The legacy
/// `series.cover_url` and `episodes.thumbnail_url` columns are **deprecated**:
/// they are still read as a fallback so existing rows keep working, but nothing
/// writes to them and new artwork must be attached through `asset_links`.
///
/// Before this module existed, the public catalogue endpoints selected those
/// columns directly and performed no join at all, so an episode or series could
/// have a fully uploaded, `ready` poster attached and still report
/// `cover_url: null`. That was verified against local D1 for
/// `series-kids-numbers`.
///
/// ## Why URLs are built here rather than stored
///
/// Storing a resolved URL in a second place means two rows to keep in sync, and
/// it bakes the CDN hostname into the database — so moving domains would require
/// a data migration. Building it at read time keeps one writer
/// (`asset_links`) and makes the hostname a deployment concern.
///
/// ## Safety rule
///
/// Only assets that are explicitly `visibility = 'public'` are ever turned into
/// a URL. Private assets — notably video streams — must continue to flow
/// exclusively through `POST /episodes/:id/playback-sessions`, which issues a
/// short-lived capability token. A private asset resolves to `null` here, never
/// to a guessable public URL.

/// Roles that may act as the primary artwork for an entity, in priority order.
export const SERIES_COVER_ROLES = ['poster', 'cover'] as const;
export const EPISODE_THUMBNAIL_ROLES = ['thumbnail', 'still', 'cover'] as const;
export const PLANET_ICON_ROLES = ['icon'] as const;
export const PLANET_COVER_ROLES = ['cover', 'banner'] as const;

/// Entity types that can carry projected artwork.
export type ArtworkEntityType = 'series' | 'episode' | 'planet';

/// The minimum asset shape needed to decide on a public URL.
export type AssetUrlCandidate = {
  r2_key?: string | null;
  visibility?: string | null;
  status?: string | null;
  kind?: string | null;
};

export function publicAssetBaseUrl(env: Pick<Env, 'PUBLIC_ASSET_BASE_URL'>): string | null {
  const raw = typeof env.PUBLIC_ASSET_BASE_URL === 'string' ? env.PUBLIC_ASSET_BASE_URL.trim() : '';
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

/// Guards against the key prefix disagreeing with the asset's visibility.
///
/// R2 object keys are minted as `{public|private}/...`, so the prefix and the
/// `visibility` column must agree. If they drift — for example an asset imported
/// as private is later flipped to public without re-keying the object — emitting
/// a URL would either 404 or advertise a `private/` path on an anonymous CDN.
/// Both are worse than returning null, so this fails closed.
export function keyPrefixMatchesVisibility(asset: AssetUrlCandidate): boolean {
  const key = String(asset.r2_key ?? '');
  if (key.startsWith('public/')) return asset.visibility === 'public';
  if (key.startsWith('private/')) return asset.visibility === 'private';
  // Keys without a scope prefix predate the convention; treat them as usable.
  return true;
}

/// True only when the asset is safe and complete enough to serve anonymously.
export function isPubliclyServableAsset(asset: AssetUrlCandidate | null | undefined): boolean {
  if (!asset) return false;
  if (asset.visibility !== 'public') return false;
  if (asset.status !== 'ready') return false;
  if (typeof asset.r2_key !== 'string' || !asset.r2_key.trim()) return false;
  // Streams and downloadables are entitlement controlled and must not be
  // reachable without a capability token, regardless of visibility.
  if (asset.kind === 'video' || asset.kind === 'archive') return false;
  if (!keyPrefixMatchesVisibility(asset)) return false;
  return true;
}

/// Builds the CDN URL for a publicly servable asset, or null.
export function publicAssetUrl(
  baseUrl: string | null,
  asset: AssetUrlCandidate | null | undefined,
): string | null {
  if (!baseUrl) return null;
  if (!isPubliclyServableAsset(asset)) return null;
  const key = String(asset!.r2_key).replace(/^\/+/, '');
  return `${baseUrl}/${key}`;
}

/// Chooses between the asset projection and the deprecated stored column.
/// The projection always wins so `asset_links` remains the single writer.
export function resolveArtworkUrl(
  baseUrl: string | null,
  asset: AssetUrlCandidate | null | undefined,
  legacyColumnValue: unknown,
): string | null {
  const projected = publicAssetUrl(baseUrl, asset);
  if (projected) return projected;
  return typeof legacyColumnValue === 'string' && legacyColumnValue.trim()
    ? legacyColumnValue.trim()
    : null;
}

/// SQL fragment selecting the best artwork asset for an entity.
///
/// Emits four aliased columns prefixed with [prefix] so the caller can hand the
/// row straight to [resolveArtworkUrl]. Roles are inlined as literals from the
/// module's own allowlists, never from request input, so this cannot be used to
/// inject SQL.
export function artworkSelect(
  prefix: string,
  entityType: ArtworkEntityType,
  entityIdColumn: string,
  roles: readonly string[],
): string {
  const roleList = roles.map((role) => `'${role}'`).join(', ');
  const rolePriority = roles
    .map((role, index) => `WHEN '${role}' THEN ${index}`)
    .join(' ');
  const pick = (column: string) => `
    (SELECT ca.${column}
       FROM asset_links al
       JOIN content_assets ca ON ca.id = al.asset_id
      WHERE al.entity_type = '${entityType}'
        AND al.entity_id = ${entityIdColumn}
        AND al.role IN (${roleList})
        AND ca.status = 'ready'
        AND ca.visibility = 'public'
        AND ca.r2_key IS NOT NULL
        AND ca.kind NOT IN ('video', 'archive')
      ORDER BY CASE al.role ${rolePriority} ELSE 99 END, al.sort_order ASC
      LIMIT 1) AS ${prefix}_${column}`;
  return [
    pick('r2_key'),
    pick('visibility'),
    pick('status'),
    pick('kind'),
  ].join(',');
}

/// Extracts the aliased artwork columns produced by [artworkSelect] from a row.
export function artworkFromRow(prefix: string, row: Record<string, unknown>): AssetUrlCandidate {
  return {
    r2_key: (row[`${prefix}_r2_key`] ?? null) as string | null,
    visibility: (row[`${prefix}_visibility`] ?? null) as string | null,
    status: (row[`${prefix}_status`] ?? null) as string | null,
    kind: (row[`${prefix}_kind`] ?? null) as string | null,
  };
}

/// Removes the internal artwork columns so they never reach API consumers.
export function stripArtworkColumns(prefix: string, row: Record<string, unknown>): void {
  for (const column of ['r2_key', 'visibility', 'status', 'kind']) {
    delete row[`${prefix}_${column}`];
  }
}

/// Replaces [targetField] on [row] with the resolved artwork URL and removes the
/// internal columns. Mutates and returns the row.
export function applyArtworkUrl(
  row: Record<string, unknown>,
  prefix: string,
  targetField: string,
  baseUrl: string | null,
): Record<string, unknown> {
  const asset = artworkFromRow(prefix, row);
  row[targetField] = resolveArtworkUrl(baseUrl, asset, row[targetField]);
  stripArtworkColumns(prefix, row);
  return row;
}
