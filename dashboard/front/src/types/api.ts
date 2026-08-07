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
  sort_order: number
  is_active?: boolean
  series_count?: number
  assets_count?: number
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
  duration_seconds?: number | null
  age_min: number
  age_max: number
  track_ids: AgeTrack[]
  objective_title?: string | null
  parent_guide_ar?: string | null
  family_activity_ar?: string | null
  status: ContentStatus
  is_free: boolean
  is_published: boolean
  created_at: string
  updated_at: string
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
  assets: unknown[]
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
  assets: unknown[]
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
  assets: unknown[]
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