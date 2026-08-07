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

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '')
const DIRECT_UPLOAD_LIMIT = 95 * 1024 * 1024

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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
  const sessionToken = window.sessionStorage.getItem('majarra-admin-token')
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`)
  headers.set('X-Admin-Actor', window.sessionStorage.getItem('majarra-admin-actor') || 'dashboard-admin')
  return headers
}

async function responseError(response: Response) {
  const payload = await response.clone().json().catch(() => null) as { error?: string } | null
  const fallbackMessage = document.documentElement.lang === 'en' ? 'Unable to complete the request' : 'تعذر إكمال الطلب'
  return new ApiError(payload?.error || fallbackMessage, response.status)
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

export const api = {
  dashboard: () => request<ApiEnvelope<DashboardStats>>('/admin/dashboard/stats'),

  planets: () => request<ApiEnvelope<Planet[]>>('/planets'),
  cmsPlanets: (includeInactive = false) => request<ApiEnvelope<Planet[]>>(`/admin/planets${queryString({ include_inactive: includeInactive ? 1 : undefined })}`),
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
  createSeries: (payload: SeriesPayload) => request<ApiEnvelope<{ id: string }>>('/admin/series', { method: 'POST', body: JSON.stringify(payload) }),
  updateSeries: (id: string, payload: Partial<SeriesPayload> & { status?: string }) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/series/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveSeries: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/series/${id}`, { method: 'DELETE' }),

  seasons: (seriesId?: string) => request<ApiEnvelope<SeasonRecord[]>>(`/admin/seasons${queryString({ series_id: seriesId })}`),
  createSeason: (payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>('/admin/seasons', { method: 'POST', body: JSON.stringify(payload) }),
  updateSeason: (id: string, payload: Record<string, unknown>) => request<ApiEnvelope<{ id: string }>>(`/admin/seasons/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveSeason: (id: string) => request<ApiEnvelope<{ id: string }>>(`/admin/seasons/${id}`, { method: 'DELETE' }),

  episodes: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<EpisodeRecord>>(`/admin/episodes${queryString(filters)}`),
  createEpisode: (payload: EpisodePayload) => request<ApiEnvelope<{ id: string }>>('/admin/episodes', { method: 'POST', body: JSON.stringify(payload) }),
  updateEpisode: (id: string, payload: Partial<EpisodePayload> & { status?: string }) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/episodes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveEpisode: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/episodes/${id}`, { method: 'DELETE' }),

  characters: (seriesId?: string) => request<ApiEnvelope<CharacterRecord[]>>(`/admin/characters${queryString({ series_id: seriesId })}`),
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
  children: (filters: Record<string, string | number | undefined> = {}) => request<PaginatedEnvelope<ChildRecord>>(`/admin/children${queryString(filters)}`),
  createChild: (payload: ChildPayload) => request<ApiEnvelope<{ id: string; age: number; age_track: string }>>('/admin/children', { method: 'POST', body: JSON.stringify(payload) }),
  updateChild: (id: string, payload: Partial<ChildPayload>) => request<ApiEnvelope<{ id: string; updated: boolean }>>(`/admin/children/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveChild: (id: string) => request<ApiEnvelope<{ id: string; status: string }>>(`/admin/children/${id}`, { method: 'DELETE' }),
}
