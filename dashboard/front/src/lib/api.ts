import type {
  ApiEnvelope,
  AssetLinkPayload,
  AssetRecord,
  AssetStats,
  CategoryRecord,
  CharacterRecord,
  ChildPayload,
  ChildRecord,
  DashboardStats,
  EpisodePayload,
  EpisodeRecord,
  PaginatedEnvelope,
  ParentRecord,
  Planet,
  SeasonRecord,
  SeriesPayload,
  SeriesRecord,
  StoryBubbleRecord,
  StoryDetail,
  StoryPageLocalization,
  StoryPageRecord,
  StoryRecord,
  VisualStyleRecord,
} from '../types/api'
import { readAdminActor, readAdminToken } from './adminSession'

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const DIRECT_UPLOAD_LIMIT = 95 * 1024 * 1024

export class ApiError extends Error {
  status: number
  /**
   * أسباب الرفض المفصَّلة كما أرسلها الخادم في `details`.
   *
   * مسار حفظ اللعبة يرفض حزمة غير صالحة بـ`{ error, details: [...] }` حيث
   * `details` كل خطأ في الحزمة على حدة. كانت تُهمَل هنا فيرى المحرّر «حزمة غير
   * صالحة» بلا أي إشارة إلى أي مستوى ولا أي قاعدة — وهي بالضبط الحالة التي
   * وُجدت شاشة الجاهزية لإنهائها. تبقى مصفوفة فارغة لبقية المسارات.
   */
  details: string[]

  /**
   * جسم الرفض كما أرسله الخادم، حين يكون مركّبًا لا نصًّا.
   *
   * بوابة النشر ترفض بـ409 وتُعيد `data.blockers` — كل عائق بحالته ومالكه
   * والإجراء المطلوب. تسطيحه إلى رسالة واحدة يعيد بالضبط المشكلة التي بُنيت
   * البوابة لإنهائها: «تعذر النشر» بلا سبب قابل للتنفيذ. يبقى `null` لبقية
   * المسارات فلا يتغيّر سلوك أي متصل قائم.
   */
  payload: unknown

  constructor(message: string, status: number, details: string[] = [], payload: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
    this.payload = payload
  }
}

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function authorizedHeaders(initial?: HeadersInit) {
  const headers = new Headers(initial)
  headers.set('Accept', 'application/json')
  // القراءة عبر lib/adminSession.ts لا مباشرة من sessionStorage: هناك مكان
  // واحد يكتب المفتاح ويقرأه، فلا يعود ممكنًا أن تُرسل الترويسة فارغة كما كان
  // يحدث قبل وجود شاشة الدخول.
  const sessionToken = readAdminToken()
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`)
  headers.set('X-Admin-Actor', readAdminActor())
  return headers
}

async function responseError(response: Response) {
  const payload = await response.clone().json().catch(() => null) as { error?: string; details?: unknown; data?: unknown } | null
  const fallbackMessage = document.documentElement.lang === 'en' ? 'Unable to complete the request' : 'تعذر إكمال الطلب'
  const details = Array.isArray(payload?.details)
    ? payload.details.filter((item): item is string => typeof item === 'string')
    : []
  return new ApiError(payload?.error || fallbackMessage, response.status, details, payload?.data ?? null)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = authorizedHeaders(init?.headers)
  if (init?.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<T>
}

async function rawRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers: authorizedHeaders(init.headers) })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<T>
}

async function imageDimensions(file: File) {
  if (!file.type.startsWith('image/')) return null
  try {
    const bitmap = await createImageBitmap(file)
    const result = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return result
  } catch {
    return null
  }
}

async function uploadAssetFile(assetId: string, file: File) {
  const dimensions = await imageDimensions(file)
  if (file.size <= DIRECT_UPLOAD_LIMIT) {
    const headers = new Headers({
      'Content-Type': file.type || 'application/octet-stream',
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Size': String(file.size),
    })
    if (dimensions) {
      headers.set('X-Image-Width', String(dimensions.width))
      headers.set('X-Image-Height', String(dimensions.height))
    }
    return rawRequest<ApiEnvelope<{ id: string; status: string; r2_key: string }>>(`/admin/assets/${assetId}/content`, { method: 'PUT', headers, body: file })
  }

  const session = await request<ApiEnvelope<{ id: string; part_size: number }>>('/admin/asset-upload-sessions', {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId, filename: file.name, size_bytes: file.size, mime_type: file.type }),
  })
  const partSize = session.data.part_size
  let partNumber = 1
  for (let offset = 0; offset < file.size; offset += partSize) {
    const part = file.slice(offset, Math.min(offset + partSize, file.size))
    await rawRequest(`/admin/asset-upload-sessions/${session.data.id}/parts/${partNumber}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Part-Size': String(part.size) },
      body: part,
    })
    partNumber += 1
  }
  return request<ApiEnvelope<{ asset_id: string; status: string }>>(`/admin/asset-upload-sessions/${session.data.id}/complete`, {
    method: 'POST', body: JSON.stringify({}),
  })
}

/**
 * يولّد معاينة سرد ويُعيد عنوان blob صالحًا لعنصر <audio>.
 *
 * ## لماذا لا يمرّ عبر `request`
 *
 * المسار يُعيد **صوتًا خامًا لا JSON**: الجسم هو بايتات MP3 أو WAV، والبيانات
 * الوصفية في ترويسات `X-Tts-*`. تمريره على `request` يعني `response.json()` على
 * صوت، وهو رمي مؤكَّد.
 *
 * الأخطاء تبقى JSON، فـ`responseError` يعمل كما هو ويستخرج `error` و`detail`.
 *
 * المتصل مسؤول عن `URL.revokeObjectURL(url)`: كل معاينة تحتجز ذاكرة حتى تُحرَّر،
 * وتوليد عشر معاينات بلا تحرير يُبقي عشرة ملفات صوتية في ذاكرة التبويب.
 */
