/// Draw Like Me — R2-first Live Catalogue
/// يحمل كل الرسومات المرجعية الملونة من /api/v1/creative-studio/drawings?category=draw_like_me
/// - يستخدم CreativeRemoteAssetsService
/// - يحول RemoteDrawing → ReferenceActivity (مع remoteUrl كـ assetIdOrPath حيث DrawingAsset يدعم http)
/// - Fallback محلي 6 صور من assets/images/draw_like_me/v2/ في حال offline
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/creative_providers.dart';
import '../../data/creative_remote_assets.dart';
import '../../data/local_creation_store.dart';
import '../studio/studio_app_bar.dart';
import '../studio/studio_design.dart';
import '../widgets/drawing_asset.dart';
import 'reference_catalogue_page.dart';
import 'reference_drawing_page.dart';

class ReferenceCataloguePageLiveWrapper extends ConsumerStatefulWidget {
  const ReferenceCataloguePageLiveWrapper({
    required this.childId,
    required this.creationStore,
    this.onSaved,
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  @override
  ConsumerState<ReferenceCataloguePageLiveWrapper> createState() =>
      _ReferenceCataloguePageLiveWrapperState();
}

class _ReferenceCataloguePageLiveWrapperState
    extends ConsumerState<ReferenceCataloguePageLiveWrapper> {
  // `APP-102`: من المزوّد لا `CreativeRemoteAssetsService()` هنا — كل نسخة كانت
  // تبني عميلًا مثبَّتًا جديدًا لا يُغلَق أبدًا.
  CreativeRemoteAssetsService get _service =>
      ref.read(creativeRemoteAssetsServiceProvider);
  List<ReferenceActivity> _activities = const [];
  bool _loading = true;
  String? _cdnBase;

  static const _fallbackLocal = <ReferenceActivity>[
    ReferenceActivity(
        id: 'ref-animal-01',
        titleAr: 'عصفور على فرع',
        titleEn: 'Bird on Branch',
        category: 'حيوانات',
        ageLabel: '4-6',
        difficulty: 'سهل',
        referenceAssetId: 'assets/images/draw_like_me/v2-final/animal-01-bird-branch.png',
        thumbnailAssetId: 'assets/images/draw_like_me/v2-final/animal-01-bird-branch.png',
        bg: Color(0xFF0B1220)),
    ReferenceActivity(
        id: 'ref-animal-04',
        titleAr: 'قطة صغيرة',
        titleEn: 'Small Kitten',
        category: 'حيوانات',
        ageLabel: '4-6',
        difficulty: 'سهل',
        referenceAssetId: 'assets/images/draw_like_me/v2-final/animal-04-kitten-small.png',
        thumbnailAssetId: 'assets/images/draw_like_me/v2-final/animal-04-kitten-small.png',
        bg: Color(0xFF0B1220)),
    ReferenceActivity(
        id: 'ref-animal-09',
        titleAr: 'سلحفاة بحرية',
        titleEn: 'Sea Turtle',
        category: 'حيوانات',
        ageLabel: '6-8',
        difficulty: 'متوسط',
        referenceAssetId: 'assets/images/draw_like_me/v2-final/animal-09-turtle-sea.png',
        thumbnailAssetId: 'assets/images/draw_like_me/v2-final/animal-09-turtle-sea.png',
        bg: Color(0xFF14532D)),
    ReferenceActivity(
        id: 'ref-space-11',
        titleAr: 'صاروخ',
        titleEn: 'Rocket',
        category: 'فضاء',
        ageLabel: '4-6',
        difficulty: 'سهل',
        referenceAssetId: 'assets/images/draw_like_me/v2-final/space-11-rocket.png',
        thumbnailAssetId: 'assets/images/draw_like_me/v2-final/space-11-rocket.png',
        bg: Color(0xFF1A0B2E)),
    ReferenceActivity(
        id: 'ref-nature-21',
        titleAr: 'فراشة',
        titleEn: 'Butterfly',
        category: 'طبيعة',
        ageLabel: '4-6',
        difficulty: 'سهل',
        referenceAssetId: 'assets/images/draw_like_me/v2-final/nature-21-butterfly.png',
        thumbnailAssetId: 'assets/images/draw_like_me/v2-final/nature-21-butterfly.png',
        bg: Color(0xFF831843)),
    ReferenceActivity(
        id: 'ref-vehicle-27',
        titleAr: 'سيارة صغيرة',
        titleEn: 'Small Car',
        category: 'مركبات',
        ageLabel: '4-6',
        difficulty: 'سهل',
        referenceAssetId: 'assets/images/draw_like_me/v2-final/vehicle-27-car-small.png',
        thumbnailAssetId: 'assets/images/draw_like_me/v2-final/vehicle-27-car-small.png',
        bg: Color(0xFF1D4ED8)),
  ];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      // Always try full list (50) from dedicated endpoint, home only returns 20
      List<RemoteDrawing> drawings = const [];
      try {
        final home = await _service.fetchHome();
        if (home != null) {
          final cdn = home['cdn_base'] as String?;
          if (cdn != null) _cdnBase = cdn;
        }
      } catch (_) {}
      drawings = await _service.fetchDrawings(
          category: 'draw_like_me', status: 'ready,published', limit: 100);
      if (drawings.isNotEmpty) {
        // صف الهيرو مخزّن بنفس التصنيف — يُستبعد من شبكة الرسومات القابلة للتقليد.
        final acts = drawings
            .where((d) => !d.id.toLowerCase().contains('hero'))
            .map(_toActivity)
            .toList();
        if (mounted) {
          setState(() {
            _activities = acts;
            _loading = false;
          });
          return;
        }
      }
    } catch (_) {}
    if (mounted) {
      setState(() {
        _activities = _fallbackLocal;
        _loading = false;
      });
    }
  }

