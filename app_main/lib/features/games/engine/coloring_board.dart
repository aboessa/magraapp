/// Colouring board: an ordinary picture, and a child painting on top of it.
///
/// There is no build step, no region map, no compiled sidecar and no QA gate. A
/// colouring page is just an image file, so adding one means dropping a picture
/// in `assets/images/coloring/` and adding three lines of JSON. Any raster format
/// the Flutter decoder handles works — PNG, JPG, JPEG, WebP — because nothing
/// here reads the pixels as data. The picture is drawn, and the bucket samples it.
///
/// ## How the layers work
///
/// Three layers, bottom to top:
///
///   1. opaque white paper
///   2. the child's paint
///   3. the picture, composited with `BlendMode.multiply`
///
/// Multiply is what makes it feel like colouring rather than scribbling over the
/// top. White in the picture lets the paint below show through unchanged, black
/// outlines stay black no matter what colour is under them. So a child can paint
/// straight across a line and the line survives — which is the whole point, since
/// a three-year-old will not stay inside it.
///
/// ## Why paint is replayed rather than snapshotted
///
/// Every action is kept as an op (a stroke or a bucket fill) and the paint layer
/// is rebuilt by replaying them. Undo is then "drop the last op and replay",
/// which costs no memory. Snapshotting the pixel buffer instead would be 4MB per
/// undo step at 1024x1024, and a ten-deep history would be 40MB of images for a
/// children's colouring page.
///
/// The in-progress stroke is drawn straight onto the canvas as a path and only
/// committed to the buffer on lift, so dragging a finger never touches a
/// million-pixel buffer mid-gesture.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/coloring_page.dart';

/// Longest edge the picture is decoded to.
///
/// The bucket walks pixels, so an unbounded source would make one tap cost
/// whatever resolution the artist happened to export. Capping at 1024 keeps a
/// fill in the low tens of milliseconds and is still far more detail than a
/// colouring page needs.
const int kColoringCanvasMaxEdge = 1024;

/// How far a colour may drift from the tapped pixel and still be filled.
///
/// Sum of the three channel differences, so 0-765. 120 is loose enough to cross
/// the soft edge of a JPEG outline but tight enough to stop at it.
const int kBucketTolerance = 120;

enum ColoringTool { brush, bucket, eraser }

/// One thing the child did. Kept so it can be replayed and undone.
sealed class _PaintOp {
  const _PaintOp();
}

class _StrokeOp extends _PaintOp {
  const _StrokeOp({
    required this.points,
    required this.argb,
    required this.widthPx,
    required this.erase,
  });

  /// Image-pixel coordinates, not screen coordinates, so a stroke survives a
  /// rotation or resize.
  final List<Offset> points;
  final int argb;
  final double widthPx;
  final bool erase;
}

class _FillOp extends _PaintOp {
  const _FillOp({required this.x, required this.y, required this.argb});
  final int x;
  final int y;
  final int argb;
}

class ColoringBoard extends StatefulWidget {
  const ColoringBoard({
    super.key,
    required this.page,
    this.canvasKey,
    this.onPaintedChanged,
  });

  final ColoringPage page;

  /// Repaint boundary around the artwork only, so a save captures the picture
  /// without the toolbar or palette.
  final GlobalKey? canvasKey;

  /// Fires when the board goes from untouched to painted, or back, so a host can
  /// enable or disable its save button.
  final ValueChanged<bool>? onPaintedChanged;

  @override
  State<ColoringBoard> createState() => _ColoringBoardState();
}

class _ColoringBoardState extends State<ColoringBoard> {
  ui.Image? _picture;

  /// Straight RGBA of the picture. Read only by the bucket, to decide what counts
  /// as the same area as the tapped pixel.
  Uint8List? _source;

  int _w = 0;
  int _h = 0;

  final List<_PaintOp> _ops = [];
  final List<_PaintOp> _undone = [];

  /// Committed paint. Straight RGBA packed little-endian, so a word is ABGR.
  Uint32List? _paint;
  ui.Image? _paintImage;

