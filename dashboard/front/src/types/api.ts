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
  episode_count: number
  episodes_count?: number
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
  transition: string
  sort_order: number
  localizations: StoryPageLocalization[]
  bubbles: StoryBubbleRecord[]
}

export interface StoryDetail extends StoryRecord {
  pages: StoryPageRecord[]
  assets: AssetRecord[]
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
  targeting: Record<string, unknown>
  config: Record<string, unknown>
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

/** نتيجة معاينة الصفحة الرئيسية بعد تطبيق الاستهداف */
export interface HomePreviewEnvelope {
  blocks: HomeBlockRecord[]
  meta: {
    track: string
    country: string
    platform: string
    plan: string
    isNewUser: boolean
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

/* --------------------------------------------------------- مراجعات المحتوى */

/**
 * أنواع الكيانات القابلة للمراجعة.
 *
 * `story` غائب عن قصد: الـCHECK في D1 هو
 * `entity_type IN ('series','episode','book','game','project')`، فصفّ مراجعة
 * لقصة يفشل القيد. توسيعه يحتاج مهاجرة وإعادة بناء الجدول.
 */
export type ReviewEntityType = 'series' | 'episode' | 'book' | 'game' | 'project'
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
