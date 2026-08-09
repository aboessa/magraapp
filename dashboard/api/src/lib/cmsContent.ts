/// Validation and rules for the public CMS: page sections, blog blocks, SEO metadata,
/// paths and publish readiness.
///
/// Pure — no D1, no request, no clock. The routes gather rows and call these.
///
/// ## Why validation is strict on write rather than lenient on read
///
/// Everything here reaches a *public* page. A malformed section renders as a broken
/// layout to every visitor, and an unvalidated block is an injection surface: the body
/// is authored by people and rendered as markup, so "we will sanitise it later" means
/// "we will ship it unsanitised". Rejecting a bad block at the API boundary costs an
/// editor one error message; accepting it costs a public incident.
///
/// ## Why URLs are computed, not typed
///
/// `pagePath` and `postPath` derive the full path from language and slug. Letting an
/// editor type the path invites `/ar/plans` and `/AR/plans/` to coexist, which is two
/// URLs for one page — the exact shape that produces duplicate-content penalties and
/// makes canonical tags a guess. The slug is the editor's decision; the path is not.

export const CMS_LANGUAGES = ['ar', 'en', 'fr'] as const;
export type CmsLanguage = (typeof CMS_LANGUAGES)[number];

export function isCmsLanguage(value: unknown): value is CmsLanguage {
  return typeof value === 'string' && (CMS_LANGUAGES as readonly string[]).includes(value);
}

/// Text direction per language, used by the renderer and by the editor preview.
export function direction(language: CmsLanguage): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

export const CMS_STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'] as const;
export type CmsStatus = (typeof CMS_STATUSES)[number];

export function isCmsStatus(value: unknown): value is CmsStatus {
  return typeof value === 'string' && (CMS_STATUSES as readonly string[]).includes(value);
}

