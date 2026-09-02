export type AgeTrack = 'preschool' | 'kids' | 'junior'
export type ContentStatus =
  | 'draft'
  | 'writing'
  | 'review_edu'
  | 'review_lang'
  | 'review_sharia'
  | 'production'
  | 'qa'
  | 'ready'
  | 'scheduled'
  | 'published'
  | 'archived'

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: string
}

export interface PaginationMeta {
  total: number
  limit: number
  offset: number
}

export interface PaginatedEnvelope<T> extends ApiEnvelope<T[]> {
  meta: PaginationMeta
}

export interface Planet {
  id: string
  name_ar: string
  name_en?: string | null
  description_ar?: string | null
  color_hex: string
  icon_url?: string | null
  /// ÙŠÙØ­Ù„Ù‘ Ù…Ù† asset_links Ù…Ø«Ù„ icon_urlØŒ ÙˆÙ„ÙŠØ³ Ø¹Ù…ÙˆØ¯Ù‹Ø§ ÙÙŠ Ø¬Ø¯ÙˆÙ„ planets Ù†ÙØ³Ù‡
  cover_url?: string | null
  sort_order: number
  is_active?: boolean
  series_count?: number
  assets_count?: number
}

/// ØªÙØµÙŠÙ„ ÙƒÙˆÙƒØ¨ ÙˆØ§Ø­Ø¯ Ù…Ù† GET /admin/planets/:idØŒ Ù…Ø¹ Ø³Ù„Ø§Ø³Ù„Ù‡ ÙˆØªØµÙ†ÙŠÙØ§ØªÙ‡ Ø§Ù„ÙØ¹Ù„ÙŠØ©.
export interface PlanetSeriesSummary {
  id: string
  title_ar: string
  title_en?: string | null
  slug: string
  type: SeriesRecord['type']
  age_min: number
  age_max: number
  status: ContentStatus
  cover_url?: string | null
  sort_order: number
  track_ids: AgeTrack[]
  episodes_count?: number
}

export interface PlanetCategorySummary {
  id: string
  name_ar: string
  name_en?: string | null
  color_hex: string
  series_count: number
}

export interface PlanetDetail extends Planet {
  series: PlanetSeriesSummary[]
  categories: PlanetCategorySummary[]
}

/**
 * Ù…Ø¤Ø´Ù‘Ø±Ø§Øª Ø§Ù„ÙƒÙˆÙƒØ¨ Ù…Ù† `GET /admin/planets`.
 *
 * ÙƒÙ„Ù‡Ø§ Ù…Ø­Ø³ÙˆØ¨Ø© ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… Ù…Ù† Ø¬Ø¯Ø§ÙˆÙ„ Ø­Ù‚ÙŠÙ‚ÙŠØ©ØŒ ÙˆØªØ³ØªØ«Ù†ÙŠ Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø§Ø®ØªØ¨Ø§Ø±
 * (`series.content_class = test_fixture`) Ø¨Ø®Ù„Ø§Ù `series_count` Ùˆ`assets_count`
 * Ø§Ù„Ù…Ø­ÙÙˆØ¸ÙŠÙ† Ø¨Ù…Ø¹Ù†Ø§Ù‡Ù…Ø§ Ø§Ù„Ø£ØµÙ„ÙŠ Ù„Ø£Ù† Ø´Ø§Ø´Ø§Øª Ø£Ø®Ø±Ù‰ ØªÙ‚Ø±Ø£Ù‡Ù…Ø§.
 *
 * `content_updated_at` Ø£Ø­Ø¯Ø« ØªØ¹Ø¯ÙŠÙ„ Ø¹Ù„Ù‰ Ø³Ù„Ø§Ø³Ù„ Ø§Ù„ÙƒÙˆÙƒØ¨ ÙˆØ­Ù„Ù‚Ø§ØªÙ‡ Ù„Ø§ Ø¹Ù„Ù‰ ØµÙÙ‘ Ø§Ù„ÙƒÙˆÙƒØ¨:
 * Ø¬Ø¯ÙˆÙ„ `planets` Ø¨Ù„Ø§ Ø¹Ù…ÙˆØ¯ `updated_at`.
 */
export interface PlanetHealth {
  series_total: number
  series_published: number
  series_pipeline: number
  seasons_total: number
  episodes_total: number
  episodes_published: number
  episodes_ready_unpublished: number
  stories_total: number
  books_total: number
  games_total: number
  projects_total: number
  characters_total: number
  artwork_icon: boolean
  artwork_cover: boolean
  has_description: boolean
  production_blockers: number
  reviews_pending: number
  series_with_english_title: number
  content_updated_at: string | null
}

export interface PlanetListRow extends Planet {
  created_at?: string | null
  health: PlanetHealth
}

/// Ù…Ù„Ø®Ù‘Øµ ÙƒÙ„ Ø§Ù„ÙƒÙˆØ§ÙƒØ¨ (Ù„Ø§ Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø© Ø§Ù„Ù…ÙÙ„ØªØ±Ø©)ØŒ ÙÙ„Ø§ ÙŠØªØºÙŠÙ‘Ø± Ø¹Ù†Ø¯ ØªØ·Ø¨ÙŠÙ‚ ÙÙ„ØªØ±.
export interface PlanetsSummary {
  total: number
  active: number
  inactive: number
  with_published_content: number
  without_published_content: number
  empty: number
  missing_artwork: number
  missing_description: number
  with_production_blockers: number
}

export interface PlanetsListEnvelope extends ApiEnvelope<PlanetListRow[]> {
  meta: { total: number; summary: PlanetsSummary; notes: string[] }
}

/// ÙˆØ­Ø¯Ø© ÙÙŠ Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„: `unavailable` ØºÙŠØ± ÙØ§Ø±Øº ÙŠØ¹Ù†ÙŠ Â«ØªØ¹Ø°Ù‘Ø±Øª Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©Â» Ù„Ø§ Â«ØµÙØ±Â».
export interface WorkspaceModule {
  unavailable: string | null
}

export interface PlanetWorkspaceContent extends WorkspaceModule {
  series_total: number
  series_published: number
  series_pipeline: number
  series_early: number
  series_in_review: number
  series_in_production: number
  series_ready: number
  seasons_total: number
  episodes_total: number
  episodes_published: number
  episodes_ready_unpublished: number
  episodes_without_video: number
  stories_total: number
  stories_published: number
  games_total: number
  games_published: number
  books_total: number
  projects_total: number
  characters_total: number
  fixture_series: number
  unparented_stories: number
  unparented_games: number
  unparented_books: number
  unparented_projects: number
  content_updated_at: string | null
}

export interface PlanetAssetRow {
  link_id: string
  role: string
  language: string
  sort_order: number
  asset_id: string
  title_ar: string
  kind: string
  status: string
  visibility: string
  mime_type?: string | null
  size_bytes?: number | null
  expected_width?: number | null
  expected_height?: number | null
  aspect_ratio?: string | null
  updated_at?: string | null
}

export interface PlanetWorkspaceMedia extends WorkspaceModule {
  assets: PlanetAssetRow[]
  series_total: number
  series_without_poster: number
  episodes_total: number
  episodes_without_thumbnail: number
  expected_roles: { icon: string[]; cover: string[] }
  cdn_configured: boolean
}

/// Ø¥Ø´Ø§Ø±Ø© Ù„ØºØ© ÙˆØ§Ø­Ø¯Ø© Ù…Ø¹ Ù…Ù‚Ø§Ù…Ù‡Ø§. `unavailable` ÙŠØ¹Ù†ÙŠ Â«Ù„Ø§ Ø¹Ù…ÙˆØ¯ Ù„Ù‡Ø°Ø§ Ø§Ù„Ù‚ÙŠØ§Ø³Â».
export interface LocalizationSignal {
  key: string
  label_ar: string
  done: number
  total: number
  unavailable: string | null
  note: string | null
  /// Ù…Ø³Ø§Ø± Ø§Ù„Ø´Ø§Ø´Ø© Ø§Ù„ØªÙŠ ØªÙØºÙ„Ù‚ Ù‡Ø°Ø§ Ø§Ù„Ù†Ù‚ØµØŒ Ø£Ùˆ `null` Ø¥Ø°Ø§ Ù„Ø§ Ø¹Ù…Ù„ ÙŠÙÙØªØ­: Ø¥Ø´Ø§Ø±Ø© Ù…ÙƒØªÙ…Ù„Ø©
  /// Ø£Ùˆ ØºÙŠØ± Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ù‚ÙŠØ§Ø³. Ø§Ù„Ù…Ø³Ø§Ø± Ù†Ø³Ø¨ÙŠ Ù„Ø¬Ø°Ø± Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©.
  drill?: string | null
}

export interface PlanetWorkspaceLocalization extends WorkspaceModule {
  languages: Array<{ language: string; signals: LocalizationSignal[] }>
  configured: string[]
  notes: string[]
}

export interface PlanetProductionItem {
  content_type: 'episode' | 'story'
  content_id: string
  requirement: string
  blocker?: string | null
  due_at?: string | null
  assignee_id?: string | null
  assignee_name?: string | null
  team_id?: string | null
  team_name?: string | null
  note?: string | null
  title?: string | null
  series_id?: string | null
  series_title?: string | null
}

export interface PlanetWorkspaceProduction extends WorkspaceModule {
  blocked: number
  past_due: number
  unowned: number
  tracked_items: number
  items: PlanetProductionItem[]
  notes: string[]
}

export interface PlanetObjectiveRow {
  id: string
  code: string
  title_ar: string
  age_min: number
  age_max: number
  skill_id?: string | null
  skill_name?: string | null
  skill_category?: string | null
  episodes: number
  games: number
}

export interface PlanetWorkspaceLearning extends WorkspaceModule {
  episodes_total: number
  episodes_with_objective: number
  games_total: number
  games_with_objective: number
  distinct_objectives: number
  objectives_catalogue: number
  objectives: PlanetObjectiveRow[]
  notes: string[]
}

export interface PlanetReviewItem {
  id: string
  entity_type: 'series' | 'episode'
  entity_id: string
  reviewer_role: 'edu' | 'lang' | 'sharia' | 'rights' | 'qa'
  reviewer_id?: string | null
  /// Joined from `admin_users.display_name`. Null when the reviewer row was removed,
  /// in which case the screen falls back to the id rather than hiding the review.
  reviewer_name?: string | null
  status: 'pending' | 'needs_changes'
  created_at: string
  comments?: string | null
  title?: string | null
}

export interface PlanetWorkspaceReviews extends WorkspaceModule {
  pending: number
  needs_changes: number
  approved: number
  rejected: number
  runs_running: number
  stages_overdue: number
  religious_pending: number
  religious_scoped: number
  items: PlanetReviewItem[]
  notes: string[]
}

export interface PlanetLicenceRow {
  id: string
  content_id: string
  owner: string
  license_type?: string | null
  countries?: string | null
  languages?: string | null
  expiry_date?: string | null
  title?: string | null
}

export interface PlanetWorkspaceRights extends WorkspaceModule {
  own_policy: Record<string, unknown> | null
  inherits_from: string | null
  global_policy: Record<string, unknown> | null
  chain: string[]
  series_overrides: number
  episode_overrides: number
  withheld: number
  restricted: number
  licences: PlanetLicenceRow[]
  expired_licences: number
  notes: string[]
}

/// ÙƒÙ„ Ø¹Ù†ØµØ± ÙŠØ­Ù…Ù„ Ø¹Ø¯Ø¯Ù‹Ø§ Ø­Ù‚ÙŠÙ‚ÙŠÙ‹Ø§ ÙˆÙˆØ¬Ù‡Ø© Ù…ÙÙ„ØªØ±Ø© ØªØ­Ù„Ù‘Ù‡. Ù„Ø§ Ø¹Ø¯Ù‘Ø§Ø¯ Ø¨Ù„Ø§ ÙˆØ¬Ù‡Ø©.
export interface PlanetAttentionItem {
  key: string
  label_ar: string
  label_en: string
  count: number
  tone: 'warn' | 'danger'
  drill: string
  note: string | null
}

export interface PlanetActivityRow {
  id: string
  actor_id?: string | null
  actor_name?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  created_at: string
  title?: string | null
}

export interface PlanetWorkspace {
  planet: Planet & { artwork_icon: boolean; artwork_cover: boolean; created_at?: string | null }
  content: PlanetWorkspaceContent
  media: PlanetWorkspaceMedia
  localization: PlanetWorkspaceLocalization
  production: PlanetWorkspaceProduction
  learning: PlanetWorkspaceLearning
  reviews: PlanetWorkspaceReviews
  rights: PlanetWorkspaceRights
  /// Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª ØºÙŠØ± Ù…ØªØ§Ø­Ø© Ø¹Ù„Ù‰ Ù…Ø³ØªÙˆÙ‰ Ø§Ù„ÙƒÙˆÙƒØ¨: Ù„Ø§ ÙƒØ§ØªØ¨ Ù„Ø¬Ø¯Ø§ÙˆÙ„ Ø§Ù„Ù†Ø´Ø§Ø· ÙÙŠ D1.
  analytics: { unavailable: string; source: string }
  attention: PlanetAttentionItem[]
  activity: PlanetActivityRow[]
  generated_at: string
}

export interface PlanetTreeEpisode {
  id: string
  series_id: string
  season_id?: string | null
  episode_number?: number | null
  title_ar: string
  status: ContentStatus
  is_published: boolean
  updated_at: string
  duration_seconds?: number | null
  learning_objective_id?: string | null
  dubs?: string | null
  has_video: boolean
  has_captions: boolean
  has_thumbnail: boolean
}

export interface PlanetTreeSeason {
  id: string
  series_id: string
  season_number: number
  title_ar?: string | null
  theme_ar?: string | null
  status?: ContentStatus | null
  release_date?: string | null
  episodes_count: number
  episodes: PlanetTreeEpisode[]
}

export interface PlanetTreeSeries {
  id: string
  title_ar: string
  title_en?: string | null
  slug: string
  status: ContentStatus
  type: SeriesRecord['type']
  age_min: number
  age_max: number
  sort_order: number
  updated_at: string
  content_class: 'production' | 'test_fixture'
  cover_url?: string | null
  seasons_count: number
  episodes_count: number
  episodes_published: number
  track_ids: AgeTrack[]
  seasons: PlanetTreeSeason[]
  unassigned_episodes: PlanetTreeEpisode[]
  loaded_episodes: number
}

export interface PlanetTreeEnvelope extends ApiEnvelope<PlanetTreeSeries[]> {
  meta: {
    series_limit: number
    episode_limit: number
    series_returned: number
    fixture_series: number
    episodes_returned: number
    episodes_total: number
    truncated: boolean
    notes: string[]
  }
}

/// Ø­ÙÙ…Ù„ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ÙƒÙˆÙƒØ¨. Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„ØªÙŠ ÙŠÙ‚Ø¨Ù„Ù‡Ø§ Ø§Ù„Ø®Ø§Ø¯Ù… ÙØ¹Ù„Ù‹Ø§ Ù„Ø§ Ø£ÙƒØ«Ø±.
export interface PlanetPayload {
  name_ar: string
  name_en?: string | null
  description_ar?: string | null
  color_hex: string
  sort_order?: number
  is_active?: boolean
  /// Ø¹Ù†Ø¯ Ø§Ù„Ø¥Ù†Ø´Ø§Ø¡ ÙÙ‚Ø·: Ø§Ù„Ù…Ø¹Ø±Ù‘Ù/Ø§Ù„Ù€slug
  id?: string
}

export interface SeriesRecord {
  id: string
  title_ar: string
  title_en?: string | null
  slug: string
  planet_id: string
  planet_name?: string | null
  planet_color?: string | null
  type: 'continuous' | 'anthology' | 'knowledge' | 'presenter' | 'standalone'
  age_min: number
  age_max: number
  track_ids: AgeTrack[]
  reading_level: 'pre_reader' | 'emerging' | 'independent'
  interaction_mode: 'tap' | 'guided' | 'mixed' | 'independent'
  supervision_level: 'none' | 'recommended' | 'required'
  cover_url?: string | null
  banner_url?: string | null
  logo_url?: string | null
  trailer_url?: string | null
  description_ar?: string | null
  visual_style?: string | null
  visual_style_id?: string | null
  difficulty: 'easy' | 'medium' | 'hard'
  production_level: 'motion_story' | 'limited_2d' | 'full_2d' | 'live' | 'stylized_3d'
  status: ContentStatus
  is_free: boolean
  price_tier: 'free' | 'family' | 'family_plus'
  sort_order: number
  seasons_count?: number
  episodes_count?: number
  created_at: string
  updated_at: string
  // Islamic governance (migration 0011) â€” null for non-islamic series
  source_type?: 'quran' | 'hadith' | 'sira' | 'adab' | 'general' | null
  source_reference?: string | null
  verse_surah?: number | null
  verse_ayah?: number | null
  hadith_collection?: string | null
  hadith_number?: string | null
  hadith_grade?: string | null
  religious_reviewer_id?: string | null
  religious_reviewer_version?: number | null
  religious_approved_at?: string | null
  visual_restrictions?: string | null
}

export interface EpisodeRecord {
  id: string
  series_id: string
  series_title: string
  season_id?: string | null
  episode_number?: number | null
  title_ar: string
  description_ar?: string | null
  thumbnail_url?: string | null
  video_master_url?: string | null
  captions_ar_url?: string | null
  dubs?: string[]
  duration_seconds?: number | null
  age_min: number
  age_max: number
  track_ids: AgeTrack[]
  objective_title?: string | null
  parent_guide_ar?: string | null
  family_activity_ar?: string | null
  linked_game_id?: string | null
  linked_book_id?: string | null
  status: ContentStatus
  is_free: boolean
  is_published: boolean
  created_at: string
  updated_at: string
}

/// ØªÙØµÙŠÙ„ Ø³Ù„Ø³Ù„Ø© ÙˆØ§Ø­Ø¯Ø© Ù…Ù† GET /admin/series/:id: Ø§Ù„ØµÙ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ Ù…Ø¹ Ù…ÙˆØ§Ø³Ù…Ù‡Ø§ØŒ
/// Ø´Ø®ØµÙŠØ§ØªÙ‡Ø§ØŒ ÙˆØ­Ù„Ù‚Ø§ØªÙ‡Ø§ Ø§Ù„ÙØ¹Ù„ÙŠØ© (Ø¨ØµÙˆØ± Ù…ØµØºÙ‘Ø±Ø© Ù…Ø­Ù„ÙˆÙ„Ø©). Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª ØªÙ‚Ø¯Ù‘Ù…
/// Ø¥Ù†ØªØ§Ø¬ Ù…Ù†ÙØµÙ„Ø© (Ø³ÙƒØ±Ø¨Øª/ØµÙˆØª/ÙÙŠØ¯ÙŠÙˆ/QA) ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… Ø¨Ø¹Ø¯ â€” Ø±Ø§Ø¬Ø¹ status ÙˆØ­Ø¯Ù‡.
export interface SeriesDetail extends SeriesRecord {
  seasons: SeasonRecord[]
  characters: CharacterRecord[]
  episodes: EpisodeRecord[]
}

export interface ParentRecord {
  id: string
  email?: string | null
  display_name?: string | null
  plan: 'free' | 'family' | 'family_plus'
  locale: string
  timezone: string
  status: 'active' | 'suspended' | 'archived'
  children_count: number
  created_at: string
}

export interface ChildRecord {
  id: string
  parent_id: string
  parent_name?: string | null
  parent_email?: string | null
  parent_plan?: ParentRecord['plan']
  nickname: string
  birth_month: number
  birth_year: number
  age_track: AgeTrack
  avatar_id: string
  interests: string
  language: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
}

export interface DashboardTotals {
  total_series: number
  published_series: number
  total_episodes: number
  published_episodes: number
  active_parents: number
  active_children: number
}

export interface CountRow {
  status?: ContentStatus
  plan?: ParentRecord['plan']
  count: number
}

export interface AuditRecord {
  id: string
  actor_id?: string | null
  action: string
  entity_type: string
  entity_id?: string | null
  details: string
  created_at: string
}

export interface DashboardStats {
  totals: DashboardTotals
  series_by_track: Record<AgeTrack, number>
  series_by_status: CountRow[]
  parents_by_plan: CountRow[]
  recent_series: SeriesRecord[]
  recent_activity: AuditRecord[]
  generated_at: string
}

export interface SeriesPayload {
  title_ar: string
  planet_id: string
  type: SeriesRecord['type']
  age_min: number
  age_max: number
  track_ids: AgeTrack[]
  production_level: SeriesRecord['production_level']
  description_ar?: string
  visual_style?: string
  visual_style_id?: string | null
  status?: ContentStatus
  // Islamic conditional fields (migration 0011)
  source_type?: 'quran' | 'hadith' | 'sira' | 'adab' | 'general' | null
  source_reference?: string | null
  verse_surah?: number | null
  verse_ayah?: number | null
  hadith_collection?: string | null
  hadith_number?: string | null
  hadith_grade?: string | null
  religious_reviewer_id?: string | null
  religious_reviewer_version?: number | null
  religious_approved_at?: string | null
  visual_restrictions?: string | string[] | null
}

export interface EpisodePayload {
  title_ar: string
  series_id: string
  episode_number?: number | null
  duration_seconds?: number | null
  description_ar?: string
  parent_guide_ar?: string
  family_activity_ar?: string
  status?: ContentStatus
}

export interface ChildPayload {
  parent_id: string
  nickname: string
  birth_month: number
  birth_year: number
  avatar_id: string
  interests: string[]
  language: string
  status?: ChildRecord['status']
}


export interface CategoryRecord {
  id: string
  slug: string
  name_ar: string
  name_en?: string | null
  description_ar?: string | null
  color_hex: string
  icon?: string | null
  sort_order: number
  is_active: boolean
  series_count?: number
}

export interface VisualStyleRecord {
  id: string
  slug: string
  name_ar: string
  name_en: string
  medium: '2d' | '3d' | 'mixed' | 'stop_motion' | 'live' | 'graphic'
  description_ar?: string | null
  prompt_fragment: string
  negative_prompt?: string | null
  production_level: SeriesRecord['production_level']
  age_tracks: AgeTrack[]
  source_reference?: string | null
  is_active: boolean
  series_count?: number
  stories_count?: number
}

export interface SeasonRecord {
  id: string
  series_id: string
  series_title: string
  season_number: number
  title_ar?: string | null
  theme_ar?: string | null
  description_ar?: string | null
  /**
   * The editorial planning figure, from `seasons.episode_count`.
   *
   * It is **not** a number of episodes. It was the source of the 17 seasons that
   * advertised 91 episodes they did not contain, so it is named for what it is
   * and the real counts below are what a screen should render. See
   * `api/src/lib/episodeCounts.ts`.
   */
  planned_episode_count: number
  /// Canonical, non-archived episode rows in the season.
  total_episodes: number
  /// Of those, the ones the catalogue serves.
  published_episodes: number
  /// Of those, the ones with a video source that can actually be played.
  available_episodes: number
  watch_order: 'sequential' | 'any'
  learning_goals: string[]
  release_date?: string | null
  status: ContentStatus
}

