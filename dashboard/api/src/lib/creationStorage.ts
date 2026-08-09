/// Private storage for child-created drawings.
///
/// ## Why a third bucket
///
/// `lib/assetBuckets.ts` maps every catalogue asset onto one of two buckets, and
/// that mapping is a pure function of `visibility`:
///
///   THUMBS_BUCKET   public, fronted by cdn.majarra.app
///   MEDIA_BUCKET    private, entitlement-controlled catalogue media
///
/// A child's drawing fits neither. `public` would put it behind the CDN, which is
/// unacceptable at any price. `private` would file it as catalogue media, whose
/// access model is "does this family's plan entitle them to this content" — the
/// wrong question entirely for something the child made.
///
/// So creations get their own bucket, and this module is deliberately **not**
/// wired into `bucketForAsset`. That invariant is what makes it impossible for a
/// `visibility` flip, a mislabelled row or a future refactor of the catalogue
/// pipeline to relocate a child's drawing into a public bucket.
///
/// ## Keys
///
/// `family/{familyId}/child/{childId}/{creationId}.{ext}`
///
/// The family and child are in the path, so an object cannot be read without
/// naming whose it is, and `FamilyState` re-checks the child segment before it
/// will record the row. There is no public URL form anywhere in the codebase.

/// Image types a canvas export can legitimately produce.
///
/// A closed list, not a prefix check: `image/svg+xml` is an image type and also a
/// script container, and it must never be storable here.
export const CREATION_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
};

/// Largest creation accepted, in bytes.
///
/// A flood-filled line drawing compresses far below this. The cap exists because
/// the upload is authenticated but otherwise unconstrained, and a child tapping
/// save repeatedly should not be able to fill a bucket.
export const MAX_CREATION_BYTES = 2 * 1024 * 1024;

/// Largest edge, in pixels.
export const MAX_CREATION_DIMENSION = 2048;

export function isSupportedCreationType(mimeType: string): boolean {
  return Object.prototype.hasOwnProperty.call(CREATION_MIME_TYPES, mimeType);
}

export function extensionForCreationType(mimeType: string): string | null {
  return CREATION_MIME_TYPES[mimeType] ?? null;
}

/// Ids that are safe to interpolate into a storage key.
///
/// Anything outside this set could climb out of the prefix (`..`), collide with a
/// delimiter, or make a key that cannot be deleted. Ids are server-generated or
/// UUIDs in practice; this makes that a checked property rather than an
/// assumption.
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isSafeStorageId(value: unknown): value is string {
  return typeof value === 'string' && SAFE_ID.test(value);
}

export interface CreationKeyParts {
  familyId: string;
  childId: string;
  creationId: string;
  mimeType: string;
}

/// Builds the storage key, or null when any part is unsafe.
///
/// Returning null rather than throwing keeps the caller's error path a 400 with a
/// clear message instead of a 500.
export function creationStorageKey(parts: CreationKeyParts): string | null {
  const extension = extensionForCreationType(parts.mimeType);
  if (!extension) return null;
  if (!isSafeStorageId(parts.familyId)) return null;
  if (!isSafeStorageId(parts.childId)) return null;
  if (!isSafeStorageId(parts.creationId)) return null;
  return `family/${parts.familyId}/child/${parts.childId}/${parts.creationId}.${extension}`;
}

/// Whether [key] belongs to the given family and child.
///
/// Used before any read or delete. Ownership is decided from the key's own shape
/// as well as from the row, so a tampered key cannot reach another family's
/// object even if a row lookup were somehow bypassed.
export function creationKeyBelongsTo(
  key: string,
  familyId: string,
  childId?: string,
): boolean {
  if (!isSafeStorageId(familyId)) return false;
  const familyPrefix = `family/${familyId}/child/`;
  if (!key.startsWith(familyPrefix)) return false;
  if (childId === undefined) return true;
  if (!isSafeStorageId(childId)) return false;
  return key.startsWith(`${familyPrefix}${childId}/`);
}

/// Validates the declared shape of an upload before any bytes are written.
export interface CreationUploadClaim {
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}

export function creationClaimError(claim: CreationUploadClaim): string | null {
  if (!isSupportedCreationType(claim.mimeType)) {
    return `Unsupported creation type "${claim.mimeType}". Only PNG and WebP are stored.`;
  }
  if (!Number.isInteger(claim.byteSize) || claim.byteSize <= 0) {
    return 'byte_size must be a positive integer';
  }
  if (claim.byteSize > MAX_CREATION_BYTES) {
    return `Creation exceeds the ${MAX_CREATION_BYTES} byte limit`;
  }
  for (const [name, value] of [['width', claim.width], ['height', claim.height]] as const) {
    if (!Number.isInteger(value) || value <= 0) return `${name} must be a positive integer`;
    if (value > MAX_CREATION_DIMENSION) {
      return `${name} exceeds the ${MAX_CREATION_DIMENSION}px limit`;
    }
  }
  return null;
}

/// Magic-byte check on the uploaded body.
///
/// The declared content type is caller-supplied and therefore untrusted. Storing
/// arbitrary bytes under an image content type is how a private bucket becomes a
/// file drop, so the bytes themselves must agree with the claim.
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return 'image/png';
  }
  // WebP: "RIFF" .... "WEBP"
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'image/webp';
  }
  return null;
}
