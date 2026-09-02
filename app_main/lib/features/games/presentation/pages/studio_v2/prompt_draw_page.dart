/// 3) ارسم من الفكرة — Prompt كبير Illustration صغيرة Canvas كبير أدوات رسم زر فكرة جديدة Creative Challenge
/// Real controller + PNG capture + R2-first. Preserves transparent batch guard.
library;
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

import 'image_slot.dart';
import '../../../engine/free_draw_surface.dart';
import '../../../engine/game_pack.dart';
import '../../../engine/game_services.dart';
import '../../../engine/game_session_controller.dart';
import '../../../data/creation_document.dart';
import '../../../data/local_creation_store.dart';

class PromptDrawPage extends StatefulWidget {
  const PromptDrawPage({required this.childId, required this.store, this.promptText, this.promptImageUrl, super.key});
  final String childId;
  final LocalCreationStore store;
  final String? promptText;
  final String? promptImageUrl;

  @override
  State<PromptDrawPage> createState() => _PromptDrawPageState();
}

class _PromptDrawPageState extends State<PromptDrawPage> {
  late String _prompt;
  late CreationDocument _doc;
  late GameSessionController _gameCtrl;
  final GlobalKey _canvasKey = GlobalKey();
  final FreeDrawController _drawController = FreeDrawController();
  bool _saving = false;

  static const _prompts = [
    'ارسم مركبة فضائية في حديقة النجوم',
    'ارسم قلعة سحرية في الغابة',
    'ارسم ديناصور يركب دراجة',
    'ارسم مدينتُك تحت البحر',
  ];

  void _newIdea() {
    final idx = _prompts.indexOf(_prompt);
    setState(() => _prompt = _prompts[(idx + 1) % _prompts.length]);
  }

  @override
  void initState() {
    super.initState();
    _prompt = widget.promptText ?? _prompts.first;
    _doc = CreationDocument(
      version: kCreationDocVersion,
      mode: 'prompt_draw',
      canvasWidth: 1024,
      canvasHeight: 1024,
      boardTitle: 'فكرة جديدة',
      creationType: CreationType.promptDrawing,
      palette: const ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2', '#FF9F1C', '#22C55E', '#000000'],
    );
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-prompt-draw',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {'images': <String>[], 'audio': []},
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.prompt_draw.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {'enabled': false, 'palette': _doc.palette},
        },
      ],
    });
    _gameCtrl = GameSessionController(
      pack: pack,
      gameId: 'studio-prompt-draw',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: const _NoopReporter(),
      eventIdFactory: () => 'prompt-${DateTime.now().microsecondsSinceEpoch}',
      initialCreationJson: _doc.toJsonString(),
    );
  }

  @override
  void dispose() {
    _gameCtrl.dispose();
    super.dispose();
  }

  Future<Uint8List> _capturePng() async {
    try {
      final boundary = _canvasKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return _tinyTransparentPngBytes();
      final img = await boundary.toImage(pixelRatio: 3.0);
      final bd = await img.toByteData(format: ui.ImageByteFormat.png);
      final bytes = bd?.buffer.asUint8List();
      if (bytes == null || bytes.isEmpty) return _tinyTransparentPngBytes();
      return bytes;
    } catch (_) {
      return _tinyTransparentPngBytes();
    }
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      String docJson = _doc.toJsonString();
      int docVer = _doc.version;
      try {
        final dynamic ctrl = _gameCtrl;
        final pj = ctrl.pendingDocumentJson as String?;
        final pv = ctrl.pendingDocumentVersion as int?;
        if (pj != null) {
          docJson = pj;
          if (pv != null) docVer = pv;
        }
      } catch (_) {}
      final pngBytes = await _capturePng();
      await widget.store.saveDocumentDirect(
        childId: widget.childId,
        gameId: 'studio-prompt',
        drawingMode: 'prompt_draw',
        documentJson: docJson,
        documentVersion: docVer,
        pngBytes: pngBytes,
        width: 1024,
        height: 1024,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم الحفظ في لوحاتي')));
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => PromptSuccessPage(prompt: _prompt)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeep,
      appBar: deepAppBar(context, 'ارسم من الفكرة', actions: [
        Padding(padding: const EdgeInsetsDirectional.only(end: 6), child: _chip('معاينة', Icons.remove_red_eye_outlined)),
        const SizedBox(width: 6),
        Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: _circle(Icons.help_outline_rounded)),
      ]),
      body: Column(children: [
        Container(
          margin: const EdgeInsets.fromLTRB(16, 10, 16, 0),
          padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
          decoration: BoxDecoration(
            gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFC24E7C), Color(0xFF6E2247)]),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: Colors.white10),
          ),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 42, height: 42, decoration: BoxDecoration(color: const Color(0xFFFFD34D), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.lightbulb_rounded, color: kDeep)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('تحدي اليوم', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(_prompt, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800, height: 1.3)),
            ])),
            const SizedBox(width: 8),
            InkWell(onTap: _newIdea, borderRadius: BorderRadius.circular(999), child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)), child: const Text('فكرة جديدة', style: TextStyle(color: kDeep, fontWeight: FontWeight.w800, fontSize: 11)))),
          ]),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20, offset: const Offset(0, 10))]),
            clipBehavior: Clip.antiAlias,
            child: Stack(children: [
              if (widget.promptImageUrl != null) Positioned.fill(child: Opacity(opacity: 0.15, child: smartImage(widget.promptImageUrl, w: double.infinity, h: double.infinity, fit: BoxFit.cover, fallbackAsset: 'assets/images/coloring/v2/bird.png'))),
              FreeDrawSurface(
                controller: _gameCtrl,
                drawController: _drawController,
                initialDocument: _doc,
                canvasRepaintBoundaryKey: _canvasKey,
              ),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(children: [
            Expanded(child: _bottomBtn(label: 'إعادة', icon: Icons.refresh_rounded, color: const Color(0xFF1E2A6A), onTap: _drawController.clear)),
            const SizedBox(width: 8),
            Expanded(child: _bottomBtn(label: 'تلميح', icon: Icons.lightbulb_rounded, color: kGold, fg: kDeep, onTap: () { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('استخدم خيالك وأضف تفاصيل جميلة للرسمة!'))); })),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: FilledButton(
                onPressed: _saving ? null : _save,
                style: FilledButton.styleFrom(backgroundColor: kPurple, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)), padding: const EdgeInsets.symmetric(vertical: 12)),
                child: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Text('حفظ', style: TextStyle(fontWeight: FontWeight.w800)),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 16),
      ]),
    );
  }

  Widget _chip(String label, IconData icon) => Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(999), border: Border.all(color: Colors.white12)), child: Row(children: [Icon(icon, size: 14, color: Colors.white70), const SizedBox(width: 4), Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600))]));
  Widget _circle(IconData icon) => Container(width: 32, height: 32, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.10), shape: BoxShape.circle), child: Icon(icon, size: 18, color: Colors.white70));
  Widget _bottomBtn({required String label, required IconData icon, required Color color, Color? bg, Color? fg, VoidCallback? onTap}) {
    final background = bg ?? color;
    final foreground = fg ?? Colors.white;
    return InkWell(onTap: onTap, borderRadius: BorderRadius.circular(999), child: Container(padding: const EdgeInsets.symmetric(vertical: 10), decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, size: 16, color: foreground), const SizedBox(width: 6), Text(label, style: TextStyle(color: foreground, fontSize: 12, fontWeight: FontWeight.w800))])));
  }
}