/// Ù…Ù„Ø®Øµ Ø§Ù„Ø­Ù„Ù‚Ø© Ø§Ù„Ø°ÙŠ ÙŠØ¹ÙŠØ¯Ù‡ GET /admin/seasons/:id. Ù„Ø§ ÙŠØ­Ù…Ù„ ØµÙˆØ±Ø© Ø£Ùˆ ÙˆØµÙÙ‹Ø§ Ø£Ùˆ
/// ØªÙØ§ØµÙŠÙ„ ÙˆØ³Ø§Ø¦Ø·Ø› Ø¹Ù„Ù‰ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø£Ù„Ø§ ØªØªØ¹Ø§Ù…Ù„ Ù…Ø¹Ù‡ ÙƒÙ€ EpisodeRecord ÙƒØ§Ù…Ù„.
export interface SeasonEpisodeSummary {
  id: string
  episode_number?: number | null
  title_ar: string
  status: ContentStatus
  is_published: boolean
}

export interface SeasonDetail extends SeasonRecord {
  episodes: SeasonEpisodeSummary[]
}

export interface CharacterRecord {
  id: string
  series_id: string
  series_title: string
  name_ar: string
  role?: 'hero' | 'side' | 'villain' | 'narrator' | 'presenter' | null
  age?: number | null
  description_ar?: string | null
  traits: string[]
  speech_style?: string | null
  reference_images: string[]
  expressions: Record<string, string>
  outfits: string[]
  voice_actor?: string | null
  languages: string[]
  rights_owner?: string | null
  status: 'active' | 'archived'
}

/// ØªÙØµÙŠÙ„ Ø´Ø®ØµÙŠØ© ÙˆØ§Ø­Ø¯Ø© Ù…Ù† GET /admin/characters/:id. Ø¹Ø¯Ø¯ Ø§Ù„ÙÙ‚Ø§Ø¹Ø§Øª Ø§Ø³ØªØ®Ø¯Ø§Ù…ÙŒ
/// ÙØ¹Ù„ÙŠ ÙÙŠ Ø§Ù„Ù‚ØµØµØŒ Ù„Ø§ Ù…Ù‚ÙŠØ§Ø³ ØªØ­Ù„ÙŠÙ„ÙŠ Ù…ÙÙ†Ø´Ø£ ÙÙŠ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø©.
export interface CharacterDetail extends CharacterRecord {
  bubbles_count: number
  allowed_roles: NonNullable<CharacterRecord['role']>[]
}

export type StoryType = 'picture_book' | 'audio_story' | 'interactive' | 'comic'

export interface StoryRecord {
  id: string
  series_id?: string | null
  series_title?: string | null
  season_id?: string | null
  slug: string
  title_ar: string
  title_en?: string | null
  description_ar?: string | null
  description_en?: string | null
  type: StoryType
  age_min: number
  age_max: number
  reading_level: 'pre_reader' | 'emerging' | 'independent'
  interaction_mode: 'tap' | 'guided' | 'mixed' | 'independent'
  supervision_level: 'none' | 'recommended' | 'required'
  visual_style_id?: string | null
  visual_style_name?: string | null
  default_language: string
  languages: string[]
  status: ContentStatus
  is_free: boolean
  price_tier: 'free' | 'family' | 'family_plus'
  safety_notes?: string | null
  sort_order: number
  pages_count?: number
  cover_asset_id?: string | null
}

export interface StoryPageLocalization {
  page_id: string
  language: string
  body_text?: string | null
  alt_text?: string | null
  narration_asset_id?: string | null
  timing_cues: Array<Record<string, unknown>>
}

export interface StoryBubbleRecord {
  id: string
  page_id: string
  character_id?: string | null
  kind: 'dialogue' | 'thought' | 'caption' | 'sound'
  position_x: number
  position_y: number
  width: number
  height: number
  localized_text: Record<string, string>
  audio_tracks: Record<string, string>
  sort_order: number
}

export interface StoryPageRecord {
  id: string
  story_id: string
  page_number: number
  layout: 'full_bleed' | 'split' | 'panels' | 'text_focus'
  image_asset_id?: string | null
  background_asset_id?: string | null
  duration_ms?: number | null
  dwell_ms?: number | null
  transition: string
  sort_order: number
  localizations: StoryPageLocalization[]
  bubbles: StoryBubbleRecord[]
}

export interface StoryDetail extends StoryRecord {
  pages: StoryPageRecord[]
  assets: AssetRecord[]
}

/// ØªØºØ·ÙŠØ© Ù„ØºØ© ÙˆØ§Ø­Ø¯Ø© Ø¹Ù„Ù‰ ØµÙØ­Ø§Øª Ø§Ù„Ù‚ØµØ©ØŒ ÙˆÙ…Ø¹Ù‡Ø§ Ù…Ù‚Ø§Ù…Ù‡Ø§ Ø¯Ø§Ø¦Ù…Ù‹Ø§.
///
/// Ù†Ø³Ø¨Ø© Ø¨Ù„Ø§ Ù…Ù‚Ø§Ù… ØºÙŠØ± Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…: Â«Ù¦Â» Ù‚Ø¯ ØªÙƒÙˆÙ† Ø³ØªÙ‹Ù‘Ø§ Ù…Ù† Ø³Øª Ø£Ùˆ Ø³ØªÙ‹Ù‘Ø§ Ù…Ù† Ø£Ø±Ø¨Ø¹ÙŠÙ†.
/// ÙˆØ§Ù„Ù†ØµÙ‘ ÙˆØ§Ù„Ø³Ø±Ø¯ Ø³Ø¤Ø§Ù„Ø§Ù† Ù…Ø®ØªÙ„ÙØ§Ù†: ØµÙØ­Ø© Ù‚Ø¯ ØªØ­Ù…Ù„ Ù†ØµÙ‹Ù‘Ø§ Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠÙ‹Ù‘Ø§ Ø¨Ù„Ø§ ØµÙˆØª Ø¥Ù†Ø¬Ù„ÙŠØ²ÙŠØŒ
/// ÙØ¯Ù…Ø¬Ù‡Ù…Ø§ ÙÙŠ Ø±Ù‚Ù… ÙˆØ§Ø­Ø¯ ÙŠÙØ®ÙÙŠ Ø£ÙŠÙ‘Ù‡Ù…Ø§ Ù†Ø§Ù‚Øµ.
export interface StoryLanguageCoverage {
  language: string
  /// Ù…Ø¹Ù„ÙŽÙ†Ø© ÙÙŠ `stories.languages`. Ø§Ù„Ø¥Ø¹Ù„Ø§Ù† Ù†ÙŠÙ‘Ø© Ù„Ø§ Ø¥Ù†Ø¬Ø§Ø²ØŒ ÙÙ‡Ùˆ Ù…Ù†ÙØµÙ„ Ø¹Ù† Ø§Ù„Ø¹Ø¯Ù‘.
  declared: boolean
  text_done: number
  narration_done: number
  /// Ù…Ø¤Ø´Ù‘Ø±Ø§Øª Ø§Ù„ØªÙˆÙ‚ÙŠØª. Ù„Ø§ Ø´ÙŠØ¡ ÙÙŠ Ø§Ù„Ù…Ù†ØµÙ‘Ø© ÙŠÙƒØªØ¨Ù‡Ø§ØŒ ÙÙ‡ÙŠ ØµÙØ± ÙÙŠ ÙƒÙ„ Ù…ÙƒØ§Ù† â€” ÙˆØ§Ù„ØµØ¯Ù‚ ÙÙŠ
  /// Ø¥Ø¸Ù‡Ø§Ø±Ù‡Ø§ ØµÙØ±Ù‹Ø§ Ù…Ø¹Ù„ÙŽÙ‘Ù„Ù‹Ø§ Ø£ÙØ¶Ù„ Ù…Ù† Ø­Ø°ÙÙ‡Ø§.
  timing_done: number
  total: number
}

export type StoryReadinessState = 'ready' | 'partial' | 'empty'

/// ØµÙÙŒÙ‘ ÙÙŠ Ù…ÙƒØªØ¨Ø© Ø§Ù„Ù‚ØµØµ: Ø§Ù„ØºÙ„Ø§Ù Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ ÙˆØ§Ù„ØªØºØ·ÙŠØ© Ø§Ù„Ù…Ø¹Ø¯ÙˆØ¯Ø© Ù„Ø§ Ø§Ù„ØªØ³Ù…ÙŠØ©.
export interface StoryLibraryRow {
  id: string
  slug: string
  title_ar: string
  title_en?: string | null
  description_ar?: string | null
  type: StoryType
  status: ContentStatus
  age_min: number
  age_max: number
  reading_level: string
  default_language: string
  languages: string[]
  is_free: boolean
  sort_order: number
  updated_at?: string | null
  published_at?: string | null
  series_id?: string | null
  series_title?: string | null
  planet_id?: string | null
  planet_name?: string | null
  planet_color?: string | null
  /// ØºÙ„Ø§Ù Ø­Ù‚ÙŠÙ‚ÙŠ Ù…Ù† `asset_links` Ø¨Ø¯ÙˆØ± cover/posterØŒ Ø£Ùˆ `null` ÙØªØ¸Ù‡Ø± Ø­Ø§Ù„Ø© ØµØ±ÙŠØ­Ø©.
  cover_url?: string | null
  pages_total: number
  pages_with_image: number
  coverage: StoryLanguageCoverage[]
  readiness: StoryReadinessState
}

export interface StoryLibrarySummary {
  total: number
  ready: number
  partial: number
  empty: number
  published: number
  in_review: number
  missing_pages: number
  missing_artwork: number
  missing_cover: number
}

/// Ù„ØºØ© ÙˆØ§Ø­Ø¯Ø© Ø¹Ù„Ù‰ ØµÙØ­Ø© ÙˆØ§Ø­Ø¯Ø©.
export interface StoryWorkspaceLocalization {
  language: string
  has_text: boolean
  has_alt: boolean
  body_text?: string | null
  alt_text?: string | null
  narration_asset_id?: string | null
  narration_status?: string | null
  /// `generated` ØªØ¹Ù†ÙŠ ØªØµÙŠÙŠØ±Ù‹Ø§ Ø¢Ù„ÙŠÙ‹Ù‘Ø§ Ù„Ø§ ØªØ³Ø¬ÙŠÙ„Ù‹Ø§ Ù…ÙØ¹ØªÙ…Ø¯Ù‹Ø§. Ø§Ù„ÙØ±Ù‚ Ù…Ù‡Ù…: Ù…Ø³Ø§ÙˆØ§ØªÙ‡Ù…Ø§
  /// ØªØ³Ù…Ø­ Ø¨Ù†Ø´Ø± ØµÙˆØª Ù„Ù… ÙŠØ±Ø§Ø¬Ø¹Ù‡ Ø£Ø­Ø¯.
  narration_source?: string | null
  narration_size?: number | null
  /// Ø¬Ø§Ù‡Ø² ÙØ¹Ù„Ù‹Ø§: Ø¨ÙˆÙ‘Ø§Ø¨Ø© Ø§Ù„Ù†Ø´Ø± Ù„Ø§ ØªÙ‚Ø¨Ù„ Ø¥Ù„Ø§ `status = 'ready'`.
  narration_ready: boolean
  has_timing: boolean
  timing_count: number
  /// Preserved verbatim when text, alt text, or narration is edited in the builder.
  timing_cues?: Array<Record<string, unknown>>
  updated_at?: string | null
}

export interface StoryWorkspacePage {
  id: string
  page_number: number
  layout: 'full_bleed' | 'split' | 'panels' | 'text_focus'
  transition: string
  duration_ms?: number | null
  dwell_ms?: number | null
  image_asset_id?: string | null
  image_status?: string | null
  /// Ø±Ø§Ø¨Ø· Ø¹Ø§Ù… Ù…Ø¨Ù†ÙŠÙ‘ Ø¹Ø¨Ø± Ø­ÙŽØ±Ø³ Ø§Ù„Ø¨Ø§Ø¯Ø¦Ø© Ù†ÙØ³Ù‡ Ø§Ù„Ø°ÙŠ ÙŠØ³ØªØ®Ø¯Ù…Ù‡ Ø¨Ù‚ÙŠÙ‘Ø© Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ØŒ ÙÙ…ÙØªØ§Ø­
  /// Ù…Ø®Ø§Ù„Ù Ù„Ø¹Ù…ÙˆØ¯ Ø§Ù„Ø¸Ù‡ÙˆØ± ÙŠÙÙ†ØªØ¬ `null` Ù„Ø§ ØµÙˆØ±Ø© Ù…ÙƒØ³ÙˆØ±Ø©.
  image_url?: string | null
  image_width?: number | null
  image_height?: number | null
  image_aspect?: string | null
  image_mime?: string | null
  image_size?: number | null
  background_asset_id?: string | null
  bubbles_count: number
  updated_at?: string | null
  localizations: StoryWorkspaceLocalization[]
}

/// Ø¹Ø§Ø¦Ù‚ ÙˆØ§Ø­Ø¯ØŒ Ù…ÙØ³Ù…Ù‹Ù‘Ù‰ Ø¨Ù…ÙˆØ¶Ø¹Ù‡.
///
/// Â«Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ù†Ø´Ø±Â» Ø¨Ù„Ø§ Ù…ÙˆØ¶Ø¹ ØªØ¬Ø¹Ù„ Ø§Ù„Ù…Ø­Ø±ÙÙ‘Ø± ÙŠÙØªØ­ ÙƒÙ„ ØµÙØ­Ø© Ø¨Ø§Ù„ØªÙ†Ø§ÙˆØ¨. Ù„Ø°Ù„Ùƒ ÙƒÙ„ Ø¹Ø§Ø¦Ù‚
/// ÙŠØ­Ù…Ù„ Ø±Ù‚Ù… Ø§Ù„ØµÙØ­Ø© ÙˆØªØ¨ÙˆÙŠØ¨ Ø§Ù„Ù…ÙØªÙÙ‘Ø´ Ø§Ù„Ø°ÙŠ ÙŠÙØºÙ„Ù‚Ù‡.
export interface StoryBlocker {
  key: string
  severity: 'blocker' | 'warning'
  label_ar: string
  label_en: string
  page_number: number | null
  inspector: 'content' | 'image' | 'audio' | 'timing' | 'layout' | null
  language: string | null
}

export interface StoryWorkspaceReadiness {
  pages_total: number
  pages_with_image: number
  pages_ready: number
  /// Ø­ÙÙƒÙ…Ø§Ù† Ù…Ù†ÙØµÙ„Ø§Ù† Ø¨Ù‚ØµØ¯: Ø³Ø±Ø¯ Ø¨Ù„Ø§ Ù…Ø¤Ø´Ù‘Ø±Ø§Øª ØªÙˆÙ‚ÙŠØª Ù‡Ùˆ Â«Ø§Ù‚Ø±Ø£ Ù„ÙŠÂ» Ù…ÙƒØªÙ…Ù„ ÙˆÂ«Ù‚Ø±Ø§Ø¡Ø©
  /// Ù…ØªØ²Ø§Ù…Ù†Ø©Â» ÙØ§Ø±ØºØ©ØŒ ÙØ±Ù‚Ù… ÙˆØ§Ø­Ø¯ Ù„Ø§ ÙŠØµÙ„Ø­ Ù„Ù„Ø§Ø«Ù†ÙŠÙ†.
  read_to_me_ready: boolean
  read_along_ready: boolean
  publishable: boolean
}

/// Ù…Ø§ Ù„Ø§ ÙŠØ¯Ø¹Ù…Ù‡ Ø§Ù„Ù…Ø®Ø·ÙŽÙ‘Ø·ØŒ Ù…ÙØ¹Ù„ÙŽÙ†Ù‹Ø§ Ù„Ø§ Ù…ÙÙƒØªØ´ÙŽÙÙ‹Ø§ Ù…Ù† Ø±ÙØ¶ 409.
export interface StoryCapabilities {
  reviews_supported: boolean
  reviews_reason: string
  rights_supported: boolean
  rights_reason: string
  timing_supported: boolean
  timing_reason: string
  panels_supported: boolean
  panels_reason: string
  bubbles_supported: boolean
}

export interface StoryWorkspaceActivity {
  id: string
  actor_id?: string | null
  actor_name?: string | null
  action: string
  entity_type: string
  entity_id: string
  created_at: string
}

export interface StoryWorkspace {
  story: StoryRecord & {
    planet_id?: string | null
    planet_name?: string | null
    planet_color?: string | null
    series_status?: string | null
    content_class?: string | null
    cover_url?: string | null
    updated_at?: string | null
    published_at?: string | null
  }
  pages: StoryWorkspacePage[]
  coverage: StoryLanguageCoverage[]
  blockers: StoryBlocker[]
  readiness: StoryWorkspaceReadiness
  capabilities: StoryCapabilities
  activity: StoryWorkspaceActivity[]
  generated_at: string
}

export type AssetKind = 'image' | 'audio' | 'video' | 'subtitle' | 'document' | 'manifest' | 'archive'
export type AssetStatus = 'planned' | 'uploading' | 'processing' | 'ready' | 'failed' | 'archived'

export interface AssetRecord {
  id: string
  title_ar: string
  kind: AssetKind
  source: 'catalog' | 'upload' | 'generated' | 'import'
  status: AssetStatus
  original_filename?: string | null
  expected_path?: string | null
  r2_key?: string | null
  bucket?: 'media' | 'thumbs' | null
  mime_type?: string | null
  size_bytes?: number | null
  checksum_sha256?: string | null
  etag?: string | null
  visibility: 'public' | 'private'
  language?: string | null
  quality?: string | null
  version: number
  expected_width?: number | null
  expected_height?: number | null
  aspect_ratio?: string | null
  prompt?: string | null
  visual_style_id?: string | null
  visual_style_name?: string | null
  metadata: {
    actual_dimensions?: { width: number; height: number }
    dimension_match?: boolean
    [key: string]: unknown
  }
  links_count?: number
  content_url?: string | null
  created_at: string
  updated_at: string
}

export interface AssetStats {
  by_status: Array<{ status: AssetStatus; count: number }>
  by_kind: Array<{ kind: AssetKind; count: number }>
  storage: { ready_count: number; total_bytes: number }
}

export interface AssetLinkRecord {
  id: string
  asset_id: string
  entity_type: AssetLinkPayload['entity_type']
  entity_id: string
  role: string
  language?: string | null
  sort_order: number
}

/// ØªÙØµÙŠÙ„ Ø£ØµÙ„ Ù…Ù† GET /admin/assets/:idØŒ ÙˆÙŠØ´Ù…Ù„ Ø§Ù„Ø§Ø±ØªØ¨Ø§Ø·Ø§Øª Ø§Ù„ÙØ¹Ù„ÙŠØ© Ø§Ù„ØªÙŠ ØªÙ…Ù†Ø¹
/// ØªØ®Ù…ÙŠÙ† Ù…ÙƒØ§Ù† Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…Ù„Ù Ù…Ù† Ø§Ø³Ù…Ù‡ ÙÙ‚Ø·.
export interface AssetDetail extends AssetRecord {
  links: AssetLinkRecord[]
}

export interface AssetLinkPayload {
  entity_type: 'landing' | 'planet' | 'category' | 'series' | 'season' | 'episode' | 'character' | 'story' | 'story_page' | 'game' | 'book' | 'project'
  entity_id: string
  role: string
  language?: string
  sort_order?: number
}

export type ReadingLevel = 'pre_reader' | 'emerging' | 'independent'
export type InteractionMode = 'tap' | 'guided' | 'mixed' | 'independent'
export type SupervisionLevel = 'none' | 'recommended' | 'required'
export type GameDifficulty = 'easy' | 'medium' | 'hard'
export type LibraryContentKind = 'books' | 'games' | 'projects'

interface LibraryContentRecord {
  id: string
  title_ar: string
  age_min: number
  age_max: number
  status: ContentStatus
  is_free: boolean
  cover_asset_id?: string | null
  created_at: string
  updated_at: string
}

export interface BookRecord extends LibraryContentRecord {
  series_id?: string | null
  series_title?: string | null
  type: StoryType
  pages: unknown[]
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  safety_notes?: string | null
}

export interface BookDetail extends BookRecord {
  assets: AssetRecord[]
}

export interface BookPayload {
  title_ar: string
  series_id: string | null
  type: StoryType
  pages: unknown[]
  age_min: number
  age_max: number
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  safety_notes: string | null
  is_free: boolean
  status: ContentStatus
}

export interface GameEngineRecord {
  id: string
  name_ar: string
  description?: string | null
  mechanics: Record<string, unknown>
  games_count?: number
  created_at: string
}

export interface GameRecord extends LibraryContentRecord {
  engine_id: string
  engine_name?: string | null
  series_id?: string | null
  series_title?: string | null
  episode_id?: string | null
  episode_title?: string | null
  learning_objective_id?: string | null
  learning_objective_title?: string | null
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  safety_notes?: string | null
  difficulty: GameDifficulty
  content_pack: Record<string, unknown>
  instructions_ar?: string | null
  max_attempts?: number | null
  help_system: Record<string, unknown>
}

export interface GameDetail extends GameRecord {
  assets: AssetRecord[]
}

export interface GamePayload {
  title_ar: string
  engine_id: string
  series_id: string | null
  episode_id: string | null
  age_min: number
  age_max: number
  reading_level: ReadingLevel
  interaction_mode: InteractionMode
  supervision_level: SupervisionLevel
  difficulty: GameDifficulty
  content_pack: Record<string, unknown>
  instructions_ar: string | null
  max_attempts: number | null
  help_system: Record<string, unknown>
  is_free: boolean
  status: ContentStatus
}

export interface ProjectRecord extends LibraryContentRecord {
  description_ar?: string | null
  supervision_level: SupervisionLevel
  safety_notes?: string | null
  materials: string[]
  steps: string[]
  learning_objective_ids: string[]
  cover_url?: string | null
}

export interface ProjectDetail extends ProjectRecord {
  assets: AssetRecord[]
}

export interface ProjectPayload {
  title_ar: string
  description_ar: string | null
  age_min: number
  age_max: number
  supervision_level: SupervisionLevel
  safety_notes: string | null
  materials: string[]
  steps: string[]
  learning_objective_ids: string[]
  cover_url: string | null
  is_free: boolean
  status: ContentStatus
}

/* --------------------------------------------------------- Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø´Ø±Ø§ÙƒØ© */

export type PartnershipKind = 'school' | 'nursery' | 'publisher' | 'producer' | 'creator' | 'other'
export type PartnershipStatus = 'new' | 'in_review' | 'contacted' | 'accepted' | 'declined' | 'spam'
export type PartnershipLocale = 'ar' | 'en' | 'fr'
export type PartnershipEmailStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface PartnershipRequest {
  id: string
  kind: PartnershipKind
  name: string
  organization: string
  email: string
  phone: string | null
  country: string | null
  message: string
  locale: PartnershipLocale
  status: PartnershipStatus
  admin_note: string | null
  email_status: PartnershipEmailStatus
  email_error: string | null
  source_ip: string | null
  user_agent: string | null
  created_at: string
  updated_at: string
}

export interface PartnershipListMeta {
  total: number
  page: number
  limit: number
  pages: number
  counts: Partial<Record<PartnershipStatus, number>>
}

export interface PartnershipListEnvelope extends ApiEnvelope<PartnershipRequest[]> {
  meta: PartnershipListMeta
}

