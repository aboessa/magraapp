/// Content availability: one decision function for every surface.
///
/// ## What this replaces
///
/// Nothing consulted `content_rights`. A series licensed for two countries was
/// served to every country by the catalogue, search, the home builder, downloads
/// and playback alike, and the only thing standing between a rights breach and a
/// child was that nobody had asked. The Flutter client could not have fixed it
/// either: a client-side check is a suggestion, and the API answers curl.
///
/// So this file is the *single* decision point, and it is pure: given the policy
/// chain and a request context it returns one answer with a machine code and a
/// human explanation. Every caller — public catalogue, playback lease, admin
/// preview — passes through it, which is the only way the app and the operator can
/// be shown the same truth.
///
/// ## Nearest policy wins
///
/// The chain is ordered nearest-first (episode, season, series, planet, global) and
/// the first row present is *the* policy. It is not intersected with its
/// ancestors. An override that can only tighten is not an override, and the case
/// that makes this concrete is ordinary: a series restricted by licence containing
/// one episode released worldwide as a trailer. An operator who sets that must see
/// it take effect, and if the system quietly kept the parent's restriction the
/// operator would conclude the feature is broken and work around it.
///
/// ## The unknown-country rule
///
/// When the request country cannot be determined, anything other than `worldwide`
/// is refused. This is deliberately the conservative direction: the alternative is
/// serving territory-restricted content *because* we failed to establish where the
/// request came from, which is indistinguishable from having no restriction at all.
///
/// Cloudflare populates `request.cf.country` for essentially all edge traffic, so
/// in production this branch is a rare edge (internal health checks, a request
/// arriving without geo data). Local development would otherwise be unable to see
/// restricted content at all, which is why `lib/requestGeo.ts` accepts an explicit
/// country header outside production — never in it.

export const AVAILABILITY_MODES = ['worldwide', 'worldwide_except', 'selected_only', 'unavailable'] as const;
export type AvailabilityMode = (typeof AVAILABILITY_MODES)[number];

export const AVAILABILITY_REASONS = ['rights', 'commercial', 'editorial', 'legal'] as const;
export type AvailabilityReason = (typeof AVAILABILITY_REASONS)[number];

/// Scopes a policy can attach to, from the platform default outward-in.
export const AVAILABILITY_SCOPES = [
  'global', 'planet', 'series', 'season', 'episode', 'story', 'book', 'game', 'project',
] as const;
export type AvailabilityScope = (typeof AVAILABILITY_SCOPES)[number];

export function isAvailabilityMode(value: unknown): value is AvailabilityMode {
  return typeof value === 'string' && (AVAILABILITY_MODES as readonly string[]).includes(value);
}

export function isAvailabilityReason(value: unknown): value is AvailabilityReason {
  return typeof value === 'string' && (AVAILABILITY_REASONS as readonly string[]).includes(value);
}

export function isAvailabilityScope(value: unknown): value is AvailabilityScope {
  return typeof value === 'string' && (AVAILABILITY_SCOPES as readonly string[]).includes(value);
}

export interface AvailabilityPolicy {
  entity_type: AvailabilityScope;
  entity_id: string;
  mode: AvailabilityMode;
  /// ISO 3166-1 alpha-2, upper case.
  countries: string[];
  languages: string[];
  platforms: string[];
  starts_at: string | null;
  ends_at: string | null;
  reason: AvailabilityReason;
  note: string | null;
}

export interface AvailabilityContext {
  /// ISO 3166-1 alpha-2 upper case, or null when it could not be determined.
  country: string | null;
  language?: string | null;
  /// ios | android | web | tv, as the client reports it.
  platform?: string | null;
  /// ISO timestamp. Injected rather than read from the clock so window rules are
  /// testable and cannot become flaky at a boundary.
  now: string;
}

/// Why a decision came out the way it did.
///
/// A code rather than a sentence because three different audiences consume this: a
/// client that must choose between "hide" and "show a message", an operator who
/// must know which axis excluded the request, and a log that must be aggregatable.
export type AvailabilityCode =
  | 'available'
  | 'unavailable'
  | 'country_excluded'
  | 'country_not_selected'
  | 'country_unknown'
  | 'window_not_started'
  | 'window_ended'
  | 'language_excluded'
  | 'platform_excluded';

export interface AvailabilityDecision {
  available: boolean;
  code: AvailabilityCode;
  /// `explicit` when the entity itself carries the policy, `inherited` when an
  /// ancestor does, `default` when nothing in the chain does. Surfaced verbatim in
  /// the admin so a detail page can say INHERITED or OVERRIDDEN rather than
  /// implying every row was configured by hand.
  source: 'explicit' | 'inherited' | 'default';
  policy: AvailabilityPolicy | null;
  inherited_from: { entity_type: AvailabilityScope; entity_id: string } | null;
  reason: AvailabilityReason | null;
  /// Operator-facing Arabic explanation. Never a bare "unavailable".
  message_ar: string;
}

