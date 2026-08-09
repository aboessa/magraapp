/// Validation for a single `game_localizations` row.
///
/// ## The gap this closes
///
/// Migration 0024 created the table and `routes/games.ts` reads it, but nothing
/// could ever write one: the only rows in existence came from the migration's own
/// INSERT statements. Publish readiness blocks a game whose Arabic localization
/// is missing, so a game seeded without one was permanently unpublishable through
/// the CMS — the blocker was reported correctly and could not be resolved.
///
/// ## Why the rules live here rather than in the route
///
/// Three of them are content policy, not request parsing:
///
///   * A `language_specific` pack must not be machine translated. Arabic letter
///     shapes are authored per language; a translated letter pack teaches the
///     wrong strokes while looking complete.
///   * Prompt text is keyed by the pack's own `prompt_key` values. A key that no
///     level references is dead weight, and a level with no text resolves to a
///     raw i18n key on a child's screen.
///   * Voice overrides point at asset ids, and an id that cannot exist is a typo
///     that would otherwise surface as silence during play.
///
/// Keeping them in a pure function makes them unit testable without D1, in the
/// same way `publishReadiness.ts` is.

export const LOCALIZATION_STATUSES = ['draft', 'review_lang', 'ready', 'published', 'archived'] as const;
export type LocalizationStatus = (typeof LOCALIZATION_STATUSES)[number];

/// A semantic translation key, never human-readable text. Mirrors `i18nKey` in
/// the pack schema.
const I18N_KEY = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;
/// `voice_manifest` keys, mirroring the pack schema's patternProperties.
const VOICE_KEY = /^vo\.[a-z_]+(\.[A-Za-z0-9_-]+)?$/;
const ASSET_ID = /^[A-Za-z0-9_-]{3,128}$/;

export interface LocalizationContext {
  language: string;
  /// Languages this deployment supports, from `lib/gameDelivery.ts`.
  languages: readonly string[];
  /// `content_pack.localization`, or null when the pack is absent.
  packLocalization: string | null;
  /// Prompt keys the pack's levels declare.
  requiredPromptKeys: readonly string[];
}

export interface NormalizedLocalization {
  title: string | null;
  instructions: string | null;
  prompts: Record<string, string>;
  voice_manifest: Record<string, string>;
  status: LocalizationStatus;
  translated_from: string | null;
  is_machine_translated: boolean;
}

export type LocalizationValidation =
  | {
      ok: true;
      value: NormalizedLocalization;
      /// Prompt keys the pack expects and this row does not carry. Not an error:
      /// a translation in progress is a legitimate draft. Publish readiness is
      /// where it becomes a blocker.
      missing_prompt_keys: string[];
      /// Keys stored here that no level references. Kept rather than dropped —
      /// deleting an editor's text silently is worse than reporting it — but
      /// reported so a renamed key does not leave orphaned prose behind.
      unused_prompt_keys: string[];
      warnings: string[];
    }
  | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/// Validates and normalizes a localization payload.
