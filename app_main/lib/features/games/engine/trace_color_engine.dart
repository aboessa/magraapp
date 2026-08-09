/// The `trace_color` engine: the drawing surface a child actually touches.
///
/// Geometry, scoring and the help ladder live in `trace_geometry.dart` and
/// `trace_session.dart`. This file owns pixels, pointers and paint, and nothing
/// else — so the pedagogy stays testable without a canvas and the canvas stays
/// free of rules.
///
/// ## Input
///
/// `Listener` rather than `GestureDetector`: tracing needs every raw pointer
/// move, and it must work for a stylus as well as a finger. `PointerDeviceKind`
/// is not filtered, so stylus, finger and mouse all draw; pressure is available
/// on devices that report it and is used only for line weight, never for scoring
/// (a child pressing lightly has not traced less accurately).
library;

import 'package:flutter/material.dart';

import 'game_engine_registry.dart';
import 'game_pack.dart';
import 'game_services.dart';
import 'game_session_controller.dart';
import 'trace_geometry.dart';
import 'trace_session.dart';

class TraceColorEngine extends GameEngine {
  const TraceColorEngine();

  @override
  String get engineId => 'trace_color';

  /// Tracing requires a pointer. `docs/games/06-accessibility.md` says the engine
  /// is hidden on TV rather than shown and then found unplayable.
  @override
  bool get supportsDpad => false;

  @override
  Widget build(BuildContext context, GameSessionController controller) {
    return TraceColorSurface(controller: controller);
  }
}

class TraceColorSurface extends StatefulWidget {
  const TraceColorSurface({required this.controller, super.key});

  final GameSessionController controller;

  @override
  State<TraceColorSurface> createState() => _TraceColorSurfaceState();
}

class _TraceColorSurfaceState extends State<TraceColorSurface> {
  /// The child's in-progress points, kept locally purely for rendering. The
  /// session owns the authoritative accumulation.
  final List<Offset> _live = [];

