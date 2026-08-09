/// Projecting a stored game pack into what the app is allowed to receive.
///
/// Kept free of database and Hono types so the language fallback and the
/// stripping rules can be unit tested directly. `routes/games.ts` supplies the
/// rows; every decision about *what the client sees* is made here.

export const GAME_LANGUAGES = ['ar', 'en', 'fr'] as const;
export type GameLanguage = (typeof GAME_LANGUAGES)[number];

export function isGameLanguage(value: unknown): value is GameLanguage {
  return typeof value === 'string' && (GAME_LANGUAGES as readonly string[]).includes(value);
}

export interface GameLocalizationRow {
  language: string;
  title: string | null;
  instructions: string | null;
  /// `{ "<i18n key>": "text" }`
  prompts: Record<string, string>;
  /// `{ "vo.intro": "asset-id" }` overriding the pack default for this language.
  voice_manifest: Record<string, string>;
  status: string;
  is_machine_translated?: number | boolean;
}

export interface LanguageResolution {
  /// The language actually served.
  language: GameLanguage;
  /// The language originally asked for, when it differed.
  requested: GameLanguage;
  /// Languages tried, in order, so the client can log why it got what it got.
  chain: GameLanguage[];
  /// True when the requested language was unavailable.
  fell_back: boolean;
}

/// Resolves which localization to serve.
///
/// The fallback chain is explicit and Arabic-first: the requested language, then
/// `ar`, then `en`. Majarra is an Arabic product, so Arabic is the language most
/// likely to be authored and reviewed; English is a last resort rather than a
/// peer. Returning null rather than inventing a language keeps an unlocalised
/// game out of the app instead of shipping raw i18n keys to a child.
export function resolveLanguage(
  requested: GameLanguage,
  available: readonly string[],
): LanguageResolution | null {
  const chain: GameLanguage[] = [];
  for (const candidate of [requested, 'ar' as GameLanguage, 'en' as GameLanguage]) {
    if (!chain.includes(candidate)) chain.push(candidate);
  }
  const found = chain.find((candidate) => available.includes(candidate));
  if (!found) return null;
  return { language: found, requested, chain, fell_back: found !== requested };
}

/// Keys inside a pack that exist for editors and must never reach a child's
/// device.
///
/// `review` holds reviewer names, review notes and approval timestamps. It is
/// internal editorial state; the app has no use for it and it should not be
/// mirrored onto thousands of devices.
const INTERNAL_PACK_KEYS = ['review'] as const;

export interface DeliverablePack {
  pack: Record<string, unknown>;
  /// Prompt keys the chosen localization did not translate. Empty is the goal;
  /// non-empty is reported so a gap is visible rather than silent.
  missing_prompt_keys: string[];
  /// Voice keys with no audio asset in this language.
  missing_voice_keys: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/// Resolves a pack for one language.
///
/// Geometry is copied through untouched: coordinates are not language, and this
/// function must never be a place where they could diverge per language. What it
/// does is attach the resolved `prompt` text next to each level's `prompt_key`,
/// merge per-language voice assets over the pack defaults, and drop internal
/// fields.
export function localizePack(
  rawPack: unknown,
  localization: GameLocalizationRow | null,
): DeliverablePack {
  const missingPrompts: string[] = [];
  const missingVoice: string[] = [];

  if (!isObject(rawPack)) {
    return { pack: {}, missing_prompt_keys: [], missing_voice_keys: [] };
  }

  // Shallow clone, then replace only the branches that change. Structured clone
  // of the whole pack would be wasteful for geometry that is returned verbatim.
  const pack: Record<string, unknown> = { ...rawPack };
  for (const key of INTERNAL_PACK_KEYS) delete pack[key];

  const prompts = localization?.prompts ?? {};

  if (Array.isArray(rawPack.levels)) {
    pack.levels = rawPack.levels.map((level) => {
      if (!isObject(level)) return level;
      const key = typeof level.prompt_key === 'string' ? level.prompt_key : null;
      if (!key) return { ...level };
      const text = prompts[key];
      if (typeof text !== 'string' || !text) {
        missingPrompts.push(key);
        // The key is still sent: a client showing a key is debuggable, whereas a
        // silently blank prompt looks like a rendering bug.
        return { ...level };
      }
      return { ...level, prompt: text };
    });
  }

  const baseVoice = isObject(rawPack.voice_manifest) ? rawPack.voice_manifest : {};
  const overrides = localization?.voice_manifest ?? {};
  const mergedVoice: Record<string, unknown> = { ...baseVoice };
  for (const [key, assetId] of Object.entries(overrides)) {
    if (typeof assetId === 'string' && assetId) mergedVoice[key] = assetId;
  }
  for (const [key, assetId] of Object.entries(mergedVoice)) {
    if (typeof assetId !== 'string' || !assetId) missingVoice.push(key);
  }
  pack.voice_manifest = mergedVoice;

  return {
    pack,
    missing_prompt_keys: [...new Set(missingPrompts)].sort(),
    missing_voice_keys: [...new Set(missingVoice)].sort(),
  };
}

/// Age track derived from a game's age range.
///
/// Mirrors the platform's three tracks. A game spanning a boundary reports every
/// track it touches, because `games.age_min/age_max` is the authority and there
/// is no `game_tracks` table.
export function tracksForAgeRange(ageMin: number, ageMax: number): string[] {
  const tracks: string[] = [];
  if (ageMin <= 5 && ageMax >= 3) tracks.push('preschool');
  if (ageMin <= 8 && ageMax >= 6) tracks.push('kids');
  if (ageMin <= 12 && ageMax >= 9) tracks.push('junior');
  return tracks;
}