export const SECTION_TYPES = [
  'hero', 'rich_text', 'feature_grid', 'media', 'cta', 'faq', 'plans',
  'content_rail', 'testimonials', 'steps', 'stats', 'partners', 'legal_text',
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export const BLOCK_TYPES = [
  'heading', 'paragraph', 'list', 'image', 'quote', 'callout',
  'embed', 'cta', 'related_content', 'divider',
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/// Hosts whose embeds are allowed.
///
/// An allow-list, not a deny-list. A deny-list on user-authored embeds is a promise to
/// enumerate every hostile host in advance, and the cost of one miss is arbitrary
/// third-party script execution on a children's site.
export const ALLOWED_EMBED_HOSTS = [
  'youtube.com', 'www.youtube.com', 'youtu.be', 'player.vimeo.com', 'cdn.majarra.app',
] as const;

const text = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/// Slug rules: lower case, alphanumeric and hyphens, no leading or trailing hyphen.
///
/// Latin-only deliberately, including for Arabic pages. A percent-encoded Arabic slug is
/// unreadable in a shared link, breaks in some clients and is impossible to dictate over
/// the phone; the Arabic title carries the meaning, the slug carries the address.
export function isValidSlug(value: unknown): boolean {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

export function slugify(value: string): string {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/// The canonical path for a page. The home page of a language has no slug segment.
export function pagePath(language: CmsLanguage, slug: string): string {
  return slug ? `/${language}/${slug}` : `/${language}`;
}

export function postPath(language: CmsLanguage, slug: string): string {
  return `/${language}/blog/${slug}`;
}

// --- Sections --------------------------------------------------------------

export interface SectionInput {
  section_type: SectionType;
  sort_order: number;
  is_active: boolean;
  content: Record<string, unknown>;
  media_asset_id: string | null;
  cta: Record<string, unknown>;
}

/// Required content keys per section type.
///
/// A section that renders empty is not a neutral outcome on a public page: it leaves a
/// gap in the layout that looks like a bug to a visitor and like a finished page to the
/// editor who saved it.
const SECTION_REQUIRED: Record<SectionType, string[]> = {
  hero: ['headline'],
  rich_text: ['body'],
  feature_grid: ['items'],
  media: [],
  cta: ['label', 'href'],
  faq: ['items'],
  plans: [],
  content_rail: ['source'],
  testimonials: ['items'],
  steps: ['items'],
  stats: ['items'],
  partners: ['items'],
  legal_text: ['body'],
};

/// Section types whose `items` must be a non-empty array.
const SECTION_ITEM_TYPES: SectionType[] = ['feature_grid', 'faq', 'testimonials', 'steps', 'stats', 'partners'];

export function validateSection(raw: Record<string, unknown>): { error: string } | { section: SectionInput } {
  const sectionType = raw.section_type;
  if (typeof sectionType !== 'string' || !(SECTION_TYPES as readonly string[]).includes(sectionType)) {
    return { error: `section_type must be one of: ${SECTION_TYPES.join(', ')}` };
  }
  const type = sectionType as SectionType;

  const content = raw.content && typeof raw.content === 'object' && !Array.isArray(raw.content)
    ? raw.content as Record<string, unknown>
    : {};
  for (const key of SECTION_REQUIRED[type]) {
    const value = content[key];
    const present = Array.isArray(value) ? value.length > 0 : !!text(value, 5_000);
    if (!present) return { error: `section ${type} requires content.${key}` };
  }
  if (SECTION_ITEM_TYPES.includes(type) && !Array.isArray(content.items)) {
    return { error: `section ${type} requires content.items to be an array` };
  }

  const cta = raw.cta && typeof raw.cta === 'object' && !Array.isArray(raw.cta)
    ? raw.cta as Record<string, unknown>
    : {};
  // A CTA with a label and no destination is a button that does nothing, which is worse
  // than no button: a visitor clicks it and concludes the site is broken.
  if (text(cta.label, 120) && !text(cta.href, 500)) {
    return { error: 'a CTA with a label needs an href' };
  }

  const sortOrder = Number(raw.sort_order);
  return {
    section: {
      section_type: type,
      sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
      is_active: raw.is_active !== false,
      content,
      media_asset_id: text(raw.media_asset_id, 120),
      cta,
    },
  };
}

// --- Blog blocks -----------------------------------------------------------

export interface Block {
  type: BlockType;
  [key: string]: unknown;
}

function embedHostAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return (ALLOWED_EMBED_HOSTS as readonly string[]).includes(parsed.hostname);
  } catch {
    return false;
  }
}

/// Validates a body block array, returning the normalised blocks or the 400 message.
///
/// Rejects rather than strips. Silently dropping an invalid block means an editor
/// publishes a post missing a paragraph they wrote and never learns why.
export function validateBlocks(raw: unknown): { error: string } | { blocks: Block[] } {
  if (!Array.isArray(raw)) return { error: 'body must be an array of blocks' };
  if (raw.length > 300) return { error: 'body must contain 300 blocks or fewer' };

  const blocks: Block[] = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: `block ${index + 1} must be an object` };
    }
    const block = entry as Record<string, unknown>;
    const type = block.type;
    if (typeof type !== 'string' || !(BLOCK_TYPES as readonly string[]).includes(type)) {
      return { error: `block ${index + 1} has an unknown type` };
    }

    switch (type as BlockType) {
      case 'heading': {
        const level = Number(block.level);
        // h1 is the post title, emitted by the renderer. A second h1 in the body breaks
        // the document outline that screen readers and search engines both rely on.
        if (!Number.isInteger(level) || level < 2 || level > 4) {
          return { error: `block ${index + 1}: heading level must be 2, 3 or 4` };
        }
        if (!text(block.text, 200)) return { error: `block ${index + 1}: heading needs text` };
        break;
      }
      case 'paragraph':
        if (!text(block.text, 5_000)) return { error: `block ${index + 1}: paragraph needs text` };
        break;
      case 'list':
        if (!Array.isArray(block.items) || !block.items.length) {
          return { error: `block ${index + 1}: list needs items` };
        }
        if (block.style !== undefined && block.style !== 'bullet' && block.style !== 'number') {
          return { error: `block ${index + 1}: list style must be bullet or number` };
        }
        break;
      case 'image':
        // By asset id, never by pasted URL: an asset carries its status and dimensions,
        // and alt text is required because an image without it is invisible to a screen
        // reader and to an image search.
        if (!text(block.asset_id, 120)) return { error: `block ${index + 1}: image needs an asset_id` };
        if (!text(block.alt, 300)) return { error: `block ${index + 1}: image needs alt text` };
        break;
      case 'quote':
        if (!text(block.text, 1_000)) return { error: `block ${index + 1}: quote needs text` };
        break;
      case 'callout':
        if (!text(block.text, 2_000)) return { error: `block ${index + 1}: callout needs text` };
        if (block.tone !== undefined && !['info', 'warning', 'success'].includes(String(block.tone))) {
          return { error: `block ${index + 1}: callout tone must be info, warning or success` };
        }
        break;
      case 'embed': {
        const url = text(block.url, 500);
        if (!url) return { error: `block ${index + 1}: embed needs a url` };
        if (!embedHostAllowed(url)) {
          return {
            error: `block ${index + 1}: embeds are limited to https and to ${ALLOWED_EMBED_HOSTS.join(', ')}`,
          };
        }
        break;
      }
      case 'cta':
        if (!text(block.label, 120) || !text(block.href, 500)) {
          return { error: `block ${index + 1}: cta needs a label and an href` };
        }
        break;
      case 'related_content': {
        if (!Array.isArray(block.items) || !block.items.length) {
          return { error: `block ${index + 1}: related_content needs items` };
        }
        break;
      }
      case 'divider':
        break;
    }
    blocks.push(block as Block);
  }
  return { blocks };
}

