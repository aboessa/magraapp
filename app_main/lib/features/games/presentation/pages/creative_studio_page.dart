/// Creative Studio — polished home discovering every production creative experience.
/// Sections: Continue Drawing, ارسم بحرية, لوّن, تتبّع, الحروف, الأرقام, صل النقاط, أكمل الرسمة, انسخ النمط, ارسم من الفكرة
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../data/creation_document.dart';
import '../../data/local_creation_store.dart';
import '../widgets/drawing_asset.dart';
import '../../application/creative_catalogue_provider.dart';
import '../../data/coloring_page.dart';
import '../../data/creative_catalogue.dart';
import '../../engine/coloring_board.dart' show ColoringBoard;
import '../../engine/coloring_regions.dart' show ColorRegion;
import '../../engine/free_draw_surface.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_services.dart';
import '../../engine/game_session_controller.dart';
import '../../engine/trace_color_engine.dart' show TraceColorSurface;
import '../studio/studio_app_bar.dart';
import '../studio/studio_categories.dart';
import '../studio/studio_design.dart';
import '../studio/studio_home_view.dart';
import '../studio/studio_home_widgets.dart';
import 'coloring/coloring_home_v2.dart' show FeaturedColoringSpec, kFeaturedColoringV2;
import 'coloring/coloring_board_v2.dart' show ColoringBoardV2Page;
import 'coloring/coloring_home_v2_live.dart' show ColoringHomeV2LiveWrapper;
import 'my_boards_page.dart';
import 'reference_catalogue_page_live.dart';
import 'complete/complete_catalogue_page.dart';
import 'connect_dots/connect_dots_catalogue_page.dart';
import 'studio_v2/my_boards_v2.dart';
import 'studio_v2/prompt_draw_page.dart';
import 'studio_v2/trace_home_page.dart';
import 'studio_v2/category_inside_coloring_page.dart';

class CreativeStudioPage extends StatefulWidget {
  const CreativeStudioPage({
    required this.childId,
    required this.creationStore,
    this.initialDocument,
    this.initialCreation,
    this.onSaved,
    this.displayName,
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final CreationDocument? initialDocument;
  final LocalCreation? initialCreation;
  final VoidCallback? onSaved;

  /// Active profile name, shown on the app-bar badge. Optional because the
  /// studio is also reachable from a deep link that only carries a child id.
  final String? displayName;

  @override
  State<CreativeStudioPage> createState() => _CreativeStudioPageState();
}

class _CreativeStudioPageState extends State<CreativeStudioPage> {
  List<LocalCreation> _creations = const [];
  bool _loadingCreations = true;
  Object? _creationError;

  @override
  void initState() {
    super.initState();
    unawaited(_loadCreations());
  }

  Future<void> _loadCreations() async {
    if (mounted) {
      setState(() {
        _loadingCreations = true;
        _creationError = null;
      });
    }
    try {
      final list = await widget.creationStore.list(widget.childId);
      if (!mounted) return;
      setState(() {
        _creations = list;
        _loadingCreations = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _creationError = error;
        _loadingCreations = false;
      });
    }
  }

  void _handleSaved() {
    widget.onSaved?.call();
    unawaited(_loadCreations());
  }

  @override
  Widget build(BuildContext context) {
    final initialDocument = widget.initialDocument;
    if (initialDocument != null) {
      return _FreeDrawHost(
        childId: widget.childId,
        creationStore: widget.creationStore,
        gameId: widget.initialCreation?.gameId ?? 'studio-free',
        drawingMode:
            widget.initialCreation?.drawingMode ?? initialDocument.mode,
        initialDocument: initialDocument,
        continueCreation: widget.initialCreation,
        onSaved: widget.onSaved,
      );
    }

    return StudioHomeView(
      displayName: widget.displayName,
      savedDrawings: _creations.length,
      resumable: _resumable(context),
      loadingCreations: _loadingCreations,
      creationError: _creationError,
      onRefresh: _loadCreations,
      onStartFreeDraw: () => _openFreeDraw(context),
      onOpenBoards: () => _openBoards(context),
      onOpenReference: () => _openReference(context),
      onOpenCategory: (category) => _openCategory(context, category),
      onOpenAllCategories: () => _openAllCategories(context),
    );
  }

  /// Unfinished drawings for the hero carousel.
  ///
  /// Only editable saves qualify: a legacy flattened PNG has no replay document,
  /// so offering to "continue" it would open an empty canvas. Four is the cap
  /// because the carousel is a prompt to finish something, not a gallery —
  /// لوحاتي is the gallery.
  List<StudioHeroResume> _resumable(BuildContext context) {
    final entries = <StudioHeroResume>[];
    for (final creation in _creations) {
      if (entries.length == 4) break;
      if (!creation.isEditable) continue;
      final raw = creation.documentJson;
      if (raw == null) continue;
      final document = CreationDocument.tryParse(raw);
      if (document == null) continue;
      entries.add(
        StudioHeroResume(
          title: creation.displayTitle,
          thumbnail: creation.bytes,
          onTap: () => _openContinue(context, creation, document),
        ),
      );
    }
    return entries;
  }

  void _openBoards(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => MyBoardsV2Page(
          childId: widget.childId,
          store: widget.creationStore,
        ),
      ),
    );
  }

  void _openReference(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ReferenceCataloguePageLiveWrapper(
          childId: widget.childId,
          creationStore: widget.creationStore,
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  void _openAllCategories(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => StudioAllCategoriesView(
          onStartFreeDraw: () => _openFreeDraw(context),
          onOpenReference: () => _openReference(context),
          onOpenCategory: (category) => _openCategory(context, category),
        ),
      ),
    );
  }

  void _openCategory(BuildContext context, StudioCategory category) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _StudioCategoryPage(
          category: category,
          childId: widget.childId,
          creationStore: widget.creationStore,
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  void _openFreeDraw(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: widget.childId,
          creationStore: widget.creationStore,
          gameId: 'studio-free',
          drawingMode: 'free_draw',
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  void _openContinue(
    BuildContext context,
    LocalCreation creation,
    CreationDocument document,
  ) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: widget.childId,
          creationStore: widget.creationStore,
          gameId: creation.gameId,
          drawingMode: creation.drawingMode,
          initialDocument: document,
          continueCreation: creation,
          onSaved: _handleSaved,
        ),
      ),
    );
  }
}

