/// The visual asset production queue: every image the catalogue needs, drawn or not.
///
/// ## Why a queue and not a count
///
/// `publishReadiness` reports «4 أصول غير جاهزة» and the four ids. An illustrator
/// cannot draw from `asset-tc-city-baghdad`. They need to know what the picture
/// is *for* — a card the child taps, a base map that must not be mirrored, a
/// template to be coloured inside — because the role determines the size, the
/// transparency, the line weight, and whether text may appear in it at all.
///
/// The role also determines the one rule that, if broken, invalidates the asset
/// after it has been drawn and approved: **«لا نص مكتوب داخل أي صورة»**
/// (`docs/games/07-assets-and-brand.md`). Text baked into artwork makes a global
/// launch impossible and forces every asset to be redrawn per language. The single
/// documented exception is `trace_color` and `word_build` letters and numerals,
/// which are gameplay data rather than interface text. That exception is why
/// `language_dependency` is a field here: an asset that legitimately contains a
/// glyph must be tagged as belonging to one language, so nobody reuses it in the
/// French build.
///
/// ## Where the traversal comes from
///
/// The same level fields `lib/gamePackGate.ts` `referencedAssetIds` walks, and
/// deliberately so: the gate decides whether a pack may publish, and a queue that
/// looked at a different set of fields would either demand art the gate ignores or
/// stay silent about art the gate blocks on. Two traversals that disagree produce
/// a game that is blocked for a reason the production board never shows.
///
/// Three container fields — `panels`, `targets` and `bins` — are additionally
/// walked here. Their level schemas define an `image` on each entry
/// (`sequence_order.panel`, `match_pairs.target`, `sort_bins.bin`), so the artwork
/// is real and has to be drawn whether or not the gate currently checks its
/// existence. Under-reporting the art board is the more expensive of the two
/// errors: a gate gap fails loudly at publish, a queue gap fails silently as an
/// asset nobody commissioned.
///
/// Pure. `routes/adminGames` supplies the asset rows.

/// What a picture is for. The role, not the file name, carries the brief.
export type AssetRole =
  /// The path a child traces over, `trace_color` geometry.
  | 'tracing_reference'
  /// Line art with closed regions, to be filled in.
  | 'colouring_art'
  /// A colouring template, i.e. `coloring.template_asset`.
  | 'template'
  /// The store and library tile for the game itself.
  | 'cover'
  /// A tappable element, card, tile or option: the commonest role by far.
  | 'game_illustration'
  /// The base map for `timeline_map`, or the timeline rail.
  | 'map_base'
  /// Robo and other recurring characters, which must match a character sheet.
  | 'character'
  /// A full-bleed backdrop behind the play area.
  | 'background';

/// Expected geometry per role, from `docs/games/07-assets-and-brand.md`.
///
/// Held as data rather than prose because prose cannot be attached to a queue row,
/// and an illustrator who has to open a design document to learn that a card is
/// 512×512 will sometimes not open it.
export interface AssetSpec {
  aspect_ratio: string;
  /// Pixel size, or null when the asset should be vector.
  size: string | null;
  format: string;
  /// True when the asset may legitimately contain a glyph, i.e. gameplay data.
  glyph_allowed: boolean;
}

export const ROLE_SPECS: Record<AssetRole, AssetSpec> = {
  tracing_reference: { aspect_ratio: '1:1', size: '1024×1024', format: 'SVG مفضّل، أو PNG شفاف', glyph_allowed: true },
  colouring_art: { aspect_ratio: '1:1', size: '1024×1024', format: 'PNG شفاف بخطوط مغلقة', glyph_allowed: false },
  template: { aspect_ratio: '1:1', size: '1024×1024', format: 'PNG شفاف بمناطق مغلقة قابلة للتلوين', glyph_allowed: false },
  cover: { aspect_ratio: '1:1', size: '1200×1200', format: 'PNG/WebP', glyph_allowed: false },
  game_illustration: { aspect_ratio: '1:1', size: '512×512', format: 'PNG شفاف', glyph_allowed: false },
  map_base: { aspect_ratio: '4:3', size: null, format: 'SVG مفضّل — متجه', glyph_allowed: false },
  character: { aspect_ratio: '1:1', size: '512×512', format: 'PNG شفاف بإطارات', glyph_allowed: false },
  background: { aspect_ratio: '4:3', size: '1600×1200', format: 'PNG/WebP', glyph_allowed: false },
};