const REASON_LABELS: Record<AvailabilityReason, string> = {
  rights: 'حقوق',
  commercial: 'تجاري',
  editorial: 'تحريري',
  legal: 'قانوني',
};

const MODE_LABELS: Record<AvailabilityMode, string> = {
  worldwide: 'متاح عالميًا',
  worldwide_except: 'عالميًا باستثناء دول محددة',
  selected_only: 'دول محددة فقط',
  unavailable: 'غير متاح',
};

export function availabilityModeLabel(mode: AvailabilityMode): string {
  return MODE_LABELS[mode];
}

export function availabilityReasonLabel(reason: AvailabilityReason): string {
  return REASON_LABELS[reason];
}

/// The ancestor chain for a content type, nearest first.
///
/// Stories, books, games and projects hang off a series rather than a season: none
/// of them has a season column in the schema, and inventing one in the resolver
/// would silently ignore a policy an operator had set.
export function availabilityChainScopes(type: AvailabilityScope): AvailabilityScope[] {
  switch (type) {
    case 'episode': return ['episode', 'season', 'series', 'planet', 'global'];
    case 'season': return ['season', 'series', 'planet', 'global'];
    case 'series': return ['series', 'planet', 'global'];
    case 'story': return ['story', 'series', 'planet', 'global'];
    case 'book': return ['book', 'series', 'planet', 'global'];
    case 'game': return ['game', 'series', 'planet', 'global'];
    case 'project': return ['project', 'series', 'planet', 'global'];
    case 'planet': return ['planet', 'global'];
    case 'global': return ['global'];
  }
}

function decision(
  available: boolean,
  code: AvailabilityCode,
  policy: AvailabilityPolicy,
  target: { entity_type: AvailabilityScope; entity_id: string },
  messageAr: string,
): AvailabilityDecision {
  const explicit = policy.entity_type === target.entity_type && policy.entity_id === target.entity_id;
  return {
    available,
    code,
    source: explicit ? 'explicit' : 'inherited',
    policy,
    inherited_from: explicit ? null : { entity_type: policy.entity_type, entity_id: policy.entity_id },
    reason: policy.reason,
    message_ar: messageAr,
  };
}

/// Resolves availability for one entity.
///
/// [chain] must be ordered nearest-first and contain at most one policy per scope;
/// the caller builds it from [availabilityChainScopes]. Extra or unordered entries
/// are not silently tolerated — the first entry is taken as nearest, so passing a
/// chain in the wrong order would produce a wrong answer, and that is why the
/// ordering is the caller's single responsibility and is covered by tests.
export function resolveAvailability(
  target: { entity_type: AvailabilityScope; entity_id: string },
  chain: AvailabilityPolicy[],
  context: AvailabilityContext,
): AvailabilityDecision {
  const policy = chain[0];
  if (!policy) {
    return {
      available: true,
      code: 'available',
      source: 'default',
      policy: null,
      inherited_from: null,
      reason: null,
      message_ar: 'لا سياسة إتاحة مسجّلة لهذا العنصر ولا لأصوله، فالافتراضي هو الإتاحة.',
    };
  }

  const where = policy.entity_type === target.entity_type && policy.entity_id === target.entity_id
    ? 'على العنصر نفسه'
    : `موروثة من ${policy.entity_type} «${policy.entity_id}»`;
  const because = `السبب: ${REASON_LABELS[policy.reason]}`;

  // Window first: a policy that has not started or has ended does not get to be
  // evaluated on its mode. Reported separately from `unavailable` because the
  // operator action differs — one is a date, the other is a decision.
  if (policy.starts_at && context.now < policy.starts_at) {
    return decision(false, 'window_not_started', policy, target,
      `نافذة الإتاحة تبدأ ${policy.starts_at} (${where}). ${because}`);
  }
  if (policy.ends_at && context.now > policy.ends_at) {
    return decision(false, 'window_ended', policy, target,
      `نافذة الإتاحة انتهت ${policy.ends_at} (${where}). ${because}`);
  }

  if (policy.mode === 'unavailable') {
    return decision(false, 'unavailable', policy, target,
      `العنصر معلَّن غير متاح (${where}). ${because}`
      + (policy.note ? ` — ${policy.note}` : ''));
  }

  if (policy.mode !== 'worldwide') {
    if (!context.country) {
      // See the header note: refusing here is the conservative direction.
      return decision(false, 'country_unknown', policy, target,
        `تعذّر تحديد بلد الطلب، والسياسة مقيّدة جغرافيًا (${MODE_LABELS[policy.mode]}، ${where})، `
        + 'فلا يجوز الافتراض بالسماح.');
    }
    const listed = policy.countries.includes(context.country);
    if (policy.mode === 'worldwide_except' && listed) {
      return decision(false, 'country_excluded', policy, target,
        `البلد ${context.country} مستثنى صراحةً (${where}). ${because}`);
    }
    if (policy.mode === 'selected_only' && !listed) {
      return decision(false, 'country_not_selected', policy, target,
        `البلد ${context.country} ليس ضمن الدول المسموح بها (${policy.countries.join(', ') || 'لا دول مسجّلة'}) `
        + `(${where}). ${because}`);
    }
  }

  // Language and platform narrow an otherwise-permitted decision. Both are
  // skipped when the caller did not supply the value: a null platform means "not
  // stated", and refusing on a value nobody claimed would block every server-side
  // caller that has no client context.
  if (policy.languages.length && context.language && !policy.languages.includes(context.language)) {
    return decision(false, 'language_excluded', policy, target,
      `اللغة ${context.language} ليست ضمن اللغات المسموح بها (${policy.languages.join(', ')}) (${where}). ${because}`);
  }
  if (policy.platforms.length && context.platform && !policy.platforms.includes(context.platform)) {
    return decision(false, 'platform_excluded', policy, target,
      `المنصّة ${context.platform} ليست ضمن المنصّات المسموح بها (${policy.platforms.join(', ')}) (${where}). ${because}`);
  }

  return decision(true, 'available', policy, target,
    `${MODE_LABELS[policy.mode]} (${where}).`);
}

