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
library;

import 'package:flutter/material.dart';

import 'game_pack.dart';
import 'game_services.dart';
import 'game_session_controller.dart';

/// One continuous stroke the child drew.
@immutable
class FreeStroke {
  const FreeStroke({
    required this.points,
    required this.color,
    required this.width,
    required this.isEraser,
  });

  final List<Offset> points;
  final Color color;
  final double width;

  /// Erasing is a stroke in the background colour rather than a pixel operation:
  /// it keeps the whole drawing as a replayable list, which is what makes undo
  /// and redo exact instead of approximate.
  final bool isEraser;
}

/// Brush sizes offered to a child.
///
/// Three named sizes rather than a slider: a slider is a fine-motor task in
/// itself, and this engine exists for children who are still developing that.
const List<double> kBrushSizes = [8, 16, 28];

class FreeDrawSurface extends StatefulWidget {
  const FreeDrawSurface({required this.controller, super.key});

  final GameSessionController controller;

  @override
  State<FreeDrawSurface> createState() => _FreeDrawSurfaceState();
}

class _FreeDrawSurfaceState extends State<FreeDrawSurface> {
  final List<FreeStroke> _strokes = [];

  /// Strokes removed by undo, kept so redo is exact.
  final List<FreeStroke> _undone = [];

  List<Offset> _current = [];
  late Color _color;
  double _width = kBrushSizes[1];
  bool _erasing = false;

  /// Default palette when the level declares none.
  ///
  /// Majarra brand colours, and deliberately not a full colour picker: a bounded
  /// set is easier for a small hand and keeps the drawing on-brand.
  static const _fallbackPalette = <String>[
    '#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2', '#FF9F1C',
  ];

  List<String> get _palette {
    final declared = widget.controller.level.coloring?.palette ?? const [];
    return declared.isNotEmpty ? declared : _fallbackPalette;
  }

  @override
  void initState() {
    super.initState();
    _color = _parseHex(_palette.first);
  }

  bool get _reduceMotion =>
      widget.controller.settings.reduceMotion ||
      MediaQuery.maybeDisableAnimationsOf(context) == true;

  void _begin(Offset point) {
    setState(() {
      _current = [point];
      // A new stroke invalidates the redo stack, as in any editor: redoing after
      // drawing something else would resurrect a stroke into a picture it never
      // belonged to.
      _undone.clear();
    });
  }

  void _extend(Offset point) {
    if (_current.isEmpty) return;
    setState(() => _current.add(point));
  }

  void _end() {
    if (_current.length < 2) {
      // A tap is still a mark: a dot the size of the brush.
      if (_current.length == 1) {
        setState(() {
          _strokes.add(FreeStroke(
            points: [_current.first, _current.first + const Offset(0.01, 0)],
            color: _color, width: _width, isEraser: _erasing,
          ));
          _current = [];
        });
      }
      return;
    }
    setState(() {
      _strokes.add(FreeStroke(
        points: List<Offset>.of(_current),
        color: _color,
        width: _width,
        isEraser: _erasing,
      ));
      _current = [];
    });
  }

  void _undo() {
    if (_strokes.isEmpty) return;
    setState(() => _undone.add(_strokes.removeLast()));
  }

  void _redo() {
    if (_undone.isEmpty) return;
    setState(() => _strokes.add(_undone.removeLast()));
  }

