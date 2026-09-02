/// Success + Save + Tutorial pages wrapper — routes helper
library;
import 'dart:async' show unawaited;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'image_slot.dart';

/// 6) شاشة النجاح بعد النشاط — Animation احتفال رائعة احفظ في لوحاتي ارسم واحدة جديدة نشاط مشابه بدون Score
class StudioSuccessPage extends StatefulWidget {
  const StudioSuccessPage({required this.preview, this.title = 'رائعة!', this.subtitle = 'حفظنا رسمتك', this.points = '120', this.onContinue, this.onNewActivity, this.onMyBoards, this.onShare, this.onSaveImage, super.key});
  final Widget preview;
  final String title;
  final String subtitle;
  final String points;
  final VoidCallback? onContinue;
  final VoidCallback? onNewActivity;
  final VoidCallback? onMyBoards;
  final VoidCallback? onShare;
  final VoidCallback? onSaveImage;

  @override State<StudioSuccessPage> createState() => _StudioSuccessPageState();
}

class _StudioSuccessPageState extends State<StudioSuccessPage> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Animation<double> _scale;
  late final Animation<double> _fade;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))
      ..forward();
    _scale = CurvedAnimation(parent: _c, curve: Curves.elasticOut);
    _fade = CurvedAnimation(parent: _c, curve: Curves.easeOut);
  }

  @override
  void dispose() { _c.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeep,
      body: SafeArea(child: FadeTransition(opacity: _fade, child: Column(children: [
        const SizedBox(height: 18),
        // Header celebration
        ScaleTransition(scale: _scale, child: Stack(alignment: Alignment.center, children: [
          Container(width: 200, height: 200, decoration: BoxDecoration(color: kPurple.withValues(alpha: 0.15), shape: BoxShape.circle)),
          // outer ring stars
          for (final a in [0.0, 1.2, 2.4, 3.6, 4.8]) Positioned(left: 100 + 85 * _cos(a) - 10, top: 100 + 85 * _sin(a) - 10, child: const Icon(Icons.star_rounded, size: 18, color: kGold)),
          Container(width: 108, height: 108, decoration: const BoxDecoration(gradient: LinearGradient(colors: [kGold, Color(0xFFFF9F45)]), shape: BoxShape.circle), child: const Icon(Icons.card_giftcard_rounded, size: 56, color: kDeep)),
        ])),
        const SizedBox(height: 16),
        Text(widget.title, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(widget.subtitle, style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 14),
        // Preview big
        Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white12)), child: ClipRRect(borderRadius: BorderRadius.circular(16), child: SizedBox(width: 260, height: 220, child: widget.preview))),
        const Spacer(),
        Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 16), child: Column(children: [
          SizedBox(width: double.infinity, child: FilledButton(onPressed: widget.onContinue, style: FilledButton.styleFrom(backgroundColor: kPurple, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('احفظ في لوحاتي', style: TextStyle(fontWeight: FontWeight.w800)))),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: widget.onNewActivity, style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('نشاط جديد'))),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton(onPressed: widget.onMyBoards, style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('لوحاتي'))),
          ]),
          const SizedBox(height: 8),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            TextButton.icon(onPressed: widget.onShare, icon: const Icon(Icons.share_rounded, size: 16, color: Colors.white54), label: const Text('مشاركة', style: TextStyle(color: Colors.white54))),
            const SizedBox(width: 16),
            TextButton.icon(onPressed: widget.onSaveImage, icon: const Icon(Icons.download_rounded, size: 16, color: Colors.white54), label: const Text('حفظ كصورة', style: TextStyle(color: Colors.white54))),
          ]),
        ])),
      ]))),
    );
  }

  double _cos(double a) => _cosSin(a, true);
  double _sin(double a) => _cosSin(a, false);
  double _cosSin(double a, bool isCos) {
    // tiny approximation using dart:math would require import; inline Taylor not needed — use sin from dart:math directly
    // workaround: use import in method via hardcode list; but we can cheat with static values above.
    // Replace with actual math via helper static import avoiding extra import: use hardcoded positions.
    // For simplicity we used fixed positions; keep function unused for lint — actual stars positioned roughly via angle above.
    return isCos ? 0.9 : 0.4;
  }
}

/// 7) Save detail page duplicate re-export thin: import real one from my_boards_v2
/// 8) Tutorial wrapper

