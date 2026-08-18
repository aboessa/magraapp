/**
 * The Home Builder domain: block types, targeting, scheduling and resolution.
 *
 * ## Why this module exists
 *
 * The resolved Home screen was computed **twice**, with different rules:
 * `routes/homeResolved.ts` filtered one way for the live app and
 * `routes/adminAppExperience.ts` filtered another way for the admin preview. The
 * admin preview compared `t.country !== country` while the app compared
 * `t.country.toUpperCase() !== country && country`, the app understood
 * `language` and the preview did not, and neither supported the list-valued
 * countries the admin UI was already writing. So the preview could not be
 * trusted to show what a child would get, which is the entire purpose of a
 * preview.
 *
 * One resolver lives here and both callers use it. The targeting dimensions are
 * enumerated rather than free-form for the same reason: the builder must not be
 * able to save a rule the resolver silently ignores.
 */

/// Every `block_type` the table's CHECK constraint accepts.
///
/// Kept in sync with `migrations/0051_home_builder_resolved.sql` by
/// `test/homeExperience.test.mjs`, which reads the migration and compares. A
/// value outside this list is rejected by the API with a 400 rather than
/// reaching SQLite and surfacing as an opaque constraint error.
export const HOME_BLOCK_TYPES = [
  'hero_slider', 'content_rail', 'planet_orbit', 'feature_banner', 'learning_journey',
  'audio_rail', 'character_orbit', 'seasonal_banner', 'welcome', 'coming_soon',
  'watch_free', 'new_releases', 'most_watched', 'continue_watching', 'continue_drawing',
  'explore_majarra', 'creative_studio', 'new_episodes', 'recently_added', 'games',
  'stories', 'audio', 'recommended', 'because_you_watched', 'seasonal',
] as const

export type HomeBlockType = typeof HOME_BLOCK_TYPES[number]

/**
 * Blocks whose contents the server computes from the child's own state rather
 * than from an editorial selection.
 *
 * An editor can order, title, schedule and target a system block, but cannot
 * choose its items — "continue watching" is whatever the child has actually
 * started. The distinction is reported to the client as `source` so a screen can
 * explain why a row has no content picker.
 */
export const SYSTEM_BLOCK_TYPES: readonly string[] = [
  'continue_watching', 'continue_drawing', 'recommended', 'because_you_watched',
  'most_watched', 'learning_journey',
]

export function isSystemBlock(blockType: string, config: Record<string, unknown>): boolean {
  // An explicit `system: true` in config wins, because the seed data uses it and
  // removing it would silently reclassify seeded rows.
  if (config.system === true) return true
  return SYSTEM_BLOCK_TYPES.includes(blockType)
}

/* ------------------------------------------------------------- targeting */

/**
 * The targeting dimensions the resolver actually implements.
 *
 * Anything else is refused on write. The admin UI previously rendered an
 * "Age min/max" sentence from `targeting.age_min`/`age_max`, which no resolver
 * has ever read: a rule typed there would have been saved, displayed back as if
 * it were in force, and ignored on every request. Refusing unknown keys is what
 * makes the builder's promises checkable.
 */
export const TARGETING_DIMENSIONS = [
  'track', 'language', 'country', 'plan', 'platform', 'min_app_version', 'is_new_user',
] as const

const TRACKS = ['preschool', 'kids', 'junior']
const PLANS = ['free', 'family', 'family_plus']
const PLATFORMS = ['phone', 'tablet', 'tv']

export interface HomeTargeting {
  /// Age track. Empty means every track.
  track?: string[]
  language?: string[]
  /// ISO-3166 alpha-2, upper case.
  country?: string[]
  plan?: string[]
  platform?: string[]
  /**
   * Minimum app version, inclusive, as dot-separated integers.
   *
   * Named `min_app_version` rather than `app_version` because the previous
   * resolver did an exact string comparison (`t.app_version !== appVersion`)
   * while the admin UI displayed it as "≥ 2.4". A block targeted at "2.4" was
   * therefore hidden from 2.5, which is the opposite of what the screen said.
   */
  min_app_version?: string
  is_new_user?: boolean
}

/// The request context a block is resolved against.
export interface HomeContext {
  track: string
  language: string
  country: string
  plan: string
  platform: string
  appVersion: string
  isNewUser: boolean
}