  /// Colour currently selected from the palette.
  String? _selectedColor;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
    final palette = widget.controller.level.coloring?.palette ?? const [];
    if (palette.isNotEmpty) _selectedColor = palette.first;
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    super.dispose();
  }

  void _onControllerChanged() {
    if (mounted) setState(() {});
  }

  GameSessionController get controller => widget.controller;

  bool get _reduceMotion =>
      controller.settings.reduceMotion ||
      MediaQuery.maybeDisableAnimationsOf(context) == true;

  @override
  Widget build(BuildContext context) {
    final level = controller.level;
    final isColoringPhase = controller.phase == LevelPhase.coloring;

    return Column(
      children: [
        if (level.prompt != null)
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
              // Packs are authored in a 1:1 normalised space, so a square canvas
              // is the only ratio that preserves the authored proportions. A
              // stretched glyph would teach the wrong letter shape.
              aspectRatio: 1,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest.shortestSide;
                  controller.resizeCanvas(size, size);
                  return _buildCanvas(context, size, isColoringPhase);
                },
              ),
            ),
          ),
        ),
        if (isColoringPhase) _buildPalette(context),
        _buildControls(context, isColoringPhase),
      ],
    );
  }

  Widget _buildCanvas(BuildContext context, double size, bool isColoringPhase) {
    final session = controller.traceSession;
    final level = controller.level;

    final canvas = CustomPaint(
      size: Size(size, size),
      painter: _TracePainter(
        strokeStates: session?.strokeStates ?? const [],
        livePoints: _live,
        canvasSize: size,
        toleranceDp: session?.activeTolerance.toleranceDp ?? level.toleranceDp,
        helpLevel: controller.helpLevel,
        reduceMotion: _reduceMotion,
        showGuides: !isColoringPhase,
        dots: level.dots,
        connectedDots: controller.connectedDots,
        regionColors: controller.regionColors,
        colorScheme: Theme.of(context).colorScheme,
      ),
    );

    if (isColoringPhase) {
      // Colouring is a single tap per region and needs no precision, which is
      // exactly why the engine contract offers it as the motor-free stage.
      return GestureDetector(
        onTapUp: (details) => _paintRegionAt(details.localPosition, size),
        child: canvas,
      );
    }

    return Listener(
      // Stable handle for tests and for anything that needs to address the
      // drawing surface specifically; Flutter uses Listener internally, so
      // finding it by type is ambiguous.
      key: const Key('trace_canvas'),
      behavior: HitTestBehavior.opaque,
      onPointerDown: (event) => _onDown(event.localPosition, size),
      onPointerMove: (event) => _onMove(event.localPosition),
      onPointerUp: (_) => _onUp(),
      onPointerCancel: (_) => _onUp(),
      child: Semantics(
        // A screen reader needs to know what is being traced. The glyph itself is
        // the label; the instruction is already a live region above.
        label: level.glyph != null
            ? 'تتبّع الحرف ${level.glyph}'
            : 'تتبّع المسار',
        child: canvas,
      ),
    );
  }

  Offset2D _toEngine(Offset local) => Offset2D(local.dx, local.dy);

  void _onDown(Offset local, double size) {
    final session = controller.traceSession;
    final active = session?.activeStroke;
    if (session == null || active == null) return;

    if (active.isDot) {
      // A dot is tapped, never dragged: dragging a single point is impossible to
      // satisfy, so the tap is handled on pointer-down and nothing accumulates.
      controller.tap(_toEngine(local));
      return;
    }

    // Sequential-tap alternative: a short tap on the path advances coverage
    // without requiring a drag at all.
    controller.beginStroke(_toEngine(local));
    setState(() {
      _live
        ..clear()
        ..add(local);
    });
  }

  void _onMove(Offset local) {
    if (_live.isEmpty) return;
    controller.extendStroke(_toEngine(local));
    setState(() => _live.add(local));
  }

  Future<void> _onUp() async {
    if (_live.isEmpty) {
      return;
    }
    final wasTap = _live.length <= 2;
    final point = _live.last;
    setState(_live.clear);
    if (wasTap) {
      // Treated as a tap so the sequential alternative works with the same
      // gesture a child naturally makes.
      await controller.tap(_toEngine(point));
      return;
    }
    await controller.endStroke();
  }

  void _paintRegionAt(Offset local, double size) {
    final regions = controller.level.coloring?.regions ?? const [];
    if (regions.isEmpty || _selectedColor == null) return;
    // Region hit-testing against real artwork needs the artwork, which has not
    // been produced. Until it exists the whole template is one region, which is
    // honest: a single tap fills it, exactly as the contract describes, and no
    // fake sub-regions are invented.
    controller.paintRegion(regions.first, _selectedColor!);
  }

  Widget _buildPalette(BuildContext context) {
    final palette = controller.level.coloring?.palette ?? const [];
    if (palette.isEmpty) return const SizedBox.shrink();
    final target = effectiveTouchTarget(controller.pack.accessibility);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final hex in palette)
            Semantics(
              selected: _selectedColor == hex,
              button: true,
              label: 'لون',
              child: GestureDetector(
                onTap: () => setState(() => _selectedColor = hex),
                child: Container(
                  width: target,
                  height: target,
                  decoration: BoxDecoration(
                    color: _parseHex(hex),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: _selectedColor == hex
                          ? Theme.of(context).colorScheme.onSurface
                          : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildControls(BuildContext context, bool isColoringPhase) {
    final target = effectiveTouchTarget(controller.pack.accessibility);
    final canFinish = isColoringPhase ||
        controller.level.completion == CompletionRule.childTapsDone;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          // Mandatory in every pack per the data contract.
          _ControlButton(
            icon: Icons.volume_up_outlined,
            label: 'أعد التعليمة',
            minSize: target,
            onPressed: controller.repeatInstruction,
          ),
          _ControlButton(
            icon: Icons.undo,
            label: 'رجوع',
            minSize: target,
            onPressed: controller.undo,
          ),
          _ControlButton(
            icon: Icons.refresh,
            label: 'من جديد',
            minSize: target,
            onPressed: controller.clear,
          ),
          if (canFinish)
            // Always available during free expression: the child decides when
            // their drawing is finished, and nothing judges it.
            _ControlButton(
              icon: Icons.check,
              label: 'تم',
              minSize: target,
              filled: true,
              onPressed: controller.markDone,
            ),
        ],
      ),
    );
  }
}

