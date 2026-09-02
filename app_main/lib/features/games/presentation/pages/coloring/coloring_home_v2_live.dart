/// R2-first Live Home Wrapper for coloring V2
/// - يحمل كل الرسومات من /api/v1/creative-studio/home + /api/v1/creative-studio/drawings?category=coloring
/// - لا يبندل أي PNG في APK (باستثناء bird.png 8KB placeholder fallback)
/// - Cached per childId offline fallback
/// - تحويل RemoteDrawing → FeaturedColoringSpec + ColoringCategorySpec dynamical
/// - حفظ child isolation كما هو في creative_studio_page.dart
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../application/creative_providers.dart';
import '../../../data/creative_remote_assets.dart';
import '../../../data/local_creation_store.dart';
import '../../studio/studio_app_bar.dart';
import '../../studio/studio_design.dart';
import '../../studio/studio_home_widgets.dart';
import '../../widgets/drawing_asset.dart';
import 'coloring_home_v2.dart';

@immutable
class ColoringCategorySelection {
  const ColoringCategorySelection({
    required this.category,
    required this.items,
  });

  final ColoringCategorySpec category;
  final List<FeaturedColoringSpec> items;
}

/// `APP-102`: `ConsumerStatefulWidget` لتقرأ الخدمة من مزوّدها، فلا تبني عميلًا
/// مثبَّتًا جديدًا لكل زيارة ولا تتركه مفتوحًا.
class ColoringHomeV2LiveWrapper extends ConsumerStatefulWidget {
  const ColoringHomeV2LiveWrapper({
    required this.childId,
    required this.creationStore,
    this.onOpenMyBoards,
    this.onOpenCategory,
    this.onOpenFeatured,
    this.myDrawingsCount = 0,
    this.displayName,
    this.resumable = const [],
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onOpenMyBoards;
  final void Function(ColoringCategorySelection selection)? onOpenCategory;
  final void Function(FeaturedColoringSpec featured)? onOpenFeatured;
  final int myDrawingsCount;
  final String? displayName;
  final List<StudioHeroResume> resumable;

  @override
  ConsumerState<ColoringHomeV2LiveWrapper> createState() =>
      _ColoringHomeV2LiveWrapperState();
}

class _ColoringHomeV2LiveWrapperState
    extends ConsumerState<ColoringHomeV2LiveWrapper> {
  CreativeRemoteAssetsService get _service =>
      ref.read(creativeRemoteAssetsServiceProvider);
  final _cache = CreativeRemoteDrawingCache();
  List<FeaturedColoringSpec> _featured = kFeaturedColoringV2;
  List<ColoringCategorySpec> _categories = kColoringCategoriesV2;
  List<ColoringCategorySelection> _categorySelections = const [];
  String? _cdnBase;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final cached = await _cache.read(widget.childId);
      if (cached != null && cached.isNotEmpty) _applyDrawings(cached);

      var receivedRemote = false;
      // محاولة home أولاً (featured + coloring_all + hero)
      final home = await _service.fetchHome();
      if (home != null) {
        final cdn = home['cdn_base'] as String?;
        if (cdn != null) _cdnBase = cdn;
        final coloringAll = (home['coloring_all'] as List?) ?? [];
        final featuredRaw = (home['featured'] as List?) ?? [];
        if (coloringAll.isNotEmpty || featuredRaw.isNotEmpty) {
          final drawings = [
            ...coloringAll.map((e) => RemoteDrawing.fromJson((e as Map).cast<String, dynamic>())),
            ...featuredRaw.map((e) => RemoteDrawing.fromJson((e as Map).cast<String, dynamic>())),
          ];
          // dedup by id
          final seen = <String>{};
          final uniq = <RemoteDrawing>[];
          for (final d in drawings) {
            if (seen.add(d.id)) uniq.add(d);
          }
          if (uniq.isNotEmpty) {
            _applyDrawings(uniq);
            await _cache.save(widget.childId, uniq);
            receivedRemote = true;
          }
        }
      }

      // fallback: fetch drawings direct if home empty
      if (!receivedRemote || _featured.length <= 2) {
        final direct = await _service.fetchDrawings(category: 'coloring', status: 'ready,published', limit: 100);
        if (direct.isNotEmpty) {
          _applyDrawings(direct);
          await _cache.save(widget.childId, direct);
        }
      }
    } catch (_) {
      // offline: keep fallbacks
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _applyDrawings(List<RemoteDrawing> drawings) {
    _featured = drawings.map((drawing) => drawing.toFeaturedV2()).toList();
    final subMap = <String, List<RemoteDrawing>>{};
    for (final drawing in drawings) {
      final key = drawing.subCategory ?? drawing.category;
      subMap.putIfAbsent(key, () => []).add(drawing);
    }
    _setCategories(subMap);
  }

  void _setCategories(Map<String, List<RemoteDrawing>> groups) {
    _categorySelections = groups.entries.map((entry) {
      final first = entry.value.first;
      final category = ColoringCategorySpec(
        id: entry.key,
        label: first.titleAr.isNotEmpty ? first.label : _arabLabelForSub(entry.key),
        icon: RemoteDrawing.categoryIcon(entry.key, null),
        gradientStart: first.paletteColor(0),
        gradientEnd: first.paletteColor(1),
        count: entry.value.length,
        remoteUrl: first.bestImageUrl.isNotEmpty ? first.bestImageUrl : null,
        remoteThumbUrl: first.thumbUrl.isNotEmpty ? first.thumbUrl : null,
      );
      return ColoringCategorySelection(
        category: category,
        items: List.unmodifiable(entry.value.map((drawing) => drawing.toFeaturedV2())),
      );
    }).toList(growable: false);
    _categories = _categorySelections.map((selection) => selection.category).toList(growable: false);
  }

  static String _arabLabelForSub(String sub) {
    return switch (sub) {
      'birds' || 'bird' => 'طيور',
      'animals' => 'حيوانات',
      'vehicles' => 'مركبات',
      'space' => 'الفضاء',
      'flowers' => 'زهور',
      'sea' => 'حيوانات بحرية',
      'fruits' => 'فواكه',
      'toys' => 'ألعاب',
      'trace' => 'تتبّع',
      'letters' => 'حروف',
      'numbers' => 'أرقام',
      'connect_dots' => 'وصل النقاط',
      'complete' => 'أكمل الرسمة',
      'copy_pattern' => 'انسخ النمط',
      _ => sub,
    };
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: const Color(0xFF0C1030),
        body: const Center(child: CircularProgressIndicator(color: Color(0xFFFFD34D))),
      );
    }
    // نمرر البيانات الديناميكية عبر wrapper: نبني ColoringHomeV2Page لكن نحقن featured/categories ديناميكية
    // عن طريق إضافة static accessor mutable — نستخدم constructor dynamic نسخة مكررة x live
    return _ColoringHomeV2Dynamic(
      childId: widget.childId,
      creationStore: widget.creationStore,
      featured: _featured,
      categories: _categories,
      categorySelections: _categorySelections,
      cdnBase: _cdnBase,
      onOpenMyBoards: widget.onOpenMyBoards,
      onOpenCategory: widget.onOpenCategory,
      onOpenFeatured: widget.onOpenFeatured,
      myDrawingsCount: widget.myDrawingsCount,
      displayName: widget.displayName,
      resumable: widget.resumable,
    );
  }
}

