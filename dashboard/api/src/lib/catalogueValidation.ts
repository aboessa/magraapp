/// Pure validation rules for the catalogue CMS (stories, story pages, books,
/// games, projects, characters, learning objectives, seasons, skills and
/// content reviews).
///
/// Nothing here touches D1, KV, R2 or a request context, so every rule is unit
/// testable under `node --experimental-strip-types --test`. The HTTP layer in
/// routes/adminCatalogue.ts and routes/adminContent.ts calls these helpers and
/// maps a returned string straight onto a 400 response body.
///
/// Every list below was copied from the live CHECK constraints in D1
/// (`SELECT sql FROM sqlite_master`), not from memory. Keeping the enums here
/// means a bad payload is rejected with a readable 400 instead of surfacing a
/// SQLite constraint failure as a 500.

export type AgeTrack = 'preschool' | 'kids' | 'junior';

export const TRACKS: AgeTrack[] = ['preschool', 'kids', 'junior'];

/// Inclusive age bounds of each track. Used to derive learning-objective and
/// episode track rows from an age range.
export const TRACK_BOUNDS: Record<AgeTrack, [number, number]> = {
  preschool: [3, 5],
  kids: [6, 8],
  junior: [9, 12],
};

export const CONTENT_STATUSES = [
  'draft', 'writing', 'review_edu', 'review_lang', 'review_sharia',
  'production', 'qa', 'ready', 'scheduled', 'published', 'archived',
];

/// Statuses that promise the content is finished. Publish gates run on any
/// transition into one of these, not only on 'published', otherwise an editor
/// could park incomplete content in 'ready' and have a scheduler publish it.
export const RELEASE_STATUSES = ['ready', 'scheduled', 'published'];

export const STORY_TYPES = ['picture_book', 'audio_story', 'interactive', 'comic'];
export const READING_LEVELS = ['pre_reader', 'emerging', 'independent'];
export const INTERACTION_MODES = ['tap', 'guided', 'mixed', 'independent'];
export const SUPERVISION_LEVELS = ['none', 'recommended', 'required'];
export const PRICE_TIERS = ['free', 'family', 'family_plus'];
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
export const CHARACTER_ROLES = ['hero', 'side', 'villain', 'narrator', 'presenter'];
export const CHARACTER_STATUSES = ['active', 'archived'];
export const PAGE_LAYOUTS = ['full_bleed', 'split', 'panels', 'text_focus'];
export const BUBBLE_KINDS = ['dialogue', 'thought', 'caption', 'sound'];
export const WATCH_ORDERS = ['sequential', 'any'];
export const CONTENT_CLASSES = ['production', 'test_fixture'];

export const REVIEW_ENTITY_TYPES = ['series', 'episode', 'story', 'book', 'game', 'project'];
export const REVIEWER_ROLES = ['edu', 'lang', 'sharia', 'rights', 'qa'];
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected', 'needs_changes'];

export const AGE_MIN = 3;
export const AGE_MAX = 12;

// Scalars --------------------------------------------------------------------

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function nullableText(value: unknown): string | null | undefined {
  if (value === null || value === '') return null;
  if (typeof value === 'string') return value.trim() || null;
  return undefined;
}

export function integer(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function strictBoolInt(value: unknown): number | null {
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  return null;
}

export function jsonArrayText(value: unknown): string | null {
  return Array.isArray(value) ? JSON.stringify(value) : null;
}

export function jsonObjectText(value: unknown): string | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : null;
}

export function parseJson(value: unknown, fallback: unknown): unknown {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function uniqueStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: string[] = [];
  for (const item of value) {
    const id = text(item);
    if (!id || parsed.includes(id)) return null;
    parsed.push(id);
  }
  return parsed;
}

export function isValidLanguage(value: unknown): boolean {
  return typeof value === 'string' && /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(value);
}

export function slugify(value: string, fallback: string): string {
  const slug = value.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `${fallback}-${Math.random().toString(36).slice(2, 10)}`;
}