export interface PartnershipSettings {
  partnership_inbox_email: string
  partnership_from_email: string
  partnership_cc_emails: string
}

export interface PartnershipSettingsEnvelope {
  settings: PartnershipSettings
  /** Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯ Ø§Ù„Ø°ÙŠ Ø³ÙŠÙØ³ØªØ®Ø¯Ù… ÙØ¹Ù„Ù‹Ø§ØŒ Ø£Ùˆ none Ø¥Ù† Ù„Ù… ÙŠÙØ¶Ø¨Ø· Ø£ÙŠ Ù…Ù†Ù‡Ù…Ø§ */
  emailProvider: 'resend' | 'cloudflare' | 'none'
  defaultFrom: string | null
  inboxConfigured: boolean
}

/* -------------------------------------------------------- ÙˆØ¶Ø¹ Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø¹Ø§Ù… */

export type SiteMode = 'live' | 'construction' | 'maintenance'

export interface SiteModeSettings {
  site_mode: SiteMode
  /** Ù…ÙˆØ¹Ø¯ Ø§Ù„Ø¥Ø·Ù„Ø§Ù‚ Ø¨ØµÙŠØºØ© ISOØŒ Ø£Ùˆ Ù†Øµ ÙØ§Ø±Øº Ø¥Ù† Ù„Ù… ÙŠÙØ¹Ù„Ù† */
  site_launch_at: string
  site_status_message: string
  /** Ø¯Ù‚Ø§Ø¦Ù‚ØŒ Ø£Ùˆ Ù†Øµ ÙØ§Ø±Øº Ø¥Ù† ÙƒØ§Ù†Øª Ø§Ù„Ù…Ø¯Ø© ØºÙŠØ± Ù…Ø­Ø¯Ù‘Ø¯Ø© */
  maintenance_eta_minutes: string
}

/** Ù…Ø§ ÙŠØ±Ø§Ù‡ Ø§Ù„Ø²Ø§Ø¦Ø± ÙØ¹Ù„Ù‹Ø§ØŒ ÙŠÙØ­Ø³Ø¨ ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… Ù…Ù† Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª */
export interface SiteModePreview {
  mode: SiteMode
  launchAt: string | null
  message: string | null
  retryAfterSeconds: number | null
}

export interface SiteModeEnvelope {
  settings: SiteModeSettings
  /** Ø§Ù„Ø£ÙˆØ¶Ø§Ø¹ Ø§Ù„Ù…ØªØ§Ø­Ø© Ù…Ù† Ø§Ù„Ø®Ø§Ø¯Ù…ØŒ ÙÙ„Ø§ ØªÙ†Ø­Ø±Ù Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø¹Ù†Ù‡ */
  modes: SiteMode[]
  preview: SiteModePreview
}

/* ------------------------------------------- Ù…Ø³ØªØ®Ø¯Ù…Ùˆ Ø§Ù„Ù„ÙˆØ­Ø© ÙˆØ§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª */

/** Ù…ÙˆØ¸Ù ÙÙŠ ÙØ±ÙŠÙ‚ Ø§Ù„Ø¹Ù…Ù„. Ù…Ø´ØªÙ‚ Ù…Ù† admin_users + admin_credentials */
export interface AdminUserRecord {
  id: string
  email: string
  display_name: string
  is_active: boolean
  is_external: boolean
  created_at: string
  /** Ù‡Ù„ Ø¶ÙØ¨Ø·Øª Ù„Ù‡ ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ±ØŸ Ø­Ø³Ø§Ø¨ Ø¨Ù„Ø§ ÙƒÙ„Ù…Ø© Ù„Ø§ ÙŠØ³ØªØ·ÙŠØ¹ Ø§Ù„Ø¯Ø®ÙˆÙ„ */
  has_password: boolean
  last_login_at: string | null
  /** ØºÙŠØ± ÙØ§Ø±Øº Ø¹Ù†Ø¯ Ø§Ù„Ù‚ÙÙ„ Ø§Ù„Ù…Ø¤Ù‚Øª Ø¨Ø¹Ø¯ Ù…Ø­Ø§ÙˆÙ„Ø§Øª ÙØ§Ø´Ù„Ø© */
  locked_until: string | null
  roles: string[]
}

export interface AdminUserPayload {
  email: string
  display_name: string
  role_id: string
  password: string
  is_external?: boolean
}

/** Ø¯ÙˆØ± Ù…Ù† Ø¬Ø¯ÙˆÙ„ roles Ø§Ù„Ù…Ø¨Ø°ÙˆØ± ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0014 */
export interface RoleRecord {
  id: string
  name_ar: string
  is_system: number
  permissions_count?: number
  /**
   * Ù…Ø¹Ø±Ù‘ÙØ§Øª ØµÙ„Ø§Ø­ÙŠØ§Øª Ù‡Ø°Ø§ Ø§Ù„Ø¯ÙˆØ± Ù…Ù† role_permissions.
   *
   * Ø£ÙØ¶ÙŠÙØª Ù„Ø£Ù† Ø§Ù„Ø®Ø§Ø¯Ù… ÙƒØ§Ù† ÙŠÙØ¹ÙŠØ¯ Ø§Ù„Ø¹Ø¯Ø¯ ÙÙ‚Ø·ØŒ ÙÙ„Ù… ØªØ³ØªØ·Ø¹ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø¨Ù†Ø§Ø¡ Ù…ØµÙÙˆÙØ©
   * Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª Ù…Ù† Ø¨ÙŠØ§Ù†Ø§Øª Ø­Ù‚ÙŠÙ‚ÙŠØ© â€” ÙˆÙƒØ§Ù†Øª Ø§Ù„Ù…ØµÙÙˆÙØ© Ù…ÙƒØªÙˆØ¨Ø© Ø«Ø§Ø¨ØªØ© ÙÙŠ Ø§Ù„ÙƒÙˆØ¯.
   */
  permissions: string[]
}

export interface PermissionRecord {
  id: string
  action: string
  description_ar: string | null
}

/** Ù…Ù†Ø­ ØµÙ„Ø§Ø­ÙŠØ© Ø¨Ø£Ø±Ø¨Ø¹ Ø·Ø¨Ù‚Ø§Øª Ù†Ø·Ø§Ù‚ØŒ Ù…Ù† Ø¬Ø¯ÙˆÙ„ access_grants */
export interface AccessGrantRecord {
  id: string
  grantee_type: 'user' | 'team'
  grantee_id: string
  role_id: string
  /** ÙŠØ£ØªÙŠ Ù…Ù† LEFT JOIN roles ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… */
  role_name: string | null
  scope_type: 'platform' | 'planet' | 'section' | 'series' | 'content' | 'page' | 'language'
  scope_id: string | null
  content_type: string | null
  language: string | null
  valid_from: string
  valid_until: string | null
  granted_by: string | null
  created_at: string
}

export interface AccessGrantPayload {
  grantee_type?: 'user' | 'team'
  grantee_id: string
  role_id: string
  scope_type?: string
  scope_id?: string | null
}

export interface TeamRecord {
  id: string
  name_ar: string
  description_ar: string | null
  planet_id: string | null
  section: string | null
  team_lead_id: string | null
  members_count: number
  created_at: string
}

export interface TeamDetail extends TeamRecord {
  members: { id: string; display_name: string; email: string }[]
}

export interface TeamPayload {
  name_ar: string
  description_ar?: string | null
  planet_id?: string | null
  section?: string | null
  member_ids?: string[]
}

export interface TaskRecord {
  id: string
  title_ar: string
  content_type: string | null
  content_id: string | null
  /** Ù…Ù† LEFT JOIN series ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… */
  series_title: string | null
  assignee_id: string | null
  status: string
  priority: string | null
  due_date: string | null
  created_at: string
}

export interface WorkflowRunRecord {
  id: string
  content_type: string
  content_id: string
  template_id: string | null
  current_step: string | null
  status: string
  reviews_count: number
  created_at: string
  updated_at: string
}

/** Ø¬Ù‡Ø§Ø² Ø¹Ø§Ø¦Ù„Ø© Ù…Ù† account_devices. Ù„Ø§ ÙŠÙØ¹Ø±Ø¶ Ø£ÙŠ Ù…Ø¹Ø±Ù‘Ù ØªØ«Ø¨ÙŠØª Ø®Ø§Ù… */
export interface AdminDeviceRecord {
  id: string
  parent_id: string
  parent_name: string | null
  display_name: string | null
  platform: string | null
  status: string
  last_seen_at: string | null
  registered_at: string | null
  revoked_at: string | null
}

/** Ø­Ø¯ÙˆØ¯ Ø¨Ø§Ù‚Ø© ÙƒÙ…Ø§ ÙŠÙØ±Ø¶Ù‡Ø§ familyPolicy ÙÙŠ FamilyStateØŒ ÙˆÙ„ÙŠØ³Øª Ø¹Ù‚Ø¯ Ø£Ø³Ø¹Ø§Ø± Ù…ØªØ¬Ø±. */
export interface PlanLimits {
  children: number
  devices: number
  concurrent_streams: number
  download_devices: number
}

export interface AdminPlanRecord {
  id: 'free' | 'family' | 'family_plus'
  limits: PlanLimits
}

export interface PlansCatalogue {
  source: 'family_policy'
  pricing_available: boolean
  plans: AdminPlanRecord[]
}

export interface RightsLicenseRecord {
  id: string
  content_id: string
  /** Ù…Ù† LEFT JOIN series ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… */
  series_title: string | null
  owner: string
  license_type: string
  /** Ù…Ø®Ø²ÙŽÙ‘Ù†Ø© ÙƒÙ†Øµ JSON ÙÙŠ D1 */
  countries: string
  languages: string
  devices: string
  expiry_date: string | null
  created_at: string
}

export interface RightsLicensePayload {
  content_id: string
  owner: string
  license_type?: string
  countries?: string[]
  languages?: string[]
  devices?: string[]
  expiry_date?: string | null
}

/** Ø¥Ø¹Ø¯Ø§Ø¯ ØªØ­ÙƒÙ‘Ù… Ø¹Ù† Ø¨Ø¹Ø¯. Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠÙÙƒÙ‘ ØªØ­Ù„ÙŠÙ„ JSON Ù‚Ø¨Ù„ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ */
export interface RemoteConfigRecord {
  key: string
  value: unknown
  rollout_percent: number
  targeting: Record<string, unknown>
  updated_at: string
}

export interface FeatureFlagRecord {
  key: string
  enabled: boolean
  targeting: Record<string, unknown>
  created_at: string
}

/**
 * Ø§Ù„Ø£Ø¨Ø¹Ø§Ø¯ Ø§Ù„ØªÙŠ ÙŠØ·Ø¨Ù‘Ù‚Ù‡Ø§ Ø§Ù„Ù…ÙØ­Ù„ÙÙ‘Ù„ ÙØ¹Ù„Ù‹Ø§ (`api/src/lib/homeExperience.ts`).
 *
 * ÙƒØ§Ù†Øª Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© ØªØ¹Ø±Ø¶ `age_min`/`age_max` ÙÙŠ Ø¬Ù…Ù„Ø© Ø§Ù„Ø§Ø³ØªÙ‡Ø¯Ø§ÙØŒ ÙˆÙ‡Ù…Ø§ Ø¨Ø¹Ø¯Ø§Ù† Ù„Ù… ÙŠÙ‚Ø±Ø£Ù‡Ù…Ø§
 * Ø£ÙŠ Ù…ÙØ­Ù„ÙÙ‘Ù„: Ù‚Ø§Ø¹Ø¯Ø© ØªÙÙƒØªØ¨ ÙÙŠÙ‡Ù…Ø§ ØªÙØ­ÙØ¸ ÙˆØªÙØ¹Ø±Ø¶ ÙƒØ£Ù†Ù‡Ø§ Ø³Ø§Ø±ÙŠØ© Ø«Ù… ØªÙØªØ¬Ø§Ù‡Ù„ ÙÙŠ ÙƒÙ„ Ø·Ù„Ø¨.
 */
export interface HomeTargeting {
  track?: string[]
  language?: string[]
  country?: string[]
  plan?: string[]
  platform?: string[]
  /// Ø£Ø¯Ù†Ù‰ Ø¥ØµØ¯Ø§Ø± ØªØ·Ø¨ÙŠÙ‚ØŒ Ù…Ù‚Ø§Ø±Ù†Ø© Ø±Ù‚Ù…ÙŠØ© Ù„Ø§ Ù†ØµÙŠØ©.
  min_app_version?: string
  is_new_user?: boolean
}

export interface HomeBlockConfig {
  system?: boolean
  subtitle?: string | null
  card_style?: string | null
  maxItems?: number
  freshnessDays?: number
  bannerAsset?: string
  season?: string
}

export interface HomeBlockRecord {
  id: string
  block_type: string
  title_ar: string | null
  sort_order: number
  is_active: number
  is_draft?: number
  scheduled_at?: string | null
  expires_at?: string | null
  version?: number
  created_at?: string
  updated_at?: string
  targeting: HomeTargeting
  config: HomeBlockConfig
  /// ÙƒØªÙ„Ø© ÙŠØ­Ø³Ø¨ Ø§Ù„Ø®Ø§Ø¯Ù… Ù…Ø­ØªÙˆØ§Ù‡Ø§ Ù…Ù† Ø­Ø§Ù„Ø© Ø§Ù„Ø·ÙÙ„Ø› Ù„Ø§ ÙŠÙØ®ØªØ§Ø± Ù…Ø­ØªÙˆØ§Ù‡Ø§ ØªØ­Ø±ÙŠØ±ÙŠÙ‹Ø§.
  is_system?: boolean
  /// Ø±Ø³Ø§Ù„Ø© Ø§Ù„Ø®Ø·Ø£ Ø¥Ù† ÙƒØ§Ù† JSON Ø§Ù„Ù…Ø®Ø²ÙŽÙ‘Ù† Ù„Ø§ ÙŠØ¬ØªØ§Ø² Ø§Ù„ØªØ­Ù‚Ù‚ØŒ Ùˆnull Ø¥Ù† ÙƒØ§Ù† Ø³Ù„ÙŠÙ…Ù‹Ø§.
  targeting_invalid?: string | null
  config_invalid?: string | null
}

/// Ù…Ø§ ÙŠÙ‚Ø¨Ù„Ù‡ Ø§Ù„Ø®Ø§Ø¯Ù…ØŒ ÙŠÙØ±Ø³ÙŽÙ„ Ù…Ø¹ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© ÙÙ„Ø§ ØªÙØ®ØªØ±Ø¹ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ù‚Ø§Ø¦Ù…Ø© Ø£Ù†ÙˆØ§Ø¹ Ø®Ø§ØµØ© Ø¨Ù‡Ø§.
export interface HomeBuilderMeta {
  /// `APP-104`: the types the builder may create — offered, not every type the
  /// table tolerates. Three types no app version renders were being offered here.
  block_types: string[]
  system_block_types: string[]
  /// Types withdrawn from the picker. Sent so an existing row can be explained
  /// rather than shown as an ordinary block that simply never appears.
  retired_block_types?: string[]
  targeting_dimensions: string[]
  config_keys: string[]
}

/**
 * Ù†Ø³Ø®Ø© Ù…Ø­ÙÙˆØ¸Ø© Ù…Ù† ÙƒØªÙ„Ø©.
 *
 * `restorable` false Ù„Ù„Ù†Ø³Ø®Ø© Ø§Ù„ØªÙŠ ØªØ³Ø¬Ù‘Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„ÙƒØªÙ„Ø©: Ù„Ø§ Ø­Ø§Ù„Ø© Ø£Ø³Ø¨Ù‚ ØªÙØ³ØªØ¹Ø§Ø¯ Ø¥Ù„ÙŠÙ‡Ø§.
 */
export interface HomeBlockVersion {
  id: string
  created_at: string
  action: 'create' | 'update' | 'reorder' | 'rollback' | 'delete'
  actor_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  restorable: boolean
}

export interface HomeVersionsMeta {
  total: number
  /// Ø³Ø¬Ù„Ø§Øª Ù…Ù† ØªØ·Ø¨ÙŠÙ‚ Ø³Ø§Ø¨Ù‚ Ù„Ø§ ØªØ­Ù…Ù„ Ø§Ù„Ø§Ø³ØªÙ‡Ø¯Ø§Ù ÙˆÙ„Ø§ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯ØŒ ÙÙ„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø¥Ù„ÙŠÙ‡Ø§.
  legacy_records: number
  note: string | null
}

/**
 * Ù†ØªÙŠØ¬Ø© Ø¨Ø­Ø« Ø§Ù„Ø¯Ø¹Ù… Ø¹Ù† Ø¹Ø§Ø¦Ù„Ø©.
 *
 * Ù„Ø§ ØªØ­Ù…Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ø¯ÙØ¹ ÙƒØ§Ù…Ù„Ø©: `entitlements` Ù…Ù† billing_audit Ø¨Ù„Ø§ Ø±Ù…Ø² Ø§Ù„Ø´Ø±Ø§Ø¡.
 */
export interface SupportFamilyRecord {
  parent_id: string
  plan: ParentRecord['plan']
  status: ParentRecord['status']
}

/** Ø£Ù‚Ù„ Ø¨ÙŠØ§Ù†Ø§Øª Ù„Ø§Ø²Ù…Ø© Ù„Ù…ÙˆØ¸Ù Ø§Ù„Ø¯Ø¹Ù…Ø› Ù„Ø§ ÙŠØ´Ù…Ù„ avatar Ø£Ùˆ Ù„ØºØ© Ø§Ù„Ø·ÙÙ„ Ø£Ùˆ Ø·ÙˆØ§Ø¨Ø¹ Ø§Ù„Ø£Ø­Ø¯Ø§Ø«. */
export interface SupportChildRecord {
  child_id: string
  nickname: string | null
  age_track: AgeTrack | null
  status: 'active' | 'archived'
}

/** Ø¬Ù‡Ø§Ø² Ø¯Ø¹Ù… Ù…Ø®ØªØµØ±Ø› hashes Ø§Ù„ØªØ«Ø¨ÙŠØª Ùˆauth epoch Ù„Ø§ ÙŠØµÙ„Ø§Ù† Ø¥Ù„Ù‰ Ø§Ù„Ù…ØªØµÙØ­. */
export interface SupportDeviceRecord {
  id: string
  display_name: string | null
  platform: string
  status: 'active' | 'revoked'
}

/** Ù…Ù„Ø®Øµ Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ø¨Ù„Ø§ hashes Ø£Ùˆ Ù…Ø¹Ø±Ù‘ÙØ§Øª Ø´Ø±Ø§Ø¡ Ù…Ù† Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯. */
export interface SupportEntitlementRecord {
  product_id: string
  plan: 'family' | 'family_plus'
  entitlement_status: 'active' | 'grace' | 'expired' | 'revoked'
  expires_at_ms: number | null
}

export interface SupportFamilyEnvelope {
  family: SupportFamilyRecord | null
  children: SupportChildRecord[]
  devices: SupportDeviceRecord[]
  entitlements: SupportEntitlementRecord[]
}

/**
 * Ù†ØªÙŠØ¬Ø© Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„ØµÙØ­Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ø¨Ø¹Ø¯ ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø§Ø³ØªÙ‡Ø¯Ø§Ù ÙˆØ§Ù„Ø¬Ø¯ÙˆÙ„Ø©.
 *
 * Ø§Ù„ØªØ´Ø®ÙŠØµØ§Øª Ø­Ù‚ÙŠÙ‚ÙŠØ©: ÙƒØ§Ù†Øª Ø§Ù„Ø´Ø§Ø´Ø© ØªØ·Ø¨Ø¹ Â«Fallback applied: noneÂ» Ø¯Ø§Ø¦Ù…Ù‹Ø§ ÙˆØªØ­Ø³Ø¨
 * Ø§Ù„Ù…Ø³ØªØ«Ù†Ù‰ Ù…Ù† Ù‚Ø§Ø¦Ù…Ø© ÙÙ„ØªØ±ØªÙ‡Ø§ Ø¨Ù†ÙØ³Ù‡Ø§ØŒ ÙÙƒØ§Ù†Øª ØªØµÙ ÙÙ„ØªØ±ØªÙ‡Ø§ Ù„Ø§ ÙÙ„ØªØ±Ø© Ø§Ù„Ø®Ø§Ø¯Ù….
 */
export interface HomePreviewEnvelope {
  blocks: Array<{
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
  }>
  meta: {
    track: string
    language: string
    country: string
    plan: string
    platform: string
    appVersion: string
    isNewUser: boolean
    resolved_at: string
    total_blocks: number
    matched: number
    excluded: number
    excluded_inactive: number
    excluded_draft: number
    excluded_schedule: number
    resolver: string
  }
}

export interface BillingStats {
  by_plan: { plan: string; count: number }[]
  recent_purchases: Record<string, unknown>[]
  recent_entitlements: Record<string, unknown>[]
}

/**
 * ØµÙÙ‘ Ø´Ø±Ø§Ø¡ Ù…Ù† `billing_audit` (Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0008).
 *
 * `/billing/purchases` ÙŠØ¹ÙŠØ¯ Ø£Ø¹Ù…Ø¯Ø© Ø£ÙƒØ«Ø± Ù…Ù† `recent_purchases` Ø¯Ø§Ø®Ù„ `/stats`:
 * ÙŠØ¶ÙŠÙ `purchase_token_hash` Ùˆ`verified_at_ms`. Ø§Ù„Ù…Ù„Ø®Ù‘Øµ ÙŠØ¬ÙŠØ¨ Â«Ù…Ø§ Ø§Ù„Ø­Ø§Ù„Ø©
 * Ø§Ù„Ø¹Ø§Ù…Ø©Â»ØŒ ÙˆÙ‡Ø°Ø§ Ø§Ù„Ù…Ø³Ø§Ø± ÙŠØ¬ÙŠØ¨ Â«Ù…Ø§ Ø§Ù„Ø°ÙŠ Ø­Ø¯Ø« ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ø´Ø±Ø§Ø¡ Ø¨Ø§Ù„Ø¶Ø¨Ø·Â».
 *
 * `purchase_token_hash` Ù…Ù„Ø®Ù‘Øµ Ù„Ø§ Ø§Ù„Ø±Ù…Ø² Ù†ÙØ³Ù‡ â€” Ø§Ù„Ø±Ù…Ø² Ø§Ù„Ø£ØµÙ„ÙŠ Ù„Ø§ ÙŠÙØ®Ø²ÙŽÙ‘Ù† Ø¥Ø·Ù„Ø§Ù‚Ù‹Ø§.
 */
export interface BillingPurchaseRecord {
  parent_id: string
  product_id: string
  plan: 'family' | 'family_plus'
  purchase_token_hash: string
  entitlement_status: 'active' | 'grace' | 'expired' | 'revoked'
  provider_state: string
  starts_at_ms: number | null
  expires_at_ms: number | null
  verified_at_ms: number
  created_at: string
}