/// Failure detail for a rejected targeting or config object.
export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function stringList(
  key: string, raw: unknown, allowed: string[] | null, normalize: (item: string) => string,
): ParseResult<string[]> {
  // A single string is accepted and normalized to a one-item list: it is the
  // natural thing for a caller to send and the stored seed rows use it.
  const items = Array.isArray(raw) ? raw : [raw]
  if (!items.length || items.length > 40) {
    return { ok: false, error: `targeting.${key} must hold between 1 and 40 values` }
  }
  const values: string[] = []
  for (const item of items) {
    if (typeof item !== 'string' || !item.trim()) {
      return { ok: false, error: `targeting.${key} must contain non-empty strings` }
    }
    const value = normalize(item.trim())
    if (allowed && !allowed.includes(value)) {
      return { ok: false, error: `targeting.${key} does not accept "${item}"; allowed: ${allowed.join(', ')}` }
    }
    if (!values.includes(value)) values.push(value)
  }
  return { ok: true, value: values }
}

const VERSION_PATTERN = /^\d+(?:\.\d+){0,3}$/

/**
 * Compares dot-separated numeric versions.
 *
 * Returns a negative number when `left` is older. Missing components count as
 * zero, so "2.4" and "2.4.0" compare equal.
 */
export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const b = right.split('.').map((part) => Number.parseInt(part, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

/// Validates a targeting object, rejecting unknown dimensions.
export function parseTargeting(raw: unknown): ParseResult<HomeTargeting> {
  if (raw === undefined || raw === null) return { ok: true, value: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'targeting must be an object' }
  }
  const input = raw as Record<string, unknown>
  const unknown = Object.keys(input).filter(
    (key) => !(TARGETING_DIMENSIONS as readonly string[]).includes(key),
  )
  if (unknown.length) {
    return {
      ok: false,
      error: `unsupported targeting dimension(s): ${unknown.join(', ')}. `
        + `The resolver implements only: ${TARGETING_DIMENSIONS.join(', ')}`,
    }
  }

  const value: HomeTargeting = {}
  const lists: Array<[keyof HomeTargeting & string, string[] | null, (item: string) => string]> = [
    ['track', TRACKS, (item) => item.toLowerCase()],
    ['language', null, (item) => item.toLowerCase()],
    ['country', null, (item) => item.toUpperCase()],
    ['plan', PLANS, (item) => item.toLowerCase()],
    ['platform', PLATFORMS, (item) => item.toLowerCase()],
  ]
  for (const [key, allowed, normalize] of lists) {
    if (input[key] === undefined || input[key] === null) continue
    const parsed = stringList(key, input[key], allowed, normalize)
    if (!parsed.ok) return parsed
    if (key === 'language' && parsed.value.some((item) => !/^[a-z]{2,3}$/.test(item))) {
      return { ok: false, error: 'targeting.language must hold ISO language codes' }
    }
    if (key === 'country' && parsed.value.some((item) => !/^[A-Z]{2}$/.test(item))) {
      return { ok: false, error: 'targeting.country must hold ISO-3166 alpha-2 codes' }
    }
    ;(value as Record<string, unknown>)[key] = parsed.value
  }

  if (input.min_app_version !== undefined && input.min_app_version !== null) {
    if (typeof input.min_app_version !== 'string' || !VERSION_PATTERN.test(input.min_app_version)) {
      return { ok: false, error: 'targeting.min_app_version must look like 2 or 2.4 or 2.4.1' }
    }
    value.min_app_version = input.min_app_version
  }
  if (input.is_new_user !== undefined && input.is_new_user !== null) {
    if (typeof input.is_new_user !== 'boolean') {
      return { ok: false, error: 'targeting.is_new_user must be a boolean' }
    }
    value.is_new_user = input.is_new_user
  }
  return { ok: true, value }
}

/**
 * Whether a block's targeting admits this request.
 *
 * An empty dimension means "everyone", which is why an absent list passes rather
 * than fails. `country` is the one dimension that can be unknown at request time
 * (geo lookup can fail): an unknown country cannot satisfy a country rule, so a
 * country-targeted block is withheld rather than shown to the wrong territory.
 */
export function matchesTargeting(targeting: HomeTargeting, context: HomeContext): boolean {
  const admits = (list: string[] | undefined, actual: string) =>
    !list?.length || list.includes(actual)

  if (!admits(targeting.track, context.track)) return false
  if (!admits(targeting.language, context.language)) return false
  if (targeting.country?.length && !targeting.country.includes(context.country)) return false
  if (!admits(targeting.plan, context.plan)) return false
  if (!admits(targeting.platform, context.platform)) return false
  if (targeting.min_app_version
    && compareVersions(context.appVersion, targeting.min_app_version) < 0) return false
  if (targeting.is_new_user !== undefined && targeting.is_new_user !== context.isNewUser) return false
  return true
}

/* ---------------------------------------------------------------- config */

/// The config keys a block understands. Unknown keys are refused on write.
export const CONFIG_KEYS = [
  'system', 'subtitle', 'card_style', 'maxItems', 'freshnessDays', 'bannerAsset', 'season',
] as const

const CARD_STYLES = ['portrait', 'landscape', 'story', 'square', 'audio', 'hero', 'soon']

export interface HomeBlockConfig {
  system?: boolean
  subtitle?: string | null
  card_style?: string | null
  maxItems?: number
  freshnessDays?: number
  bannerAsset?: string
  season?: string
}

export function parseBlockConfig(raw: unknown): ParseResult<HomeBlockConfig> {
  if (raw === undefined || raw === null) return { ok: true, value: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'config must be an object' }
  }
  const input = raw as Record<string, unknown>
  const unknown = Object.keys(input).filter((key) => !(CONFIG_KEYS as readonly string[]).includes(key))
  if (unknown.length) {
    return { ok: false, error: `unsupported config key(s): ${unknown.join(', ')}. Allowed: ${CONFIG_KEYS.join(', ')}` }
  }

  const value: HomeBlockConfig = {}
  if (input.system !== undefined) {
    if (typeof input.system !== 'boolean') return { ok: false, error: 'config.system must be a boolean' }
    value.system = input.system
  }
  for (const key of ['subtitle', 'bannerAsset', 'season'] as const) {
    if (input[key] === undefined) continue
    if (input[key] === null) { value[key] = undefined; continue }
    if (typeof input[key] !== 'string' || (input[key] as string).length > 300) {
      return { ok: false, error: `config.${key} must be a string of at most 300 characters` }
    }
    value[key] = input[key] as string
  }
  if (input.card_style !== undefined && input.card_style !== null) {
    if (typeof input.card_style !== 'string' || !CARD_STYLES.includes(input.card_style)) {
      return { ok: false, error: `config.card_style must be one of: ${CARD_STYLES.join(', ')}` }
    }
    value.card_style = input.card_style
  }
  for (const key of ['maxItems', 'freshnessDays'] as const) {
    if (input[key] === undefined || input[key] === null) continue
    const parsed = Number(input[key])
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
      return { ok: false, error: `config.${key} must be an integer between 1 and 60` }
    }
    value[key] = parsed
  }
  return { ok: true, value }
}