/// Coloring section driven by CMS/bundled JSON, not Dart literals.
/// Falls back to `_coloringItems` only if the provider is empty (offline first launch safety).
/// One activity, full screen.
///
/// The home shows a card per activity; this is what the card opens. It exists so
/// the catalogue for an activity can be as long as it needs to be without
/// pushing every other activity below the fold, which is what the old
/// single-scroll home did.
///
/// The sections it hosts are the same `_Catalog*Section` widgets the home used to
/// stack, reused rather than reimplemented — they own the `GamePack` construction
/// and the activity hosts, and duplicating that dispatch is how the two colouring
/// code paths drifted apart in the first place.
class _StudioCategoryPage extends StatelessWidget {
  const _StudioCategoryPage({
    required this.category,
    required this.childId,
    required this.creationStore,
    this.onSaved,
  });

  final StudioCategory category;
  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  /// لوّن is the only activity with two catalogues behind it: raster line art
  /// with a compiled region map, and the older primitive-shape polygon
  /// templates. They are shown as two labelled groups instead of the two
  /// near-identically named top-level sections they used to be.
  List<Widget> _sections() {
    switch (category.id) {
      case StudioCategoryId.coloring:
        // V2 home is a full page with its own Scaffold, so never embed as sections.
        // The build() below handles this.
        return const [];
      case StudioCategoryId.complete:
        return [
          _CatalogGenericSection(
            title: category.title,
            subtitle: category.subtitle,
            provider: completeCatalogueProvider,
            childId: childId,
            creationStore: creationStore,
            onSaved: onSaved,
            kind: _CatalogKind.complete,
            showHeader: false,
          ),
        ];
      case StudioCategoryId.copyPattern:
        return [
          _CatalogGenericSection(
            title: category.title,
            subtitle: category.subtitle,
            provider: copyCatalogueProvider,
            childId: childId,
            creationStore: creationStore,
            onSaved: onSaved,
            kind: _CatalogKind.copy,
            showHeader: false,
          ),
        ];
      case StudioCategoryId.connectDots:
        // Full page with its own Scaffold, like coloring — not embedded as a
        // section inside the generic category Scaffold.
        return const [];
      case StudioCategoryId.trace:
        return [
          _CatalogGenericSection(
            title: category.title,
            subtitle: category.subtitle,
            provider: traceCatalogueProvider,
            childId: childId,
            creationStore: creationStore,
            onSaved: onSaved,
            kind: _CatalogKind.trace,
            showHeader: false,
          ),
        ];
      case StudioCategoryId.letters:
        return [
          _CatalogGenericSection(
            title: category.title,
            subtitle: category.subtitle,
            provider: letterCatalogueProvider,
            childId: childId,
            creationStore: creationStore,
            onSaved: onSaved,
            kind: _CatalogKind.letter,
            showHeader: false,
          ),
        ];
      case StudioCategoryId.numbers:
        return [
          _CatalogGenericSection(
            title: category.title,
            subtitle: category.subtitle,
            provider: numberCatalogueProvider,
            childId: childId,
            creationStore: creationStore,
            onSaved: onSaved,
            kind: _CatalogKind.number,
            showHeader: false,
          ),
        ];
      case StudioCategoryId.promptDraw:
        return [
          _CatalogGenericSection(
            title: category.title,
            subtitle: category.subtitle,
            provider: promptCatalogueProvider,
            childId: childId,
            creationStore: creationStore,
            onSaved: onSaved,
            kind: _CatalogKind.prompt,
            showHeader: false,
          ),
        ];
      // ارسم بحرية opens a canvas and ارسم مثلي has its own catalogue page, so
      // neither is ever routed here. Handled explicitly so adding a category to
      // the enum is a compile error rather than a blank screen.
      case StudioCategoryId.freeDraw:
      case StudioCategoryId.drawLikeMe:
        return const [];
    }
  }

  @override
  Widget build(BuildContext context) {
    if (category.id == StudioCategoryId.connectDots) {
      return ConnectDotsCataloguePage(childId: childId, creationStore: creationStore, onSaved: onSaved);
    }
    if (category.id == StudioCategoryId.complete) {
      return CompleteCataloguePage(childId: childId, creationStore: creationStore, onSaved: onSaved);
    }
    if (category.id == StudioCategoryId.trace) {
      return TraceHomeWrapper(
        childId: childId,
        onOpenMyBoards: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => MyBoardsV2Page(
                childId: childId,
                store: creationStore,
              ),
            ),
          );
        },
      );
    }
    if (category.id == StudioCategoryId.promptDraw) {
      return PromptDrawPage(
        childId: childId,
        store: creationStore,
        promptText: category.subtitle,
      );
    }
    if (category.id == StudioCategoryId.coloring) {
      // V2 coloring home — مطابقة 100% للتصميم الجديد (hero + لوحاتي + رسومات مميزة + فئات)
      final _CatColoringBridge bridge = _CatColoringBridge.convert(childId: childId, creationStore: creationStore);
      return bridge.buildV2(context);
    }
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: StudioAppBar(
        title: category.title,
        glyph: category.icon,
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: StudioGradients.page),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            StudioSpace.gutter,
            StudioSpace.md,
            StudioSpace.gutter,
            StudioSpace.xxl,
          ),
          children: [
            _CategoryBanner(category: category),
            const SizedBox(height: StudioSpace.lg),
            ..._sections(),
          ],
        ),
      ),
    );
  }
}

/// Bridge لتشغيل صفحة "لوّن" V2 من داخل creative_studio_page القديم.
///
/// يحول النقر على رسمة مميزة أو فئة إلى فتح ColoringBoardV2Page مع الحفاظ على
/// تخزين الطفل وتسجيل التقدم.
class _CatColoringBridge {
  _CatColoringBridge._(this.childId, this.creationStore);
  final String childId;
  final LocalCreationStore creationStore;

  static _CatColoringBridge convert({required String childId, required LocalCreationStore creationStore}) => _CatColoringBridge._(childId, creationStore);