  ReferenceActivity _toActivity(RemoteDrawing r) {
    // استنتاج الفئة من tags أو العنوان
    String cat = 'حيوانات';
    final tags = '${r.titleAr} ${r.status}'.toLowerCase();
    final rawTags = (r.extra?['tags']?.toString() ?? '').toLowerCase();
    final combined = '$tags $rawTags ${r.id}'.toLowerCase();
    if (combined.contains('فضاء') ||
        combined.contains('نجم') ||
        combined.contains('space') ||
        combined.contains('rocket') ||
        combined.contains('star') ||
        combined.contains('قمر') ||
        combined.contains('كوكب') ||
        combined.contains('رائد') ||
        combined.contains('محطة')) {
      cat = 'فضاء';
    } else if (combined.contains('مركب') ||
        combined.contains('سيار') ||
        combined.contains('vehicle') ||
        combined.contains('car') ||
        combined.contains('قارب') ||
        combined.contains('طائرة') ||
        combined.contains('قطار') ||
        combined.contains('حافلة') ||
        combined.contains('غواصة') ||
        combined.contains('حفار') ||
        combined.contains('اطفاء')) {
      cat = 'مركبات';
    } else if (combined.contains('طبيع') ||
        combined.contains('زهر') ||
        combined.contains('شجر') ||
        combined.contains('فراشة') ||
        combined.contains('فطر') ||
        combined.contains('جبال') ||
        combined.contains('شلال') ||
        combined.contains('حديقة') ||
        combined.contains('flowers')) {
      cat = 'طبيعة';
    } else if (combined.contains('بيت') ||
        combined.contains('منزل') ||
        combined.contains('عصير') ||
        combined.contains('كيك') ||
        combined.contains('حقيبة') ||
        combined.contains('دمية') ||
        combined.contains('غرفة') ||
        combined.contains('فطور') ||
        combined.contains('مكتب') ||
        combined.contains('ملعب')) {
      cat = 'بيت';
    } else if (combined.contains('زخرف') ||
        combined.contains('مسجد') ||
        combined.contains('خيال') ||
        combined.contains('وحيد') ||
        combined.contains('تنين') ||
        combined.contains('قلعة') ||
        combined.contains('روبوت') ||
        combined.contains('قراصنة') ||
        combined.contains('سحاب') ||
        combined.contains('جزيرة') ||
        combined.contains('مغامر')) {
      cat = 'زخارف';
    }

    String ageLabel = '${r.ageMin}-${r.ageMax}';
    if (ageLabel == '3-12') ageLabel = '4-6';

    final bestUrl = r.bestImageUrl;
    final thumb = r.thumbUrl.isNotEmpty ? r.thumbUrl : bestUrl;
    // DrawingAsset يدعم http مباشرة، نمرر bestUrl كـ assetIdOrPath
    final refAsset = bestUrl.isNotEmpty ? bestUrl : _fallbackPathForId(r.id);
    final thumbAsset = thumb.isNotEmpty ? thumb : refAsset;

    return ReferenceActivity(
      id: r.id,
      titleAr: r.titleAr.isNotEmpty ? r.titleAr : r.id,
      titleEn: r.titleEn ?? r.id,
      category: cat,
      ageLabel: ageLabel,
      difficulty: r.difficulty,
      referenceAssetId: refAsset,
      thumbnailAssetId: thumbAsset,
      bg: _bgForCategory(cat),
    );
  }

