/// What each engine's contract declares about itself.
///
/// Transcribed from the identity table at the top of every
/// `docs/games/engines/*.md`. It is duplicated from prose into data for one
/// reason: prose cannot reject a pack. `supports_dpad`, the language class and
/// whether the engine writes mastery are all things an editor can set wrongly in
/// the CMS, and every one of them has a visible consequence — a game offered on a
/// television that cannot be played, an Arabic letter pack machine-translated into
/// French, or a rhythm game producing a mastery level for a child's sense of
/// timing.
///
/// `max_elements_on_screen` is deliberately **not** here. It lives in
/// `game_engines.mechanics` in D1 and is read from there, because the catalogue is
/// the authority for it and a second copy could disagree.

export type LanguageClass = 'translatable' | 'language_neutral' | 'language_specific';

export interface EngineContract {
  /// Whether the engine is playable with a D-pad, i.e. offerable on television.
  supportsDpad: boolean;

  /// The language class from the contract, when the engine fixes one.
  ///
  /// `undefined` means the engine genuinely does not: `trace_color` is
  /// «`language_neutral` للأشكال والأرقام · **`language_specific` للحروف**» — the
  /// class follows the content, so a shapes pack and an Arabic letter pack in the
  /// same engine are correctly classified differently. That case is enforced by the
  /// per-level letter rule instead, which is the check that actually matters:
  /// letters may not be machine-translated.
  languageClass?: LanguageClass;

  /// Minimum touch target in dp. The shared floor is 48; several engines ask for
  /// more, and `rhythm_tap` asks for 72 because the target is moving.
  minTouchTargetDp: number;

  /// Whether an attempt on this engine should produce a mastery judgement.
  ///
  /// False for the two entertainment-first engines. `docs/games/05-mastery-and-
  /// measurement.md` lists them as writing attempts but not mastery, and the
  /// mechanism is that their packs carry no learning objective — so this flag is
  /// what makes "must not have an objective" checkable.
  writesMastery: boolean;

  /// A human review that must be `approved` before publish, if any.
  ///
  /// These are the reviews the contracts make mandatory. Engineering cannot
  /// satisfy them, which is exactly why they are encoded: an unreviewed pack must
  /// fail publish rather than rely on someone remembering.
  requiredReview?: 'linguistic_review' | 'scientific_review' | 'historical_review' | 'music_rights';
}

export const ENGINE_CONTRACTS: Record<string, EngineContract> = {
  // Tracing needs a pointer. The one engine hidden from television.
  //
  // No `languageClass`: shapes and numbers are language_neutral, letters are
  // language_specific, and both are legitimate packs for this engine.
  trace_color: {
    supportsDpad: false,
    minTouchTargetDp: 48,
    writesMastery: true,
  },
  match_pairs: {
    supportsDpad: true,
    languageClass: 'translatable',
    minTouchTargetDp: 56,
    writesMastery: true,
  },
  sort_bins: {
    supportsDpad: true,
    languageClass: 'translatable',
    minTouchTargetDp: 56,
    writesMastery: true,
  },
  // Entertainment first: attempts are written, mastery is not.
  memory_flip: {
    supportsDpad: true,
    languageClass: 'language_neutral',
    minTouchTargetDp: 56,
    writesMastery: false,
  },
  sequence_order: {
    supportsDpad: true,
    languageClass: 'translatable',
    minTouchTargetDp: 56,
    writesMastery: true,
  },
  count_quantity: {
    supportsDpad: true,
    languageClass: 'translatable',
    minTouchTargetDp: 56,
    writesMastery: true,
  },
  logic_pattern: {
    supportsDpad: true,
    languageClass: 'language_neutral',
    minTouchTargetDp: 56,
    writesMastery: true,
  },
  // Authored per language and never translated.
  word_build: {
    supportsDpad: true,
    languageClass: 'language_specific',
    minTouchTargetDp: 56,
    writesMastery: true,
    requiredReview: 'linguistic_review',
  },
  // The moving target is why this one asks for 72dp, and the music needs
  // documented rights before it can ship.
  rhythm_tap: {
    supportsDpad: true,
    languageClass: 'language_neutral',
    minTouchTargetDp: 72,
    writesMastery: false,
    requiredReview: 'music_rights',
  },
  block_code: {
    supportsDpad: true,
    languageClass: 'language_neutral',
    minTouchTargetDp: 48,
    writesMastery: true,
  },
  sim_lab: {
    supportsDpad: true,
    languageClass: 'language_neutral',
    minTouchTargetDp: 48,
    writesMastery: true,
    requiredReview: 'scientific_review',
  },
  timeline_map: {
    supportsDpad: true,
    languageClass: 'translatable',
    minTouchTargetDp: 56,
    writesMastery: true,
    requiredReview: 'historical_review',
  },
};

export function engineContract(engineId: string): EngineContract | undefined {
  return ENGINE_CONTRACTS[engineId];
}

/// Engines that must never carry a learning objective.
export const ENGINES_WITHOUT_MASTERY = Object.entries(ENGINE_CONTRACTS)
  .filter(([, contract]) => !contract.writesMastery)
  .map(([id]) => id);

/// Human-readable owner for a review kind, for the readiness report.
export const REVIEW_OWNERS: Record<string, string> = {
  linguistic_review: 'a certified Arabic linguist',
  scientific_review: 'a science reviewer',
  historical_review: 'a history reviewer',
  music_rights: 'the rights holder or licensing contact',
};
