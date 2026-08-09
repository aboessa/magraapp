import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { callDurable, familyStub } from '../lib/doClient';
import { cachedPublicJson } from '../lib/publicCache';
import {
  isPubliclyServableAsset,
  publicAssetBaseUrl,
  publicAssetUrl,
} from '../lib/assetUrls';
import { authenticateParent, createMediaToken, mediaIsConfigured } from '../lib/parentAuth';
import type { Plan } from '../lib/familyPolicy';

type AppEnv = { Bindings: Env };
type Envelope<T> = { success: boolean; data?: T; error?: string };

const booksRoute = new Hono<AppEnv>();

const BOOK_TYPES = new Set(['picture_book', 'audio_story', 'interactive', 'comic']);

/// Artwork roles that may act as a book cover, in priority order.
const BOOK_COVER_ROLES = ['poster', 'cover'] as const;

/// Artwork roles for an individual story page.
const PAGE_IMAGE_ROLES = ['page', 'illustration', 'cover'] as const;

/// Narration roles for an audio story.
///
/// These now resolve to PRIVATE assets. `lib/assetClassification.ts` classifies
/// anything under an `/audio/` or `/narration/` path as private, per
/// `تشفير المحتوي.md:70` ("ملف صوتي مدفوع → Streaming خاص") and the `private/audio/`
/// layout at `:175`. The public `audio_url` field on the catalogue rows therefore
/// only ever carries a free sample stored under `sfx/` or `audio-samples/`;
/// narration itself is reached through `POST /books/:id/audio-sessions`.
const BOOK_AUDIO_ROLES = ['narration', 'audio'] as const;

/// A private narration asset, resolved for capability-token issuance.
type NarrationMedia = {
  book_id: string;
  is_free: number;
  asset_id: string;
  r2_key: string;
  bucket: 'media' | 'thumbs';
  mime_type: string | null;
  original_filename: string | null;
  version: number;
  etag: string | null;
};

function forward(result: { status: number; data: unknown }) {
  return Response.json(
    result.data ?? { success: false, error: 'Family service unavailable' },
    { status: result.status },
  );
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

/// Finds the private narration asset for a book, optionally for one page.
///
/// Mirrors `catalogMedia` in routes/episodes.ts, with `kind = 'audio'` and
/// `visibility = 'private'` required: a public asset must never be handed a
/// capability token, because that would imply protection the CDN does not apply.
async function narrationMedia(env: Env, bookId: string, pageId: string | null) {
  const roleList = BOOK_AUDIO_ROLES.map((role) => `'${role}'`).join(', ');
  // A page-level narration is linked to `story_page`; a whole-book track to
  // `book`. Both are queried the same way, only the entity differs.
  const entityType = pageId ? 'story_page' : 'book';
  const entityId = pageId ?? bookId;

  return queryFirst<NarrationMedia>(env.DB, `
    SELECT b.id AS book_id, b.is_free,
      ca.id AS asset_id, ca.r2_key, ca.bucket, ca.mime_type,
      ca.original_filename, ca.version, ca.etag
    FROM books b
    JOIN asset_links al ON al.entity_type = '${entityType}' AND al.entity_id = ?
    JOIN content_assets ca ON ca.id = al.asset_id
    WHERE b.id = ? AND b.status = 'published'
      AND ca.status = 'ready' AND ca.kind = 'audio'
      AND ca.visibility = 'private'
      AND ca.r2_key IS NOT NULL AND ca.bucket IS NOT NULL
      AND al.role IN (${roleList})
    ORDER BY CASE al.role WHEN 'narration' THEN 0 ELSE 1 END, al.sort_order ASC
    LIMIT 1
  `, [entityId, bookId]);
}

function pagination(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), 100) : fallback;
}

function ageRange(value: string | undefined): { min: number; max: number } | null | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  return min >= 3 && max <= 12 && min <= max ? { min, max } : null;
}