/// Arabic labels for the roles, for the CMS.
export const ROLE_LABELS: Record<AssetRole, string> = {
  tracing_reference: 'مرجع تتبّع',
  colouring_art: 'رسم تلوين',
  template: 'قالب تلوين',
  cover: 'غلاف اللعبة',
  game_illustration: 'رسم عنصر في اللعبة',
  map_base: 'خريطة أساس',
  character: 'شخصية',
  background: 'خلفية',
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function levelsOf(pack: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return Array.isArray(pack?.levels) ? (pack!.levels as unknown[]).filter(isObject) : [];
}

function levelNumber(level: Record<string, unknown>, index: number): number {
  const value = Number(level.level);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

/// One visual asset a pack needs, before anything is known about whether it exists.
export interface ArtRequirement {
  assetId: string;
  role: AssetRole;
  /// Level number, or null for a pack-wide asset.
  level: number | null;
  /// The language this asset is locked to, when it contains a glyph or a word.
  languageDependency: string | null;
  /// One or two sentences an illustrator can work from.
  brief: string;
}

/// Which role an asset plays, decided by the field that named it.
///
/// The field is the only reliable signal. A file name is a convention that drifts;
/// `coloring.template_asset` is a contract.
function requirementsForLevel(
  engineId: string,
  level: Record<string, unknown>,
  number: number,
  out: Map<string, ArtRequirement>,
): void {
  const add = (
    assetId: string | null,
    role: AssetRole,
    brief: string,
    languageDependency: string | null = null,
  ) => {
    if (!assetId) return;
    // First writer wins: an id reused across levels is one drawing, and listing
    // it twice would commission it twice.
    if (out.has(assetId)) return;
    out.set(assetId, { assetId, role, level: number, languageDependency, brief });
  };

  const mode = str(level.mode);

  // trace_color. A letter level is language-locked: the glyph is the content, and
  // it is the documented exception to "no text inside an image".
  if (engineId === 'trace_color') {
    const isLetter = mode === 'letter';
    const language = isLetter ? 'ar' : null;
    add(str(level.background_asset), isLetter ? 'tracing_reference' : 'background',
      isLetter
        ? `خلفية مستوى الحرف ${number}: شكل الحرف بخطّ واضح للأطفال، بلا زخرفة تشوّش مسار الرسم. `
          + 'الحرف بيانات لعب لا نصّ واجهة، ولذلك يُسمح به داخل الصورة ويُقيَّد بلغة واحدة.'
        : `خلفية مستوى ${number}: مساحة هادئة تحت المسار، بلا عناصر تنافس الانتباه.`,
      language);
    const coloring = isObject(level.coloring) ? level.coloring : null;
    if (coloring) {
      add(str(coloring.template_asset), 'template',
        `قالب تلوين لمستوى ${number}: خطوط مغلقة تمامًا حتى لا يتسرّب اللون، ومناطق كبيرة تكفي إصبع طفل.`);
    }
  } else {
    add(str(level.background_asset), 'background',
      `خلفية مستوى ${number}: خلفية هادئة لا تنافس عناصر اللعب.`);
  }

  // timeline_map: the base map and the timeline rail.
  if (isObject(level.map)) {
    const region = str((level.map as Record<string, unknown>).region);
    add(str((level.map as Record<string, unknown>).image), 'map_base',
      `خريطة أساس${region ? ` لمنطقة "${region}"` : ''}: إسقاط equirectangular، بلا حدود سياسية متنازع عليها، `
      + 'وبلا تسميات مطبوعة — الأسماء طبقة ترجمة. لا تُعكس في RTL أبدًا.');
  }

  // logic_pattern names its options and its answer as asset ids directly.
  for (const key of ['options', 'sequence'] as const) {
    const list = level[key];
    if (!Array.isArray(list)) continue;
    for (const value of list) {
      add(str(value), 'game_illustration',
        `عنصر نمط في مستوى ${number}: شكل واحد واضح، ويجب أن يتمايز عن بقيّة الخيارات ببُعد غير اللون `
        + '(شكل أو دوران أو حجم) حتى يُحَلّ النمط بلا تمييز لوني.');
    }
  }
  add(str(level.answer), 'game_illustration',
    `الخيار الصحيح في مستوى ${number}: بنفس أسلوب بقيّة الخيارات تمامًا، فأي تمايز في الأسلوب يكشف الجواب.`);

  const grid = level.grid;
  if (Array.isArray(grid)) {
    for (const row of grid) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        add(str(cell), 'game_illustration', `خليّة مصفوفة في مستوى ${number}: شكل مفرد على خلفية شفافة.`);
      }
    }
  }

  // word_build: the picture of the word. Language-locked, because the word is
  // Arabic and the picture is chosen to disambiguate that specific word.
  add(str(level.word_image), 'game_illustration',
    `صورة الكلمة "${str(level.word) ?? ''}" في مستوى ${number}: صورة واحدة لا لبس فيها، بلا أي نصّ مطبوع.`,
    'ar');

  // The generic containers. Every one of these holds entries with an `image`.
  // `panels`, `targets` and `bins` are included beyond the gate's traversal; see
  // the note at the top of this file.
  for (const key of ['items', 'events', 'pairs', 'panels', 'targets', 'bins', 'distractors'] as const) {
    const list = level[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!isObject(entry)) continue;
      const id = str(entry.id) ?? '';
      const brief = key === 'panels'
        ? `لوحة تسلسل "${id}" في مستوى ${number}: لحظة واحدة واضحة من التسلسل، بنسبة 4:3، `
          + 'ويجب أن يُفهم ترتيبها من الصورة وحدها بلا نصّ.'
        : key === 'events'
          ? `صورة الحدث "${id}" في مستوى ${number}: مشهد أو معلم يمثّل الحدث، بلا نصّ مطبوع وبلا تجسيد محظور.`
          : key === 'bins'
            ? `سلّة "${id}" في مستوى ${number}: وعاء يُفهم معياره بصريًا، ولا يعتمد على اللون وحده.`
            : key === 'distractors'
              ? `عنصر مُشتّت "${id}" في مستوى ${number}: بنفس أسلوب العناصر الصحيحة تمامًا، `
                + 'فأي فرق في الأسلوب يجعل الاختيار الصحيح واضحًا بلا تفكير.'
              : `عنصر "${id}" في مستوى ${number}: عنصر واحد على خلفية شفافة، 512×512، بلا نصّ مطبوع.`;
      add(str(entry.image), 'game_illustration', brief);

      // memory_flip pairs name their two faces as `a` and `b`.
      add(str(entry.a), 'game_illustration',
        `وجه بطاقة "${str(entry.a) ?? ''}" في مستوى ${number}: عنصر واحد واضح على خلفية شفافة.`);
      add(str(entry.b), 'game_illustration',
        `وجه بطاقة "${str(entry.b) ?? ''}" في مستوى ${number}: عنصر واحد واضح على خلفية شفافة.`);

      for (const setKey of ['set_a', 'set_b'] as const) {
        const set = entry[setKey];
        if (isObject(set)) {
          add(str(set.image), 'game_illustration',
            `عنصر مجموعة ${setKey} في مستوى ${number}: عنصر قابل للتكرار والعدّ، متطابق في كل نسخة.`);
        }
      }
      const nested = entry.items;
      if (Array.isArray(nested)) {
        for (const item of nested) {
          if (isObject(item)) {
            add(str(item.image), 'game_illustration',
              `عنصر معدود في مستوى ${number}: شكل واحد يُعدّ بصريًا، متطابق في كل نسخة حتى لا يُشتّت العدّ.`);
          }
        }
      }
    }
  }
}