  Widget buildV2(BuildContext outerContext) {
    return FutureBuilder<List<LocalCreation>>(
      future: creationStore.list(childId),
      builder: (context, snap) {
        final count = snap.data?.length ?? 0;
        // R2-first live wrapper: يحمل coloring_all + featured من /api/v1/creative-studio/home
        // fallback تلقائي لـ kFeaturedColoringV2 لو offline
        return ColoringHomeV2LiveWrapper(
          childId: childId,
          creationStore: creationStore,
          myDrawingsCount: count,
          displayName: null,
          resumable: const [],
          onOpenMyBoards: () {
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => MyBoardsPage(childId: childId, creationStore: creationStore)));
          },
          onOpenCategory: (selection) {
            Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => CategoryInsideColoringPage(
                title: selection.category.label,
                heroUrl: selection.category.bestDisplayUrl,
                items: selection.items,
                onOpen: (featured) => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => _CatBoardLauncher(
                    childId: childId,
                    creationStore: creationStore,
                    featured: featured,
                    thumbSpecs: selection.items,
                  ),
                )),
              ),
            ));
          },
          onOpenFeatured: (featured) {
            Navigator.of(context).push(MaterialPageRoute(builder: (_) => _CatBoardLauncher(childId: childId, creationStore: creationStore, featured: featured, thumbSpecs: kFeaturedColoringV2)));
          },
        );
      },
    );
  }
}

class _CatBoardLauncher extends StatelessWidget {
  const _CatBoardLauncher({required this.childId, required this.creationStore, required this.featured, required this.thumbSpecs});
  final String childId;
  final LocalCreationStore creationStore;
  final FeaturedColoringSpec featured;
  final List<FeaturedColoringSpec> thumbSpecs;

  @override
  Widget build(BuildContext context) {
    return ColoringBoardV2Page(
      spec: featured,
      thumbSpecs: thumbSpecs,
      tutorialStorageKey: 'tutorial_coloring_v2_seen_$childId',
      onSelectOther: (other) {
        Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => _CatBoardLauncher(childId: childId, creationStore: creationStore, featured: other, thumbSpecs: thumbSpecs)));
      },
      onSave: (pngBytes) async {
        try {
          // R2-first board لا يعتمد على RenderRepaintBoundary ثان، نحفظ مباشر
          // عبر saveDocumentDirect المتوافقة مع production api (local-first child isolated)
          await creationStore.saveDocumentDirect(
            childId: childId,
            gameId: 'coloring-v2-${featured.id}',
            drawingMode: 'coloring-v2',
            documentJson: '{"source":"${featured.id}","label":"${featured.label}"}',
            documentVersion: 1,
            pngBytes: pngBytes,
            width: 1024,
            height: 1024,
          );
        } catch (_) {}
      },
    );
  }
}

/// Restates the activity at the top of its page so a child who tapped a card
/// lands on something recognisable, and so the instruction (the subtitle) is
/// visible before the grid rather than only on the home tile they just left.
class _CategoryBanner extends StatelessWidget {
  const _CategoryBanner({required this.category});

  final StudioCategory category;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return StudioSurface(
      gradient: category.gradient,
      radius: StudioRadius.card,
      padding: const EdgeInsets.all(StudioSpace.md),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.22),
              borderRadius: BorderRadius.circular(StudioRadius.tile),
            ),
            child: Icon(category.icon, color: Colors.white, size: 26),
          ),
          const SizedBox(width: StudioSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  category.title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  category.subtitle,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.80),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The one grid recipe for every studio catalogue.
///
/// Before this helper the same `GridView.builder` with the same delegate, the
/// same header pair and the same trailing spacer appeared six times in this file
/// with three different spacings. Sections now pass their items and nothing else.
Widget _studioGridSection({
  required bool showHeader,
  required String title,
  required String subtitle,
  required int itemCount,
  required Widget Function(BuildContext context, int index) itemBuilder,
}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (showHeader)
        StudioSectionHeader(title: title, subtitle: subtitle),
      GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: studioGridDelegate(),
        itemCount: itemCount,
        itemBuilder: itemBuilder,
      ),
      const SizedBox(height: StudioSpace.lg),
    ],
  );
}

/// A single catalogue item tile.
///
/// مصدران للرسم: معرّف أصل منطقي يحلّه [DrawingAsset]، أو أيقونة حين لا يكون
/// للعنصر رسم.
///
/// ## ما أُزيل ولماذا
///
/// كان هناك مصدر ثالث — `imagePath` لصورة مبندلة — ومعه `lightPlate` لعرضها على
/// خلفية بيضاء (رسوم التلوين خطوط سوداء تختفي على اللوح الداكن). لم يبقَ أي
/// مستدعٍ يمرّر أيًّا منهما بعد إزالة قسمَي التلوين اللذين كانا يقرآن قائمة
/// مُصرَّفة، فصار الوضعان غير قابلين للوصول — وهو ما رصده المحلّل
/// (`unused_element_parameter`).
///
/// حين يعود قسم تلوين يقرأ من المزوّد ويحتاج خلفية فاتحة، يُضاف الوضع مع
/// مستدعٍ فعلي لا قبله؛ خيار بلا مستدعٍ يوهم بمرونة غير مختبَرة.
class _StudioItemTile extends StatelessWidget {
  const _StudioItemTile({
    required this.label,
    required this.onTap,
    this.background,
    this.assetId,
    this.fallbackIcon,
  });

  final String label;
  final VoidCallback onTap;
  final Color? background;
  final String? assetId;
  final IconData? fallbackIcon;