async function ttsPreview(payload: {
  text: string
  prompt?: string
  voice: string
  language_code: string
  model?: string
  encoding?: import('../types/api').TtsEncoding
}): Promise<import('../types/api').TtsPreviewResult> {
  const headers = authorizedHeaders()
  headers.set('Content-Type', 'application/json')
  const response = await fetch(`${API_ROOT}/admin/tts/preview`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw await responseError(response)

  const blob = await response.blob()
  return {
    url: URL.createObjectURL(blob),
    // النوع من الخادم لا من الطلب: نقل ai_studio يُعيد WAV مهما طُلب
    mimeType: response.headers.get('Content-Type') ?? blob.type ?? 'audio/mpeg',
    bytes: blob.size,
    transport: response.headers.get('X-Tts-Transport') ?? '—',
    model: response.headers.get('X-Tts-Model') ?? '—',
    voice: response.headers.get('X-Tts-Voice') ?? payload.voice,
    /// المتصل يحتفظ بالـblob نفسه لحفظه لاحقًا دون توليد جديد: الحفظ يجب أن
    /// يخزّن ما سمعه المحرّر بالضبط في المعاينة، لا نداءً ثانيًا لـGoogle قد
    /// يُعيد أداءً مختلفًا لنفس النص.
    blob,
  }
}

/**
 * يحفظ سردًا سبقت معاينته إلى مكتبة الوسائط، بلا نداء جديد لـGoogle.
 *
 * يرسل بايتات الصوت نفسها التي عاينها المحرّر (`result.blob` من `ttsPreview`)
 * كجسم خام، والبيانات الوصفية في ترويسات `X-Narration-*` بدل JSON، لأن
 * الجسم هنا صوت لا نص. الرؤية دائمًا خاصة من الخادم؛ لا حقل رؤية يُرسَل هنا.
 */
async function saveNarrationAsset(payload: {
  title: string
  blob: Blob
  voice: string
  language: string
  model: string
  transport: string
}) {
  const headers = authorizedHeaders()
  headers.set('Content-Type', payload.blob.type || 'audio/mpeg')
  headers.set('Content-Length', String(payload.blob.size))
  headers.set('X-Narration-Title', encodeURIComponent(payload.title))
  headers.set('X-Narration-Voice', payload.voice)
  headers.set('X-Narration-Language', payload.language)
  headers.set('X-Narration-Model', payload.model)
  headers.set('X-Narration-Transport', payload.transport)
  const response = await fetch(`${API_ROOT}/admin/tts/assets`, {
    method: 'POST',
    headers,
    body: payload.blob,
  })
  if (!response.ok) throw await responseError(response)
  return response.json() as Promise<ApiEnvelope<{ id: string; status: string; r2_key: string }>>
}

export const api = {
  dashboard: () => request<ApiEnvelope<DashboardStats>>('/admin/dashboard/stats'),

  planets: () => request<ApiEnvelope<Planet[]>>('/planets'),
  cmsPlanets: (includeInactive = false) => request<ApiEnvelope<Planet[]>>(`/admin/planets${queryString({ include_inactive: includeInactive ? 1 : undefined })}`),
  /// تفصيل كوكب واحد مع سلاسله وتصنيفاته. أُضيف لأن الصفحة كانت بلا أي مسار
  /// GET by :id، فيستحيل بناء مساحة عمل مخصّصة لكوكب واحد (DASHBOARD v3 UX-8).
  planetDetail: (id: string) => request<ApiEnvelope<import('../types/api').PlanetDetail>>(`/admin/planets/${encodeURIComponent(id)}`),
  createPlanet: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/planets', { method: 'POST', body: JSON.stringify(payload) }),
  updatePlanet: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/planets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archivePlanet: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/planets/${id}`, { method: 'DELETE' }),

  categories: (includeInactive = false) => request<ApiEnvelope<CategoryRecord[]>>(`/admin/categories${queryString({ include_inactive: includeInactive ? 1 : undefined })}`),
  createCategory: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveCategory: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/categories/${id}`, { method: 'DELETE' }),
  setSeriesCategories: (id: string, categoryIds: string[], primaryCategoryId?: string) => request<ApiEnvelope<{ id: string }>>(`/admin/series/${id}/categories`, { method: 'PUT', body: JSON.stringify({ category_ids: categoryIds, primary_category_id: primaryCategoryId }) }),

  visualStyles: (includeInactive = false) => request<ApiEnvelope<VisualStyleRecord[]>>(`/admin/visual-styles${queryString({ include_inactive: includeInactive ? 1 : undefined })}`),
  createVisualStyle: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/visual-styles', { method: 'POST', body: JSON.stringify(payload) }),
  updateVisualStyle: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/visual-styles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveVisualStyle: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/visual-styles/${id}`, { method: 'DELETE' }),

  series: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<SeriesRecord>>(`/admin/series${queryString(filters)}`),
  seriesDetail: (id: string) => request<ApiEnvelope<import('../types/api').SeriesDetail>>(`/admin/series/${encodeURIComponent(id)}`),
  createSeries: (payload: SeriesPayload) => request<ApiEnvelope<{ id: string }>>('/admin/series', { method: 'POST', body: JSON.stringify(payload) }),
  updateSeries: (id: string, payload: Partial<SeriesPayload> & { status?: string }) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/series/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  publishSeries: (id: string) => request<ApiEnvelope<{ id: string; status: 'published'; published: boolean }>>(`/admin/series/${id}/publish`, { method: 'POST' }),
  archiveSeries: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/series/${id}`, { method: 'DELETE' }),

  seasons: (seriesId?: string) => request<ApiEnvelope<SeasonRecord[]>>(`/admin/seasons${queryString({ series_id: seriesId })}`),
  seasonDetail: (id: string) => request<ApiEnvelope<import('../types/api').SeasonDetail>>(`/admin/seasons/${encodeURIComponent(id)}`),
  createSeason: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/seasons', { method: 'POST', body: JSON.stringify(payload) }),
  updateSeason: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/seasons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveSeason: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/seasons/${id}`, { method: 'DELETE' }),

  episodes: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<EpisodeRecord>>(`/admin/episodes${queryString(filters)}`),
  episodeDetail: (id: string) => request<ApiEnvelope<EpisodeRecord>>(`/admin/episodes/${encodeURIComponent(id)}`),
  createEpisode: (payload: EpisodePayload) => request<ApiEnvelope<{ id: string }>>('/admin/episodes', { method: 'POST', body: JSON.stringify(payload) }),
  updateEpisode: (id: string, payload: Partial<EpisodePayload> & { status?: string }) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/episodes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  publishEpisode: (id: string) => request<ApiEnvelope<{ id: string; status: 'published'; published: boolean }>>(`/admin/episodes/${id}/publish`, { method: 'POST' }),
  archiveEpisode: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/episodes/${id}`, { method: 'DELETE' }),

  characters: (seriesId?: string) => request<ApiEnvelope<CharacterRecord[]>>(`/admin/characters${queryString({ series_id: seriesId })}`),
  character: (id: string) => request<ApiEnvelope<import('../types/api').CharacterDetail>>(`/admin/characters/${encodeURIComponent(id)}`),
  createCharacter: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/characters', { method: 'POST', body: JSON.stringify(payload) }),
  updateCharacter: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/characters/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveCharacter: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/characters/${id}`, { method: 'DELETE' }),

  gameEngines: () => request<ApiEnvelope<import('../types/api').GameEngineRecord[]>>('/admin/game-engines'),

  books: (filters: Record<string, string | number | undefined> = {}) => request<ApiEnvelope<import('../types/api').BookRecord[]>>(`/admin/books${queryString(filters)}`),
  book: (id: string) => request<ApiEnvelope<import('../types/api').BookDetail>>(`/admin/books/${id}`),
  createBook: (payload: import('../types/api').BookPayload) => request<ApiEnvelope<{ id: string; status: string }>>('/admin/books', { method: 'POST', body: JSON.stringify(payload) }),
  updateBook: (id: string, payload: Partial<import('../types/api').BookPayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/books/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveBook: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/books/${id}`, { method: 'DELETE' }),

  games: (filters: Record<string, string | number | undefined> = {}) => request<ApiEnvelope<import('../types/api').GameRecord[]>>(`/admin/games${queryString(filters)}`),
  game: (id: string) => request<ApiEnvelope<import('../types/api').GameDetail>>(`/admin/games/${id}`),
  createGame: (payload: import('../types/api').GamePayload) => request<ApiEnvelope<{ id: string; status: string }>>('/admin/games', { method: 'POST', body: JSON.stringify(payload) }),
  updateGame: (id: string, payload: Partial<import('../types/api').GamePayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/games/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveGame: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/games/${id}`, { method: 'DELETE' }),

  // استوديو الرسم. المسارات الأربعة موجودة في routes/adminGames.ts، واثنان منها
  // (الجاهزية والمعاينة) كانا بلا أي مستدعٍ في الواجهة: كانت `content_pack`
  // تُحرَّر كنصّ JSON خام، فلا يرى المحرّر ما يمنع النشر ولا ما سيراه الطفل.
  // المعاينة تُعيد الحزمة المخزَّنة كما هي، فلا نموذج معاينة ثانٍ ينحرف عنها.
  gameReadiness: (id: string) => request<ApiEnvelope<import('../types/gamePack').GameReadiness>>(`/admin/games/${encodeURIComponent(id)}/readiness`),
  gamePreview: (id: string, language?: string) => request<ApiEnvelope<import('../types/gamePack').GamePreview>>(`/admin/games/${encodeURIComponent(id)}/preview${queryString({ language })}`),
  gameLocalizations: (id: string) => request<ApiEnvelope<import('../types/gamePack').GameLocalizationsEnvelope>>(`/admin/games/${encodeURIComponent(id)}/localizations`),
  saveGameLocalization: (id: string, language: string, payload: import('../types/gamePack').GameLocalizationPayload) => request<ApiEnvelope<import('../types/gamePack').GameLocalizationRecord & { missing_prompt_keys: string[]; unused_prompt_keys: string[]; warnings: string[] }>>(`/admin/games/${encodeURIComponent(id)}/localizations/${encodeURIComponent(language)}`, { method: 'PUT', body: JSON.stringify(payload) }),

  // طوابير الإنتاج والعمليّات والتحليلات. أربعة مسارات للقراءة فقط تجيب على
  // أسئلة لا يستطيع فحص جاهزية لعبة واحدة أن يجيب عنها: ما يجب تسجيله، وما يجب
  // رسمه، وأين تعطّل الكتالوج، وهل تُلعَب الألعاب الموجودة. المرشِّحات معاملات
  // استعلام لا مسارات منفصلة، كما يقبلها الخادم.
  gameAudioQueue: (filters: { language?: string; status?: string; production_status?: string; required?: string } = {}) =>
    request<ApiEnvelope<import('../types/enginePack').AudioQueueEnvelope>>(`/admin/games/production/audio${queryString(filters)}`),
  gameArtQueue: (filters: { role?: string; status?: string; production_status?: string } = {}) =>
    request<ApiEnvelope<import('../types/enginePack').ArtQueueEnvelope>>(`/admin/games/production/art${queryString(filters)}`),
  gamesOps: () => request<ApiEnvelope<import('../types/enginePack').GamesOpsOverview>>('/admin/games/ops'),
  gamesAnalytics: (filters: { since?: string } = {}) =>
    request<ApiEnvelope<import('../types/enginePack').GameAnalyticsEnvelope>>(`/admin/games/analytics${queryString(filters)}`),

  projects: (filters: Record<string, string | number | undefined> = {}) => request<ApiEnvelope<import('../types/api').ProjectRecord[]>>(`/admin/projects${queryString(filters)}`),
  project: (id: string) => request<ApiEnvelope<import('../types/api').ProjectDetail>>(`/admin/projects/${id}`),
  createProject: (payload: import('../types/api').ProjectPayload) => request<ApiEnvelope<{ id: string; status: string }>>('/admin/projects', { method: 'POST', body: JSON.stringify(payload) }),
  updateProject: (id: string, payload: Partial<import('../types/api').ProjectPayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/projects/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveProject: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/projects/${id}`, { method: 'DELETE' }),

  stories: (filters: Record<string, string | number | undefined> = {}) => request<ApiEnvelope<StoryRecord[]>>(`/admin/stories${queryString(filters)}`),
  story: (id: string) => request<ApiEnvelope<StoryDetail>>(`/admin/stories/${id}`),
  createStory: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/stories', { method: 'POST', body: JSON.stringify(payload) }),
  updateStory: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/stories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveStory: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/stories/${id}`, { method: 'DELETE' }),
  createStoryPage: (storyId: string, payload: Partial<StoryPageRecord>) => request<ApiEnvelope<{ id: string }>>(`/admin/stories/${storyId}/pages`, { method: 'POST', body: JSON.stringify(payload) }),
  updateStoryPage: (id: string, payload: Partial<StoryPageRecord>) => request<ApiEnvelope<{ id: string }>>(`/admin/story-pages/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteStoryPage: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/story-pages/${id}`, { method: 'DELETE' }),
  savePageLocalization: (pageId: string, language: string, payload: Partial<StoryPageLocalization>) => request<ApiEnvelope<{ page_id: string }>>(`/admin/story-pages/${pageId}/localizations/${language}`, { method: 'PUT', body: JSON.stringify(payload) }),
  createBubble: (pageId: string, payload: Partial<StoryBubbleRecord>) => request<ApiEnvelope<{ id: string }>>(`/admin/story-pages/${pageId}/bubbles`, { method: 'POST', body: JSON.stringify(payload) }),
  updateBubble: (id: string, payload: Partial<StoryBubbleRecord>) => request<ApiEnvelope<{ id: string }>>(`/admin/story-bubbles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteBubble: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/story-bubbles/${id}`, { method: 'DELETE' }),

  assets: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<AssetRecord>>(`/admin/assets${queryString(filters)}`),
  asset: (id: string) => request<ApiEnvelope<import('../types/api').AssetDetail>>(`/admin/assets/${encodeURIComponent(id)}`),
  assetStats: () => request<ApiEnvelope<AssetStats>>('/admin/assets/stats'),
  createAsset: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/assets', { method: 'POST', body: JSON.stringify(payload) }),
  updateAsset: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveAsset: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/assets/${id}`, { method: 'DELETE' }),
  importAssetCatalog: (catalog: string) => request<ApiEnvelope<{ total: number; created: number; updated: number }>>('/admin/assets/import-catalog', { method: 'POST', body: JSON.stringify({ catalog }) }),
  setAssetLinks: (id: string, links: AssetLinkPayload[]) => request<ApiEnvelope<{ id: string }>>(`/admin/assets/${id}/links`, { method: 'PUT', body: JSON.stringify({ links }) }),
  uploadAssetFile,
  assetBlob: async (id: string) => {
    const response = await fetch(`${API_ROOT}/admin/assets/${id}/content`, { headers: authorizedHeaders() })
    if (!response.ok) throw await responseError(response)
    return response.blob()
  },

  parents: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<ParentRecord>>(`/admin/parents${queryString(filters)}`),
  /// تفصيل ولي أمر واحد مع أطفاله من family_projection. كان بلا مستدعٍ.
  parentDetail: (id: string) => request<ApiEnvelope<import('../types/api').ParentDetail>>(`/admin/parents/${encodeURIComponent(id)}`),
  children: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<ChildRecord>>(`/admin/children${queryString(filters)}`),
  createChild: (payload: ChildPayload) => request<ApiEnvelope<{ id: string; age: number; age_track: string }>>('/admin/children', { method: 'POST', body: JSON.stringify(payload) }),
  updateChild: (id: string, payload: Partial<ChildPayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/children/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveChild: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/children/${id}`, { method: 'DELETE' }),
  partnerships: (filters: Record<string, string | number | undefined> = {}) => request<import('../types/api').PartnershipListEnvelope>(`/admin/partnerships${queryString(filters)}`),
  updatePartnership: (id: string, payload: { status?: import('../types/api').PartnershipStatus; admin_note?: string }) => request<ApiEnvelope<import('../types/api').PartnershipRequest>>(`/admin/partnerships/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  resendPartnership: (id: string) => request<ApiEnvelope<{ id: string; emailStatus: string; provider: string }>>(`/admin/partnerships/${id}/resend`, { method: 'POST' }),
  partnershipSettings: () => request<ApiEnvelope<import('../types/api').PartnershipSettingsEnvelope>>('/admin/partnerships/settings'),
  savePartnershipSettings: (payload: Partial<import('../types/api').PartnershipSettings>) => request<ApiEnvelope<{ settings: import('../types/api').PartnershipSettings }>>('/admin/partnerships/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  adminUsers: () => request<ApiEnvelope<import('../types/api').AdminUserRecord[]>>('/admin/users'),
  createAdminUser: (payload: import('../types/api').AdminUserPayload) => request<ApiEnvelope<{ id: string }>>('/admin/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateAdminUser: (id: string, payload: { display_name?: string; is_active?: boolean }) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  resetAdminUserPassword: (id: string, password: string) => request<ApiEnvelope<{ id: string }>>(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  revokeAdminUserSessions: (id: string) => request<ApiEnvelope<{ id: string; revoked: boolean }>>(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }),
  roles: () => request<ApiEnvelope<import('../types/api').RoleRecord[]>>('/admin/roles'),
  permissions: () => request<ApiEnvelope<import('../types/api').PermissionRecord[]>>('/admin/permissions'),
  grants: () => request<ApiEnvelope<import('../types/api').AccessGrantRecord[]>>('/admin/grants'),
  createGrant: (payload: import('../types/api').AccessGrantPayload) => request<ApiEnvelope<{ id: string }>>('/admin/grants', { method: 'POST', body: JSON.stringify(payload) }),
  deleteGrant: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/grants/${id}`, { method: 'DELETE' }),
  teams: () => request<ApiEnvelope<import('../types/api').TeamRecord[]>>('/admin/teams'),
  team: (id: string) => request<ApiEnvelope<import('../types/api').TeamDetail>>(`/admin/teams/${id}`),
  createTeam: (payload: import('../types/api').TeamPayload) => request<ApiEnvelope<{ id: string }>>('/admin/teams', { method: 'POST', body: JSON.stringify(payload) }),
  tasks: () => request<ApiEnvelope<import('../types/api').TaskRecord[]>>('/admin/tasks'),
  workflowRuns: () => request<ApiEnvelope<import('../types/api').WorkflowRunRecord[]>>('/admin/workflows/runs'),
  reviewWorkflowRun: (id: string, payload: { decision: string; comment?: string }) => request<ApiEnvelope<{ id: string }>>(`/admin/workflows/runs/${id}/review`, { method: 'POST', body: JSON.stringify(payload) }),

  /// محرك سير العمل: قوالب ومراحل وتعيينات وقرارات وSLA.
  workflowTemplates: () => request<ApiEnvelope<import('../types/api').WorkflowTemplate[]>>('/admin/workflows/templates'),
  workflowRun: (id: string) => request<ApiEnvelope<import('../types/api').WorkflowRunDetail>>(`/admin/workflows/runs/${encodeURIComponent(id)}`),
  startWorkflowRun: (payload: { content_type: string; content_id: string; template_id: string }) => request<ApiEnvelope<{ run_id: string }>>('/admin/workflows/runs', { method: 'POST', body: JSON.stringify(payload) }),
  assignWorkflowStage: (runId: string, stageKey: string, payload: { assignee_id?: string | null; assignee_team_id?: string | null; due_at?: string | null }) => request<ApiEnvelope<{ run_id: string }>>(`/admin/workflows/runs/${encodeURIComponent(runId)}/stages/${encodeURIComponent(stageKey)}/assign`, { method: 'POST', body: JSON.stringify(payload) }),
  decideWorkflowStage: (runId: string, stageKey: string, payload: { decision: import('../types/api').WorkflowDecision; comment?: string }) => request<ApiEnvelope<{ run_status: string }>>(`/admin/workflows/runs/${encodeURIComponent(runId)}/stages/${encodeURIComponent(stageKey)}/decision`, { method: 'POST', body: JSON.stringify(payload) }),
  workflowOverdue: () => request<PaginatedEnvelope<import('../types/api').WorkflowOverdueRow>>('/admin/workflows/overdue'),
  workflowMyStages: () => request<PaginatedEnvelope<import('../types/api').WorkflowMyStage>>('/admin/workflows/my-stages'),
  devices: () => request<ApiEnvelope<import('../types/api').AdminDeviceRecord[]>>('/admin/devices'),
  plans: () => request<ApiEnvelope<import('../types/api').PlansCatalogue>>('/admin/plans'),
  rights: () => request<ApiEnvelope<import('../types/api').RightsLicenseRecord[]>>('/admin/rights'),
  createRight: (payload: import('../types/api').RightsLicensePayload) => request<ApiEnvelope<{ id: string }>>('/admin/rights', { method: 'POST', body: JSON.stringify(payload) }),
  remoteConfig: () => request<ApiEnvelope<import('../types/api').RemoteConfigRecord[]>>('/admin/remote-config'),
  saveRemoteConfig: (key: string, payload: { value: unknown; rollout_percent?: number; targeting?: Record<string, unknown> }) => request<ApiEnvelope<{ key: string; rollout_percent: number }>>(`/admin/remote-config/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  featureFlags: () => request<ApiEnvelope<import('../types/api').FeatureFlagRecord[]>>('/admin/feature-flags'),
  homeExperience: () => request<ApiEnvelope<import('../types/api').HomeBlockRecord[]>>('/admin/home-experience'),
  createHomeBlock: (payload: { block_type: string; title_ar?: string | null }) => request<ApiEnvelope<{ id: string }>>('/admin/home-experience', { method: 'POST', body: JSON.stringify(payload) }),
  updateHomeBlock: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/home-experience/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  reorderHomeBlocks: (order: string[]) => request<ApiEnvelope<{ ok: boolean }>>('/admin/home-experience/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  rollbackHomeBlock: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/home-experience/${id}/rollback`, { method: 'POST' }),
  homeExperiencePreview: (filters: { track?: string; country?: string; platform?: string; plan?: string }) => request<ApiEnvelope<import('../types/api').HomePreviewEnvelope>>(`/admin/home-experience/preview${queryString(filters)}`),
  supportFamily: (id: string) => request<ApiEnvelope<import('../types/api').SupportFamilyEnvelope>>(`/admin/support/family/${encodeURIComponent(id)}`),
  /// قراءة حيّة من FamilyState. منفصلة عن `supportFamily` لأنها نداء إلى مصدر
  /// السلطة لا إلى الإسقاط، وقد يفشل وحده (503) بلا أن يُفقد باقي الملف.
  supportFamilyDevices: (id: string) => request<ApiEnvelope<import('../types/api').SupportLiveDevices>>(`/admin/support/family/${encodeURIComponent(id)}/devices`),

  /// تذاكر الدعم. الفلاتر تُرسل كسلسلة استعلام ليعمل الترقيم على المجموعة
  /// المفلترة نفسها لا على مجموعة أوسع تُقصّ بعد الترقيم.
  supportTickets: (filters: {
    status?: string; priority?: string; category?: string; assignee_id?: string
    family_id?: string; tag?: string; q?: string; live?: string; overdue?: string
    limit?: number; offset?: number
  } = {}) => request<PaginatedEnvelope<import('../types/api').SupportTicket>>(`/admin/support/tickets${queryString(filters)}`),
  supportTicket: (id: string) => request<ApiEnvelope<import('../types/api').SupportTicketDetail>>(`/admin/support/tickets/${encodeURIComponent(id)}`),
  createSupportTicket: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string; reference: string }>>('/admin/support/tickets', { method: 'POST', body: JSON.stringify(payload) }),
  updateSupportTicket: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/support/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  addSupportNote: (id: string, body: string) => request<ApiEnvelope<{ id: string }>>(`/admin/support/tickets/${encodeURIComponent(id)}/notes`, { method: 'POST', body: JSON.stringify({ body }) }),
  recordSupportFirstResponse: (id: string, channel: string) => request<ApiEnvelope<{ first_response_at: string }>>(`/admin/support/tickets/${encodeURIComponent(id)}/first-response`, { method: 'POST', body: JSON.stringify({ channel }) }),
  escalateSupportTicket: (id: string, reason: string) => request<ApiEnvelope<{ priority: string }>>(`/admin/support/tickets/${encodeURIComponent(id)}/escalate`, { method: 'POST', body: JSON.stringify({ reason }) }),
  recordSupportAction: (id: string, action: string, reason: string) => request<ApiEnvelope<{ action: string }>>(`/admin/support/tickets/${encodeURIComponent(id)}/actions`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  supportSla: () => request<ApiEnvelope<import('../types/api').SupportSlaOverview>>('/admin/support/sla'),
  supportViews: () => request<ApiEnvelope<import('../types/api').SupportSavedView[]>>('/admin/support/views'),
  createSupportView: (payload: { name: string; filters: Record<string, unknown>; is_shared?: boolean }) => request<ApiEnvelope<{ id: string }>>('/admin/support/views', { method: 'POST', body: JSON.stringify(payload) }),
  deleteSupportView: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/support/views/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /// مركز الإنتاج. `with_publish=0` يتجاوز تقييم بوابة النشر، وهو الجزء المكلف:
  /// لوحة بأربعين عنصرًا تقيّم البوابة لكل عنصر.
  productionBoard: (filters: { type?: string; status?: string; series_id?: string; with_publish?: string; limit?: number; offset?: number } = {}) =>
    request<PaginatedEnvelope<import('../types/api').ProductionItem>>(`/admin/production/board${queryString(filters)}`),
  productionItem: (type: 'episode' | 'story', id: string) =>
    request<ApiEnvelope<import('../types/api').ProductionItem>>(`/admin/production/${type}/${encodeURIComponent(id)}`),
  saveProductionAssignment: (
    type: 'episode' | 'story',
    id: string,
    requirement: string,
    payload: { assignee_id?: string | null; team_id?: string | null; due_at?: string | null; blocker?: string | null; note?: string | null },
  ) => request<ApiEnvelope<{ requirement: string }>>(`/admin/production/${type}/${encodeURIComponent(id)}/${requirement}`, { method: 'PUT', body: JSON.stringify(payload) }),
  productionQueue: () => request<PaginatedEnvelope<import('../types/api').ProductionQueueRow>>('/admin/production/my-queue'),

  /// Customer 360 وعمليات الأجهزة الإدارية.
  ///
  /// عمليات الأجهزة تُنادي مسار المشغِّل في FamilyState لا مسار الوالد: السبب
  /// إلزامي في الجسم لأن الخادم يرفض بلا سبب، والرفض يُعرض كما هو.
  customers: (filters: { q?: string; plan?: string; status?: string; limit?: number; offset?: number } = {}) =>
    request<PaginatedEnvelope<import('../types/api').CustomerListRow>>(`/admin/customers${queryString(filters)}`),
  customer360: (id: string) => request<ApiEnvelope<import('../types/api').Customer360>>(`/admin/customers/${encodeURIComponent(id)}`),
  familyDeviceState: (id: string) => request<ApiEnvelope<import('../types/api').FamilyAuthorityState>>(`/admin/families/${encodeURIComponent(id)}/device-state`),
  revokeFamilyDevice: (familyId: string, deviceId: string, reason: string) =>
    request<ApiEnvelope<{ revoked: boolean }>>(`/admin/families/${encodeURIComponent(familyId)}/devices/${encodeURIComponent(deviceId)}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  revokeFamilyDownloads: (familyId: string, reason: string, deviceId?: string) =>
    request<ApiEnvelope<{ leases_revoked: number }>>(`/admin/families/${encodeURIComponent(familyId)}/downloads/revoke`, { method: 'POST', body: JSON.stringify({ reason, device_id: deviceId ?? null }) }),
  resyncFamily: (familyId: string, reason: string) =>
    request<ApiEnvelope<{ plan: string; note: string }>>(`/admin/families/${encodeURIComponent(familyId)}/resync`, { method: 'POST', body: JSON.stringify({ reason }) }),
  billingStats: () => request<ApiEnvelope<import('../types/api').BillingStats>>('/admin/billing/stats'),
  /// سجل الشراء الكامل من billing_audit. يحمل أعمدة أكثر من `recent_purchases`
  /// داخل /stats: يضيف purchase_token_hash و verified_at_ms.
  billingPurchases: (limit = 100) => request<ApiEnvelope<import('../types/api').BillingPurchaseRecord[]>>(`/admin/billing/purchases${queryString({ limit })}`),
  /// الاستحقاقات النشطة من family_projection. الخادم يستثني plan='free'.
  billingEntitlements: () => request<ApiEnvelope<import('../types/api').BillingEntitlementRecord[]>>('/admin/billing/entitlements'),
  analyticsOverview: () => request<ApiEnvelope<import('../types/api').AnalyticsOverview>>('/admin/analytics/overview'),
  /// تقدّم طفل واحد من ثلاثة مصادر: watch_progress و mastery و attempts.
  /// كان المسار يستعلم جدولًا اسمه content_progress لا وجود له، فيرمي على كل
  /// نداء — ولم يظهر ذلك لأنه بلا واجهة.
  childProgress: (childId: string) => request<ApiEnvelope<import('../types/api').ChildProgressReport>>(`/admin/analytics/children/${encodeURIComponent(childId)}`),
  siteMode: () => request<ApiEnvelope<import('../types/api').SiteModeEnvelope>>('/admin/site-mode'),
  saveSiteMode: (payload: Partial<import('../types/api').SiteModeSettings>) => request<ApiEnvelope<import('../types/api').SiteModeEnvelope>>('/admin/site-mode', { method: 'PUT', body: JSON.stringify(payload) }),
  resetSiteMode: () => request<ApiEnvelope<import('../types/api').SiteModeEnvelope>>('/admin/site-mode/reset', { method: 'POST' }),

  // الإطار التعليمي: المسارات موجودة في adminCatalogue.ts منذ إنشائه ولم يكن
  // لها أي مستدعٍ في الواجهة، فكانت عناصر القائمة الثلاثة معطَّلة بلافتة
  // «قريبًا» بينما الخادم جاهز.
  skills: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<import('../types/api').SkillRecord>>(`/admin/skills${queryString(filters)}`),
  createSkill: (payload: import('../types/api').SkillPayload) => request<ApiEnvelope<{ id: string }>>('/admin/skills', { method: 'POST', body: JSON.stringify(payload) }),
  updateSkill: (id: string, payload: Partial<import('../types/api').SkillPayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/skills/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteSkill: (id: string) => request<ApiEnvelope<{ id: string; deleted: boolean }>>(`/admin/skills/${id}`, { method: 'DELETE' }),

  learningObjectives: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<import('../types/api').LearningObjectiveRecord>>(`/admin/learning-objectives${queryString(filters)}`),
  learningObjective: (id: string) => request<ApiEnvelope<import('../types/api').LearningObjectiveDetail>>(`/admin/learning-objectives/${id}`),
  createLearningObjective: (payload: import('../types/api').LearningObjectivePayload) => request<ApiEnvelope<{ id: string; code: string }>>('/admin/learning-objectives', { method: 'POST', body: JSON.stringify(payload) }),
  updateLearningObjective: (id: string, payload: Partial<import('../types/api').LearningObjectivePayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/learning-objectives/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteLearningObjective: (id: string) => request<ApiEnvelope<{ id: string; deleted: boolean }>>(`/admin/learning-objectives/${id}`, { method: 'DELETE' }),
  /// يعيد اشتقاق المسارات العمرية من المدى المخزَّن. نافع بعد استيراد جماعي
  /// تركَ أهدافًا بلا مسارات.
  rederiveObjectiveTracks: (id: string) => request<ApiEnvelope<{ id: string; track_ids: import('../types/api').AgeTrack[] }>>(`/admin/learning-objectives/${id}/tracks/rederive`, { method: 'POST' }),

  /// سجل التدقيق. النوع AuditRecord موجود سلفًا لأن /dashboard/stats يعيد آخر
  /// نشاط بالشكل نفسه، فلا يُكرَّر.
  /// filters تقبل from/to بصيغة yyyy-mm-dd، وتُحوَّل في الخادم إلى بداية/نهاية
  /// اليوم قبل المقارنة على created_at.
  auditLogs: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<import('../types/api').AuditRecord>>(`/admin/audit-logs${queryString(filters)}`),

  ttsConfig: () => request<ApiEnvelope<import('../types/api').TtsConfig>>('/admin/tts/config'),
  ttsPreview,
  saveNarrationAsset,

  // الإتقان والمحاولات. mastery و attempts جدولان من المهاجرة 0001، وكل ما كان
  // يقرأهما هو تجميع واحد داخل /analytics/overview — فلا سبيل لمعرفة أي طفل
  // متعثّر ولا أي هدف يتعثّر فيه الأطفال.
  masteryByObjective: (filters: Record<string, string | number | undefined> = {}) => request<import('../types/api').MasteryByObjectiveEnvelope>(`/admin/mastery/by-objective${queryString(filters)}`),
  masteryByChild: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<import('../types/api').MasteryByChild>>(`/admin/mastery/by-child${queryString(filters)}`),
  attempts: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<import('../types/api').AttemptRecord>>(`/admin/attempts${queryString(filters)}`),

  // فحص الجودة والتصدير. المسارَان كانا موجودَين بلا مستدعٍ، وفيهما أربع علل
  // أُصلحت في الخادم: جدول خاطئ لنوع `story`، وفحص غلاف قيمته `true` دائمًا،
  // وأنواع تُعيد نجاحًا فارغًا، وحدّ صفحات مخترع لا وجود له في بوابات النشر.
  qualityReport: (type: import('../types/api').QualityEntityType, id: string) => request<ApiEnvelope<import('../types/api').QualityReport>>(`/admin/quality/${type}/${encodeURIComponent(id)}`),
  /// جاهزية النشر الموحّدة. نفس المصدر الذي تستدعيه عملية النشر على الخادم،
  /// فما تعرضه هذه الشاشة هو ما سيفرضه الخادم فعلًا لا تقديرًا مستقلًا.
  publishReadiness: (type: import('../types/api').PublishableEntityType, id: string) => request<ApiEnvelope<import('../types/api').PublishGateResult>>(`/admin/publish-readiness/${type}/${encodeURIComponent(id)}`),

  /// سياسة الإتاحة الجغرافية. `country` معاينة: «هل هذا ظاهر في فرنسا؟» سؤال
  /// يجب أن يُجاب من اللوحة لا بالسفر.
  availability: (type: import('../types/api').AvailabilityScope, id: string, country?: string) => request<ApiEnvelope<import('../types/api').AvailabilityView>>(`/admin/availability/${type}/${encodeURIComponent(id)}${queryString({ country })}`),
  saveAvailability: (
    type: import('../types/api').AvailabilityScope,
    id: string,
    payload: {
      mode: import('../types/api').AvailabilityMode
      countries: string[]
      languages: string[]
      platforms: string[]
      starts_at: string | null
      ends_at: string | null
      reason: import('../types/api').AvailabilityReason
      note: string | null
    },
  ) => request<ApiEnvelope<import('../types/api').AvailabilityView>>(`/admin/availability/${type}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(payload) }),
  clearAvailability: (type: import('../types/api').AvailabilityScope, id: string) => request<ApiEnvelope<import('../types/api').AvailabilityView>>(`/admin/availability/${type}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  availabilityPolicies: () => request<PaginatedEnvelope<import('../types/api').AvailabilityListRow>>('/admin/availability'),
  backupExport: (type: import('../types/api').QualityEntityType, id: string) => request<ApiEnvelope<import('../types/api').BackupExport>>(`/admin/backup/${type}/${encodeURIComponent(id)}`),

  // أحداث العائلة الفاشلة. الجدول والمسارات أُضيفت مع المهاجرة 0021 لأن
  // queue/dlq.ts كان يـack كل رسالة فاشلة فتُحذف بلا أثر.
  failedFamilyEvents: (filters: Record<string, string | number | undefined> = {}) => request<import('../types/api').FailedFamilyEventListEnvelope>(`/admin/failed-family-events${queryString(filters)}`),
  replayFailedFamilyEvent: (id: string) => request<ApiEnvelope<import('../types/api').FailedEventReplayResult>>(`/admin/failed-family-events/${encodeURIComponent(id)}/replay`, { method: 'POST' }),
  /// السبب إلزامي في الخادم: صفّ مُستبعَد بلا سبب يُعيد المشكلة الأصلية.
  discardFailedFamilyEvent: (id: string, note: string) => request<ApiEnvelope<{ id: string; discarded: boolean }>>(`/admin/failed-family-events/${encodeURIComponent(id)}/discard`, { method: 'POST', body: JSON.stringify({ note }) }),

  contentReviews: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<import('../types/api').ContentReviewRecord>>(`/admin/content-reviews${queryString(filters)}`),
  createContentReview: (payload: import('../types/api').ContentReviewPayload) => request<ApiEnvelope<{ id: string; status: string }>>('/admin/content-reviews', { method: 'POST', body: JSON.stringify(payload) }),
  updateContentReview: (id: string, payload: Partial<import('../types/api').ContentReviewPayload>) => request<ApiEnvelope<{ id: string; updated: boolean; status: string }>>(`/admin/content-reviews/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteContentReview: (id: string) => request<ApiEnvelope<{ id: string; deleted: boolean }>>(`/admin/content-reviews/${id}`, { method: 'DELETE' }),
}