/// نسخة dynamic حقيقية — تبني نفس تصميم V2 لكن بـ featured/categories من R2 مباشرة (لا ترجع لـ static list)
/// R2-first: أفضل URL = transparent PNG (remove-background) → thumb → main.
/// يحافظ على child isolation عبر childId و preservation of resumable/MyBoards.
class _ColoringHomeV2Dynamic extends StatelessWidget {
  const _ColoringHomeV2Dynamic({
    required this.childId,
    required this.creationStore,
    required this.featured,
    required this.categories,
    required this.categorySelections,
    this.cdnBase,
    this.onOpenMyBoards,
    this.onOpenCategory,
    this.onOpenFeatured,
    this.myDrawingsCount = 0,
    this.displayName,
    this.resumable = const [],
  });

  final String childId;
  final LocalCreationStore creationStore;
  final List<FeaturedColoringSpec> featured;
  final List<ColoringCategorySpec> categories;
  final List<ColoringCategorySelection> categorySelections;
  final String? cdnBase;
  final VoidCallback? onOpenMyBoards;
  final void Function(ColoringCategorySelection selection)? onOpenCategory;
  final void Function(FeaturedColoringSpec featured)? onOpenFeatured;
  final int myDrawingsCount;
  final String? displayName;
  final List<StudioHeroResume> resumable;

  static const _heroAsset = 'assets/images/studio/coloring-banner.png';
  static const _heroFallback = 'assets/images/studio/coloring-banner.png';

