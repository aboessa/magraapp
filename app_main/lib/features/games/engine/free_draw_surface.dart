/// The free drawing surface.
///
/// Serves every mode that produces an artefact rather than a measurement:
/// `free_draw`, `draw_from_prompt`, open `complete_drawing`, and free-hand
/// `copy_pattern`. None of them is scored — Majarra has no image recognition and
/// will not pretend to judge a child's drawing — so this file contains no scoring
/// code at all, which is the strongest form the rule can take.
///
/// The child decides when it is finished. There is no success condition, no
/// timer, and no comment on the result.
///
/// ## Eraser
///
/// Real eraser via `BlendMode.clear` on a saved layer, not a paint-in-background
/// stroke. A background-colour stroke breaks the moment a `background_asset` or
/// `template_asset` is present and is also not undo-transparency-correct.
///
/// ## History
///
/// Bounded to 50 strokes; _undone is cleared on new stroke; redo is exact.
///
/// ## Pointers
///
/// Single-pointer exclusive: the first finger down owns the stroke until up.
/// Extra fingers are ignored so a palm does not fork the path. Pointer pressure
/// is accepted but not used for scoring or width (light press is not less accurate).
library;

import 'package:flutter/material.dart';

import '../data/creation_document.dart';
import '../presentation/widgets/drawing_asset.dart';
import 'coloring_regions.dart' show parseHex;
import 'game_pack.dart';
import 'game_services.dart';
import 'game_session_controller.dart';

enum DrawBrush { pencil, marker, crayon, paintBrush }

@immutable
class FreeStroke {
  const FreeStroke({
    required this.points,
    required this.color,
    required this.width,
    required this.isEraser,
    this.brush = DrawBrush.pencil,
    this.opacity = 1,
  });

  final List<Offset> points;
  final Color color;
  final double width;
  final bool isEraser;
  final DrawBrush brush;
  final double opacity;

  Map<String, dynamic> toJson() => {
    'points': points.map((p) => [p.dx, p.dy]).toList(),
    'color':
        '#${color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}',
    'width': width,
    'isEraser': isEraser,
    'brush': brush.name,
    'opacity': opacity,
  };
}

const List<double> kBrushSizes = [3, 6, 10, 16, 26, 42];
const int kMaxStrokes = 120;
const int kMaxUndone = 80;

/// Controller that lets outer pages clear/undo/redo the free-draw canvas
/// without needing a GlobalKey. GameSessionController remains the source of
/// truth for document save; this only manipulates the stroke layer.
class FreeDrawController {
  FreeDrawController();
  VoidCallback? reset;
  VoidCallback? _clearFn;
  VoidCallback? _clearDirectFn;
  VoidCallback? _undoFn;
  VoidCallback? _redoFn;
  void _attach({VoidCallback? clear, VoidCallback? clearDirect, VoidCallback? undo, VoidCallback? redo}) {
    _clearFn = clear;
    _clearDirectFn = clearDirect;
    _undoFn = undo;
    _redoFn = redo;
    reset = clearDirect ?? clear;
  }

  void _detach() {
    _clearFn = null;
    _clearDirectFn = null;
    _undoFn = null;
    _redoFn = null;
    reset = null;
  }

  void clear() => (_clearDirectFn ?? _clearFn)?.call();
  void clearDirect() => _clearDirectFn?.call();
  void undo() => _undoFn?.call();
  void redo() => _redoFn?.call();
}

class FreeDrawSurface extends StatefulWidget {
  const FreeDrawSurface({
    required this.controller,
    this.drawController,
    this.initialDocument,
    this.onInitialStrokesRestored,
    this.onStrokesChanged,
    this.canvasSizeOverride,
    this.canvasAspectRatio,
    this.onCanvasSizeChanged,
    this.canvasRepaintBoundaryKey,
    super.key,
  });

  final GameSessionController controller;

  /// Optional imperative controls for outer screen actions such as reset.
  final FreeDrawController? drawController;

  /// When continuation (متابعة الرسم), strokes/fills/template are restored.
  final CreationDocument? initialDocument;

  /// Called once after document strokes are restored without marking an edit.
  final ValueChanged<List<FreeStroke>>? onInitialStrokesRestored;

