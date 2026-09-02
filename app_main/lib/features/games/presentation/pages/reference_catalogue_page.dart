/// Draw Like Me — ارسم مثلي — Premium UI matching provided design
/// Dark navy cosmic theme with hero banner, chips, resume cards, grid, tip.
/// All images R2-first via DrawingAsset, with local asset fallback.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/creative_catalogue_provider.dart';
import '../../data/local_creation_store.dart';
import '../studio/studio_app_bar.dart';
import '../widgets/drawing_asset.dart';
import 'reference_drawing_page.dart';

class ReferenceCataloguePage extends StatefulWidget {
  const ReferenceCataloguePage({
    required this.childId,
    required this.creationStore,
    this.onSaved,
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  @override
  State<ReferenceCataloguePage> createState() => _ReferenceCataloguePageState();
}

class _ReferenceCataloguePageState extends State<ReferenceCataloguePage> {
  String _filterCategory = 'الكل';
  // `APP-105`: حُذفت `_categories` و`_ages` — لا قارئ لهما، وتعليقهما كان يقول
  // إنهما «مُبقاتان لتوافق الـAPI» وهما حقلا حالة في عنصر واجهة لا عقدٌ مع أحد.
  //
  // و`_filterAge` **بقيت**: إسكاتُها كان متقادمًا، وهي مقروءة فعلًا في مُرشِّح
  // القائمة أدناه. أي أن ثلاثة إسكاتات متجاورة كان أحدها يحرس تحذيرًا لم يعد
  // موجودًا — وهو ما يجعل الإسكات المتراكم خطرًا: لا يقول أيُّه لا يزال لازمًا.
  String _filterAge = 'الكل';

  // `APP-105`: حُذفت `_iconForCat` — لا مُنادي لها. وشرائح التصنيفات أدناه تستخدم
  // أيقوناتها مباشرةً، فالدالّة كانت نسخةً ثانية من خريطةٍ حيّة.

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final catalogAsync = ref.watch(referenceCatalogueProvider);
        return catalogAsync.when(
          loading: () => Scaffold(
            backgroundColor: const Color(0xFF05081A),
            appBar: _appBar(context),
            body: const Center(child: CircularProgressIndicator(color: Color(0xFFFFD34D))),
          ),
          error: (e, _) => _buildPremium(context, _activities),
          data: (list) {
            final activities = list.isEmpty ? _activities : list.map(_fromProvider).toList(growable: false);
            return _buildPremium(context, activities);
          },
        );
      },
    );
  }

  ReferenceActivity _fromProvider(dynamic e) {
    final bg = _bgForCategory(e.category as String);
    return ReferenceActivity(
      id: e.id as String,
      titleAr: e.titleAr as String,
      titleEn: e.titleEn as String,
      category: e.category as String,
      ageLabel: e.ageLabel as String,
      difficulty: e.difficulty as String,
      referenceAssetId: e.referenceAssetId as String,
      thumbnailAssetId: e.thumbnailAssetId as String,
      bg: bg,
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

  PreferredSizeWidget _appBar(BuildContext context) {
    return const StudioAppBar(
      title: 'ارسم مثلي',
      glyph: Icons.brush_rounded,
      showStar: true,
      actions: [
        StudioBarCircle(icon: Icons.help_outline_rounded, label: 'مساعدة'),
      ],
    );
  }

  Widget _buildPremium(BuildContext context, List<ReferenceActivity> activities) {
    final filtered = activities.where((a) {
      if (_filterCategory != 'الكل' && a.category != _filterCategory) return false;
      if (_filterAge != 'الكل' && a.ageLabel != _filterAge) return false;
      return true;
    }).toList(growable: false);

    // Demo progress data for resume section (matches screenshot)
    final resumeItems = [
      _ResumeData(activity: activities.firstWhere((a) => a.id == 'ref-cat', orElse: () => activities[0]), progress: 0.30, label: 'آخر رسم: أمس'),
      _ResumeData(activity: activities.firstWhere((a) => a.id == 'ref-rocket', orElse: () => activities.length > 1 ? activities[1] : activities[0]), progress: 0.60, label: 'آخر رسم: اليوم'),
    ];

    return Scaffold(
      backgroundColor: const Color(0xFF05081A),
      appBar: _appBar(context),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF05081A), Color(0xFF080C2A), Color(0xFF05081A)]),
        ),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _heroBanner(context)),
            SliverToBoxAdapter(child: _filterChips(context)),
            SliverToBoxAdapter(child: _resumeSection(context, resumeItems)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
                child: Row(
                  children: [
                    const Icon(Icons.auto_awesome_rounded, color: Color(0xFFFFD34D), size: 18),
                    const SizedBox(width: 6),
                    Text('اختر رسمة لتقلدها', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                    const Spacer(),
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
                            const Icon(Icons.filter_alt_off_outlined, size: 48, color: Colors.white24),
                            const SizedBox(height: 8),
                            const Text('لا توجد أنشطة بهذه الفلاتر', style: TextStyle(color: Colors.white70)),
                            const SizedBox(height: 12),
                            FilledButton.tonalIcon(
                              onPressed: () => setState(() { _filterCategory = 'الكل'; _filterAge = 'الكل'; }),
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

  Widget _heroBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: const Color(0xFF7A4DFF).withValues(alpha: 0.35),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF6A3DF2).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: AspectRatio(
        aspectRatio: 2.3,
        child: Image.asset(
          'assets/images/studio/draw-like-me-banner.webp',
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Image.asset(
            'assets/images/studio/draw-like-me-banner.png',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              color: const Color(0xFF1A0B3E),
              child: const Center(
                child: Icon(Icons.brush_rounded, size: 42, color: Colors.white24),
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
                    border: Border.all(color: selected ? const Color(0xFF9D68FF) : const Color(0xFF1E2A6A), width: selected ? 1.4 : 1),
                    boxShadow: selected ? [BoxShadow(color: const Color(0xFF6A3DF2).withValues(alpha: 0.35), blurRadius: 10, offset: const Offset(0, 4))] : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, size: 16, color: selected ? Colors.white : const Color(0xFF7EA0FF)),
                      const SizedBox(width: 6),
                      Text(label, style: TextStyle(color: selected ? Colors.white : const Color(0xFFDCE2FF), fontWeight: FontWeight.w800, fontSize: 12)),
                      if (selected) ...[const SizedBox(width: 4), const Icon(Icons.auto_awesome_rounded, size: 10, color: Color(0xFFFFD34D))],
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
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
          child: Row(
            children: [
              Text('ابدأ من حيث توقفت', style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
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
              final isRocket = r.activity.id.contains('rocket');
              return _resumeCard(context, r, isRocket);
            },
          ),
        ),
      ],
    );
  }

  Widget _resumeCard(BuildContext context, _ResumeData r, bool isRocket) {
    final progressColor = isRocket ? const Color(0xFF00D6F5) : const Color(0xFF9D68FF);
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReferenceDrawingPage(childId: widget.childId, activity: r.activity, creationStore: widget.creationStore, onSaved: widget.onSaved))),
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: 240,
        decoration: BoxDecoration(
          color: const Color(0xFF0F1433),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: const Color(0xFF1E2A6A)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Row(
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white10)),
                    clipBehavior: Clip.antiAlias,
                    child: Padding(
                      padding: const EdgeInsets.all(6),
                      child: DrawingAsset(assetIdOrPath: r.activity.thumbnailAssetId, fit: BoxFit.contain),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(r.activity.titleAr, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                        const SizedBox(height: 2),
                        Text(r.label, style: const TextStyle(color: Color(0xFF9FA3C0), fontSize: 10, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: LinearProgressIndicator(
                                  value: r.progress,
                                  minHeight: 6,
                                  backgroundColor: Colors.white10,
                                  valueColor: AlwaysStoppedAnimation(progressColor),
                                ),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text('${(r.progress * 100).round()}%', style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Play button overlap on left edge
            PositionedDirectional(
              start: 8,
              bottom: 8,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: const Color(0xFF6A3DF2),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
                  boxShadow: [BoxShadow(color: const Color(0xFF6A3DF2).withValues(alpha: 0.45), blurRadius: 8)],
                ),
                child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
              ),
            ),
            const PositionedDirectional(top: 8, end: 10, child: Icon(Icons.auto_awesome_rounded, size: 8, color: Color(0xFFFFD34D))),
          ],
        ),
      ),
    );
  }

  Widget _drawCard(BuildContext context, ReferenceActivity act) {
    final isHard = act.difficulty.contains('متوسط') || act.difficulty.contains('مفصل') || act.difficulty == 'medium' || act.difficulty == 'hard';
    final badgeLabel = isHard ? (act.ageLabel.isNotEmpty ? '${act.ageLabel} متوسط' : 'متوسط') : 'سهل';
    final badgeColor = isHard ? const Color(0xFF2A2E6A) : const Color(0xFF16A34A);
    return Semantics(
      button: true,
      label: '${act.titleAr} ${act.difficulty}',
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => ReferenceDrawingPage(childId: widget.childId, activity: act, creationStore: widget.creationStore, onSaved: widget.onSaved))),
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0F1433),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: const Color(0xFF1E2A6A)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Container(
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.all(10),
                        child: DrawingAsset(assetIdOrPath: act.thumbnailAssetId, fit: BoxFit.contain),
                      ),
                    ),
                  ),
                  Container(
                    color: const Color(0xFF0F1433),
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    child: Row(
                      children: [
                        Expanded(child: Text(act.titleAr, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(999)),
                          child: Text(badgeLabel, style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              // star top-right
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: const Color(0xFF11183D).withValues(alpha: 0.92),
                    shape: BoxShape.circle,
                    border: Border.all(color: const Color(0xFFFFD34D).withValues(alpha: 0.85)),
                  ),
                  child: const Icon(Icons.star_rounded, size: 14, color: Color(0xFFFFD34D)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tipBanner(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(
        gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color(0xFF2A1558), Color(0xFF1A0B3E)]),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFFD34D).withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: const Color(0xFFFFD34D),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
            ),
            child: const Center(child: Text('⭐', style: TextStyle(fontSize: 18))),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('تذكّر: راقب الشكل، الألوان والتفاصيل ثم ارسم!', style: TextStyle(color: Color(0xFFFFD34D), fontWeight: FontWeight.w800, fontSize: 11, height: 1.3)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.auto_awesome_rounded, size: 10, color: Color(0xFFFFD34D)),
                    const SizedBox(width: 4),
                    const Text('كل رسمة تبدأ بملاحظة صغيرة', style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: const Color(0xFF1A0B3E),
              shape: BoxShape.circle,
              border: Border.all(color: const Color(0xFFFFD34D).withValues(alpha: 0.9)),
            ),
            child: const Icon(Icons.lightbulb_rounded, color: Color(0xFFFFD34D), size: 18),
          ),
        ],
      ),
    );
  }
}

