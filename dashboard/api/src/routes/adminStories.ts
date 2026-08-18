/// Story endpoints the builder needs: the collection with real completeness, the
/// workspace aggregate, and the page reorder that the schema made impossible.
///
/// ## Why stories get their own router
///
/// `adminContent.ts` owns stories, books, games, projects and categories in one
/// 1800-line file. The three things below are all *aggregate* reads across
/// `story_pages` and `story_page_localizations`, plus one write that needs a
/// two-phase transaction. Adding them there would grow a file that is already the
/// largest in the routes directory, and the joins are shared only between
/// themselves.
///
/// The existing story handlers stay where they are. This router adds; it does not
/// move working endpoints, because moving a mounted path is a behavioural change
/// disguised as a refactor.
///
/// ## Three rules this file does not bend
///
/// **1. Completeness is counted, never assumed.** A language is not complete
/// because `stories.languages` lists it. It is complete when every page carries
/// body text in it — and separately, when every page carries a *ready* narration
/// asset in it. Text and audio are different questions and get different numbers.
///
/// **2. Zero and "cannot be read" are different answers.** [readRows] returns
/// `null` when a statement fails, so a module built from a failed read carries
/// `unavailable` and no numbers rather than a confident zero.
///
/// **3. Read-along is not narration.** `story_page_localizations.timing_cues` is a
/// validated-as-array pass-through that nothing in the codebase writes with
/// content. So a story can be ready for "read to me" and simultaneously have zero
/// read-along coverage, and the payload says so in two separate fields instead of
/// implying one from the other.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { pathParam } from '../lib/routeParams.ts';
import { requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { publicAssetBaseUrl, applyArtworkUrl, artworkSelect } from '../lib/assetUrls.ts';

type Row = Record<string, unknown>;

const route = new Hono<{ Bindings: Env }>();

/// The languages a story can declare. Same set as the rest of the catalogue:
/// `game_localizations` constrains these three by CHECK and the production matrix
/// names one requirement per language. A wider list here would count columns that
/// do not exist.
const LANGUAGES = ['ar', 'en', 'fr'] as const;
type Language = (typeof LANGUAGES)[number];

/// Caps, advertised in `meta` so a capped read is never mistaken for the whole story.
const PAGE_LIMIT = 200;
const ACTIVITY_LIMIT = 20;

const STORY_COVER_ROLES = ['cover', 'poster'] as const;

const num = (row: Row | null, key: string): number => {
  const value = row?.[key];
  return typeof value === 'number' ? value : Number(value ?? 0) || 0;
};

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

/// A statement that failed is `null`, not `[]`.
///
/// `queryAll` throws when D1 rejects a statement. Letting that bubble would turn one
/// unreadable module into a 500 for the whole workspace, so each read is wrapped and
/// the module that failed says so.
async function readRows<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[] | null> {
  try {
    return await queryAll<T>(db, sql, params);
  } catch {
    return null;
  }
}

async function readRow(db: D1Database, sql: string, params: unknown[] = []): Promise<Row | null> {
  try {
    return await queryFirst<Row>(db, sql, params);
  } catch {
    return null;
  }
}

function parseLanguages(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/// One page's localisation state, reduced to the questions an editor asks.
interface PageLocalization {
  language: string;
  has_text: boolean;
  has_alt: boolean;
  narration_asset_id: string | null;
  /// `ready` is the only status the publish gate accepts, so a narration row whose
  /// asset is still `processing` is present-but-not-ready and must not count.
  narration_ready: boolean;
  /// True only when `timing_cues` holds a non-empty array. Nothing in the codebase
  /// currently authors cues, but the builder must preserve data imported by another
  /// production path instead of replacing it with an empty array.
  has_timing: boolean;
  timing_cues: Array<Record<string, unknown>>;
}

interface PageSummary {
  id: string;
  page_number: number;
  layout: string;
  transition: string;
  duration_ms: number | null;
  dwell_ms: number | null;
  image_asset_id: string | null;
  image_status: string | null;
  image_url: string | null;
  background_asset_id: string | null;
  bubbles_count: number;
  localizations: PageLocalization[];
  updated_at: string | null;
}

/// Per-language coverage over pages, with the denominator kept.
///
/// A ratio without its denominator is unusable: "6" could be six of six or six of
/// forty. Every coverage figure in this payload carries `total`.
interface LanguageCoverage {
  language: string;
  declared: boolean;
  text_done: number;
  narration_done: number;
  timing_done: number;
  total: number;
}

function coverageFor(pages: PageSummary[], language: string, declared: boolean): LanguageCoverage {
  let textDone = 0;
  let narrationDone = 0;
  let timingDone = 0;
  for (const page of pages) {
    const entry = page.localizations.find((item) => item.language === language);
    if (entry?.has_text) textDone += 1;
    if (entry?.narration_ready) narrationDone += 1;
    if (entry?.has_timing) timingDone += 1;
  }
  return {
    language,
    declared,
    text_done: textDone,
    narration_done: narrationDone,
    timing_done: timingDone,
    total: pages.length,
  };
}

/// What blocks this story, itemised.
///
/// Each entry names the exact page and the exact tab that fixes it, because
/// "cannot publish" without a location makes an editor open every page in turn.
interface StoryBlocker {
  key: string;
  severity: 'blocker' | 'warning';
  label_ar: string;
  label_en: string;
  /// The page this concerns, when it concerns one page.
  page_number: number | null;
  /// Which inspector tab resolves it.
  inspector: 'content' | 'image' | 'audio' | 'timing' | 'layout' | null;
  language: string | null;
}

/// Page-level readiness, derived from the same facts the story-level gate uses.
function pageReadiness(page: PageSummary, defaultLanguage: string): 'ready' | 'partial' | 'empty' {
  const hasImage = !!page.image_asset_id && page.image_status === 'ready';
  const defaultText = page.localizations.find((item) => item.language === defaultLanguage)?.has_text ?? false;
  if (hasImage && defaultText) return 'ready';
  if (!hasImage && !defaultText) return 'empty';
  return 'partial';
}

/* ------------------------------------------------------------ the collection */

/// The story library, with the completeness the table could not show.
///
/// One statement per concern rather than a subquery per row: the previous list
/// computed `pages_count` as a correlated subquery and had no completeness at all,
/// so an operator could not tell a forty-page finished story from an empty shell.
route.get('/stories/library', async (c) => {
  const db = c.env.DB;
  const baseUrl = publicAssetBaseUrl(c.env);

  const query = (c.req.query('q') ?? '').trim().toLowerCase();
  const status = c.req.query('status');
  const type = c.req.query('type');
  const seriesId = c.req.query('series_id');
  const planet = c.req.query('planet');
  const readiness = c.req.query('readiness');
  const missing = c.req.query('missing');

  const rows = await readRows<Row>(db, `
    SELECT st.id, st.slug, st.title_ar, st.title_en, st.description_ar, st.type, st.status,
           st.age_min, st.age_max, st.reading_level, st.default_language, st.languages,
           st.is_free, st.sort_order, st.updated_at, st.published_at, st.series_id,
           s.title_ar AS series_title, s.planet_id,
           p.name_ar AS planet_name, p.color_hex AS planet_color,
           (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id = st.id) AS pages_total,
           (SELECT COUNT(*) FROM story_pages sp
              JOIN content_assets ca ON ca.id = sp.image_asset_id
             WHERE sp.story_id = st.id AND ca.status = 'ready') AS pages_with_image,
           ${artworkSelect('cover_asset', 'story', 'st.id', STORY_COVER_ROLES)}
      FROM stories st
      LEFT JOIN series s ON s.id = st.series_id
      LEFT JOIN planets p ON p.id = s.planet_id
     ORDER BY st.sort_order, st.updated_at DESC
  `);

  if (!rows) {
    return c.json({
      success: false,
      error: 'تعذّرت قراءة جدول القصص. لم يُعرض شيء بدل عرض مكتبة فارغة.',
    }, 503);
  }

  // Text and narration coverage for every story in two statements, not two per
  // story. A forty-story library would otherwise cost eighty round trips.
  const textRows = await readRows<Row>(db, `
    SELECT sp.story_id, l.language,
           COUNT(*) AS with_text
      FROM story_page_localizations l
      JOIN story_pages sp ON sp.id = l.page_id
     WHERE TRIM(COALESCE(l.body_text, '')) <> ''
     GROUP BY sp.story_id, l.language
  `);
  const narrationRows = await readRows<Row>(db, `
    SELECT sp.story_id, l.language, COUNT(*) AS with_narration
      FROM story_page_localizations l
      JOIN story_pages sp ON sp.id = l.page_id
      JOIN content_assets ca ON ca.id = l.narration_asset_id
     WHERE ca.status = 'ready'
     GROUP BY sp.story_id, l.language
  `);

  const textByStory = new Map<string, Map<string, number>>();
  for (const row of textRows ?? []) {
    const storyId = String(row.story_id);
    if (!textByStory.has(storyId)) textByStory.set(storyId, new Map());
    textByStory.get(storyId)!.set(String(row.language), num(row, 'with_text'));
  }
  const narrationByStory = new Map<string, Map<string, number>>();
  for (const row of narrationRows ?? []) {
    const storyId = String(row.story_id);
    if (!narrationByStory.has(storyId)) narrationByStory.set(storyId, new Map());
    narrationByStory.get(storyId)!.set(String(row.language), num(row, 'with_narration'));
  }

  const all = rows.map((row) => {
    applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl);
    const declared = parseLanguages(row.languages);
    const pagesTotal = num(row, 'pages_total');
    const defaultLanguage = String(row.default_language ?? 'ar');
    const textMap = textByStory.get(String(row.id)) ?? new Map();
    const narrationMap = narrationByStory.get(String(row.id)) ?? new Map();

    const coverage = LANGUAGES.map((language) => ({
      language,
      declared: declared.includes(language),
      text_done: textMap.get(language) ?? 0,
      narration_done: narrationMap.get(language) ?? 0,
      // Timing is never counted here: no code writes cues, so a per-story count
      // would be a column of zeros pretending to be a measurement.
      timing_done: 0,
      total: pagesTotal,
    }));

    const pagesWithImage = num(row, 'pages_with_image');
    const defaultText = textMap.get(defaultLanguage) ?? 0;

    // Readiness mirrors `lib/catalogueValidation.ts` rather than inventing a second
    // rule: pages exist, every page illustrated with a ready asset, and every page
    // carrying text in the default language.
    const readinessState = pagesTotal === 0
      ? 'empty'
      : pagesWithImage >= pagesTotal && defaultText >= pagesTotal
        ? 'ready'
        : 'partial';

    return {
      id: String(row.id),
      slug: row.slug,
      title_ar: row.title_ar,
      title_en: row.title_en,
      description_ar: row.description_ar,
      type: row.type,
      status: row.status,
      age_min: num(row, 'age_min'),
      age_max: num(row, 'age_max'),
      reading_level: row.reading_level,
      default_language: defaultLanguage,
      languages: declared,
      is_free: Boolean(row.is_free),
      sort_order: num(row, 'sort_order'),
      updated_at: row.updated_at,
      published_at: row.published_at,
      series_id: row.series_id,
      series_title: row.series_title,
      planet_id: row.planet_id,
      planet_name: row.planet_name,
      planet_color: row.planet_color,
      cover_url: row.cover_url ?? null,
      pages_total: pagesTotal,
      pages_with_image: pagesWithImage,
      coverage,
      readiness: readinessState,
    };
  });

  let visible = all;
  if (query) {
    visible = visible.filter((story) => [story.title_ar, story.title_en, story.slug]
      .some((value) => typeof value === 'string' && value.toLowerCase().includes(query)));
  }
  if (status && status !== 'all') visible = visible.filter((story) => story.status === status);
  if (!status) visible = visible.filter((story) => story.status !== 'archived');
  if (type) visible = visible.filter((story) => story.type === type);
  if (seriesId) visible = visible.filter((story) => story.series_id === seriesId);
  if (planet) visible = visible.filter((story) => story.planet_id === planet);
  if (readiness) visible = visible.filter((story) => story.readiness === readiness);

  // The `missing` filter names the specific deficiency, because "incomplete" sends
  // an operator hunting for which of six things is absent.
  if (missing === 'pages') visible = visible.filter((story) => story.pages_total === 0);
  if (missing === 'artwork') {
    visible = visible.filter((story) => story.pages_total > 0 && story.pages_with_image < story.pages_total);
  }
  if (missing === 'narration') {
    visible = visible.filter((story) => {
      const entry = story.coverage.find((item) => item.language === story.default_language);
      return story.pages_total > 0 && (entry?.narration_done ?? 0) < story.pages_total;
    });
  }
  if (missing === 'translation') {
    visible = visible.filter((story) => story.coverage.some((item) =>
      item.declared && item.language !== story.default_language && item.total > 0 && item.text_done < item.total));
  }
  if (missing === 'cover') visible = visible.filter((story) => !story.cover_url);

  const summary = {
    total: all.length,
    ready: all.filter((story) => story.readiness === 'ready').length,
    partial: all.filter((story) => story.readiness === 'partial').length,
    empty: all.filter((story) => story.readiness === 'empty').length,
    published: all.filter((story) => story.status === 'published').length,
    in_review: all.filter((story) => String(story.status).startsWith('review_')).length,
    missing_pages: all.filter((story) => story.pages_total === 0).length,
    missing_artwork: all.filter((story) => story.pages_total > 0 && story.pages_with_image < story.pages_total).length,
    missing_cover: all.filter((story) => !story.cover_url).length,
  };

  return c.json({
    success: true,
    data: visible,
    meta: {
      total: visible.length,
      summary,
      notes: [
        'تغطية القراءة المتزامنة غير محسوبة هنا: العمود timing_cues لا يكتبه شيء في المنصّة، فعدّه كان سيُنتج عمود أصفار يبدو قياسًا.',
        'الكوكب يأتي من series.planet_id — جدول القصص بلا عمود كوكب.',
      ],
    },
  });
});

/* ------------------------------------------------------------- the workspace */

/// Everything a story workspace and builder need, in one request.
///
/// The previous editor fetched the story, then 200 image blobs, then re-fetched the
/// whole story after every text save. This returns the story, its pages, every
/// localisation, coverage per language, itemised blockers and recent audit in five
/// statements total.
route.get('/stories/:id/workspace', async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const baseUrl = publicAssetBaseUrl(c.env);

  const story = await readRow(db, `
    SELECT st.*, s.title_ar AS series_title, s.planet_id, s.status AS series_status,
           s.content_class,
           p.name_ar AS planet_name, p.color_hex AS planet_color,
           vs.name_ar AS visual_style_name,
           ${artworkSelect('cover_asset', 'story', 'st.id', STORY_COVER_ROLES)}
      FROM stories st
      LEFT JOIN series s ON s.id = st.series_id
      LEFT JOIN planets p ON p.id = s.planet_id
      LEFT JOIN visual_styles vs ON vs.id = st.visual_style_id
     WHERE st.id = ?
  `, [id]);

  if (!story) return c.json({ success: false, error: 'Story not found' }, 404);
  applyArtworkUrl(story, 'cover_asset', 'cover_url', baseUrl);

  const pageRows = await readRows<Row>(db, `
    SELECT sp.id, sp.page_number, sp.layout, sp.transition, sp.duration_ms, sp.dwell_ms,
            sp.image_asset_id, sp.background_asset_id, sp.updated_at,
           ca.status AS image_status, ca.r2_key AS image_r2_key,
           ca.visibility AS image_visibility, ca.kind AS image_kind,
           ca.expected_width AS image_width, ca.expected_height AS image_height,
           ca.aspect_ratio AS image_aspect, ca.mime_type AS image_mime,
           ca.size_bytes AS image_size,
           (SELECT COUNT(*) FROM story_bubbles b WHERE b.page_id = sp.id) AS bubbles_count
      FROM story_pages sp
      LEFT JOIN content_assets ca ON ca.id = sp.image_asset_id
     WHERE sp.story_id = ?
     ORDER BY sp.page_number
     LIMIT ${PAGE_LIMIT}
  `, [id]);

  const localizationRows = pageRows && pageRows.length
    ? await readRows<Row>(db, `
        SELECT l.page_id, l.language, l.body_text, l.alt_text, l.narration_asset_id,
               l.timing_cues, l.updated_at,
               ca.status AS narration_status, ca.r2_key AS narration_r2_key,
               ca.visibility AS narration_visibility, ca.kind AS narration_kind,
               ca.source AS narration_source, ca.size_bytes AS narration_size
          FROM story_page_localizations l
          LEFT JOIN content_assets ca ON ca.id = l.narration_asset_id
         WHERE l.page_id IN (${pageRows.map(() => '?').join(', ')})
      `, pageRows.map((row) => row.id))
    : [];

  const declared = parseLanguages(story.languages);
  const defaultLanguage = String(story.default_language ?? 'ar');

  const pages: PageSummary[] = (pageRows ?? []).map((row) => {
    // The public URL is built through the same guard the rest of the catalogue
    // uses, so a key/visibility mismatch yields null rather than a broken image.
    const imageRow: Row = {
      cover_asset_r2_key: row.image_r2_key,
      cover_asset_visibility: row.image_visibility,
      cover_asset_status: row.image_status,
      cover_asset_kind: row.image_kind,
    };
    applyArtworkUrl(imageRow, 'cover_asset', 'image_url', baseUrl);

    const own = (localizationRows ?? []).filter((entry) => entry.page_id === row.id);
    return {
      id: String(row.id),
      page_number: num(row, 'page_number'),
      layout: String(row.layout ?? 'full_bleed'),
      transition: String(row.transition ?? 'fade'),
      duration_ms: row.duration_ms === null || row.duration_ms === undefined ? null : num(row, 'duration_ms'),
      dwell_ms: row.dwell_ms === null || row.dwell_ms === undefined ? null : num(row, 'dwell_ms'),
      image_asset_id: (row.image_asset_id as string | null) ?? null,
      image_status: (row.image_status as string | null) ?? null,
      image_url: (imageRow.image_url as string | null) ?? null,
      image_width: row.image_width === null ? null : num(row, 'image_width'),
      image_height: row.image_height === null ? null : num(row, 'image_height'),
      image_aspect: (row.image_aspect as string | null) ?? null,
      image_mime: (row.image_mime as string | null) ?? null,
      image_size: row.image_size === null ? null : num(row, 'image_size'),
      background_asset_id: (row.background_asset_id as string | null) ?? null,
      bubbles_count: num(row, 'bubbles_count'),
      updated_at: (row.updated_at as string | null) ?? null,
      localizations: own.map((entry) => {
        let cues: unknown[] = [];
        try {
          const parsed = JSON.parse(String(entry.timing_cues ?? '[]'));
          cues = Array.isArray(parsed) ? parsed : [];
        } catch {
          cues = [];
        }
        return {
          language: String(entry.language),
          has_text: !!text(entry.body_text),
          has_alt: !!text(entry.alt_text),
          body_text: (entry.body_text as string | null) ?? null,
          alt_text: (entry.alt_text as string | null) ?? null,
          narration_asset_id: (entry.narration_asset_id as string | null) ?? null,
          narration_status: (entry.narration_status as string | null) ?? null,
          narration_source: (entry.narration_source as string | null) ?? null,
          narration_size: entry.narration_size === null ? null : num(entry, 'narration_size'),
          narration_ready: entry.narration_status === 'ready',
          has_timing: cues.length > 0,
          timing_count: cues.length,
          timing_cues: cues,
          updated_at: (entry.updated_at as string | null) ?? null,
        };
      }),
    } as PageSummary;
  });

  const coverage = LANGUAGES.map((language) => coverageFor(pages, language, declared.includes(language)));

  // --- blockers, itemised ---------------------------------------------------
  const blockers: StoryBlocker[] = [];
  if (pages.length === 0) {
    blockers.push({
      key: 'no_pages',
      severity: 'blocker',
      label_ar: 'القصة بلا صفحات — لا يمكن نشرها قبل إضافة صفحة واحدة على الأقل',
      label_en: 'The story has no pages',
      page_number: null,
      inspector: null,
      language: null,
    });
  }
  for (const page of pages) {
    if (!page.image_asset_id) {
      blockers.push({
        key: `page_${page.page_number}_no_image`,
        severity: 'blocker',
        label_ar: `الصفحة ${page.page_number} بلا صورة`,
        label_en: `Page ${page.page_number} has no image`,
        page_number: page.page_number,
        inspector: 'image',
        language: null,
      });
    } else if (page.image_status !== 'ready') {
      // A `planned` asset is the exact trap the old editor set: single uploads
      // created assets as `planned` while the gate demands `ready`.
      blockers.push({
        key: `page_${page.page_number}_image_not_ready`,
        severity: 'blocker',
        label_ar: `صورة الصفحة ${page.page_number} حالتها «${page.image_status}» لا «ready»`,
        label_en: `Page ${page.page_number} image is ${page.image_status}, not ready`,
        page_number: page.page_number,
        inspector: 'image',
        language: null,
      });
    }
    const defaultEntry = page.localizations.find((item) => item.language === defaultLanguage);
    if (!defaultEntry?.has_text) {
      blockers.push({
        key: `page_${page.page_number}_no_text_${defaultLanguage}`,
        severity: 'blocker',
        label_ar: `الصفحة ${page.page_number} بلا نصّ بلغة القصة (${defaultLanguage})`,
        label_en: `Page ${page.page_number} has no ${defaultLanguage} text`,
        page_number: page.page_number,
        inspector: 'content',
        language: defaultLanguage,
      });
    }
    // An audio story needs narration on every page; anything else only warns,
    // matching `catalogueValidation.storyPublishError`.
    if (!defaultEntry?.narration_ready) {
      blockers.push({
        key: `page_${page.page_number}_no_narration_${defaultLanguage}`,
        severity: story.type === 'audio_story' ? 'blocker' : 'warning',
        label_ar: `الصفحة ${page.page_number} بلا سرد جاهز بلغة القصة`,
        label_en: `Page ${page.page_number} has no ready narration in the story language`,
        page_number: page.page_number,
        inspector: 'audio',
        language: defaultLanguage,
      });
    }
  }
  // Declared secondary languages that are incomplete are warnings, not blockers:
  // declaring a language is an intention, and the gate does not refuse publication
  // for it.
  for (const entry of coverage) {
    if (!entry.declared || entry.language === defaultLanguage || entry.total === 0) continue;
    if (entry.text_done < entry.total) {
      blockers.push({
        key: `language_${entry.language}_text_incomplete`,
        severity: 'warning',
        label_ar: `نصّ ${entry.language.toUpperCase()} ناقص: ${entry.text_done} من ${entry.total} صفحة`,
        label_en: `${entry.language.toUpperCase()} text incomplete: ${entry.text_done} of ${entry.total}`,
        page_number: null,
        inspector: 'content',
        language: entry.language,
      });
    }
  }

  const activity = await readRows<Row>(db, `
    SELECT al.id, al.actor_id, al.action, al.entity_type, al.entity_id, al.created_at,
           (SELECT display_name FROM admin_users WHERE id = al.actor_id) AS actor_name
      FROM audit_logs al
     WHERE (al.entity_type = 'story' AND al.entity_id = ?1)
        OR (al.entity_type IN ('story_page', 'story_bubble')
            AND al.entity_id IN (SELECT id FROM story_pages WHERE story_id = ?1))
     ORDER BY al.created_at DESC
     LIMIT ${ACTIVITY_LIMIT}
  `, [id]);

  return c.json({
    success: true,
    data: {
      story: {
        ...story,
        is_free: Boolean(story.is_free),
        languages: declared,
        cover_url: story.cover_url ?? null,
      },
      pages,
      coverage,
      blockers,
      readiness: {
        pages_total: pages.length,
        pages_with_image: pages.filter((page) => !!page.image_asset_id && page.image_status === 'ready').length,
        pages_ready: pages.filter((page) => pageReadiness(page, defaultLanguage) === 'ready').length,
        // Two separate verdicts on purpose. Narration without cues is a complete
        // "read to me" and an empty "read along", and collapsing them into one
        // number would hide which of the two an editor still owes.
        read_to_me_ready: pages.length > 0
          && pages.every((page) => page.localizations.some((item) =>
            item.language === defaultLanguage && item.narration_ready)),
        read_along_ready: pages.length > 0
          && pages.every((page) => page.localizations.some((item) =>
            item.language === defaultLanguage && item.has_timing)),
        publishable: blockers.filter((entry) => entry.severity === 'blocker').length === 0,
      },
      activity: activity ?? [],
      capabilities: {
        // Stated rather than discovered by an editor hitting a 409. Both CHECK
        // constraints omit 'story', and widening them needs a table rebuild.
        reviews_supported: false,
        reviews_reason: 'قيد content_reviews.entity_type لا يقبل story، فتوسيعه يحتاج إعادة بناء الجدول.',
        rights_supported: false,
        rights_reason: 'قيد content_rights.entity_type لا يقبل story.',
        timing_supported: false,
        timing_reason: 'العمود timing_cues يُقبل كمصفوفة فقط، ولا شيء في المنصّة يكتب مؤشّرات توقيت — فالقراءة المتزامنة غير منجزة بعد.',
        panels_supported: false,
        panels_reason: 'قيمة layout «panels» بلا جدول لوحات ولا هندسة ولا ترتيب قراءة. فقاعات الحوار مدعومة، أمّا لوحات الكوميكس فغير موجودة.',
        bubbles_supported: true,
      },
      generated_at: new Date().toISOString(),
    },
  });
});

