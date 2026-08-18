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
  /// يُحلّ من asset_links مثل icon_url، وليس عمودًا في جدول planets نفسه
  cover_url?: string | null
  sort_order: number
  is_active?: boolean
  series_count?: number
  assets_count?: number
}

/// تفصيل كوكب واحد من GET /admin/planets/:id، مع سلاسله وتصنيفاته الفعلية.
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
 * مؤشّرات الكوكب من `GET /admin/planets`.
 *
 * كلها محسوبة في الخادم من جداول حقيقية، وتستثني محتوى الاختبار
 * (`series.content_class = test_fixture`) بخلاف `series_count` و`assets_count`
 * المحفوظين بمعناهما الأصلي لأن شاشات أخرى تقرأهما.
 *
 * `content_updated_at` أحدث تعديل على سلاسل الكوكب وحلقاته لا على صفّ الكوكب:
 * جدول `planets` بلا عمود `updated_at`.
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

/// ملخّص كل الكواكب (لا المجموعة المفلترة)، فلا يتغيّر عند تطبيق فلتر.
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

/// وحدة في مساحة العمل: `unavailable` غير فارغ يعني «تعذّرت القراءة» لا «صفر».
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

/// إشارة لغة واحدة مع مقامها. `unavailable` يعني «لا عمود لهذا القياس».
export interface LocalizationSignal {
  key: string
  label_ar: string
  done: number
  total: number
  unavailable: string | null
  note: string | null
  /// مسار الشاشة التي تُغلق هذا النقص، أو `null` إذا لا عمل يُفتح: إشارة مكتملة
  /// أو غير قابلة للقياس. المسار نسبي لجذر لوحة الإدارة.
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

/// كل عنصر يحمل عددًا حقيقيًا ووجهة مفلترة تحلّه. لا عدّاد بلا وجهة.
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
  /// التحليلات غير متاحة على مستوى الكوكب: لا كاتب لجداول النشاط في D1.
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

/// حِمل تعديل الكوكب. الحقول التي يقبلها الخادم فعلًا لا أكثر.
export interface PlanetPayload {
  name_ar: string
  name_en?: string | null
  description_ar?: string | null
  color_hex: string
  sort_order?: number
  is_active?: boolean
  /// عند الإنشاء فقط: المعرّف/الـslug
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
  // Islamic governance (migration 0011) — null for non-islamic series
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

/// تفصيل سلسلة واحدة من GET /admin/series/:id: الصف الأساسي مع مواسمها،
/// شخصياتها، وحلقاتها الفعلية (بصور مصغّرة محلولة). لا توجد بيانات تقدّم
/// إنتاج منفصلة (سكربت/صوت/فيديو/QA) في الخادم بعد — راجع status وحده.
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

/// ملخص الحلقة الذي يعيده GET /admin/seasons/:id. لا يحمل صورة أو وصفًا أو
/// تفاصيل وسائط؛ على الواجهة ألا تتعامل معه كـ EpisodeRecord كامل.
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

/// تفصيل شخصية واحدة من GET /admin/characters/:id. عدد الفقاعات استخدامٌ
/// فعلي في القصص، لا مقياس تحليلي مُنشأ في الواجهة.
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

/// تغطية لغة واحدة على صفحات القصة، ومعها مقامها دائمًا.
///
/// نسبة بلا مقام غير قابلة للاستخدام: «٦» قد تكون ستًّا من ست أو ستًّا من أربعين.
/// والنصّ والسرد سؤالان مختلفان: صفحة قد تحمل نصًّا إنجليزيًّا بلا صوت إنجليزي،
/// فدمجهما في رقم واحد يُخفي أيّهما ناقص.
export interface StoryLanguageCoverage {
  language: string
  /// معلَنة في `stories.languages`. الإعلان نيّة لا إنجاز، فهو منفصل عن العدّ.
  declared: boolean
  text_done: number
  narration_done: number
  /// مؤشّرات التوقيت. لا شيء في المنصّة يكتبها، فهي صفر في كل مكان — والصدق في
  /// إظهارها صفرًا معلَّلًا أفضل من حذفها.
  timing_done: number
  total: number
}

export type StoryReadinessState = 'ready' | 'partial' | 'empty'

/// صفٌّ في مكتبة القصص: الغلاف الحقيقي والتغطية المعدودة لا التسمية.
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
  /// غلاف حقيقي من `asset_links` بدور cover/poster، أو `null` فتظهر حالة صريحة.
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

/// لغة واحدة على صفحة واحدة.
export interface StoryWorkspaceLocalization {
  language: string
  has_text: boolean
  has_alt: boolean
  body_text?: string | null
  alt_text?: string | null
  narration_asset_id?: string | null
  narration_status?: string | null
  /// `generated` تعني تصييرًا آليًّا لا تسجيلًا مُعتمدًا. الفرق مهم: مساواتهما
  /// تسمح بنشر صوت لم يراجعه أحد.
  narration_source?: string | null
  narration_size?: number | null
  /// جاهز فعلًا: بوّابة النشر لا تقبل إلا `status = 'ready'`.
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
  /// رابط عام مبنيّ عبر حَرس البادئة نفسه الذي يستخدمه بقيّة الكتالوج، فمفتاح
  /// مخالف لعمود الظهور يُنتج `null` لا صورة مكسورة.
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

/// عائق واحد، مُسمًّى بموضعه.
///
/// «لا يمكن النشر» بلا موضع تجعل المحرِّر يفتح كل صفحة بالتناوب. لذلك كل عائق
/// يحمل رقم الصفحة وتبويب المفتِّش الذي يُغلقه.
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
  /// حُكمان منفصلان بقصد: سرد بلا مؤشّرات توقيت هو «اقرأ لي» مكتمل و«قراءة
  /// متزامنة» فارغة، فرقم واحد لا يصلح للاثنين.
  read_to_me_ready: boolean
  read_along_ready: boolean
  publishable: boolean
}

/// ما لا يدعمه المخطَّط، مُعلَنًا لا مُكتشَفًا من رفض 409.
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

/// تفصيل أصل من GET /admin/assets/:id، ويشمل الارتباطات الفعلية التي تمنع
/// تخمين مكان استخدام الملف من اسمه فقط.
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

/* --------------------------------------------------------- طلبات الشراكة */

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
  /** المزوّد الذي سيُستخدم فعلًا، أو none إن لم يُضبط أي منهما */
  emailProvider: 'resend' | 'cloudflare' | 'none'
  defaultFrom: string | null
  inboxConfigured: boolean
}

/* -------------------------------------------------------- وضع الموقع العام */

export type SiteMode = 'live' | 'construction' | 'maintenance'

export interface SiteModeSettings {
  site_mode: SiteMode
  /** موعد الإطلاق بصيغة ISO، أو نص فارغ إن لم يُعلن */
  site_launch_at: string
  site_status_message: string
  /** دقائق، أو نص فارغ إن كانت المدة غير محدّدة */
  maintenance_eta_minutes: string
}

/** ما يراه الزائر فعلًا، يُحسب في الخادم من الإعدادات */
export interface SiteModePreview {
  mode: SiteMode
  launchAt: string | null
  message: string | null
  retryAfterSeconds: number | null
}

export interface SiteModeEnvelope {
  settings: SiteModeSettings
  /** الأوضاع المتاحة من الخادم، فلا تنحرف قائمة الواجهة عنه */
  modes: SiteMode[]
  preview: SiteModePreview
}

/* ------------------------------------------- مستخدمو اللوحة والصلاحيات */

/** موظف في فريق العمل. مشتق من admin_users + admin_credentials */
export interface AdminUserRecord {
  id: string
  email: string
  display_name: string
  is_active: boolean
  is_external: boolean
  created_at: string
  /** هل ضُبطت له كلمة مرور؟ حساب بلا كلمة لا يستطيع الدخول */
  has_password: boolean
  last_login_at: string | null
  /** غير فارغ عند القفل المؤقت بعد محاولات فاشلة */
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

/** دور من جدول roles المبذور في المهاجرة 0014 */
export interface RoleRecord {
  id: string
  name_ar: string
  is_system: number
  permissions_count?: number
  /**
   * معرّفات صلاحيات هذا الدور من role_permissions.
   *
   * أُضيفت لأن الخادم كان يُعيد العدد فقط، فلم تستطع الواجهة بناء مصفوفة
   * الصلاحيات من بيانات حقيقية — وكانت المصفوفة مكتوبة ثابتة في الكود.
   */
  permissions: string[]
}

export interface PermissionRecord {
  id: string
  action: string
  description_ar: string | null
}

/** منح صلاحية بأربع طبقات نطاق، من جدول access_grants */
export interface AccessGrantRecord {
  id: string
  grantee_type: 'user' | 'team'
  grantee_id: string
  role_id: string
  /** يأتي من LEFT JOIN roles في الخادم */
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
  /** من LEFT JOIN series في الخادم */
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

/** جهاز عائلة من account_devices. لا يُعرض أي معرّف تثبيت خام */
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

/** حدود باقة كما يفرضها familyPolicy في FamilyState، وليست عقد أسعار متجر. */
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
  /** من LEFT JOIN series في الخادم */
  series_title: string | null
  owner: string
  license_type: string
  /** مخزَّنة كنص JSON في D1 */
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

/** إعداد تحكّم عن بعد. الخادم يفكّ تحليل JSON قبل الإرسال */
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
 * الأبعاد التي يطبّقها المُحلِّل فعلًا (`api/src/lib/homeExperience.ts`).
 *
 * كانت الواجهة تعرض `age_min`/`age_max` في جملة الاستهداف، وهما بعدان لم يقرأهما
 * أي مُحلِّل: قاعدة تُكتب فيهما تُحفظ وتُعرض كأنها سارية ثم تُتجاهل في كل طلب.
 */
export interface HomeTargeting {
  track?: string[]
  language?: string[]
  country?: string[]
  plan?: string[]
  platform?: string[]
  /// أدنى إصدار تطبيق، مقارنة رقمية لا نصية.
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
  /// كتلة يحسب الخادم محتواها من حالة الطفل؛ لا يُختار محتواها تحريريًا.
  is_system?: boolean
  /// رسالة الخطأ إن كان JSON المخزَّن لا يجتاز التحقق، وnull إن كان سليمًا.
  targeting_invalid?: string | null
  config_invalid?: string | null
}

/// ما يقبله الخادم، يُرسَل مع القائمة فلا تُخترع الواجهة قائمة أنواع خاصة بها.
export interface HomeBuilderMeta {
  block_types: string[]
  system_block_types: string[]
  targeting_dimensions: string[]
  config_keys: string[]
}

/**
 * نسخة محفوظة من كتلة.
 *
 * `restorable` false للنسخة التي تسجّل إنشاء الكتلة: لا حالة أسبق تُستعاد إليها.
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
  /// سجلات من تطبيق سابق لا تحمل الاستهداف ولا الإعداد، فلا يمكن الاستعادة إليها.
  legacy_records: number
  note: string | null
}

/**
 * نتيجة بحث الدعم عن عائلة.
 *
 * لا تحمل بيانات دفع كاملة: `entitlements` من billing_audit بلا رمز الشراء.
 */
export interface SupportFamilyRecord {
  parent_id: string
  plan: ParentRecord['plan']
  status: ParentRecord['status']
}

/** أقل بيانات لازمة لموظف الدعم؛ لا يشمل avatar أو لغة الطفل أو طوابع الأحداث. */
export interface SupportChildRecord {
  child_id: string
  nickname: string | null
  age_track: AgeTrack | null
  status: 'active' | 'archived'
}

/** جهاز دعم مختصر؛ hashes التثبيت وauth epoch لا يصلان إلى المتصفح. */
export interface SupportDeviceRecord {
  id: string
  display_name: string | null
  platform: string
  status: 'active' | 'revoked'
}

/** ملخص استحقاق بلا hashes أو معرّفات شراء من المزوّد. */
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
 * نتيجة معاينة الصفحة الرئيسية بعد تطبيق الاستهداف والجدولة.
 *
 * التشخيصات حقيقية: كانت الشاشة تطبع «Fallback applied: none» دائمًا وتحسب
 * المستثنى من قائمة فلترتها بنفسها، فكانت تصف فلترتها لا فلترة الخادم.
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
 * صفّ شراء من `billing_audit` (المهاجرة 0008).
 *
 * `/billing/purchases` يعيد أعمدة أكثر من `recent_purchases` داخل `/stats`:
 * يضيف `purchase_token_hash` و`verified_at_ms`. الملخّص يجيب «ما الحالة
 * العامة»، وهذا المسار يجيب «ما الذي حدث في هذا الشراء بالضبط».
 *
 * `purchase_token_hash` ملخّص لا الرمز نفسه — الرمز الأصلي لا يُخزَّن إطلاقًا.
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
 * آخر خطة مدفوعة مسقطة من `family_projection`.
 *
 * الخادم يستثني `plan = 'free'`. هذا إسقاط تشغيلي غير متزامن وليس قرار
 * استحقاق لحظيًا: FamilyState هو مصدر الخطة الفعلية. ولا يحمل الإسقاط تاريخ
 * بداية أو نهاية؛ تلك في `billing_audit`.
 */
export interface BillingEntitlementRecord {
  parent_id: string
  plan: 'family' | 'family_plus'
  status: 'active' | 'suspended' | 'archived'
  last_event_at_ms: number
  updated_at: string
}

// Commerce — Subscriptions & Transactions (billing_audit + family_projection)
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
  price_minor: number
  effective_from: string
  effective_until?: string | null
  status: string
  provider?: string
  billing_period?: string
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

/* ------------------------------------- تفصيل ولي الأمر وتقدّم الطفل */

/**
 * صفّ طفل من `child_projection` (المهاجرة 0008).
 *
 * الإسقاط لا الجدول الأصلي: كل أعمدته nullable لأنه يُبنى من أحداث، والحدث
 * الأول قد لا يحمل كل الحقول. `children_profiles` هو مصدر الحقيقة الكامل.
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
 * تفصيل ولي أمر واحد من `/admin/parents/:id`.
 *
 * المصدر `family_projection` لا `parents`: الأول إسقاط مبنيّ من أحداث العائلة
 * والثاني جدول الهوية. الخادم يصرّح بذلك في `meta.source`.
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

/// صفّ مشاهدة من `watch_progress`. الأعمدة بالثواني لا بالميلي ثانية.
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

/// صفّ إتقان لهدف واحد عند طفل واحد.
export interface ChildMasteryRow {
  objective_id: string
  code: string | null
  objective_title: string | null
  level: MasteryLevel
  attempts: number
  correct_attempts: number
  /// `null` عند غياب المحاولات: «لا بيانات» ليست «نسبة نجاح صفر»
  success_rate: number | null
  last_attempt_at: string | null
}

/**
 * تقدّم طفل واحد من `/admin/analytics/children/:id`.
 *
 * ثلاثة مصادر لأن «تقدّم الطفل» ليس جدولًا واحدًا: المشاهدة في
 * `watch_progress`، والإتقان في `mastery`، والمحاولات في `attempts`.
 *
 * المسار كان يستعلم جدولًا اسمه `content_progress` لا وجود له في أي مهاجرة ولا
 * في الإنتاج، فكان يرمي على كل نداء — ولم يظهر ذلك لأنه بلا واجهة.
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

/* ------------------------------------------------------- الإطار التعليمي */

/**
 * مهارة. الجدول من المهاجرة 0001.
 *
 * `category` بلا CHECK في D1، فأي نص غير فارغ مقبول. لا تُخترع قائمة بيضاء
 * لا يفرضها المخطَّط — الخادم يصرّح بذلك في adminCatalogue.ts.
 */
export interface SkillRecord {
  id: string
  name_ar: string
  category: string
  description: string | null
  created_at: string
  /// من استعلام تجميعي في GET /admin/skills، لا عمود في الجدول
  objectives_count?: number
}

export interface SkillPayload {
  id?: string
  name_ar: string
  category: string
  description?: string | null
}

/// ارتباطات الهدف التي تمنع حذفه. تُعاد في 409 من DELETE أيضًا لا في GET وحده.
export interface ObjectiveUsage {
  episodes: number
  games: number
  publishedEpisodes: number
  publishedGames: number
  projects: number
  publishedProjects: number
}

/**
 * هدف تعليمي قابل للقياس. الجدول من المهاجرة 0001.
 *
 * `track_ids` ليست عمودًا: الخادم يجمعها من learning_objective_tracks ويعيدها
 * مصفوفة جاهزة (`serializeObjective`)، فلا تُفكَّك في الواجهة.
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
  /// من LEFT JOIN skills
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
  /// إن أُغفلت يشتقّها الخادم من المدى العمري
  track_ids?: AgeTrack[]
}

/* ---------------------------------------------- بنك الأسئلة */

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

/* ------------------------------------------- مركز الترجمة */

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

/* --------------------------------------------------------- مراجعات المحتوى */

/**
 * أنواع الكيانات القابلة للمراجعة.
 *
 * `story` غائب عن قصد: الـCHECK في D1 هو
 * `entity_type IN ('series','episode','book','game','project')`، فصفّ مراجعة
 * لقصة يفشل القيد. توسيعه يحتاج مهاجرة وإعادة بناء الجدول.
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

/* ------------------------------------------------ أحداث العائلة الفاشلة (DLQ) */

/// مطابق لقيد CHECK على failed_family_events.status في المهاجرة 0021
export type FailedEventStatus = 'pending' | 'replayed' | 'discarded'

/**
 * حدث عائلة استنفد محاولاته وسقط في الـDLQ.
 *
 * أعمدة الهوية كلها nullable عن قصد: رسالة مشوّهة هي أحد أسباب الوصول إلى
 * الـDLQ أصلًا، فلا هوية لها. تسجيل الفشل بحقول فارغة أنفع من إسقاط الصفّ.
 *
 * `payload` هو الجسم الخام كما وصل. قد يكون حدثًا صالحًا، أو نائبًا يحمل
 * `{ error: 'payload_truncated' | 'payload_not_serializable' }` عندما تعذّر حفظه
 * كاملًا — والنائب لا يُعاد تشغيله لأنه ليس حدثًا.
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

/// القائمة تُعيد `pending` مستقلًّا عن `total`: العدد المعلَّق هو ما يحتاج تصرّفًا،
/// و`total` يشمل ما حُلَّ سلفًا.
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
  /// صحيح عندما كان الحدث مُسقَطًا سلفًا: `processFamilyEvent` يفحص
  /// processed_family_events فلا يُطبَّق شيء مرتين.
  duplicate: boolean
}

/* ------------------------------------------------------- توليد السرد (TTS) */

/**
 * النقل المستخدم فعلًا. الاثنان يصلان إلى الموديل نفسه لكن باعتمادَين مختلفين:
 *
 * - `cloud_tts`: حساب خدمة، ويُعيد MP3 مباشرة. مُفضَّل لأن Workers لا تُحوّل صيغًا.
 * - `ai_studio`: مفتاح API، ويُعيد PCM خامًا يلفّه الخادم كـWAV.
 *
 * `null` يعني أن أيًّا منهما غير مُهيَّأ، فالتوليد متعذّر.
 */
export type TtsTransport = 'cloud_tts' | 'ai_studio'

/// الترميزات التي يقبلها Cloud TTS. نقل ai_studio يتجاهلها ويُعيد WAV دائمًا.
export type TtsEncoding = 'MP3' | 'LINEAR16' | 'OGG_OPUS'

/**
 * حدود المزوّد **بالبايت لا بالحرف**.
 *
 * الفرق جوهري للعربية: UTF-8 يرمّز الحرف العربي في بايتين، فحدّ 4000 بايت هو
 * ~2000 حرف. وGemini-TTS يقتطع الزائد **بصمت**، فالخادم يرفض بدل أن يُنتج سردًا
 * ينقطع في منتصف الجملة.
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
  /// قائمة مغلقة، فالخطأ المطبعيّ يصير 400 لا خطأ مزوّد غامضًا
  voices: string[]
  limits: TtsLimits
  /// ar-EG هو الوحيد GA لـGemini-TTS؛ ar-001 لا يزال Preview
  recommended_language: string
}

/**
 * نتيجة معاينة السرد.
 *
 * المسار يُعيد **صوتًا خامًا لا JSON**، فالعميل يبني هذا الكائن من الجسم
 * وترويسات `X-Tts-*`. الحقول مصدرها الخادم لا افتراض العميل: قد يختلف الترميز
 * الفعلي عمّا طُلب لأن نقل ai_studio يُعيد WAV دائمًا.
 */
export interface TtsPreviewResult {
  /// عنوان blob محليّ صالح لعنصر <audio>. يجب تحريره بـrevokeObjectURL.
  url: string
  mimeType: string
  bytes: number
  transport: string
  model: string
  voice: string
  /// نفس الـblob الذي بُني منه `url`، محتفَظًا به لحفظه لاحقًا في مكتبة
  /// الوسائط دون توليد جديد.
  blob: Blob
}

/* ----------------------------------------------------- الإتقان والمحاولات */

/**
 * مستويات الإتقان، مطابقة لقيد CHECK على `mastery.level` في المهاجرة 0001.
 *
 * `needs_review` ليس موقعًا على السلّم بل علامة تراجع، ولذلك يأتي آخرًا في
 * الترتيب لا بين `assisted` و`independent`.
 */
export type MasteryLevel =
  | 'not_started'
  | 'introduced'
  | 'practicing'
  | 'assisted'
  | 'independent'
  | 'needs_review'

/**
 * ملخّص الإتقان لهدف تعليمي واحد.
 *
 * يجيب سؤال «أي هدف يتعثّر فيه الأطفال». `success_rate` يُحسب في الخادم لأن
 * القسمة تحتاج كل الصفوف؛ حسابها بعد الترقيم يعطي نسبة الصفحة لا نسبة الهدف.
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
  /// `null` عند غياب المحاولات: «لا بيانات» ليست «نسبة نجاح صفر»
  success_rate: number | null
  last_attempt_at: string | null
}

/// ملخّص الإتقان لطفل واحد. يجيب سؤال «من يحتاج مساعدة».
export interface MasteryByChild {
  child_id: string
  /// كُنية لا اسم قانوني. `adminFamilyProjection` يكشفها بالفعل للوحة.
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
 * محاولة واحدة من جدول `attempts`.
 *
 * عمود `answers` لا يُعاد من الخادم عن قصد: حجمه غير محدود ولا يفيد لوحة
 * الإدارة بقدر ما يوسّع سطح تعرّض بيانات الأطفال.
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
  /// `null` عندما لا يكون للدرجة سقف: score بلا max_score لا يقبل نسبة مئوية
  score_percent: number | null
  time_spent_seconds: number
  help_used: boolean
  created_at: string
}

/// قائمة الأهداف تُرفق المستويات المتاحة مع الترقيم، فلا تُكرَّر في الواجهة.
export interface MasteryByObjectiveMeta extends PaginationMeta {
  levels: MasteryLevel[]
}

export interface MasteryByObjectiveEnvelope extends ApiEnvelope<MasteryByObjective[]> {
  meta: MasteryByObjectiveMeta
}

/* --------------------------------------------- فحص الجودة والتصدير (النسخ) */

/**
 * الأنواع القابلة للفحص والتصدير.
 *
 * `story` و`book` كيانان مختلفان لا مترادفان: `stories` له صفحات في جدول
 * `story_pages`، و`books` يخزّن صفحاته في عمود JSON. كان الخادم يقرأ `story`
 * من جدول `books` فلا ينجح الفحص على أي مدخل صحيح.
 */
export type QualityEntityType = 'series' | 'story' | 'book' | 'game' | 'project'

/**
 * جاهزية النشر الموحّدة: `GET /admin/publish-readiness/:type/:id`.
 *
 * تشمل `episode` بخلاف `QualityEntityType` لأن بوابة النشر تفحص الحلقة فعليًا
 * (فيديو، مصغّرة، صوت عربي، السلسلة الأمّ)، بينما فحوص الجودة القديمة لا تعرف
 * الحلقات إطلاقًا. النوعان مفصولان عن قصد فلا يُدَّعى وجود فحص جودة للحلقة.
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

/// جسم رفض النشر بـ409. نفس شكل نتيجة الجاهزية منقوصًا من الفحوص الناجحة.
export interface PublishRefusal {
  entity_type: PublishableEntityType
  entity_id: string
  publishable: false
  blockers: PublishGateFinding[]
  warnings: PublishGateFinding[]
}

// --- سياسة الإتاحة الجغرافية ------------------------------------------------

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
  /// explicit ⇒ مُلغاة على العنصر · inherited ⇒ موروثة · default ⇒ لا سياسة
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

// --- محرك سير العمل ---------------------------------------------------------

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
  /// محسوبة على الخادم بنفس دالة الفرض، فالزر المعطَّل يطابق ما سيرفضه الخادم.
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
 * قراءة حيّة لأجهزة عائلة من FamilyState لا من إسقاط D1.
 *
 * الفرق ليس تجميليًا: الإسقاط يتغذّى من طابور فهو متأخّر بطبيعته، ومحادثة الدعم
 * تجري في الحاضر. `revoke_available` تبقى false لأن `POST /devices/revoke` في
 * الـDO يتحقّق من جلسة والٍ فعليًا، فلا مسار إداري له — والإعلان عن ذلك في
 * الجسم يمنع الواجهة من تقديم قراءة حيّة وسحبًا كأنهما متاحان معًا.
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

// --- تذاكر الدعم -------------------------------------------------------------

export type TicketCategory =
  | 'billing' | 'subscription' | 'playback' | 'downloads' | 'account'
  | 'device' | 'child_profile' | 'content' | 'privacy' | 'bug' | 'other'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed'
export type TicketAction =
  | 'entitlement_resync' | 'subscription_resync' | 'restore_purchase'
  | 'device_revoke' | 'pin_reset' | 'account_recovery' | 'manual_note'

/// حالة SLA محسوبة على الخادم: ساعتان منفصلتان (أول ردّ، الحلّ) وسببها نصًّا.
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
  /// الإجراءات التي يمكن للمنصّة تنفيذها فعلًا اليوم.
  supported_actions: TicketAction[]
  /// وسببُ تعذّر كل إجراء غير متاح، نصًّا يقرأه المشغّل.
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
  /// جدول الانتقالات المسموحة، من `lib/supportCrm.ts` في الخادم.
  ///
  /// يأتي من الخادم لا يُكتب في العميل: لوحة الكانبان تحتاج معرفة الأعمدة
  /// المسموحة قبل بدء السحب، ونسخة في العميل كانت ستصير تعريفًا ثانيًا لسير
  /// العمل ينحرف عن الأول عند إضافة أي حالة.
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

// --- مركز الإنتاج ------------------------------------------------------------

export type ProductionRequirementKey =
  | 'script' | 'educational' | 'translation_ar' | 'translation_en' | 'translation_fr'
  | 'voice_ar' | 'voice_en' | 'voice_fr' | 'artwork' | 'video' | 'thumbnail'
  | 'captions' | 'qa' | 'publish'

export type RequirementState =
  | 'ready' | 'partial' | 'in_progress' | 'missing' | 'blocked' | 'not_applicable'

/**
 * صفّ متطلب واحد.
 *
 * الحالة مشتقّة على الخادم من الأصول نفسها ولا تُكتب من الواجهة: لا حقل حالة في
 * أي مسار. ما يُكتب هو الطبقة البشرية فقط (مسؤول، فريق، استحقاق، عائق، ملاحظة).
 */
export interface ProductionRequirementRow {
  key: ProductionRequirementKey
  label_ar: string
  state: RequirementState
  /// نسبة حقيقية فقط حين يوجد مقام (صفحات القصة مثلًا)، وإلا null.
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
 * حالة تشغيل مصنع المحتوى. هذه دورة تشغيل وليست حالة نشر المحتوى، لذلك لا
 * تستخدم ContentStatus ولا StatusBadge الخاص بالكتالوج.
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

/** الخطة الثابتة فقط؛ بيانات المحاولات والمفاتيح ونتائج المزود ليست جزءًا منها. */
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

/// قسم تعذّر تحميله. يُعرض بسببه لا كقسم فارغ: «تعذّر الوصول» و«لا بيانات»
/// جوابان مختلفان، وأحدهما فقط يعني أن العائلة لا تستطيع الدخول.
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
  device_count: number
  open_tickets: number
}

export interface Customer360 {
  family: { parent_id: string; plan: string; status: string }
  authority: FamilyAuthorityState | UnavailableSection
  children: Array<{
    child_id: string; nickname: string | null; age_track: string | null
    status: string; last_event_at_ms: number
  }>
  devices_projection: Array<{
    id: string; display_name: string | null; platform: string; status: string; last_seen_at: string
  }>
  billing: Array<{
    product_id: string; plan: string; entitlement_status: string
    expires_at_ms: number | null; created_at: string
  }>
  purchases: Array<{
    product_id: string; purchase_state: string; purchased_at: string | null
    expires_at: string | null; last_verified_at: string; created_at: string
  }>
  tickets: Array<{
    id: string; reference: string; subject: string; category: string; priority: string
    status: string; assignee_id: string | null; first_response_at: string | null
    resolution_due_at: string | null; created_at: string
  }>
  audit: Array<{ action: string; entity_type: string; entity_id: string; actor_id: string; created_at: string }>
  consents: unknown[] | UnavailableSection
  progress_summary: { records: number } | { available: false; reason: string }
}

/// فحص واحد. `message` جاهزة للعرض بالعربية من الخادم، وتحمل السبب لا الحكم فقط.
export interface QualityCheck {
  check: string
  passed: boolean
  message: string
}

/**
 * نتيجة فحص الجاهزية.
 *
 * `readyToPublish` مبنيّ على بوابات النشر نفسها التي يفرضها
 * `PATCH /stories/:id` — لا على قواعد موازية. نسختان من «هل هذا جاهز» تتباعدان،
 * فتُعطي الأضعف إذنًا ترفضه الأخرى بـ409 عند النشر الفعلي.
 */
export interface QualityReport {
  entity_type: QualityEntityType
  entity_id: string
  checks: QualityCheck[]
  allPassed: boolean
  readyToPublish: boolean
}

/// ملف النسخة المُصدَّرة. الحقول تتبع جدول الكيان، فتُقرأ كسجل مفتوح.
export interface BackupExport extends Record<string, unknown> {
  entity_type: QualityEntityType
  exported_at: string
  version: number
}


// --- إدارة الموقع العام والمدوّنة و SEO ---------------------------------------

/**
 * لغات المحتوى العام. ثلاث لغات، والعربية هي الأصل ومنها `x-default`.
 *
 * الاتجاه مشتقّ لا مُخزَّن: `dir` قيمة واحدة لكل لغة، وتخزينها في الصفوف يسمح
 * بصفحة عربية موسومة `ltr` — وهي حالة لا معنى لها ولا وسيلة لتصحيحها بعد الحفظ.
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

/// قسم صفحة كما يعيده الخادم: المحتوى و CTA نصّان JSON، لا كائنان.
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

/// قسم داخل المحرِّر: نفس الصفّ بعد تحليل الـJSON، مع مفتاح محلّي للسحب والترتيب.
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

/// كتلة داخل المحرِّر. `key` محلّي فقط ولا يُرسَل إلى الخادم.
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
 * تدقيق SEO الداخلي.
 *
 * `index_status_available` تبقى false ويجب أن تُعرض كذلك: التدقيق يثبت ما في
 * قاعدة البيانات ولا يعرف شيئًا عن فهرسة محرّكات البحث. خلط الاثنين على شاشة
 * واحدة يجعل «صفر أخطاء» تُقرأ كـ«الموقع مفهرس»، وهما ادّعاءان مختلفان.
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
  /// حالة خريطة الموقع. لا تاريخ توليد: تُولَّد عند كل طلب من قاعدة البيانات.
  sitemap: {
    generated_on_request: boolean
    included_urls: number
    excluded_unpublished: number
    noindex_published: number
  }
  /// ما يفحصه التدقيق وما لا يفحصه، بالاسم والسبب.
  coverage: Array<{ id: string; implemented: boolean; note: string | null }>
  source: string
  index_status_available: boolean
  index_status_note: string
}

export interface SeoSlugCheck {
  available: boolean
  reason: string | null
}

// --- اللوحة التنفيذية --------------------------------------------------------

/**
 * وحدة واحدة في اللوحة التنفيذية.
 *
 * كل وحدة تحمل مصدرها والمسار الذي تُفصَّل فيه: رقم بلا مكان يُفتح فيه هو رقم لا
 * يمكن التصرّف بناءً عليه، وهو ما جعل اللوحة السابقة تُقرأ ولا تُستخدم.
 * `unavailable` تُستخدم حين لا تكون البيانات موجودة أصلًا، فتُعلَن ولا تُصفَّر:
 * صفر ملفّق أخطر من فراغ مُعلَن.
 */
export interface ExecutiveMetric {
  key: string
  label_ar: string
  label_en: string
  /// `null` يعني «لا يمكن معرفته»، لا صفرًا.
  ///
  /// كان الخادم يُنهي كل عدّ بـ`?? 0`، فمصدر غير مقروء يُعرَض رقمًا حقيقيًّا. الآن
  /// المقياس الذي تعذّر حسابه يحمل `null` وسببه في `unavailable`، والواجهة تطبع
  /// شرطة لا صفرًا ولا تفتح له شاشة مفلترة.
  value: number | null
  tone: 'neutral' | 'good' | 'warn' | 'danger'
  /// سبب تعذّر الحساب، أو null حين توجد قيمة.
  unavailable?: string | null
  /// الفترة التي يعنيها الرقم، مُعلَنة بدل أن تُفترَض.
  window?: string
  /// المسار داخل اللوحة الذي يعرض هذه المجموعة بالضبط، بفلاترها
  drill: string | null
  /// طلب القائمة الذي يُعيد المجموعة نفسها بالحرف.
  drill_api?: string
  /// `exact` أي أن الوجهة تُعيد العدد نفسه؛ `related` تتطلّب `note` يشرح الفرق.
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
  /// ما لا تستطيع هذه اللوحة قوله، ولماذا.
  limits: string[]
}

// --- البحث الشامل (adminSearch.ts) ------------------------------------------

export interface GlobalSearchResult {
  id: string
  type: string
  title: string
  subtitle: string | null
  status: string | null
  /// مسار نسبي داخل اللوحة. القاعدة تُضاف بـ`adminPath()` في العميل، فالخادم
  /// لا يعرف مسار اللوحة ولا يجب أن يعرفه.
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
  /// أنواع في برنامج العمل بلا جدول في أي مهاجرة. تُعرض كتصريح لا كنتيجة فارغة.
  unavailable: Array<{ type: string; reason: string }>
  /// مصادر فشلت في هذا النداء. مصدر واحد فاشل لا يُفرِّغ اللوحة.
  failed: Array<{ type: string; reason: string }>
  scope: {
    restricted: boolean
    omitted_types: Array<{ type: string; reason: string }>
  }
  min_length?: number
  types: Array<{ type: string; group: 'catalogue' | 'platform' }>
}

// --- تقويم المحتوى (adminCalendar.ts) ---------------------------------------

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
  /// خطأ أن يُرسم المجدول كأن مؤقّتًا سينشره: لا مُشغِّل دوري للنشر.
  scheduler_available: boolean
  scheduler_note: string
}
