/// شاشة تتبّع رئيسية — مطابقة لصورة trace-home: hero ولد يرسم نجمة،
/// Cards: الخطوط / الأشكال / الأرقام / الحروف / متاهة / موجات + Progress 120/200
/// + لوحات التلوين / لوحاتي — نفس DeepSpace #0C1030، بنفسجية #6A3DF2
/// + Levels Cards احترافية مع Filters عمر/صعوبة
library;
import 'package:flutter/material.dart';
import '../../studio/studio_app_bar.dart';

const _kDeep = Color(0xFF0C1030);
const _kHeroGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF6A3DF2), Color(0xFF241A5E), Color(0xFF0D1235)],
);
const _kGold = Color(0xFFFFD34D);

/// فلتر الفئة العمرية في رئيسية التتبّع. القيم هي المسارات العمرية الثلاثة
/// المستخدمة في كل المنصّة (3-5 / 6-8 / 9-12) زائد «الكل».
enum TraceFilterAge { all, age3_5, age6_8, age9_12 }

/// فلتر الصعوبة في رئيسية التتبّع.
enum TraceFilterDiff { all, easy, medium, hard }

/// وصف تصنيف تتبّع واحد في رئيسية الاستوديو.
///
/// يُستهلَك هنا وفي `studio_v2/trace_home_page.dart` (عبر `v2impl.`)، حيث يُعاد
/// بناؤه بعدّ حقيقي من الكتالوج البعيد مع الإبقاء على العرض المحلي كافتراضي.
class TraceCategorySpec {
  const TraceCategorySpec({
    required this.id,
    required this.label,
    required this.labelEn,
    required this.icon,
    required this.gradientStart,
    required this.gradientEnd,
    required this.count,
    required this.progress,
    this.assetPath,
    this.remoteThumbUrl,
    this.remoteUrl,
  });

  final String id;
  final String label;
  final String labelEn;
  final IconData icon;
  final Color gradientStart;
  final Color gradientEnd;
  final int count;
  final int progress;

  /// مسار أصل مبندل، يُستخدم حين لا يوجد بديل بعيد. **قابل للعدم**.
  ///
  /// كانت الفئات السبع تحمل مسارات في `assets/images/tracing/v2/` — مجلدٌ غير
  /// موجود على القرص ولا مُعلَن في `pubspec.yaml`. والأثر لم يكن انكسارًا
  /// (`errorBuilder` يُعيد `SizedBox`) بل **أسوأ من ذلك في صمته**: `hasImg`
  /// كانت تصير `true` لوجود المسار، فيُبنى `_ImgThumb` ويفشل ويُخفى، ويُتجاوَز
  /// فرع `if (!hasImg)` الذي يرسم الأيقونة. فالبطاقة تفقد صورتها **وأيقونتها**
  /// المصمَّمة. و`null` هنا تُعيد الأيقونة (`PERF-101`).
  final String? assetPath;

  final String? remoteThumbUrl;
  final String? remoteUrl;

  /// ما يُعرض فعلًا: المصغَّر البعيد، ثم الأصل البعيد، ثم المبندل.
  ///
  /// `_ImgThumb` يفرّق بين الاثنين بـ`startsWith('http')`، فالترتيب هنا يكفي
  /// ولا حاجة لعلم إضافي.
  String? get bestDisplayUrl => remoteThumbUrl ?? remoteUrl ?? assetPath;
}

const kTraceCategoriesV2 = <TraceCategorySpec>[
  TraceCategorySpec(
    id: 'lines_straight',
    label: 'خط مستقيم',
    labelEn: 'straight lines',
    icon: Icons.show_chart_rounded,
    gradientStart: Color(0xFFFFD34D),
    gradientEnd: Color(0xFFFF8A2A),
    count: 12,
    progress: 4,
  ),
  TraceCategorySpec(
    id: 'lines_curvy',
    label: 'خطوط متعرجة',
    labelEn: 'wavy lines',
    icon: Icons.waves_rounded,
    gradientStart: Color(0xFF6EE7FF),
    gradientEnd: Color(0xFF2856D8),
    count: 10,
    progress: 2,
  ),
  TraceCategorySpec(
    id: 'shapes',
    label: 'الأشكال',
    labelEn: 'shapes',
    icon: Icons.category_rounded,
    gradientStart: Color(0xFF9EE86F),
    gradientEnd: Color(0xFF2ECC71),
    count: 18,
    progress: 6,
  ),
  TraceCategorySpec(
    id: 'numbers',
    label: 'الأرقام',
    labelEn: 'numbers',
    icon: Icons.pin_rounded,
    gradientStart: Color(0xFFFF7AB3),
    gradientEnd: Color(0xFFE23D7A),
    count: 20,
    progress: 5,
  ),
  TraceCategorySpec(
    id: 'letters_ar',
    label: 'الحروف العربية',
    labelEn: 'arabic letters',
    icon: Icons.abc_rounded,
    gradientStart: Color(0xFF8B6CFF),
    gradientEnd: Color(0xFF3A1E7A),
    count: 28,
    progress: 0,
  ),
  TraceCategorySpec(
    id: 'maze',
    label: 'متاهة',
    labelEn: 'maze',
    icon: Icons.route_rounded,
    gradientStart: Color(0xFF3BDDF5),
    gradientEnd: Color(0xFF0E7490),
    count: 8,
    progress: 1,
  ),
  TraceCategorySpec(
    id: 'waves',
    label: 'موجات',
    labelEn: 'waves',
    icon: Icons.water_rounded,
    gradientStart: Color(0xFF6A9BFF),
    gradientEnd: Color(0xFF6A3DF2),
    count: 12,
    progress: 3,
  ),
];