/// Plain text of a body, for excerpt suggestions and word counts.
export function blocksToText(blocks: Block[]): string {
  return blocks.flatMap((block) => {
    if (typeof block.text === 'string') return [block.text];
    if (Array.isArray(block.items)) {
      return block.items.filter((item): item is string => typeof item === 'string');
    }
    return [];
  }).join(' ').trim();
}

// --- SEO -------------------------------------------------------------------

export interface SeoInput {
  seo_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots_index: boolean;
  robots_follow: boolean;
  og_title: string | null;
  og_description: string | null;
  og_image_asset_id: string | null;
  structured_data: unknown | null;
}

/// Length guidance, applied as warnings rather than as errors.
///
/// These are what search engines *display*, not what they accept. Refusing a 65-character
/// title would be inventing a rule; saying it will be truncated is the useful thing.
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MIN = 70;
export const SEO_DESCRIPTION_MAX = 160;

export function validateSeo(raw: Record<string, unknown>): { error: string } | { seo: SeoInput; warnings: string[] } {
  const warnings: string[] = [];
  const seoTitle = text(raw.seo_title, 200);
  const description = text(raw.meta_description, 400);
  const canonical = text(raw.canonical_url, 500);

  if (canonical) {
    try {
      const parsed = new URL(canonical);
      if (parsed.protocol !== 'https:') return { error: 'canonical_url must be https' };
    } catch {
      return { error: 'canonical_url must be an absolute https URL' };
    }
  }

  let structured: unknown = null;
  if (raw.structured_data !== undefined && raw.structured_data !== null && raw.structured_data !== '') {
    const value = typeof raw.structured_data === 'string'
      ? (() => { try { return JSON.parse(raw.structured_data as string); } catch { return undefined; } })()
      : raw.structured_data;
    if (value === undefined) return { error: 'structured_data must be valid JSON' };
    // JSON-LD must be an object or an array of objects; a bare string or number is not
    // structured data and search engines report it as an error on the live page.
    const objects = Array.isArray(value) ? value : [value];
    if (objects.some((item) => !item || typeof item !== 'object')) {
      return { error: 'structured_data must be a JSON-LD object or an array of objects' };
    }
    if (objects.some((item) => !('@type' in (item as Record<string, unknown>)))) {
      return { error: 'each structured_data object needs an @type' };
    }
    structured = value;
  }

  if (seoTitle && seoTitle.length > SEO_TITLE_MAX) {
    warnings.push(`العنوان ${seoTitle.length} حرفًا؛ يُقتطع عادةً بعد ${SEO_TITLE_MAX}.`);
  }
  if (description && description.length > SEO_DESCRIPTION_MAX) {
    warnings.push(`الوصف ${description.length} حرفًا؛ يُقتطع عادةً بعد ${SEO_DESCRIPTION_MAX}.`);
  }
  if (description && description.length < SEO_DESCRIPTION_MIN) {
    warnings.push(`الوصف ${description.length} حرفًا؛ أقل من ${SEO_DESCRIPTION_MIN} يضيّع مساحة نتيجة البحث.`);
  }

  return {
    seo: {
      seo_title: seoTitle,
      meta_description: description,
      canonical_url: canonical,
      robots_index: raw.robots_index !== false,
      robots_follow: raw.robots_follow !== false,
      og_title: text(raw.og_title, 200),
      og_description: text(raw.og_description, 400),
      og_image_asset_id: text(raw.og_image_asset_id, 120),
      structured_data: structured,
    },
    warnings,
  };
}

