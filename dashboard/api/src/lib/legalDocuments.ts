/// Legal documents (migration 0105): privacy policy, children's privacy, terms,
/// and how to delete an account.
///
/// The body is a small, safe subset of Markdown the website and the app render
/// themselves (`## heading`, `- bullet`, `1. step`, paragraphs). No HTML is ever
/// rendered from it, so an edit cannot inject markup into either client.

export const LEGAL_SLUGS = ['privacy', 'children-privacy', 'terms', 'delete-account'] as const;
export type LegalSlug = typeof LEGAL_SLUGS[number];

export function isLegalSlug(value: unknown): value is LegalSlug {
  return typeof value === 'string' && (LEGAL_SLUGS as readonly string[]).includes(value);
}

export const MAX_LEGAL_BODY = 40_000;
export const MAX_LEGAL_TITLE = 120;

/// `{{something}}` marks a value the owner must fill in (company name, contact
/// email, refund policy…). A document that still has one cannot be published.
const PLACEHOLDER = /\{\{[^}]{1,80}\}\}/g;

export function placeholdersIn(text: string): string[] {
  return [...new Set(text.match(PLACEHOLDER) ?? [])];
}