/**
 * Ø¢Ø®Ø± Ø®Ø·Ø© Ù…Ø¯ÙÙˆØ¹Ø© Ù…Ø³Ù‚Ø·Ø© Ù…Ù† `family_projection`.
 *
 * Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠØ³ØªØ«Ù†ÙŠ `plan = 'free'`. Ù‡Ø°Ø§ Ø¥Ø³Ù‚Ø§Ø· ØªØ´ØºÙŠÙ„ÙŠ ØºÙŠØ± Ù…ØªØ²Ø§Ù…Ù† ÙˆÙ„ÙŠØ³ Ù‚Ø±Ø§Ø±
 * Ø§Ø³ØªØ­Ù‚Ø§Ù‚ Ù„Ø­Ø¸ÙŠÙ‹Ø§: FamilyState Ù‡Ùˆ Ù…ØµØ¯Ø± Ø§Ù„Ø®Ø·Ø© Ø§Ù„ÙØ¹Ù„ÙŠØ©. ÙˆÙ„Ø§ ÙŠØ­Ù…Ù„ Ø§Ù„Ø¥Ø³Ù‚Ø§Ø· ØªØ§Ø±ÙŠØ®
 * Ø¨Ø¯Ø§ÙŠØ© Ø£Ùˆ Ù†Ù‡Ø§ÙŠØ©Ø› ØªÙ„Ùƒ ÙÙŠ `billing_audit`.
 */
export interface BillingEntitlementRecord {
  parent_id: string
  plan: 'family' | 'family_plus'
  status: 'active' | 'suspended' | 'archived'
  last_event_at_ms: number
  updated_at: string
}

// Commerce â€” Subscriptions & Transactions (billing_audit + family_projection)
export interface SubscriptionRecord {
  id: string
  parent_id: string
  family_name?: string | null
  family_status?: string | null
  family_plan?: string | null
  product_id: string
  plan: string
  provider: string
  provider_state: string
  entitlement_status: string
  starts_at_ms: number | null
  expires_at_ms: number | null
  verified_at_ms: number
  created_at: string
  has_mismatch?: number
}
export interface SubscriptionDetail extends Omit<SubscriptionRecord, 'has_mismatch'> {
  family_entitlement?: { parent_id: string; plan: string; status: string; last_event_at_ms: number } | null
  related_transactions?: SubscriptionRecord[]
  has_mismatch: boolean
  has_mismatch_num?: number
}
export interface TransactionRecord extends SubscriptionRecord {
  is_duplicate?: boolean
  history?: Array<{ id:string; action:string; created_at:string }>
}

// Plans & Pricing
export interface StoreProduct {
  id: string
  provider: string
  store_product_id: string
  plan: string
  billing_period: string
  base_country?: string | null
  currency?: string | null
  base_price_minor?: number | null
  trial_days?: number | null
  status: string
}
export interface PlanPricingRow {
  id: string
  plan: string
  store_product_id: string
  country: string
  currency: string
  currency_exponent: number
  price_minor: number
  effective_from: string
  effective_until?: string | null
  status: string
  provider?: string
  billing_period?: string
}
export interface BillingPaymentMethod {
  id: string
  provider: 'google_play' | 'app_store' | 'stripe' | 'payment_gateway'
  method_code: string
  name_ar: string
  name_en: string
  country: string
  platform: 'android' | 'ios' | 'web'
  checkout_mode: 'native_store' | 'hosted_checkout' | 'redirect'
  status: 'draft' | 'active' | 'disabled'
  sort_order: number
  runtime_ready: boolean
  created_at: string
  updated_at: string
}

export interface PlanDetail {
  id: string
  limits: { children:number; devices:number; concurrent_streams:number; download_devices:number }
  subscribers: number
  pricing: PlanPricingRow[]
  products: StoreProduct[]
  promotions: PromotionRow[]
}
export interface PromotionRow {
  id: string
  code?: string | null
  name_ar: string
  plan?: string | null
  status: string
  discount_type?: string | null
  discount_value?: number | null
  country?: string | null
  starts_at?: string | null
  ends_at?: string | null
}

// Revenue
export interface RevenueOverview {
  range: string
  metrics: {
    gross_revenue: { value:number|null; unavailable?:string }
    net_revenue: { value:number|null; unavailable?:string }
    mrr: { value:number|null; unavailable?:string }
    arr: { value:number|null; unavailable?:string }
    active_paid_subscribers: number
    new_paid_subscribers: number
    renewals: number
    refunds: number
    trial_starts: Array<{ plan:string; cnt:number }>
    churn_proxy: number|null
  }
  breakdowns: { by_plan:Array<{plan:string;cnt:number}>; by_provider:Array<{provider:string;cnt:number}>; by_currency:any[]; by_country:any[] }
  data_quality: Array<{ issue:string; cnt:number }>
  has_pricing: boolean
}

// Content costs / Finance
export interface ContentCostRecord {
  id: string
  entity_type: string
  entity_id: string
  category: string
  amount_minor: number
  currency: string
  vendor?: string | null
  incurred_at: string
  period?: string | null
  allocation_basis?: string | null
  notes?: string | null
  series_title?: string | null
}
export interface RightsDetail {
  id: string
  content_id: string
  series_title?: string | null
  series_status?: string | null
  owner: string
  license_type: string
  countries: string
  languages: string
  devices: string
  expiry_date?: string | null
  affected_content?: Array<{ id:string; title_ar:string; status:string }>
  availability?: Record<string,unknown> | null
  history?: Array<{ id:string; action:string; created_at:string }>
}

/* ------------------------------------- ØªÙØµÙŠÙ„ ÙˆÙ„ÙŠ Ø§Ù„Ø£Ù…Ø± ÙˆØªÙ‚Ø¯Ù‘Ù… Ø§Ù„Ø·ÙÙ„ */

/**
 * ØµÙÙ‘ Ø·ÙÙ„ Ù…Ù† `child_projection` (Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0008).
 *
 * Ø§Ù„Ø¥Ø³Ù‚Ø§Ø· Ù„Ø§ Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø£ØµÙ„ÙŠ: ÙƒÙ„ Ø£Ø¹Ù…Ø¯ØªÙ‡ nullable Ù„Ø£Ù†Ù‡ ÙŠÙØ¨Ù†Ù‰ Ù…Ù† Ø£Ø­Ø¯Ø§Ø«ØŒ ÙˆØ§Ù„Ø­Ø¯Ø«
 * Ø§Ù„Ø£ÙˆÙ„ Ù‚Ø¯ Ù„Ø§ ÙŠØ­Ù…Ù„ ÙƒÙ„ Ø§Ù„Ø­Ù‚ÙˆÙ„. `children_profiles` Ù‡Ùˆ Ù…ØµØ¯Ø± Ø§Ù„Ø­Ù‚ÙŠÙ‚Ø© Ø§Ù„ÙƒØ§Ù…Ù„.
 */
export interface ParentDetailChild {
  child_id: string
  parent_id: string
  nickname: string | null
  age_track: AgeTrack | null
  avatar_id: string | null
  language: string | null
  status: 'active' | 'archived'
  created_at_ms: number | null
  last_event_at_ms: number
  updated_at: string
}

/**
 * ØªÙØµÙŠÙ„ ÙˆÙ„ÙŠ Ø£Ù…Ø± ÙˆØ§Ø­Ø¯ Ù…Ù† `/admin/parents/:id`.
 *
 * Ø§Ù„Ù…ØµØ¯Ø± `family_projection` Ù„Ø§ `parents`: Ø§Ù„Ø£ÙˆÙ„ Ø¥Ø³Ù‚Ø§Ø· Ù…Ø¨Ù†ÙŠÙ‘ Ù…Ù† Ø£Ø­Ø¯Ø§Ø« Ø§Ù„Ø¹Ø§Ø¦Ù„Ø©
 * ÙˆØ§Ù„Ø«Ø§Ù†ÙŠ Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù‡ÙˆÙŠØ©. Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠØµØ±Ù‘Ø­ Ø¨Ø°Ù„Ùƒ ÙÙŠ `meta.source`.
 */
export interface ParentDetail {
  parent_id: string
  display_name: string | null
  status: 'active' | 'suspended' | 'archived'
  plan: 'free' | 'family' | 'family_plus'
  created_at_ms: number | null
  last_event_at_ms: number
  updated_at: string
  children: ParentDetailChild[]
}

/// ØµÙÙ‘ Ù…Ø´Ø§Ù‡Ø¯Ø© Ù…Ù† `watch_progress`. Ø§Ù„Ø£Ø¹Ù…Ø¯Ø© Ø¨Ø§Ù„Ø«ÙˆØ§Ù†ÙŠ Ù„Ø§ Ø¨Ø§Ù„Ù…ÙŠÙ„ÙŠ Ø«Ø§Ù†ÙŠØ©.
export interface ChildWatchProgress {
  episode_id: string
  episode_title: string | null
  series_title: string | null
  progress_seconds: number
  is_completed: boolean
  watch_count: number
  completed_at: string | null
  updated_at: string
}

/// ØµÙÙ‘ Ø¥ØªÙ‚Ø§Ù† Ù„Ù‡Ø¯Ù ÙˆØ§Ø­Ø¯ Ø¹Ù†Ø¯ Ø·ÙÙ„ ÙˆØ§Ø­Ø¯.
export interface ChildMasteryRow {
  objective_id: string
  code: string | null
  objective_title: string | null
  level: MasteryLevel
  attempts: number
  correct_attempts: number
  /// `null` Ø¹Ù†Ø¯ ØºÙŠØ§Ø¨ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø§Øª: Â«Ù„Ø§ Ø¨ÙŠØ§Ù†Ø§ØªÂ» Ù„ÙŠØ³Øª Â«Ù†Ø³Ø¨Ø© Ù†Ø¬Ø§Ø­ ØµÙØ±Â»
  success_rate: number | null
  last_attempt_at: string | null
}

/**
 * ØªÙ‚Ø¯Ù‘Ù… Ø·ÙÙ„ ÙˆØ§Ø­Ø¯ Ù…Ù† `/admin/analytics/children/:id`.
 *
 * Ø«Ù„Ø§Ø«Ø© Ù…ØµØ§Ø¯Ø± Ù„Ø£Ù† Â«ØªÙ‚Ø¯Ù‘Ù… Ø§Ù„Ø·ÙÙ„Â» Ù„ÙŠØ³ Ø¬Ø¯ÙˆÙ„Ù‹Ø§ ÙˆØ§Ø­Ø¯Ù‹Ø§: Ø§Ù„Ù…Ø´Ø§Ù‡Ø¯Ø© ÙÙŠ
 * `watch_progress`ØŒ ÙˆØ§Ù„Ø¥ØªÙ‚Ø§Ù† ÙÙŠ `mastery`ØŒ ÙˆØ§Ù„Ù…Ø­Ø§ÙˆÙ„Ø§Øª ÙÙŠ `attempts`.
 *
 * Ø§Ù„Ù…Ø³Ø§Ø± ÙƒØ§Ù† ÙŠØ³ØªØ¹Ù„Ù… Ø¬Ø¯ÙˆÙ„Ù‹Ø§ Ø§Ø³Ù…Ù‡ `content_progress` Ù„Ø§ ÙˆØ¬ÙˆØ¯ Ù„Ù‡ ÙÙŠ Ø£ÙŠ Ù…Ù‡Ø§Ø¬Ø±Ø© ÙˆÙ„Ø§
 * ÙÙŠ Ø§Ù„Ø¥Ù†ØªØ§Ø¬ØŒ ÙÙƒØ§Ù† ÙŠØ±Ù…ÙŠ Ø¹Ù„Ù‰ ÙƒÙ„ Ù†Ø¯Ø§Ø¡ â€” ÙˆÙ„Ù… ÙŠØ¸Ù‡Ø± Ø°Ù„Ùƒ Ù„Ø£Ù†Ù‡ Ø¨Ù„Ø§ ÙˆØ§Ø¬Ù‡Ø©.
 */
export interface ChildProgressReport {
  child: {
    id: string
    nickname: string
    age_track: AgeTrack
    language: string
    status: string
    parent_id: string
  }
  watch_progress: ChildWatchProgress[]
  mastery: ChildMasteryRow[]
  attempts: AttemptRecord[]
}

export interface AnalyticsOverview {
  total_plays: number
  by_track: { track_id: string; count: number }[]
  mastery: { level: string; count: number }[]
  recent_events: Record<string, unknown>[]
}

/* ------------------------------------------------------- Ø§Ù„Ø¥Ø·Ø§Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ */

/**
 * Ù…Ù‡Ø§Ø±Ø©. Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ù…Ù† Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0001.
 *
 * `category` Ø¨Ù„Ø§ CHECK ÙÙŠ D1ØŒ ÙØ£ÙŠ Ù†Øµ ØºÙŠØ± ÙØ§Ø±Øº Ù…Ù‚Ø¨ÙˆÙ„. Ù„Ø§ ØªÙØ®ØªØ±Ø¹ Ù‚Ø§Ø¦Ù…Ø© Ø¨ÙŠØ¶Ø§Ø¡
 * Ù„Ø§ ÙŠÙØ±Ø¶Ù‡Ø§ Ø§Ù„Ù…Ø®Ø·ÙŽÙ‘Ø· â€” Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠØµØ±Ù‘Ø­ Ø¨Ø°Ù„Ùƒ ÙÙŠ adminCatalogue.ts.
 */
export interface SkillRecord {
  id: string
  name_ar: string
  category: string
  description: string | null
  created_at: string
  /// Ù…Ù† Ø§Ø³ØªØ¹Ù„Ø§Ù… ØªØ¬Ù…ÙŠØ¹ÙŠ ÙÙŠ GET /admin/skillsØŒ Ù„Ø§ Ø¹Ù…ÙˆØ¯ ÙÙŠ Ø§Ù„Ø¬Ø¯ÙˆÙ„
  objectives_count?: number
}

export interface SkillPayload {
  id?: string
  name_ar: string
  category: string
  description?: string | null
}

/// Ø§Ø±ØªØ¨Ø§Ø·Ø§Øª Ø§Ù„Ù‡Ø¯Ù Ø§Ù„ØªÙŠ ØªÙ…Ù†Ø¹ Ø­Ø°ÙÙ‡. ØªÙØ¹Ø§Ø¯ ÙÙŠ 409 Ù…Ù† DELETE Ø£ÙŠØ¶Ù‹Ø§ Ù„Ø§ ÙÙŠ GET ÙˆØ­Ø¯Ù‡.
export interface ObjectiveUsage {
  episodes: number
  games: number
  publishedEpisodes: number
  publishedGames: number
  projects: number
  publishedProjects: number
}

/**
 * Ù‡Ø¯Ù ØªØ¹Ù„ÙŠÙ…ÙŠ Ù‚Ø§Ø¨Ù„ Ù„Ù„Ù‚ÙŠØ§Ø³. Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ù…Ù† Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0001.
 *
 * `track_ids` Ù„ÙŠØ³Øª Ø¹Ù…ÙˆØ¯Ù‹Ø§: Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠØ¬Ù…Ø¹Ù‡Ø§ Ù…Ù† learning_objective_tracks ÙˆÙŠØ¹ÙŠØ¯Ù‡Ø§
 * Ù…ØµÙÙˆÙØ© Ø¬Ø§Ù‡Ø²Ø© (`serializeObjective`)ØŒ ÙÙ„Ø§ ØªÙÙÙƒÙŽÙ‘Ùƒ ÙÙŠ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø©.
 */
export interface LearningObjectiveRecord {
  id: string
  code: string
  title_ar: string
  description_ar: string | null
  skill_id: string | null
  age_min: number
  age_max: number
  measurable_criteria: string | null
  created_at: string
  track_ids: AgeTrack[]
  /// Ù…Ù† LEFT JOIN skills
  skill_name?: string | null
  skill_category?: string | null
  episodes_count?: number
  games_count?: number
}

export interface LearningObjectiveDetail extends LearningObjectiveRecord {
  usage: ObjectiveUsage
}

export interface LearningObjectivePayload {
  id?: string
  code: string
  title_ar: string
  description_ar?: string | null
  skill_id?: string | null
  age_min: number
  age_max: number
  measurable_criteria?: string | null
  /// Ø¥Ù† Ø£ÙØºÙÙ„Øª ÙŠØ´ØªÙ‚Ù‘Ù‡Ø§ Ø§Ù„Ø®Ø§Ø¯Ù… Ù…Ù† Ø§Ù„Ù…Ø¯Ù‰ Ø§Ù„Ø¹Ù…Ø±ÙŠ
  track_ids?: AgeTrack[]
}

/* ---------------------------------------------- Ø¨Ù†Ùƒ Ø§Ù„Ø£Ø³Ø¦Ù„Ø© */

export type QuestionType = 'MULTIPLE_CHOICE'|'TRUE_FALSE'|'ORDERING'|'MATCHING'|'IMAGE_CHOICE'
export type QuestionStatus = 'draft'|'in_review'|'approved'|'archived'
export type QuestionDifficulty = 'easy'|'medium'|'hard'

export interface QuestionRecord {
  id: string
  code: string
  type: QuestionType
  prompt_ar: string
  prompt_en?: string | null
  explanation_ar?: string | null
  learning_objective_id: string | null
  objective_title?: string | null
  objective_code?: string | null
  skill_id?: string | null
  skill_name?: string | null
  age_min: number
  age_max: number
  difficulty: QuestionDifficulty
  status: QuestionStatus
  correct_answer: Record<string, unknown>
  distractors: unknown[]
  media_asset_id?: string | null
  media_asset_ids: string[]
  version: number
  created_at: string
  updated_at: string
  languages_count?: number
  usage_count?: number
}

export interface QuestionDetail extends QuestionRecord {
  localizations: Array<{ question_id:string; language:string; prompt:string; correct_answer:Record<string,unknown>; distractors:unknown[]; explanation?:string|null }>
  reviews: Array<{ id:string; reviewer_role:string; reviewer_id:string|null; status:string; comments:string|null; created_at:string }>
  usage: Array<{ question_id:string; entity_type:string; entity_id:string }>
  history: Array<{ id:string; action:string; actor_id:string|null; created_at:string }>
}

export interface QuestionPayload {
  code: string
  type: QuestionType
  prompt_ar: string
  prompt_en?: string | null
  explanation_ar?: string | null
  learning_objective_id: string|null
  skill_id?: string|null
  age_min: number
  age_max: number
  difficulty?: QuestionDifficulty
  status?: QuestionStatus
  correct_answer?: Record<string,unknown>
  distractors?: unknown[]
  media_asset_id?: string|null
}

/* ------------------------------------------- Ù…Ø±ÙƒØ² Ø§Ù„ØªØ±Ø¬Ù…Ø© */

export type TranslationStatus = 'pending'|'in_translation'|'ready_for_review'|'changes_requested'|'approved'|'stale'
export type GlossaryCategory = 'character'|'planet'|'educational'|'islamic'|'scientific'|'ui'|'general'

export interface TranslationUnit {
  id: string
  entity_type: string
  entity_id: string
  field: string
  source_language: string
  source_text: string
  source_version: number
  target_language: string
  target_text?: string|null
  status: TranslationStatus
  translator_id?: string|null
  reviewer_id?: string|null
  is_reauthor?: number
  stale?: boolean
  context_title?: string|null
  context_image?: string|null
  story_id?: string|null
  page_number?: number|null
  created_at?: string
  updated_at?: string
}

export interface TranslationQueueMeta { total:number; limit:number; offset:number; summary?:Record<string,number> }

export interface TranslationDetail extends TranslationUnit {
  context?: Record<string,unknown>
  siblings?: Array<{ id:string; page_number:number }>
  translation_memory?: Array<{ source_text:string; target_text:string; usage_count:number }>
  glossary?: Array<GlossaryTerm>
}

export interface GlossaryTerm {
  id: string
  source_term: string
  source_language: string
  translations: Record<string,string>
  scope: string
  category: GlossaryCategory
  status: string
  notes?: string|null
  created_at: string
  updated_at: string
}

/* --------------------------------------------------------- Ù…Ø±Ø§Ø¬Ø¹Ø§Øª Ø§Ù„Ù…Ø­ØªÙˆÙ‰ */

/**
 * Ø£Ù†ÙˆØ§Ø¹ Ø§Ù„ÙƒÙŠØ§Ù†Ø§Øª Ø§Ù„Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©.
 *
 * `story` ØºØ§Ø¦Ø¨ Ø¹Ù† Ù‚ØµØ¯: Ø§Ù„Ù€CHECK ÙÙŠ D1 Ù‡Ùˆ
 * `entity_type IN ('series','episode','book','game','project')`ØŒ ÙØµÙÙ‘ Ù…Ø±Ø§Ø¬Ø¹Ø©
 * Ù„Ù‚ØµØ© ÙŠÙØ´Ù„ Ø§Ù„Ù‚ÙŠØ¯. ØªÙˆØ³ÙŠØ¹Ù‡ ÙŠØ­ØªØ§Ø¬ Ù…Ù‡Ø§Ø¬Ø±Ø© ÙˆØ¥Ø¹Ø§Ø¯Ø© Ø¨Ù†Ø§Ø¡ Ø§Ù„Ø¬Ø¯ÙˆÙ„.
 */
export type ReviewEntityType = 'series' | 'episode' | 'story' | 'book' | 'game' | 'project'
export type ReviewerRole = 'edu' | 'lang' | 'sharia' | 'rights' | 'qa'
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'needs_changes'

export interface ContentReviewRecord {
  id: string
  entity_type: ReviewEntityType
  entity_id: string
  reviewer_role: ReviewerRole
  reviewer_id: string | null
  status: ReviewStatus
  comments: string | null
  created_at: string
}

export interface ContentReviewPayload {
  entity_type: ReviewEntityType
  entity_id: string
  reviewer_role: ReviewerRole
  status: ReviewStatus
  comments?: string | null
}

/* ------------------------------------------------ Ø£Ø­Ø¯Ø§Ø« Ø§Ù„Ø¹Ø§Ø¦Ù„Ø© Ø§Ù„ÙØ§Ø´Ù„Ø© (DLQ) */

/// Ù…Ø·Ø§Ø¨Ù‚ Ù„Ù‚ÙŠØ¯ CHECK Ø¹Ù„Ù‰ failed_family_events.status ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0021
export type FailedEventStatus = 'pending' | 'replayed' | 'discarded'