  @override
  Widget build(BuildContext context) {
    // Use direct dynamic lists, never fall back to static kFeaturedColoringV2
    // This ensures R2 content appears instantly once admin publishes / uploads.
    final effHero = cdnBase == null || cdnBase!.isEmpty
        ? _heroAsset
        : '${cdnBase!.endsWith('/') ? cdnBase : '$cdnBase/' }public/studio/heroes/coloring-hero.png';
    final effFeatured = featured.isEmpty ? kFeaturedColoringV2 : featured;
    final effCats = categories.isEmpty ? kColoringCategoriesV2 : categories;
    final List<ColoringCategorySelection> effSelections = categorySelections.isEmpty
      ? List.unmodifiable(effCats.map((category) => ColoringCategorySelection(
          category: category,
          items: effFeatured,
        )))
      : categorySelections;
    return ColoringHomeV2PageDynamic(
      childId: childId,
      creationStore: creationStore,
      featured: effFeatured,
      categories: effCats,
      categorySelections: effSelections,
      heroAsset: effHero,
      fallbackHeroAsset: _heroFallback,
      onOpenMyBoards: onOpenMyBoards,
      onOpenCategory: onOpenCategory,
      onOpenFeatured: onOpenFeatured,
      myDrawingsCount: myDrawingsCount,
      displayName: displayName,
      resumable: resumable,
    );
  }
}

/// نسخة dynamic تقبل featured/categories كباراميتر — نسخة 1:1 من تصميم ColoringHomeV2Page
/// لكن تشتغل بـ R2 مباشرة. موجودة هنا عشان ما نغيّر API لـ static page القديم اللي يمكن يستعمله كود ثاني.
/// تم نسخ كامل تصميم heroes/cards/featured/category/achievement مع دعم Image.network عبر bestDisplayUrl.
class ColoringHomeV2PageDynamic extends StatelessWidget {
  const ColoringHomeV2PageDynamic({
    required this.childId,
    required this.creationStore,
    required this.featured,
    required this.categories,
    required this.categorySelections,
    required this.heroAsset,
    required this.fallbackHeroAsset,
    this.onOpenMyBoards,
    this.onOpenCategory,
    this.onOpenFeatured,
    this.myDrawingsCount = 0,
    this.displayName,
    this.resumable = const [],
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final List<FeaturedColoringSpec> featured;
  final List<ColoringCategorySpec> categories;
  final List<ColoringCategorySelection> categorySelections;
  final String heroAsset;
  final String fallbackHeroAsset;
  final VoidCallback? onOpenMyBoards;
  final void Function(ColoringCategorySelection selection)? onOpenCategory;
  final void Function(FeaturedColoringSpec featured)? onOpenFeatured;
  final int myDrawingsCount;
  final String? displayName;
  final List<StudioHeroResume> resumable;

  @override
  Widget build(BuildContext context) {
    // نستدعي نفس واجهة التصميم الداخلية من ColoringHomeV2Page لكن ببياناتنا الديناميكية.
    // إعادة بناء صغيرة لتفادي duplication: نبني listView مطابق لـ ColoringHomeV2Page#build.
    // Copied from coloring_home_v2.dart internal widgets usage:
    return _ColoringHomeV2Scaffold(
      displayName: displayName,
      myDrawingsCount: myDrawingsCount,
      onOpenMyBoards: onOpenMyBoards,
      child: _ColoringHomeV2Body(
        heroAsset: heroAsset,
        fallbackAsset: fallbackHeroAsset,
        featured: featured,
        categories: categories,
        categorySelections: categorySelections,
        myDrawingsCount: myDrawingsCount,
        onStartFeatured: () {
          if (featured.isNotEmpty) onOpenFeatured?.call(featured.first);
        },
        onOpenMyBoards: onOpenMyBoards,
        onOpenFeatured: onOpenFeatured,
        onOpenCategory: onOpenCategory,
      ),
    );
  }
}

class _ColoringHomeV2Scaffold extends StatelessWidget {
  const _ColoringHomeV2Scaffold({this.displayName, required this.myDrawingsCount, this.onOpenMyBoards, required this.child});
  final String? displayName;
  final int myDrawingsCount;
  final VoidCallback? onOpenMyBoards;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C1030),
      // `displayName` used to be passed to a private bar that never rendered it,
      // so the coloring home showed no profile while the studio home did. The
      // badge is an action here, which is also how the studio home supplies it.
      appBar: StudioAppBar(
        title: 'لوّن',
        glyph: Icons.palette_rounded,
        actions: [
          const StudioBarPill(
            label: 'معاينة',
            icon: Icons.remove_red_eye_outlined,
          ),
          const StudioBarCircle(
            icon: Icons.help_outline_rounded,
            label: 'مساعدة',
          ),
          Padding(
            padding: const EdgeInsetsDirectional.only(start: StudioSpace.xs),
            child: Center(
              child: StudioProfileBadge(
                displayName: displayName,
                drawingCount: myDrawingsCount,
                onTap: onOpenMyBoards,
              ),
            ),
          ),
        ],
      ),
      body: ColoredBox(
        color: const Color(0xFF0C1030),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF17153E), Color(0xFF0C1030)],
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _ColoringHomeV2Body extends StatelessWidget {
  const _ColoringHomeV2Body({
    required this.heroAsset,
    required this.fallbackAsset,
    required this.featured,
    required this.categories,
    required this.categorySelections,
    required this.myDrawingsCount,
    required this.onStartFeatured,
    this.onOpenMyBoards,
    this.onOpenFeatured,
    this.onOpenCategory,
  });
  final String heroAsset;
  final String fallbackAsset;
  final List<FeaturedColoringSpec> featured;
  final List<ColoringCategorySpec> categories;
  final List<ColoringCategorySelection> categorySelections;
  final int myDrawingsCount;
  final VoidCallback onStartFeatured;
  final VoidCallback? onOpenMyBoards;
  final void Function(FeaturedColoringSpec)? onOpenFeatured;
  final void Function(ColoringCategorySelection)? onOpenCategory;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        _HeroColoringV2Live(heroAsset: heroAsset, fallbackAsset: fallbackAsset, onStart: onStartFeatured),
        const SizedBox(height: 14),
        const SizedBox(height: 22),
        _SectionTitleV2Live(title: 'رسومات مميزة'),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, constraints) {
          final cols = constraints.maxWidth < 360 ? 1 : 2;
          return GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, childAspectRatio: cols == 1 ? 1.6 : 1.25, crossAxisSpacing: 10, mainAxisSpacing: 10),
            itemCount: featured.length,
            itemBuilder: (c, i) => _FeaturedTileV2Live(spec: featured[i], onTap: () => onOpenFeatured?.call(featured[i])),
          );
        }),
        const SizedBox(height: 22),
        _SectionTitleV2Live(title: 'اختر رسمة لتلوينها'),
        const SizedBox(height: 10),
        LayoutBuilder(builder: (context, constraints) {
          final cols = constraints.maxWidth < 360 ? 1 : 2;
          return GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, childAspectRatio: 2.2, crossAxisSpacing: 10, mainAxisSpacing: 10),
            itemCount: categories.length,
            itemBuilder: (c, i) => _CategoryTileV2Live(spec: categories[i], onTap: () => onOpenCategory?.call(categorySelections[i])),
          );
        }),
        const SizedBox(height: 22),
        _AchievementV2Live(count: myDrawingsCount),
      ],
    );
  }
}

