/// Which catalogue entities have a public web URL, in which language, and at what path.
///
/// ## Why this is a module and not two inline conditions
///
/// A catalogue page is discoverable in three places that must agree: the renderer that
/// serves it, the sitemap that advertises it, and the `hreflang` cluster that ties its
/// translations together. If the sitemap lists `/en/series/luna` and the renderer answers
/// 404 for it, the sitemap is actively harmful — it spends crawl budget on errors and the
/// whole cluster loses trust. One module decides, all three read it.
///
/// ## The language rule
///
/// A page exists in a language only when the copy for that language exists. Rendering an
/// English URL whose body is Arabic is worse than not having the URL: it is a thin page in
/// the wrong language, and `hreflang="en"` pointing at it tells a search engine to serve
/// Arabic to English readers.
///
/// Arabic is the primary language and always present — `series.title_ar` and
/// `planets.name_ar` are `NOT NULL`. English follows only when the entity carries an
/// English title *and* an English description; a title alone produces a page with a
/// heading and no content. French has no columns in the catalogue tables at all, so no
/// French catalogue URL is emitted; that is a content gap, not a rendering one, and
/// inventing the URL would not close it.

import { CMS_LANGUAGES, type CmsLanguage } from './cmsContent.ts';

export const CATALOGUE_PRIMARY_LANGUAGE: CmsLanguage = 'ar';

/// The minimum series shape needed to decide which languages are public.
export interface SeriesLanguageRow {
  title_ar?: string | null;
  title_en?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
}

export interface PlanetLanguageRow {
  name_ar?: string | null;
  name_en?: string | null;
  description_ar?: string | null;
}

const filled = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

export function seriesLanguages(row: SeriesLanguageRow): CmsLanguage[] {
  const languages: CmsLanguage[] = [];
  if (filled(row.title_ar)) languages.push('ar');
  if (filled(row.title_en) && filled(row.description_en)) languages.push('en');
  return languages;
}

/// Planets carry no English description column, so only Arabic is public.
///
/// Kept as a function returning a list rather than a constant so the shape matches
/// [seriesLanguages] at every call site: when a `description_en` column is added, this
/// changes here and the renderer, the sitemap and the alternates all follow.
export function planetLanguages(row: PlanetLanguageRow): CmsLanguage[] {
  return filled(row.name_ar) ? ['ar'] : [];
}

export function seriesPath(language: CmsLanguage, slug: string): string {
  return `/${language}/series/${slug}`;
}

export function planetPath(language: CmsLanguage, id: string): string {
  return `/${language}/planets/${id}`;
}

export function blogIndexPath(language: CmsLanguage): string {
  return `/${language}/blog`;
}

/// Paths that must never be indexable, checked by the renderer before it emits a document.
///
/// A `noindex` tag is only read after the crawler has already fetched the URL, so the
/// preview and account areas are refused outright rather than tagged. `robots.txt` states
/// the same list; both exist because `robots.txt` is a request and this is an answer.
export const NEVER_INDEXABLE_PREFIXES = ['/preview', '/app', '/account', '/admin', '/api'] as const;

export function isNeverIndexable(path: string): boolean {
  return NEVER_INDEXABLE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export { CMS_LANGUAGES };