/// SQL fragment selecting the best asset of a given role set for an entity.
///
/// `artworkSelect` in lib/assetUrls.ts is typed to `'series' | 'episode'`, so
/// this local variant covers the `book` and `story_page` entity types. Roles and
/// entity types are inlined from module constants only, never from request input,
/// so this cannot be used to inject SQL.
function assetSelect(
  prefix: string,
  entityType: 'book' | 'story_page',
  entityIdColumn: string,
  roles: readonly string[],
  kinds: readonly string[],
): string {
  const roleList = roles.map((role) => `'${role}'`).join(', ');
  const kindList = kinds.map((kind) => `'${kind}'`).join(', ');
  const rolePriority = roles
    .map((role, index) => `WHEN '${role}' THEN ${index}`)
    .join(' ');
  const pick = (column: string) => `
    (SELECT ca.${column}
       FROM asset_links al
       JOIN content_assets ca ON ca.id = al.asset_id
      WHERE al.entity_type = '${entityType}'
        AND al.entity_id = ${entityIdColumn}
        AND al.role IN (${roleList})
        AND ca.status = 'ready'
        AND ca.visibility = 'public'
        AND ca.r2_key IS NOT NULL
        AND ca.kind IN (${kindList})
      ORDER BY CASE al.role ${rolePriority} ELSE 99 END, al.sort_order ASC
      LIMIT 1) AS ${prefix}_${column}`;
  return [pick('r2_key'), pick('visibility'), pick('status'), pick('kind')].join(',');
}

/// Replaces the aliased asset columns on a row with a single resolved URL.
function applyAssetUrl(
  row: Record<string, unknown>,
  prefix: string,
  targetField: string,
  baseUrl: string | null,
): void {
  const asset = {
    r2_key: (row[`${prefix}_r2_key`] ?? null) as string | null,
    visibility: (row[`${prefix}_visibility`] ?? null) as string | null,
    status: (row[`${prefix}_status`] ?? null) as string | null,
    kind: (row[`${prefix}_kind`] ?? null) as string | null,
  };
  row[targetField] = isPubliclyServableAsset(asset)
    ? publicAssetUrl(baseUrl, asset)
    : null;
  for (const column of ['r2_key', 'visibility', 'status', 'kind']) {
    delete row[`${prefix}_${column}`];
  }
}

// GET /api/v1/books - published library only.
//
// This route did not exist: `index.ts` mounted planets, series, episodes and
// family, so the app's `fetchBooks()` call against `/api/v1/books` always 404'd
// and was swallowed by its own catch, leaving the library silently empty.
booksRoute.get('/', async (c) => {
  const type = c.req.query('type');
  const requestedAge = ageRange(c.req.query('age'));
  const limit = pagination(c.req.query('limit'), 20) || 20;
  const offset = pagination(c.req.query('offset'), 0);

  if (type && !BOOK_TYPES.has(type)) {
    return c.json({ success: false, error: 'Invalid book type' }, 400);
  }
  if (requestedAge === null) {
    return c.json(
      { success: false, error: 'age must use an inclusive range within 3-12, for example 6-8' },
      400,
    );
  }

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    // `books.pages` holds a legacy JSON blob and is deliberately not selected:
    // page content is served by `/books/:id/pages` from `story_pages`.
    let sql = `SELECT b.id, b.series_id, b.title_ar, b.type, b.age_min, b.age_max,
        b.reading_level, b.interaction_mode, b.supervision_level, b.is_free,
        s.title_ar AS series_title,
        (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id = b.id) AS pages_count,
        ${assetSelect('cover_asset', 'book', 'b.id', BOOK_COVER_ROLES, ['image'])},
        ${assetSelect('audio_asset', 'book', 'b.id', BOOK_AUDIO_ROLES, ['audio'])}
      FROM books b
      LEFT JOIN series s ON s.id = b.series_id
      WHERE b.status = 'published'`;
    const params: unknown[] = [];

    if (type) {
      sql += ' AND b.type = ?';
      params.push(type);
    }
    if (requestedAge) {
      sql += ' AND b.age_max >= ? AND b.age_min <= ?';
      params.push(requestedAge.min, requestedAge.max);
    }

    sql += ' ORDER BY b.age_min ASC, b.title_ar ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const books = await queryAll<Record<string, unknown>>(c.env.DB, sql, params);
    const base = publicAssetBaseUrl(c.env);
    for (const row of books) {
      applyAssetUrl(row, 'cover_asset', 'cover_url', base);
      applyAssetUrl(row, 'audio_asset', 'audio_url', base);
    }

    return {
      success: true,
      data: books,
      meta: { limit, offset },
    };
  });
});