class _ControlButton extends StatelessWidget {
  const _ControlButton({
    required this.icon,
    required this.label,
    required this.minSize,
    required this.onPressed,
    this.filled = false,
  });

  final IconData icon;
  final String label;
  final double minSize;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [Icon(icon), const SizedBox(width: 8), Text(label)],
    );
    final style = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(minSize, minSize)),
      padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 20)),
    );
    return filled
        ? FilledButton(onPressed: onPressed, style: style, child: child)
        : OutlinedButton(onPressed: onPressed, style: style, child: child);
  }
}

Color _parseHex(String hex) {
  final cleaned = hex.replaceFirst('#', '');
  final value = int.tryParse(cleaned, radix: 16);
  if (value == null) return Colors.grey;
  return Color(0xFF000000 | value);
}

/// Paints the guide path, what the child has drawn, and the current guidance.
class _TracePainter extends CustomPainter {
  _TracePainter({
    required this.strokeStates,
    required this.livePoints,
    required this.canvasSize,
    required this.toleranceDp,
    required this.helpLevel,
    required this.reduceMotion,
    required this.showGuides,
    required this.dots,
    required this.connectedDots,
    required this.regionColors,
    required this.colorScheme,
  });

  final List<StrokeState> strokeStates;
  final List<Offset> livePoints;
  final double canvasSize;
  final double toleranceDp;
  final TraceHelpLevel helpLevel;
  final bool reduceMotion;
  final bool showGuides;
  final List<ConnectDot> dots;
  final List<String> connectedDots;
  final Map<String, String> regionColors;
  final ColorScheme colorScheme;

  @override
  void paint(Canvas canvas, Size size) {
    // The colouring fill sits underneath everything else.
    if (regionColors.isNotEmpty) {
      final fill = Paint()..color = _parseHex(regionColors.values.first);
      canvas.drawRect(Offset.zero & size, fill);
    }

    if (showGuides) {
      for (final state in strokeStates) {
        _paintGuide(canvas, size, state);
      }
    }

    for (final state in strokeStates) {
      _paintCompleted(canvas, size, state);
    }

    _paintConnectDots(canvas, size);
    _paintLive(canvas);
  }

  void _paintGuide(Canvas canvas, Size size, StrokeState state) {
    final points = state.stroke.points
        .map((point) => Offset(point.x * size.width, point.y * size.height))
        .toList(growable: false);
    if (points.isEmpty) return;

    // Visual width is deliberately wider than the tolerance: the contract shows
    // a 40dp path with a 24dp deviation budget, so the drawn road looks
    // achievable rather than hair-thin.
    final guidePaint = Paint()
      ..color = switch (state.status) {
        StrokeStatus.complete => colorScheme.primary.withValues(alpha: 0.25),
        StrokeStatus.active => colorScheme.primary.withValues(alpha: 0.35),
        StrokeStatus.locked => colorScheme.outline.withValues(alpha: 0.15),
      }
      ..strokeWidth = 40
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    if (state.stroke.isDot) {
      // The diacritic target: a ring, not a filled blob, so the child can see
      // where to put their finger rather than mistaking it for finished ink.
      canvas.drawCircle(
        points.first,
        20,
        Paint()
          ..color = state.status == StrokeStatus.active
              ? colorScheme.primary.withValues(alpha: 0.5)
              : colorScheme.outline.withValues(alpha: 0.2)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 4,
      );
    } else {
      canvas.drawPath(_pathThrough(points), guidePaint);
      _paintDashes(canvas, points);
    }

    if (state.status != StrokeStatus.active) return;

    // Rung 1: the start point glows. Always drawn, even with reduced motion,
    // because it is the only thing telling the child where to begin.
    final start = state.stroke.reversed ? points.last : points.first;
    canvas.drawCircle(
      start,
      helpLevel == TraceHelpLevel.none ? 14 : 18,
      Paint()..color = colorScheme.secondary.withValues(alpha: 0.85),
    );

    // Rung 2: a direction arrow. Static when motion is reduced — shortened, not
    // removed, so the guidance survives the accessibility setting.
    if (helpLevel == TraceHelpLevel.directionArrow ||
        helpLevel == TraceHelpLevel.showFullMotion) {
      _paintArrow(canvas, points, reduceMotion);
    }
  }