  @override
  Widget build(BuildContext context) {
    final id = assetId;

    final Widget art = id != null
        ? DrawingAsset(assetIdOrPath: id, fit: BoxFit.contain)
        : Icon(fallbackIcon ?? Icons.brush_rounded, size: 34, color: Colors.white);

    return StudioSurface(
      onTap: onTap,
      color: background ?? AppColors.cardSurface,
      radius: StudioRadius.tile,
      semanticLabel: label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(StudioSpace.sm),
              child: art,
            ),
          ),
          Container(
            color: Colors.black.withValues(alpha: 0.28),
            padding: const EdgeInsets.symmetric(
              horizontal: StudioSpace.xs,
              vertical: StudioSpace.xs,
            ),
            child: Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

enum _CatalogKind { trace, letter, number, dots, complete, copy, prompt }

class _CatalogGenericSection extends ConsumerWidget {
  const _CatalogGenericSection({
    required this.title,
    required this.subtitle,
    required this.provider,
    required this.childId,
    required this.creationStore,
    required this.kind,
    this.onSaved,
    this.showHeader = true,
  });

  final String title;
  final String subtitle;
  final FutureProvider<List<StudioCatalogItem>> provider;
  final String childId;
  final LocalCreationStore creationStore;
  final _CatalogKind kind;
  final VoidCallback? onSaved;

  /// False when the hosting page already names the activity in its app bar and
  /// banner, which is every category page. True on any surface that stacks more
  /// than one section.
  final bool showHeader;

  IconData _iconForPrompt(String id) => switch (id) {
    'home' => Icons.home_outlined,
    'planet' => Icons.public,
    'sky' => Icons.cloud_outlined,
    'qisas' => Icons.menu_book_outlined,
    'oloom' => Icons.biotech_outlined,
    'alam' => Icons.map_outlined,
    _ => Icons.brush_outlined,
  };

  List<_StudioItem> _fallbackForKind() => switch (kind) {
    _CatalogKind.trace => _traceItems,
    _CatalogKind.letter => _letterItems,
    _CatalogKind.number => _numberItems,
    _CatalogKind.dots => _dotsItems,
    _CatalogKind.complete => _completeItems,
    _CatalogKind.copy => _copyItems,
    _CatalogKind.prompt => _promptItems,
  };

  void _openCatalogItem(BuildContext context, StudioCatalogItem item) =>
      _openStudioItem(
        context,
        _StudioItem(
          id: item.id,
          label: item.label,
          assetId: item.assetId,
          thumbnailAssetId: item.thumbnailAssetId,
          bg: item.bgColor,
          icon: item.icon == 'prompt'
              ? _iconForPrompt(item.id)
              : Icons.brush_outlined,
          mode: item.mode,
          strokePaths: item.strokePaths.isEmpty ? null : item.strokePaths,
          dots: item.dots.isEmpty ? null : item.dots,
          regions: item.regions.isEmpty ? null : item.regions,
          palette: item.palette.isEmpty ? null : item.palette,
        ),
      );

  void _openStudioItem(BuildContext context, _StudioItem item) {
    switch (kind) {
      case _CatalogKind.trace:
      case _CatalogKind.letter:
      case _CatalogKind.number:
        _doOpenTrace(context, item);
        break;
      case _CatalogKind.dots:
        _doOpenDots(context, item);
        break;
      case _CatalogKind.complete:
        _doOpenComplete(context, item);
        break;
      case _CatalogKind.copy:
        _doOpenCopy(context, item);
        break;
      case _CatalogKind.prompt:
        _doOpenPrompt(context, item);
        break;
    }
  }

  void _doOpenTrace(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-trace-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-shape-template-circle'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': item.mode ?? 'shape',
          'scoring': 'geometric',
          'prompt_key': 'game.trace.${item.id}.prompt',
          'completion': {'rule': 'all_strokes_complete'},
          'stroke_paths':
              item.strokePaths ??
              [
                {
                  'id': 's1',
                  'order': 1,
                  'points': [
                    [0.2, 0.5],
                    [0.8, 0.5],
                  ],
                },
              ],
          'tolerance_dp': 24,
          'coverage_required': 0.8,
          'background_asset': item.assetId,
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-trace-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'trace',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenDots(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-dots-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-dots-star'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'connect_dots',
          'scoring': 'sequence',
          'prompt_key': 'game.dots.${item.id}.prompt',
          'completion': {'rule': 'all_dots_connected'},
          'dots':
              item.dots ??
              [
                {
                  'id': 'd1',
                  'order': 1,
                  'at': [0.2, 0.2],
                },
                {
                  'id': 'd2',
                  'order': 2,
                  'at': [0.8, 0.2],
                },
              ],
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-dots-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'connect_dots',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenComplete(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-complete-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-complete-half-sun'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'complete_drawing',
          'scoring': 'none',
          'prompt_key': 'game.complete.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'background_asset': item.assetId,
          'coloring': {
            'enabled': false,
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE'],
          },
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-complete-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'complete_drawing',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenCopy(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-copy-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-copy-pattern'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'copy_pattern',
          'scoring': 'none',
          'prompt_key': 'game.copy.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'background_asset': item.assetId,
          'stroke_paths': [
            {
              'id': 's1',
              'order': 1,
              'points': [
                [0.2, 0.5],
                [0.8, 0.5],
              ],
            },
          ],
          'tolerance_dp': 28,
          'coverage_required': 0.7,
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-copy-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'copy_pattern',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenPrompt(BuildContext context, _StudioItem item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: childId,
          creationStore: creationStore,
          gameId: 'studio-prompt-${item.id}',
          drawingMode: 'prompt_drawing',
          promptOverride: item.label,
          onSaved: onSaved,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return async.when(
      loading: () => StudioStateCard.loading(),
      error: (e, _) => _fallback(context),
      data: (list) {
        if (list.isEmpty) return _fallback(context);
        return _studioGridSection(
          showHeader: showHeader,
          title: title,
          subtitle: subtitle,
          itemCount: list.length,
          itemBuilder: (ctx, i) {
            final it = list[i];
            return _StudioItemTile(
              label: it.label,
              assetId: it.previewAssetId,
              fallbackIcon: _iconForPrompt(it.id),
              background: it.bgColor,
              onTap: () => _openCatalogItem(context, it),
            );
          },
        );
      },
    );
  }

  Widget _fallback(BuildContext context) {
    final items = _fallbackForKind();
    return _studioGridSection(
      showHeader: showHeader,
      title: title,
      subtitle: subtitle,
      itemCount: items.length,
      itemBuilder: (ctx, i) {
        final it = items[i];
        return _StudioItemTile(
          label: it.label,
          assetId: it.previewAssetId,
          fallbackIcon: it.icon,
          background: it.bg,
          onTap: () => _openStudioItem(context, it),
        );
      },
    );
  }
}

class _StudioItem {
  const _StudioItem({
    required this.id,
    required this.label,
    this.assetId,
    this.thumbnailAssetId,
    this.bg = const Color(0xFF0F172A),
    this.icon = Icons.brush_outlined,
    this.mode,
    this.strokePaths,
    this.regions,
    this.dots,
    this.palette,
    this.promptKey,
  });
  final String id;
  final String label;
  final String? assetId;
  final String? thumbnailAssetId;
  final Color bg;
  final IconData icon;
  final String? mode;
  final List<Map<String, dynamic>>? strokePaths;
  final List<ColorRegion>? regions;
  final List<Map<String, dynamic>>? dots;
  final List<String>? palette;
  final String? promptKey;

  String? get previewAssetId => thumbnailAssetId ?? assetId;
}

final _traceItems = [
  _StudioItem(
    id: 'line-h',
    label: 'خط أفقي',
    assetId: 'asset-line-h',
    bg: Color(0xFF334155),
    mode: 'line',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.15, 0.5],
          [0.85, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'line-v',
    label: 'خط عمودي',
    assetId: 'asset-line-v',
    bg: Color(0xFF334155),
    mode: 'line',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.15],
          [0.5, 0.85],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'diagonal',
    label: 'مائل',
    assetId: 'asset-trace-diagonal',
    bg: Color(0xFF334155),
    mode: 'line',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.8],
          [0.8, 0.2],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'zigzag',
    label: 'متعرج',
    assetId: 'asset-zigzag',
    bg: Color(0xFF475569),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.15, 0.5],
          [0.3, 0.3],
          [0.45, 0.7],
          [0.6, 0.3],
          [0.85, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'wave',
    label: 'موجة',
    assetId: 'asset-wave',
    bg: Color(0xFF475569),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.15, 0.5],
          [0.3, 0.3],
          [0.5, 0.5],
          [0.7, 0.7],
          [0.85, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'spiral',
    label: 'حلزون',
    assetId: 'asset-spiral',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.5],
          [0.6, 0.5],
          [0.6, 0.6],
          [0.4, 0.6],
          [0.4, 0.4],
          [0.65, 0.4],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'loop',
    label: 'حلقة',
    assetId: 'asset-trace-loop',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.33],
          [0.63, 0.33],
          [0.63, 0.66],
          [0.36, 0.66],
          [0.36, 0.33],
          [0.5, 0.33],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'arch',
    label: 'قوس',
    assetId: 'asset-trace-arch',
    bg: Color(0xFF475569),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.66],
          [0.35, 0.3],
          [0.65, 0.3],
          [0.8, 0.66],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 's-curve',
    label: 'حرف S',
    assetId: 'asset-trace-s-curve',
    bg: Color(0xFF475569),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.66],
          [0.33, 0.33],
          [0.66, 0.8],
          [0.8, 0.33],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'road',
    label: 'طريق',
    assetId: 'asset-trace-road',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.5],
          [0.33, 0.5],
          [0.43, 0.33],
          [0.56, 0.5],
          [0.73, 0.66],
          [0.8, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'maze',
    label: 'متاهة',
    assetId: 'asset-trace-maze',
    bg: Color(0xFF1E293B),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.8, 0.4],
          [0.33, 0.4],
          [0.33, 0.6],
          [0.8, 0.6],
          [0.8, 0.8],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'mountain-path',
    label: 'مسار جبلي',
    assetId: 'asset-trace-mountain-path',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.8],
          [0.33, 0.33],
          [0.5, 0.58],
          [0.66, 0.3],
          [0.8, 0.8],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'rocket-trail',
    label: 'ذيل صاروخ',
    assetId: 'asset-trace-rocket-trail',
    bg: Color(0xFF1E1B4B),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.8],
          [0.46, 0.6],
          [0.53, 0.43],
          [0.5, 0.2],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'bee',
    label: 'مسار نحلة',
    assetId: 'asset-trace-bee',
    bg: Color(0xFFF59E0B),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.5],
          [0.33, 0.33],
          [0.5, 0.66],
          [0.66, 0.33],
          [0.77, 0.4],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'fish-path',
    label: 'سباحة سمكة',
    assetId: 'asset-trace-fish-path',
    bg: Color(0xFF0891B2),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.5],
          [0.33, 0.36],
          [0.56, 0.3],
          [0.8, 0.5],
        ],
      },
    ],
  ),
];
final _letterItems = [
  _StudioItem(
    id: 'alif',
    label: 'ا',
    assetId: 'asset-glyph-alif',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.22],
          [0.5, 0.74],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'baa',
    label: 'ب',
    assetId: 'asset-glyph-baa',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.3, 0.55],
          [0.7, 0.55],
        ],
      },
      {
        'id': 's2',
        'order': 2,
        'type': 'dot',
        'points': [
          [0.5, 0.65],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'lam',
    label: 'ل',
    assetId: 'asset-glyph-lam',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.55, 0.2],
          [0.55, 0.6],
          [0.4, 0.75],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'noon',
    label: 'ن',
    assetId: 'asset-glyph-noon',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.3, 0.5],
          [0.7, 0.5],
        ],
      },
      {
        'id': 's2',
        'order': 2,
        'type': 'dot',
        'points': [
          [0.5, 0.35],
        ],
      },
    ],
  ),
];
final _numberItems = [
  for (var n = 1; n <= 10; n++)
    _StudioItem(
      id: '$n',
      label: '$n',
      assetId: 'asset-number-$n',
      bg: Color(0xFF0F172A),
      mode: 'number',
      strokePaths: [
        {
          'id': 's1',
          'order': 1,
          'points': [
            [0.5, 0.2],
            [0.5, 0.8],
          ],
        },
      ],
    ),
];
final _dotsItems = [
  _StudioItem(
    id: 'star',
    label: 'نجمة',
    assetId: 'asset-dots-star',
    bg: Color(0xFF4C1D95),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.13],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.63, 0.36],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.86, 0.38],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.68, 0.53],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.73, 0.76],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.5, 0.63],
      },
      {
        'id': 'd7',
        'order': 7,
        'at': [0.26, 0.76],
      },
      {
        'id': 'd8',
        'order': 8,
        'at': [0.31, 0.53],
      },
      {
        'id': 'd9',
        'order': 9,
        'at': [0.13, 0.38],
      },
      {
        'id': 'd10',
        'order': 10,
        'at': [0.36, 0.36],
      },
    ],
  ),
  _StudioItem(
    id: 'house',
    label: 'بيت',
    assetId: 'asset-dots-house',
    bg: Color(0xFF7C2D12),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.5],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.8, 0.5],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.5, 0.2],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.2, 0.86],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.8, 0.86],
      },
    ],
  ),
  _StudioItem(
    id: 'fish',
    label: 'سمكة',
    assetId: 'asset-dots-fish',
    bg: Color(0xFF0E7490),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.5],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.33, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.56, 0.3],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.86, 0.5],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.56, 0.7],
      },
    ],
  ),
  _StudioItem(
    id: 'rocket',
    label: 'صاروخ',
    assetId: 'asset-dots-rocket',
    bg: Color(0xFF1E1B4B),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.13],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.43, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.33, 0.86],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.66, 0.86],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.56, 0.33],
      },
    ],
  ),
  _StudioItem(
    id: 'flower',
    label: 'زهرة',
    assetId: 'asset-dots-flower',
    bg: Color(0xFF831843),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.2],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.63, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.63, 0.5],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.5, 0.63],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.36, 0.5],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.36, 0.33],
      },
    ],
  ),
  _StudioItem(
    id: 'cat2',
    label: 'قطة',
    assetId: 'asset-dots-cat2',
    bg: Color(0xFF0B1220),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.33, 0.5],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.46, 0.36],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.58, 0.4],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.53, 0.6],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.33, 0.6],
      },
    ],
  ),
  _StudioItem(
    id: 'butterfly2',
    label: 'فراشة',
    assetId: 'asset-dots-butterfly2',
    bg: Color(0xFF831843),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.33],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.6, 0.4],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.6, 0.53],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.5, 0.6],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.4, 0.53],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.4, 0.4],
      },
    ],
  ),
  _StudioItem(
    id: 'tree2',
    label: 'شجرة',
    assetId: 'asset-dots-tree2',
    bg: Color(0xFF14532D),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.25],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.58, 0.41],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.53, 0.58],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.46, 0.58],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.41, 0.41],
      },
    ],
  ),
  _StudioItem(
    id: 'car2',
    label: 'سيارة',
    assetId: 'asset-dots-car2',
    bg: Color(0xFFDC2626),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.6],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.3, 0.5],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.7, 0.5],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.8, 0.6],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.66, 0.7],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.26, 0.7],
      },
    ],
  ),
  _StudioItem(
    id: 'moon2',
    label: 'قمر',
    assetId: 'asset-dots-moon2',
    bg: Color(0xFF334155),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.33],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.6, 0.36],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.66, 0.46],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.63, 0.58],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.5, 0.63],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.36, 0.58],
      },
      {
        'id': 'd7',
        'order': 7,
        'at': [0.33, 0.46],
      },
      {
        'id': 'd8',
        'order': 8,
        'at': [0.4, 0.36],
      },
    ],
  ),
  _StudioItem(
    id: 'dino',
    label: 'ديناصور',
    assetId: 'asset-dots-dino',
    bg: Color(0xFF14532D),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.3, 0.63],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.33, 0.5],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.46, 0.4],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.6, 0.43],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.7, 0.56],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.63, 0.66],
      },
      {
        'id': 'd7',
        'order': 7,
        'at': [0.5, 0.63],
      },
    ],
  ),
  _StudioItem(
    id: 'boat2',
    label: 'قارب',
    assetId: 'asset-dots-boat2',
    bg: Color(0xFF0369A1),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.63],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.5, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.8, 0.63],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.66, 0.73],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.33, 0.73],
      },
    ],
  ),
];
final _completeItems = [
  _StudioItem(
    id: 'half-sun',
    label: 'نصف شمس',
    assetId: 'asset-complete-half-sun',
    bg: Color(0xFF92400E),
  ),
  _StudioItem(
    id: 'house',
    label: 'بيت ناقص',
    assetId: 'asset-complete-house',
    bg: Color(0xFF1E3A8A),
  ),
  _StudioItem(
    id: 'rocket',
    label: 'صاروخ ناقص',
    assetId: 'asset-complete-rocket',
    bg: Color(0xFF312E81),
  ),
  _StudioItem(
    id: 'butterfly',
    label: 'فراشة ناقصة',
    assetId: 'asset-complete-butterfly',
    bg: Color(0xFF831843),
  ),
  _StudioItem(
    id: 'fish2',
    label: 'سمكة ناقصة',
    assetId: 'asset-complete-fish2',
    bg: Color(0xFF0891B2),
  ),
  _StudioItem(
    id: 'tree2',
    label: 'شجرة ناقصة',
    assetId: 'asset-complete-tree2',
    bg: Color(0xFF14532D),
  ),
  _StudioItem(
    id: 'car',
    label: 'سيارة ناقصة',
    assetId: 'asset-complete-car',
    bg: Color(0xFFDC2626),
  ),
  _StudioItem(
    id: 'flower2',
    label: 'زهرة ناقصة',
    assetId: 'asset-complete-flower2',
    bg: Color(0xFF831843),
  ),
  _StudioItem(
    id: 'face',
    label: 'وجه ناقص',
    assetId: 'asset-complete-face',
    bg: Color(0xFFF59E0B),
  ),
  _StudioItem(
    id: 'castle',
    label: 'قلعة ناقصة',
    assetId: 'asset-complete-castle',
    bg: Color(0xFF78716C),
  ),
  _StudioItem(
    id: 'boat2',
    label: 'قارب ناقص',
    assetId: 'asset-complete-boat2',
    bg: Color(0xFF0369A1),
  ),
  _StudioItem(
    id: 'robot',
    label: 'روبوت ناقص',
    assetId: 'asset-complete-robot',
    bg: Color(0xFF334155),
  ),
];
final _copyItems = [
  _StudioItem(
    id: 'sequence',
    label: 'تسلسل',
    assetId: 'asset-copy-pattern',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'abc',
    label: 'ABC',
    assetId: 'asset-copy-abc',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'size',
    label: 'أحجام',
    assetId: 'asset-copy-size',
    bg: Color(0xFF475569),
  ),
  _StudioItem(
    id: 'direction',
    label: 'اتجاه',
    assetId: 'asset-copy-direction',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'motif',
    label: 'زخرف',
    assetId: 'asset-copy-motif',
    bg: Color(0xFF475569),
  ),
  _StudioItem(
    id: 'symmetry',
    label: 'تناظر',
    assetId: 'asset-copy-symmetry',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'line',
    label: 'خطوط',
    assetId: 'asset-copy-line',
    bg: Color(0xFF475569),
  ),
  _StudioItem(
    id: 'mixed',
    label: 'مختلط',
    assetId: 'asset-copy-mixed',
    bg: Color(0xFF334155),
  ),
];
final _promptItems = [
  _StudioItem(
    id: 'home',
    label: 'بيتي المفضل',
    thumbnailAssetId: 'asset-prompt-home',
    bg: Color(0xFF831843),
    icon: Icons.home_outlined,
    promptKey: 'game.prompt.home.prompt',
  ),
  _StudioItem(
    id: 'planet',
    label: 'كوكب جديد',
    thumbnailAssetId: 'asset-prompt-planet',
    bg: Color(0xFF312E81),
    icon: Icons.public,
    promptKey: 'game.prompt.planet.prompt',
  ),
  _StudioItem(
    id: 'sky',
    label: 'في السماء',
    thumbnailAssetId: 'asset-prompt-sky',
    bg: Color(0xFF0C4A6E),
    icon: Icons.cloud_outlined,
    promptKey: 'game.prompt.sky.prompt',
  ),
  _StudioItem(
    id: 'qisas',
    label: 'نهاية القصة',
    thumbnailAssetId: 'asset-prompt-qisas',
    bg: Color(0xFF422006),
    icon: Icons.menu_book_outlined,
    promptKey: 'game.qisas.draw_ending.prompt',
  ),
  _StudioItem(
    id: 'oloom',
    label: 'ما لاحظت',
    thumbnailAssetId: 'asset-prompt-oloom',
    bg: Color(0xFF14532D),
    icon: Icons.biotech_outlined,
    promptKey: 'game.oloom.observe.prompt',
  ),
  _StudioItem(
    id: 'alam',
    label: 'خريطة غرفتي',
    thumbnailAssetId: 'asset-prompt-alam',
    bg: Color(0xFF1E1B4B),
    icon: Icons.map_outlined,
    promptKey: 'game.alam.map.prompt',
  ),
];