/// Mirrors routes/admin.ts so admin list endpoints paginate identically.
///
/// ## Why the ceiling is a caller decision
///
/// A default of 20 suits a catalogue list the dashboard pages through. It is the
/// wrong default for a list that was previously unbounded: dropping the ceiling
/// to 20 hides rows the dashboard renders today, and nobody sees it happen.
///
/// Silent truncation is worse than an unbounded query. An unbounded query gets
/// slow, which is visible; a truncated list just looks like the data is gone. So
/// endpoints being bounded for the first time pass a generous `defaultLimit` and
/// return `meta.total`, which lets the UI say how many rows really exist.
export function parsePagination(
  limitValue?: string | null,
  offsetValue?: string | null,
  options: { defaultLimit?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;
  const parsedLimit = Number.parseInt(limitValue ?? String(defaultLimit), 10);
  const parsedOffset = Number.parseInt(offsetValue ?? '0', 10);
  return {
    limit: Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), maxLimit) : defaultLimit,
    offset: Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0,
  };
}

/// The options for a list that shipped with no `LIMIT` at all.
///
/// Shared rather than redeclared per router: two copies drift, and the whole
/// point of the generous ceiling is that every newly-bounded endpoint agrees on
/// it. Callers still return `meta.total` so the dashboard can show the real row
/// count rather than implying the page size is the total.
export const UNBOUNDED_LIST_PAGINATION = { defaultLimit: 200, maxLimit: 500 } as const;

// Enums ----------------------------------------------------------------------

/// Returns null when the value is allowed, otherwise the 400 message. Empty
/// strings and non-strings are rejected the same way an unknown value is.
export function enumError(field: string, value: unknown, allowed: string[]): string | null {
  const parsed = text(value);
  if (!parsed || !allowed.includes(parsed)) {
    return `Invalid ${field}. Allowed values: ${allowed.join(', ')}`;
  }
  return null;
}

export function statusError(value: unknown): string | null {
  return enumError('status', value, CONTENT_STATUSES);
}

// Age ranges -----------------------------------------------------------------

export function isAgeRange(min: number | null, max: number | null): min is number {
  return min !== null && max !== null
    && min >= AGE_MIN && min <= AGE_MAX
    && max >= AGE_MIN && max <= AGE_MAX
    && max >= min;
}

export function ageRangeError(min: number | null, max: number | null): string | null {
  if (min === null || max === null) return 'age_min and age_max are required integers';
  if (min < AGE_MIN || max > AGE_MAX || min > AGE_MAX || max < AGE_MIN) {
    return `Age range must be within ${AGE_MIN}-${AGE_MAX}`;
  }
  if (max < min) return 'age_max must be greater than or equal to age_min';
  return null;
}

/// Every track the range touches. A 5-6 range straddles preschool and kids and
/// therefore yields both.
export function tracksForRange(ageMin: number, ageMax: number): AgeTrack[] {
  return TRACKS.filter((track) => {
    const [low, high] = TRACK_BOUNDS[track];
    return ageMin <= high && ageMax >= low;
  });
}

/// The straddle rule: an explicit track list may narrow the derived set but may
/// never include a track the age range does not reach. Returns null when the
/// supplied value is unusable, matching routes/admin.ts.
export function normalizeTracks(value: unknown, ageMin: number, ageMax: number): AgeTrack[] | null {
  if (value === undefined) return tracksForRange(ageMin, ageMax);
  if (!Array.isArray(value)) return null;

  const unique = [...new Set(value)];
  if (!unique.length) return null;
  if (unique.some((track) => typeof track !== 'string' || !TRACKS.includes(track as AgeTrack))) return null;

  const applicable = tracksForRange(ageMin, ageMax);
  if (unique.some((track) => !applicable.includes(track as AgeTrack))) return null;
  return unique as AgeTrack[];
}

/// Reads a `GROUP_CONCAT(track_id)` column back into an array.
///
/// Every admin list selects tracks as a comma-joined subquery, so the raw row
/// carries a string (`'preschool,kids'`) or NULL when the entity has no track
/// rows at all. The dashboard types the field as `AgeTrack[]` and calls
/// `.map()` on it, so any endpoint that returns the row unserialized crashes
/// the page with `track_ids.map is not a function` — which is exactly what
/// GET /admin/planets/:id did to the planet drill-down. Three routers had
/// their own private copy of this split and the fourth simply forgot it, so it
/// lives here now, once.
///
/// Arrays pass through filtered, which keeps the helper idempotent: serializing
/// an already-serialized row is a no-op rather than an empty list.
export function parseTrackIds(value: unknown): AgeTrack[] {
  const parts = Array.isArray(value)
    ? value
    : typeof value === 'string' && value ? value.split(',') : [];
  return parts.filter((track): track is AgeTrack => TRACKS.includes(track as AgeTrack));
}