///
/// Absent fields fall back to `previous` when supplied, so a PUT that carries
/// only `status` does not blank an editor's prompts. The verb stays PUT because
/// the row is created when it does not exist; the merge is with the stored row,
/// not with a partial write of unknown provenance.
export function validateLocalization(
  raw: unknown,
  ctx: LocalizationContext,
  previous: NormalizedLocalization | null = null,
): LocalizationValidation {
  if (!isObject(raw)) return { ok: false, error: 'A JSON object is required' };
  if (!ctx.languages.includes(ctx.language)) {
    return { ok: false, error: `Unsupported language "${ctx.language}"` };
  }

  const title = optionalText(raw.title);
  if (title === undefined && raw.title !== undefined) {
    return { ok: false, error: 'title must be a string or null' };
  }
  const instructions = optionalText(raw.instructions);
  if (instructions === undefined && raw.instructions !== undefined) {
    return { ok: false, error: 'instructions must be a string or null' };
  }

  let prompts = previous?.prompts ?? {};
  if (raw.prompts !== undefined) {
    if (!isObject(raw.prompts)) return { ok: false, error: 'prompts must be an object' };
    const collected: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.prompts)) {
      if (!I18N_KEY.test(key)) {
        return { ok: false, error: `prompt key "${key}" is not a valid i18n key` };
      }
      if (typeof value !== 'string') {
        return { ok: false, error: `prompt "${key}" must be a string` };
      }
      // An empty string is a deletion, not a translation: storing it would make
      // the key look translated to every consumer that checks presence.
      const text = value.trim();
      if (text) collected[key] = text;
    }
    prompts = collected;
  }

  let voice = previous?.voice_manifest ?? {};
  if (raw.voice_manifest !== undefined) {
    if (!isObject(raw.voice_manifest)) return { ok: false, error: 'voice_manifest must be an object' };
    const collected: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.voice_manifest)) {
      if (!VOICE_KEY.test(key)) {
        return { ok: false, error: `voice key "${key}" is not a valid voice_manifest key` };
      }
      if (value === null || value === '') continue;
      if (typeof value !== 'string' || !ASSET_ID.test(value)) {
        return { ok: false, error: `voice_manifest["${key}"] must be an asset id` };
      }
      collected[key] = value;
    }
    voice = collected;
  }

  const statusValue = raw.status === undefined ? (previous?.status ?? 'draft') : raw.status;
  if (typeof statusValue !== 'string' || !(LOCALIZATION_STATUSES as readonly string[]).includes(statusValue)) {
    return { ok: false, error: `status must be one of ${LOCALIZATION_STATUSES.join(', ')}` };
  }
  const status = statusValue as LocalizationStatus;

  let translatedFrom = previous?.translated_from ?? null;
  if (raw.translated_from !== undefined) {
    if (raw.translated_from === null || raw.translated_from === '') translatedFrom = null;
    else if (typeof raw.translated_from !== 'string' || !ctx.languages.includes(raw.translated_from)) {
      return { ok: false, error: 'translated_from must be a supported language or null' };
    } else translatedFrom = raw.translated_from;
  }
  // A translation of itself breaks fallback resolution and the D1 CHECK rejects
  // it anyway; reporting it here gives a comprehensible message instead of a 409.
  if (translatedFrom === ctx.language) {
    return { ok: false, error: 'translated_from must differ from the language itself' };
  }

  let machine = previous?.is_machine_translated ?? false;
  if (raw.is_machine_translated !== undefined) {
    if (typeof raw.is_machine_translated !== 'boolean') {
      return { ok: false, error: 'is_machine_translated must be a boolean' };
    }
    machine = raw.is_machine_translated;
  }

  const isLanguageSpecific = ctx.packLocalization === 'language_specific';
  if (isLanguageSpecific && machine) {
    return {
      ok: false,
      error: 'a language_specific pack must not be machine translated: its geometry is authored per language',
    };
  }

  const warnings: string[] = [];
  if (isLanguageSpecific && translatedFrom) {
    warnings.push(
      'حزمة language_specific تُؤلَّف لكل لغة كلعبة مستقلّة؛ تسجيل لغة مصدر لا يجعلها ترجمة صالحة للنشر.',
    );
  }
  if (machine && status !== 'draft') {
    warnings.push('ترجمة آليّة خارج حالة «مسودة»: تحتاج مراجعة بشرية قبل الجاهزية.');
  }

  const missing = ctx.requiredPromptKeys.filter((key) => !prompts[key]);
  const unused = Object.keys(prompts).filter((key) => !ctx.requiredPromptKeys.includes(key)).sort();

  return {
    ok: true,
    value: {
      title: title ?? (raw.title === undefined ? previous?.title ?? null : null),
      instructions: instructions ?? (raw.instructions === undefined ? previous?.instructions ?? null : null),
      prompts,
      voice_manifest: voice,
      status,
      translated_from: translatedFrom,
      is_machine_translated: machine,
    },
    missing_prompt_keys: missing,
    unused_prompt_keys: unused,
    warnings,
  };
}