class _NoopReporter implements AttemptReporter {
  const _NoopReporter();
  @override
  Future<void> report(GameAttempt attempt) async {}
}

class PromptSuccessPage extends StatelessWidget {
  const PromptSuccessPage({required this.prompt, super.key});
  final String prompt;
  @override
  Widget build(BuildContext context) => SuccessPageV2(
    title: 'رائعة!',
    subtitle: 'حفظنا رسمتك',
    previewAsset: null,
    pointsText: '120 نقطة',
    onContinue: () => Navigator.of(context).maybePop(),
    onNew: () => Navigator.of(context).popUntil((r) => r.isFirst),
  );
}

Uint8List _tinyTransparentPngBytes() => Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

/// 6) شاشة النجاح بعد النشاط — عرض الرسمة Animation احتفال رائعة احفظ في لوحاتي ارسم واحدة جديدة نشاط مشابه بدون Score
class SuccessPageV2 extends StatelessWidget {
  const SuccessPageV2({required this.title, required this.subtitle, this.previewAsset, this.pointsText = '120 نقطة', this.onContinue, this.onNew, this.onSimilar, super.key});
  final String title;
  final String subtitle;
  final String? previewAsset;
  final String pointsText;
  final VoidCallback? onContinue;
  final VoidCallback? onNew;
  final VoidCallback? onSimilar;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeep,
      body: SafeArea(child: Column(children: [
        const SizedBox(height: 24),
        // Celebration animation placeholder: stars + gift
        Stack(alignment: Alignment.center, children: [
          Container(width: 180, height: 180, decoration: BoxDecoration(color: kPurple.withValues(alpha: 0.15), shape: BoxShape.circle)),
          const Icon(Icons.card_giftcard_rounded, size: 96, color: kGold),
          Positioned(top: 10, right: 30, child: Icon(Icons.star_rounded, size: 20, color: kGold.withValues(alpha: 0.9))),
          Positioned(top: 40, left: 20, child: Icon(Icons.star_rounded, size: 14, color: kCyan.withValues(alpha: 0.9))),
        ]),
        const SizedBox(height: 16),
        Text(title, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900)),
        const SizedBox(height: 6),
        Text(subtitle, style: const TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600)),
        const SizedBox(height: 12),
        Container(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(999)), child: Text(pointsText, style: const TextStyle(color: kGold, fontWeight: FontWeight.w800))),
        const SizedBox(height: 20),
        if (previewAsset != null) Container(width: 200, height: 200, clipBehavior: Clip.antiAlias, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18)), child: smartImage(previewAsset, w: 200, h: 200, fit: BoxFit.cover)),
        const Spacer(),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: Column(children: [
          SizedBox(width: double.infinity, child: FilledButton(onPressed: onContinue, style: FilledButton.styleFrom(backgroundColor: kPurple, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('متابعة الرسم', style: TextStyle(fontWeight: FontWeight.w800)))),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: OutlinedButton(onPressed: onNew, style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('نشاط جديد'))),
            const SizedBox(width: 8),
            Expanded(child: OutlinedButton(onPressed: onSimilar, style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('لوحاتي'))),
          ]),
          const SizedBox(height: 8),
          TextButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: const Text('مشاركة  |  حفظ كصورة', style: TextStyle(color: Colors.white54))),
        ])),
        const SizedBox(height: 12),
      ])),
    );
  }
}