class _FreeDrawHost extends StatefulWidget {
  const _FreeDrawHost({
    required this.childId,
    required this.creationStore,
    required this.gameId,
    required this.drawingMode,
    this.initialDocument,
    this.continueCreation,
    this.promptOverride,
    this.onSaved,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final String gameId;
  final String drawingMode;
  final CreationDocument? initialDocument;
  final LocalCreation? continueCreation;
  final String? promptOverride;
  final VoidCallback? onSaved;

  @override
  State<_FreeDrawHost> createState() => _FreeDrawHostState();
}

class _FreeDrawHostState extends State<_FreeDrawHost> {
  late final GameSessionController _ctrl;
  late final GamePack _pack;
  final GlobalKey _key = GlobalKey();
  List<FreeStroke> _strokes = const [];
  String? _message;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': widget.gameId,
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {'images': <String>[], 'audio': <String>[]},
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.free_draw.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': false,
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2'],
          },
        },
      ],
    });
    _ctrl = GameSessionController(
      pack: _pack,
      gameId: widget.gameId,
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
      initialCreationJson: widget.initialDocument?.toJsonString(),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: StudioAppBar(
        title: widget.promptOverride ?? 'ارسم بحرية',
        glyph: Icons.gesture_rounded,
      ),
      body: Column(
        children: [
          Expanded(
            child: FreeDrawSurface(
              controller: _ctrl,
              initialDocument: widget.initialDocument,
              canvasRepaintBoundaryKey: _key,
              onStrokesChanged: (strokes) => _strokes = List.of(strokes),
            ),
          ),
          if (_message != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_message!),
              ),
            ),
          SafeArea(
            minimum: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_alt),
                label: Text(
                  _saving
                      ? 'جارٍ الحفظ…'
                      : widget.continueCreation != null
                      ? 'تحديث الرسم'
                      : 'احفظ رسمتي',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final boundary = _key.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز الرسم للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });
    final canvasWidth = boundary.size.width <= 0 ? 512.0 : boundary.size.width;
    final canvasHeight = boundary.size.height <= 0
        ? canvasWidth
        : boundary.size.height;
    final document = CreationDocument.fromStrokes(
      mode: widget.drawingMode,
      canvasSize: canvasWidth,
      canvasHeight: canvasHeight,
      strokes: _strokes,
      fills: const {},
      palette: _pack.levels.first.coloring?.palette ?? const [],
      prompt:
          widget.promptOverride ??
          widget.initialDocument?.prompt ??
          'الاستوديو',
      packId: widget.gameId,
    );

    try {
      final result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.childId,
        gameId: widget.gameId,
        drawingMode: widget.drawingMode,
        documentJson: document.toJsonString(),
        documentVersion: document.version,
        existingCreation: widget.continueCreation,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت في رسوماتي'
            : 'تعذر الحفظ. رسمتك ما زالت أمامك.';
      });
      if (result.isSuccess) widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. رسمتك ما زالت أمامك.';
      });
    }
  }
}

