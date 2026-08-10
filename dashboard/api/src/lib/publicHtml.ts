/// Server-side HTML for every indexable public URL.
///
/// ## Why this exists
///
/// `routes/publicSite.ts` already computes one server-side answer for what each public URL
/// should say — title, description, canonical, robots, Open Graph, `hreflang`, JSON-LD —
/// and its own header comment records the gap it could not close: *"It does not render
/// HTML. The public site is a client-rendered application, so these payloads still need a
/// renderer that puts them in the initial document."*
///
/// This module is that renderer. It turns the same payloads into a complete initial
/// document, so a crawler that never executes JavaScript still receives the title, the
/// meta description, the canonical, the robots directive, the alternates, the structured
/// data, one `h1` and the actual page text.
///
/// ## Pure on purpose
///
/// No D1, no `Request`, no clock, no environment. The route gathers rows, resolves asset
/// ids to CDN URLs and calls these functions with plain data. That is what makes the
/// output assertable in a unit test without a running Worker, and it is why the escaping
/// rules below can be trusted: there is exactly one path from data to markup.
///
/// ## Escaping
///
/// Every interpolated value goes through [escapeHtml] or [escapeAttribute]. Section and
/// block content is authored by people through the admin, and `lib/cmsContent.ts`
/// validates its *shape*, not its characters — a headline containing `<script>` is a
/// legitimate string as far as validation is concerned. Rich text is therefore rendered as
/// escaped paragraphs rather than as markup: the CMS has no rich-text-as-HTML contract, so
/// treating the body as HTML would invent an injection surface on a children's site.

export const HTML_DIRECTIONS = { ar: 'rtl', en: 'ltr', fr: 'ltr' } as const;

/// The head payload shape produced by `routes/publicSite.ts`.
///
/// Declared here rather than imported so this module stays free of the route's D1 types;
/// the route asserts the two agree by passing its own value straight in.
export interface RenderHead {
  title: string;
  description: string | null;
  canonical: string;
  lang: string;
  dir: 'rtl' | 'ltr';
  robots: string;
  og: {
    title: string;
    description: string | null;
    url: string;
    type: string;
    locale: string;
    /// Resolved by the route from `og_image_asset_id`; never a raw asset id.
    image_url?: string | null;
  };
  alternates: Array<{ hreflang: string; href: string }>;
  structured_data: unknown[];
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/// Escapes text for element content and for double-quoted attributes alike.
///
/// One function for both contexts because the set of characters that must be escaped in a
/// quoted attribute is a subset of the set that must be escaped in text; using the wider
/// set everywhere removes the chance of picking the wrong helper at a call site.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

export const escapeAttribute = escapeHtml;

/// Escapes a JSON-LD payload for a `<script type="application/ld+json">` block.
///
/// `</script>` inside a JSON string would end the element early and let the remainder be
/// parsed as markup, so the sequence is broken with a unicode escape that is still valid
/// JSON. HTML-escaping the whole payload instead would corrupt it, because the contents of
/// a `script` element are not HTML-decoded.
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/// True when a URL is safe to emit as an `href` or `src`.
///
/// Only same-origin-relative paths and explicit `https:`/`mailto:` URLs. `javascript:` and
/// `data:` are the two that turn an editor-supplied link into script execution, and an
/// allow-list is the only form of this check that stays correct as new schemes appear.
export function isSafeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  if (trimmed.startsWith('#')) return true;
  return /^(https:|mailto:)/i.test(trimmed);
}

const safeHref = (value: unknown): string | null => (isSafeUrl(value) ? String(value).trim() : null);