  Future<void> _clear() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('نبدأ من جديد؟'),
        content: const Text('سيُمحى ما رسمته.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('لا')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('نعم')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _undone
        ..clear()
        ..addAll(_strokes.reversed);
      _strokes.clear();
      _current = [];
    });
  }

  @override
  Widget build(BuildContext context) {
    final level = widget.controller.level;
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    final background = Theme.of(context).colorScheme.surface;

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
        Expanded(
          child: Center(
            child: AspectRatio(
              // Square, matching the 0..1 pack space, so an optional template
              // lines up with the canvas and an export has predictable
              // proportions.
              aspectRatio: 1,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest.shortestSide;
                  return Container(
                    width: size,
                    height: size,
                    decoration: BoxDecoration(
                      color: background,
                      border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Listener(
                      key: const Key('free_draw_canvas'),
                      behavior: HitTestBehavior.opaque,
                      // Raw pointer events, so a stylus draws exactly as a finger
                      // does and pressure-capable devices are not filtered out.
                      onPointerDown: (event) => _begin(event.localPosition),
                      onPointerMove: (event) => _extend(event.localPosition),
                      onPointerUp: (_) => _end(),
                      onPointerCancel: (_) => _end(),
                      child: Semantics(
                        label: 'مساحة الرسم',
                        child: CustomPaint(
                          size: Size(size, size),
                          painter: _FreeDrawPainter(
                            strokes: _strokes,
                            current: _current,
                            currentColor: _color,
                            currentWidth: _width,
                            currentIsEraser: _erasing,
                            background: background,
                            reduceMotion: _reduceMotion,
                          ),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
        _buildPalette(context, target),
        _buildTools(context, target),
      ],
    );
  }

  Widget _buildPalette(BuildContext context, double target) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final hex in _palette)
            Semantics(
              button: true,
              selected: !_erasing && _color == _parseHex(hex),
              label: 'لون',
              child: GestureDetector(
                onTap: () => setState(() {
                  _color = _parseHex(hex);
                  _erasing = false;
                }),
                child: Container(
                  width: target,
                  height: target,
                  decoration: BoxDecoration(
                    color: _parseHex(hex),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: !_erasing && _color == _parseHex(hex)
                          ? Theme.of(context).colorScheme.onSurface
                          : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
              ),
            ),
          for (final size in kBrushSizes)
            Semantics(
              button: true,
              selected: _width == size,
              label: 'حجم القلم',
              child: GestureDetector(
                onTap: () => setState(() => _width = size),
                child: Container(
                  width: target,
                  height: target,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _width == size
                          ? Theme.of(context).colorScheme.primary
                          : Theme.of(context).colorScheme.outlineVariant,
                      width: _width == size ? 3 : 1,
                    ),
                  ),
                  child: Center(
                    child: Container(
                      width: size,
                      height: size,
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.onSurface,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTools(BuildContext context, double target) {
    final style = ButtonStyle(minimumSize: WidgetStatePropertyAll(Size(target, target)));
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 10,
        runSpacing: 8,
        children: [
          Semantics(
            selected: _erasing,
            child: OutlinedButton.icon(
              key: const Key('free_eraser'),
              onPressed: () => setState(() => _erasing = !_erasing),
              icon: Icon(_erasing ? Icons.brush : Icons.cleaning_services_outlined),
              label: Text(_erasing ? 'ارسم' : 'ممحاة'),
              style: style,
            ),
          ),
          OutlinedButton.icon(
            key: const Key('free_undo'),
            onPressed: _strokes.isEmpty ? null : _undo,
            icon: const Icon(Icons.undo),
            label: const Text('رجوع'),
            style: style,
          ),
          OutlinedButton.icon(
            key: const Key('free_redo'),
            onPressed: _undone.isEmpty ? null : _redo,
            icon: const Icon(Icons.redo),
            label: const Text('إعادة'),
            style: style,
          ),
          OutlinedButton.icon(
            key: const Key('free_clear'),
            onPressed: _strokes.isEmpty ? null : _clear,
            icon: const Icon(Icons.refresh),
            label: const Text('من جديد'),
            style: style,
          ),
          OutlinedButton.icon(
            onPressed: widget.controller.repeatInstruction,
            icon: const Icon(Icons.volume_up_outlined),
            label: const Text('أعد التعليمة'),
            style: style,
          ),
          FilledButton.icon(
            key: const Key('free_done'),
            // Always available. The child decides when their drawing is finished,
            // and nothing judges it. Saving is a separate, explicit action offered
            // by the screen, which owns the raster capture.
            onPressed: widget.controller.markDone,
            icon: const Icon(Icons.check),
            label: const Text('تم'),
            style: style,
          ),
        ],
      ),
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
    required this.background,
    required this.reduceMotion,
  });

  final List<FreeStroke> strokes;
  final List<Offset> current;
  final Color currentColor;
  final double currentWidth;
  final bool currentIsEraser;
  final Color background;
  final bool reduceMotion;

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in strokes) {
      _paintStroke(canvas, stroke.points, stroke.color, stroke.width, stroke.isEraser);
    }
    if (current.isNotEmpty) {
      _paintStroke(canvas, current, currentColor, currentWidth, currentIsEraser);
    }
  }

  void _paintStroke(Canvas canvas, List<Offset> points, Color color, double width, bool isEraser) {
    if (points.isEmpty) return;
    final paint = Paint()
      ..color = isEraser ? background : color
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    if (points.length == 1) {
      canvas.drawCircle(points.first, width / 2, Paint()..color = isEraser ? background : color);
      return;
    }

    // Midpoint quadratic smoothing: pointer samples are jagged at speed, and a
    // child's line should not look like it was drawn by a seismograph.
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
  }

  @override
  bool shouldRepaint(_FreeDrawPainter oldDelegate) => true;
}

Color _parseHex(String hex) {
  final cleaned = hex.replaceFirst('#', '');
  final value = int.tryParse(cleaned, radix: 16);
  if (value == null) return Colors.grey;
  return Color(0xFF000000 | value);
}

/// Whether a level should be handed to [FreeDrawSurface] rather than the tracing
/// surface.
bool isFreeDrawMode(DrawingMode mode) => const {
      DrawingMode.freeDraw,
      DrawingMode.drawFromPrompt,
      DrawingMode.completeDrawing,
    }.contains(mode);