/// Validates an admin-supplied policy, returning the normalised row or an error.
///
/// Country codes are normalised to upper case here rather than at the call site so
/// a policy written as `['sa']` and a request reporting `SA` cannot disagree — a
/// case mismatch would silently unrestrict content, which is the worst possible
/// failure for this table.
export function normalizeAvailabilityInput(input: {
  mode: unknown; countries: unknown; languages: unknown; platforms: unknown;
  starts_at: unknown; ends_at: unknown; reason: unknown; note: unknown;
}): { error: string } | {
  policy: Omit<AvailabilityPolicy, 'entity_type' | 'entity_id'>;
} {
  if (!isAvailabilityMode(input.mode)) {
    return { error: `mode must be one of: ${AVAILABILITY_MODES.join(', ')}` };
  }
  if (!isAvailabilityReason(input.reason)) {
    return { error: `reason must be one of: ${AVAILABILITY_REASONS.join(', ')}` };
  }

  const codes = (value: unknown, field: string, pattern: RegExp): string[] | { error: string } => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return { error: `${field} must be an array` };
    const out: string[] = [];
    for (const item of value) {
      if (typeof item !== 'string' || !pattern.test(item.trim())) {
        return { error: `${field} contains an invalid value: ${String(item)}` };
      }
      const normalised = field === 'countries' ? item.trim().toUpperCase() : item.trim().toLowerCase();
      if (!out.includes(normalised)) out.push(normalised);
    }
    return out;
  };

  const countries = codes(input.countries, 'countries', /^[A-Za-z]{2}$/);
  if (!Array.isArray(countries)) return countries;
  const languages = codes(input.languages, 'languages', /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/);
  if (!Array.isArray(languages)) return languages;
  const platforms = codes(input.platforms, 'platforms', /^(ios|android|web|tv)$/i);
  if (!Array.isArray(platforms)) return platforms;

  // A restricted mode with no country list is almost certainly a half-finished
  // edit, and its two possible readings are opposites: `selected_only` with no
  // countries blocks the world, `worldwide_except` with none blocks nobody.
  // Refusing is better than guessing which the operator meant.
  if (input.mode === 'selected_only' && countries.length === 0) {
    return { error: 'selected_only requires at least one country' };
  }
  if (input.mode === 'worldwide_except' && countries.length === 0) {
    return { error: 'worldwide_except requires at least one excluded country' };
  }

  const timestamp = (value: unknown, field: string): string | null | { error: string } => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return { error: `${field} must be an ISO 8601 timestamp` };
    }
    return value;
  };
  const startsAt = timestamp(input.starts_at, 'starts_at');
  if (startsAt && typeof startsAt !== 'string') return startsAt;
  const endsAt = timestamp(input.ends_at, 'ends_at');
  if (endsAt && typeof endsAt !== 'string') return endsAt;
  if (typeof startsAt === 'string' && typeof endsAt === 'string' && startsAt > endsAt) {
    return { error: 'starts_at must not be after ends_at' };
  }

  const note = input.note === undefined || input.note === null || input.note === ''
    ? null
    : typeof input.note === 'string' ? input.note.trim().slice(0, 500) : null;

  return {
    policy: {
      mode: input.mode,
      countries,
      languages,
      platforms,
      starts_at: (startsAt as string | null) ?? null,
      ends_at: (endsAt as string | null) ?? null,
      reason: input.reason,
      note,
    },
  };
}
