/// صفحة Category داخل التلوين — فلاتر البيانات المتاحة فعليًا: العمر والصعوبة.
library;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'image_slot.dart';
import '../coloring/coloring_home_v2.dart' show FeaturedColoringSpec;

enum AgeBand { all, age3_5, age6_8, age9_12 }
enum Diff { all, easy, medium, hard }

class CategoryInsideColoringPage extends StatefulWidget {
  const CategoryInsideColoringPage({required this.title, required this.items, this.heroUrl, this.onOpen, super.key});
  final String title;
  final List<FeaturedColoringSpec> items;
  final String? heroUrl;
  final void Function(FeaturedColoringSpec spec)? onOpen;

  @override State<CategoryInsideColoringPage> createState() => _CategoryInsideState();
}

class _CategoryInsideState extends State<CategoryInsideColoringPage> {
  AgeBand _age = AgeBand.all;
  Diff _diff = Diff.all;

  List<FeaturedColoringSpec> get _filtered => widget.items.where((spec) {
    return _matchesAge(spec) && _matchesDifficulty(spec);
  }).toList(growable: false);

  bool _matchesAge(FeaturedColoringSpec spec) {
    final range = switch (_age) {
      AgeBand.all => null,
      AgeBand.age3_5 => (3, 5),
      AgeBand.age6_8 => (6, 8),
      AgeBand.age9_12 => (9, 12),
    };
    return range == null || spec.ageMin <= range.$2 && spec.ageMax >= range.$1;
  }

  bool _matchesDifficulty(FeaturedColoringSpec spec) {
    if (_diff == Diff.all) return true;
    final normalized = switch (spec.difficulty.trim().toLowerCase()) {
      'easy' || 'سهل' => Diff.easy,
      'medium' || 'متوسط' => Diff.medium,
      'hard' || 'صعب' => Diff.hard,
      _ => Diff.easy,
    };
    return normalized == _diff;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeep,
      appBar: deepAppBar(context, widget.title, actions: [Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: _circle(Icons.search_rounded))]),
      body: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 20), children: [
        if (widget.heroUrl != null)
          Container(height: 120, decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), gradient: const LinearGradient(colors: [Color(0xFF6A3DF2), Color(0xFF241A5E)])), child: ClipRRect(borderRadius: BorderRadius.circular(18), child: smartImage(widget.heroUrl, w: double.infinity, h: 120, fit: BoxFit.cover, fallbackAsset: 'assets/images/coloring/v2/bird.png'))),
        const SizedBox(height: 12),
        SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: [
          _filterChip<AgeBand>(label: 'العمر', values: AgeBand.values, current: _age, labelFor: (value) => switch (value) { AgeBand.all => 'الكل', AgeBand.age3_5 => '3-5', AgeBand.age6_8 => '6-8', AgeBand.age9_12 => '9-12' }, onPick: (value) => setState(() => _age = value)),
          const SizedBox(width: 8),
          _filterChip<Diff>(label: 'الصعوبة', values: Diff.values, current: _diff, labelFor: (value) => switch (value) { Diff.all => 'الكل', Diff.easy => 'سهل', Diff.medium => 'متوسط', Diff.hard => 'صعب' }, onPick: (value) => setState(() => _diff = value)),
        ])),
        const SizedBox(height: 12),
        if (_filtered.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 36),
            child: Center(child: Text('لا توجد رسومات بهذه الفلاتر بعد', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700))),
          )
        else
        GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 180, childAspectRatio: 0.85, crossAxisSpacing: 10, mainAxisSpacing: 10), itemCount: _filtered.length, itemBuilder: (_, i) => _ColorTile(spec: _filtered[i], onTap: () => widget.onOpen?.call(_filtered[i]))),
      ]),
    );
  }

  Widget _filterChip<T extends Enum>({required String label, required List<T> values, required T current, required String Function(T) labelFor, required ValueChanged<T> onPick}) =>
      Row(children: [
        Text('$label:', style: const TextStyle(color: Colors.white54, fontSize: 11, fontWeight: FontWeight.w600)),
        const SizedBox(width: 6),
        ...values.map((value) => Padding(
              padding: const EdgeInsetsDirectional.only(end: 6),
              child: ChoiceChip(
                label: Text(labelFor(value), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
                selected: value == current,
                onSelected: (selected) { if (selected) onPick(value); },
                selectedColor: kGold,
                backgroundColor: Colors.white.withValues(alpha: 0.10),
                labelStyle: TextStyle(color: value == current ? kDeep : Colors.white70),
              ),
            )),
      ]);

  Widget _circle(IconData icon) => Container(width: 32, height: 32, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.10), shape: BoxShape.circle), child: Icon(icon, size: 18, color: Colors.white70));
}

class _ColorTile extends StatelessWidget {
  const _ColorTile({required this.spec, required this.onTap});
  final FeaturedColoringSpec spec;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(18), child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white12)), clipBehavior: Clip.antiAlias, child: Stack(children: [
    Positioned.fill(child: smartImage(spec.bestDisplayUrl, w: double.infinity, h: double.infinity, fit: BoxFit.cover)),
    Positioned(bottom: 0, left: 0, right: 0, child: Container(padding: const EdgeInsets.fromLTRB(10, 8, 10, 8), color: Colors.black.withValues(alpha: 0.48), child: Text(spec.label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w800), maxLines: 1))),
    if (spec.isNew) Positioned(top: 8, left: 8, child: goldPill('جديد')),
  ])));
}

