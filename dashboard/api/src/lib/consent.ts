/// Parental consent.
///
/// ## The hole this closes
///
/// Migration 0025 added `child_creations` to `parental_consents.consent_type`, and
/// `docs/games/10-child-creations-storage.md` states that the absence of a row
/// means no consent, so cloud saving stays unavailable until a parent grants it.
///
/// Neither half was true. There was no route to grant or read a consent, and the
/// creations upload never checked one, so a drawing could be stored in private
/// family storage without the parent having been asked. The documentation
/// described a control that did not exist.
///
/// Pure so the policy is testable without a database: `routes/family.ts` supplies
/// the rows.

export const CONSENT_TYPES = [
  'data_collection',
  'analytics',
  'voice',
  'personalization',
  /// Storing an image the child drew in private family storage. Covers upload,
  /// retention and parent viewing. Never covers publishing or sharing, because no
  /// such feature exists.
  'child_creations',
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export function isConsentType(value: unknown): value is ConsentType {
  return typeof value === 'string' && (CONSENT_TYPES as readonly string[]).includes(value);
}

/// The consent version a client must acknowledge.
///
/// Bumping this invalidates every prior grant for that type, which is the point:
/// if what is stored or how long it is kept changes, the previous "yes" was to a
/// different question.
export const CONSENT_VERSIONS: Record<ConsentType, string> = {
  data_collection: '1',
  analytics: '1',
  voice: '1',
  personalization: '1',
  child_creations: '1',
};

export interface ConsentRow {
  consent_type: string;
  child_id: string | null;
  version: string;
  granted_at: string | null;
  revoked_at: string | null;
}

export interface ConsentDecision {
  granted: boolean;
  /// Why it is not granted, for a message a parent can act on.
  reason?: 'never_granted' | 'revoked' | 'version_superseded';
  required_version: string;
}

/// Whether [type] is granted for [childId].
///
/// Rules, and why each exists:
///  - a revoked row is not consent, whatever its date. Revocation must win, or a
///    parent's withdrawal would be silently ignored.
///  - a family-wide row (child_id NULL) covers every child, because a parent
///    answering for the household should not have to repeat it per profile.
///  - a row for a *different* child does not count. Consent is per child by
///    default so one child's drawings being kept does not decide for a sibling.
///  - an outdated version is not consent. See [CONSENT_VERSIONS].
export function evaluateConsent(
  rows: readonly ConsentRow[],
  type: ConsentType,
  childId: string | null,
): ConsentDecision {
  const requiredVersion = CONSENT_VERSIONS[type];
  const relevant = rows.filter((row) =>
    row.consent_type === type &&
    (row.child_id === null || row.child_id === childId));

  if (relevant.length === 0) {
    return { granted: false, reason: 'never_granted', required_version: requiredVersion };
  }

  // Any revocation for a matching scope withdraws consent. Checked before the
  // version so a parent who said no is never overridden by an older yes.
  if (relevant.some((row) => row.revoked_at !== null)) {
    const live = relevant.filter((row) => row.revoked_at === null);
    if (live.length === 0) {
      return { granted: false, reason: 'revoked', required_version: requiredVersion };
    }
  }

  const live = relevant.filter((row) => row.revoked_at === null);
  if (live.some((row) => row.version === requiredVersion)) {
    return { granted: true, required_version: requiredVersion };
  }
  return { granted: false, reason: 'version_superseded', required_version: requiredVersion };
}

/// Validates a grant or revoke request.
export interface ConsentWrite {
  type: ConsentType;
  childId: string | null;
  version: string;
  revoke: boolean;
}

export function parseConsentWrite(body: Record<string, unknown>): { write: ConsentWrite } | { error: string } {
  const type = body.consent_type;
  if (!isConsentType(type)) {
    return { error: `consent_type must be one of ${CONSENT_TYPES.join(', ')}` };
  }

  const childRaw = body.child_id;
  const childId = childRaw === undefined || childRaw === null || childRaw === ''
    ? null
    : typeof childRaw === 'string' ? childRaw.trim() : null;
  if (childRaw !== undefined && childRaw !== null && childRaw !== '' && !childId) {
    return { error: 'child_id must be a non-empty string or null' };
  }

  // The client must name the version it is agreeing to. Defaulting it would let a
  // stale app grant a consent for terms it never showed the parent.
  const version = typeof body.version === 'string' ? body.version.trim() : '';
  if (!version) return { error: 'version is required' };
  if (version !== CONSENT_VERSIONS[type]) {
    return {
      error: `version "${version}" is not current for ${type}; expected "${CONSENT_VERSIONS[type]}"`,
    };
  }

  return {
    write: { type, childId, version, revoke: body.revoke === true },
  };
}
