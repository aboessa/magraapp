/// The `trace_color` engine: the drawing surface a child actually touches.
library;

import 'package:flutter/material.dart';
import '../data/creation_document.dart';
import '../presentation/widgets/drawing_asset.dart';
import 'coloring_regions.dart';
import 'free_draw_surface.dart';
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
  @override
  bool get supportsDpad => false;
  @override
  Widget build(BuildContext context, GameSessionController controller) {
    final level = controller.level;
    if (isFreeDrawMode(level.mode) && level.strokes.isEmpty) {
      CreationDocument? doc;
      if (controller.initialCreationJson != null) {
        doc = CreationDocument.tryParse(controller.initialCreationJson!);
      }
      return FreeDrawSurface(controller: controller, initialDocument: doc);
    }
    return TraceColorSurface(controller: controller);
  }
}

class TraceColorSurface extends StatefulWidget {
  const TraceColorSurface({
    required this.controller,
    this.canvasRepaintBoundaryKey,
    super.key,
  });

  final GameSessionController controller;

  /// Optional key for capturing only the activity canvas, without controls.
  final GlobalKey? canvasRepaintBoundaryKey;

  @override
  State<TraceColorSurface> createState() => _TraceColorSurfaceState();
}

class _TraceColorSurfaceState extends State<TraceColorSurface> {
  final List<Offset> _live = [];
  String? _selectedColor;
  int? _activePointer;
  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
    final palette = widget.controller.level.coloring?.palette ?? const [];
    if (palette.isNotEmpty) _selectedColor = palette.first;
  }

  @override
  void didUpdateWidget(covariant TraceColorSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller == widget.controller) return;
    oldWidget.controller.removeListener(_onControllerChanged);
    widget.controller.addListener(_onControllerChanged);
    final palette = widget.controller.level.coloring?.palette ?? const [];
    _selectedColor = palette.isEmpty ? null : palette.first;
    _live.clear();
    _activePointer = null;
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
  List<ColorRegion> _coloringRegions(GameLevel level) {
    final c = level.coloring;
    if (c == null) return const [];
    if (c.hasStructuredRegions) {
      return c.structuredRegions
          .map((m) => ColorRegion.fromJson(m))
          .toList(growable: false);
    }
    // legacy strings -> ids with no geometry
    return c.regions
        .map((id) => ColorRegion(id: id, polygon: const []))
        .toList(growable: false);
  }

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
              aspectRatio: 1,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final size = constraints.biggest.shortestSide;
                  controller.resizeCanvas(size, size);
                  return RepaintBoundary(
                    key: widget.canvasRepaintBoundaryKey,
                    child: _buildCanvas(context, size, isColoringPhase),
                  );
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
    final coloringRegions = _coloringRegions(level);
    final canvas = Stack(
      fit: StackFit.expand,
      children: [
        if (level.backgroundAsset != null)
          _AssetLayer(
            asset: level.backgroundAsset!,
            fit: BoxFit.cover,
            opacity: 1,
            background: true,
          ),
        if (level.coloring?.templateAsset != null)
          _AssetLayer(
            asset: level.coloring!.templateAsset!,
            fit: BoxFit.contain,
            opacity: 0.92,
          ),
        CustomPaint(
          size: Size(size, size),
          painter: _TracePainter(
            strokeStates: List<StrokeState>.unmodifiable(
              session?.strokeStates ?? const <StrokeState>[],
            ),
            livePoints: List<Offset>.unmodifiable(_live),
            canvasSize: size,
            toleranceDp:
                session?.activeTolerance.toleranceDp ?? level.toleranceDp,
            helpLevel: controller.helpLevel,
            reduceMotion: _reduceMotion,
            showGuides: !isColoringPhase,
            dots: List<ConnectDot>.unmodifiable(level.dots),
            connectedDots: List<String>.unmodifiable(controller.connectedDots),
            regionColors: Map<String, String>.unmodifiable(
              controller.regionColors,
            ),
            regions: List<ColorRegion>.unmodifiable(coloringRegions),
            templateAsset: level.coloring?.templateAsset,
            colorScheme: Theme.of(context).colorScheme,
          ),
        ),
      ],
    );
    if (isColoringPhase) {
      return GestureDetector(
        key: const Key('coloring_canvas'),
        behavior: HitTestBehavior.opaque,
        onTapUp: (d) => _paintRegionAt(d.localPosition, size, coloringRegions),
        child: canvas,
      );
    }
    if (level.mode == DrawingMode.connectDots) {
      return GestureDetector(
        key: const Key('connect_dots_canvas'),
        onTapUp: (d) => _tapDotAt(d.localPosition, size),
        child: Semantics(label: 'وصّل النقاط بالترتيب', child: canvas),
      );
    }
    return Listener(
      key: const Key('trace_canvas'),
      behavior: HitTestBehavior.opaque,
      onPointerDown: (e) {
        if (_activePointer != null) return;
        _activePointer = e.pointer;
        _onDown(e.localPosition, size);
      },
      onPointerMove: (e) {
        if (e.pointer != _activePointer) return;
        _onMove(e.localPosition);
      },
      onPointerUp: (e) {
        if (e.pointer != _activePointer) return;
        _activePointer = null;
        _onUp();
      },
      onPointerCancel: (e) {
        if (e.pointer != _activePointer) return;
        _activePointer = null;
        _onUp();
      },
      child: Semantics(
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
      controller.tap(_toEngine(local));
      return;
    }
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
    if (_live.isEmpty) return;
    final wasTap = _live.length <= 2;
    final point = _live.last;
    setState(_live.clear);
    if (wasTap) {
      await controller.tap(_toEngine(point));
      return;
    }
    await controller.endStroke();
  }

  void _tapDotAt(Offset local, double size) {
    final dots = controller.level.dots;
    if (dots.isEmpty) return;
    final radius = effectiveTouchTarget(controller.pack.accessibility) / 2;
    ConnectDot? nearest;
    var best = double.infinity;
    for (final dot in dots) {
      final pos = Offset(dot.at.x * size, dot.at.y * size);
      final d = (pos - local).distance;
      if (d < best) {
        best = d;
        nearest = dot;
      }
    }
    if (nearest == null || best > radius) return;
    controller.connectDot(nearest.id);
  }

  void _paintRegionAt(Offset local, double size, List<ColorRegion> regions) {
    if (_selectedColor == null) return;
    if (regions.isEmpty) return;
    final hit = hitRegionAt(local: local, canvasSize: size, regions: regions);
    // Never guess a region. A tap outside authored geometry must leave the
    // artwork untouched instead of unexpectedly colouring the first shape.
    if (hit == null) return;
    controller.paintRegion(hit, _selectedColor!);
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
              label: 'اختيار اللون $hex',
              child: InkResponse(
                onTap: () => setState(() => _selectedColor = hex),
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
    final canFinish =
        isColoringPhase ||
        controller.level.completion == CompletionRule.childTapsDone;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Wrap(
        alignment: WrapAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
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
            onPressed: isColoringPhase && !controller.canUndoFill
                ? null
                : controller.undo,
          ),
          if (isColoringPhase)
            _ControlButton(
              icon: Icons.redo,
              label: 'إعادة',
              minSize: target,
              onPressed: controller.canRedoFill ? controller.redo : null,
            ),
          _ControlButton(
            icon: Icons.refresh,
            label: 'من جديد',
            minSize: target,
            onPressed: isColoringPhase && controller.regionColors.isEmpty
                ? null
                : controller.clear,
          ),
          if (canFinish)
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

class _AssetLayer extends StatelessWidget {
  const _AssetLayer({
    required this.asset,
    required this.fit,
    required this.opacity,
    this.background = false,
  });
  final String asset;
  final BoxFit fit;
  final double opacity;
  final bool background;
  @override
  Widget build(BuildContext context) {
    return PositionedDrawingAsset(
      assetIdOrPath: asset,
      fit: fit,
      opacity: opacity,
      background: background,
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
  final VoidCallback? onPressed;
  final bool filled;
  @override
  Widget build(BuildContext context) {
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      children: [Icon(icon), const SizedBox(width: 8), Text(label)],
    );
    final style = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(minSize, minSize)),
      padding: const WidgetStatePropertyAll(
        EdgeInsets.symmetric(horizontal: 20),
      ),
    );
    return filled
        ? FilledButton(onPressed: onPressed, style: style, child: child)
        : OutlinedButton(onPressed: onPressed, style: style, child: child);
  }
}

Color _parseHex(String hex) {
  final cleaned = hex.replaceFirst('#', '');
  final v = int.tryParse(cleaned, radix: 16);
  if (v == null) return Colors.grey;
  return Color(0xFF000000 | v);
}

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
    required this.regions,
    required this.templateAsset,
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
  final List<ColorRegion> regions;
  final String? templateAsset;
  final ColorScheme colorScheme;
  @override
  void paint(Canvas canvas, Size size) {
    // Render order: background (already in stack) -> fills -> outlines -> strokes
    // Fills per region
    if (regionColors.isNotEmpty && regions.isNotEmpty) {
      final paths = regionPaths(regions, size);
      for (final entry in paths) {
        final hex = regionColors[entry.$1];
        if (hex == null) continue;
        canvas.drawPath(
          entry.$2,
          Paint()
            ..color = _parseHex(hex)
            ..style = PaintingStyle.fill,
        );
      }
    } else if (regionColors.isNotEmpty) {
      // legacy single-rectangle fallback
      final fill = Paint()..color = _parseHex(regionColors.values.first);
      canvas.drawRect(Offset.zero & size, fill);
    }
    // If no fills yet, faint region outlines help child see boundaries
    if (regions.isNotEmpty && regionColors.isEmpty) {
      final paths = regionPaths(regions, size);
      for (final entry in paths) {
        canvas.drawPath(
          entry.$2,
          Paint()
            ..color = colorScheme.outline.withValues(alpha: 0.25)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2,
        );
      }
    }
    // Outlines on top of fills but under guide strokes
    if (regions.isNotEmpty && regionColors.isNotEmpty) {
      final paths = regionPaths(regions, size);
      for (final entry in paths) {
        canvas.drawPath(
          entry.$2,
          Paint()
            ..color = Colors.black.withValues(alpha: 0.35)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2.5
            ..strokeJoin = StrokeJoin.round,
        );
      }
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
        .map((p) => Offset(p.x * size.width, p.y * size.height))
        .toList(growable: false);
    if (points.isEmpty) return;
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
    final start = state.stroke.reversed ? points.last : points.first;
    canvas.drawCircle(
      start,
      helpLevel == TraceHelpLevel.none ? 14 : 18,
      Paint()..color = colorScheme.secondary.withValues(alpha: 0.85),
    );
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
      final d = (to - from).distance;
      final steps = (d / 12).ceil().clamp(1, 200);
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
    final dir = (to - from);
    if (dir.distance == 0) return;
    final unit = dir / dir.distance;
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
        .map((p) => Offset(p.x * size.width, p.y * size.height))
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
      final pos = Offset(dot.at.x * size.width, dot.at.y * size.height);
      final isDone = connectedDots.contains(dot.id);
      canvas.drawCircle(
        pos,
        isDone ? 12 : 10,
        Paint()..color = isDone ? colorScheme.primary : colorScheme.outline,
      );
      if (isDone) connected.add(pos);
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
      final mid = Offset(
        (points[i].dx + points[i + 1].dx) / 2,
        (points[i].dy + points[i + 1].dy) / 2,
      );
      path.quadraticBezierTo(points[i].dx, points[i].dy, mid.dx, mid.dy);
    }
    path.lineTo(points.last.dx, points.last.dy);
    return path;
  }

  @override
  bool shouldRepaint(_TracePainter old) {
    if (old.canvasSize != canvasSize) return true;
    if (old.toleranceDp != toleranceDp) return true;
    if (old.helpLevel != helpLevel) return true;
    if (old.reduceMotion != reduceMotion) return true;
    if (old.showGuides != showGuides) return true;
    if (old.templateAsset != templateAsset) return true;
    if (old.colorScheme != colorScheme) return true;
    if (old.livePoints.length != livePoints.length) return true;
    if (old.strokeStates.length != strokeStates.length) return true;
    if (old.dots.length != dots.length) return true;
    if (old.connectedDots.length != connectedDots.length) return true;
    if (old.regionColors.length != regionColors.length) return true;
    if (old.regions.length != regions.length) return true;
    // Compare stroke status
    for (var i = 0; i < strokeStates.length; i++) {
      if (old.strokeStates[i] != strokeStates[i]) return true;
    }
    for (final k in regionColors.keys) {
      if (old.regionColors[k] != regionColors[k]) return true;
    }
    if (old.livePoints.isNotEmpty && livePoints.isNotEmpty) {
      if (old.livePoints.last != livePoints.last) return true;
    }
    return false;
  }
}