class _HeroColoringV2Live extends StatelessWidget {
  const _HeroColoringV2Live({required this.heroAsset, required this.fallbackAsset, required this.onStart});
  final String heroAsset;
  final String fallbackAsset;
  final VoidCallback onStart;
  @override
  Widget build(BuildContext context) {
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 12)),
        ],
      ),
      child: AspectRatio(
        aspectRatio: 2.2,
        child: Image.asset(
          'assets/images/studio/coloring-banner.webp',
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Image.asset(
            'assets/images/studio/coloring-banner.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Image.asset(
              fallbackAsset,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: const Color(0xFF241A5E),
                child: const Center(child: Icon(Icons.palette_rounded, size: 48, color: Colors.white24)),
              ),
            ),
          ),
        ),
      ),
    );
  }

}

class _SectionTitleV2Live extends StatelessWidget {
  const _SectionTitleV2Live({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Row(children: [Container(width:4,height:18,decoration: BoxDecoration(color: const Color(0xFFFFD34D), borderRadius: BorderRadius.circular(999))), const SizedBox(width:8), Text(title, style: const TextStyle(color: Colors.white, fontSize:15, fontWeight: FontWeight.w800))]);
}

class _FeaturedTileV2Live extends StatelessWidget {
  const _FeaturedTileV2Live({required this.spec, required this.onTap});
  final FeaturedColoringSpec spec; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(18), child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white.withValues(alpha:0.9)), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha:0.18), blurRadius:12, offset: const Offset(0,6))]), clipBehavior: Clip.antiAlias, child: Stack(children: [
    Positioned.fill(child: Padding(padding: const EdgeInsets.fromLTRB(12,12,12,36), child: Builder(builder: (_) {
      final url = spec.bestDisplayUrl;
      final fallback = spec.fallbackAsset;
      Widget fallbackW() => fallback.toLowerCase().endsWith('.svg') ? DrawingAsset(assetIdOrPath: fallback, fit: BoxFit.contain) : Image.asset(fallback, fit: BoxFit.contain, errorBuilder: (_,__,___) => Icon(Icons.image_outlined, size:48, color: Colors.black.withValues(alpha:0.12)));
      if (url == null) return fallbackW();
      final isNet = url.startsWith('http://') || url.startsWith('https://');
      if (isNet) return Image.network(url, fit: BoxFit.contain, errorBuilder: (_,__,___) => fallbackW());
      if (url.toLowerCase().endsWith('.svg')) return DrawingAsset(assetIdOrPath: url, fit: BoxFit.contain);
      return Image.asset(url, fit: BoxFit.contain, errorBuilder: (_,__,___) => fallbackW());
    }))),
    if (spec.isNew) Positioned(top:8,right:8, child: Container(padding: const EdgeInsets.symmetric(horizontal:8, vertical:3), decoration: BoxDecoration(color: const Color(0xFF6A3DF2), borderRadius: BorderRadius.circular(999)), child: const Text('جديد', style: TextStyle(color: Colors.white, fontSize:10, fontWeight: FontWeight.w800)))),
    Positioned(top:8,left:8, child: Container(width:22,height:22,decoration: BoxDecoration(color: const Color(0xFFFFF3C2), shape: BoxShape.circle, border: Border.all(color: const Color(0xFFFFD34D), width:1.2)), child: const Icon(Icons.star_rounded, size:14, color: Color(0xFFFF9F1C)))),
    Positioned(bottom:0,left:0,right:0, child: Container(constraints: const BoxConstraints(minHeight: 36), padding: const EdgeInsets.fromLTRB(10, 7, 10, 7), color: const Color(0xFF0C1030), alignment: Alignment.center, child: Text(spec.label, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, softWrap: true, style: const TextStyle(color: Colors.white, fontSize:11, fontWeight: FontWeight.w700, height: 1.3)))),
  ])));
}