  /// Called after user edits so the parent can snapshot for document save.
  final ValueChanged<List<FreeStroke>>? onStrokesChanged;
  final Size? canvasSizeOverride;

  /// Width / height. Falls back to the editable document, then square.
  final double? canvasAspectRatio;
  final ValueChanged<Size>? onCanvasSizeChanged;

  /// Optional key for capturing only the artwork canvas, without editor controls.
  final GlobalKey? canvasRepaintBoundaryKey;

  @override
  State<FreeDrawSurface> createState() => _FreeDrawSurfaceState();
}

class _FreeDrawSurfaceState extends State<FreeDrawSurface> {
  final List<FreeStroke> _strokes = [];
  final List<FreeStroke> _undone = [];
  List<Offset> _current = [];
  late Color _color;
  double _width = kBrushSizes[1];
  bool _erasing = false;
  DrawBrush _brush = DrawBrush.pencil;
  double _opacity = 1;
  final TransformationController _viewTransform = TransformationController();
  bool _panMode = false;
  int? _activePointer;
  Size _canvasSize = const Size.square(320);

  static const _fallbackPalette = <String>[
    '#000000',
    '#FFFFFF',
    '#1A1A2E',
    '#FF3B30',
    '#FF6B35',
    '#FF9F1C',
    '#FFD34D',
    '#FFCC02',
    '#FFE066',
    '#22C55E',
    '#00C950',
    '#00D6F5',
    '#0EA5E9',
    '#2580FF',
    '#3B82F6',
    '#6366F1',
    '#9D68FF',
    '#6A3DF2',
    '#A855F7',
    '#EC4899',
    '#FF6FAE',
    '#F43F5E',
    '#EF4444',
    '#8B4513',
    '#795548',
    '#A0826D',
    '#6B7280',
    '#9CA3AF',
  ];

  List<String> get _palette {
    final declared = widget.controller.level.coloring?.palette ?? const [];
    final docPalette = widget.initialDocument?.palette ?? const [];
    return <String>{
      ...declared,
      ...docPalette,
      ..._fallbackPalette,
    }.toList(growable: false);
  }

  @override
  void initState() {
    super.initState();
    _color = _parseHex(_palette.first);
    _attachDrawController();
    // Restore strokes from document if present (normalised 0..1 -> pixel).
    // Defer actual pixel conversion until we know canvas size; keep a pending flag
    // and convert in first layout.
    final doc = widget.initialDocument;
    if (doc != null && doc.strokes.isNotEmpty) {
      // Store normalised temporarily, convert on first build via _restorePending.
      _restorePending = doc.strokes;
    }
  }