  Color _bgForCategory(String c) => switch (c) {
        'حيوانات' => const Color(0xFF0B1220),
        'فضاء' => const Color(0xFF1A0B2E),
        'طبيعة' => const Color(0xFF14532D),
        'مركبات' => const Color(0xFF1D4ED8),
        'بيت' => const Color(0xFF7C3AED),
        'زخارف' => const Color(0xFF7C2D12),
        _ => const Color(0xFF0F172A),
      };

  static String _fallbackPathForId(String id) {
    final lower = id.toLowerCase();
    // v2-final premium fallback - check existence of pattern
    if (lower.contains('bird')) return 'assets/images/draw_like_me/v2-final/animal-01-bird-branch.png';
    if (lower.contains('fish')) return 'assets/images/draw_like_me/v2-final/animal-02-fish-colorful.png';
    if (lower.contains('rabbit')) return 'assets/images/draw_like_me/v2-final/animal-03-rabbit-carrot.png';
    if (lower.contains('cat') || lower.contains('kitten')) return 'assets/images/draw_like_me/v2-final/animal-04-kitten-small.png';
    if (lower.contains('penguin')) return 'assets/images/draw_like_me/v2-final/animal-05-penguin-baby.png';
    if (lower.contains('panda')) return 'assets/images/draw_like_me/v2-final/animal-06-panda-bamboo.png';
    if (lower.contains('lion')) return 'assets/images/draw_like_me/v2-final/animal-07-lion-baby.png';
    if (lower.contains('giraffe')) return 'assets/images/draw_like_me/v2-final/animal-08-giraffe-young.png';
    if (lower.contains('turtle')) return 'assets/images/draw_like_me/v2-final/animal-09-turtle-sea.png';
    if (lower.contains('fox')) return 'assets/images/draw_like_me/v2-final/animal-10-fox-forest.png';
    if (lower.contains('rocket')) return 'assets/images/draw_like_me/v2-final/space-11-rocket.png';
    if (lower.contains('planet-rings') || lower.contains('rings')) return 'assets/images/draw_like_me/v2-final/space-12-planet-rings.png';
    if (lower.contains('moon')) return 'assets/images/draw_like_me/v2-final/space-13-moon-smiling.png';
    if (lower.contains('astronaut')) return 'assets/images/draw_like_me/v2-final/space-14-astronaut-small.png';
    if (lower.contains('saucer')) return 'assets/images/draw_like_me/v2-final/space-15-saucer.png';
    if (lower.contains('rover') || lower.contains('lunar')) return 'assets/images/draw_like_me/v2-final/space-16-lunar-rover.png';
    if (lower.contains('alien')) return 'assets/images/draw_like_me/v2-final/space-17-alien-planet.png';
    if (lower.contains('station')) return 'assets/images/draw_like_me/v2-final/space-18-station.png';
    if (lower.contains('flower-large')) return 'assets/images/draw_like_me/v2-final/nature-19-flower-large.png';
    if (lower.contains('apple-tree')) return 'assets/images/draw_like_me/v2-final/nature-20-apple-tree.png';
    if (lower.contains('butterfly')) return 'assets/images/draw_like_me/v2-final/nature-21-butterfly.png';
    if (lower.contains('mushroom')) return 'assets/images/draw_like_me/v2-final/nature-22-mushroom-cute.png';
    if (lower.contains('cottage')) return 'assets/images/draw_like_me/v2-final/nature-23-cottage-nature.png';
    if (lower.contains('mountains')) return 'assets/images/draw_like_me/v2-final/nature-24-mountains-view.png';
    if (lower.contains('waterfall')) return 'assets/images/draw_like_me/v2-final/nature-25-waterfall.png';
    if (lower.contains('garden')) return 'assets/images/draw_like_me/v2-final/nature-26-garden-flowers.png';
    if (lower.contains('car-small')) return 'assets/images/draw_like_me/v2-final/vehicle-27-car-small.png';
    if (lower.contains('bus')) return 'assets/images/draw_like_me/v2-final/vehicle-28-bus-school.png';
    if (lower.contains('sailboat')) return 'assets/images/draw_like_me/v2-final/vehicle-29-sailboat.png';
    if (lower.contains('airplane')) return 'assets/images/draw_like_me/v2-final/vehicle-30-airplane.png';
    if (lower.contains('train')) return 'assets/images/draw_like_me/v2-final/vehicle-31-train.png';
    if (lower.contains('fire-truck')) return 'assets/images/draw_like_me/v2-final/vehicle-32-fire-truck.png';
    if (lower.contains('excavator')) return 'assets/images/draw_like_me/v2-final/vehicle-33-excavator.png';
    if (lower.contains('submarine')) return 'assets/images/draw_like_me/v2-final/vehicle-34-submarine.png';
    if (lower.contains('juice')) return 'assets/images/draw_like_me/v2-final/everyday-35-juice-cup.png';
    if (lower.contains('cupcake')) return 'assets/images/draw_like_me/v2-final/everyday-36-cupcake.png';
    if (lower.contains('backpack')) return 'assets/images/draw_like_me/v2-final/everyday-37-backpack.png';
    if (lower.contains('teddy')) return 'assets/images/draw_like_me/v2-final/everyday-38-teddy-bear.png';
    if (lower.contains('kids-room')) return 'assets/images/draw_like_me/v2-final/everyday-39-kids-room.png';
    if (lower.contains('breakfast')) return 'assets/images/draw_like_me/v2-final/everyday-40-breakfast-simple.png';
    if (lower.contains('art-desk')) return 'assets/images/draw_like_me/v2-final/everyday-41-art-desk.png';
    if (lower.contains('playground')) return 'assets/images/draw_like_me/v2-final/everyday-42-playground.png';
    if (lower.contains('unicorn')) return 'assets/images/draw_like_me/v2-final/fantasy-43-unicorn.png';
    if (lower.contains('dragon')) return 'assets/images/draw_like_me/v2-final/fantasy-44-dragon-baby.png';
    if (lower.contains('castle')) return 'assets/images/draw_like_me/v2-final/fantasy-45-castle-small.png';
    if (lower.contains('robot')) return 'assets/images/draw_like_me/v2-final/fantasy-46-robot-cute.png';
    if (lower.contains('pirate')) return 'assets/images/draw_like_me/v2-final/fantasy-47-pirate-ship.png';
    if (lower.contains('house-cloud')) return 'assets/images/draw_like_me/v2-final/fantasy-48-house-cloud.png';
    if (lower.contains('island')) return 'assets/images/draw_like_me/v2-final/fantasy-49-island-floating.png';
    if (lower.contains('explorer')) return 'assets/images/draw_like_me/v2-final/fantasy-50-explorer-planet.png';
    return 'assets/images/draw_like_me/v2-final/animal-01-bird-branch.png';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: StudioSurfaces.bar,
        appBar: const StudioAppBar(
          title: 'ارسم مثلي',
          glyph: Icons.brush_rounded,
        ),
        body: const Center(
            child: CircularProgressIndicator(color: Color(0xFFFFD34D))),
      );
    }
    return _ReferenceCatalogueLive(
      childId: widget.childId,
      creationStore: widget.creationStore,
      activities: _activities,
      onSaved: widget.onSaved,
      cdnBase: _cdnBase,
    );
  }
}