/**
 * Ø­Ø¯Ø« Ø¹Ø§Ø¦Ù„Ø© Ø§Ø³ØªÙ†ÙØ¯ Ù…Ø­Ø§ÙˆÙ„Ø§ØªÙ‡ ÙˆØ³Ù‚Ø· ÙÙŠ Ø§Ù„Ù€DLQ.
 *
 * Ø£Ø¹Ù…Ø¯Ø© Ø§Ù„Ù‡ÙˆÙŠØ© ÙƒÙ„Ù‡Ø§ nullable Ø¹Ù† Ù‚ØµØ¯: Ø±Ø³Ø§Ù„Ø© Ù…Ø´ÙˆÙ‘Ù‡Ø© Ù‡ÙŠ Ø£Ø­Ø¯ Ø£Ø³Ø¨Ø§Ø¨ Ø§Ù„ÙˆØµÙˆÙ„ Ø¥Ù„Ù‰
 * Ø§Ù„Ù€DLQ Ø£ØµÙ„Ù‹Ø§ØŒ ÙÙ„Ø§ Ù‡ÙˆÙŠØ© Ù„Ù‡Ø§. ØªØ³Ø¬ÙŠÙ„ Ø§Ù„ÙØ´Ù„ Ø¨Ø­Ù‚ÙˆÙ„ ÙØ§Ø±ØºØ© Ø£Ù†ÙØ¹ Ù…Ù† Ø¥Ø³Ù‚Ø§Ø· Ø§Ù„ØµÙÙ‘.
 *
 * `payload` Ù‡Ùˆ Ø§Ù„Ø¬Ø³Ù… Ø§Ù„Ø®Ø§Ù… ÙƒÙ…Ø§ ÙˆØµÙ„. Ù‚Ø¯ ÙŠÙƒÙˆÙ† Ø­Ø¯Ø«Ù‹Ø§ ØµØ§Ù„Ø­Ù‹Ø§ØŒ Ø£Ùˆ Ù†Ø§Ø¦Ø¨Ù‹Ø§ ÙŠØ­Ù…Ù„
 * `{ error: 'payload_truncated' | 'payload_not_serializable' }` Ø¹Ù†Ø¯Ù…Ø§ ØªØ¹Ø°Ù‘Ø± Ø­ÙØ¸Ù‡
 * ÙƒØ§Ù…Ù„Ù‹Ø§ â€” ÙˆØ§Ù„Ù†Ø§Ø¦Ø¨ Ù„Ø§ ÙŠÙØ¹Ø§Ø¯ ØªØ´ØºÙŠÙ„Ù‡ Ù„Ø£Ù†Ù‡ Ù„ÙŠØ³ Ø­Ø¯Ø«Ù‹Ø§.
 */
export interface FailedFamilyEventRecord {
  id: string
  event_id: string | null
  event_type: string | null
  parent_id: string | null
  occurred_at_ms: number | null
  payload: string
  attempts: number
  failed_at: string
  status: FailedEventStatus
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
}

/// Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© ØªÙØ¹ÙŠØ¯ `pending` Ù…Ø³ØªÙ‚Ù„Ù‹Ù‘Ø§ Ø¹Ù† `total`: Ø§Ù„Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ø¹Ù„ÙŽÙ‘Ù‚ Ù‡Ùˆ Ù…Ø§ ÙŠØ­ØªØ§Ø¬ ØªØµØ±Ù‘ÙÙ‹Ø§ØŒ
/// Ùˆ`total` ÙŠØ´Ù…Ù„ Ù…Ø§ Ø­ÙÙ„ÙŽÙ‘ Ø³Ù„ÙÙ‹Ø§.
export interface FailedFamilyEventListMeta extends PaginationMeta {
  pending: number
}

export interface FailedFamilyEventListEnvelope extends ApiEnvelope<FailedFamilyEventRecord[]> {
  meta: FailedFamilyEventListMeta
}

export interface FailedEventReplayResult {
  id: string
  replayed: boolean
  event_id: string
  /// ØµØ­ÙŠØ­ Ø¹Ù†Ø¯Ù…Ø§ ÙƒØ§Ù† Ø§Ù„Ø­Ø¯Ø« Ù…ÙØ³Ù‚ÙŽØ·Ù‹Ø§ Ø³Ù„ÙÙ‹Ø§: `processFamilyEvent` ÙŠÙØ­Øµ
  /// processed_family_events ÙÙ„Ø§ ÙŠÙØ·Ø¨ÙŽÙ‘Ù‚ Ø´ÙŠØ¡ Ù…Ø±ØªÙŠÙ†.
  duplicate: boolean
}

/* ------------------------------------------------------- ØªÙˆÙ„ÙŠØ¯ Ø§Ù„Ø³Ø±Ø¯ (TTS) */

/**
 * Ø§Ù„Ù†Ù‚Ù„ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙØ¹Ù„Ù‹Ø§. Ø§Ù„Ø§Ø«Ù†Ø§Ù† ÙŠØµÙ„Ø§Ù† Ø¥Ù„Ù‰ Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„ Ù†ÙØ³Ù‡ Ù„ÙƒÙ† Ø¨Ø§Ø¹ØªÙ…Ø§Ø¯ÙŽÙŠÙ† Ù…Ø®ØªÙ„ÙÙŠÙ†:
 *
 * - `cloud_tts`: Ø­Ø³Ø§Ø¨ Ø®Ø¯Ù…Ø©ØŒ ÙˆÙŠÙØ¹ÙŠØ¯ MP3 Ù…Ø¨Ø§Ø´Ø±Ø©. Ù…ÙÙØ¶ÙŽÙ‘Ù„ Ù„Ø£Ù† Workers Ù„Ø§ ØªÙØ­ÙˆÙ‘Ù„ ØµÙŠØºÙ‹Ø§.
 * - `ai_studio`: Ù…ÙØªØ§Ø­ APIØŒ ÙˆÙŠÙØ¹ÙŠØ¯ PCM Ø®Ø§Ù…Ù‹Ø§ ÙŠÙ„ÙÙ‘Ù‡ Ø§Ù„Ø®Ø§Ø¯Ù… ÙƒÙ€WAV.
 *
 * `null` ÙŠØ¹Ù†ÙŠ Ø£Ù† Ø£ÙŠÙ‹Ù‘Ø§ Ù…Ù†Ù‡Ù…Ø§ ØºÙŠØ± Ù…ÙÙ‡ÙŠÙŽÙ‘Ø£ØŒ ÙØ§Ù„ØªÙˆÙ„ÙŠØ¯ Ù…ØªØ¹Ø°Ù‘Ø±.
 */
export type TtsTransport = 'cloud_tts' | 'ai_studio'

/// Ø§Ù„ØªØ±Ù…ÙŠØ²Ø§Øª Ø§Ù„ØªÙŠ ÙŠÙ‚Ø¨Ù„Ù‡Ø§ Cloud TTS. Ù†Ù‚Ù„ ai_studio ÙŠØªØ¬Ø§Ù‡Ù„Ù‡Ø§ ÙˆÙŠÙØ¹ÙŠØ¯ WAV Ø¯Ø§Ø¦Ù…Ù‹Ø§.
export type TtsEncoding = 'MP3' | 'LINEAR16' | 'OGG_OPUS'

/**
 * Ø­Ø¯ÙˆØ¯ Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯ **Ø¨Ø§Ù„Ø¨Ø§ÙŠØª Ù„Ø§ Ø¨Ø§Ù„Ø­Ø±Ù**.
 *
 * Ø§Ù„ÙØ±Ù‚ Ø¬ÙˆÙ‡Ø±ÙŠ Ù„Ù„Ø¹Ø±Ø¨ÙŠØ©: UTF-8 ÙŠØ±Ù…Ù‘Ø² Ø§Ù„Ø­Ø±Ù Ø§Ù„Ø¹Ø±Ø¨ÙŠ ÙÙŠ Ø¨Ø§ÙŠØªÙŠÙ†ØŒ ÙØ­Ø¯Ù‘ 4000 Ø¨Ø§ÙŠØª Ù‡Ùˆ
 * ~2000 Ø­Ø±Ù. ÙˆGemini-TTS ÙŠÙ‚ØªØ·Ø¹ Ø§Ù„Ø²Ø§Ø¦Ø¯ **Ø¨ØµÙ…Øª**ØŒ ÙØ§Ù„Ø®Ø§Ø¯Ù… ÙŠØ±ÙØ¶ Ø¨Ø¯Ù„ Ø£Ù† ÙŠÙÙ†ØªØ¬ Ø³Ø±Ø¯Ù‹Ø§
 * ÙŠÙ†Ù‚Ø·Ø¹ ÙÙŠ Ù…Ù†ØªØµÙ Ø§Ù„Ø¬Ù…Ù„Ø©.
 */
export interface TtsLimits {
  text_bytes: number
  prompt_bytes: number
  combined_bytes: number
  note_ar: string
}

export interface TtsConfig {
  configured: boolean
  transport: TtsTransport | null
  default_model: string
  /// Ù‚Ø§Ø¦Ù…Ø© Ù…ØºÙ„Ù‚Ø©ØŒ ÙØ§Ù„Ø®Ø·Ø£ Ø§Ù„Ù…Ø·Ø¨Ø¹ÙŠÙ‘ ÙŠØµÙŠØ± 400 Ù„Ø§ Ø®Ø·Ø£ Ù…Ø²ÙˆÙ‘Ø¯ ØºØ§Ù…Ø¶Ù‹Ø§
  voices: string[]
  limits: TtsLimits
  /// ar-EG Ù‡Ùˆ Ø§Ù„ÙˆØ­ÙŠØ¯ GA Ù„Ù€Gemini-TTSØ› ar-001 Ù„Ø§ ÙŠØ²Ø§Ù„ Preview
  recommended_language: string
}

/**
 * Ù†ØªÙŠØ¬Ø© Ù…Ø¹Ø§ÙŠÙ†Ø© Ø§Ù„Ø³Ø±Ø¯.
 *
 * Ø§Ù„Ù…Ø³Ø§Ø± ÙŠÙØ¹ÙŠØ¯ **ØµÙˆØªÙ‹Ø§ Ø®Ø§Ù…Ù‹Ø§ Ù„Ø§ JSON**ØŒ ÙØ§Ù„Ø¹Ù…ÙŠÙ„ ÙŠØ¨Ù†ÙŠ Ù‡Ø°Ø§ Ø§Ù„ÙƒØ§Ø¦Ù† Ù…Ù† Ø§Ù„Ø¬Ø³Ù…
 * ÙˆØªØ±ÙˆÙŠØ³Ø§Øª `X-Tts-*`. Ø§Ù„Ø­Ù‚ÙˆÙ„ Ù…ØµØ¯Ø±Ù‡Ø§ Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø§ Ø§ÙØªØ±Ø§Ø¶ Ø§Ù„Ø¹Ù…ÙŠÙ„: Ù‚Ø¯ ÙŠØ®ØªÙ„Ù Ø§Ù„ØªØ±Ù…ÙŠØ²
 * Ø§Ù„ÙØ¹Ù„ÙŠ Ø¹Ù…Ù‘Ø§ Ø·ÙÙ„Ø¨ Ù„Ø£Ù† Ù†Ù‚Ù„ ai_studio ÙŠÙØ¹ÙŠØ¯ WAV Ø¯Ø§Ø¦Ù…Ù‹Ø§.
 */
export interface TtsPreviewResult {
  /// Ø¹Ù†ÙˆØ§Ù† blob Ù…Ø­Ù„ÙŠÙ‘ ØµØ§Ù„Ø­ Ù„Ø¹Ù†ØµØ± <audio>. ÙŠØ¬Ø¨ ØªØ­Ø±ÙŠØ±Ù‡ Ø¨Ù€revokeObjectURL.
  url: string
  mimeType: string
  bytes: number
  transport: string
  model: string
  voice: string
  /// Ù†ÙØ³ Ø§Ù„Ù€blob Ø§Ù„Ø°ÙŠ Ø¨ÙÙ†ÙŠ Ù…Ù†Ù‡ `url`ØŒ Ù…Ø­ØªÙÙŽØ¸Ù‹Ø§ Ø¨Ù‡ Ù„Ø­ÙØ¸Ù‡ Ù„Ø§Ø­Ù‚Ù‹Ø§ ÙÙŠ Ù…ÙƒØªØ¨Ø©
  /// Ø§Ù„ÙˆØ³Ø§Ø¦Ø· Ø¯ÙˆÙ† ØªÙˆÙ„ÙŠØ¯ Ø¬Ø¯ÙŠØ¯.
  blob: Blob
}

/* ----------------------------------------------------- Ø§Ù„Ø¥ØªÙ‚Ø§Ù† ÙˆØ§Ù„Ù…Ø­Ø§ÙˆÙ„Ø§Øª */

/**
 * Ù…Ø³ØªÙˆÙŠØ§Øª Ø§Ù„Ø¥ØªÙ‚Ø§Ù†ØŒ Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù‚ÙŠØ¯ CHECK Ø¹Ù„Ù‰ `mastery.level` ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0001.
 *
 * `needs_review` Ù„ÙŠØ³ Ù…ÙˆÙ‚Ø¹Ù‹Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø³Ù„Ù‘Ù… Ø¨Ù„ Ø¹Ù„Ø§Ù…Ø© ØªØ±Ø§Ø¬Ø¹ØŒ ÙˆÙ„Ø°Ù„Ùƒ ÙŠØ£ØªÙŠ Ø¢Ø®Ø±Ù‹Ø§ ÙÙŠ
 * Ø§Ù„ØªØ±ØªÙŠØ¨ Ù„Ø§ Ø¨ÙŠÙ† `assisted` Ùˆ`independent`.
 */
export type MasteryLevel =
  | 'not_started'
  | 'introduced'
  | 'practicing'
  | 'assisted'
  | 'independent'
  | 'needs_review'

/**
 * Ù…Ù„Ø®Ù‘Øµ Ø§Ù„Ø¥ØªÙ‚Ø§Ù† Ù„Ù‡Ø¯Ù ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆØ§Ø­Ø¯.
 *
 * ÙŠØ¬ÙŠØ¨ Ø³Ø¤Ø§Ù„ Â«Ø£ÙŠ Ù‡Ø¯Ù ÙŠØªØ¹Ø«Ù‘Ø± ÙÙŠÙ‡ Ø§Ù„Ø£Ø·ÙØ§Ù„Â». `success_rate` ÙŠÙØ­Ø³Ø¨ ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø£Ù†
 * Ø§Ù„Ù‚Ø³Ù…Ø© ØªØ­ØªØ§Ø¬ ÙƒÙ„ Ø§Ù„ØµÙÙˆÙØ› Ø­Ø³Ø§Ø¨Ù‡Ø§ Ø¨Ø¹Ø¯ Ø§Ù„ØªØ±Ù‚ÙŠÙ… ÙŠØ¹Ø·ÙŠ Ù†Ø³Ø¨Ø© Ø§Ù„ØµÙØ­Ø© Ù„Ø§ Ù†Ø³Ø¨Ø© Ø§Ù„Ù‡Ø¯Ù.
 */
export interface MasteryByObjective {
  id: string
  code: string
  title_ar: string
  skill_id: string | null
  skill_name: string | null
  children_count: number
  independent_count: number
  needs_review_count: number
  not_started_count: number
  attempts: number
  correct_attempts: number
  /// `null` Ø¹Ù†Ø¯ ØºÙŠØ§Ø¨ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø§Øª: Â«Ù„Ø§ Ø¨ÙŠØ§Ù†Ø§ØªÂ» Ù„ÙŠØ³Øª Â«Ù†Ø³Ø¨Ø© Ù†Ø¬Ø§Ø­ ØµÙØ±Â»
  success_rate: number | null
  last_attempt_at: string | null
}

/// Ù…Ù„Ø®Ù‘Øµ Ø§Ù„Ø¥ØªÙ‚Ø§Ù† Ù„Ø·ÙÙ„ ÙˆØ§Ø­Ø¯. ÙŠØ¬ÙŠØ¨ Ø³Ø¤Ø§Ù„ Â«Ù…Ù† ÙŠØ­ØªØ§Ø¬ Ù…Ø³Ø§Ø¹Ø¯Ø©Â».
export interface MasteryByChild {
  child_id: string
  /// ÙƒÙÙ†ÙŠØ© Ù„Ø§ Ø§Ø³Ù… Ù‚Ø§Ù†ÙˆÙ†ÙŠ. `adminFamilyProjection` ÙŠÙƒØ´ÙÙ‡Ø§ Ø¨Ø§Ù„ÙØ¹Ù„ Ù„Ù„ÙˆØ­Ø©.
  nickname: string
  age_track: AgeTrack
  parent_id: string
  objectives_count: number
  independent_count: number
  needs_review_count: number
  attempts: number
  correct_attempts: number
  success_rate: number | null
  last_attempt_at: string | null
}

/**
 * Ù…Ø­Ø§ÙˆÙ„Ø© ÙˆØ§Ø­Ø¯Ø© Ù…Ù† Ø¬Ø¯ÙˆÙ„ `attempts`.
 *
 * Ø¹Ù…ÙˆØ¯ `answers` Ù„Ø§ ÙŠÙØ¹Ø§Ø¯ Ù…Ù† Ø§Ù„Ø®Ø§Ø¯Ù… Ø¹Ù† Ù‚ØµØ¯: Ø­Ø¬Ù…Ù‡ ØºÙŠØ± Ù…Ø­Ø¯ÙˆØ¯ ÙˆÙ„Ø§ ÙŠÙÙŠØ¯ Ù„ÙˆØ­Ø©
 * Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø¨Ù‚Ø¯Ø± Ù…Ø§ ÙŠÙˆØ³Ù‘Ø¹ Ø³Ø·Ø­ ØªØ¹Ø±Ù‘Ø¶ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø£Ø·ÙØ§Ù„.
 */
export interface AttemptRecord {
  id: string
  child_id: string
  nickname: string | null
  episode_id: string | null
  game_id: string | null
  game_title: string | null
  episode_title: string | null
  score: number | null
  max_score: number | null
  /// `null` Ø¹Ù†Ø¯Ù…Ø§ Ù„Ø§ ÙŠÙƒÙˆÙ† Ù„Ù„Ø¯Ø±Ø¬Ø© Ø³Ù‚Ù: score Ø¨Ù„Ø§ max_score Ù„Ø§ ÙŠÙ‚Ø¨Ù„ Ù†Ø³Ø¨Ø© Ù…Ø¦ÙˆÙŠØ©
  score_percent: number | null
  time_spent_seconds: number
  help_used: boolean
  created_at: string
}

/// Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø£Ù‡Ø¯Ø§Ù ØªÙØ±ÙÙ‚ Ø§Ù„Ù…Ø³ØªÙˆÙŠØ§Øª Ø§Ù„Ù…ØªØ§Ø­Ø© Ù…Ø¹ Ø§Ù„ØªØ±Ù‚ÙŠÙ…ØŒ ÙÙ„Ø§ ØªÙÙƒØ±ÙŽÙ‘Ø± ÙÙŠ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø©.
export interface MasteryByObjectiveMeta extends PaginationMeta {
  levels: MasteryLevel[]
}

export interface MasteryByObjectiveEnvelope extends ApiEnvelope<MasteryByObjective[]> {
  meta: MasteryByObjectiveMeta
}

/* --------------------------------------------- ÙØ­Øµ Ø§Ù„Ø¬ÙˆØ¯Ø© ÙˆØ§Ù„ØªØµØ¯ÙŠØ± (Ø§Ù„Ù†Ø³Ø®) */

/**
 * Ø§Ù„Ø£Ù†ÙˆØ§Ø¹ Ø§Ù„Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ÙØ­Øµ ÙˆØ§Ù„ØªØµØ¯ÙŠØ±.
 *
 * `story` Ùˆ`book` ÙƒÙŠØ§Ù†Ø§Ù† Ù…Ø®ØªÙ„ÙØ§Ù† Ù„Ø§ Ù…ØªØ±Ø§Ø¯ÙØ§Ù†: `stories` Ù„Ù‡ ØµÙØ­Ø§Øª ÙÙŠ Ø¬Ø¯ÙˆÙ„
 * `story_pages`ØŒ Ùˆ`books` ÙŠØ®Ø²Ù‘Ù† ØµÙØ­Ø§ØªÙ‡ ÙÙŠ Ø¹Ù…ÙˆØ¯ JSON. ÙƒØ§Ù† Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠÙ‚Ø±Ø£ `story`
 * Ù…Ù† Ø¬Ø¯ÙˆÙ„ `books` ÙÙ„Ø§ ÙŠÙ†Ø¬Ø­ Ø§Ù„ÙØ­Øµ Ø¹Ù„Ù‰ Ø£ÙŠ Ù…Ø¯Ø®Ù„ ØµØ­ÙŠØ­.
 */
export type QualityEntityType = 'series' | 'story' | 'book' | 'game' | 'project'

/**
 * Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ù†Ø´Ø± Ø§Ù„Ù…ÙˆØ­Ù‘Ø¯Ø©: `GET /admin/publish-readiness/:type/:id`.
 *
 * ØªØ´Ù…Ù„ `episode` Ø¨Ø®Ù„Ø§Ù `QualityEntityType` Ù„Ø£Ù† Ø¨ÙˆØ§Ø¨Ø© Ø§Ù„Ù†Ø´Ø± ØªÙØ­Øµ Ø§Ù„Ø­Ù„Ù‚Ø© ÙØ¹Ù„ÙŠÙ‹Ø§
 * (ÙÙŠØ¯ÙŠÙˆØŒ Ù…ØµØºÙ‘Ø±Ø©ØŒ ØµÙˆØª Ø¹Ø±Ø¨ÙŠØŒ Ø§Ù„Ø³Ù„Ø³Ù„Ø© Ø§Ù„Ø£Ù…Ù‘)ØŒ Ø¨ÙŠÙ†Ù…Ø§ ÙØ­ÙˆØµ Ø§Ù„Ø¬ÙˆØ¯Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ù„Ø§ ØªØ¹Ø±Ù
 * Ø§Ù„Ø­Ù„Ù‚Ø§Øª Ø¥Ø·Ù„Ø§Ù‚Ù‹Ø§. Ø§Ù„Ù†ÙˆØ¹Ø§Ù† Ù…ÙØµÙˆÙ„Ø§Ù† Ø¹Ù† Ù‚ØµØ¯ ÙÙ„Ø§ ÙŠÙØ¯ÙŽÙ‘Ø¹Ù‰ ÙˆØ¬ÙˆØ¯ ÙØ­Øµ Ø¬ÙˆØ¯Ø© Ù„Ù„Ø­Ù„Ù‚Ø©.
 */
export type PublishableEntityType = 'series' | 'episode' | 'story' | 'book' | 'game' | 'project'

export type PublishGateStatus = 'pass' | 'blocked' | 'warn' | 'not_applicable'
export type PublishGateSeverity = 'blocker' | 'warning' | 'none'
export type PublishGateOwner =
  | 'editor' | 'reviewer' | 'translator' | 'production'
  | 'engineering' | 'rights' | 'legal' | 'publisher' | 'provider'

export interface PublishGateFinding {
  id: string
  label_ar: string
  status: PublishGateStatus
  severity: PublishGateSeverity
  detail: string
  owner?: PublishGateOwner
  required_action?: string
  items?: string[]
}