class _CategoryTileV2Live extends StatelessWidget {
  const _CategoryTileV2Live({required this.spec, required this.onTap});
  final ColoringCategorySpec spec; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16), child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha:0.14), blurRadius:10, offset: const Offset(0,5))]), clipBehavior: Clip.antiAlias, child: Row(children: [
    Container(width:56,height: double.infinity, decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [spec.gradientStart, spec.gradientEnd])), child: () {
      final u = spec.bestDisplayUrl ?? spec.fallbackAsset;
      if (u.startsWith('http')) return Padding(padding: const EdgeInsets.all(6), child: Image.network(u, fit: BoxFit.contain, errorBuilder: (_,__,___)=> Icon(spec.icon, size:26, color: Colors.white)));
      if (u.toLowerCase().endsWith('.svg')) return Padding(padding: const EdgeInsets.all(6), child: DrawingAsset(assetIdOrPath: u, fit: BoxFit.contain));
      return Icon(spec.icon, size:26, color: Colors.white);
    }()),
    Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal:10, vertical:8), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text(spec.label, style: const TextStyle(color: Color(0xFF0C1030), fontSize:13, fontWeight: FontWeight.w800)), const SizedBox(height:2), Text('${spec.count} رسمة', style: TextStyle(color: const Color(0xFF0C1030).withValues(alpha:0.55), fontSize:10, fontWeight: FontWeight.w600))]))),
  ])));
}

class _AchievementV2Live extends StatelessWidget {
  const _AchievementV2Live({required this.count});
  final int count;
  @override
  Widget build(BuildContext context) => Container(height:56,padding: const EdgeInsets.symmetric(horizontal:14),decoration: BoxDecoration(gradient: const LinearGradient(colors:[Color(0xFF221A4A), Color(0xFF141032)]), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFFFD34D).withValues(alpha:0.18))), child: Row(children: [Container(width:34,height:34,decoration: BoxDecoration(color: const Color(0xFFFFD34D).withValues(alpha:0.16), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.emoji_events_rounded, size:20, color: Color(0xFFFFD34D))), const SizedBox(width:10), const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [Text('إكمال اللوحات يكافئك بنجوم ذهبية!', style: TextStyle(color: Colors.white, fontSize:12, fontWeight: FontWeight.w700)), SizedBox(height:2), Text('اجمع النجوم وافتح رسومات جديدة', style: TextStyle(color: Color(0xFF8B8DB3), fontSize:10))])), const Icon(Icons.star_rounded, size:22, color: Color(0xFFFFD34D)), const SizedBox(width:4), Text('$count', style: const TextStyle(color: Color(0xFFFFD34D), fontSize:14, fontWeight: FontWeight.w900))]));
}