  @override
  void didUpdateWidget(covariant FreeDrawSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.drawController != widget.drawController) {
      oldWidget.drawController?._detach();
      _attachDrawController();
    }
  }

  void _attachDrawController() {
    widget.drawController?._attach(
      clear: _clear,
      clearDirect: _clearDirect,
      undo: _undo,
      redo: _redo,
    );
  }

  List<DocStroke>? _restorePending;

  bool get _reduceMotion =>
      widget.controller.settings.reduceMotion ||
      MediaQuery.maybeDisableAnimationsOf(context) == true;

  @override
  void dispose() {
    widget.drawController?._detach();
    _viewTransform.dispose();
    super.dispose();
  }

  void _applyPendingRestore(Size size) {
    if (_restorePending == null) return;
    _strokes.clear();
    for (final ds in _restorePending!) {
      _strokes.add(ds.toFreeStrokeDimensions(size.width, size.height));
    }
    // Cap to history limit.
    if (_strokes.length > kMaxStrokes) {
      _strokes.removeRange(0, _strokes.length - kMaxStrokes);
    }
    _restorePending = null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      widget.onInitialStrokesRestored?.call(List.unmodifiable(_strokes));
      _syncPendingDocument();
    });
  }

  void _syncPendingDocument() {
    // Push editable document to controller so GameScreen can save PNG+document atomically.
    final level = widget.controller.level;
    final doc = CreationDocument.fromStrokes(
      mode: level.mode.name,
      canvasSize: _canvasSize.width,
      canvasHeight: _canvasSize.height,
      strokes: List.unmodifiable(_strokes),
      fills: const {},
      backgroundAsset: level.backgroundAsset,
      templateAsset: level.coloring?.templateAsset,
      palette: _palette,
      prompt: level.prompt,
      packId: widget.controller.pack.packId,
      levelIndex: widget.controller.levelIndex,
    );
    widget.controller.setPendingDocument(doc.toJsonString(), doc.version);
  }

  void _notifyStrokes() {
    widget.onStrokesChanged?.call(List.unmodifiable(_strokes));
    _syncPendingDocument();
  }

  Offset _clampPoint(Offset point) => Offset(
    point.dx.clamp(0.0, _canvasSize.width),
    point.dy.clamp(0.0, _canvasSize.height),
  );

  void _begin(int pointer, Offset point) {
    if (_activePointer != null) return;
    _activePointer = pointer;
    setState(() {
      _current = [point];
      _undone.clear();
    });
  }

  void _extend(int pointer, Offset point) {
    if (_activePointer != pointer || _current.isEmpty) return;
    // Interpolate gaps: if the finger moved far between samples, insert mid-point
    // so smoothing does not straight-line across the gap.
    final last = _current.last;
    if ((point - last).distance > 12) {
      final mid = Offset((last.dx + point.dx) / 2, (last.dy + point.dy) / 2);
      setState(() => _current.add(mid));
    }
    setState(() => _current.add(point));
  }

  void _end(int pointer) {
    if (_activePointer != pointer) return;
    _activePointer = null;
    if (_current.length < 2) {
      if (_current.length == 1) {
        setState(() {
          _strokes.add(
            FreeStroke(
              points: [_current.first, _current.first + const Offset(0.6, 0)],
              color: _color,
              width: _width,
              isEraser: _erasing,
              brush: _brush,
              opacity: _opacity,
            ),
          );
          if (_strokes.length > kMaxStrokes) _strokes.removeAt(0);
          _current = [];
        });
        _notifyStrokes();
      } else {
        setState(() => _current = []);
      }
      return;
    }
    // Light smoothing: de-jitter by removing near-duplicate points.
    final smoothed = _smooth(_current);
    setState(() {
      _strokes.add(
        FreeStroke(
          points: smoothed,
          color: _color,
          width: _width,
          isEraser: _erasing,
          brush: _brush,
          opacity: _opacity,
        ),
      );
      if (_strokes.length > kMaxStrokes) _strokes.removeAt(0);
      _current = [];
    });
    _notifyStrokes();
  }

  List<Offset> _smooth(List<Offset> pts) {
    if (pts.length < 3) return List.of(pts);
    final out = <Offset>[pts.first];
    for (var i = 1; i < pts.length - 1; i++) {
      final prev = pts[i - 1];
      final curr = pts[i];
      final next = pts[i + 1];
      // Average with neighbours to reduce jitter without rounding corners excessively.
      final sx = (prev.dx + curr.dx * 2 + next.dx) / 4;
      final sy = (prev.dy + curr.dy * 2 + next.dy) / 4;
      out.add(Offset(sx, sy));
    }
    out.add(pts.last);
    return out;
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() {
      final s = _strokes.removeLast();
      if (_undone.length >= kMaxUndone) _undone.removeAt(0);
      _undone.add(s);
    });
    _notifyStrokes();
  }

  void _redo() {
    if (_undone.isEmpty) return;
    setState(() {
      final s = _undone.removeLast();
      if (_strokes.length >= kMaxStrokes) _strokes.removeAt(0);
      _strokes.add(s);
    });
    _notifyStrokes();
  }

  void _clearDirect() {
    setState(() {
      _undone
        ..clear()
        ..addAll(_strokes.reversed.take(kMaxUndone));
      _strokes.clear();
      _current = [];
    });
    _notifyStrokes();
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('نبدأ من جديد؟'),
        content: const Text('سيُمحى ما رسمته.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('لا'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('نعم'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    _clearDirect();
  }

  @override
  Widget build(BuildContext context) {
    final level = widget.controller.level;
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    // لوحة بيضا صافية كما طلب — أبيض نقي مهما كان الثيم غامق
    const background = Colors.white;
    final doc = widget.initialDocument;

    return Column(
      children: [
        if (level.prompt != null && level.prompt!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Semantics(
              liveRegion: true,
              child: Text(
                level.prompt!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ),
        if (level.mode == DrawingMode.copyPattern &&
            level.backgroundAsset != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(
              'انسخ النمط',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        Expanded(
          child: Center(
            child: AspectRatio(
              aspectRatio:
                  widget.canvasAspectRatio ??
                  ((doc?.canvasWidth ?? 1) / (doc?.canvasHeight ?? 1)),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = widget.canvasSizeOverride ?? constraints.biggest;
                  if (_canvasSize != size) {
                    _canvasSize = size;
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      widget.onCanvasSizeChanged?.call(size);
                    });
                  }
                  if (_restorePending != null) _applyPendingRestore(size);
                  final bgAsset = level.backgroundAsset ?? doc?.backgroundAsset;
                  final tplAsset =
                      level.coloring?.templateAsset ?? doc?.templateAsset;
                  return InteractiveViewer(
                    transformationController: _viewTransform,
                    panEnabled: _panMode,
                    scaleEnabled: _panMode,
                    minScale: 1,
                    maxScale: 4,
                    boundaryMargin: const EdgeInsets.all(160),
                    child: RepaintBoundary(
                      key: widget.canvasRepaintBoundaryKey,
                      child: Container(
                        width: size.width,
                        height: size.height,
                        decoration: BoxDecoration(
                          color: background,
                          border: Border.all(
                            color: const Color(0x1A000000),
                            width: 1.2,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 12,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            if (bgAsset != null)
                              _AssetBackground(asset: bgAsset, size: size),
                            if (tplAsset != null)
                              _AssetTemplate(asset: tplAsset, size: size),
                            MouseRegion(
                              cursor: _panMode
                                  ? SystemMouseCursors.grab
                                  : SystemMouseCursors.precise,
                              onExit: (_) {
                                final pointer = _activePointer;
                                if (pointer != null) _end(pointer);
                              },
                              child: Listener(
                                key: const Key('free_draw_canvas'),
                                behavior: HitTestBehavior.opaque,
                                onPointerDown: (e) {
                                  if (_panMode) return;
                                  _begin(
                                    e.pointer,
                                    _clampPoint(e.localPosition),
                                  );
                                },
                                onPointerMove: (e) {
                                  if (_panMode) return;
                                  _extend(
                                    e.pointer,
                                    _clampPoint(e.localPosition),
                                  );
                                },
                                onPointerUp: (e) => _end(e.pointer),
                                onPointerCancel: (e) => _end(e.pointer),
                                child: Semantics(
                                  label: 'مساحة الرسم',
                                  child: CustomPaint(
                                    size: size,
                                    painter: _FreeDrawPainter(
                                      // Each delegate owns an immutable frame.
                                      strokes: List<FreeStroke>.unmodifiable(
                                        _strokes,
                                      ),
                                      current: List<Offset>.unmodifiable(
                                        _current,
                                      ),
                                      currentColor: _color,
                                      currentWidth: _width,
                                      currentIsEraser: _erasing,
                                      currentBrush: _brush,
                                      currentOpacity: _opacity,
                                      background: background,
                                      reduceMotion: _reduceMotion,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
        _buildBrushToolbar(context, target),
        _buildPalette(context, target),
        _buildTools(context, target),
      ],
    );
  }

  Widget _buildBrushToolbar(BuildContext context, double target) {
    const labels = <DrawBrush, (String, IconData)>{
      DrawBrush.pencil: ('قلم', Icons.edit_outlined),
      DrawBrush.marker: ('ماركر', Icons.border_color_outlined),
      DrawBrush.crayon: ('شمع', Icons.brush_outlined),
      DrawBrush.paintBrush: ('فرشاة', Icons.format_paint_outlined),
    };
    return _StudioToolbar(
      child: Column(
        children: [
          SizedBox(
            height: target,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final entry in labels.entries)
                  _StudioToolButton(
                    icon: entry.value.$2,
                    label: entry.value.$1,
                    selected: !_panMode && !_erasing && _brush == entry.key,
                    onPressed: () => setState(() {
                      _brush = entry.key;
                      _erasing = false;
                      _panMode = false;
                    }),
                  ),
                _StudioToolButton(
                  icon: Icons.pan_tool_alt_outlined,
                  label: 'تحريك',
                  selected: _panMode,
                  onPressed: () => setState(() {
                    _panMode = !_panMode;
                    _activePointer = null;
                    _current = [];
                  }),
                ),
                if (_panMode)
                  _StudioToolButton(
                    icon: Icons.center_focus_strong,
                    label: 'توسيط',
                    onPressed: () => _viewTransform.value = Matrix4.identity(),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(12, 2, 12, 6),
            child: Row(
              children: [
                const Icon(Icons.opacity_rounded, size: 17, color: Color(0xFFBFC8FF)),
                const SizedBox(width: 6),
                Text('شفافية ${(_opacity * 100).round()}٪', style: const TextStyle(color: Color(0xFFBFC8FF), fontSize: 11, fontWeight: FontWeight.w700)),
                Expanded(
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 3,
                      thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7),
                      activeTrackColor: const Color(0xFF00D6F5),
                      inactiveTrackColor: Colors.white24,
                      thumbColor: const Color(0xFF00D6F5),
                    ),
                    child: Slider(
                      value: _opacity,
                      min: 0.2,
                      max: 1,
                      divisions: 8,
                      onChanged: _erasing ? null : (value) => setState(() => _opacity = value),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPalette(BuildContext context, double target) {
    // ألوان أكثر + أحجام فرش أكثر — صفّين منفصلين أوضح للطفل
    return _StudioToolbar(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // صف الألوان — 28 لون سكرول أفقي
          SizedBox(
            height: target + 14,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemCount: _palette.length,
              itemBuilder: (context, i) {
                final hex = _palette[i];
                final isSelected = !_erasing && _color.toARGB32() == _parseHex(hex).toARGB32();
                final isWhite = hex.toUpperCase() == '#FFFFFF';
                return Semantics(
                  button: true,
                  selected: isSelected,
                  label: 'اختيار اللون $hex',
                  child: InkResponse(
                    onTap: () => setState(() {
                      _color = _parseHex(hex);
                      _erasing = false;
                    }),
                    containedInkWell: true,
                    customBorder: const CircleBorder(),
                    radius: target / 2,
                    child: Container(
                      width: target,
                      height: target,
                      decoration: BoxDecoration(
                        color: _parseHex(hex),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: isSelected ? const Color(0xFFFFD34D) : (isWhite ? Colors.black26 : Colors.white24),
                          width: isSelected ? 3 : (isWhite ? 1.5 : 1),
                        ),
                        boxShadow: isSelected
                            ? [BoxShadow(color: const Color(0xFFFFD34D).withValues(alpha: 0.4), blurRadius: 6, spreadRadius: 1)]
                            : null,
                      ),
                      child: isSelected
                          ? const Icon(Icons.check_rounded, size: 16, color: Color(0xFF11183D))
                          : null,
                    ),
                  ),
                );
              },
            ),
          ),
          Container(height: 1, color: Colors.white10, margin: const EdgeInsets.symmetric(horizontal: 12)),
          // صف أحجام الفرش — 6 أحجام من رفيع جداً لسميك
          SizedBox(
            height: target + 14,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemCount: kBrushSizes.length,
              itemBuilder: (context, i) {
                final size = kBrushSizes[i];
                final selected = _width == size;
                // خريطة بصرية: 3→6px, 42→26px لتظل داخل الدائرة
                final dot = (4 + (size / 42) * 20).clamp(4.0, 26.0);
                final label = switch (i) {
                  0 => 'رفيع جداً',
                  1 => 'رفيع',
                  2 => 'متوسط',
                  3 => 'عريض',
                  4 => 'سميك',
                  5 => 'سميك جداً',
                  _ => 'حجم ${size.round()}',
                };
                return Semantics(
                  button: true,
                  selected: selected,
                  label: label,
                  child: InkResponse(
                    onTap: () => setState(() => _width = size),
                    containedInkWell: true,
                    customBorder: const CircleBorder(),
                    radius: target / 2,
                    child: Container(
                      width: target,
                      height: target,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: selected ? const Color(0xFFFFD34D) : Colors.white.withValues(alpha: 0.08),
                        border: Border.all(
                          color: selected ? const Color(0xFFFFD34D) : Colors.white24,
                          width: selected ? 3 : 1,
                        ),
                      ),
                      child: Center(
                        child: Container(
                          width: dot,
                          height: dot,
                          decoration: BoxDecoration(
                            color: selected ? const Color(0xFF11183D) : Colors.white,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTools(BuildContext context, double target) {
    return _StudioToolbar(
      bottomMargin: 12,
      child: SizedBox(
        height: target + 12,
        child: Row(
          children: [
            const SizedBox(width: 8),
          Semantics(
            selected: _erasing,
            child: _StudioToolButton(
              key: const Key('free_eraser'),
              onPressed: () => setState(() => _erasing = !_erasing),
              icon: _erasing ? Icons.brush_rounded : Icons.cleaning_services_outlined,
              label: _erasing ? 'ارسم' : 'ممحاة',
              selected: _erasing,
            ),
          ),
          _StudioToolButton(
            key: const Key('free_undo'),
            onPressed: _strokes.isEmpty ? null : _undo,
            icon: Icons.undo_rounded,
            label: 'رجوع',
          ),
          _StudioToolButton(
            key: const Key('free_redo'),
            onPressed: _undone.isEmpty ? null : _redo,
            icon: Icons.redo_rounded,
            label: 'إعادة',
          ),
          _StudioToolButton(
            key: const Key('free_clear'),
            onPressed: _strokes.isEmpty && _current.isEmpty ? null : _clear,
            icon: Icons.refresh_rounded,
            label: 'من جديد',
          ),
          _StudioToolButton(
            onPressed: widget.controller.repeatInstruction,
            icon: Icons.volume_up_outlined,
            label: 'تعليمات',
          ),
          const Spacer(),
          Semantics(
            button: true,
            label: 'تم',
            child: Padding(
              padding: const EdgeInsetsDirectional.only(end: 8),
              child: FilledButton.icon(
                key: const Key('free_done'),
                onPressed: widget.controller.markDone,
                icon: const Icon(Icons.check_rounded, size: 18),
                label: const Text('تم'),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF6A3DF2),
                  foregroundColor: Colors.white,
                  minimumSize: Size(76, target),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
            ),
          ),
          ],
        ),
      ),
    );
  }
}

class _StudioToolbar extends StatelessWidget {
  const _StudioToolbar({required this.child, this.bottomMargin = 4});

  final Widget child;
  final double bottomMargin;

  @override
  Widget build(BuildContext context) => Container(
    margin: EdgeInsetsDirectional.only(bottom: bottomMargin),
    color: const Color(0xFF11183D),
    child: child,
  );
}

class _StudioToolButton extends StatelessWidget {
  const _StudioToolButton({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.selected = false,
    super.key,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final foreground = !enabled
        ? Colors.white24
        : selected
            ? const Color(0xFF0C1030)
            : const Color(0xFFDCE2FF);
    return Semantics(
      button: true,
      label: label,
      selected: selected,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        child: Material(
          color: selected ? const Color(0xFFFFD34D) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 7),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(icon, size: 20, color: foreground),
                    const SizedBox(height: 1),
                    Text(label, style: TextStyle(color: foreground, fontSize: 9, fontWeight: FontWeight.w800), overflow: TextOverflow.ellipsis),
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

class _AssetBackground extends StatelessWidget {
  const _AssetBackground({required this.asset, required this.size});
  final String asset;
  final Size size;
  @override
  Widget build(BuildContext context) {
    return DrawingAsset(
      assetIdOrPath: asset,
      width: size.width,
      height: size.height,
      fit: BoxFit.cover,
      opacity: 1.0,
      placeholderIcon: Icons.image_outlined,
    );
  }
}

class _AssetTemplate extends StatelessWidget {
  const _AssetTemplate({required this.asset, required this.size});
  final String asset;
  final Size size;
  @override
  Widget build(BuildContext context) {
    return DrawingAsset(
      assetIdOrPath: asset,
      width: size.width,
      height: size.height,
      fit: BoxFit.contain,
      opacity: 0.9,
      fallbackIsShrink: true,
    );
  }
}

class _FreeDrawPainter extends CustomPainter {
  _FreeDrawPainter({
    required this.strokes,
    required this.current,
    required this.currentColor,
    required this.currentWidth,
    required this.currentIsEraser,
    required this.currentBrush,
    required this.currentOpacity,
    required this.background,
    required this.reduceMotion,
  });

  final List<FreeStroke> strokes;
  final List<Offset> current;
  final Color currentColor;
  final double currentWidth;
  final bool currentIsEraser;
  final DrawBrush currentBrush;
  final double currentOpacity;
  final Color background;
  final bool reduceMotion;

  @override
  void paint(Canvas canvas, Size size) {
    // Eraser uses BlendMode.clear on a layer so it actually erases rather than
    // painting the background colour. This keeps strokes correct when a background
    // image or template is underneath.
    canvas.saveLayer(Offset.zero & size, Paint());
    for (final stroke in strokes) {
      _paintStroke(
        canvas,
        stroke.points,
        stroke.color,
        stroke.width,
        stroke.isEraser,
        stroke.brush,
        stroke.opacity,
      );
    }
    if (current.isNotEmpty) {
      _paintStroke(
        canvas,
        current,
        currentColor,
        currentWidth,
        currentIsEraser,
        currentBrush,
        currentOpacity,
      );
    }
    canvas.restore();
  }

  void _paintStroke(
    Canvas canvas,
    List<Offset> points,
    Color color,
    double width,
    bool isEraser,
    DrawBrush brush,
    double opacity,
  ) {
    if (points.isEmpty) return;
    final effectiveOpacity = isEraser
        ? 1.0
        : switch (brush) {
            DrawBrush.marker => opacity.clamp(0.15, 0.55),
            DrawBrush.crayon => opacity.clamp(0.35, 0.85),
            _ => opacity.clamp(0.1, 1.0),
          };
    final effectiveWidth = switch (brush) {
      DrawBrush.pencil => width * 0.7,
      DrawBrush.marker => width * 1.45,
      DrawBrush.crayon => width * 1.1,
      DrawBrush.paintBrush => width * 1.25,
    };
    final ink = color.withValues(alpha: effectiveOpacity);
    final paint = Paint()
      ..color = ink
      ..strokeWidth = effectiveWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke
      ..blendMode = isEraser ? BlendMode.clear : BlendMode.srcOver;

    if (points.length == 1) {
      canvas.drawCircle(
        points.first,
        effectiveWidth / 2,
        paint..style = PaintingStyle.fill,
      );
      return;
    }
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 1; i < points.length - 1; i++) {
      final mid = Offset(
        (points[i].dx + points[i + 1].dx) / 2,
        (points[i].dy + points[i + 1].dy) / 2,
      );
      path.quadraticBezierTo(points[i].dx, points[i].dy, mid.dx, mid.dy);
    }
    path.lineTo(points.last.dx, points.last.dy);
    canvas.drawPath(path, paint);
    if (!isEraser && brush == DrawBrush.crayon) {
      final texture = Paint()
        ..color = ink.withValues(alpha: effectiveOpacity * 0.35)
        ..strokeWidth = (effectiveWidth * 0.22).clamp(1.0, 5.0)
        ..strokeCap = StrokeCap.round
        ..style = PaintingStyle.stroke;
      canvas
        ..save()
        ..translate(effectiveWidth * 0.18, -effectiveWidth * 0.12)
        ..drawPath(path, texture)
        ..restore();
    }
  }

  @override
  bool shouldRepaint(_FreeDrawPainter oldDelegate) {
    if (oldDelegate.background != background) return true;
    if (oldDelegate.reduceMotion != reduceMotion) return true;
    if (oldDelegate.currentColor != currentColor) return true;
    if (oldDelegate.currentWidth != currentWidth) return true;
    if (oldDelegate.currentIsEraser != currentIsEraser) return true;
    if (oldDelegate.currentBrush != currentBrush) return true;
    if (oldDelegate.currentOpacity != currentOpacity) return true;
    if (oldDelegate.current.length != current.length) return true;
    if (oldDelegate.strokes.length != strokes.length) return true;
    // Shallow identity check for stroke objects; length already covers add/remove.
    // If any stroke instance differs, repaint.
    for (var i = 0; i < strokes.length; i++) {
      if (!identical(oldDelegate.strokes[i], strokes[i])) return true;
    }
    if (oldDelegate.current.isNotEmpty && current.isNotEmpty) {
      if (oldDelegate.current.last != current.last) return true;
    }
    return false;
  }
}

Color _parseHex(String hex) => parseHex(hex);

bool isFreeDrawMode(DrawingMode mode) => const {
  DrawingMode.freeDraw,
  DrawingMode.drawFromPrompt,
  DrawingMode.completeDrawing,
}.contains(mode);