class TraceHomeV2Page extends StatefulWidget {
  const TraceHomeV2Page({
    required this.childId,
    this.onOpenCategory,
    this.onOpenMyBoards,
    this.myBoardsCount = 0,
    this.heroAsset,
    this.fallbackHeroAsset,
    this.specs,
    super.key,
  });
  final String childId;
  final void Function(TraceCategorySpec cat)? onOpenCategory;
  final VoidCallback? onOpenMyBoards;
  final int myBoardsCount;
  final String? heroAsset;
  final String? fallbackHeroAsset;
  final List<TraceCategorySpec>? specs;

  @override
  State<TraceHomeV2Page> createState() => _TraceHomeV2State();
}

class _TraceHomeV2State extends State<TraceHomeV2Page> {
  TraceFilterAge _age = TraceFilterAge.all;
  TraceFilterDiff _diff = TraceFilterDiff.all;

  List<TraceCategorySpec> get _filtered {
    final specs = widget.specs ?? kTraceCategoriesV2;
    return specs;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kDeep,
      appBar: _appBar(context),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF17153E), _kDeep],
          ),
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
          children: [
            _HeroTrace(
              // الافتراضي كان `assets/images/studio/v2/trace-hero.png`، وهو
              // مسارٌ **مُعلَّق بقرار مكتوب** في `pubspec.yaml` («dev fallback
              // فقط: لا يُبندل في release») وغير موجود على القرص أصلًا. فكان
              // الهيرو يسقط دائمًا إلى البديل في كل بناء إصدار، أي أن الصورة
              // «الأساسية» لم تُعرض مرّة. فصار البديل هو الافتراضي صراحةً
              // (`PERF-101`).
              heroAsset:
                  widget.heroAsset ?? 'assets/images/studio/hero-start-drawing.webp',
              fallbackAsset: widget.fallbackHeroAsset ?? 'assets/images/studio/hero-start-drawing.webp',
              onStart: () {
                if (_filtered.isNotEmpty) widget.onOpenCategory?.call(_filtered.first);
              },
            ),
            const SizedBox(height: 14),
            _TopRow(
              myCount: widget.myBoardsCount,
              onBoards: widget.onOpenMyBoards ?? () {},
              onColoring: () => Navigator.of(context).maybePop(),
            ),
            const SizedBox(height: 18),
            _Filters(age: _age, diff: _diff, onAge: (v) => setState(() => _age = v), onDiff: (v) => setState(() => _diff = v)),
            const SizedBox(height: 14),
            _SectionTitle(title: 'اختر نشاط التتبّع', subtitle: 'Levels Cards احترافية • ${120}/${200} مكتمل'),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.15,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: _filtered.length,
              itemBuilder: (c, i) => _TraceCard(spec: _filtered[i], onTap: () => widget.onOpenCategory?.call(_filtered[i])),
            ),
            const SizedBox(height: 18),
            _ProgressStrip(total: 200, done: 120),
          ],
        ),
      ),
    );
  }

  PreferredSizeWidget _appBar(BuildContext context) {
    return const StudioAppBar(
      title: 'تتبّع وتعلّم',
      glyph: Icons.gesture_rounded,
      actions: [
        StudioBarPill(label: 'معاينة', icon: Icons.remove_red_eye_outlined),
        StudioBarCircle(icon: Icons.help_outline_rounded, label: 'مساعدة'),
      ],
    );
  }
}