/// نسخة ديناميكية من _buildPremium تستخدم _activities من R2
class _ReferenceCatalogueLive extends StatefulWidget {
  const _ReferenceCatalogueLive({
    required this.childId,
    required this.creationStore,
    required this.activities,
    this.onSaved,
    this.cdnBase,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final List<ReferenceActivity> activities;
  final VoidCallback? onSaved;
  final String? cdnBase;

  @override
  State<_ReferenceCatalogueLive> createState() =>
      _ReferenceCatalogueLiveState();
}

class _ReferenceCatalogueLiveState extends State<_ReferenceCatalogueLive> {
  String _filterCategory = 'الكل';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.activities.where((a) {
      if (_filterCategory != 'الكل' && a.category != _filterCategory) return false;
      return true;
    }).toList(growable: false);

    final resumeItems = widget.activities.length >= 2
        ? [
            _ResumeData(
                activity: widget.activities[0], progress: 0.3, label: 'آخر رسم: أمس'),
            _ResumeData(
                activity: widget.activities[1], progress: 0.6, label: 'آخر رسم: اليوم'),
          ]
        : <_ResumeData>[];

    return Scaffold(
      backgroundColor: StudioSurfaces.bar,
      appBar: const StudioAppBar(
        title: 'ارسم مثلي',
        glyph: Icons.brush_rounded,
        showStar: true,
        actions: [
          StudioBarCircle(icon: Icons.help_outline_rounded, label: 'مساعدة'),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF05081A), Color(0xFF080C2A)]),
        ),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _heroBanner(context)),
            SliverToBoxAdapter(child: _filterChips(context)),
            if (resumeItems.isNotEmpty)
              SliverToBoxAdapter(child: _resumeSection(context, resumeItems)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                child: Row(
                  children: [
                    const Icon(Icons.auto_awesome_rounded,
                        color: Color(0xFFFFD34D), size: 18),
                    const SizedBox(width: 6),
                    Text('اختر رسمة لتقلدها',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 15)),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
              sliver: filtered.isEmpty
                  ? SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            const Icon(Icons.filter_alt_off_outlined,
                                size: 48, color: Colors.white24),
                            const SizedBox(height: 8),
                            const Text('لا توجد أنشطة بهذه الفلاتر',
                                style: TextStyle(color: Colors.white70)),
                            const SizedBox(height: 12),
                            FilledButton.tonalIcon(
                              onPressed: () => setState(() => _filterCategory = 'الكل'),
                              icon: const Icon(Icons.restart_alt),
                              label: const Text('مسح الفلاتر'),
                            ),
                          ],
                        ),
                      ),
                    )
                  : SliverGrid(
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        childAspectRatio: 0.78,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                      ),
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) {
                          final act = filtered[i];
                          return _drawCard(context, act);
                        },
                        childCount: filtered.length,
                      ),
                    ),
            ),
            SliverToBoxAdapter(child: _tipBanner(context)),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  /// بنر الهيرو — تصميم كامل داخل الصورة نفسها، بدون أي نص فوقها أو جوارها.
  Widget _heroBanner(BuildContext context) {
    final base = widget.cdnBase;
    final heroUrl = base != null
        ? '${base.endsWith('/') ? base : '$base/'}public/studio/heroes/draw-like-me-hero.webp?v=3'
        : 'assets/images/draw_like_me/heroes/draw-like-me-hero.webp';
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Semantics(
        label: 'ارسم مثلي',
        image: true,
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
                color: const Color(0xFF7A4DFF).withValues(alpha: 0.55),
                width: 1.2),
            boxShadow: [
              BoxShadow(
                  color: const Color(0xFF6A3DF2).withValues(alpha: 0.28),
                  blurRadius: 18,
                  offset: const Offset(0, 8))
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: AspectRatio(
              aspectRatio: 16 / 9,
              child: DrawingAsset(
                assetIdOrPath: heroUrl,
                fit: BoxFit.cover,
                fallbackIsShrink: false,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _filterChips(BuildContext context) {
    final cats = [
      ('الكل', Icons.auto_awesome_rounded),
      ('حيوانات', Icons.pets_rounded),
      ('فضاء', Icons.public_rounded),
      ('طبيعة', Icons.eco_rounded),
      ('مركبات', Icons.directions_car_rounded),
      ('بيت', Icons.home_rounded),
      ('زخارف', Icons.auto_fix_high_rounded),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: cats.map((e) {
            final label = e.$1;
            final icon = e.$2;
            final selected = _filterCategory == label;
            return Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: InkWell(
                onTap: () => setState(() => _filterCategory = label),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? const Color(0xFF6A3DF2) : const Color(0xFF0F1433),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                        color: selected
                            ? const Color(0xFF9D68FF)
                            : const Color(0xFF1E2A6A),
                        width: selected ? 1.4 : 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon,
                          size: 16,
                          color: selected ? Colors.white : const Color(0xFF7EA0FF)),
                      const SizedBox(width: 6),
                      Text(label,
                          style: TextStyle(
                              color: selected ? Colors.white : const Color(0xFFDCE2FF),
                              fontWeight: FontWeight.w800,
                              fontSize: 12)),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _resumeSection(BuildContext context, List<_ResumeData> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Row(
            children: [
              Text('ابدأ من حيث توقفت',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
              const SizedBox(width: 6),
              const Icon(Icons.schedule_rounded, size: 16, color: Color(0xFF9D68FF)),
            ],
          ),
        ),
        SizedBox(
          height: 92,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(width: 10),
            itemBuilder: (ctx, i) {
              final r = items[i];
              return _resumeCard(context, r);
            },
          ),
        ),
      ],
    );
  }

  Widget _resumeCard(BuildContext context, _ResumeData r) {
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ReferenceDrawingPage(
              childId: widget.childId,
              activity: r.activity,
              creationStore: widget.creationStore,
              onSaved: widget.onSaved))),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: 240,
        decoration: BoxDecoration(
          color: const Color(0xFF0F1433),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF1E2A6A)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white10)),
                clipBehavior: Clip.antiAlias,
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: DrawingAsset(
                      assetIdOrPath: r.activity.thumbnailAssetId, fit: BoxFit.contain),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(r.activity.titleAr,
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                    const SizedBox(height: 2),
                    Text(r.label,
                        style: const TextStyle(
                            color: Color(0xFF9FA3C0), fontSize: 10, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: r.progress,
                        minHeight: 6,
                        backgroundColor: Colors.white10,
                        valueColor: const AlwaysStoppedAnimation(Color(0xFF9D68FF)),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _drawCard(BuildContext context, ReferenceActivity act) {
    final isHard = act.difficulty.contains('متوسط') || act.difficulty.contains('مفصل');
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ReferenceDrawingPage(
              childId: widget.childId,
              activity: act,
              creationStore: widget.creationStore,
              onSaved: widget.onSaved))),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0F1433),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF1E2A6A)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Container(
                color: Colors.white,
                child: Padding(
                  padding: const EdgeInsets.all(10),
                  child: DrawingAsset(
                      assetIdOrPath: act.thumbnailAssetId, fit: BoxFit.contain),
                ),
              ),
            ),
            Container(
              color: const Color(0xFF0F1433),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
              child: Row(
                children: [
                  Expanded(
                      child: Text(act.titleAr,
                          style: const TextStyle(
                              color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                        color: isHard ? const Color(0xFF2A2E6A) : const Color(0xFF16A34A),
                        borderRadius: BorderRadius.circular(999)),
                    child: Text(isHard ? 'متوسط' : 'سهل',
                        style: const TextStyle(
                            color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tipBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
            begin: Alignment.topRight,
            end: Alignment.bottomLeft,
            colors: [Color(0xFF2A1558), Color(0xFF1A0B3E)]),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFFD34D).withValues(alpha: 0.35)),
      ),
      child: const Row(
        children: [
          Icon(Icons.lightbulb_rounded, color: Color(0xFFFFD34D), size: 18),
          SizedBox(width: 10),
          Expanded(
              child: Text('تذكّر: راقب الشكل، الألوان والتفاصيل ثم ارسم!',
                  style: TextStyle(
                      color: Color(0xFFFFD34D), fontWeight: FontWeight.w800, fontSize: 11))),
        ],
      ),
    );
  }
}

class _ResumeData {
  const _ResumeData(
      {required this.activity, required this.progress, required this.label});
  final ReferenceActivity activity;
  final double progress;
  final String label;
}