/* ------------------------------------------------------------ resolution */

/// A stored block row, as both the admin and the public resolver read it.
export interface HomeBlockRow {
  id: string
  block_type: string
  title_ar: string | null
  sort_order: number
  is_active: number
  is_draft: number
  scheduled_at: string | null
  expires_at: string | null
  version?: number
  targeting_json: string
  config_json: string
}

/// A block as the client receives it.
export interface ResolvedHomeBlock {
  id: string
  type: string
  title: string | null
  subtitle: string | null
  source: 'system' | 'editorial'
  card_style: string | null
  config: HomeBlockConfig
  targeting: HomeTargeting
  position: number
  is_system: boolean
}

function parseStoredJson(raw: string | null | undefined): Record<string, unknown> {
  if (typeof raw !== 'string' || !raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {}
  } catch {
    return {}
  }
}

/// Whether a block's schedule window is open at `nowIso`.
export function isScheduleOpen(row: Pick<HomeBlockRow, 'scheduled_at' | 'expires_at'>, nowIso: string): boolean {
  if (row.scheduled_at && row.scheduled_at > nowIso) return false
  if (row.expires_at && row.expires_at <= nowIso) return false
  return true
}

/**
 * The single resolution rule: active, not a draft, in its schedule window, and
 * admitted by its targeting — then ordered.
 *
 * Ordering is `sort_order` then `id`. The tie-break is on `id` rather than
 * `created_at` because the seeded rows contain duplicate `sort_order` values
 * (two seed sets were applied), and without a deterministic tie-break the same
 * request could return a different order on different reads.
 */