class _HeroTrace extends StatelessWidget {
  const _HeroTrace({required this.heroAsset, required this.fallbackAsset, required this.onStart});
  final String heroAsset;
  final String fallbackAsset;
  final VoidCallback onStart;
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 188,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        gradient: _kHeroGradient,
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 12))],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(children: [
        Positioned(top: 14, right: 18, child: Row(children: [_dot(const Color(0xFFFFD34D), 8), const SizedBox(width: 18), const Icon(Icons.star_rounded, size: 16, color: Colors.white70)])),
        PositionedDirectional(end: -8, top: 0, bottom: 0, width: 180, child: _AssetOrNetwork(path: heroAsset, fallback: fallbackAsset)),
        PositionedDirectional(
          start: 0, top: 0, bottom: 0, width: 200,
          child: Padding(padding: const EdgeInsets.fromLTRB(18, 16, 8, 14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(999)), child: const Text('جديد', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))),
            const SizedBox(height: 10),
            const Text('تتبّع وتعلّم', style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900, height: 1.1)),
            const SizedBox(height: 6),
            const Text('تتبّع الخطوط والأشكال\nوالأرقام والحروف', style: TextStyle(color: Color(0xFFC7C9E8), fontSize: 12, height: 1.4)),
            const Spacer(),
            InkWell(onTap: onStart, borderRadius: BorderRadius.circular(999), child: Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFFFFD34D), Color(0xFFFF9F45)]), borderRadius: BorderRadius.circular(999)), child: const Text('ابدأ التتبع', style: TextStyle(color: _kDeep, fontWeight: FontWeight.w800, fontSize: 12)))),
          ])),
        ),
      ]),
    );
  }

  Widget _dot(Color c, double s) => Container(width: s, height: s, decoration: BoxDecoration(color: c, shape: BoxShape.circle, boxShadow: [BoxShadow(color: c.withValues(alpha: 0.6), blurRadius: 6)]));
}

class _AssetOrNetwork extends StatelessWidget {
  const _AssetOrNetwork({required this.path, required this.fallback});
  final String path;
  final String fallback;
  @override
  Widget build(BuildContext context) {
    final isNet = path.startsWith('http');
    if (isNet) return Image.network(path, fit: BoxFit.contain, errorBuilder: (_, __, ___) => Image.asset(fallback, fit: BoxFit.contain));
    return Image.asset(path, fit: BoxFit.contain, errorBuilder: (_, __, ___) => Image.asset(fallback, fit: BoxFit.contain, errorBuilder: (_, __, ___) => const Icon(Icons.brush_rounded, size: 64, color: Colors.white24)));
  }
}

class _TopRow extends StatelessWidget {
  const _TopRow({required this.myCount, required this.onBoards, required this.onColoring});
  final int myCount;
  final VoidCallback onBoards;
  final VoidCallback onColoring;
  @override
  Widget build(BuildContext context) => Row(children: [
    Expanded(child: _TopCard(label: 'لوحات التلوين', icon: Icons.palette_rounded, iconBg: _kGold, grad: const LinearGradient(colors: [Color(0xFFFFF3C2), _kGold]), onTap: onColoring)),
    const SizedBox(width: 10),
    Expanded(child: _TopCard(label: 'لوحاتي', count: myCount, icon: Icons.card_giftcard_rounded, iconBg: Color(0xFF8B6CFF), grad: const LinearGradient(colors: [Color(0xFFDED6FF), Color(0xFF9F86FF)]), onTap: onBoards)),
  ]);
}

class _TopCard extends StatelessWidget {
  const _TopCard({required this.label, required this.icon, required this.iconBg, required this.grad, this.count, required this.onTap});
  final String label; final IconData icon; final Color iconBg; final Gradient grad; final int? count; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16), child: Container(height: 74, padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12), decoration: BoxDecoration(gradient: grad, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: 0.12))), child: Row(children: [
    Container(width: 38, height: 38, decoration: BoxDecoration(color: iconBg, borderRadius: BorderRadius.circular(10)), child: Icon(icon, size: 20, color: _kDeep)),
    const SizedBox(width: 10),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
      Text(label, style: const TextStyle(color: _kDeep, fontSize: 13, fontWeight: FontWeight.w800)),
      if (count != null) Text('$count رسمة', style: TextStyle(color: _kDeep.withValues(alpha: 0.65), fontSize: 11, fontWeight: FontWeight.w600)),
    ])),
    const Icon(Icons.chevron_left_rounded, size: 18, color: _kDeep),
  ])));
}

class _Filters extends StatelessWidget {
  const _Filters({required this.age, required this.diff, required this.onAge, required this.onDiff});
  final TraceFilterAge age; final TraceFilterDiff diff; final ValueChanged<TraceFilterAge> onAge; final ValueChanged<TraceFilterDiff> onDiff;
  @override
  Widget build(BuildContext context) => SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
    _ChipGroup<TraceFilterAge>(label: 'العمر', values: TraceFilterAge.values, current: age, labelFor: (v) => switch (v) { TraceFilterAge.all => 'الكل', TraceFilterAge.age3_5 => '3-5', TraceFilterAge.age6_8 => '6-8', TraceFilterAge.age9_12 => '9-12', }, onPick: onAge),
    const SizedBox(width: 8),
    _ChipGroup<TraceFilterDiff>(label: 'الصعوبة', values: TraceFilterDiff.values, current: diff, labelFor: (v) => switch (v) { TraceFilterDiff.all => 'الكل', TraceFilterDiff.easy => 'سهل', TraceFilterDiff.medium => 'متوسط', TraceFilterDiff.hard => 'صعب', }, onPick: onDiff),
  ]));
}

