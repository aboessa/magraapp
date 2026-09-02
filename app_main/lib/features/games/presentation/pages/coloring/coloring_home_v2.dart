/// صفحة "لوّن" الرئيسية — مطابقة 100% للتصميم في الصورة 1
///
/// الهوية: #0C1030 deepSpace، Hero بنفسجي-أزرق مع ولد يرسم،
/// كروت لوحات التلوين/لوحاتي، رسومات مميزة 4 + فئات 8 عمودين،
/// شريط إنجاز ذهبي.
///
/// هذه الصفحة تحل محل _StudioCategoryPage القديمة لفئة coloring فقط.
library;

import 'package:flutter/material.dart';

import '../../../../../app/theme/app_colors.dart';
import '../../../data/local_creation_store.dart';
import '../../studio/studio_app_bar.dart';
import '../../studio/studio_design.dart';
import '../../studio/studio_home_widgets.dart';

/// بيانات فئة تلوين واحدة — PNG فقط من assets/images/coloring/v2
@immutable
class ColoringCategorySpec {
  const ColoringCategorySpec({
    required this.id,
    required this.label,
    required this.icon,
    required this.gradientStart,
    required this.gradientEnd,
    this.assetPath,
    this.count = 12,
    this.remoteUrl,
    this.remoteThumbUrl,
  });

  final String id;
  final String label;
  final IconData icon;
  final Color gradientStart;
  final Color gradientEnd;
  final String? assetPath;
  final int count;
  final String? remoteUrl;
  final String? remoteThumbUrl;

  String? get bestDisplayUrl {
    if (remoteThumbUrl != null && remoteThumbUrl!.trim().isNotEmpty) return remoteThumbUrl;
    if (remoteUrl != null && remoteUrl!.trim().isNotEmpty) return remoteUrl;
    if (assetPath != null && assetPath!.trim().isNotEmpty) return assetPath;
    return null;
  }

  String get fallbackAsset => _pngFallbackForId(id);
}

/// رسمة مميزة — PNG فقط من assets/images/coloring/v2
@immutable
class FeaturedColoringSpec {
  const FeaturedColoringSpec({
    required this.id,
    required this.label,
    required this.isNew,
    this.assetPath,
    this.remoteUrl,
    this.thumbUrl,
    this.ageMin = 3,
    this.ageMax = 12,
    this.difficulty = 'easy',
  });

  final String id;
  final String label;
  final bool isNew;
  final String? assetPath;
  final String? remoteUrl;
  final String? thumbUrl;
  final int ageMin;
  final int ageMax;
  final String difficulty;

  String? get bestDisplayUrl {
    if (remoteUrl != null && remoteUrl!.trim().isNotEmpty) return remoteUrl;
    if (thumbUrl != null && thumbUrl!.trim().isNotEmpty) return thumbUrl;
    if (assetPath != null && assetPath!.trim().isNotEmpty) return assetPath;
    return null;
  }

  String get fallbackAsset => _pngFallbackForId(id);
}

/// فولباك محلي 5 صور فقط من v2 كما طلب العميل - احترافي
const _kLocalFallback5 = [
  'assets/images/coloring/v2/bird.png',
  'assets/images/coloring/v2/cat.png',
  'assets/images/coloring/v2/fish.png',
  'assets/images/coloring/v2/vehicles.png',
  'assets/images/coloring/v2/flowers.png',
];

/// يربط id الرسم بأحد الـ 5 PNG الاحترافية فقط
String _pngFallbackForId(String id) {
  final lower = id.toLowerCase();
  // محاولة مطابقة مباشرة أولاً
  if (lower.contains('bird')) return 'assets/images/coloring/v2/bird.png';
  if (lower.contains('cat')) return 'assets/images/coloring/v2/cat.png';
  if (lower.contains('fish')) return 'assets/images/coloring/v2/fish.png';
  if (lower.contains('vehicle') || lower.contains('car')) return 'assets/images/coloring/v2/vehicles.png';
  if (lower.contains('flower')) return 'assets/images/coloring/v2/flowers.png';
  // الباقي يوزع على الـ 5 بالتساوي عبر hash
  final idx = id.hashCode.abs() % _kLocalFallback5.length;
  return _kLocalFallback5[idx];
}