export interface PublishGateResult {
  entity_type: PublishableEntityType
  entity_id: string
  publishable: boolean
  findings: PublishGateFinding[]
  blockers: PublishGateFinding[]
  warnings: PublishGateFinding[]
}
/// تقرير الأصول التي لا يشير إليها شيء (`CNT-104`).
///
/// `checked_paths` ليست تفصيلًا تقنيًّا: تقريرٌ لا تُرى تغطيته لا يُوثَق به، وغيابُ
/// الرؤية هو كيف صار «مسارَان» وصفًا مقبولًا لثلاثة عشر جدولًا.
export interface UnreferencedAssetsReport {
  total: number
  by_kind: Array<{ kind: string; count: number; bytes: number }>
  assets: Array<{
    id: string; title_ar: string; kind: string; status: string
    size_bytes: number | null; r2_key: string | null; created_at: string | null
  }>
  checked_paths: Array<{ table: string; column: string }>
  include_archived: boolean
  limit: number
}
export type PublishSweepStatus = 'published' | 'ready' | 'scheduled' | 'review'
/// نتيجة مسح البوابة على صفوف بحالةٍ واحدة (`CNT-101`, `CNT-102`).
///
/// `unavailable` ليست تفصيلًا: صفٌّ تعذّر تقييمه ليس صفًّا سليمًا، وعرضه ضمن
/// «لا شيء محجوب» هو خطأ «الصفر مكان المجهول» نفسه في موضع أخطر.
export interface PublishSweepReport {
  status: PublishSweepStatus
  checked: Record<string, number>
  blocked_count: number
  blocked: Array<{
    entity_type: PublishableEntityType
    entity_id: string
    blockers: PublishGateFinding[]
  }>
  /// صفوف تمرّ البوابة وتحمل تحذيرات (`CNT-107`).
  ///
  /// مفصولة عن `blocked` عن قصد: طيُّها فيه يسمّي التحذير رفضًا، وإسقاطها يجعل
  /// التحذير المُتجاهَل غير مرئي. والمثال الذي كشفها: 43 سجلّ مراجعة كلّها معلّقة،
  /// والبوابة تُحذِّر ولا تحجب (بقرارٍ موثَّق)، فكان المنشور بلا اعتماد يظهر نظيفًا.
  warned_count: number
  warned: Array<{
    entity_type: PublishableEntityType
    entity_id: string
    warnings: PublishGateFinding[]
  }>
  unavailable: Array<{ entity_type: PublishableEntityType; error: string }>
  limit: number
}

/// Ø¬Ø³Ù… Ø±ÙØ¶ Ø§Ù„Ù†Ø´Ø± Ø¨Ù€409. Ù†ÙØ³ Ø´ÙƒÙ„ Ù†ØªÙŠØ¬Ø© Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© Ù…Ù†Ù‚ÙˆØµÙ‹Ø§ Ù…Ù† Ø§Ù„ÙØ­ÙˆØµ Ø§Ù„Ù†Ø§Ø¬Ø­Ø©.
export interface PublishRefusal {
  entity_type: PublishableEntityType
  entity_id: string
  publishable: false
  blockers: PublishGateFinding[]
  warnings: PublishGateFinding[]
}

// --- Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø¥ØªØ§Ø­Ø© Ø§Ù„Ø¬ØºØ±Ø§ÙÙŠØ© ------------------------------------------------

export type AvailabilityMode = 'worldwide' | 'worldwide_except' | 'selected_only' | 'unavailable'
export type AvailabilityReason = 'rights' | 'commercial' | 'editorial' | 'legal'
export type AvailabilityScope =
  | 'global' | 'planet' | 'series' | 'season' | 'episode' | 'story' | 'book' | 'game' | 'project'

export interface AvailabilityPolicy {
  entity_type: AvailabilityScope
  entity_id: string
  mode: AvailabilityMode
  countries: string[]
  languages: string[]
  platforms: string[]
  starts_at: string | null
  ends_at: string | null
  reason: AvailabilityReason
  note: string | null
}

export type AvailabilityCode =
  | 'available' | 'unavailable' | 'country_excluded' | 'country_not_selected'
  | 'country_unknown' | 'window_not_started' | 'window_ended'
  | 'language_excluded' | 'platform_excluded'

export interface AvailabilityDecision {
  available: boolean
  code: AvailabilityCode
  /// explicit â‡’ Ù…ÙÙ„ØºØ§Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù†ØµØ± Â· inherited â‡’ Ù…ÙˆØ±ÙˆØ«Ø© Â· default â‡’ Ù„Ø§ Ø³ÙŠØ§Ø³Ø©
  source: 'explicit' | 'inherited' | 'default'
  policy: AvailabilityPolicy | null
  inherited_from: { entity_type: AvailabilityScope; entity_id: string } | null
  reason: AvailabilityReason | null
  message_ar: string
}

export interface AvailabilityChainEntry {
  entity_type: AvailabilityScope
  entity_id: string
  policy: AvailabilityPolicy | null
}

export interface AvailabilityView {
  entity_type: AvailabilityScope
  entity_id: string
  own_policy: AvailabilityPolicy | null
  chain: AvailabilityChainEntry[]
  evaluated_for: { country: string | null; platform: string | null; now: string }
  decision: AvailabilityDecision
}

export interface AvailabilityListRow extends AvailabilityPolicy {
  id: string
  entity_title: string | null
  updated_at: string
}

// --- Ù…Ø­Ø±Ùƒ Ø³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„ ---------------------------------------------------------

export type WorkflowStageStatus =
  | 'pending' | 'in_progress' | 'approved' | 'rejected' | 'changes_requested' | 'skipped'
export type WorkflowDecision = 'approved' | 'rejected' | 'changes_requested' | 'skipped'

export interface WorkflowStageDefinition {
  stage_key: string
  name_ar: string
  sort_order: number
  required_role: string | null
  required_permission: string | null
  sla_hours: number | null
  escalate_after_hours: number | null
  blocks_publish: boolean
  depends_on: string[]
  instructions_ar: string | null
}

export interface WorkflowTemplate {
  id: string
  name_ar: string
  content_type: string
  stages: WorkflowStageDefinition[]
}

export interface WorkflowRunStageState {
  stage_key: string
  status: WorkflowStageStatus
  assignee_id: string | null
  assignee_team_id: string | null
  due_at: string | null
  started_at: string | null
  completed_at: string | null
  decided_by: string | null
  decision_comment: string | null
  skip_reason: string | null
}

export interface WorkflowStageView extends WorkflowStageDefinition {
  run_stage: WorkflowRunStageState | null
  unmet_dependencies: string[]
  /// Ù…Ø­Ø³ÙˆØ¨Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù… Ø¨Ù†ÙØ³ Ø¯Ø§Ù„Ø© Ø§Ù„ÙØ±Ø¶ØŒ ÙØ§Ù„Ø²Ø± Ø§Ù„Ù…Ø¹Ø·ÙŽÙ‘Ù„ ÙŠØ·Ø§Ø¨Ù‚ Ù…Ø§ Ø³ÙŠØ±ÙØ¶Ù‡ Ø§Ù„Ø®Ø§Ø¯Ù….
  can_decide: boolean
  refusal_reason: string | null
}

export interface WorkflowHistoryEntry {
  id: string
  step: string
  decision: string
  comment: string | null
  created_at: string
  reviewer_id: string | null
  reviewer_name: string | null
}

export interface WorkflowOverdueStage {
  stage_key: string
  name_ar: string | null
  due_at: string
  hours_late: number
  escalated: boolean
  assignee_id: string | null
  assignee_team_id: string | null
}

export interface WorkflowRunDetail {
  run: {
    id: string
    content_type: string
    content_id: string
    template_id: string | null
    current_step: string
    status: string
    created_at: string
    updated_at: string
  }
  stages: WorkflowStageView[]
  actionable: string[]
  overdue: WorkflowOverdueStage[]
  implied_status: 'running' | 'approved' | 'rejected'
  history: WorkflowHistoryEntry[]
}

export interface WorkflowOverdueRow {
  run_id: string
  content_type: string
  content_id: string
  stage_key: string
  status: WorkflowStageStatus
  due_at: string | null
  name_ar: string | null
  hours_late: number
  escalated: boolean
  assignee_id: string | null
  assignee_team_id: string | null
}

export interface WorkflowMyStage {
  run_id: string
  content_type: string
  content_id: string
  stage_key: string
  status: WorkflowStageStatus
  due_at: string | null
  name_ar: string | null
  blocks_publish: number
}

/**
 * Ù‚Ø±Ø§Ø¡Ø© Ø­ÙŠÙ‘Ø© Ù„Ø£Ø¬Ù‡Ø²Ø© Ø¹Ø§Ø¦Ù„Ø© Ù…Ù† FamilyState Ù„Ø§ Ù…Ù† Ø¥Ø³Ù‚Ø§Ø· D1.
 *
 * Ø§Ù„ÙØ±Ù‚ Ù„ÙŠØ³ ØªØ¬Ù…ÙŠÙ„ÙŠÙ‹Ø§: Ø§Ù„Ø¥Ø³Ù‚Ø§Ø· ÙŠØªØºØ°Ù‘Ù‰ Ù…Ù† Ø·Ø§Ø¨ÙˆØ± ÙÙ‡Ùˆ Ù…ØªØ£Ø®Ù‘Ø± Ø¨Ø·Ø¨ÙŠØ¹ØªÙ‡ØŒ ÙˆÙ…Ø­Ø§Ø¯Ø«Ø© Ø§Ù„Ø¯Ø¹Ù…
 * ØªØ¬Ø±ÙŠ ÙÙŠ Ø§Ù„Ø­Ø§Ø¶Ø±. `revoke_available` ØªØ¨Ù‚Ù‰ false Ù„Ø£Ù† `POST /devices/revoke` ÙÙŠ
 * Ø§Ù„Ù€DO ÙŠØªØ­Ù‚Ù‘Ù‚ Ù…Ù† Ø¬Ù„Ø³Ø© ÙˆØ§Ù„Ù ÙØ¹Ù„ÙŠÙ‹Ø§ØŒ ÙÙ„Ø§ Ù…Ø³Ø§Ø± Ø¥Ø¯Ø§Ø±ÙŠ Ù„Ù‡ â€” ÙˆØ§Ù„Ø¥Ø¹Ù„Ø§Ù† Ø¹Ù† Ø°Ù„Ùƒ ÙÙŠ
 * Ø§Ù„Ø¬Ø³Ù… ÙŠÙ…Ù†Ø¹ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ù…Ù† ØªÙ‚Ø¯ÙŠÙ… Ù‚Ø±Ø§Ø¡Ø© Ø­ÙŠÙ‘Ø© ÙˆØ³Ø­Ø¨Ù‹Ø§ ÙƒØ£Ù†Ù‡Ù…Ø§ Ù…ØªØ§Ø­Ø§Ù† Ù…Ø¹Ù‹Ø§.
 */
export interface SupportLiveDevice {
  id: string
  display_name: string | null
  platform: string | null
  status: string
  registered_at: number | null
  last_seen_at: number | null
}

export interface SupportLiveDevices {
  devices: SupportLiveDevice[]
  source: string
  authority: string
  revoke_available: boolean
}

// --- ØªØ°Ø§ÙƒØ± Ø§Ù„Ø¯Ø¹Ù… -------------------------------------------------------------

export type TicketCategory =
  | 'billing' | 'subscription' | 'playback' | 'downloads' | 'account'
  | 'device' | 'child_profile' | 'content' | 'privacy' | 'bug' | 'other'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
export type TicketAction =
  | 'entitlement_resync' | 'subscription_resync' | 'restore_purchase'
  | 'device_revoke' | 'pin_reset' | 'account_recovery' | 'manual_note'

/// Ø­Ø§Ù„Ø© SLA Ù…Ø­Ø³ÙˆØ¨Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù…: Ø³Ø§Ø¹ØªØ§Ù† Ù…Ù†ÙØµÙ„ØªØ§Ù† (Ø£ÙˆÙ„ Ø±Ø¯Ù‘ØŒ Ø§Ù„Ø­Ù„Ù‘) ÙˆØ³Ø¨Ø¨Ù‡Ø§ Ù†ØµÙ‹Ù‘Ø§.
export interface TicketSlaState {
  first_response_breached: boolean
  resolution_breached: boolean
  resolution_minutes_late: number
  paused: boolean
  reason: string
}

export interface SupportTicket {
  id: string
  reference: string
  subject: string
  body: string | null
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  family_id: string | null
  subscription_ref: string | null
  purchase_ref: string | null
  device_id: string | null
  assignee_id: string | null
  assignee_name?: string | null
  team_id: string | null
  first_response_due_at: string | null
  resolution_due_at: string | null
  first_response_at: string | null
  resolved_at: string | null
  closed_at: string | null
  escalated_at: string | null
  escalation_reason: string | null
  created_at: string
  updated_at: string
  tags: string[]
  sla: TicketSlaState
}

export interface SupportTicketEvent {
  id: string
  kind: 'note' | 'status_change' | 'assignment' | 'priority_change' | 'escalation' | 'action' | 'link'
  body: string | null
  metadata_json: string
  actor_id: string | null
  actor_name: string | null
  is_internal: number
  created_at: string
}

export interface SupportTicketDetail {
  ticket: SupportTicket
  timeline: SupportTicketEvent[]
  /// Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„ØªÙŠ ÙŠÙ…ÙƒÙ† Ù„Ù„Ù…Ù†ØµÙ‘Ø© ØªÙ†ÙÙŠØ°Ù‡Ø§ ÙØ¹Ù„Ù‹Ø§ Ø§Ù„ÙŠÙˆÙ….
  supported_actions: TicketAction[]
  /// ÙˆØ³Ø¨Ø¨Ù ØªØ¹Ø°Ù‘Ø± ÙƒÙ„ Ø¥Ø¬Ø±Ø§Ø¡ ØºÙŠØ± Ù…ØªØ§Ø­ØŒ Ù†ØµÙ‹Ù‘Ø§ ÙŠÙ‚Ø±Ø£Ù‡ Ø§Ù„Ù…Ø´ØºÙ‘Ù„.
  unavailable_actions: Record<string, string>
}

export interface SupportSlaOverview {
  policies: Array<{
    id: string
    category: string
    priority: TicketPriority
    first_response_minutes: number
    resolution_minutes: number
    updated_at: string
  }>
  open_breaches: { first_response: number; resolution: number }
  /// Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø§Ù†ØªÙ‚Ø§Ù„Ø§Øª Ø§Ù„Ù…Ø³Ù…ÙˆØ­Ø©ØŒ Ù…Ù† `lib/supportCrm.ts` ÙÙŠ Ø§Ù„Ø®Ø§Ø¯Ù….
  ///
  /// ÙŠØ£ØªÙŠ Ù…Ù† Ø§Ù„Ø®Ø§Ø¯Ù… Ù„Ø§ ÙŠÙÙƒØªØ¨ ÙÙŠ Ø§Ù„Ø¹Ù…ÙŠÙ„: Ù„ÙˆØ­Ø© Ø§Ù„ÙƒØ§Ù†Ø¨Ø§Ù† ØªØ­ØªØ§Ø¬ Ù…Ø¹Ø±ÙØ© Ø§Ù„Ø£Ø¹Ù…Ø¯Ø©
  /// Ø§Ù„Ù…Ø³Ù…ÙˆØ­Ø© Ù‚Ø¨Ù„ Ø¨Ø¯Ø¡ Ø§Ù„Ø³Ø­Ø¨ØŒ ÙˆÙ†Ø³Ø®Ø© ÙÙŠ Ø§Ù„Ø¹Ù…ÙŠÙ„ ÙƒØ§Ù†Øª Ø³ØªØµÙŠØ± ØªØ¹Ø±ÙŠÙÙ‹Ø§ Ø«Ø§Ù†ÙŠÙ‹Ø§ Ù„Ø³ÙŠØ±
  /// Ø§Ù„Ø¹Ù…Ù„ ÙŠÙ†Ø­Ø±Ù Ø¹Ù† Ø§Ù„Ø£ÙˆÙ„ Ø¹Ù†Ø¯ Ø¥Ø¶Ø§ÙØ© Ø£ÙŠ Ø­Ø§Ù„Ø©.
  transitions?: Record<TicketStatus, TicketStatus[]>
  statuses?: TicketStatus[]
}

export interface SupportSavedView {
  id: string
  owner_id: string | null
  name: string
  filters_json: string
  is_shared: number
  created_at: string
}

// --- Ù…Ø±ÙƒØ² Ø§Ù„Ø¥Ù†ØªØ§Ø¬ ------------------------------------------------------------

export type ProductionRequirementKey =
  | 'script' | 'educational' | 'translation_ar' | 'translation_en' | 'translation_fr'
  | 'voice_ar' | 'voice_en' | 'voice_fr' | 'artwork' | 'video' | 'thumbnail'
  | 'captions' | 'qa' | 'publish'

export type RequirementState =
  | 'ready' | 'partial' | 'in_progress' | 'missing' | 'blocked' | 'not_applicable'

/**
 * ØµÙÙ‘ Ù…ØªØ·Ù„Ø¨ ÙˆØ§Ø­Ø¯.
 *
 * Ø§Ù„Ø­Ø§Ù„Ø© Ù…Ø´ØªÙ‚Ù‘Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù… Ù…Ù† Ø§Ù„Ø£ØµÙˆÙ„ Ù†ÙØ³Ù‡Ø§ ÙˆÙ„Ø§ ØªÙÙƒØªØ¨ Ù…Ù† Ø§Ù„ÙˆØ§Ø¬Ù‡Ø©: Ù„Ø§ Ø­Ù‚Ù„ Ø­Ø§Ù„Ø© ÙÙŠ
 * Ø£ÙŠ Ù…Ø³Ø§Ø±. Ù…Ø§ ÙŠÙÙƒØªØ¨ Ù‡Ùˆ Ø§Ù„Ø·Ø¨Ù‚Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ© ÙÙ‚Ø· (Ù…Ø³Ø¤ÙˆÙ„ØŒ ÙØ±ÙŠÙ‚ØŒ Ø§Ø³ØªØ­Ù‚Ø§Ù‚ØŒ Ø¹Ø§Ø¦Ù‚ØŒ Ù…Ù„Ø§Ø­Ø¸Ø©).
 */
export interface ProductionRequirementRow {
  key: ProductionRequirementKey
  label_ar: string
  state: RequirementState
  /// Ù†Ø³Ø¨Ø© Ø­Ù‚ÙŠÙ‚ÙŠØ© ÙÙ‚Ø· Ø­ÙŠÙ† ÙŠÙˆØ¬Ø¯ Ù…Ù‚Ø§Ù… (ØµÙØ­Ø§Øª Ø§Ù„Ù‚ØµØ© Ù…Ø«Ù„Ù‹Ø§)ØŒ ÙˆØ¥Ù„Ø§ null.
  percent: number | null
  detail: string
  owner_role: string
  items: string[]
  depends_on: ProductionRequirementKey[]
  assignee_id: string | null
  team_id: string | null
  due_at: string | null
  blocker: string | null
  note: string | null
}

export interface ProductionSummary {
  total: number
  ready: number
  partial: number
  in_progress: number
  missing: number
  blocked: number
  not_applicable: number
  percent: number
  publish_state: RequirementState
}

export interface ProductionItem {
  content_type: 'episode' | 'story'
  content_id: string
  title: string
  status: string
  requirements: ProductionRequirementRow[]
  summary: ProductionSummary
}

export interface ProductionQueueRow {
  content_type: 'episode' | 'story'
  content_id: string
  requirement: ProductionRequirementKey
  due_at: string | null
  blocker: string | null
  note: string | null
  title: string | null
  content_status: string | null
}

// --- Content factory ---------------------------------------------------------

/**
 * Ø­Ø§Ù„Ø© ØªØ´ØºÙŠÙ„ Ù…ØµÙ†Ø¹ Ø§Ù„Ù…Ø­ØªÙˆÙ‰. Ù‡Ø°Ù‡ Ø¯ÙˆØ±Ø© ØªØ´ØºÙŠÙ„ ÙˆÙ„ÙŠØ³Øª Ø­Ø§Ù„Ø© Ù†Ø´Ø± Ø§Ù„Ù…Ø­ØªÙˆÙ‰ØŒ Ù„Ø°Ù„Ùƒ Ù„Ø§
 * ØªØ³ØªØ®Ø¯Ù… ContentStatus ÙˆÙ„Ø§ StatusBadge Ø§Ù„Ø®Ø§Øµ Ø¨Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬.
 */
export type ContentFactoryRunState =
  | 'planned'
  | 'blocked'
  | 'awaiting_spend_approval'
  | 'approved'
  | 'queued'
  | 'running'
  | 'paused'
  | 'awaiting_qc'
  | 'awaiting_human_review'
  | 'partially_failed'
  | 'failed'
  | 'completed'
  | 'cancelled'

export type ContentFactoryEntityType = 'episode' | 'story' | 'story_page'
export type ContentFactoryJobKind = 'video' | 'image' | 'narration' | 'package'

export interface ContentFactoryRun {
  id: string
  manifest_id: string
  revision: number
  entity_type: ContentFactoryEntityType
  entity_id: string
  planet_slug: string
  series_slug: string
  pipeline_profile: string
  source_sha256: string
  plan_sha256: string
  inventory_sha256: string | null
  state: ContentFactoryRunState
  blocker_count: number
  unpriced_job_count: number
  estimate_low_credits: number
  estimate_high_credits: number
  estimate_with_contingency_credits: number
  approved_ceiling_credits: number | null
  spend_approval_sha256: string | null
  created_by: string
  approved_by: string | null
  approved_at: string | null
  dispatched_by: string | null
  dispatched_at: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
}

export interface ContentFactoryListMeta extends PaginationMeta {
  by_state: Partial<Record<ContentFactoryRunState, number>>
}

export interface ContentFactoryListEnvelope extends ApiEnvelope<ContentFactoryRun[]> {
  meta: ContentFactoryListMeta
}

export interface ContentFactoryManifestJob {
  job_id: string
  kind: ContentFactoryJobKind
  provider: string
  operation: string
  state: 'planned'
  idempotency_key: string
  dependencies: string[]
  duration_seconds?: number
  count?: number
  page_index?: number
  input: Record<string, unknown>
  cost: {
    pricing_status: 'priced' | 'unpriced' | 'excluded'
    pricing_key: string | null
    low_credits: number
    high_credits: number
    basis: string
  }
}

export interface ContentFactoryQualityGate {
  gate_id: string
  required: boolean
  status: 'not_run' | 'not_applicable' | 'passed' | 'warning' | 'failed' | 'pending' | 'approved' | 'rejected'
}

export type ContentFactoryVisualReferenceKind =
  | 'character_sheet'
  | 'world_sheet'
  | 'prop_sheet'
  | 'style_frame'
  | 'visual_guide'

export interface ContentFactoryVisualIdentityReference {
  kind: ContentFactoryVisualReferenceKind
  path: string
  sha256: string
}

export interface ContentFactoryVisualIdentity {
  identity_id: string
  version: string
  series_slug: string
  status: 'approved'
  reference_pack_sha256: string
  references: ContentFactoryVisualIdentityReference[]
  approved_by: string
  approved_at: string
}