  List<Offset> _current = const [];
  int? _activePointer;

  ColoringTool _tool = ColoringTool.brush;
  late String _hex;
  double _brushPx = 26;

  bool _loading = true;
  Object? _error;
  int _paintGeneration = 0;

  @override
  void initState() {
    super.initState();
    _hex = widget.page.palette.first;
    _load();
  }

  @override
  void dispose() {
    _picture?.dispose();
    _paintImage?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await rootBundle.load(widget.page.image);
      final codec = await ui.instantiateImageCodec(
        data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
        targetWidth: null,
      );
      ui.Image image;
      try {
        image = (await codec.getNextFrame()).image;
      } finally {
        codec.dispose();
      }

      // Re-decode smaller when the source is oversized, rather than scaling on
      // every paint.
      final longest = math.max(image.width, image.height);
      if (longest > kColoringCanvasMaxEdge) {
        final scale = kColoringCanvasMaxEdge / longest;
        final scaled = await ui.instantiateImageCodec(
          data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
          targetWidth: (image.width * scale).round(),
          targetHeight: (image.height * scale).round(),
        );
        try {
          final frame = await scaled.getNextFrame();
          image.dispose();
          image = frame.image;
        } finally {
          scaled.dispose();
        }
      }

      final rgba = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      if (rgba == null) {
        image.dispose();
        throw StateError('could not read pixels of ${widget.page.image}');
      }

      if (!mounted) {
        image.dispose();
        return;
      }

      setState(() {
        _picture = image;
        _source = rgba.buffer.asUint8List();
        _w = image.width;
        _h = image.height;
        _paint = Uint32List(image.width * image.height);
        _loading = false;
      });
      await _commit();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error;
          _loading = false;
        });
      }
    }
  }

  static int _pack(Color color) {
    final a = (color.a * 255).round() & 0xff;
    final r = (color.r * 255).round() & 0xff;
    final g = (color.g * 255).round() & 0xff;
    final b = (color.b * 255).round() & 0xff;
    return (a << 24) | (b << 16) | (g << 8) | r;
  }

  static Color _parseHex(String hex) {
    final value = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
    if (value == null) return Colors.grey;
    return Color(0xFF000000 | value);
  }

  Color get _color => _parseHex(_hex);

  bool get _hasPaint => _ops.isNotEmpty;

  /// Replays every op into the paint buffer and hands the result to the painter.
  Future<void> _commit() async {
    final buffer = _paint;
    if (buffer == null) return;

    final generation = ++_paintGeneration;
    buffer.fillRange(0, buffer.length, 0);
    for (final op in _ops) {
      switch (op) {
        case _StrokeOp():
          _rasterStroke(buffer, op);
        case _FillOp():
          _floodFill(buffer, op);
      }
    }

    final completer = Completer<ui.Image>();
    ui.decodeImageFromPixels(
      buffer.buffer.asUint8List(),
      _w,
      _h,
      ui.PixelFormat.rgba8888,
      completer.complete,
    );
    final image = await completer.future;

    if (!mounted || generation != _paintGeneration) {
      image.dispose();
      return;
    }
    final previous = _paintImage;
    setState(() => _paintImage = image);
    previous?.dispose();
  }

  void _rasterStroke(Uint32List dst, _StrokeOp op) {
    final radius = op.widthPx / 2;
    final value = op.erase ? 0 : op.argb;
    if (op.points.length == 1) {
      _stampDisc(dst, op.points.first, radius, value);
      return;
    }
    for (var i = 1; i < op.points.length; i++) {
      final a = op.points[i - 1];
      final b = op.points[i];
      final distance = (b - a).distance;
      // Overlapping discs rather than a line, so thickness is uniform and joins
      // need no special case.
      final steps = math.max(1, (distance / (radius * 0.5)).ceil());
      for (var s = 0; s <= steps; s++) {
        _stampDisc(dst, Offset.lerp(a, b, s / steps)!, radius, value);
      }
    }
  }

  void _stampDisc(Uint32List dst, Offset center, double radius, int value) {
    final minX = math.max(0, (center.dx - radius).floor());
    final maxX = math.min(_w - 1, (center.dx + radius).ceil());
    final minY = math.max(0, (center.dy - radius).floor());
    final maxY = math.min(_h - 1, (center.dy + radius).ceil());
    final rr = radius * radius;
    for (var y = minY; y <= maxY; y++) {
      final dy = y - center.dy;
      final row = y * _w;
      for (var x = minX; x <= maxX; x++) {
        final dx = x - center.dx;
        if (dx * dx + dy * dy <= rr) dst[row + x] = value;
      }
    }
  }

  /// Spreads from the tapped pixel through everything that looks like the same
  /// area in the *picture*, not in the paint.
  ///
  /// Sampling the picture rather than the paint layer is what makes a fill
  /// repeatable: the child can recolour a region as many times as they like,
  /// because the boundary is a property of the drawing and never changes.
  void _floodFill(Uint32List dst, _FillOp op) {
    final source = _source;
    if (source == null) return;
    if (op.x < 0 || op.y < 0 || op.x >= _w || op.y >= _h) return;

    final start = op.y * _w + op.x;
    final seed = start * 4;
    final sr = source[seed];
    final sg = source[seed + 1];
    final sb = source[seed + 2];

    final visited = Uint8List(_w * _h);
    final stack = <int>[start];
    visited[start] = 1;

    while (stack.isNotEmpty) {
      final p = stack.removeLast();
      final o = p * 4;
      final drift =
          (source[o] - sr).abs() +
          (source[o + 1] - sg).abs() +
          (source[o + 2] - sb).abs();
      if (drift > kBucketTolerance) continue;

      dst[p] = op.argb;

      final x = p % _w;
      // Marked on push, not on pop, so a pixel is never queued twice and the
      // stack stays far below the pixel count.
      if (x > 0 && visited[p - 1] == 0) {
        visited[p - 1] = 1;
        stack.add(p - 1);
      }
      if (x < _w - 1 && visited[p + 1] == 0) {
        visited[p + 1] = 1;
        stack.add(p + 1);
      }
      if (p >= _w && visited[p - _w] == 0) {
        visited[p - _w] = 1;
        stack.add(p - _w);
      }
      if (p + _w < visited.length && visited[p + _w] == 0) {
        visited[p + _w] = 1;
        stack.add(p + _w);
      }
    }
  }

  Offset? _toImage(Offset local, Size box) {
    if (box.width <= 0 || box.height <= 0) return null;
    final x = local.dx / box.width * _w;
    final y = local.dy / box.height * _h;
    if (x < 0 || y < 0 || x >= _w || y >= _h) return null;
    return Offset(x, y);
  }

  void _pushOp(_PaintOp op) {
    final wasPainted = _hasPaint;
    _ops.add(op);
    _undone.clear();
    if (_hasPaint != wasPainted) widget.onPaintedChanged?.call(_hasPaint);
    _commit();
  }

  void _onDown(int pointer, Offset local, Size box) {
    final point = _toImage(local, box);
    if (point == null) return;

    if (_tool == ColoringTool.bucket) {
      _pushOp(
        _FillOp(
          x: point.dx.floor(),
          y: point.dy.floor(),
          argb: _pack(_color),
        ),
      );
      return;
    }
    setState(() {
      _activePointer = pointer;
      _current = [point];
    });
  }

  void _onMove(int pointer, Offset local, Size box) {
    if (pointer != _activePointer) return;
    final point = _toImage(local, box);
    if (point == null) return;
    setState(() => _current = [..._current, point]);
  }

  void _onUp(int pointer) {
    if (pointer != _activePointer) return;
    final points = _current;
    setState(() {
      _activePointer = null;
      _current = const [];
    });
    if (points.isEmpty) return;
    _pushOp(
      _StrokeOp(
        points: points,
        argb: _pack(_color),
        widthPx: _brushPx,
        erase: _tool == ColoringTool.eraser,
      ),
    );
  }

  void _undo() {
    if (_ops.isEmpty) return;
    final wasPainted = _hasPaint;
    _undone.add(_ops.removeLast());
    if (_hasPaint != wasPainted) widget.onPaintedChanged?.call(_hasPaint);
    _commit();
  }

  void _redo() {
    if (_undone.isEmpty) return;
    final wasPainted = _hasPaint;
    _ops.add(_undone.removeLast());
    if (_hasPaint != wasPainted) widget.onPaintedChanged?.call(_hasPaint);
    _commit();
  }

  void _clear() {
    if (_ops.isEmpty) return;
    _undone.clear();
    _ops.clear();
    widget.onPaintedChanged?.call(false);
    _commit();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    final picture = _picture;
    if (picture == null || _error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            'تعذّر تحميل الرسمة. حاول مرة أخرى.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: Row(
            children: [
              _buildToolRail(context),
              Expanded(child: _buildCanvas(context, picture)),
            ],
          ),
        ),
        _buildPalette(context),
      ],
    );
  }

  Widget _buildCanvas(BuildContext context, ui.Image picture) {
    return Center(
      child: AspectRatio(
        aspectRatio: _w / _h,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final box = constraints.biggest;
            return ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: RepaintBoundary(
                key: widget.canvasKey,
                child: Listener(
                  behavior: HitTestBehavior.opaque,
                  onPointerDown: (e) => _onDown(e.pointer, e.localPosition, box),
                  onPointerMove: (e) => _onMove(e.pointer, e.localPosition, box),
                  onPointerUp: (e) => _onUp(e.pointer),
                  onPointerCancel: (e) => _onUp(e.pointer),
                  child: Semantics(
                    label: 'مساحة تلوين ${widget.page.label}',
                    child: CustomPaint(
                      size: box,
                      painter: _ColoringPainter(
                        picture: picture,
                        paintLayer: _paintImage,
                        current: List<Offset>.unmodifiable(_current),
                        currentColor: _tool == ColoringTool.eraser
                            ? Colors.white
                            : _color,
                        currentWidthPx: _brushPx,
                        imageWidth: _w,
                        imageHeight: _h,
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildToolRail(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    Widget button({
      required IconData icon,
      required String label,
      required bool active,
      required VoidCallback? onTap,
    }) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Semantics(
          button: true,
          selected: active,
          label: label,
          child: Tooltip(
            message: label,
            child: InkResponse(
              onTap: onTap,
              radius: 26,
              customBorder: const CircleBorder(),
              child: Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: active ? scheme.primaryContainer : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  icon,
                  size: 22,
                  color: onTap == null
                      ? scheme.onSurfaceVariant.withValues(alpha: 0.35)
                      : active
                      ? scheme.onPrimaryContainer
                      : scheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            button(
              icon: Icons.brush_outlined,
              label: 'فرشاة',
              active: _tool == ColoringTool.brush,
              onTap: () => setState(() => _tool = ColoringTool.brush),
            ),
            button(
              icon: Icons.format_color_fill,
              label: 'دلو التلوين',
              active: _tool == ColoringTool.bucket,
              onTap: () => setState(() => _tool = ColoringTool.bucket),
            ),
            button(
              icon: Icons.cleaning_services_outlined,
              label: 'ممحاة',
              active: _tool == ColoringTool.eraser,
              onTap: () => setState(() => _tool = ColoringTool.eraser),
            ),
            const Divider(height: 12, indent: 10, endIndent: 10),
            button(
              icon: Icons.undo,
              label: 'رجوع',
              active: false,
              onTap: _ops.isEmpty ? null : _undo,
            ),
            button(
              icon: Icons.redo,
              label: 'إعادة',
              active: false,
              onTap: _undone.isEmpty ? null : _redo,
            ),
            button(
              icon: Icons.refresh,
              label: 'من جديد',
              active: false,
              onTap: _ops.isEmpty ? null : _clear,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPalette(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 10, 8, 4),
      child: Column(
        children: [
          Wrap(
            alignment: WrapAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: [
              for (final hex in widget.page.palette)
                Semantics(
                  button: true,
                  selected: _hex == hex && _tool != ColoringTool.eraser,
                  label: 'اختيار اللون $hex',
                  child: InkResponse(
                    onTap: () => setState(() {
                      _hex = hex;
                      // Picking a colour means the child wants to paint, so the
                      // eraser stepping aside is the least surprising behaviour.
                      if (_tool == ColoringTool.eraser) {
                        _tool = ColoringTool.brush;
                      }
                    }),
                    radius: 24,
                    customBorder: const CircleBorder(),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: _parseHex(hex),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _hex == hex && _tool != ColoringTool.eraser
                              ? scheme.onSurface
                              : scheme.outlineVariant,
                          width: _hex == hex && _tool != ColoringTool.eraser
                              ? 3
                              : 1,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
          Row(
            children: [
              const Icon(Icons.circle, size: 12),
              Expanded(
                child: Semantics(
                  label: 'حجم الفرشاة',
                  child: Slider(
                    value: _brushPx,
                    min: 8,
                    max: 64,
                    onChanged: (v) => setState(() => _brushPx = v),
                  ),
                ),
              ),
              const Icon(Icons.circle, size: 26),
            ],
          ),
        ],
      ),
    );
  }
}

class _ColoringPainter extends CustomPainter {
  const _ColoringPainter({
    required this.picture,
    required this.paintLayer,
    required this.current,
    required this.currentColor,
    required this.currentWidthPx,
    required this.imageWidth,
    required this.imageHeight,
  });

  final ui.Image picture;

  /// Named `paintLayer` rather than `paint` because `CustomPainter.paint` is the
  /// method being overridden below and a field cannot share its name.
  final ui.Image? paintLayer;
  final List<Offset> current;
  final Color currentColor;
  final double currentWidthPx;
  final int imageWidth;
  final int imageHeight;

  @override
  void paint(Canvas canvas, Size size) {
    final destination = Rect.fromLTWH(0, 0, size.width, size.height);
    final source = Rect.fromLTWH(
      0,
      0,
      imageWidth.toDouble(),
      imageHeight.toDouble(),
    );

    // Opaque white paper, so unpainted areas read white once the picture is
    // multiplied over the top.
    canvas.drawRect(destination, Paint()..color = const Color(0xFFFFFFFF));

    final layer = paintLayer;
    if (layer != null) {
      canvas.drawImageRect(layer, source, destination, Paint());
    }

    // The live stroke is drawn as a path rather than rasterised, so a drag never
    // rebuilds the pixel buffer. It is committed on lift.
    if (current.isNotEmpty) {
      final scale = size.width / imageWidth;
      final brush = Paint()
        ..color = currentColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = currentWidthPx * scale
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      if (current.length == 1) {
        canvas.drawCircle(
          current.first * scale,
          currentWidthPx * scale / 2,
          Paint()..color = currentColor,
        );
      } else {
        final path = Path()
          ..moveTo(current.first.dx * scale, current.first.dy * scale);
        for (var i = 1; i < current.length; i++) {
          path.lineTo(current[i].dx * scale, current[i].dy * scale);
        }
        canvas.drawPath(path, brush);
      }
    }

    // Multiply keeps the outlines on top of the paint without hiding it: white
    // passes the colour below through, black stays black.
    canvas.drawImageRect(
      picture,
      source,
      destination,
      Paint()..blendMode = BlendMode.multiply,
    );
  }

  @override
  bool shouldRepaint(_ColoringPainter old) =>
      old.picture != picture ||
      old.paintLayer != paintLayer ||
      old.current != current ||
      old.currentColor != currentColor ||
      old.currentWidthPx != currentWidthPx;
}