// GET /api/v1/books/:id
booksRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  const exists = await queryFirst<{ id: string }>(
    c.env.DB,
    `SELECT id FROM books WHERE id = ? AND status = 'published'`,
    [id],
  );
  if (!exists) return c.json({ success: false, error: 'Book not found' }, 404);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const book = await queryFirst<Record<string, unknown>>(
      c.env.DB,
      `SELECT b.id, b.series_id, b.title_ar, b.type, b.age_min, b.age_max,
          b.reading_level, b.interaction_mode, b.supervision_level, b.is_free,
          b.safety_notes, s.title_ar AS series_title,
          (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id = b.id) AS pages_count,
          ${assetSelect('cover_asset', 'book', 'b.id', BOOK_COVER_ROLES, ['image'])},
          ${assetSelect('audio_asset', 'book', 'b.id', BOOK_AUDIO_ROLES, ['audio'])}
        FROM books b
        LEFT JOIN series s ON s.id = b.series_id
        WHERE b.id = ? AND b.status = 'published'`,
      [id],
    );
    if (book) {
      const base = publicAssetBaseUrl(c.env);
      applyAssetUrl(book, 'cover_asset', 'cover_url', base);
      applyAssetUrl(book, 'audio_asset', 'audio_url', base);
    }
    return { success: true, data: book };
  });
});

// GET /api/v1/books/:id/pages - reader content.
//
// Page rows live in `story_pages` keyed by `story_id`. The seeded qisas pages in
// migration 0013 use book ids for that column even though it is declared
// `REFERENCES stories(id)`, and the `stories` table was never seeded, so this
// route reads by book id to match the data that actually exists.
//
// `language` selects a localisation row. Missing localisations yield a page with
// `body_text: null`, and pages with no attached asset yield `image_url: null`,
// so the client can render an honest partial page instead of a fabricated one.
booksRoute.get('/:id/pages', async (c) => {
  const id = c.req.param('id');
  const language = (c.req.query('language') ?? 'ar').trim().toLowerCase();

  // Guard the language input: it is bound as a parameter, but keeping it to a
  // short token also keeps the cache key bounded.
  if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) {
    return c.json({ success: false, error: 'Invalid language tag' }, 400);
  }

  const exists = await queryFirst<{ id: string }>(
    c.env.DB,
    `SELECT id FROM books WHERE id = ? AND status = 'published'`,
    [id],
  );
  if (!exists) return c.json({ success: false, error: 'Book not found' }, 404);

  return cachedPublicJson(c.req.raw, c.env.CACHE, async () => {
    const pages = await queryAll<Record<string, unknown>>(
      c.env.DB,
      `SELECT sp.id, sp.page_number, sp.layout, sp.transition, sp.duration_ms,
          spl.body_text, spl.alt_text,
          ${assetSelect('page_asset', 'story_page', 'sp.id', PAGE_IMAGE_ROLES, ['image'])}
        FROM story_pages sp
        LEFT JOIN story_page_localizations spl
          ON spl.page_id = sp.id AND spl.language = ?
        WHERE sp.story_id = ?
        ORDER BY sp.page_number ASC`,
      [language, id],
    );

    const base = publicAssetBaseUrl(c.env);
    for (const row of pages) applyAssetUrl(row, 'page_asset', 'image_url', base);

    const withContent = pages.filter(
      (row) => row.body_text !== null || row.image_url !== null,
    ).length;

    return {
      success: true,
      data: pages,
      meta: {
        language,
        total: pages.length,
        // Surfaced so the client and the CMS can both see how much of the story
        // is actually publishable, rather than inferring it from a page count.
        renderable: withContent,
      },
    };
  });
});