const kColoringCategoriesV2 = <ColoringCategorySpec>[
  ColoringCategorySpec(
    id: 'birds',
    label: 'طيور',
    icon: Icons.flutter_dash_rounded,
    gradientStart: Color(0xFFFFD34D),
    gradientEnd: Color(0xFFFF8A2A),
    assetPath: 'assets/images/coloring/v2/birds.png',
  ),
  ColoringCategorySpec(
    id: 'animals',
    label: 'حيوانات',
    icon: Icons.pets_rounded,
    gradientStart: Color(0xFF9EE86F),
    gradientEnd: Color(0xFF2ECC71),
    assetPath: 'assets/images/coloring/v2/animals.png',
  ),
  ColoringCategorySpec(
    id: 'vehicles',
    label: 'مركبات',
    icon: Icons.directions_car_rounded,
    gradientStart: Color(0xFF6EE7FF),
    gradientEnd: Color(0xFF2856D8),
    assetPath: 'assets/images/coloring/v2/vehicles.png',
  ),
  ColoringCategorySpec(
    id: 'space',
    label: 'الفضاء',
    icon: Icons.rocket_launch_rounded,
    gradientStart: Color(0xFF8B6CFF),
    gradientEnd: Color(0xFF3A1E7A),
    assetPath: 'assets/images/coloring/v2/space.png',
  ),
  ColoringCategorySpec(
    id: 'flowers',
    label: 'زهور',
    icon: Icons.local_florist_rounded,
    gradientStart: Color(0xFFFF7AB3),
    gradientEnd: Color(0xFFE23D7A),
    assetPath: 'assets/images/coloring/v2/flowers.png',
  ),
  ColoringCategorySpec(
    id: 'sea',
    label: 'حيوانات بحرية',
    icon: Icons.water_rounded,
    gradientStart: Color(0xFF3BDDF5),
    gradientEnd: Color(0xFF0E7490),
    assetPath: 'assets/images/coloring/v2/sea.png',
  ),
  ColoringCategorySpec(
    id: 'fruits',
    label: 'فواكه',
    icon: Icons.apple_rounded,
    gradientStart: Color(0xFFFF8A65),
    gradientEnd: Color(0xFFE23D28),
    assetPath: 'assets/images/coloring/v2/fruits.png',
  ),
  ColoringCategorySpec(
    id: 'toys',
    label: 'ألعاب',
    icon: Icons.toys_rounded,
    gradientStart: Color(0xFF6A9BFF),
    gradientEnd: Color(0xFF6A3DF2),
    assetPath: 'assets/images/coloring/v2/toys.png',
  ),
];

/// نقطة سقوط آمنة: كل المسارات تحاول v2 الشفافة عبر remove-background،
/// وإن لم توجد ترجع لـ bird.png ثم لأيقونة.
/// بعد توليد PlayVeo الناجح: الملفات ستصبح
/// assets/images/coloring/v2/{bird,cat,dino,fish,...}.png  (شفافة)
/// التوثيق: POST /v1/images/remove-background { url: JPEG } → {status:completed, url:transparent PNG}
const kFeaturedColoringV2 = <FeaturedColoringSpec>[
  FeaturedColoringSpec(id: 'bird-001', label: 'عصفور صغير', isNew: true, assetPath: 'assets/images/coloring/v2/bird.png'),
  FeaturedColoringSpec(id: 'cat-001', label: 'قطة لطيفة', isNew: true, assetPath: 'assets/images/coloring/v2/cat.png'),
  FeaturedColoringSpec(id: 'dino-001', label: 'ديناصور', isNew: true, assetPath: 'assets/images/coloring/v2/dino.png'),
  FeaturedColoringSpec(id: 'fish-001', label: 'سمكة', isNew: true, assetPath: 'assets/images/coloring/v2/fish.png'),
  FeaturedColoringSpec(id: 'vehicles-001', label: 'سيارة', isNew: true, assetPath: 'assets/images/coloring/v2/vehicles.png'),
  FeaturedColoringSpec(id: 'space-001', label: 'صاروخ', isNew: true, assetPath: 'assets/images/coloring/v2/space.png'),
  FeaturedColoringSpec(id: 'flowers-001', label: 'زهور', isNew: true, assetPath: 'assets/images/coloring/v2/flowers.png'),
  FeaturedColoringSpec(id: 'animals-001', label: 'حيوانات', isNew: false, assetPath: 'assets/images/coloring/v2/animals.png'),
];