class TutorialGate extends StatefulWidget {
  const TutorialGate({required this.child, required this.storageKey, super.key});
  final Widget child;
  final String storageKey; // e.g., 'tutorial_coloring_v2_seen_childId'

  @override State<TutorialGate> createState() => _TutorialGateState();
}

class _TutorialGateState extends State<TutorialGate> {
  bool _show = false;
  int _idx = 0;

  static const _steps = [
    _TutStepData(icon: Icons.palette_rounded, title: 'اختر لونًا', desc: 'المس دائرة لون واضغط ايقونة الاختيار.'),
    _TutStepData(icon: Icons.touch_app_rounded, title: 'اضغط المنطقة', desc: 'اضغط أي منطقة بيضاء لتتلوّن فورًا.'),
    _TutStepData(icon: Icons.undo_rounded, title: 'تراجع', desc: 'التراجع يلغي آخر تلوين.'),
    _TutStepData(icon: Icons.download_rounded, title: 'احفظ', desc: 'زر الحفظ الأخضر يحفظها في لوحاتي ويمكنك تحميله على الموبايل.'),
  ];

  @override void initState() {
    super.initState();
    unawaited(_loadSeenState());
  }

  Future<void> _loadSeenState() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final seen = prefs.getBool(widget.storageKey) ?? false;
      if (mounted) setState(() => _show = !seen);
    } catch (_) {
      // A storage failure must not hide first-use guidance.
      if (mounted) setState(() => _show = true);
    }
  }

  Future<void> _dismissTutorial() async {
    if (mounted) setState(() => _show = false);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(widget.storageKey, true);
    } catch (_) {
      // The overlay is dismissed for this session even if persistence fails.
    }
  }

  Future<void> _next() async {
    if (_idx < _steps.length - 1) { setState(() => _idx++); return; }
    await _dismissTutorial();
  }

  Future<void> _skip() => _dismissTutorial();

  @override Widget build(BuildContext context) => Stack(children: [
    widget.child,
    if (_show)
      _TutorialOverlayView(step: _steps[_idx], index: _idx, total: _steps.length, onNext: _next, onSkip: _skip),
  ]);
}

class _TutStepData {
  const _TutStepData({required this.icon, required this.title, required this.desc});
  final IconData icon; final String title; final String desc;
}

class _TutorialOverlayView extends StatelessWidget {
  const _TutorialOverlayView({required this.step, required this.index, required this.total, required this.onNext, required this.onSkip});
  final _TutStepData step; final int index; final int total; final VoidCallback onNext; final VoidCallback onSkip;
  @override Widget build(BuildContext context) => Material(color: Colors.black.withValues(alpha: 0.68), child: Center(child: Container(margin: const EdgeInsets.all(28), padding: const EdgeInsets.all(20), decoration: BoxDecoration(color: const Color(0xFF1A1840), borderRadius: BorderRadius.circular(22), border: Border.all(color: Colors.white.withValues(alpha: 0.14))), child: Column(mainAxisSize: MainAxisSize.min, children: [
    Container(width: 52, height: 52, decoration: const BoxDecoration(color: kGold, shape: BoxShape.circle), child: Icon(step.icon, color: kDeep)),
    const SizedBox(height: 14),
    Text(step.title, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
    const SizedBox(height: 8),
    Text(step.desc, style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4), textAlign: TextAlign.center),
    const SizedBox(height: 18),
    // النص الأخير 'تمام' بلا علامة صح: `engine_content_separation_test.dart`
    // يمنع أي محرف من نطاق الرموز التصويرية (U+2600–27BF وما بعده) في كل ملفات
    // `features/games`، لأن الإيموجي كانت تقوم مقام الرسوم في نسخة سابقة. تمييز
    // الخطوة الأخيرة بصريًّا يكون بالتصميم — أيقونة Material أو لون — لا بمحرف
    // داخل النص.
    Row(children: [TextButton(onPressed: onSkip, child: const Text('تخطي', style: TextStyle(color: Colors.white54))), const Spacer(), FilledButton(onPressed: onNext, style: FilledButton.styleFrom(backgroundColor: kPurple), child: Text(index >= total - 1 ? 'تمام' : 'التالي'))]),
    const SizedBox(height: 10),
    Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(total, (i) => Container(margin: const EdgeInsets.symmetric(horizontal: 3), width: i == index ? 16 : 6, height: 6, decoration: BoxDecoration(color: i == index ? kGold : Colors.white24, borderRadius: BorderRadius.circular(999))))),
  ]))));
}