// --- Publish readiness -----------------------------------------------------

export interface CmsPublishBlocker {
  id: string;
  detail: string;
  severity: 'blocker' | 'warning';
}

/// Publish readiness for a website page.
///
/// Same philosophy as the catalogue publish gate: every blocker at once, each one
/// actionable, and a warning is never dressed up as a blocker.
export function pagePublishBlockers(input: {
  title: string | null;
  sections: Array<{ section_type: string; is_active: boolean }>;
  seo: { seo_title: string | null; meta_description: string | null } | null;
}): CmsPublishBlocker[] {
  const blockers: CmsPublishBlocker[] = [];
  if (!text(input.title, 200)) {
    blockers.push({ id: 'title', detail: 'الصفحة بلا عنوان.', severity: 'blocker' });
  }
  const active = input.sections.filter((section) => section.is_active);
  if (!active.length) {
    blockers.push({ id: 'sections', detail: 'لا أقسام مُفعَّلة، فالصفحة ستُنشر فارغة.', severity: 'blocker' });
  }
  if (!input.seo?.seo_title) {
    blockers.push({ id: 'seo_title', detail: 'لا عنوان SEO؛ ستُعرض النتيجة بعنوان الصفحة الخام.', severity: 'warning' });
  }
  if (!input.seo?.meta_description) {
    blockers.push({ id: 'meta_description', detail: 'لا وصف ميتا؛ محرّك البحث سيقتطع نصًّا من الصفحة.', severity: 'warning' });
  }
  return blockers;
}

/// Publish readiness for a blog post, including the religious gate.
export function postPublishBlockers(input: {
  title: string | null;
  excerpt: string | null;
  blocks: Block[];
  hero_asset_id: string | null;
  author_id: string | null;
  category_id: string | null;
  is_religious: boolean;
  religious_reviewer_id: string | null;
  religious_approved_at: string | null;
  seo: { seo_title: string | null; meta_description: string | null } | null;
}): CmsPublishBlocker[] {
  const blockers: CmsPublishBlocker[] = [];
  if (!text(input.title, 200)) {
    blockers.push({ id: 'title', detail: 'المقال بلا عنوان.', severity: 'blocker' });
  }
  if (!input.blocks.length) {
    blockers.push({ id: 'body', detail: 'لا محتوى في المقال.', severity: 'blocker' });
  }
  if (!input.author_id) {
    blockers.push({ id: 'author', detail: 'لا كاتب مرتبط؛ المقال سيُنشر بلا نسبة.', severity: 'blocker' });
  }
  // The religious gate blocks, exactly as it does for series and episodes. This is the
  // gate lib/islamicContent.ts records as having been silently bypassed for the whole
  // catalogue once, and a blog post is no less public than an episode.
  if (input.is_religious && (!input.religious_reviewer_id || !input.religious_approved_at)) {
    blockers.push({
      id: 'religious_review',
      detail: 'محتوى ديني بلا مراجع شرعي مُسجَّل وتاريخ موافقة.',
      severity: 'blocker',
    });
  }
  if (!input.excerpt) {
    blockers.push({ id: 'excerpt', detail: 'لا مقتطف؛ ستُقتطع البداية آليًا في القوائم.', severity: 'warning' });
  }
  if (!input.hero_asset_id) {
    blockers.push({ id: 'hero', detail: 'لا صورة رئيسية؛ بطاقة المشاركة ستظهر بلا صورة.', severity: 'warning' });
  }
  if (!input.category_id) {
    blockers.push({ id: 'category', detail: 'لا تصنيف؛ المقال لن يظهر في أي قائمة تصنيف.', severity: 'warning' });
  }
  if (!input.seo?.meta_description) {
    blockers.push({ id: 'meta_description', detail: 'لا وصف ميتا.', severity: 'warning' });
  }
  return blockers;
}