class ColoringActivityHost extends StatefulWidget {
  const ColoringActivityHost({
    super.key,
    required this.controller,
    required this.creationStore,
    this.disposeController = true,
    this.onSaved,
  });

  final GameSessionController controller;
  final LocalCreationStore creationStore;
  final bool disposeController;
  final VoidCallback? onSaved;

  @override
  State<ColoringActivityHost> createState() => ColoringActivityHostState();
}

class ColoringActivityHostState extends State<ColoringActivityHost> {
  final GlobalKey _key = GlobalKey();
  String? _message;
  bool _saving = false;

  @override
  void dispose() {
    if (widget.disposeController) widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: TraceColorSurface(
            controller: widget.controller,
            canvasRepaintBoundaryKey: _key,
          ),
        ),
        if (_message != null)
          Semantics(
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_message!),
            ),
          ),
        SafeArea(
          minimum: const EdgeInsets.all(12),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_alt),
              label: Text(_saving ? 'جارٍ الحفظ…' : 'احفظ رسمتي'),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _save() async {
    final boundary = _key.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز الرسم للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });
    final document = CreationDocument(
      version: kCreationDocVersion,
      mode: 'coloring',
      fills: widget.controller.regionColors.entries
          .map((entry) => CreationFill(regionId: entry.key, hex: entry.value))
          .toList(growable: false),
      palette: widget.controller.level.coloring?.palette ?? const [],
      templateAsset: widget.controller.level.coloring?.templateAsset,
      packId: widget.controller.pack.packId,
      levelIndex: widget.controller.levelIndex,
      createdAt: DateTime.now(),
      creationType: CreationType.coloring,
    );

    try {
      final result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.controller.childId,
        gameId: widget.controller.gameId,
        drawingMode: 'coloring',
        documentJson: document.toJsonString(),
        documentVersion: document.version,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت في رسوماتي'
            : 'تعذر الحفظ. حاول مرة أخرى.';
      });
      if (result.isSuccess) widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. حاول مرة أخرى.';
      });
    }
  }
}