/// Every image a pack references, with its role and brief.
export function artRequirements(
  engineId: string,
  pack: Record<string, unknown> | null,
): ArtRequirement[] {
  const out = new Map<string, ArtRequirement>();

  // Pack-level `assets.images` is a declared bundle rather than a placement, so
  // the role can only be inferred from the level that uses it. Levels are walked
  // first for that reason: anything still unclaimed afterwards is genuinely
  // unplaced, and saying so is more useful than guessing.
  for (const [index, level] of levelsOf(pack).entries()) {
    requirementsForLevel(engineId, level, levelNumber(level, index), out);
  }

  const assets = isObject(pack?.assets) ? pack!.assets as Record<string, unknown> : {};
  const images = Array.isArray(assets.images) ? assets.images : [];
  for (const value of images) {
    const assetId = str(value);
    if (!assetId || out.has(assetId)) continue;
    out.set(assetId, {
      assetId,
      role: 'game_illustration',
      level: null,
      languageDependency: null,
      brief: 'أصل مُعلَن في assets.images ولا يستخدمه أي مستوى بالاسم؛ '
        + 'يحتاج تحديد موضعه أو إزالته من الحزمة.',
    });
  }

  return [...out.values()];
}

/// Every image id the queue could refer to, for one batched status lookup.
///
/// Same reason as the audio queue: a per-row lookup across the catalogue is
/// hundreds of round trips in a single Worker request.
export function artQueueAssetIds(games: readonly ArtQueueGame[]): string[] {
  const ids = new Set<string>();
  for (const game of games) {
    for (const requirement of artRequirements(game.engineId, game.pack)) {
      ids.add(requirement.assetId);
    }
    for (const link of game.linkedAssets ?? []) ids.add(link.assetId);
  }
  return [...ids];
}