List<String> kKnownV2AssetCandidates(String specPath) => [
      specPath,
      // fallback chain: v2/<name>.png already checked, try legacy bird, then studio hero
      'assets/images/coloring/bird.png',
      'assets/images/drawing/coloring/bird.png',
      'assets/images/studio/hero-start-drawing.webp',
    ];

class ColoringHomeV2Page extends StatelessWidget {
  const ColoringHomeV2Page({
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
  final void Function(ColoringCategorySpec category)? onOpenCategory;
  final void Function(FeaturedColoringSpec featured)? onOpenFeatured;
  final int myDrawingsCount;
  final String? displayName;
  final List<StudioHeroResume> resumable;

  static const _heroAsset = 'assets/images/studio/hero-start-drawing.webp';
  static const _heroFallback = 'assets/images/studio/hero-start-drawing.webp';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0C1030),
      appBar: _buildAppBar(context),
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: StudioGradients.page),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            _HeroColoringV2(
              heroAsset: _heroAsset,
              fallbackAsset: _heroFallback,
              onStart: () {
                if (kFeaturedColoringV2.isNotEmpty) {
                  onOpenFeatured?.call(kFeaturedColoringV2.first);
                }
              },
            ),
            const SizedBox(height: 22),
            _SectionTitleV2(title: 'رسومات مميزة', action: null),
            const SizedBox(height: 10),
            LayoutBuilder(builder: (context, constraints) {
              final cols = constraints.maxWidth < 360 ? 1 : 2;
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: cols,
                  childAspectRatio: cols == 1 ? 1.6 : 1.25,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: kFeaturedColoringV2.length,
                itemBuilder: (c, i) => _FeaturedTileV2(
                  spec: kFeaturedColoringV2[i],
                  onTap: () => onOpenFeatured?.call(kFeaturedColoringV2[i]),
                ),
              );
            }),
            const SizedBox(height: 22),
            _SectionTitleV2(title: 'اختر رسمة لتلوينها', action: null),
            const SizedBox(height: 10),
            LayoutBuilder(builder: (context, constraints) {
              final cols = constraints.maxWidth < 360 ? 1 : 2;
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: cols,
                  childAspectRatio: 2.2,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: kColoringCategoriesV2.length,
                itemBuilder: (c, i) => _CategoryTileV2(
                  spec: kColoringCategoriesV2[i],
                  onTap: () => onOpenCategory?.call(kColoringCategoriesV2[i]),
                ),
              );
            }),
            const SizedBox(height: 22),
            _AchievementV2(count: myDrawingsCount),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return const StudioAppBar(
      title: 'لوّن',
      glyph: Icons.palette_rounded,
      actions: [
        StudioBarPill(label: 'معاينة', icon: Icons.remove_red_eye_outlined),
        StudioBarCircle(icon: Icons.help_outline_rounded, label: 'مساعدة'),
      ],
    );
  }
}