  void _paintDashes(Canvas canvas, List<Offset> points) {
    final dash = Paint()
      ..color = colorScheme.onSurface.withValues(alpha: 0.35)
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;
    for (var i = 1; i < points.length; i++) {
      final from = points[i - 1];
      final to = points[i];
      final distance = (to - from).distance;
      final steps = (distance / 12).ceil().clamp(1, 200);
      for (var step = 0; step < steps; step += 2) {
        final t0 = step / steps;
        final t1 = ((step + 1) / steps).clamp(0.0, 1.0);
        canvas.drawLine(
          Offset.lerp(from, to, t0)!,
          Offset.lerp(from, to, t1)!,
          dash,
        );
      }
    }
  }

  void _paintArrow(Canvas canvas, List<Offset> points, bool reduceMotion) {
    if (points.length < 2) return;
    final from = points.first;
    final to = points[1];
    final direction = (to - from);
    if (direction.distance == 0) return;
    final unit = direction / direction.distance;
    final tip = from + unit * 34;
    final arrow = Paint()
      ..color = colorScheme.secondary
      ..strokeWidth = reduceMotion ? 4 : 5
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(from, tip, arrow);
    final left = Offset(-unit.dy, unit.dx) * 8;
    canvas.drawLine(tip, tip - unit * 10 + left, arrow);
    canvas.drawLine(tip, tip - unit * 10 - left, arrow);
  }

  void _paintCompleted(Canvas canvas, Size size, StrokeState state) {
    if (state.status != StrokeStatus.complete) return;
    final points = state.stroke.points
        .map((point) => Offset(point.x * size.width, point.y * size.height))
        .toList(growable: false);
    final ink = Paint()
      ..color = colorScheme.primary
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    if (state.stroke.isDot) {
      canvas.drawCircle(points.first, 9, Paint()..color = colorScheme.primary);
    } else {
      canvas.drawPath(_pathThrough(points), ink);
    }
  }

  void _paintConnectDots(Canvas canvas, Size size) {
    if (dots.isEmpty) return;
    final connected = <Offset>[];
    for (final dot in dots) {
      final position = Offset(dot.at.x * size.width, dot.at.y * size.height);
      final isDone = connectedDots.contains(dot.id);
      canvas.drawCircle(
        position,
        isDone ? 12 : 10,
        Paint()
          ..color = isDone ? colorScheme.primary : colorScheme.outline,
      );
      if (isDone) connected.add(position);
    }
    if (connected.length >= 2) {
      canvas.drawPath(
        _pathThrough(connected),
        Paint()
          ..color = colorScheme.primary
          ..strokeWidth = 8
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  void _paintLive(Canvas canvas) {
    if (livePoints.length < 2) return;
    canvas.drawPath(
      _pathThrough(livePoints),
      Paint()
        ..color = colorScheme.primary
        ..strokeWidth = 14
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..style = PaintingStyle.stroke,
    );
  }

  /// A smoothed path through [points].
  ///
  /// Quadratic midpoint smoothing rather than straight segments: authored
  /// strokes are sparse, and a curved letter drawn as three straight lines would
  /// not look like the letter it teaches.
  Path _pathThrough(List<Offset> points) {
    final path = Path();
    if (points.isEmpty) return path;
    path.moveTo(points.first.dx, points.first.dy);
    if (points.length == 1) return path;
    if (points.length == 2) {
      path.lineTo(points[1].dx, points[1].dy);
      return path;
    }
    for (var i = 1; i < points.length - 1; i++) {
      final midpoint = Offset(
        (points[i].dx + points[i + 1].dx) / 2,
        (points[i].dy + points[i + 1].dy) / 2,
      );
      path.quadraticBezierTo(points[i].dx, points[i].dy, midpoint.dx, midpoint.dy);
    }
    path.lineTo(points.last.dx, points.last.dy);
    return path;
  }

  @override
  bool shouldRepaint(_TracePainter oldDelegate) => true;
}