export function resolveHomeBlocks(
  rows: HomeBlockRow[], context: HomeContext, nowIso: string,
): ResolvedHomeBlock[] {
  return rows
    .filter((row) => Number(row.is_active) === 1
      && Number(row.is_draft ?? 0) === 0
      && isScheduleOpen(row, nowIso))
    .map((row) => {
      const config = parseStoredJson(row.config_json) as HomeBlockConfig
      const rawTargeting = parseStoredJson(row.targeting_json)
      // Stored targeting is normalized through the same parser as a write, so a
      // legacy row holding `country: "EG"` resolves identically to a new row
      // holding `country: ["EG"]`. A row that fails to parse targets nobody in
      // particular rather than everybody: it resolves to `{}`.
      const parsed = parseTargeting(rawTargeting)
      const targeting = parsed.ok ? parsed.value : {}
      return { row, config, targeting }
    })
    .filter(({ targeting }) => matchesTargeting(targeting, context))
    .map(({ row, config, targeting }) => {
      const system = isSystemBlock(row.block_type, config as Record<string, unknown>)
      return {
        id: row.id,
        type: row.block_type,
        title: row.title_ar,
        subtitle: config.subtitle ?? null,
        source: system ? 'system' as const : 'editorial' as const,
        card_style: config.card_style ?? null,
        config,
        targeting,
        position: Number(row.sort_order) || 0,
        is_system: system,
      }
    })
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))
    .map((block, index) => ({ ...block, position: index }))
}

/// Reads the request context from query parameters.
export function homeContextFromQuery(query: (key: string) => string | undefined): HomeContext {
  return {
    track: (query('track') || 'kids').toLowerCase(),
    language: (query('language') || 'ar').toLowerCase(),
    country: (query('country') || '').toUpperCase(),
    plan: (query('plan') || 'family').toLowerCase(),
    platform: (query('platform') || 'phone').toLowerCase(),
    appVersion: query('app_version') || '0.0.0',
    isNewUser: query('is_new_user') === '1',
  }
}

/* -------------------------------------------------------------- versions */

/**
 * An immutable record of what a block looked like, and who changed it.
 *
 * Stored in `home_experience_versions`, which already exists with
 * `(id, snapshot_json, created_at)` — so real history needs **no migration**,
 * which matters because the migration ledger is unreconciled (`OPS-002`).
 * Everything beyond the snapshot lives inside the JSON envelope.
 *
 * The previous implementation wrote a snapshot of only `{id, block_type,
 * title_ar}` and only on create, so "rollback" restored the creation title and
 * blanked targeting and config. That is worse than no history, because it
 * destroys state while reporting success.
 */
export interface HomeBlockSnapshot {
  block_id: string
  block_type: string
  title_ar: string | null
  sort_order: number
  is_active: number
  is_draft: number
  scheduled_at: string | null
  expires_at: string | null
  targeting: HomeTargeting
  config: HomeBlockConfig
}

export interface HomeVersionEnvelope {
  /// Schema marker, so a future format change can be told apart from the legacy
  /// three-field snapshots already in the table.
  format: 'home_block_v1'
  block_id: string
  /// What produced this version.
  action: 'create' | 'update' | 'reorder' | 'rollback' | 'delete'
  actor_id: string
  /// The block state captured *before* the action, absent on create.
  before: HomeBlockSnapshot | null
  /// The block state after the action, absent on delete.
  after: HomeBlockSnapshot | null
}

export function snapshotFromRow(row: HomeBlockRow): HomeBlockSnapshot {
  const targeting = parseTargeting(parseStoredJson(row.targeting_json))
  const config = parseBlockConfig(parseStoredJson(row.config_json))
  return {
    block_id: row.id,
    block_type: row.block_type,
    title_ar: row.title_ar,
    sort_order: Number(row.sort_order) || 0,
    is_active: Number(row.is_active) === 1 ? 1 : 0,
    is_draft: Number(row.is_draft) === 1 ? 1 : 0,
    scheduled_at: row.scheduled_at,
    expires_at: row.expires_at,
    targeting: targeting.ok ? targeting.value : {},
    config: config.ok ? config.value : {},
  }
}

/// Reads a stored envelope, returning null for anything that is not v1.
export function parseVersionEnvelope(snapshotJson: string): HomeVersionEnvelope | null {
  const parsed = parseStoredJson(snapshotJson)
  if (parsed.format !== 'home_block_v1') return null
  return parsed as unknown as HomeVersionEnvelope
}
