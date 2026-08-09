-- 0024 — game localization, separating engine geometry from localized content.
--
-- ## Why
--
-- `docs/games/08-implementation-plan.md` lists `game_localizations` as item 1 of
-- the shared foundation, "قبل أي محرك" — before any engine. It was never built,
-- so a pack could only ever speak one language, and the only place a prompt
-- could live was inside `content_pack` next to the geometry.
--
-- ## The separation
--
-- Geometry is not language. A circle is a circle in Arabic, English and French,
-- and duplicating its coordinates per language would mean fixing a stroke three
-- times and letting the copies drift.
--
--   games.content_pack       geometry, thresholds, progression, accessibility,
--                            and *i18n keys* such as
--                            `game.pinch_place.peg_to_basket.prompt`
--   game_localizations       per language: title, instructions, the text those
--                            keys resolve to, and per-language voice assets
--
-- ## The exception, which is deliberate
--
-- Arabic letter shapes ARE language. `docs/games/01-localization-i18n.md`
-- classifies trace_color letter packs as `language_specific`: "لا يُترجم — يُؤلَّف
-- من جديد لكل لغة". An English letter-tracing game is therefore a *separate
-- game row* with its own Latin geometry, not a translation of the Arabic one.
-- `is_machine_translated` and the localization status exist so this can be
-- enforced rather than trusted.

CREATE TABLE IF NOT EXISTS game_localizations (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ar', 'en', 'fr')),
  title TEXT,
  instructions TEXT,
  -- { "<i18n key from content_pack>": "human readable text" }
  prompts TEXT NOT NULL DEFAULT '{}',
  -- { "vo.intro": "asset-id" } overriding the pack's default voice assets for
  -- this language. Audio is inherently per-language, unlike geometry.
  voice_manifest TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review_lang', 'ready', 'published', 'archived')),
  -- The language this was derived from, when it was derived at all.
  translated_from TEXT CHECK (translated_from IS NULL OR translated_from IN ('ar', 'en', 'fr')),
  -- Machine translation is rejected outright for language_specific packs; for
  -- the rest it must at least be visible to an editor.
  is_machine_translated INTEGER NOT NULL DEFAULT 0 CHECK (is_machine_translated IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, language),
  -- A translation of itself is meaningless and would break fallback resolution.
  CHECK (translated_from IS NULL OR translated_from <> language)
);

CREATE INDEX IF NOT EXISTS idx_game_localizations_language
  ON game_localizations(language, status);

-- Pack-level translation lineage. Mandatory rule 10 of the data contract says a
-- `language_specific` pack must have `translated_from = NULL`; until now there
-- was no column for that rule to read, so it could not be enforced at all.
ALTER TABLE games ADD COLUMN translated_from TEXT REFERENCES games(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_games_translated_from ON games(translated_from);

-- 1. ABJAD letter tracing — Arabic only, by design ---------------------------
--
-- The pack teaches Arabic letter *shapes* and is `language_specific`. Adding
-- en/fr rows here would imply an authored English or French version exists; it
-- does not, and inventing one would be exactly the machine-translated pack the
-- contract forbids. A Latin-alphabet tracing game is separate future work.
--
-- Letters are spoken by their sound, not their name — «بَ» before «باء» — which
-- is why the prompts below name the sound explicitly.
INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status, translated_from, is_machine_translated)
VALUES (
  'game-letter-tracing', 'ar', 'تتبع الحروف',
  'هيا نرسم معًا! ضع إصبعك على النقطة المتوهّجة، واتبع الطريق. ثم المس مكان النقطة. بعد ذلك لوّن كما تحب.',
  json_object(
    'game.letter_tracing.alif.prompt', 'هذا حرف الألف، وصوته اَ. ضع إصبعك على النقطة، واتبع الطريق.',
    'game.letter_tracing.lam.prompt',  'هذا حرف اللام، وصوته لَ. ابدأ من الأعلى واتبع الطريق.',
    'game.letter_tracing.baa.prompt',  'هذا حرف الباء، وصوته بَ. اتبع الطريق، ثم المس مكان النقطة تحت الحرف.',
    'game.letter_tracing.noon.prompt', 'هذا حرف النون، وصوته نَ. اتبع الطريق، ثم المس مكان النقطة فوق الحرف.'
  ),
  '{}', 'draft', NULL, 0
);

-- 2. MAHARAT pinch-and-place — the translatable case -------------------------
--
-- Same geometry, three languages, zero duplicated coordinates. This is the
-- architecture working as intended.
INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status, translated_from, is_machine_translated)
VALUES (
  'game-yt-pinch-place', 'ar', 'من المشبك إلى السلّة',
  'مرِّرْ إصبعك من المشبك إلى السلّة.',
  json_object('game.pinch_place.peg_to_basket.prompt', 'مرِّرْ إصبعك من المشبك إلى السلّة.'),
  '{}', 'draft', NULL, 0
);

INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status, translated_from, is_machine_translated)
VALUES (
  'game-yt-pinch-place', 'en', 'From the peg to the basket',
  'Slide your finger from the peg to the basket.',
  json_object('game.pinch_place.peg_to_basket.prompt', 'Slide your finger from the peg to the basket.'),
  '{}', 'draft', 'ar', 0
);

INSERT OR IGNORE INTO game_localizations (game_id, language, title, instructions, prompts, voice_manifest, status, translated_from, is_machine_translated)
VALUES (
  'game-yt-pinch-place', 'fr', 'De la pince au panier',
  'Fais glisser ton doigt de la pince jusqu''au panier.',
  json_object('game.pinch_place.peg_to_basket.prompt', 'Fais glisser ton doigt de la pince jusqu''au panier.'),
  '{}', 'draft', 'ar', 0
);