const text = (value: unknown, max = 5_000): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/// Renders a plain-text body as paragraphs.
///
/// Blank lines separate paragraphs, single newlines are kept inside one. Escaped first,
/// which is why the body cannot smuggle markup through.
export function renderProse(value: unknown): string {
  const body = text(value, 20_000);
  if (!body) return '';
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

// --- Head ------------------------------------------------------------------

/// The contents of `<head>` for one public URL.
///
/// `robots` is emitted even when it is `index, follow`, because an absent robots tag and an
/// explicit `index` tag are indistinguishable to a reader auditing the page, and this
/// document is the audit surface.
export function renderHeadTags(head: RenderHead): string {
  const lines: string[] = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(head.title)}</title>`,
  ];

  if (head.description) {
    lines.push(`<meta name="description" content="${escapeAttribute(head.description)}" />`);
  }
  lines.push(`<link rel="canonical" href="${escapeAttribute(head.canonical)}" />`);
  lines.push(`<meta name="robots" content="${escapeAttribute(head.robots)}" />`);

  for (const alternate of head.alternates) {
    lines.push(
      `<link rel="alternate" hreflang="${escapeAttribute(alternate.hreflang)}" href="${escapeAttribute(alternate.href)}" />`,
    );
  }

  lines.push(`<meta property="og:site_name" content="Majarra" />`);
  lines.push(`<meta property="og:title" content="${escapeAttribute(head.og.title)}" />`);
  if (head.og.description) {
    lines.push(`<meta property="og:description" content="${escapeAttribute(head.og.description)}" />`);
  }
  lines.push(`<meta property="og:url" content="${escapeAttribute(head.og.url)}" />`);
  lines.push(`<meta property="og:type" content="${escapeAttribute(head.og.type)}" />`);
  lines.push(`<meta property="og:locale" content="${escapeAttribute(head.og.locale)}" />`);
  if (head.og.image_url && isSafeUrl(head.og.image_url)) {
    lines.push(`<meta property="og:image" content="${escapeAttribute(head.og.image_url)}" />`);
    lines.push('<meta name="twitter:card" content="summary_large_image" />');
  } else {
    lines.push('<meta name="twitter:card" content="summary" />');
  }
  lines.push(`<meta name="twitter:title" content="${escapeAttribute(head.og.title)}" />`);

  for (const entry of head.structured_data) {
    if (!entry || typeof entry !== 'object') continue;
    lines.push(`<script type="application/ld+json">${escapeJsonLd(entry)}</script>`);
  }

  return lines.join('\n    ');
}

/// A deliberately small stylesheet, inlined.
///
/// Inlined rather than linked because this document must be complete in one request: a
/// crawler that fetches the HTML and nothing else should still see a legible page, and a
/// second request for a stylesheet is a second chance to fail. It is intentionally plain —
/// the marketing design lives in the client application; this is the document that has to
/// be correct, readable and directional.
const BASE_STYLE = `
:root { color-scheme: dark; --ink:#e8edfb; --muted:#a7b0cc; --bg:#06091a; --panel:#0d1330; --line:#1e2650; --accent:#6ee7d7; }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font-family: system-ui, "Segoe UI", Tahoma, sans-serif; line-height:1.7; }
a { color:var(--accent); }
.wrap { max-width: 880px; margin: 0 auto; padding: 24px 20px 64px; }
header.site, footer.site { border-bottom:1px solid var(--line); background:var(--panel); }
footer.site { border-bottom:0; border-top:1px solid var(--line); margin-top:48px; }
header.site nav ul, footer.site ul { list-style:none; display:flex; flex-wrap:wrap; gap:14px; margin:0; padding:0; }
header.site .wrap, footer.site .wrap { padding:14px 20px; }
h1 { font-size: 1.9rem; line-height:1.3; margin:0 0 12px; }
h2 { font-size: 1.35rem; margin:32px 0 8px; }
h3 { font-size: 1.1rem; margin:24px 0 6px; }
p { margin:0 0 12px; }
section { margin:0 0 28px; padding:0 0 4px; }
.lede { color:var(--muted); font-size:1.05rem; }
figure { margin:16px 0; }
img, iframe { max-width:100%; height:auto; border-radius:10px; border:1px solid var(--line); }
iframe { aspect-ratio:16/9; width:100%; }
blockquote { margin:16px 0; padding:12px 16px; border-inline-start:3px solid var(--accent); background:var(--panel); }
.callout { padding:12px 16px; border:1px solid var(--line); border-radius:10px; background:var(--panel); margin:16px 0; }
.cards { list-style:none; margin:0; padding:0; display:grid; gap:14px; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }
.cards li { border:1px solid var(--line); border-radius:12px; padding:14px; background:var(--panel); }
.cta { display:inline-block; margin:8px 0; padding:10px 18px; border-radius:999px; background:var(--accent); color:#04121a; font-weight:700; text-decoration:none; }
.meta { color:var(--muted); font-size:.9rem; }
dl dt { font-weight:700; margin-top:14px; }
dl dd { margin:4px 0 0; color:var(--muted); }
.posts { list-style:none; padding:0; margin:0; display:grid; gap:18px; }
.posts li { border:1px solid var(--line); border-radius:12px; padding:16px; background:var(--panel); }
.pager { display:flex; gap:16px; margin-top:24px; }
.unavailable { color:var(--muted); font-style:italic; }
`.trim();

export interface DocumentInput {
  head: RenderHead;
  /// Rendered `<main>` contents.
  main: string;
  /// Site navigation, rendered above `main`.
  nav?: string;
  /// Footer contents, including the language switcher.
  footer?: string;
}

/// Assembles the whole document.
///
/// `lang` and `dir` come from the content's own language, not from the visitor: an Arabic
/// page is `lang="ar" dir="rtl"` regardless of who is reading it, which is the only way a
/// crawler and a screen reader both get the language right.
export function renderDocument(input: DocumentInput): string {
  const { head } = input;
  return `<!doctype html>
<html lang="${escapeAttribute(head.lang)}" dir="${escapeAttribute(head.dir)}">
  <head>
    ${renderHeadTags(head)}
    <style>${BASE_STYLE}</style>
  </head>
  <body>
${input.nav ?? ''}
    <div class="wrap">
      <main>
${input.main}
      </main>
    </div>
${input.footer ?? ''}
  </body>
</html>
`;
}

// --- Navigation ------------------------------------------------------------

export interface NavLink {
  href: string;
  label: string;
  current?: boolean;
}

/// Site header with internal links.
///
/// Internal links are part of what makes a page indexable: a URL a crawler cannot reach
/// from another page is a URL it may never see. The link set is passed in rather than built
/// here so the route can list only the pages that are actually published in that language —
/// linking to an unpublished page would send a crawler to a 404.
export function renderNav(input: { home: string; brand: string; links: NavLink[] }): string {
  const items = input.links.filter((link) => isSafeUrl(link.href)).map((link) => {
    const current = link.current ? ' aria-current="page"' : '';
    return `<li><a href="${escapeAttribute(link.href)}"${current}>${escapeHtml(link.label)}</a></li>`;
  }).join('');
  return `    <header class="site">
      <div class="wrap">
        <a href="${escapeAttribute(input.home)}"><strong>${escapeHtml(input.brand)}</strong></a>
        <nav aria-label="${escapeAttribute(input.brand)}"><ul>${items}</ul></nav>
      </div>
    </header>`;
}

/// Footer with the language switcher built from the same alternates as `hreflang`.
///
/// Built from one list so the visible switcher and the machine-readable alternates cannot
/// disagree; a switcher offering a language whose page is unpublished is the usual way that
/// happens.
export function renderFooter(input: {
  alternates: Array<{ hreflang: string; href: string; label: string }>;
  links?: NavLink[];
  note?: string | null;
}): string {
  const languages = input.alternates
    .filter((alternate) => alternate.hreflang !== 'x-default' && isSafeUrl(alternate.href))
    .map((alternate) =>
      `<li><a href="${escapeAttribute(alternate.href)}" hreflang="${escapeAttribute(alternate.hreflang)}" lang="${escapeAttribute(alternate.hreflang)}">${escapeHtml(alternate.label)}</a></li>`)
    .join('');
  const links = (input.links ?? [])
    .filter((link) => isSafeUrl(link.href))
    .map((link) => `<li><a href="${escapeAttribute(link.href)}">${escapeHtml(link.label)}</a></li>`)
    .join('');
  return `    <footer class="site">
      <div class="wrap">
${links ? `        <nav aria-label="footer"><ul>${links}</ul></nav>\n` : ''}${languages ? `        <ul>${languages}</ul>\n` : ''}${input.note ? `        <p class="meta">${escapeHtml(input.note)}</p>\n` : ''}      </div>
    </footer>`;
}

// --- Website page sections -------------------------------------------------

export interface RenderSection {
  section_type: string;
  content: Record<string, unknown>;
  cta: Record<string, unknown>;
  /// Resolved by the route; null when the asset is missing, private or not ready.
  media_url: string | null;
  media_alt: string | null;
}

const itemList = (value: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' && !Array.isArray(item)
      ? item as Record<string, unknown>
      : (typeof item === 'string' ? { title: item } : null)))
    .filter((item): item is Record<string, unknown> => item !== null);
};

const pick = (item: Record<string, unknown>, keys: string[], max = 2_000): string | null => {
  for (const key of keys) {
    const value = text(item[key], max);
    if (value) return value;
  }
  return null;
};

function renderCta(cta: Record<string, unknown>): string {
  const label = text(cta.label, 120);
  const href = safeHref(cta.href);
  if (!label || !href) return '';
  return `<p><a class="cta" href="${escapeAttribute(href)}">${escapeHtml(label)}</a></p>`;
}

function renderCards(items: Array<Record<string, unknown>>): string {
  if (!items.length) return '';
  const cards = items.map((item) => {
    const title = pick(item, ['title', 'name', 'label', 'headline'], 200);
    const body = pick(item, ['body', 'text', 'description', 'summary']);
    const href = safeHref(item.href ?? item.url);
    const heading = title
      ? (href ? `<h3><a href="${escapeAttribute(href)}">${escapeHtml(title)}</a></h3>` : `<h3>${escapeHtml(title)}</h3>`)
      : '';
    return `<li>${heading}${body ? renderProse(body) : ''}</li>`;
  }).join('\n');
  return `<ul class="cards">\n${cards}\n</ul>`;
}

function renderMedia(section: RenderSection): string {
  if (!section.media_url || !isSafeUrl(section.media_url)) return '';
  const alt = section.media_alt ?? pick(section.content, ['alt', 'caption', 'headline'], 300) ?? '';
  const caption = pick(section.content, ['caption'], 300);
  return `<figure><img src="${escapeAttribute(section.media_url)}" alt="${escapeAttribute(alt)}" loading="lazy" />`
    + (caption ? `<figcaption class="meta">${escapeHtml(caption)}</figcaption>` : '')
    + '</figure>';
}

/// One website page section as HTML.
///
/// Unknown section types render their headline and body rather than nothing: the type list
/// in `lib/cmsContent.ts` can grow, and a renderer that silently drops an unrecognised
/// section publishes a page with a hole in it.
export function renderSection(section: RenderSection): string {
  const content = section.content ?? {};
  const headline = pick(content, ['headline', 'title', 'heading'], 200);
  const heading = headline ? `<h2>${escapeHtml(headline)}</h2>` : '';
  const type = section.section_type;
  const parts: string[] = [];

  switch (type) {
    case 'hero': {
      // The hero carries the page's `h1`, emitted by the page renderer, so its own headline
      // is an `h2` here. Two `h1` elements break the document outline.
      const sub = pick(content, ['subheadline', 'subtitle', 'lede'], 500);
      parts.push(heading);
      if (sub) parts.push(`<p class="lede">${escapeHtml(sub)}</p>`);
      parts.push(renderProse(content.body));
      parts.push(renderMedia(section));
      break;
    }
    case 'rich_text':
    case 'legal_text':
      parts.push(heading, renderProse(content.body));
      break;
    case 'media':
      parts.push(heading, renderMedia(section), renderProse(content.body));
      break;
    case 'feature_grid':
    case 'steps':
    case 'testimonials':
    case 'partners':
    case 'plans':
      parts.push(heading, renderProse(content.body), renderCards(itemList(content.items)));
      break;
    case 'stats': {
      const stats = itemList(content.items).map((item) => {
        const value = pick(item, ['value', 'number', 'stat'], 60);
        const label = pick(item, ['label', 'title', 'name'], 200);
        if (!value && !label) return '';
        return `<li><strong>${escapeHtml(value ?? '')}</strong>${label ? ` ${escapeHtml(label)}` : ''}</li>`;
      }).filter(Boolean).join('\n');
      parts.push(heading, stats ? `<ul class="cards">\n${stats}\n</ul>` : '');
      break;
    }
    case 'faq': {
      const entries = itemList(content.items).map((item) => {
        const question = pick(item, ['question', 'title', 'q'], 300);
        const answer = pick(item, ['answer', 'body', 'a']);
        if (!question) return '';
        return `<dt>${escapeHtml(question)}</dt>${answer ? `<dd>${escapeHtml(answer)}</dd>` : ''}`;
      }).filter(Boolean).join('\n');
      parts.push(heading, entries ? `<dl>\n${entries}\n</dl>` : '');
      break;
    }
    case 'content_rail': {
      // A rail names a source the client resolves at runtime. Rendering an empty shell would
      // be a hole in the page, so the rail states what it lists and links to the index it
      // comes from; the client fills in the artwork.
      const source = pick(content, ['source'], 200);
      parts.push(heading);
      parts.push(renderProse(content.body));
      const href = safeHref(content.href ?? content.url);
      if (href) parts.push(`<p><a href="${escapeAttribute(href)}">${escapeHtml(headline ?? source ?? '')}</a></p>`);
      break;
    }
    case 'cta':
      // `lib/cmsContent.ts` requires `content.label` and `content.href` for this section
      // type, while every other type carries its button in `cta`. Both are rendered, because
      // an editor who filled the required fields must not get a section with no button.
      parts.push(heading, renderProse(content.body), renderCta(content));
      break;
    default:
      parts.push(heading, renderProse(content.body), renderCards(itemList(content.items)));
      break;
  }

  parts.push(renderCta(section.cta ?? {}));
  const inner = parts.filter(Boolean).join('\n');
  if (!inner) return '';
  return `<section data-section="${escapeAttribute(type)}">\n${inner}\n</section>`;
}

export function renderSections(sections: RenderSection[]): string {
  return sections.map(renderSection).filter(Boolean).join('\n');
}

// --- Blog blocks -----------------------------------------------------------

export interface RenderBlock {
  type: string;
  [key: string]: unknown;
  /// Resolved by the route for `image` blocks.
  image_url?: string | null;
}

/// One blog body block as HTML.
export function renderBlock(block: RenderBlock): string {
  switch (block.type) {
    case 'heading': {
      const level = Number(block.level);
      const tag = level === 3 ? 'h3' : level === 4 ? 'h4' : 'h2';
      const value = text(block.text, 200);
      return value ? `<${tag}>${escapeHtml(value)}</${tag}>` : '';
    }
    case 'paragraph':
      return renderProse(block.text);
    case 'list': {
      const items = Array.isArray(block.items)
        ? block.items.map((item) => text(item, 1_000)).filter(Boolean)
        : [];
      if (!items.length) return '';
      const tag = block.style === 'number' ? 'ol' : 'ul';
      return `<${tag}>\n${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n')}\n</${tag}>`;
    }
    case 'image': {
      const url = block.image_url;
      const alt = text(block.alt, 300) ?? '';
      // A missing asset says so rather than emitting a broken `img`: a 404 image with alt
      // text is indistinguishable from a working one in the markup, and hides the defect.
      if (!url || !isSafeUrl(url)) {
        return `<p class="unavailable">${escapeHtml(alt)}</p>`;
      }
      const caption = text(block.caption, 300);
      return `<figure><img src="${escapeAttribute(url)}" alt="${escapeAttribute(alt)}" loading="lazy" />`
        + (caption ? `<figcaption class="meta">${escapeHtml(caption)}</figcaption>` : '')
        + '</figure>';
    }
    case 'quote': {
      const value = text(block.text, 1_000);
      if (!value) return '';
      const attribution = text(block.attribution ?? block.author, 200);
      return `<blockquote><p>${escapeHtml(value)}</p>`
        + (attribution ? `<footer class="meta">${escapeHtml(attribution)}</footer>` : '')
        + '</blockquote>';
    }
    case 'callout': {
      const value = text(block.text, 2_000);
      if (!value) return '';
      const tone = ['info', 'warning', 'success'].includes(String(block.tone)) ? String(block.tone) : 'info';
      return `<aside class="callout" data-tone="${escapeAttribute(tone)}">${renderProse(value)}</aside>`;
    }
    case 'embed': {
      const url = safeHref(block.url);
      if (!url) return '';
      const title = text(block.title, 200) ?? 'embedded media';
      // The `iframe` carries a title because an untitled frame is unlabelled for a screen
      // reader, and the link beside it is the fallback for a client that blocks frames.
      return `<figure><iframe src="${escapeAttribute(url)}" title="${escapeAttribute(title)}" loading="lazy" allowfullscreen></iframe>`
        + `<figcaption class="meta"><a href="${escapeAttribute(url)}" rel="noopener">${escapeHtml(title)}</a></figcaption></figure>`;
    }
    case 'cta': {
      const label = text(block.label, 120);
      const href = safeHref(block.href);
      return label && href ? `<p><a class="cta" href="${escapeAttribute(href)}">${escapeHtml(label)}</a></p>` : '';
    }
    case 'related_content': {
      const items = itemList(block.items).map((item) => {
        const title = pick(item, ['title', 'name', 'label'], 200);
        const href = safeHref(item.href ?? item.path ?? item.url);
        if (!title && !href) return '';
        if (href) return `<li><a href="${escapeAttribute(href)}">${escapeHtml(title ?? href)}</a></li>`;
        return `<li>${escapeHtml(title ?? '')}</li>`;
      }).filter(Boolean).join('\n');
      return items ? `<nav aria-label="related"><ul>\n${items}\n</ul></nav>` : '';
    }
    case 'divider':
      return '<hr />';
    default:
      return renderProse(block.text);
  }
}

export function renderBlocks(blocks: RenderBlock[]): string {
  return blocks.map(renderBlock).filter(Boolean).join('\n');
}

// --- Whole pages -----------------------------------------------------------

export interface PageBodyInput {
  title: string;
  summary: string | null;
  sections: RenderSection[];
  /// Rendered after the sections; used for catalogue listings on index pages.
  extra?: string;
}

/// A website page body: one `h1`, the summary, then the sections.
export function renderPageBody(input: PageBodyInput): string {
  const parts = [
    `<h1>${escapeHtml(input.title)}</h1>`,
    input.summary ? `<p class="lede">${escapeHtml(input.summary)}</p>` : '',
    renderSections(input.sections),
    input.extra ?? '',
  ];
  const body = parts.filter(Boolean).join('\n');
  // A published page with no active section is refused by the publish gate, so an empty body
  // here means the data changed after publication. Saying so beats an blank page.
  return body || '<h1>' + escapeHtml(input.title) + '</h1>';
}

export interface PostBodyInput {
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  authorName: string | null;
  categoryName: string | null;
  categoryHref: string | null;
  heroUrl: string | null;
  heroAlt: string | null;
  tags: string[];
  blocks: RenderBlock[];
  blogHref: string;
  blogLabel: string;
}

/// A blog post body.
///
/// The dateline uses `<time datetime>` so the publication date is machine-readable in the
/// document as well as in the JSON-LD; the two agree because both come from the same row.
export function renderPostBody(input: PostBodyInput): string {
  const meta: string[] = [];
  if (input.authorName) meta.push(escapeHtml(input.authorName));
  if (input.publishedAt) {
    meta.push(`<time datetime="${escapeAttribute(input.publishedAt)}">${escapeHtml(input.publishedAt.slice(0, 10))}</time>`);
  }
  if (input.categoryName && input.categoryHref) {
    meta.push(`<a href="${escapeAttribute(input.categoryHref)}">${escapeHtml(input.categoryName)}</a>`);
  } else if (input.categoryName) {
    meta.push(escapeHtml(input.categoryName));
  }

  const hero = input.heroUrl && isSafeUrl(input.heroUrl)
    ? `<figure><img src="${escapeAttribute(input.heroUrl)}" alt="${escapeAttribute(input.heroAlt ?? input.title)}" /></figure>`
    : '';

  const tags = input.tags.length
    ? `<nav aria-label="tags"><ul>${input.tags.map((tag) =>
        `<li><a href="${escapeAttribute(`${input.blogHref}?tag=${encodeURIComponent(tag)}`)}">${escapeHtml(tag)}</a></li>`).join('')}</ul></nav>`
    : '';

  return [
    `<nav aria-label="breadcrumb"><a href="${escapeAttribute(input.blogHref)}">${escapeHtml(input.blogLabel)}</a></nav>`,
    `<article>`,
    `<h1>${escapeHtml(input.title)}</h1>`,
    meta.length ? `<p class="meta">${meta.join(' · ')}</p>` : '',
    input.excerpt ? `<p class="lede">${escapeHtml(input.excerpt)}</p>` : '',
    hero,
    renderBlocks(input.blocks),
    tags,
    `</article>`,
  ].filter(Boolean).join('\n');
}

export interface BlogIndexEntry {
  title: string;
  href: string;
  excerpt: string | null;
  publishedAt: string | null;
  authorName: string | null;
  categoryName: string | null;
  heroUrl: string | null;
}

/// The blog index body.
///
/// Each entry is a real link with its own title and excerpt, which is what makes the archive
/// a discovery surface rather than a page a crawler bounces off.
export function renderBlogIndexBody(input: {
  title: string;
  summary: string | null;
  entries: BlogIndexEntry[];
  emptyNote: string;
  previousHref: string | null;
  nextHref: string | null;
  previousLabel: string;
  nextLabel: string;
}): string {
  const items = input.entries.map((entry) => {
    const meta = [entry.authorName, entry.publishedAt?.slice(0, 10), entry.categoryName]
      .filter(Boolean).map((value) => escapeHtml(value as string)).join(' · ');
    const hero = entry.heroUrl && isSafeUrl(entry.heroUrl)
      ? `<img src="${escapeAttribute(entry.heroUrl)}" alt="" loading="lazy" />`
      : '';
    return `<li>${hero}<h2><a href="${escapeAttribute(entry.href)}">${escapeHtml(entry.title)}</a></h2>`
      + (meta ? `<p class="meta">${meta}</p>` : '')
      + (entry.excerpt ? `<p>${escapeHtml(entry.excerpt)}</p>` : '')
      + '</li>';
  }).join('\n');

  const pager = [
    input.previousHref ? `<a rel="prev" href="${escapeAttribute(input.previousHref)}">${escapeHtml(input.previousLabel)}</a>` : '',
    input.nextHref ? `<a rel="next" href="${escapeAttribute(input.nextHref)}">${escapeHtml(input.nextLabel)}</a>` : '',
  ].filter(Boolean).join('');

  return [
    `<h1>${escapeHtml(input.title)}</h1>`,
    input.summary ? `<p class="lede">${escapeHtml(input.summary)}</p>` : '',
    items ? `<ul class="posts">\n${items}\n</ul>` : `<p class="unavailable">${escapeHtml(input.emptyNote)}</p>`,
    pager ? `<nav class="pager" aria-label="pagination">${pager}</nav>` : '',
  ].filter(Boolean).join('\n');
}

/// The 404 body. Always rendered with `noindex` by the caller.
export function renderNotFoundBody(input: {
  title: string;
  message: string;
  links: NavLink[];
}): string {
  const links = input.links.filter((link) => isSafeUrl(link.href))
    .map((link) => `<li><a href="${escapeAttribute(link.href)}">${escapeHtml(link.label)}</a></li>`).join('');
  return [
    `<h1>${escapeHtml(input.title)}</h1>`,
    `<p>${escapeHtml(input.message)}</p>`,
    links ? `<nav aria-label="alternatives"><ul>${links}</ul></nav>` : '',
  ].filter(Boolean).join('\n');
}