/** Ø§Ù„Ø®Ø·Ø© Ø§Ù„Ø«Ø§Ø¨ØªØ© ÙÙ‚Ø·Ø› Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø§Øª ÙˆØ§Ù„Ù…ÙØ§ØªÙŠØ­ ÙˆÙ†ØªØ§Ø¦Ø¬ Ø§Ù„Ù…Ø²ÙˆØ¯ Ù„ÙŠØ³Øª Ø¬Ø²Ø¡Ù‹Ø§ Ù…Ù†Ù‡Ø§. */
export interface ContentFactoryManifest {
  schema_version: 'content-factory.production-manifest/v1'
  manifest_id: string
  revision: number
  entity: {
    entity_type: ContentFactoryEntityType
    entity_id: string
    planet_slug: string
    series_slug: string
    locale: string
    title?: string
    [key: string]: unknown
  }
  visual_identity: ContentFactoryVisualIdentity | null
  source: {
    path: string
    sha256: string
    content_status: string
    duration_seconds: number | null
    page_count: number | null
    reviews: Array<Record<string, unknown>>
  }
  pipeline: {
    profile: string
    eligibility: 'ready' | 'plannable' | 'blocked' | 'excluded'
    exclusion_code: string | null
    notes?: string
  }
  preflight: {
    manifest_ready: boolean
    scene_plan_ready: boolean
    prompt_plan_ready: boolean
  }
  jobs: ContentFactoryManifestJob[]
  budget: {
    unit: 'credits'
    pricing_version: string
    estimate_low_credits: number
    estimate_high_credits: number
    contingency_pct: number
    contingency_credits: number
    estimate_with_contingency_credits: number
    requested_ceiling_credits: number | null
    unpriced_job_ids: string[]
  }
  quality: {
    policy_version: string
    automated_gates: ContentFactoryQualityGate[]
    human_gates: ContentFactoryQualityGate[]
  }
  blockers: Array<{ code: string; severity: string; message: string; [key: string]: unknown }>
  integrity: { source_sha256: string; plan_sha256: string }
  spend_approval: null | Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ContentFactoryJob {
  id: string
  job_id: string
  kind: ContentFactoryJobKind
  provider: string
  operation: string
  idempotency_key: string
  dependencies: string[]
  duration_seconds: number | null
  count: number | null
  page_index: number | null
  state: string
  estimate_low_credits: number
  estimate_high_credits: number
  reserved_credits: number
  current_attempt_id: string | null
  created_at: string
  updated_at: string
}

export interface ContentFactoryAttempt {
  id: string
  factory_job_id: string
  sequence: number
  state: string
  provider_job_id: string | null
  provider_model: string | null
  provider_declared_gross_credits: number | null
  refund_status: string
  refund_confirmed_credits: number
  asset_sha256: string | null
  automated_qc_sha256: string | null
  human_review_sha256: string | null
  submission_outcome: string | null
  error_code: string | null
  is_current: number
  submitted_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  private_asset_stored: number
}

export interface ContentFactoryCostEntry {
  id: string
  factory_job_id: string
  attempt_id: string | null
  entry_type: string
  amount_credits: number
  source_ref: string | null
  notes: string | null
  created_by: string
  created_at: string
}

export interface ContentFactoryQcEvidence {
  id: string
  factory_job_id: string
  attempt_id: string
  gate_id: string
  status: string
  plan_sha256: string
  asset_sha256: string
  evidence_sha256: string
  created_at: string
}

export interface ContentFactoryHumanReview {
  id: string
  factory_job_id: string
  attempt_id: string
  gate_id: string
  decision: string
  reviewer_id: string
  plan_sha256: string
  asset_sha256: string
  automated_qc_sha256: string
  review_sha256: string
  notes: string | null
  reviewed_at: string
}

export interface ContentFactoryExposure {
  provider_declared_gross_credits: number
  refunds_confirmed_credits: number
  active_reservations_credits: number
  total_exposure_credits: number
  refund_unknown: boolean
}

export interface ContentFactoryDetail {
  run: ContentFactoryRun
  manifest: ContentFactoryManifest
  jobs: ContentFactoryJob[]
  attempts: ContentFactoryAttempt[]
  cost_ledger: ContentFactoryCostEntry[]
  exposure: ContentFactoryExposure
  qc_evidence: ContentFactoryQcEvidence[]
  human_reviews: ContentFactoryHumanReview[]
}

export interface ContentFactoryAutomatedQcResultInput {
  gate_id: string
  status: 'passed' | 'warning' | 'failed' | 'not_applicable'
  message?: string
  evidence: Record<string, unknown>
}

export interface ContentFactoryQcActionResult {
  run_id: string
  job_id: string
  attempt_id: string
  state: string
  required_passed: boolean
  automated_qc_sha256: string
}

export interface ContentFactoryHumanReviewActionResult {
  run_id: string
  job_id: string
  attempt_id: string
  gate_id: string
  decision: 'approved' | 'rejected'
  state: string
  review_sha256: string
  human_reviews_sha256: string | null
}

export interface ContentFactoryQueueResult {
  run_id: string
  queued_jobs: number
  mode?: 'existing_attempts_only'
  replacement_jobs?: number
  failed_only?: boolean
}

// --- Customer 360 ------------------------------------------------------------

/// Ù‚Ø³Ù… ØªØ¹Ø°Ù‘Ø± ØªØ­Ù…ÙŠÙ„Ù‡. ÙŠÙØ¹Ø±Ø¶ Ø¨Ø³Ø¨Ø¨Ù‡ Ù„Ø§ ÙƒÙ‚Ø³Ù… ÙØ§Ø±Øº: Â«ØªØ¹Ø°Ù‘Ø± Ø§Ù„ÙˆØµÙˆÙ„Â» ÙˆÂ«Ù„Ø§ Ø¨ÙŠØ§Ù†Ø§ØªÂ»
/// Ø¬ÙˆØ§Ø¨Ø§Ù† Ù…Ø®ØªÙ„ÙØ§Ù†ØŒ ÙˆØ£Ø­Ø¯Ù‡Ù…Ø§ ÙÙ‚Ø· ÙŠØ¹Ù†ÙŠ Ø£Ù† Ø§Ù„Ø¹Ø§Ø¦Ù„Ø© Ù„Ø§ ØªØ³ØªØ·ÙŠØ¹ Ø§Ù„Ø¯Ø®ÙˆÙ„.
export interface UnavailableSection {
  available: false
  source: string
  reason: string
}

export interface FamilyAuthorityState {
  available?: true
  source?: string
  parent_id: string
  status: string
  base_plan: string
  effective_plan: string
  auth_epoch: number
  entitlements: Array<{ plan: string; status: string; source: string; expires_at: number | null; updated_at: number }>
  devices: Array<{
    id: string; display_name: string | null; platform: string; status: string
    registered_at: number; last_seen_at: number
  }>
  active_leases: number
  active_sessions: number
  child_count: number
  active_child_count: number
  progress_records: number
}

export interface CustomerListRow {
  parent_id: string
  plan: string
  status: string
  child_count: number
  /// `DB-102`: قابل للعدم. `account_devices` في D1 بلا كاتب والسلطة في
  /// `FamilyState` لكل أسرة، فلا عدّ مُجمَّع عبر الأسر — و`null` تعني «غير
  /// متوفّر» لا «صفر جهاز».
  device_count: number | null
  open_tickets: number
}

export interface Customer360 {
  family: { parent_id: string; plan: string; status: string }
  authority: FamilyAuthorityState | UnavailableSection
  children: Array<{
    child_id: string; nickname: string | null; age_track: string | null
    status: string; last_event_at_ms: number
  }>
  /// `DB-102`: صار **غير متوفّر دائمًا**. `account_devices` في D1 ميت
  /// (`0010_cleanup_dead_d1_tables.sql`) وبلا كاتب، فكانت القائمة فارغة أبدًا
  /// وتُقرأ «لا أجهزة». الأجهزة الحقيقية في `authority.devices`.
  devices_projection: UnavailableSection
  billing: Array<{
    product_id: string; plan: string; entitlement_status: string
    expires_at_ms: number | null; created_at: string
  }>
  /// `DB-102`: `google_play_purchases` بلا كاتب — مسار الشراء نفسه غير موصول
  /// (`API-104`). الفراغ كان يُقرأ «لا شراءات» وسببه «لا كاتب».
  purchases: UnavailableSection
  tickets: Array<{
    id: string; reference: string; subject: string; category: string; priority: string
    status: string; assignee_id: string | null; first_response_at: string | null
    resolution_due_at: string | null; created_at: string
  }>
  audit: Array<{ action: string; entity_type: string; entity_id: string; actor_id: string; created_at: string }>
  /// PRIV-102: أثر عمليات مسار الأسرة نفسها — الجلسات والأجهزة ومنح التشغيل
  /// ودورة حياة الحساب. منفصل عن `audit` (سجل أفعال المسؤولين) لأن الفاعل
  /// مختلف: `actor_kind` يقول من فعل، ووليّ الأمر ليس مسؤولًا.
  family_audit: Array<{
    action: string; actor_kind: 'parent' | 'operator' | 'system'; actor_id: string | null
    entity_type: string; entity_id: string | null; details: string; occurred_at_ms: number
  }>
  consents: unknown[] | UnavailableSection
  progress_summary: { records: number } | { available: false; reason: string }
}

/// ÙØ­Øµ ÙˆØ§Ø­Ø¯. `message` Ø¬Ø§Ù‡Ø²Ø© Ù„Ù„Ø¹Ø±Ø¶ Ø¨Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© Ù…Ù† Ø§Ù„Ø®Ø§Ø¯Ù…ØŒ ÙˆØªØ­Ù…Ù„ Ø§Ù„Ø³Ø¨Ø¨ Ù„Ø§ Ø§Ù„Ø­ÙƒÙ… ÙÙ‚Ø·.
export interface QualityCheck {
  check: string
  passed: boolean
  message: string
}

/**
 * Ù†ØªÙŠØ¬Ø© ÙØ­Øµ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ©.
 *
 * `readyToPublish` Ù…Ø¨Ù†ÙŠÙ‘ Ø¹Ù„Ù‰ Ø¨ÙˆØ§Ø¨Ø§Øª Ø§Ù„Ù†Ø´Ø± Ù†ÙØ³Ù‡Ø§ Ø§Ù„ØªÙŠ ÙŠÙØ±Ø¶Ù‡Ø§
 * `PATCH /stories/:id` â€” Ù„Ø§ Ø¹Ù„Ù‰ Ù‚ÙˆØ§Ø¹Ø¯ Ù…ÙˆØ§Ø²ÙŠØ©. Ù†Ø³Ø®ØªØ§Ù† Ù…Ù† Â«Ù‡Ù„ Ù‡Ø°Ø§ Ø¬Ø§Ù‡Ø²Â» ØªØªØ¨Ø§Ø¹Ø¯Ø§Ù†ØŒ
 * ÙØªÙØ¹Ø·ÙŠ Ø§Ù„Ø£Ø¶Ø¹Ù Ø¥Ø°Ù†Ù‹Ø§ ØªØ±ÙØ¶Ù‡ Ø§Ù„Ø£Ø®Ø±Ù‰ Ø¨Ù€409 Ø¹Ù†Ø¯ Ø§Ù„Ù†Ø´Ø± Ø§Ù„ÙØ¹Ù„ÙŠ.
 */
export interface QualityReport {
  entity_type: QualityEntityType
  entity_id: string
  checks: QualityCheck[]
  allPassed: boolean
  readyToPublish: boolean
}

/// Ù…Ù„Ù Ø§Ù„Ù†Ø³Ø®Ø© Ø§Ù„Ù…ÙØµØ¯ÙŽÙ‘Ø±Ø©. Ø§Ù„Ø­Ù‚ÙˆÙ„ ØªØªØ¨Ø¹ Ø¬Ø¯ÙˆÙ„ Ø§Ù„ÙƒÙŠØ§Ù†ØŒ ÙØªÙÙ‚Ø±Ø£ ÙƒØ³Ø¬Ù„ Ù…ÙØªÙˆØ­.
export interface BackupExport extends Record<string, unknown> {
  entity_type: QualityEntityType
  exported_at: string
  version: number
}


// --- Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø¹Ø§Ù… ÙˆØ§Ù„Ù…Ø¯ÙˆÙ‘Ù†Ø© Ùˆ SEO ---------------------------------------

/**
 * Ù„ØºØ§Øª Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø¹Ø§Ù…. Ø«Ù„Ø§Ø« Ù„ØºØ§ØªØŒ ÙˆØ§Ù„Ø¹Ø±Ø¨ÙŠØ© Ù‡ÙŠ Ø§Ù„Ø£ØµÙ„ ÙˆÙ…Ù†Ù‡Ø§ `x-default`.
 *
 * Ø§Ù„Ø§ØªØ¬Ø§Ù‡ Ù…Ø´ØªÙ‚Ù‘ Ù„Ø§ Ù…ÙØ®Ø²ÙŽÙ‘Ù†: `dir` Ù‚ÙŠÙ…Ø© ÙˆØ§Ø­Ø¯Ø© Ù„ÙƒÙ„ Ù„ØºØ©ØŒ ÙˆØªØ®Ø²ÙŠÙ†Ù‡Ø§ ÙÙŠ Ø§Ù„ØµÙÙˆÙ ÙŠØ³Ù…Ø­
 * Ø¨ØµÙØ­Ø© Ø¹Ø±Ø¨ÙŠØ© Ù…ÙˆØ³ÙˆÙ…Ø© `ltr` â€” ÙˆÙ‡ÙŠ Ø­Ø§Ù„Ø© Ù„Ø§ Ù…Ø¹Ù†Ù‰ Ù„Ù‡Ø§ ÙˆÙ„Ø§ ÙˆØ³ÙŠÙ„Ø© Ù„ØªØµØ­ÙŠØ­Ù‡Ø§ Ø¨Ø¹Ø¯ Ø§Ù„Ø­ÙØ¸.
 */
export type CmsLanguage = 'ar' | 'en' | 'fr'
export type CmsStatus = 'draft' | 'review' | 'scheduled' | 'published' | 'archived'

export type WebSectionType =
  | 'hero' | 'rich_text' | 'feature_grid' | 'media' | 'cta' | 'faq' | 'plans'
  | 'content_rail' | 'testimonials' | 'steps' | 'stats' | 'partners' | 'legal_text'

export interface CmsBlocker {
  id: string
  detail: string
  severity: 'blocker' | 'warning'
}

export interface WebPageListRow {
  id: string
  page_key: string
  language: CmsLanguage
  path: string
  slug: string
  title: string
  status: CmsStatus
  scheduled_at: string | null
  published_at: string | null
  kind: string
  is_indexable: number
  translation_group: string
  updated_at: string
  active_sections: number
  language_variants: number
  has_seo: number
}

/// Ù‚Ø³Ù… ØµÙØ­Ø© ÙƒÙ…Ø§ ÙŠØ¹ÙŠØ¯Ù‡ Ø§Ù„Ø®Ø§Ø¯Ù…: Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ùˆ CTA Ù†ØµÙ‘Ø§Ù† JSONØŒ Ù„Ø§ ÙƒØ§Ø¦Ù†Ø§Ù†.
export interface WebSectionRow {
  id: string
  section_type: WebSectionType
  sort_order: number
  is_active: number
  content_json: string
  cta_json: string
  media_asset_id: string | null
  media_status: string | null
  media_title: string | null
}

/// Ù‚Ø³Ù… Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø­Ø±ÙÙ‘Ø±: Ù†ÙØ³ Ø§Ù„ØµÙÙ‘ Ø¨Ø¹Ø¯ ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù€JSONØŒ Ù…Ø¹ Ù…ÙØªØ§Ø­ Ù…Ø­Ù„Ù‘ÙŠ Ù„Ù„Ø³Ø­Ø¨ ÙˆØ§Ù„ØªØ±ØªÙŠØ¨.
export interface WebSectionDraft {
  key: string
  section_type: WebSectionType
  is_active: boolean
  content: Record<string, unknown>
  cta: Record<string, unknown>
  media_asset_id: string | null
}

export interface SeoRecord {
  seo_title: string | null
  meta_description: string | null
  canonical_url: string | null
  robots_index: number
  robots_follow: number
  og_title: string | null
  og_description: string | null
  og_image_asset_id: string | null
  structured_data_json: string | null
  updated_at?: string
}

export interface SeoGuidance {
  title_max: number
  description_min: number
  description_max: number
}

export interface SeoEnvelope {
  entity_type: string
  entity_id: string
  seo: SeoRecord | null
  guidance: SeoGuidance
}

export interface CmsRevision {
  id: string
  version: number
  note: string | null
  created_at: string
  created_by_name: string | null
  is_autosave?: number
}

export interface CmsTranslation {
  id: string
  language: CmsLanguage
  path: string
  status: CmsStatus
}

export interface WebPageDetail {
  page: {
    id: string
    page_key: string
    language: CmsLanguage
    path: string
    slug: string
    title: string
    summary: string | null
    translation_group: string
    status: CmsStatus
    scheduled_at: string | null
    published_at: string | null
    kind: string
    is_indexable: number
    created_at: string
    updated_at: string
  }
  sections: WebSectionRow[]
  seo: SeoRecord | null
  translations: CmsTranslation[]
  revisions: CmsRevision[]
  readiness: CmsBlocker[]
}

export type BlogBlockType =
  | 'heading' | 'paragraph' | 'list' | 'image' | 'quote' | 'callout'
  | 'embed' | 'cta' | 'related_content' | 'divider'

export interface BlogBlock {
  type: BlogBlockType
  [key: string]: unknown
}

/// ÙƒØªÙ„Ø© Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø­Ø±ÙÙ‘Ø±. `key` Ù…Ø­Ù„Ù‘ÙŠ ÙÙ‚Ø· ÙˆÙ„Ø§ ÙŠÙØ±Ø³ÙŽÙ„ Ø¥Ù„Ù‰ Ø§Ù„Ø®Ø§Ø¯Ù….
export interface BlogBlockDraft extends BlogBlock {
  key: string
}

export interface BlogPostListRow {
  id: string
  post_key: string
  language: CmsLanguage
  slug: string
  path: string
  title: string
  status: CmsStatus
  scheduled_at: string | null
  published_at: string | null
  updated_at: string
  translation_group: string
  hero_asset_id: string | null
  source_type: string | null
  religious_approved_at: string | null
  author_name: string | null
  category_name: string | null
  category_key: string | null
  language_variants: number
  has_seo: number
}

export interface BlogAuthor {
  id: string
  display_name: string
  bio: string | null
  avatar_asset_id: string | null
  is_active: number
}

export interface BlogCategory {
  id: string
  category_key: string
  language: CmsLanguage
  name: string
  slug: string
  sort_order: number
}

export interface BlogTag {
  slug: string
  name_ar: string
  name_en: string | null
  name_fr: string | null
  post_count: number
}

export interface BlogTaxonomy {
  authors: BlogAuthor[]
  categories: BlogCategory[]
  tags: BlogTag[]
}

export interface BlogPostDetail {
  post: {
    id: string
    post_key: string
    language: CmsLanguage
    slug: string
    path: string
    title: string
    excerpt: string | null
    body: BlogBlock[]
    body_json: string
    hero_asset_id: string | null
    author_id: string | null
    category_id: string | null
    translation_group: string
    status: CmsStatus
    scheduled_at: string | null
    published_at: string | null
    related_posts_json: string
    related_content_json: string
    cta_json: string
    source_type: string | null
    source_reference: string | null
    religious_reviewer_id: string | null
    religious_approved_at: string | null
    created_at: string
    updated_at: string
  }
  tags: string[]
  translations: CmsTranslation[]
  revisions: CmsRevision[]
  seo: Pick<SeoRecord, 'seo_title' | 'meta_description'> | null
  word_count: number
  is_religious: boolean
  readiness: CmsBlocker[]
}

export interface WebRedirect {
  id: string
  from_path: string
  to_path: string
  status_code: number
  reason: string | null
  created_at: string
  created_by_name: string | null
}

export interface SeoIssue {
  id: string
  severity: 'error' | 'warning'
  entity_type: string
  entity_id: string
  path: string | null
  detail: string
}

/**
 * ØªØ¯Ù‚ÙŠÙ‚ SEO Ø§Ù„Ø¯Ø§Ø®Ù„ÙŠ.
 *
 * `index_status_available` ØªØ¨Ù‚Ù‰ false ÙˆÙŠØ¬Ø¨ Ø£Ù† ØªÙØ¹Ø±Ø¶ ÙƒØ°Ù„Ùƒ: Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ ÙŠØ«Ø¨Øª Ù…Ø§ ÙÙŠ
 * Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆÙ„Ø§ ÙŠØ¹Ø±Ù Ø´ÙŠØ¦Ù‹Ø§ Ø¹Ù† ÙÙ‡Ø±Ø³Ø© Ù…Ø­Ø±Ù‘ÙƒØ§Øª Ø§Ù„Ø¨Ø­Ø«. Ø®Ù„Ø· Ø§Ù„Ø§Ø«Ù†ÙŠÙ† Ø¹Ù„Ù‰ Ø´Ø§Ø´Ø©
 * ÙˆØ§Ø­Ø¯Ø© ÙŠØ¬Ø¹Ù„ Â«ØµÙØ± Ø£Ø®Ø·Ø§Ø¡Â» ØªÙÙ‚Ø±Ø£ ÙƒÙ€Â«Ø§Ù„Ù…ÙˆÙ‚Ø¹ Ù…ÙÙ‡Ø±Ø³Â»ØŒ ÙˆÙ‡Ù…Ø§ Ø§Ø¯Ù‘Ø¹Ø§Ø¡Ø§Ù† Ù…Ø®ØªÙ„ÙØ§Ù†.
 */
export interface SeoAudit {
  issues: SeoIssue[]
  summary: {
    errors: number
    warnings: number
    audited_pages: number
    audited_posts: number
    redirects: number
  }
  /// Ø­Ø§Ù„Ø© Ø®Ø±ÙŠØ·Ø© Ø§Ù„Ù…ÙˆÙ‚Ø¹. Ù„Ø§ ØªØ§Ø±ÙŠØ® ØªÙˆÙ„ÙŠØ¯: ØªÙÙˆÙ„ÙŽÙ‘Ø¯ Ø¹Ù†Ø¯ ÙƒÙ„ Ø·Ù„Ø¨ Ù…Ù† Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.
  sitemap: {
    generated_on_request: boolean
    included_urls: number
    excluded_unpublished: number
    noindex_published: number
  }
  /// Ù…Ø§ ÙŠÙØ­ØµÙ‡ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ ÙˆÙ…Ø§ Ù„Ø§ ÙŠÙØ­ØµÙ‡ØŒ Ø¨Ø§Ù„Ø§Ø³Ù… ÙˆØ§Ù„Ø³Ø¨Ø¨.
  coverage: Array<{ id: string; implemented: boolean; note: string | null }>
  source: string
  index_status_available: boolean
  index_status_note: string
}

export interface SeoSlugCheck {
  available: boolean
  reason: string | null
}

// --- Ø§Ù„Ù„ÙˆØ­Ø© Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠØ© --------------------------------------------------------

/**
 * ÙˆØ­Ø¯Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙŠ Ø§Ù„Ù„ÙˆØ­Ø© Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠØ©.
 *
 * ÙƒÙ„ ÙˆØ­Ø¯Ø© ØªØ­Ù…Ù„ Ù…ØµØ¯Ø±Ù‡Ø§ ÙˆØ§Ù„Ù…Ø³Ø§Ø± Ø§Ù„Ø°ÙŠ ØªÙÙØµÙŽÙ‘Ù„ ÙÙŠÙ‡: Ø±Ù‚Ù… Ø¨Ù„Ø§ Ù…ÙƒØ§Ù† ÙŠÙÙØªØ­ ÙÙŠÙ‡ Ù‡Ùˆ Ø±Ù‚Ù… Ù„Ø§
 * ÙŠÙ…ÙƒÙ† Ø§Ù„ØªØµØ±Ù‘Ù Ø¨Ù†Ø§Ø¡Ù‹ Ø¹Ù„ÙŠÙ‡ØŒ ÙˆÙ‡Ùˆ Ù…Ø§ Ø¬Ø¹Ù„ Ø§Ù„Ù„ÙˆØ­Ø© Ø§Ù„Ø³Ø§Ø¨Ù‚Ø© ØªÙÙ‚Ø±Ø£ ÙˆÙ„Ø§ ØªÙØ³ØªØ®Ø¯Ù….
 * `unavailable` ØªÙØ³ØªØ®Ø¯Ù… Ø­ÙŠÙ† Ù„Ø§ ØªÙƒÙˆÙ† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…ÙˆØ¬ÙˆØ¯Ø© Ø£ØµÙ„Ù‹Ø§ØŒ ÙØªÙØ¹Ù„ÙŽÙ† ÙˆÙ„Ø§ ØªÙØµÙÙŽÙ‘Ø±:
 * ØµÙØ± Ù…Ù„ÙÙ‘Ù‚ Ø£Ø®Ø·Ø± Ù…Ù† ÙØ±Ø§Øº Ù…ÙØ¹Ù„ÙŽÙ†.
 */
export interface ExecutiveMetric {
  key: string
  label_ar: string
  label_en: string
  /// `null` ÙŠØ¹Ù†ÙŠ Â«Ù„Ø§ ÙŠÙ…ÙƒÙ† Ù…Ø¹Ø±ÙØªÙ‡Â»ØŒ Ù„Ø§ ØµÙØ±Ù‹Ø§.
  ///
  /// ÙƒØ§Ù† Ø§Ù„Ø®Ø§Ø¯Ù… ÙŠÙÙ†Ù‡ÙŠ ÙƒÙ„ Ø¹Ø¯Ù‘ Ø¨Ù€`?? 0`ØŒ ÙÙ…ØµØ¯Ø± ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡ ÙŠÙØ¹Ø±ÙŽØ¶ Ø±Ù‚Ù…Ù‹Ø§ Ø­Ù‚ÙŠÙ‚ÙŠÙ‹Ù‘Ø§. Ø§Ù„Ø¢Ù†
  /// Ø§Ù„Ù…Ù‚ÙŠØ§Ø³ Ø§Ù„Ø°ÙŠ ØªØ¹Ø°Ù‘Ø± Ø­Ø³Ø§Ø¨Ù‡ ÙŠØ­Ù…Ù„ `null` ÙˆØ³Ø¨Ø¨Ù‡ ÙÙŠ `unavailable`ØŒ ÙˆØ§Ù„ÙˆØ§Ø¬Ù‡Ø© ØªØ·Ø¨Ø¹
  /// Ø´Ø±Ø·Ø© Ù„Ø§ ØµÙØ±Ù‹Ø§ ÙˆÙ„Ø§ ØªÙØªØ­ Ù„Ù‡ Ø´Ø§Ø´Ø© Ù…ÙÙ„ØªØ±Ø©.
  value: number | null
  tone: 'neutral' | 'good' | 'warn' | 'danger'
  /// Ø³Ø¨Ø¨ ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø­Ø³Ø§Ø¨ØŒ Ø£Ùˆ null Ø­ÙŠÙ† ØªÙˆØ¬Ø¯ Ù‚ÙŠÙ…Ø©.
  unavailable?: string | null
  /// Ø§Ù„ÙØªØ±Ø© Ø§Ù„ØªÙŠ ÙŠØ¹Ù†ÙŠÙ‡Ø§ Ø§Ù„Ø±Ù‚Ù…ØŒ Ù…ÙØ¹Ù„ÙŽÙ†Ø© Ø¨Ø¯Ù„ Ø£Ù† ØªÙÙØªØ±ÙŽØ¶.
  window?: string
  /// Ø§Ù„Ù…Ø³Ø§Ø± Ø¯Ø§Ø®Ù„ Ø§Ù„Ù„ÙˆØ­Ø© Ø§Ù„Ø°ÙŠ ÙŠØ¹Ø±Ø¶ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø© Ø¨Ø§Ù„Ø¶Ø¨Ø·ØŒ Ø¨ÙÙ„Ø§ØªØ±Ù‡Ø§
  drill: string | null
  /// Ø·Ù„Ø¨ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø°ÙŠ ÙŠÙØ¹ÙŠØ¯ Ø§Ù„Ù…Ø¬Ù…ÙˆØ¹Ø© Ù†ÙØ³Ù‡Ø§ Ø¨Ø§Ù„Ø­Ø±Ù.
  drill_api?: string
  /// `exact` Ø£ÙŠ Ø£Ù† Ø§Ù„ÙˆØ¬Ù‡Ø© ØªÙØ¹ÙŠØ¯ Ø§Ù„Ø¹Ø¯Ø¯ Ù†ÙØ³Ù‡Ø› `related` ØªØªØ·Ù„Ù‘Ø¨ `note` ÙŠØ´Ø±Ø­ Ø§Ù„ÙØ±Ù‚.
  drill_match?: 'exact' | 'related'
  note?: string
}

export interface ExecutiveModule {
  key: string
  label_ar: string
  label_en: string
  source: string
  metrics: ExecutiveMetric[]
  unavailable: string | null
}

export interface ExecutiveOverview {
  generated_at: string
  modules: ExecutiveModule[]
  /// Ù…Ø§ Ù„Ø§ ØªØ³ØªØ·ÙŠØ¹ Ù‡Ø°Ù‡ Ø§Ù„Ù„ÙˆØ­Ø© Ù‚ÙˆÙ„Ù‡ØŒ ÙˆÙ„Ù…Ø§Ø°Ø§.
  limits: string[]
}

// --- Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø´Ø§Ù…Ù„ (adminSearch.ts) ------------------------------------------

export interface GlobalSearchResult {
  id: string
  type: string
  title: string
  subtitle: string | null
  status: string | null
  /// Ù…Ø³Ø§Ø± Ù†Ø³Ø¨ÙŠ Ø¯Ø§Ø®Ù„ Ø§Ù„Ù„ÙˆØ­Ø©. Ø§Ù„Ù‚Ø§Ø¹Ø¯Ø© ØªÙØ¶Ø§Ù Ø¨Ù€`adminPath()` ÙÙŠ Ø§Ù„Ø¹Ù…ÙŠÙ„ØŒ ÙØ§Ù„Ø®Ø§Ø¯Ù…
  /// Ù„Ø§ ÙŠØ¹Ø±Ù Ù…Ø³Ø§Ø± Ø§Ù„Ù„ÙˆØ­Ø© ÙˆÙ„Ø§ ÙŠØ¬Ø¨ Ø£Ù† ÙŠØ¹Ø±ÙÙ‡.
  admin_route: string
  image_url: string | null
  context: string | null
}

export interface GlobalSearchGroup {
  type: string
  results: GlobalSearchResult[]
}

export interface GlobalSearch {
  query: string
  groups: GlobalSearchGroup[]
  total: number
  /// Ø£Ù†ÙˆØ§Ø¹ ÙÙŠ Ø¨Ø±Ù†Ø§Ù…Ø¬ Ø§Ù„Ø¹Ù…Ù„ Ø¨Ù„Ø§ Ø¬Ø¯ÙˆÙ„ ÙÙŠ Ø£ÙŠ Ù…Ù‡Ø§Ø¬Ø±Ø©. ØªÙØ¹Ø±Ø¶ ÙƒØªØµØ±ÙŠØ­ Ù„Ø§ ÙƒÙ†ØªÙŠØ¬Ø© ÙØ§Ø±ØºØ©.
  unavailable: Array<{ type: string; reason: string }>
  /// Ù…ØµØ§Ø¯Ø± ÙØ´Ù„Øª ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ù†Ø¯Ø§Ø¡. Ù…ØµØ¯Ø± ÙˆØ§Ø­Ø¯ ÙØ§Ø´Ù„ Ù„Ø§ ÙŠÙÙØ±ÙÙ‘Øº Ø§Ù„Ù„ÙˆØ­Ø©.
  failed: Array<{ type: string; reason: string }>
  scope: {
    restricted: boolean
    omitted_types: Array<{ type: string; reason: string }>
  }
  min_length?: number
  types: Array<{ type: string; group: 'catalogue' | 'platform' }>
}

// --- ØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ø­ØªÙˆÙ‰ (adminCalendar.ts) ---------------------------------------

export interface CalendarEventRecord {
  id: string
  type: string
  title: string
  date: string
  date_kind: 'scheduled' | 'published' | 'due' | 'expires'
  status: string | null
  language: string | null
  planet_id: string | null
  owner_id: string | null
  team_id: string | null
  context: string | null
  admin_route: string
  reschedule: {
    supported: boolean
    method?: 'PATCH' | 'PUT'
    route?: string
    field?: string
    permission?: string
    reason?: string
  }
  conflicts: string[]
}

export interface ContentCalendar {
  from: string
  to: string
  events: CalendarEventRecord[]
  total: number
  total_unfiltered: number
  conflict_summary: {
    no_scheduler: number
    lapsed_schedule: number
    rights_expiry_before_publication: number
    same_day_collision: number
  }
  unavailable: Array<{ type: string; reason: string }>
  /// Ø®Ø·Ø£ Ø£Ù† ÙŠÙØ±Ø³Ù… Ø§Ù„Ù…Ø¬Ø¯ÙˆÙ„ ÙƒØ£Ù† Ù…Ø¤Ù‚Ù‘ØªÙ‹Ø§ Ø³ÙŠÙ†Ø´Ø±Ù‡: Ù„Ø§ Ù…ÙØ´ØºÙÙ‘Ù„ Ø¯ÙˆØ±ÙŠ Ù„Ù„Ù†Ø´Ø±.
  scheduler_available: boolean
  scheduler_note: string
}

/* ------------------------------------------- Ø³Ø¬Ù„ Ù…Ø²ÙˆÙ‘Ø¯ÙŠ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ */

/**
 * Ø£Ù†ÙˆØ§Ø¹ Ø³Ø¬Ù„ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù…Ù† `GET /admin/ai/registry`.
 *
 * Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ù‚ÙŠÙˆØ¯ CHECK ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0063 ÙˆÙ„Ø«ÙˆØ§Ø¨Øª `api/src/lib/aiRegistry.ts`.
 *
 * ## Ù…Ø§ Ù„Ø§ ÙŠÙˆØ¬Ø¯ ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ø£Ù†ÙˆØ§Ø¹
 *
 * Ù„Ø§ Ø­Ù‚Ù„ Ù…ÙØªØ§Ø­. `credential_ref` Ù‡Ùˆ **Ø§Ø³Ù…** Ø³Ø±Ù‘ Worker Ù„Ø§ Ù‚ÙŠÙ…ØªÙ‡ØŒ ÙˆØ§Ù„Ø®Ø§Ø¯Ù… Ù„Ø§
 * ÙŠÙØ¹ÙŠØ¯ Ø§Ù„Ù‚ÙŠÙ…Ø© Ø¹Ù„Ù‰ Ø£ÙŠ Ù…Ø³Ø§Ø±. `configured` Ù‡Ùˆ ÙƒÙ„ Ù…Ø§ ÙŠÙÙ‚Ø§Ù„ Ø¹Ù† Ø§Ù„Ø³Ø±Ù‘ØŒ ÙˆÙ‡Ùˆ Ù†ÙØ³ Ø¹Ù‚Ø¯
 * `GET /admin/tts/config`.
 */
export type AiAuthMode = 'api_key_header' | 'bearer' | 'service_account'
export type AiModality = 'text' | 'image' | 'video' | 'audio'
export type AiPriceUnit =
  | 'per_1k_input_tokens'
  | 'per_1k_output_tokens'
  | 'per_1k_characters'
  | 'per_image'
  | 'per_second'
export type AiEntityStatus = 'active' | 'disabled'

/// Ø³Ø¨Ø¨ Ø§Ø³ØªØ¨Ø¹Ø§Ø¯ Ù…Ø³Ø§Ø± Ù…Ø±Ø´ÙŽÙ‘Ø­. ÙƒÙ„ Ù‚ÙŠÙ…Ø© Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙ†ÙÙŠØ° Ù…Ù† Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ØŒ ÙÙ„Ø§ Â«ÙØ´Ù„ Ø¹Ø§Ù…Â».
export type AiRouteSkipReason =
  | 'route_disabled'
  | 'model_disabled'
  | 'provider_disabled'
  | 'credential_ref_not_allowed'
  | 'credential_missing'
  | 'modality_mismatch'
  | 'json_schema_unsupported'
  | 'daily_call_cap_reached'
  | 'daily_spend_cap_reached'

export interface AiProviderRecord {
  id: string
  slug: string
  name_ar: string
  auth_mode: AiAuthMode
  base_url: string
  /// Ø§Ø³Ù… Ø³Ø±Ù‘ Ø§Ù„Ù€WorkerØŒ Ù…Ø«Ù„ `GOOGLE_AI_API_KEY`. Ù„ÙŠØ³ Ù…ÙØªØ§Ø­Ù‹Ø§.
  credential_ref: string
  /// Ù‡Ù„ Ø§Ù„Ø³Ø±Ù‘ Ø§Ù„Ù…Ø³Ù…Ù‘Ù‰ Ù…ÙˆØ¬ÙˆØ¯ ÙØ¹Ù„Ù‹Ø§ ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„Ø¨ÙŠØ¦Ø©.
  configured: boolean
  unconfigured_reason: 'credential_ref_not_allowed' | 'credential_missing' | null
  /// Ù‡Ù„ ÙŠØ¹Ø±Ù Ø§Ù„ÙƒÙˆØ¯ Ø§Ù„ØªØ­Ø¯Ù‘Ø« Ø¨Ø¨Ø±ÙˆØªÙˆÙƒÙˆÙ„ Ù‡Ø°Ø§ Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯ Ù†ØµÙŠÙ‹Ù‘Ø§ (`services/aiText.ts`).
  /// Ù…Ø²ÙˆÙ‘Ø¯ Ø¨Ù„Ø§ Ù…Ø­ÙˆÙ‘Ù„ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„Ù‡ ÙˆØªÙˆØ¬ÙŠÙ‡Ù‡ØŒ Ù„ÙƒÙ†Ù‡ Ø³ÙŠØ±ÙØ¶ Ø¹Ù†Ø¯ Ø§Ù„ØªÙˆÙ„ÙŠØ¯.
  has_text_adapter: boolean
  status: AiEntityStatus
  notes_ar?: string | null
  model_count: number
  updated_at: string
  updated_by?: string | null
}

export interface AiModelRecord {
  id: string
  provider_id: string
  provider_slug?: string | null
  /// Ø³Ù„Ø³Ù„Ø© Ø§Ù„Ù…Ø²ÙˆÙ‘Ø¯ Ø§Ù„Ø­Ø±ÙÙŠØ© Ø§Ù„Ù…ÙØ±Ø³Ù„Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø³Ù„Ùƒ.
  model_id: string
  name_ar: string
  modality: AiModality
  supports_json_schema: boolean
  max_input_tokens?: number | null
  max_output_tokens?: number | null
  /// `null` ØªØ¹Ù†ÙŠ Â«Ø¨Ù„Ø§ Ø³Ø¹Ø±Â» Ù„Ø§ Â«Ù…Ø¬Ø§Ù†ÙŠÂ». Ø§Ù„ØµÙØ± ÙƒØ§Ù† Ø³ÙŠÙÙ‚Ø±Ø£ Ù…Ø¬Ø§Ù†Ù‹Ø§ ÙˆÙŠÙ…Ø±Ù‘ ØªØ­Øª Ø£ÙŠ Ø³Ù‚Ù.
  price_micros?: number | null
  price_credits?: number | null
  price_unit?: AiPriceUnit | null
  status: AiEntityStatus
  last_probe_at?: string | null
  last_probe_status?: 'ok' | 'failed' | null
  last_probe_detail?: string | null
  route_count: number
  updated_at: string
}

export interface AiTaskRouteRecord {
  id: string
  model_id: string
  model_ref: string
  model_name_ar: string
  provider_slug: string
  /// Ù¡ Ù‡Ùˆ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØŒ ÙˆÙ¢ ÙˆÙ…Ø§ Ø¨Ø¹Ø¯Ù‡ Ø¨Ø¯Ø§Ø¦Ù„ ØªÙØ¬Ø±ÙŽÙ‘Ø¨ Ø¨Ø§Ù„ØªØ±ØªÙŠØ¨.
  priority: number
  is_enabled: boolean
  /// Ù†ØµÙ‘ JSON ÙƒÙ…Ø§ Ù‡Ùˆ Ù…Ø®Ø²ÙŽÙ‘Ù†Ø› Ø´ÙƒÙ„Ù‡ ÙŠÙ…Ù„ÙƒÙ‡ Ø§Ù„ÙƒÙˆØ¯ Ø§Ù„Ù…Ø³ØªØ¯Ø¹ÙŠ Ù„Ø§ Ù‡Ø°Ù‡ Ø§Ù„Ø´Ø§Ø´Ø©.
  params: string
  daily_call_cap?: number | null
  daily_spend_cap_micros?: number | null
}

export interface AiRouteSkipRecord {
  priority: number
  model_id: string
  model_ref: string
  provider_slug: string
  reason: AiRouteSkipReason
}

export interface AiTaskRecord {
  id: string
  name_ar: string
  description_ar: string
  required_modality: AiModality
  requires_json_schema: boolean
  /**
   * Ù‡Ù„ ÙŠØ³ØªØ¯Ø¹ÙŠ ÙƒÙˆØ¯Ù Ø¥Ù†ØªØ§Ø¬Ù Ù‡Ø°Ø§ Ø§Ù„ØªÙˆØ¬ÙŠÙ‡ Ø¨Ø¹Ø¯.
   *
   * `false` ÙŠØ¹Ù†ÙŠ Ø£Ù† Ø§Ù„ØªÙˆØ¬ÙŠÙ‡ Ù‚Ø§Ø¨Ù„ Ù„Ù„Ø¶Ø¨Ø· ÙˆÙ„Ø§ Ø´ÙŠØ¡ ÙŠÙ‚Ø±Ø£Ù‡ØŒ ÙˆØ§Ù„Ø´Ø§Ø´Ø© ØªÙ‚ÙˆÙ„ Ø°Ù„Ùƒ ØµØ±Ø§Ø­Ø©Ù‹
   * Ø¨Ø¯Ù„ Ø£Ù† ØªÙÙˆÙ‡Ù… Ø¨Ø£Ù† Ø§Ù„Ù…Ù‡Ù…Ø© ØªØ¹Ù…Ù„. ØªÙÙ‚Ù„ÙŽØ¨ ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© Ù†ÙØ³Ù‡Ø§ Ø§Ù„ØªÙŠ ØªÙÙ†Ø²Ù„ Ø§Ù„ÙƒÙˆØ¯.
   */
  is_wired: boolean
  sort_order: number
  routes: AiTaskRouteRecord[]
  /// Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„ Ø§Ù„Ø°ÙŠ Ø³ÙŠØ®Ø¯Ù… Ø§Ù„Ù…Ù‡Ù…Ø© ÙØ¹Ù„Ù‹Ø§ Ø§Ù„Ø¢Ù†ØŒ Ù…Ø­Ø³ÙˆØ¨Ù‹Ø§ Ø¨Ù†ÙØ³ Ø§Ù„Ø¯Ø§Ù„Ø© Ø§Ù„ØªÙŠ ÙŠØ³ØªØ®Ø¯Ù…Ù‡Ø§
  /// ÙƒÙˆØ¯ Ø§Ù„ØªÙˆÙ„ÙŠØ¯ (`evaluateTaskRoutes`)ØŒ ÙÙ„Ø§ ØªÙ†Ø­Ø±Ù Ø§Ù„Ø´Ø§Ø´Ø© Ø¹Ù…Ù‘Ø§ Ø³ÙŠØ­Ø¯Ø«.
  resolved_model_id: string | null
  skipped: AiRouteSkipRecord[]
  usage_today: { calls: number; spend_micros: number }
}

/// Ø§Ù„Ø®ÙŠØ§Ø±Ø§Øª ØªÙØ±Ø³Ù„ Ù…Ø¹ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙÙ„Ø§ ØªØ¹Ø±Ø¶ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ù‚ÙŠÙ…Ø© ÙŠØ±ÙØ¶Ù‡Ø§ Ø§Ù„Ø®Ø§Ø¯Ù….
export interface AiRegistryOptions {
  auth_modes: AiAuthMode[]
  modalities: AiModality[]
  price_units: AiPriceUnit[]
  /// Ø£Ø³Ù…Ø§Ø¡ Ø§Ù„Ø£Ø³Ø±Ø§Ø± Ø§Ù„Ù…Ø³Ù…ÙˆØ­ Ø§Ù„Ø¥Ø´Ø§Ø±Ø© Ø¥Ù„ÙŠÙ‡Ø§. ØªÙˆØ³ÙŠØ¹Ù‡Ø§ ÙŠØ­ØªØ§Ø¬ ØªØ¹Ø¯ÙŠÙ„ ÙƒÙˆØ¯ ÙˆÙ†Ø´Ø±Ù‹Ø§.
  credential_refs: string[]
  text_adapters: string[]
  max_priority: number
}

export interface AiRegistry {
  providers: AiProviderRecord[]
  models: AiModelRecord[]
  tasks: AiTaskRecord[]
  options: AiRegistryOptions
  notes: string[]
  generated_at: string
}

export interface AiProviderPayload {
  slug: string
  name_ar: string
  auth_mode: AiAuthMode
  base_url: string
  credential_ref: string
  notes_ar?: string | null
  status?: AiEntityStatus
}

export interface AiModelPayload {
  provider_id: string
  model_id: string
  name_ar: string
  modality: AiModality
  supports_json_schema?: boolean
  max_input_tokens?: number | null
  max_output_tokens?: number | null
  price_micros?: number | null
  price_unit?: AiPriceUnit | null
  status?: AiEntityStatus
}

export interface AiRoutePayload {
  model_id: string
  priority: number
  is_enabled?: boolean
  params?: Record<string, unknown> | string
  daily_call_cap?: number | null
  daily_spend_cap_micros?: number | null
}

/// Ù†ØªÙŠØ¬Ø© Ø§Ø®ØªØ¨Ø§Ø± Ù…ÙˆØ¯ÙŠÙ„. `schema_honoured` ØªÙ‚ÙˆÙ„ Ù‡Ù„ Ø¹Ø§Ø¯ ÙƒØ§Ø¦Ù† ÙØ¹Ù„Ù‹Ø§ Ù„Ø§ Ù‡Ù„ Ø·ÙÙ„Ø¨ØŒ
/// Ùˆ`cost_known` ØªÙØ±Ù‘Ù‚ Ø¨ÙŠÙ† Â«ØµÙØ±Â» ÙˆÂ«Ø³Ø¹Ø± ØºÙŠØ± Ù…Ø³Ø¬ÙŽÙ‘Ù„Â».
export interface AiProbeResult {
  status: 'ok'
  latency_ms: number
  input_tokens?: number | null
  output_tokens?: number | null
  schema_honoured: boolean | null
  cost_micros: number | null
  cost_known: boolean
  sample: string
}

export interface AiUsageRow {
  task_id: string
  provider_slug: string
  model_ref: string
  purpose: 'production' | 'probe'
  status: 'ok' | 'refused' | 'provider_failed' | 'invalid_output'
  calls: number
  spend_micros: number
}

export interface AiUsageDayRow {
  day: string
  purpose: 'production' | 'probe'
  calls: number
  spend_micros: number
}

export interface AiUsageEnvelope {
  days: number
  by_task: AiUsageRow[]
  by_day: AiUsageDayRow[]
}