// Publish gates --------------------------------------------------------------

export function isReleaseStatus(status: unknown): boolean {
  const parsed = text(status);
  return !!parsed && RELEASE_STATUSES.includes(parsed);
}

export interface StoryPageForGate {
  page_number?: number | null;
  image_asset_id?: string | null;
  localizations?: Array<{
    language?: string | null;
    body_text?: string | null;
    narration_asset_id?: string | null;
  }> | null;
}

/// A story may not be released until it has pages and every page carries text
/// in the story's default language. Audio stories additionally need narration,
/// because their pages are consumed by ear.
export function storyPublishError(
  pages: StoryPageForGate[] | null | undefined,
  type: string,
  defaultLanguage: string,
): string | null {
  const list = Array.isArray(pages) ? pages : [];
  if (!list.length) return 'Story must contain at least one page before release';

  const language = text(defaultLanguage) ?? 'ar';
  for (const page of list) {
    const label = page.page_number == null ? 'a page' : `page ${page.page_number}`;
    const localizations = Array.isArray(page.localizations) ? page.localizations : [];
    const localized = localizations.find((item) => text(item?.language) === language);
    const bodyText = text(localized?.body_text);
    const narration = text(localized?.narration_asset_id);

    if (!bodyText && !narration) {
      return `Every story page needs text in ${language} before release (${label} is empty)`;
    }
    if (type === 'audio_story' && !narration) {
      return `Audio stories need narration in ${language} on every page (${label} has none)`;
    }
  }
  return null;
}

/// content_pack drives the whole game runtime. Publishing with `{}` ships a
/// game that renders nothing, so an empty pack blocks release.
export function gamePublishError(contentPack: unknown): string | null {
  const pack = typeof contentPack === 'string' ? parseJson(contentPack, null) : contentPack;
  if (!pack || typeof pack !== 'object' || Array.isArray(pack)) {
    return 'content_pack must be a non-empty object before release';
  }
  if (!Object.keys(pack as Record<string, unknown>).length) {
    return 'content_pack must be a non-empty object before release';
  }
  return null;
}

export function bookPublishError(pages: unknown): string | null {
  const parsed = typeof pages === 'string' ? parseJson(pages, null) : pages;
  if (!Array.isArray(parsed) || !parsed.length) {
    return 'A book needs at least one page before release';
  }
  return null;
}

/// books.languages and books.default_language carry no CHECK constraint, so
/// nothing in SQLite stops a book declaring a default language it does not
/// actually ship. A reader asking for the default would then find no text at
/// all, so the pair is validated together here.
///
/// Returns null when the pair is coherent, otherwise the 400 message.
export function bookLanguagesError(languages: unknown, defaultLanguage: unknown): string | null {
  const list = uniqueStringArray(languages);
  if (!list || !list.length) {
    return 'languages must contain unique non-empty language codes';
  }
  const invalid = list.find((code) => !isValidLanguage(code));
  if (invalid) return `Invalid language code: ${invalid}`;

  const fallback = text(defaultLanguage);
  if (!fallback) return 'Invalid default_language';
  if (!isValidLanguage(fallback)) return 'Invalid default_language';
  if (!list.includes(fallback)) return 'default_language must be one of languages';
  return null;
}

export function projectPublishError(materials: unknown, steps: unknown): string | null {
  const parsedMaterials = typeof materials === 'string' ? parseJson(materials, null) : materials;
  const parsedSteps = typeof steps === 'string' ? parseJson(steps, null) : steps;
  if (!Array.isArray(parsedMaterials) || !parsedMaterials.length) {
    return 'A project needs at least one material before release';
  }
  if (!Array.isArray(parsedSteps) || !parsedSteps.length) {
    return 'A project needs at least one step before release';
  }
  return null;
}

// References -----------------------------------------------------------------

