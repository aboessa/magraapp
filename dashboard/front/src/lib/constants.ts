/**
 * Central constants — single source of truth for enums, magic numbers, and limits
 * that were previously hardcoded across 40+ files.
 *
 * Migration plan:
 * - Import from here instead of redeclaring ['free','family',...] inline
 * - For dynamic values (plans catalogue, currencies from pricing API) — this provides
 *   fallbacks; API remains authoritative where available.
 */

// ── Plans ──
export const PLANS = ['free', 'family', 'family_plus'] as const
export type PlanKey = typeof PLANS[number]

// ── Age Tracks ──
export const AGE_TRACKS = ['preschool', 'kids', 'junior'] as const
export const AGE_TRACK_RANGES: Record<string, [number, number]> = {
  preschool: [3, 5],
  kids: [6, 8],
  junior: [9, 12],
}
export const AGE_MIN = 3
export const AGE_MAX = 12

// ── Languages / Locales ──
export const LANGUAGES = ['ar', 'en', 'fr'] as const
export const DASHBOARD_LANGUAGES = ['ar', 'en'] as const
export type Lang = typeof LANGUAGES[number]
export const DEFAULT_LOCALE_MAP = { ar: 'ar-EG', en: 'en-GB', fr: 'fr-FR' } as const

// ── Currencies & Countries (fallback, API pricing matrix is authoritative) ──
export const CURRENCY_CODES = ['SAR', 'AED', 'EGP', 'USD'] as const
export const COUNTRY_CODES = ['EG', 'SA', 'AE', 'US', 'GB', 'FR', 'DE', 'IN'] as const

// ── License Types ──
export const LICENSE_TYPES = ['exclusive', 'non_exclusive', 'owned'] as const
export type LicenseType = typeof LICENSE_TYPES[number]

// ── Ticket System ──
export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const
export const TICKET_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export const TICKET_CATEGORIES = [
  'billing', 'subscription', 'playback', 'downloads', 'account', 'content',
  'technical', 'feature_request', 'abuse', 'other', 'refund'
] as const

// ── Campaigns ──
export const CAMPAIGN_CHANNELS = ['in_app', 'website_banner', 'email'] as const
export const CAMPAIGN_STATUSES = ['draft', 'in_review', 'scheduled', 'sending', 'completed', 'paused', 'cancelled', 'failed'] as const

// ── Content ──
export const CONTENT_STATUSES = [
  'draft', 'writing', 'review_edu', 'review_lang', 'review_sharia',
  'production', 'qa', 'ready', 'scheduled', 'published', 'archived'
] as const
export const CONTENT_TYPES = ['series', 'season', 'episode', 'story', 'book', 'game', 'project', 'planet'] as const
export const PLANET_CONTENT_TYPES = ['series', 'episode', 'story', 'book', 'game'] as const

// ── Billing / Subscriptions ──
export const SUBSCRIPTION_PROVIDERS = ['google_play', 'app_store', 'stripe', 'manual'] as const
export const ENTITLEMENT_STATUSES = ['active', 'grace', 'expired', 'revoked', 'pending'] as const
export const PROVIDER_STATES = ['active', 'expired', 'cancelled', 'revoked', 'pending', 'refunded'] as const

// ── Devices ──
export const DEVICE_PLATFORMS = ['android', 'ios', 'web', 'tv'] as const
export const SUPPORTED_PLATFORMS = ['phone', 'tablet', 'tv', 'web'] as const

// ── Workflows ──
export const WORKFLOW_DECISIONS = ['approved', 'changes_requested', 'rejected', 'skipped'] as const
export const REVIEWER_ROLES = ['edu', 'lang', 'sharia', 'rights', 'qa'] as const

// ── Expiry thresholds (configurable) ──
export const EXPIRY_THRESHOLDS = {
  RIGHTS_SOON_DAYS: 60,
  DASHBOARD_SOON_DAYS: 30,
  GOVERNANCE_STALE_DAYS: 7,
} as const
export const RIGHTS_EXPIRING_SOON_MS = EXPIRY_THRESHOLDS.RIGHTS_SOON_DAYS * 24 * 60 * 60 * 1000
export const DASHBOARD_EXPIRING_SOON_MS = EXPIRY_THRESHOLDS.DASHBOARD_SOON_DAYS * 24 * 60 * 60 * 1000
export const GOVERNANCE_STALE_MS = EXPIRY_THRESHOLDS.GOVERNANCE_STALE_DAYS * 24 * 60 * 60 * 1000

// ── Pagination / Limits ──
export const PAGINATION = {
  DEFAULT_LIMIT: 25,
  LARGE_LIMIT: 50,
  MAX_LIMIT: 100,
} as const

// ── Upload / Platform limits ──
export const UPLOAD_LIMITS = {
  // Cloudflare Worker bundling limit — 95MiB is platform constraint, not business rule
  DIRECT_UPLOAD_BYTES: 95 * 1024 * 1024,
  DIRECT_UPLOAD_MB: 95,
} as const
// Allow env override for future platform changes
export const DIRECT_UPLOAD_LIMIT = Number(import.meta.env.VITE_DIRECT_UPLOAD_LIMIT) || UPLOAD_LIMITS.DIRECT_UPLOAD_BYTES

// ── Financial ──
export const COST_CATEGORIES = [
  'writing', 'illustration', 'voicing', 'animation', 'music', 'sound', 'editing',
  'qa', 'translation', 'marketing', 'platform', 'other'
] as const
export const ALLOCATION_TYPES = ['flat', 'per_episode', 'per_minute'] as const
export const BILLING_PERIODS = ['weekly', 'monthly', 'annual', 'lifetime'] as const

// ── Google Play ──
export const GOOGLE_PLAY_REGIONS_PLACEHOLDER = ['EG', 'SA', 'AE', 'US'] as const

// ── Default filters (used across pages) ──
export const DEFAULT_FILTERS = {
  rights: { license_type: '', expiry: '' },
  quiz: { type: '', status: '', objective_id: '', difficulty: '' },
  campaigns: { channel: '', status: '' },
  translation: { entity_type: '', target_language: '', status: '', stale: '' },
  children: { track: '', status: '' },
  content: { status: '', planet_id: '', q: '' },
} as const

// ── API Paths (central route names, not full client — client stays in api.ts) ──
export const ADMIN_PATHS = {
  plans: '/admin/plans',
  rights: '/admin/rights',
  questions: '/admin/questions',
  translationQueue: '/admin/translation/queue',
  campaigns: '/admin/campaigns',
  billingStats: '/admin/billing/stats',
  googlePlayProducts: '/admin/google-play/products',
} as const
