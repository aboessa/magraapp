/// Religious-review gate for Islamic catalogue content.
///
/// Extracted from routes/admin.ts so the rule can be unit tested. It is pure:
/// no database, no environment, no request context.
///
/// ## The defect this fixes
///
/// [isIslamicContent] previously compared `planetId === 'iman'`. The seeded
/// planet ID is `islamic` — verified directly against D1, whose planets table
/// contains abjad, alam, arqam, islamic, maharat, oloom, qisas, qiyam, tarikh
/// and no `iman` at all. Every real Islamic series therefore skipped the entire
/// religious-approval gate, and content could be published without a reviewer or
/// an approval timestamp. `iman` is kept as an accepted alias in case older
/// content or documentation still uses it.

export const ISLAMIC_PLANET_IDS = ['islamic', 'iman'] as const;

/// Source types that always require religious review regardless of planet.
export const ISLAMIC_SOURCE_TYPES = ['quran', 'hadith', 'sira'] as const;

export function isIslamicContent(planetId: string | null, sourceType: string | null): boolean {
  if (planetId && (ISLAMIC_PLANET_IDS as readonly string[]).includes(planetId)) return true;
  return !!sourceType && (ISLAMIC_SOURCE_TYPES as readonly string[]).includes(sourceType);
}

/// Returns an Arabic error describing the missing requirement, or null when the
/// content may be published.
export function validateIslamicFields(
  body: Record<string, unknown>,
  planetId: string | null,
): string | null {
  const sourceType = typeof body.source_type === 'string' ? body.source_type : null;
  if (!isIslamicContent(planetId, sourceType)) return null;
  if (!sourceType) return 'source_type مطلوب للمحتوى الإسلامي (quran/hadith/sira/adab)';
  if (sourceType === 'quran' && (!body.verse_surah || !body.verse_ayah)) {
    return 'verse_surah و verse_ayah مطلوبان للقرآن';
  }
  if (sourceType === 'hadith' && (!body.hadith_collection || !body.hadith_number)) {
    return 'hadith_collection و hadith_number مطلوبان للحديث';
  }
  if (!body.religious_reviewer_id) return 'religious_reviewer_id مطلوب';
  if (!body.religious_approved_at) {
    return 'religious_approved_at مطلوب - لا يمكن النشر بدون موافقة شرعية';
  }
  return null;
}