/// Owns a trace-engine controller and offers an honest flattened save.
///
/// Trace/connect-dots/copy currently expose no serializable child path. Saving a
/// PNG keeps the child's visible result without falsely advertising it as an
/// editable document; free-draw and coloring continue to save real documents.
class TraceActivityHost extends StatefulWidget {
  const TraceActivityHost({
    super.key,
    required this.title,
    required this.controller,
    required this.creationStore,
    required this.drawingMode,
    this.disposeController = true,
    this.onSaved,
  });

  final String title;
  final GameSessionController controller;
  final LocalCreationStore creationStore;
  final String drawingMode;
  final bool disposeController;
  final VoidCallback? onSaved;

  @override
  State<TraceActivityHost> createState() => TraceActivityHostState();
}

class TraceActivityHostState extends State<TraceActivityHost> {
  final GlobalKey _captureKey = GlobalKey();
  String? _message;
  bool _saving = false;

  @override
  void dispose() {
    if (widget.disposeController) widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: StudioAppBar(
        title: widget.title,
        glyph: Icons.gesture_rounded,
      ),
      body: Column(
        children: [
          Expanded(
            child: TraceColorSurface(
              controller: widget.controller,
              canvasRepaintBoundaryKey: _captureKey,
            ),
          ),
          if (_message != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_message!),
              ),
            ),
          SafeArea(
            minimum: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_alt),
                label: Text(_saving ? 'جارٍ الحفظ…' : 'احفظ النتيجة'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز النتيجة للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      final result = await widget.creationStore.saveFromBoundary(
        boundary: boundary,
        childId: widget.controller.childId,
        gameId: widget.controller.gameId,
        drawingMode: widget.drawingMode,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت النتيجة في رسوماتي'
            : 'تعذر الحفظ. حاول مرة أخرى.';
      });
      if (result.isSuccess) widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. حاول مرة أخرى.';
      });
    }
  }
}

