/// ارسم مثلي — Board premium matching screenshot 2
/// Dark cosmic container, reference card top, steps dots, dashed canvas ghost, toolbars, gold save.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter/services.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/creative_catalogue_provider.dart';
import '../../data/creation_document.dart';
import '../../data/local_creation_store.dart';
import '../../engine/free_draw_surface.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_services.dart';
import '../../engine/game_session_controller.dart';
import '../studio/studio_app_bar.dart';
import '../widgets/drawing_asset.dart';
import 'reference_catalogue_page.dart';

class ReferenceDrawingPage extends StatefulWidget {
  const ReferenceDrawingPage({
    required this.childId,
    required this.activity,
    required this.creationStore,
    this.onSaved,
    super.key,
  });

  final String childId;
  final ReferenceActivity activity;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  @override
  State<ReferenceDrawingPage> createState() => _ReferenceDrawingPageState();
}

class _ReferenceDrawingPageState extends State<ReferenceDrawingPage> {
  bool _showReference = true;
  bool _enlarge = false;
  bool _ghostMode = true; // screenshot shows شبح active

  // `final` لأنهما لا يُعدَّلان: لا يوجد في هذه الشاشة تحكّم في شفافية الشبح ولا
  // تنقّل بين الخطوات، فالقيمتان ثابتتان بحكم الواقع. تركهما متغيّرتين كان يوحي
  // بوجود تفاعل غير موجود — وهو أيضًا ما رصده المحلّل (`prefer_final_fields`).
  // عند إضافة شريط تمرير للشفافية أو أزرار خطوات تُعاد إلى متغيّرات مع `setState`.
  final double _ghostOpacity = 0.34;
  final int _stepIndex = 1; // screenshot: الخطوة 2 من 5

  String _mode = 'شبح'; // خطوات / شبح / مرجعي
  bool _showCompare = false;
  bool _saving = false;
  Uint8List? _drawingPreview;
  final GlobalKey _captureKey = GlobalKey();
  final FreeDrawController _drawCtrl = FreeDrawController();
  List<FreeStroke> _strokes = [];
  late final GameSessionController _ctrl;

  List<_Step> _resolvedSteps(WidgetRef? ref) {
    if (ref != null) {
      final stepsAsync = ref.read(referenceStepsProvider);
      final data = stepsAsync.valueOrNull;
      if (data != null && data.isNotEmpty) {
        final mine = data.where((s) => s.activityId == widget.activity.id).toList()..sort((a, b) => a.order.compareTo(b.order));
        if (mine.isNotEmpty) return mine.map((s) => _Step(s.instructionAr)).toList();
      }
    }
    return _stepMap[widget.activity.id] ?? const [_Step('راقب التفاصيل'), _Step('ارسم الدائرة أولاً ثم أضف الجناح'), _Step('أضف المنقار والعين'), _Step('لوّن بالألوان')];
  }