// POST /api/v1/books/:id/audio-sessions - narration playback.
//
// Narration is private (see BOOK_AUDIO_ROLES above), so it cannot be fetched from
// the CDN. This mints the same short-lived capability token the episode player
// uses, which satisfies the plan's requirement that paid audio be delivered as
// "Streaming خاص" behind a server-side entitlement check
// (`تشفير المحتوي.md:70`, `:1232-1242`).
//
// Deliberately does NOT create a playback lease. A lease exists to enforce the
// concurrent-stream cap, which the plan scopes to video (`تشفير المحتوي.md:71`);
// counting a bedtime story against the same cap would stop a parent reading to one
// child while another watches an episode. Entitlement, child ownership and device
// validity are still verified on every call through `authenticateParent` plus the
// family-state check below.
booksRoute.post('/:id/audio-sessions', async (c) => {
  if (!mediaIsConfigured(c.env)) {
    return c.json({ success: false, error: 'Secure media delivery is not configured' }, 503);
  }
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const childId = typeof body?.child_id === 'string' ? body.child_id : '';
  if (!childId) return c.json({ success: false, error: 'child_id required' }, 400);
  // Optional: a per-page narration rather than a whole-book track.
  const pageId = typeof body?.page_id === 'string' && body.page_id ? body.page_id : null;

  const media = await narrationMedia(c.env, c.req.param('id'), pageId);
  if (!media) {
    return c.json({ success: false, error: 'Protected narration is unavailable' }, 404);
  }

  // Confirm the child belongs to this family and read the effective plan from the
  // same ledger that enforces limits, so this route cannot grant a tier the
  // account does not hold.
  const state = await callDurable<Envelope<{
    family: { plan: Plan };
    children: Array<{ id: string }>;
  }>>(familyStub(c.env, auth.principal.parentId), '/state');
  const family = state.data?.success ? state.data.data : null;
  if (!state.ok || !family) return forward(state);

  if (!family.children.some((child) => child.id === childId)) {
    return c.json({ success: false, error: 'Active child profile not found' }, 404);
  }
  // A paid book needs any paid plan; a free book only needs a valid session.
  if (!media.is_free && family.family.plan === 'free') {
    return c.json(
      { success: false, error: 'An active subscription is required for this story' },
      403,
    );
  }

  const token = await createMediaToken(c.env, {
    sub: auth.principal.parentId,
    sid: auth.principal.sessionId,
    // No lease exists for audio, so the asset id doubles as the correlation id.
    lid: `audio:${media.asset_id}`,
    aid: media.asset_id,
    r2_key: media.r2_key,
    bucket: media.bucket,
    mime_type: media.mime_type,
    filename: media.original_filename,
    asset_version: media.version,
    etag: media.etag,
  });

  return c.json({
    success: true,
    data: {
      stream_url: `/api/v1/media/assets/${media.asset_id}`,
      authorization: `Bearer ${token}`,
      // Matches MEDIA_TOKEN_TTL_SECONDS in lib/parentAuth.ts. The plan allows
      // 5-10 minutes for a short audio file (`تشفير المحتوي.md:243`); 180s is
      // stricter and the client renews by calling this endpoint again.
      capability_expires_in: 180,
      content_type: media.mime_type,
      protection: 'access_controlled_no_drm',
    },
  }, 201);
});

export default booksRoute;