export type ArtProductionStatus = 'missing' | 'pending' | 'ready';

export interface ArtQueueGame {
  id: string;
  title: string;
  engineId: string;
  status: string;
  pack: Record<string, unknown> | null;
  /// `content_reviews` rows for this game.
  reviews: Array<{ role: string; status: string }>;
  /// Assets linked to the game itself through `asset_links`, e.g. the cover.
  linkedAssets?: Array<{ role: string; assetId: string }>;
}

export interface ArtQueueOptions {
  /// asset id -> the columns production needs from `content_assets`.
  assets: Record<string, {
    status: string;
    kind?: string | null;
    expectedWidth?: number | null;
    expectedHeight?: number | null;
    aspectRatio?: string | null;
    language?: string | null;
    uploadedBy?: string | null;
  }>;
}

export interface ArtQueueRow {
  asset_id: string;
  game_id: string;
  game_title: string;
  engine_id: string;
  game_status: string;
  level: number | null;
  role: AssetRole;
  role_label_ar: string;
  /// Expected geometry, from the brand document.
  expected_aspect_ratio: string;
  expected_size: string | null;
  expected_format: string;
  /// Non-null when the asset is locked to one language, i.e. it contains a glyph.
  language_dependency: string | null;
  brief: string;
  /// Raw `content_assets.status`, or null when no row exists.
  asset_status: string | null;
  production_status: ArtProductionStatus;
  /// Whoever uploaded the asset, which is the only ownership D1 records.
  assigned_owner: string | null;
  review_status: string;
  review_role: string;
  blocker: string | null;
}

function reviewFor(reviews: Array<{ role: string; status: string }>, role: string): string {
  const rows = reviews.filter((row) => row.role === role);
  if (!rows.length) return 'no_review_record';
  if (rows.some((row) => row.status === 'rejected')) return 'rejected';
  if (rows.some((row) => row.status === 'needs_changes')) return 'needs_changes';
  if (rows.some((row) => row.status === 'pending')) return 'pending';
  if (rows.some((row) => row.status === 'approved')) return 'approved';
  return rows[0].status;
}