  @override
  void initState() {
    super.initState();
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'ref-${widget.activity.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {'images': [widget.activity.referenceAssetId], 'audio': <String>[]},
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.ref.${widget.activity.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {'enabled': false, 'palette': ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2', '#FF3B30', '#22C55E', '#000000', '#FFFFFF']},
        },
      ],
    });
    _ctrl = GameSessionController(
      pack: pack,
      gameId: 'ref-${widget.activity.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'ref-${DateTime.now().microsecondsSinceEpoch}',
    );
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    if (_saving) return;
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) { _showMessage('تعذر تجهيز الرسم للحفظ. حاول مرة أخرى.'); return; }
    setState(() => _saving = true);
    final canvasSize = boundary.size;
    final doc = CreationDocument(
      version: kCreationDocVersion,
      mode: 'free_draw',
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      palette: _ctrl.level.coloring?.palette ?? const [],
      strokes: _strokes.map((stroke) => DocStroke.fromFreeStrokeDimensions(stroke, canvasSize.width, canvasSize.height)).toList(growable: false),
      packId: _ctrl.pack.packId,
      levelIndex: _ctrl.levelIndex,
      createdAt: DateTime.now(),
      boardTitle: 'رسمتها من: ${widget.activity.titleAr}',
      creationType: CreationType.referenceCopy,
      referenceActivityId: widget.activity.id,
      referenceAssetId: widget.activity.referenceAssetId,
      referenceTitle: widget.activity.titleAr,
    );
    CreationSaveResult result;
    try {
      result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary, childId: widget.childId, gameId: 'ref-${widget.activity.id}', drawingMode: 'reference_copy', documentJson: doc.toJsonString(), documentVersion: doc.version,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      _showMessage('تعذر الحفظ. رسمتك ما زالت أمامك.');
      return;
    }
    if (!mounted) return;
    setState(() {
      _saving = false;
      if (result.isSuccess && result.creation != null) { _drawingPreview = result.creation!.bytes; _showCompare = true; }
    });
    _showMessage(result.isSuccess ? 'رائع! حفظنا رسمتك.' : 'تعذر الحفظ');
    if (result.isSuccess) widget.onSaved?.call();
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), behavior: SnackBarBehavior.floating, backgroundColor: const Color(0xFF1A0B3E)));
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(builder: (context, ref, _) => _buildPremium(context, ref));
  }

  Widget _buildPremium(BuildContext context, WidgetRef ref) {
    final steps = _resolvedSteps(ref);
    final totalSteps = steps.length.clamp(3, 5);
    final currentStepLabel = steps[_stepIndex.clamp(0, steps.length - 1)].label;

    return Scaffold(
      backgroundColor: const Color(0xFF05081A),
      appBar: const StudioAppBar(
        title: 'ارسم مثلي',
        glyph: Icons.brush_rounded,
        showStar: true,
        actions: [
          StudioBarCircle(icon: Icons.help_outline_rounded, label: 'مساعدة'),
        ],
      ),
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF05081A), Color(0xFF080C2A)])),
        child: Stack(
          children: [
            Positioned.fill(
              child: IgnorePointer(
                ignoring: _showCompare,
                child: Column(
                  children: [
                    // Top reference card
                    Container(
                      margin: const EdgeInsets.fromLTRB(12, 6, 12, 0),
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F1433),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: const Color(0xFF6A3DF2).withValues(alpha: 0.45), width: 1.2),
                        boxShadow: [BoxShadow(color: const Color(0xFF6A3DF2).withValues(alpha: 0.18), blurRadius: 16)],
                      ),
                      child: Row(
                        children: [
                          // Reference image
                          Expanded(
                            flex: 5,
                            child: Container(
                              height: _enlarge ? 220 : 150,
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white10)),
                              clipBehavior: Clip.antiAlias,
                              child: DrawingAsset(assetIdOrPath: widget.activity.referenceAssetId, fit: BoxFit.contain),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 4,
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    Expanded(child: _topBtn(icon: Icons.visibility_off_outlined, label: 'إخفاء', onTap: () => setState(() => _showReference = !_showReference), active: !_showReference)),
                                    const SizedBox(width: 6),
                                    Expanded(child: _topBtn(icon: Icons.zoom_in_rounded, label: 'تكبير', onTap: () => setState(() => _enlarge = !_enlarge))),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(color: const Color(0xFF05081A), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF1E2A6A))),
                                  child: Row(
                                    children: [
                                      for (final m in ['خطوات', 'شبح', 'مرجعي'])
                                        Expanded(
                                          child: InkWell(
                                            onTap: () => setState(() {
                                              _mode = m;
                                              if (m == 'شبح') { _ghostMode = true; }
                                              else if (m == 'مرجعي') { _ghostMode = false; _showReference = true; }
                                              else { _ghostMode = false; }
                                            }),
                                            borderRadius: BorderRadius.circular(10),
                                            child: Container(
                                              padding: const EdgeInsets.symmetric(vertical: 8),
                                              decoration: BoxDecoration(
                                                color: _mode == m ? const Color(0xFF6A3DF2) : Colors.transparent,
                                                borderRadius: BorderRadius.circular(10),
                                              ),
                                              child: Text(m, textAlign: TextAlign.center, style: TextStyle(color: _mode == m ? Colors.white : const Color(0xFF9FA3C0), fontWeight: FontWeight.w800, fontSize: 12)),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Steps progress
                    Container(
                      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
                      decoration: BoxDecoration(color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF1E2A6A))),
                      child: Row(
                        children: [
                          // dots
                          ...List.generate(totalSteps, (i) {
                            final isDone = i < _stepIndex;
                            final isCurrent = i == _stepIndex;
                            return Padding(
                              padding: EdgeInsetsDirectional.only(end: i == totalSteps - 1 ? 0 : 6),
                              child: Container(
                                width: 22, height: 22,
                                decoration: BoxDecoration(
                                  color: isDone ? const Color(0xFF16A34A) : isCurrent ? const Color(0xFFFFD34D) : Colors.transparent,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: isDone ? const Color(0xFF16A34A) : isCurrent ? const Color(0xFFFFD34D) : const Color(0xFF6A3DF2), width: 1.6),
                                ),
                                child: isDone ? const Icon(Icons.check_rounded, size: 14, color: Colors.white) : isCurrent ? const SizedBox() : null,
                              ),
                            );
                          }),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(color: const Color(0xFF2A1A6A), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFF6A3DF2))),
                            child: Text('الخطوة ${_stepIndex + 1} من $totalSteps', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)),
                          ),
                        ],
                      ),
                    ),
                    // Instruction
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.auto_awesome_rounded, size: 16, color: Color(0xFFFFD34D)),
                          const SizedBox(width: 6),
                          Flexible(
                            child: RichText(
                              textAlign: TextAlign.center,
                              text: TextSpan(
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white, fontFamily: 'Tajawal'),
                                children: [
                                  TextSpan(text: '${currentStepLabel.split(' ').first} ', style: const TextStyle(color: Color(0xFFFFD34D))),
                                  TextSpan(text: currentStepLabel.substring(currentStepLabel.split(' ').first.length)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Canvas
                    Expanded(
                      child: Container(
                        margin: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: const Color(0xFF6A3DF2).withValues(alpha: 0.35), width: 1.4),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 12, offset: const Offset(0, 4))],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            // dashed border overlay
                            Positioned.fill(child: CustomPaint(painter: _DashedBorderPainter(color: const Color(0xFFD6D9FF)))),
                            // ghost faint outline when mode ghost
                            if (_ghostMode)
                              Positioned.fill(
                                child: IgnorePointer(
                                  child: Opacity(
                                    opacity: _ghostOpacity,
                                    child: DrawingAsset(assetIdOrPath: widget.activity.referenceAssetId, fit: BoxFit.contain),
                                  ),
                                ),
                              ),
                            // placeholder ghost shape for bird example (if no asset transparent)
                            if (_ghostMode && widget.activity.id == 'ref-cat')
                              const IgnorePointer(child: Center(child: Icon(Icons.pets_rounded, size: 80, color: Color(0xFFB8B8D0)))),
                            FreeDrawSurface(
                              controller: _ctrl,
                              drawController: _drawCtrl,
                              canvasRepaintBoundaryKey: _captureKey,
                              onStrokesChanged: (s) => _strokes = List.of(s),
                            ),
                            // منطقة الرسم badge bottom left
                            PositionedDirectional(
                              bottom: 10, start: 10,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(color: const Color(0xFFE9E6FF), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFF6A3DF2).withValues(alpha: 0.25))),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  const Icon(Icons.brush_rounded, size: 14, color: Color(0xFF6A3DF2)),
                                  const SizedBox(width: 6),
                                  const Text('منطقة الرسم', style: TextStyle(color: Color(0xFF6A3DF2), fontWeight: FontWeight.w800, fontSize: 11)),
                                ]),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Bottom toolbar — undo/redo/clear via draw controller (matches screenshot 2)
                    _bottomToolbar1(context),
                    // Save button gold
                    Padding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          SizedBox(
                            width: double.infinity,
                            child: InkWell(
                              onTap: _saving ? null : _save,
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(colors: [Color(0xFFFFD34D), Color(0xFFFFB800)]),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
                                  boxShadow: [BoxShadow(color: const Color(0xFFFFD34D).withValues(alpha: 0.45), blurRadius: 14, offset: const Offset(0, 6))],
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    if (_saving) const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF1A0B3E)))
                                    else const Icon(Icons.download_rounded, color: Color(0xFF1A0B3E), size: 20),
                                    const SizedBox(width: 8),
                                    Text(_saving ? 'جاري الحفظ...' : 'احفظ رسمتي', style: const TextStyle(color: Color(0xFF1A0B3E), fontWeight: FontWeight.w900, fontSize: 15)),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const Positioned(left: -4, top: -6, child: Text('⭐', style: TextStyle(fontSize: 22))),
                          const Positioned(right: -2, bottom: -4, child: Icon(Icons.cloud_rounded, color: Color(0xFF7EA0FF), size: 22)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_showCompare) Positioned.fill(child: BlockSemantics(child: _buildCompare())),
          ],
        ),
      ),
    );
  }

  Widget _topBtn({required IconData icon, required String label, required VoidCallback onTap, bool active = false}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: active ? const Color(0xFF6A3DF2) : const Color(0xFF1A103A),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFF2A2E6A)),
        ),
        child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 16, color: Colors.white70),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
        ]),
      ),
    );
  }

  Widget _bottomToolbar1(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF1E2A6A))),
      child: Row(
        children: [
          for (final b in [
            (Icons.refresh_rounded, 'من جديد', () => _drawCtrl.clear()),
            (Icons.redo_rounded, 'إعادة', () => _drawCtrl.redo()),
            (Icons.undo_rounded, 'تراجع', () => _drawCtrl.undo()),
            (Icons.volume_up_rounded, 'أعد التعليمات', () => _showMessage('راقب التفاصيل ثم ارسم — ${widget.activity.titleAr}')),
          ])
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: InkWell(
                  onTap: b.$3,
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(color: const Color(0xFF1A103A), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFF2A2E6A))),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(b.$1, size: 16, color: Colors.white70),
                      const SizedBox(width: 4),
                      Flexible(child: Text(b.$2, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    ]),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // بلا معامل `stepsOverride`: لم يُمرَّر قط، والدالة لا تقرؤه — تعرض الصورة
  // المرجعية للنشاط فقط. معامل غير مستخدَم يوحي بمرونة غير موجودة.
  Widget _buildReference() {
    return Semantics(
      label: 'الصورة المرجعية: ${widget.activity.titleAr}',
      image: true,
      child: ColoredBox(color: Colors.white, child: Padding(padding: const EdgeInsets.all(12), child: DrawingAsset(assetIdOrPath: widget.activity.referenceAssetId, fit: BoxFit.contain))),
    );
  }

  Widget _buildCompare() {
    final preview = _drawingPreview;
    void close() => setState(() => _showCompare = false);
    return CallbackShortcuts(
      bindings: {const SingleActivator(LogicalKeyboardKey.escape): close},
      child: Focus(
        autofocus: true,
        child: Material(
          color: Colors.black.withValues(alpha: 0.86),
          child: SafeArea(
            minimum: const EdgeInsets.all(16),
            child: Column(
              children: [
                Row(children: [
                  const Text('قارن رسمتك', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                  const Spacer(),
                  IconButton.filledTonal(onPressed: close, icon: const Icon(Icons.close_rounded)),
                ]),
                const SizedBox(height: 12),
                Expanded(
                  child: Row(children: [
                    Expanded(child: _CompareCard(label: 'المرجع', child: _buildReference())),
                    const SizedBox(width: 12),
                    Expanded(child: _CompareCard(label: 'رسمتي', child: preview == null ? const Center(child: Text('لا توجد معاينة')) : Image.memory(preview, fit: BoxFit.contain))),
                  ]),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CompareCard extends StatelessWidget {
  const _CompareCard({required this.label, required this.child});
  final String label;
  final Widget child;
  @override
  Widget build(BuildContext context) => Card(
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.all(8), child: Text(label, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleSmall)),
          Expanded(child: ColoredBox(color: Colors.white, child: child)),
        ]),
      );
}

class _DashedBorderPainter extends CustomPainter {
  _DashedBorderPainter({required this.color});
  final Color color;
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color..style = PaintingStyle.stroke..strokeWidth = 1.2;
    const dash = 8.0, gap = 6.0;
    final rrect = RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(18));
    final path = Path()..addRRect(rrect);
    final dashed = _dashPath(path, dash, gap);
    canvas.drawPath(dashed, paint);
  }

  Path _dashPath(Path source, double dash, double gap) {
    final dashed = Path();
    for (final metric in source.computeMetrics()) {
      double dist = 0;
      while (dist < metric.length) {
        dashed.addPath(metric.extractPath(dist, dist + dash), Offset.zero);
        dist += dash + gap;
      }
    }
    return dashed;
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

class _Step { const _Step(this.label); final String label; }
const _stepMap = <String, List<_Step>>{
  'ref-cat': [_Step('ابدأ بشكل الرأس'), _Step('أضف الأذنين والجسم'), _Step('أكمل الوجه والذيل')],
  'ref-rocket': [_Step('ارسم جسم الصاروخ'), _Step('أضف النافذة والجناحين'), _Step('أكمل اللهب والتفاصيل')],
  'ref-house2': [_Step('ارسم مربع المنزل'), _Step('أضف السقف'), _Step('أكمل الباب والنوافذ')],
};
class _NoopReporter implements AttemptReporter { @override Future<void> report(GameAttempt attempt) async {} }
