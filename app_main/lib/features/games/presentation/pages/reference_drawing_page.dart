/// ارسم مثلي — reference drawing with phone/tablet layouts, ghost, step-by-step.
/// No scoring, no mastery.
library;

import 'dart:async';
import 'dart:ui' as ui;

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
  bool _ghostMode = false;
  double _ghostOpacity = 0.28;
  int _stepIndex = 0;
  bool _showCompare = false;
  bool _saving = false;
  Uint8List? _drawingPreview;
  final GlobalKey _captureKey = GlobalKey();
  List<FreeStroke> _strokes = [];
  late final GameSessionController _ctrl;

  List<_Step> _resolvedSteps(WidgetRef? ref) {
    // Provider-driven steps (canonical) — fallback to Dart literal for offline safety.
    if (ref != null) {
      final stepsAsync = ref.read(referenceStepsProvider);
      final data = stepsAsync.valueOrNull;
      if (data != null && data.isNotEmpty) {
        final mine =
            data.where((s) => s.activityId == widget.activity.id).toList()
              ..sort((a, b) => a.order.compareTo(b.order));
        if (mine.isNotEmpty) {
          return mine.map((s) => _Step(s.instructionAr)).toList();
        }
      }
    }
    return _stepMap[widget.activity.id] ?? const [];
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
      'assets': {
        'images': [widget.activity.referenceAssetId],
        'audio': <String>[],
      },
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.ref.${widget.activity.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': false,
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2'],
          },
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
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving) return;
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      _showMessage('تعذر تجهيز الرسم للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() => _saving = true);
    final canvasSize = boundary.size;
    final doc = CreationDocument(
      version: kCreationDocVersion,
      mode: 'free_draw',
      canvasWidth: canvasSize.width,
      canvasHeight: canvasSize.height,
      palette: _ctrl.level.coloring?.palette ?? const [],
      strokes: _strokes
          .map(
            (stroke) => DocStroke.fromFreeStrokeDimensions(
              stroke,
              canvasSize.width,
              canvasSize.height,
            ),
          )
          .toList(growable: false),
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
        boundary: boundary,
        childId: widget.childId,
        gameId: 'ref-${widget.activity.id}',
        drawingMode: 'reference_copy',
        documentJson: doc.toJsonString(),
        documentVersion: doc.version,
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
      if (result.isSuccess && result.creation != null) {
        _drawingPreview = result.creation!.bytes;
        _showCompare = true;
      }
    });
    _showMessage(result.isSuccess ? 'رائع! حفظنا رسمتك.' : 'تعذر الحفظ');
    if (result.isSuccess) widget.onSaved?.call();
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<Uint8List?> _captureCurrentDrawing() async {
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return null;
    final longestSide = boundary.size.longestSide;
    final ratio = longestSide <= 0
        ? 1.0
        : (1024 / longestSide).clamp(0.5, 2.0).toDouble();
    ui.Image? image;
    try {
      image = await boundary.toImage(pixelRatio: ratio);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      if (data == null) return null;
      return data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes);
    } catch (_) {
      return null;
    } finally {
      image?.dispose();
    }
  }

  Future<void> _showComparison() async {
    final preview = await _captureCurrentDrawing();
    if (!mounted) return;
    if (preview == null) {
      _showMessage('تعذر تجهيز المقارنة الآن. حاول مرة أخرى.');
      return;
    }
    setState(() {
      _drawingPreview = preview;
      _showCompare = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) => _buildWithSteps(context, ref),
    );
  }

  Widget _buildWithSteps(BuildContext context, WidgetRef ref) {
    final steps = _resolvedSteps(ref);
    final isTablet = MediaQuery.sizeOf(context).width >= 700;
    final referenceWidget = _buildReference(steps);
    final canvasWidget = Stack(
      fit: StackFit.expand,
      children: [
        FreeDrawSurface(
          controller: _ctrl,
          canvasRepaintBoundaryKey: _captureKey,
          onStrokesChanged: (strokes) => _strokes = List.of(strokes),
        ),
        if (_ghostMode)
          Positioned.fill(
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: DrawingAsset(
                  assetIdOrPath: widget.activity.referenceAssetId,
                  fit: BoxFit.contain,
                  opacity: _ghostOpacity,
                ),
              ),
            ),
          ),
      ],
    );

    final Widget content;
    if (isTablet) {
      content = Column(
        children: [
          if (steps.isNotEmpty) _buildStepsBar(steps),
          Expanded(
            child: Row(
              children: [
                if (_showReference)
                  SizedBox(
                    width: MediaQuery.sizeOf(context).width * 0.35,
                    child: referenceWidget,
                  ),
                Expanded(child: canvasWidget),
              ],
            ),
          ),
        ],
      );
    } else {
      content = Column(
        children: [
          if (_showReference)
            SizedBox(height: _enlarge ? 320 : 180, child: referenceWidget),
          if (steps.isNotEmpty) _buildStepsBar(steps),
          Expanded(child: canvasWidget),
        ],
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text('ارسم مثلي — ${widget.activity.titleAr}'),
        actions: [
          IconButton(
            icon: Icon(
              _showReference ? Icons.visibility_off : Icons.visibility,
            ),
            tooltip: _showReference ? 'إخفاء المرجع' : 'إظهار المرجع',
            onPressed: () => setState(() => _showReference = !_showReference),
          ),
          IconButton(
            icon: const Icon(Icons.zoom_out_map),
            tooltip: _enlarge ? 'تصغير المرجع' : 'تكبير المرجع',
            onPressed: () => setState(() => _enlarge = !_enlarge),
          ),
          PopupMenuButton<String>(
            tooltip: 'خيارات صورة المرجع',
            icon: const Icon(Icons.layers_outlined),
            enabled: widget.activity.supportsGhost,
            onSelected: (value) {
              switch (value) {
                case 'toggle':
                  setState(() => _ghostMode = !_ghostMode);
                case 'light':
                  setState(() {
                    _ghostMode = true;
                    _ghostOpacity = 0.18;
                  });
                case 'medium':
                  setState(() {
                    _ghostMode = true;
                    _ghostOpacity = 0.32;
                  });
                case 'strong':
                  setState(() {
                    _ghostMode = true;
                    _ghostOpacity = 0.48;
                  });
              }
            },
            itemBuilder: (context) => [
              CheckedPopupMenuItem<String>(
                value: 'toggle',
                checked: _ghostMode,
                child: const Text('مرجع شفاف فوق اللوحة'),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem<String>(
                value: 'light',
                child: Text('شفافية خفيفة'),
              ),
              const PopupMenuItem<String>(
                value: 'medium',
                child: Text('شفافية متوسطة'),
              ),
              const PopupMenuItem<String>(
                value: 'strong',
                child: Text('شفافية واضحة'),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.compare_outlined),
            tooltip: 'قارن رسمتي بالمرجع',
            onPressed: _showComparison,
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(
              ignoring: _showCompare,
              child: ExcludeSemantics(excluding: _showCompare, child: content),
            ),
          ),
          if (_showCompare)
            Positioned.fill(child: BlockSemantics(child: _buildCompare())),
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(12),
        child: FilledButton.icon(
          onPressed: _saving ? null : _save,
          icon: _saving
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.save_alt_outlined),
          label: Text(_saving ? 'جارٍ الحفظ…' : 'احفظ رسمتي'),
        ),
      ),
    );
  }

  Widget _buildReference([List<_Step>? stepsOverride]) {
    final steps = stepsOverride ?? _resolvedSteps(null);
    final step = steps.isEmpty
        ? null
        : steps[_stepIndex.clamp(0, steps.length - 1)];
    return Semantics(
      label: step == null
          ? 'الصورة المرجعية: ${widget.activity.titleAr}'
          : 'الخطوة ${_stepIndex + 1} من ${steps.length}: ${step.label}',
      image: true,
      child: ExcludeSemantics(
        child: ColoredBox(
          color: widget.activity.bg,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: DrawingAsset(
              assetIdOrPath: widget.activity.referenceAssetId,
              fit: BoxFit.contain,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStepsBar([List<_Step>? stepsOverride]) {
    final steps = stepsOverride ?? _resolvedSteps(null);
    final current = steps[_stepIndex.clamp(0, steps.length - 1)];
    return Material(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Row(
          children: [
            IconButton(
              tooltip: 'الخطوة السابقة',
              onPressed: _stepIndex > 0
                  ? () => setState(() => _stepIndex -= 1)
                  : null,
              icon: const Icon(Icons.chevron_right),
            ),
            Expanded(
              child: Semantics(
                liveRegion: true,
                child: Text(
                  'الخطوة ${_stepIndex + 1} من ${steps.length}: ${current.label}',
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            IconButton(
              tooltip: 'الخطوة التالية',
              onPressed: _stepIndex + 1 < steps.length
                  ? () => setState(() => _stepIndex += 1)
                  : null,
              icon: const Icon(Icons.chevron_left),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompare() {
    final preview = _drawingPreview;
    void close() => setState(() => _showCompare = false);

    return CallbackShortcuts(
      bindings: {const SingleActivator(LogicalKeyboardKey.escape): close},
      child: FocusTraversalGroup(
        child: Focus(
          autofocus: true,
          child: Material(
            color: Colors.black.withValues(alpha: 0.82),
            child: SafeArea(
              minimum: const EdgeInsets.all(16),
              child: Semantics(
                scopesRoute: true,
                namesRoute: true,
                label: 'مقارنة رسمتي بالصورة المرجعية',
                child: Column(
                  children: [
                    Row(
                      children: [
                        Text(
                          'قارن رسمتك',
                          style: Theme.of(
                            context,
                          ).textTheme.titleLarge?.copyWith(color: Colors.white),
                        ),
                        const Spacer(),
                        IconButton.filledTonal(
                          autofocus: true,
                          tooltip: 'إغلاق المقارنة',
                          onPressed: close,
                          icon: const Icon(Icons.close),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final cards = <Widget>[
                            _CompareCard(
                              label: 'المرجع',
                              child: _buildReference(),
                            ),
                            _CompareCard(
                              label: 'رسمتي',
                              child: preview == null
                                  ? const Center(
                                      child: Text('لا توجد معاينة بعد'),
                                    )
                                  : Image.memory(
                                      preview,
                                      fit: BoxFit.contain,
                                      semanticLabel: 'معاينة رسمتي الحالية',
                                    ),
                            ),
                          ];
                          if (constraints.maxWidth >= 720) {
                            return Row(
                              children: [
                                Expanded(child: cards[0]),
                                const SizedBox(width: 12),
                                Expanded(child: cards[1]),
                              ],
                            );
                          }
                          return Column(
                            children: [
                              Expanded(child: cards[0]),
                              const SizedBox(height: 12),
                              Expanded(child: cards[1]),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
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
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleSmall,
            ),
          ),
          Expanded(
            child: ColoredBox(color: Colors.white, child: child),
          ),
        ],
      ),
    );
  }
}

class _Step {
  const _Step(this.label);

  final String label;
}

const _stepMap = <String, List<_Step>>{
  'ref-cat': [
    _Step('ابدأ بشكل الرأس'),
    _Step('أضف الأذنين والجسم'),
    _Step('أكمل الوجه والذيل'),
  ],
  'ref-rocket': [
    _Step('ارسم جسم الصاروخ'),
    _Step('أضف النافذة والجناحين'),
    _Step('أكمل اللهب والتفاصيل'),
  ],
  'ref-house2': [
    _Step('ارسم مربع المنزل'),
    _Step('أضف السقف'),
    _Step('أكمل الباب والنوافذ'),
  ],
};

class _NoopReporter implements AttemptReporter {
  @override
  Future<void> report(GameAttempt attempt) async {}
}