/// New banner hero — uses coloring-banner.png asset as main header
class _HeroColoringV2 extends StatelessWidget {
  const _HeroColoringV2({
    required this.heroAsset,
    required this.fallbackAsset,
    required this.onStart,
  });
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
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
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
                child: const Center(
                  child: Icon(Icons.palette_rounded, size: 48, color: Colors.white24),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

}

class _SectionTitleV2 extends StatelessWidget {
  const _SectionTitleV2({required this.title, this.action});
  final String title;
  final String? action;
  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(width: 4, height: 18, decoration: BoxDecoration(color: AppColors.starGold, borderRadius: BorderRadius.circular(999))),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
        const Spacer(),
        if (action != null) Text(action!, style: const TextStyle(color: AppColors.electricCyan, fontSize: 12, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _FeaturedTileV2 extends StatelessWidget {
  const _FeaturedTileV2({required this.spec, required this.onTap});
  final FeaturedColoringSpec spec;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.9)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 12, offset: const Offset(0, 6))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Positioned.fill(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 36),
                child: Builder(builder: (_) {
                  final url = spec.bestDisplayUrl;
                  final fallback = spec.fallbackAsset;
                  if (url == null) {
                    return Image.asset(fallback, fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Icon(Icons.image_outlined, size: 48, color: Colors.black.withValues(alpha: 0.12)));
                  }
                  final isNet = url.startsWith('http://') || url.startsWith('https://');
                  if (isNet) {
                    return Image.network(url,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Image.asset(fallback, fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Icon(Icons.image_outlined, size: 48, color: Colors.black.withValues(alpha: 0.12))),
                    );
                  }
                  return Image.asset(url,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => Image.asset(fallback, fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Icon(Icons.image_outlined, size: 48, color: Colors.black.withValues(alpha: 0.12))),
                  );
                }),
              ),
            ),
            if (spec.isNew)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF6A3DF2),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: const Text('جديد', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
                ),
              ),
            Positioned(
              top: 8,
              left: 8,
              child: Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(color: const Color(0xFFFFF3C2), shape: BoxShape.circle, border: Border.all(color: const Color(0xFFFFD34D), width: 1.2)),
                child: const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFF9F1C)),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: Container(
                constraints: const BoxConstraints(minHeight: 36),
                padding: const EdgeInsets.fromLTRB(10, 7, 10, 7),
                color: const Color(0xFF0C1030),
                alignment: Alignment.center,
                child: Text(spec.label, maxLines: 2, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, softWrap: true, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, height: 1.3)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CategoryTileV2 extends StatelessWidget {
  const _CategoryTileV2({required this.spec, required this.onTap});
  final ColoringCategorySpec spec;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.14), blurRadius: 10, offset: const Offset(0, 5))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Row(
          children: [
            // لو فيه remote thumb نعرضه على خلفية gradient
            Stack(children: [
              Container(
                width: 56,
                height: double.infinity,
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [spec.gradientStart, spec.gradientEnd]),
                ),
                child: () {
                  final u = spec.bestDisplayUrl ?? spec.fallbackAsset;
                  if (u.startsWith('http')) {
                    return Padding(
                      padding: const EdgeInsets.all(6),
                      child: Image.network(u, fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => Padding(
                          padding: const EdgeInsets.all(6),
                          child: Image.asset(spec.fallbackAsset, fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) => Icon(spec.icon, size: 26, color: Colors.white)),
                        ),
                      ),
                    );
                  }
                  // PNG محلي من v2
                  return Padding(
                    padding: const EdgeInsets.all(6),
                    child: Image.asset(u, fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Icon(spec.icon, size: 26, color: Colors.white)),
                  );
                }(),
              ),
            ]),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(spec.label, style: const TextStyle(color: Color(0xFF0C1030), fontSize: 13, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text('${spec.count} رسمة', style: TextStyle(color: const Color(0xFF0C1030).withValues(alpha: 0.55), fontSize: 10, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AchievementV2 extends StatelessWidget {
  const _AchievementV2({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFF221A4A), Color(0xFF141032)]),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFFD34D).withValues(alpha: 0.18)),
      ),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(color: const Color(0xFFFFD34D).withValues(alpha: 0.16), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.emoji_events_rounded, size: 20, color: Color(0xFFFFD34D)),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('إكمال اللوحات يكافئك بنجوم ذهبية!', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                SizedBox(height: 2),
                Text('اجمع النجوم وافتح رسومات جديدة', style: TextStyle(color: Color(0xFF8B8DB3), fontSize: 10)),
              ],
            ),
          ),
          const Icon(Icons.star_rounded, size: 22, color: Color(0xFFFFD34D)),
          const SizedBox(width: 4),
          Text('$count', style: const TextStyle(color: Color(0xFFFFD34D), fontSize: 14, fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}