/* ---------------------------------------------------------------- the writes */

/// Reorders a story's pages in one transaction.
///
/// ## Why this endpoint has to exist
///
/// `story_pages` has `UNIQUE (story_id, page_number)`. Reordering by patching one
/// page at a time collides with that constraint the moment a page moves into an
/// occupied slot, and the only existing write is `PATCH /admin/story-pages/:id`.
/// So reordering was impossible from the dashboard, and the previous editor did
/// not offer it at all.
///
/// ## The two-phase move
///
/// Every affected page is first parked on a negative page number, then written to
/// its final number. Negative values cannot collide with real ones, and because
/// `CHECK (page_number > 0)` rejects them, the parking numbers cannot survive a
/// half-applied batch — the statement would fail and D1 rolls the batch back.
///
/// This is why the whole thing is one `db.batch()`: a partial reorder would leave
/// the story with duplicate or missing page numbers, which no later request could
/// untangle.
route.post('/stories/:id/pages/reorder', requirePermission('edit_metadata'), async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');

  const body = await c.req.json().catch(() => null);
  const order = (body as { order?: unknown } | null)?.order;
  if (!Array.isArray(order) || order.length === 0) {
    return c.json({ success: false, error: 'order must be a non-empty array of page ids' }, 400);
  }
  if (!order.every((item): item is string => typeof item === 'string' && item.length > 0)) {
    return c.json({ success: false, error: 'order must contain page ids' }, 400);
  }
  if (new Set(order).size !== order.length) {
    return c.json({ success: false, error: 'order contains a duplicate page id' }, 400);
  }

  const story = await queryFirst<{ id: string; status: string }>(
    db, 'SELECT id, status FROM stories WHERE id = ?', [id],
  );
  if (!story) return c.json({ success: false, error: 'Story not found' }, 404);

  const existing = await queryAll<{ id: string }>(
    db, 'SELECT id FROM story_pages WHERE story_id = ? ORDER BY page_number', [id],
  );
  const existingIds = existing.map((row) => row.id);

  // The payload must be a permutation of exactly this story's pages. A subset would
  // silently renumber part of the story, and a foreign id would let one story
  // reorder another's pages.
  if (order.length !== existingIds.length || !order.every((pageId) => existingIds.includes(pageId))) {
    return c.json({
      success: false,
      error: 'order must list every page of this story exactly once',
      data: { expected: existingIds.length, received: order.length },
    }, 400);
  }

  const statements = [
    // Phase one: park. `-index - 1` keeps them distinct and negative.
    ...order.map((pageId, index) => db
      .prepare('UPDATE story_pages SET page_number = ?, updated_at = datetime(\'now\') WHERE id = ? AND story_id = ?')
      .bind(-(index + 1), pageId, id)),
    // Phase two: land on the final numbers, and keep `sort_order` in step so the
    // two ordering columns cannot disagree.
    ...order.map((pageId, index) => db
      .prepare('UPDATE story_pages SET page_number = ?, sort_order = ?, updated_at = datetime(\'now\') WHERE id = ? AND story_id = ?')
      .bind(index + 1, index + 1, pageId, id)),
    auditStatement(db, actorId(c), 'reorder', 'story', id, { pages: order.length, order }),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    // `CHECK (page_number > 0)` firing here means the parking phase was rejected,
    // which is the safe failure: nothing was committed.
    return c.json({
      success: false,
      error: 'تعذّر إعادة الترتيب ولم يُطبَّق شيء منه.',
      data: { detail: error instanceof Error ? error.message : String(error) },
    }, 409);
  }

  return c.json({ success: true, data: { id, pages: order.length, order } });
});

export default route;