/// 8) تعليم أول مرة / Tutorial Overlay قصير اختر لون اضغط المنطقة تراجع احفظ
class TutorialOverlay extends StatelessWidget {
  const TutorialOverlay({required this.steps, required this.current, required this.onNext, required this.onSkip, super.key});
  final List<TutorialStep> steps;
  final int current;
  final VoidCallback onNext;
  final VoidCallback onSkip;

  @override
  Widget build(BuildContext context) {
    final step = steps[current.clamped];
    return Material(color: Colors.black.withValues(alpha: 0.72), child: Stack(children: [
      Positioned.fill(child: GestureDetector(onTap: onNext)),
      Center(child: Container(margin: const EdgeInsets.all(24), padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: const Color(0xFF1A1840), borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: 0.14))), child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 48, height: 48, decoration: const BoxDecoration(color: kGold, shape: BoxShape.circle), child: Icon(step.icon, color: kDeep)),
        const SizedBox(height: 12),
        Text(step.title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(step.desc, style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4), textAlign: TextAlign.center),
        const SizedBox(height: 16),
        Row(children: [
          TextButton(onPressed: onSkip, child: const Text('تخطي', style: TextStyle(color: Colors.white54))),
          const Spacer(),
          // نفس نص الخطوة الأخيرة في `success_and_save.dart`: النسختان تعرضان
          // الجولة نفسها في مسارَين، فاختلاف النص بينهما ارتباك لا تنويع.
          FilledButton(onPressed: onNext, style: FilledButton.styleFrom(backgroundColor: kPurple), child: Text(current >= steps.length - 1 ? 'تمام' : 'التالي')),
        ]),
        const SizedBox(height: 6),
        Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(steps.length, (i) => Container(margin: const EdgeInsets.symmetric(horizontal: 3), width: i == current ? 16 : 6, height: 6, decoration: BoxDecoration(color: i == current ? kGold : Colors.white24, borderRadius: BorderRadius.circular(999))))),
      ]))),
      Positioned(top: 40, right: 16, child: InkWell(onTap: onSkip, child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(999)), child: const Text('اغلاق', style: TextStyle(color: Colors.white, fontSize: 11))))),
    ]));
  }
}

class TutorialStep {
  const TutorialStep({required this.icon, required this.title, required this.desc});
  final IconData icon; final String title; final String desc;
}

const kColoringTutorialSteps = [
  TutorialStep(icon: Icons.palette_rounded, title: 'اختر لونًا', desc: 'المس أي دائرة لون في الأسفل. اللون المختار يظهر محددا.'),
  TutorialStep(icon: Icons.touch_app_rounded, title: 'اضغط المنطقة', desc: 'اضغط أي منطقة بيضاء في الرسمة لتتلوّن فورًا باللون المختار.'),
  TutorialStep(icon: Icons.undo_rounded, title: 'تراجع', desc: 'زر التراجع البنفسجي يلغي آخر تلوين. يمكنك العودة بسهولة.'),
  TutorialStep(icon: Icons.download_rounded, title: 'احفظ', desc: 'عندما تكمل، اضغط حفظ الأخضر - سنحفظها في لوحاتي ويمكنك تحميلها على الموبايل ومشاركتها.'),
];

extension on int { int get clamped => this; } // placeholder avoids extra math

/// 10) حالة النشاط الجاري — Preview من تلوينه الحقيقي تابع التلوين نسبة/عدد المناطق
class ActivityInProgressCard extends StatelessWidget {
  const ActivityInProgressCard({required this.title, required this.thumbBytes, required this.filled, required this.total, required this.onContinue, super.key});
  final String title; final Uint8List? thumbBytes; final int filled; final int total; final VoidCallback onContinue;
  @override
  Widget build(BuildContext context) {
    final pct = total == 0 ? 0.0 : (filled / total).clamp(0.0, 1.0);
    return InkWell(onTap: onContinue, borderRadius: BorderRadius.circular(18), child: Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF2A5BE0), Color(0xFF16307F)]), borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white12)), child: Row(children: [
      Container(width: 64, height: 64, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12)), clipBehavior: Clip.antiAlias, child: thumbBytes != null ? Image.memory(thumbBytes!, fit: BoxFit.cover) : const Icon(Icons.image_rounded, color: Color(0xFF9FA3C0))),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13)),
        const SizedBox(height: 6),
        Stack(children: [Container(height: 6, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(999))), FractionallySizedBox(widthFactor: pct, child: Container(height: 6, decoration: BoxDecoration(color: kGold, borderRadius: BorderRadius.circular(999))))]),
        const SizedBox(height: 4),
        Text('$filled من $total منطقة • ${(pct * 100).round()}% — تابع التلوين', style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
      ])),
      const SizedBox(width: 8),
      Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), decoration: BoxDecoration(color: kGold, borderRadius: BorderRadius.circular(999)), child: const Text('متابعة ▶', style: TextStyle(color: kDeep, fontWeight: FontWeight.w800, fontSize: 11))),
    ])));
  }
}