class _ResumeData {
  const _ResumeData({required this.activity, required this.progress, required this.label});
  final ReferenceActivity activity;
  final double progress;
  final String label;
}

class ReferenceActivity {
  const ReferenceActivity({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.category,
    required this.ageLabel,
    required this.difficulty,
    required this.referenceAssetId,
    required this.thumbnailAssetId,
    this.supportsGhost = true,
    this.supportsSteps = false,
    this.bg = const Color(0xFF0F172A),
  });
  final String id;
  final String titleAr;
  final String titleEn;
  final String category;
  final String ageLabel;
  final String difficulty;
  final String referenceAssetId;
  final String thumbnailAssetId;
  final bool supportsGhost;
  final bool supportsSteps;
  final Color bg;
}

const _activities = [
  ReferenceActivity(id: 'ref-cat', titleAr: 'قطة', titleEn: 'Cat', category: 'حيوانات', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-cat', thumbnailAssetId: 'asset-color-cat', bg: Color(0xFF0B1220)),
  ReferenceActivity(id: 'ref-lion', titleAr: 'أسد', titleEn: 'Lion', category: 'حيوانات', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-lion', thumbnailAssetId: 'asset-color-lion', bg: Color(0xFF92400E)),
  ReferenceActivity(id: 'ref-turtle', titleAr: 'سلحفاة', titleEn: 'Turtle', category: 'حيوانات', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-turtle', thumbnailAssetId: 'asset-color-turtle', bg: Color(0xFF14532D)),
  ReferenceActivity(id: 'ref-butterfly', titleAr: 'فراشة', titleEn: 'Butterfly', category: 'حيوانات', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-butterfly', thumbnailAssetId: 'asset-color-butterfly', bg: Color(0xFF831843)),
  ReferenceActivity(id: 'ref-rabbit', titleAr: 'أرنب', titleEn: 'Rabbit', category: 'حيوانات', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-rabbit', thumbnailAssetId: 'asset-color-rabbit', bg: Color(0xFF6B7280)),
  ReferenceActivity(id: 'ref-elephant', titleAr: 'فيل', titleEn: 'Elephant', category: 'حيوانات', ageLabel: '8-9', difficulty: 'مفصل', referenceAssetId: 'asset-color-elephant', thumbnailAssetId: 'asset-color-elephant', bg: Color(0xFF475569)),
  ReferenceActivity(id: 'ref-owl', titleAr: 'بومة', titleEn: 'Owl', category: 'حيوانات', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-owl', thumbnailAssetId: 'asset-color-owl', bg: Color(0xFF7C3AED)),
  ReferenceActivity(id: 'ref-horse', titleAr: 'حصان', titleEn: 'Horse', category: 'حيوانات', ageLabel: '8-9', difficulty: 'مفصل', referenceAssetId: 'asset-color-horse', thumbnailAssetId: 'asset-color-horse', bg: Color(0xFF92400E)),
  ReferenceActivity(id: 'ref-rocket', titleAr: 'صاروخ', titleEn: 'Rocket', category: 'فضاء', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-rocket', thumbnailAssetId: 'asset-color-rocket', bg: Color(0xFF1A0B2E)),
  ReferenceActivity(id: 'ref-planet', titleAr: 'كوكب', titleEn: 'Planet', category: 'فضاء', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-planet', thumbnailAssetId: 'asset-color-planet', bg: Color(0xFF0F172A)),
  ReferenceActivity(id: 'ref-moon', titleAr: 'قمر', titleEn: 'Moon', category: 'فضاء', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-moon', thumbnailAssetId: 'asset-color-moon', bg: Color(0xFF334155)),
  ReferenceActivity(id: 'ref-astronaut', titleAr: 'رائد فضاء', titleEn: 'Astronaut', category: 'فضاء', ageLabel: '8-9', difficulty: 'مفصل', referenceAssetId: 'asset-color-astronaut', thumbnailAssetId: 'asset-color-astronaut', bg: Color(0xFFE5E7EB)),
  ReferenceActivity(id: 'ref-telescope', titleAr: 'تلسكوب', titleEn: 'Telescope', category: 'فضاء', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-telescope', thumbnailAssetId: 'asset-color-telescope', bg: Color(0xFF1E3A8A)),
  ReferenceActivity(id: 'ref-tree', titleAr: 'شجرة', titleEn: 'Tree', category: 'طبيعة', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-tree', thumbnailAssetId: 'asset-color-tree', bg: Color(0xFF14532D)),
  ReferenceActivity(id: 'ref-flower', titleAr: 'زهرة', titleEn: 'Flower', category: 'طبيعة', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-flower', thumbnailAssetId: 'asset-color-flower', bg: Color(0xFF831843)),
  ReferenceActivity(id: 'ref-sea', titleAr: 'بحر', titleEn: 'Sea', category: 'طبيعة', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-sea', thumbnailAssetId: 'asset-color-sea', bg: Color(0xFF0891B2)),
  ReferenceActivity(id: 'ref-mountain', titleAr: 'جبل', titleEn: 'Mountain', category: 'طبيعة', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-mountain', thumbnailAssetId: 'asset-color-mountain', bg: Color(0xFF78716C)),
  ReferenceActivity(id: 'ref-rainbow', titleAr: 'قوس قزح', titleEn: 'Rainbow', category: 'طبيعة', ageLabel: '8-9', difficulty: 'مفصل', referenceAssetId: 'asset-color-rainbow', thumbnailAssetId: 'asset-color-rainbow', bg: Color(0xFFEC4899)),
  ReferenceActivity(id: 'ref-car', titleAr: 'سيارة', titleEn: 'Car', category: 'مركبات', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-car', thumbnailAssetId: 'asset-color-car', bg: Color(0xFFDC2626)),
  ReferenceActivity(id: 'ref-train', titleAr: 'قطار', titleEn: 'Train', category: 'مركبات', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-train', thumbnailAssetId: 'asset-color-train', bg: Color(0xFF1D4ED8)),
  ReferenceActivity(id: 'ref-airplane', titleAr: 'طائرة', titleEn: 'Airplane', category: 'مركبات', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-airplane', thumbnailAssetId: 'asset-color-airplane', bg: Color(0xFF0284C7)),
  ReferenceActivity(id: 'ref-boat', titleAr: 'قارب', titleEn: 'Boat', category: 'مركبات', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-boat', thumbnailAssetId: 'asset-color-boat', bg: Color(0xFF0369A1)),
  ReferenceActivity(id: 'ref-apple', titleAr: 'تفاحة', titleEn: 'Apple', category: 'بيت', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-apple', thumbnailAssetId: 'asset-color-apple', bg: Color(0xFFDC2626)),
  ReferenceActivity(id: 'ref-book', titleAr: 'كتاب', titleEn: 'Book', category: 'بيت', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-book', thumbnailAssetId: 'asset-color-book', bg: Color(0xFF7C3AED)),
  ReferenceActivity(id: 'ref-house2', titleAr: 'منزل', titleEn: 'House', category: 'بيت', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-house', thumbnailAssetId: 'asset-color-house', bg: Color(0xFF1E3A8A)),
  ReferenceActivity(id: 'ref-lamp', titleAr: 'مصباح', titleEn: 'Lamp', category: 'بيت', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-lamp', thumbnailAssetId: 'asset-color-lamp', bg: Color(0xFFF59E0B)),
  ReferenceActivity(id: 'ref-mosque', titleAr: 'مسجد مبسط', titleEn: 'Mosque', category: 'زخارف', ageLabel: '8-9', difficulty: 'مفصل', referenceAssetId: 'asset-color-mosque', thumbnailAssetId: 'asset-color-mosque', bg: Color(0xFF0F766E)),
  ReferenceActivity(id: 'ref-lantern', titleAr: 'فانوس', titleEn: 'Lantern', category: 'زخارف', ageLabel: '6-7', difficulty: 'متوسط', referenceAssetId: 'asset-color-lantern', thumbnailAssetId: 'asset-color-lantern', bg: Color(0xFFB45309)),
  ReferenceActivity(id: 'ref-crescent', titleAr: 'هلال ونجمة', titleEn: 'Crescent', category: 'زخارف', ageLabel: '4-5', difficulty: 'سهل', referenceAssetId: 'asset-color-crescent', thumbnailAssetId: 'asset-color-crescent', bg: Color(0xFF312E81)),
  ReferenceActivity(id: 'ref-arabesque', titleAr: 'زخرفة', titleEn: 'Arabesque', category: 'زخارف', ageLabel: '8-9', difficulty: 'مفصل', referenceAssetId: 'asset-color-arabesque', thumbnailAssetId: 'asset-color-arabesque', bg: Color(0xFF7C2D12)),
];