/// engine_id is a FOREIGN KEY with ON DELETE RESTRICT. Checking it here turns
/// an unknown engine into a 400 rather than a FOREIGN KEY 500.
export function engineIdError(engineId: unknown, knownEngineIds: string[]): string | null {
  const parsed = text(engineId);
  if (!parsed) return 'engine_id is required';
  if (!knownEngineIds.includes(parsed)) return `Game engine not found: ${parsed}`;
  return null;
}

// Learning objectives --------------------------------------------------------

export interface ObjectivePayload {
  code: string;
  titleAr: string;
  descriptionAr: string | null;
  measurableCriteria: string | null;
  skillId: string | null;
  ageMin: number;
  ageMax: number;
  tracks: AgeTrack[];
}

/// Validates a create payload for learning_objectives and derives its track
/// rows from the age range, the same derivation episodes and series use.
export function objectiveCreatePayload(
  body: Record<string, unknown>,
): { error: string } | { payload: ObjectivePayload } {
  const code = text(body.code);
  const titleAr = text(body.title_ar);
  if (!code) return { error: 'code is required' };
  if (!titleAr) return { error: 'title_ar is required' };

  const ageMin = integer(body.age_min);
  const ageMax = integer(body.age_max);
  const rangeError = ageRangeError(ageMin, ageMax);
  if (rangeError) return { error: rangeError };

  const tracks = normalizeTracks(body.track_ids, ageMin as number, ageMax as number);
  if (!tracks) return { error: 'track_ids do not match the age range' };

  const descriptionAr = body.description_ar === undefined ? null : nullableText(body.description_ar);
  if (descriptionAr === undefined) return { error: 'description_ar must be text or null' };
  const measurableCriteria = body.measurable_criteria === undefined ? null : nullableText(body.measurable_criteria);
  if (measurableCriteria === undefined) return { error: 'measurable_criteria must be text or null' };
  const skillId = body.skill_id === undefined ? null : nullableText(body.skill_id);
  if (skillId === undefined) return { error: 'skill_id must be text or null' };

  return {
    payload: {
      code,
      titleAr,
      descriptionAr,
      measurableCriteria,
      skillId,
      ageMin: ageMin as number,
      ageMax: ageMax as number,
      tracks,
    },
  };
}

// Content reviews ------------------------------------------------------------

export interface ReviewPayload {
  entityType: string;
  entityId: string;
  reviewerRole: string;
  reviewerId: string | null;
  status: string;
  comments: string | null;
}

export function reviewCreatePayload(
  body: Record<string, unknown>,
): { error: string } | { payload: ReviewPayload } {
  const entityType = text(body.entity_type);
  const entityTypeError = enumError('entity_type', entityType, REVIEW_ENTITY_TYPES);
  if (entityTypeError) return { error: entityTypeError };

  const entityId = text(body.entity_id);
  if (!entityId) return { error: 'entity_id is required' };

  const reviewerRoleError = enumError('reviewer_role', body.reviewer_role, REVIEWER_ROLES);
  if (reviewerRoleError) return { error: reviewerRoleError };

  const status = body.status === undefined ? 'pending' : text(body.status);
  const statusEnumError = enumError('status', status, REVIEW_STATUSES);
  if (statusEnumError) return { error: statusEnumError };

  const reviewerId = body.reviewer_id === undefined ? null : nullableText(body.reviewer_id);
  if (reviewerId === undefined) return { error: 'reviewer_id must be text or null' };
  const comments = body.comments === undefined ? null : nullableText(body.comments);
  if (comments === undefined) return { error: 'comments must be text or null' };

  // A rejection or a change request without a reason is unactionable for the
  // editor who has to fix it.
  if ((status === 'rejected' || status === 'needs_changes') && !comments) {
    return { error: 'comments are required when a review is rejected or needs changes' };
  }

  return {
    payload: {
      entityType: entityType as string,
      entityId,
      reviewerRole: text(body.reviewer_role) as string,
      reviewerId,
      status: status as string,
      comments,
    },
  };
}

/// Table each review entity_type points at, so the route can confirm the target
/// row exists before writing a review that references nothing.
export const REVIEW_ENTITY_TABLES: Record<string, string> = {
  series: 'series',
  episode: 'episodes',
  story: 'stories',
  book: 'books',
  game: 'games',
  project: 'projects',
};