export function buildArtProductionQueue(
  games: readonly ArtQueueGame[],
  options: ArtQueueOptions,
): ArtQueueRow[] {
  const rows: ArtQueueRow[] = [];

  for (const game of games) {
    const requirements = artRequirements(game.engineId, game.pack);

    // The cover is not in the pack: it is an `asset_links` row on the game. It is
    // queued anyway, because a game with no cover is a blank tile in a child's
    // library, and a production board that only knows about pack assets never
    // shows it.
    for (const link of game.linkedAssets ?? []) {
      if (requirements.some((requirement) => requirement.assetId === link.assetId)) continue;
      const role: AssetRole = link.role === 'cover' || link.role === 'poster' || link.role === 'thumbnail'
        ? 'cover'
        : link.role === 'character'
          ? 'character'
          : 'game_illustration';
      requirements.push({
        assetId: link.assetId,
        role,
        level: null,
        languageDependency: null,
        brief: role === 'cover'
          ? `غلاف "${game.title}": مربّع 1200×1200، يُقرأ في حجم صغير جدًا، وبلا نصّ مطبوع — `
            + 'العنوان طبقة واجهة تُترجم.'
          : `أصل مرتبط باللعبة بدور "${link.role}".`,
      });
    }

    for (const requirement of requirements) {
      const asset = options.assets[requirement.assetId] ?? null;
      const productionStatus: ArtProductionStatus = !asset
        ? 'missing'
        : asset.status === 'ready' ? 'ready' : 'pending';
      const spec = ROLE_SPECS[requirement.role];
      const reviewRole = 'qa';
      const reviewStatus = reviewFor(game.reviews, reviewRole);

      const blockers: string[] = [];
      if (productionStatus === 'missing') {
        blockers.push(`لا صفّ لهذا الأصل في content_assets — لم يُرسم بعد`);
      } else if (productionStatus === 'pending') {
        blockers.push(`حالة الأصل "${asset!.status}" وليست ready`);
      }
      if (asset && asset.kind && asset.kind !== 'image') {
        // A visual requirement pointing at an audio row is a pack authoring
        // mistake that would otherwise pass every existence check.
        blockers.push(`نوع الأصل "${asset.kind}" وليس image`);
      }
      if (requirement.languageDependency && asset && asset.language
        && asset.language !== requirement.languageDependency) {
        blockers.push(
          `الأصل مقيَّد بلغة "${requirement.languageDependency}" لكن سجلّه يقول "${asset.language}"`,
        );
      }
      if (!spec.glyph_allowed && requirement.languageDependency) {
        blockers.push('هذا الدور لا يسمح بنصّ داخل الصورة، فلا يجوز تقييده بلغة');
      }
      if (reviewStatus === 'rejected' || reviewStatus === 'needs_changes') {
        blockers.push(`مراجعة الجودة أعادت العمل: ${reviewStatus}`);
      }

      rows.push({
        asset_id: requirement.assetId,
        game_id: game.id,
        game_title: game.title,
        engine_id: game.engineId,
        game_status: game.status,
        level: requirement.level,
        role: requirement.role,
        role_label_ar: ROLE_LABELS[requirement.role],
        expected_aspect_ratio: asset?.aspectRatio ?? spec.aspect_ratio,
        expected_size: asset?.expectedWidth && asset?.expectedHeight
          ? `${asset.expectedWidth}×${asset.expectedHeight}`
          : spec.size,
        expected_format: spec.format,
        language_dependency: requirement.languageDependency,
        brief: requirement.brief,
        asset_status: asset?.status ?? null,
        production_status: productionStatus,
        assigned_owner: asset?.uploadedBy ?? null,
        review_status: reviewStatus,
        review_role: reviewRole,
        blocker: blockers.length ? blockers.join(' · ') : null,
      });
    }
  }

  return rows;
}

export interface ArtQueueSummary {
  total: number;
  ready: number;
  pending: number;
  missing: number;
  by_role: Record<string, { total: number; ready: number; pending: number; missing: number }>;
  /// Assets locked to a language, which cannot be reused in another build.
  language_locked: number;
}

export function summarizeArtQueue(rows: readonly ArtQueueRow[]): ArtQueueSummary {
  const summary: ArtQueueSummary = {
    total: rows.length, ready: 0, pending: 0, missing: 0, by_role: {}, language_locked: 0,
  };
  for (const row of rows) {
    summary[row.production_status] += 1;
    if (row.language_dependency) summary.language_locked += 1;
    const bucket = summary.by_role[row.role] ??= { total: 0, ready: 0, pending: 0, missing: 0 };
    bucket.total += 1;
    bucket[row.production_status] += 1;
  }
  return summary;
}