class _ChipGroup<T extends Enum> extends StatelessWidget {
  const _ChipGroup({required this.label, required this.values, required this.current, required this.labelFor, required this.onPick});
  final String label; final List<T> values; final T current; final String Function(T) labelFor; final ValueChanged<T> onPick;
  @override
  Widget build(BuildContext context) => Row(children: [
    Text('$label:', style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600)),
    const SizedBox(width: 6),
    ...values.map((v) => Padding(padding: const EdgeInsetsDirectional.only(end: 6), child: ChoiceChip(label: Text(labelFor(v), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)), selected: v == current, onSelected: (sel) { if (sel) onPick(v); }, selectedColor: _kGold, backgroundColor: Colors.white.withValues(alpha: 0.10), labelStyle: TextStyle(color: v == current ? _kDeep : Colors.white70)))),
  ]);
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, this.subtitle});
  final String title; final String? subtitle;
  @override
  Widget build(BuildContext context) => Row(children: [
    Container(width: 4, height: 18, decoration: BoxDecoration(color: _kGold, borderRadius: BorderRadius.circular(999))),
    const SizedBox(width: 8),
    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)), if (subtitle != null) Text(subtitle!, style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w500))])),
  ]);
}

class _TraceCard extends StatelessWidget {
  const _TraceCard({required this.spec, required this.onTap});
  final TraceCategorySpec spec;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final hasImg = spec.bestDisplayUrl != null;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [spec.gradientStart, spec.gradientEnd]),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.13)),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.22), blurRadius: 12, offset: const Offset(0, 6))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          if (hasImg) Positioned.fill(child: hasImg ? _ImgThumb(url: spec.bestDisplayUrl!) : const SizedBox()),
          if (!hasImg) Positioned(top: 14, right: 14, child: Icon(spec.icon, size: 34, color: Colors.white.withValues(alpha: 0.85))),
          PositionedDirectional(start: 0, end: 0, bottom: 0, child: Container(padding: const EdgeInsets.fromLTRB(10, 8, 10, 8), decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.28)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(spec.label, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800), maxLines: 1),
            const SizedBox(height: 2),
            Row(children: [
              Container(width: 58, height: 6, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(999)), child: FractionallySizedBox(alignment: Alignment.centerRight, widthFactor: spec.count == 0 ? 0 : (spec.progress / (spec.count == 0 ? 1 : spec.count)).clamp(0.0, 1.0), child: Container(decoration: BoxDecoration(color: _kGold, borderRadius: BorderRadius.circular(999))))),
              const SizedBox(width: 6),
              Text('${spec.progress}/${spec.count}', style: const TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600)),
            ]),
          ]))),
          Positioned(top: 8, left: 8, child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: _kDeep.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(999)), child: Text(spec.labelEn, style: const TextStyle(color: Colors.white70, fontSize: 8, fontWeight: FontWeight.w600)))),
        ]),
      ),
    );
  }
}

class _ImgThumb extends StatelessWidget {
  const _ImgThumb({required this.url});
  final String url;
  @override
  Widget build(BuildContext context) {
    if (url.startsWith('http')) return Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox(), opacity: const AlwaysStoppedAnimation(0.55));
    return Image.asset(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox(), opacity: const AlwaysStoppedAnimation(0.55));
  }
}

class _ProgressStrip extends StatelessWidget {
  const _ProgressStrip({required this.total, required this.done});
  final int total; final int done;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF3B1F6E), Color(0xFF1D1546)]), borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white.withValues(alpha: 0.08))),
    child: Row(children: [
      const Icon(Icons.emoji_events_rounded, color: _kGold, size: 22),
      const SizedBox(width: 10),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('إنجازك في التتبّع', style: TextStyle(color: Colors.white70, fontSize: 11)),
        const SizedBox(height: 6),
        Stack(children: [
          Container(height: 8, decoration: BoxDecoration(color: Colors.white12, borderRadius: BorderRadius.circular(999))),
          FractionallySizedBox(widthFactor: (done / total).clamp(0.0, 1.0), child: Container(height: 8, decoration: BoxDecoration(gradient: const LinearGradient(colors: [_kGold, Color(0xFFFF9F45)]), borderRadius: BorderRadius.circular(999)))),
        ]),
      ])),
      const SizedBox(width: 10),
      Text('$done/$total', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
    ]),
  );
}