/// Opens one colouring page and owns its save.
///
/// No [GameSessionController] here, unlike every other activity host. The
/// controller exists to score attempts and track progression against a
/// [GamePack]; a colouring page has nothing to score and no level to advance, so
/// wiring one up would mean fabricating a pack to satisfy a type rather than to
/// describe anything real.
///
/// The save is a PNG only, and deliberately so. [ColoringBoard] keeps the child's
/// work as brush strokes and bucket fills in image-pixel space, which no existing
/// [CreationDocument] field can express — `fills` is `{regionId, hex}` pairs from
/// the polygon engine. Writing strokes into a document that cannot replay them
/// would advertise an editable creation that reopens blank, so this follows
/// [TraceActivityHost]: keep the visible result honestly, claim nothing more.
class _ColoringPageHost extends StatefulWidget {
  // بلا `onSaved`: لم يبقَ مستدعٍ يمرّره بعد إزالة قسم صفحات التلوين المُصرَّف،
  // والحفظ يمرّ عبر `creationStore` مباشرة.
  const _ColoringPageHost({
    required this.page,
    required this.childId,
    required this.creationStore,
  });

  final ColoringPage page;
  final String childId;
  final LocalCreationStore creationStore;

  @override
  State<_ColoringPageHost> createState() => _ColoringPageHostState();
}

class _ColoringPageHostState extends State<_ColoringPageHost> {
  final GlobalKey _captureKey = GlobalKey();
  String? _message;
  bool _saving = false;
  bool _painted = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: StudioAppBar(
        title: 'تلوين ${widget.page.label}',
        glyph: Icons.palette_rounded,
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: FilledButton.icon(
              // Disabled until something is actually painted, so a child cannot
              // fill their gallery with untouched copies of the same picture.
              onPressed: (_saving || !_painted) ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_alt, size: 18),
              label: Text(_saving ? 'جارٍ الحفظ…' : 'حفظ رسمتي'),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ColoringBoard(
              page: widget.page,
              canvasKey: _captureKey,
              onPaintedChanged: (painted) {
                if (mounted) setState(() => _painted = painted);
              },
            ),
          ),
          if (_message != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                child: Text(
                  _message!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
            ),
          const SafeArea(minimum: EdgeInsets.only(bottom: 4), child: SizedBox()),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز الرسمة للحفظ. حاول مرة أخرى.');
      return;
    }
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      final result = await widget.creationStore.saveFromBoundary(
        boundary: boundary,
        childId: widget.childId,
        gameId: 'coloring-${widget.page.id}',
        drawingMode: 'coloring',
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت في رسوماتي'
            : 'تعذر الحفظ. حاول مرة أخرى.';
      });
      // بلا رد نداء بعد الحفظ: `onSaved` لم يمرّره أي مستدعٍ لهذا المُضيف بعد
      // إزالة قسم صفحات التلوين المُصرَّف، والرسالة أعلاه هي تأكيد المستخدم.
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. حاول مرة أخرى.';
      });
    }
  }
}

/// Grid of colouring pages read from `assets/data/coloring_pages.json`.
///
/// Renders nothing when the list is empty, so the studio simply does not show the
/// section until a picture is added rather than showing an empty heading.
class _NoopReporter implements AttemptReporter {
  @override
  Future<void> report(GameAttempt attempt) async {}
}
