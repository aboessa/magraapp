/// شاشة التتبّع نفسها — مطابق صورة trace: حرف/رقم كبير جدا اتجاه بداية ونهاية
/// Stroke order نقاط/أسهم Progress 2 من 4 إعادة تعليمات تلميح تم
/// UX مختلف عن رسم حر: tolerance DP 40 coverage 0.6 sequential alternative
library;
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../engine/trace_geometry.dart';
import '../../studio/studio_app_bar.dart';

const _kDeep = Color(0xFF0C1030);
const _kPurple = Color(0xFF6A3DF2);
const _kGold = Color(0xFFFFD34D);
const _kCyan = Color(0xFF6EE7FF);
const _kGreen = Color(0xFF2EAC5A);

class TraceLevelSpec {
  const TraceLevelSpec({
    required this.id,
    required this.title,
    required this.symbol,
    required this.strokePaths,
    this.totalSteps = 4,
    this.currentStep = 2,
    this.hint = 'اتبع المسار من النقطة الخضراء إلى الحمراء',
  });
  final String id;
  final String title;
  final String symbol; // مثل "أ" أو "7"
  final List<TraceStroke> strokePaths;
  final int totalSteps;
  final int currentStep;
  final String hint;
}

class TraceBoardV2Page extends StatefulWidget {
  const TraceBoardV2Page({
    required this.level,
    this.onDone,
    this.onNext,
    super.key,
  });
  final TraceLevelSpec level;
  final VoidCallback? onDone;
  final VoidCallback? onNext;

  @override
  State<TraceBoardV2Page> createState() => _TraceBoardV2State();
}

class _TraceBoardV2State extends State<TraceBoardV2Page> {
  final List<List<Offset>> _progressPoints = [];
  List<Offset> _currentPoints = [];
  int _completedStrokes = 0;
  bool _showInstruction = true;

  static const double _toleranceDp = 40;
  static const double _coverageRequired = 0.6;
  static const double _resampleSpacing = 12;

  TraceLevelSpec get lvl => widget.level;

  void _reset() {
    setState(() {
      _progressPoints.clear();
      _currentPoints = [];
      _completedStrokes = 0;
      _showInstruction = true;
    });
  }

  void _onPanStart(DragStartDetails d, Size size, BoxConstraints cons) {
    setState(() {
      _currentPoints = [d.localPosition];
      _showInstruction = false;
    });
  }

  void _onPanUpdate(DragUpdateDetails d) {
    setState(() {
      _currentPoints = [..._currentPoints, d.localPosition];
    });
  }

  void _onPanEnd(DragEndDetails details, Size size) {
    if (_currentPoints.isEmpty) return;
    // Check against expected stroke
    final expectedIndex = _completedStrokes;
    final strokes = lvl.strokePaths;
    if (expectedIndex >= strokes.length) return;
    final stroke = strokes[expectedIndex];
    // canvas size approximated from parent constraints — caller ensures ~square
    final cov = _coverageForCurrent(size, stroke);
    if (cov >= _coverageRequired) {
      setState(() {
        _progressPoints.add(List.from(_currentPoints));
        _currentPoints = [];
        _completedStrokes++;
        if (_completedStrokes >= strokes.length) {
          // level done
          Future.delayed(const Duration(milliseconds: 500), () {
            widget.onDone?.call();
          });
        }
      });
    } else {
      // Keep visual but flash guide? Just clear current for simplicity.
      setState(() {
        _currentPoints = [];
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('حاول مرة أخرى — غط ${(cov * 100).round()}% فقط (المطلوب ${(100 * _coverageRequired).round()}%)'), duration: const Duration(milliseconds: 1400)));
    }
  }

  double _coverageForCurrent(Size size, TraceStroke stroke) {
    if (_currentPoints.isEmpty) return 0;
    final guidePx = stroke.points.map((np) => np.scale(size.width, size.height)).map((o) => Offset2D(o.dx, o.dy)).toList();
    final resampledGuide = resamplePath(guidePx, _resampleSpacing);
    if (resampledGuide.isEmpty) return 0;
    var hits = 0;
    final finger2d = _currentPoints.map((o) => Offset2D(o.dx, o.dy)).toList();
    for (final g in resampledGuide) {
      final d = distanceToPath(g, finger2d);
      if (d <= _toleranceDp) hits++;
    }
    return hits / resampledGuide.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kDeep,
      appBar: StudioAppBar(
        title: 'تتبّع ${lvl.symbol}',
        glyph: Icons.gesture_rounded,
        actions: [
          StudioBarPill(
            label: '${lvl.currentStep} من ${lvl.totalSteps}',
            icon: Icons.flag_rounded,
          ),
        ],
      ),
      body: LayoutBuilder(builder: (ctx, cons) {
        final canvasSide = math.min(cons.maxWidth, cons.maxHeight * 0.72);
        return Column(children: [
          if (_showInstruction)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white12)),
              child: Row(children: [
                const Icon(Icons.lightbulb_rounded, size: 18, color: _kGold),
                const SizedBox(width: 8),
                Expanded(child: Text(lvl.hint, style: const TextStyle(color: Colors.white70, fontSize: 12, height: 1.4))),
                TextButton(onPressed: () => setState(() => _showInstruction = false), child: const Text('حسناً', style: TextStyle(color: _kGold, fontWeight: FontWeight.w700))),
              ]),
            ),
          const SizedBox(height: 4),
          Expanded(
            child: Center(
              child: Container(
                width: canvasSide,
                height: canvasSide,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.35), blurRadius: 24, offset: const Offset(0, 12))],
                ),
                clipBehavior: Clip.antiAlias,
                child: Stack(children: [
                  // Guide layers
                  CustomPaint(size: Size(canvasSide, canvasSide), painter: _GuidePainter(level: lvl, completedCount: _completedStrokes)),
                  // Completed strokes
                  CustomPaint(size: Size(canvasSide, canvasSide), painter: _CompletedStrokesPainter(points: _progressPoints)),
                  // Current finger
                  GestureDetector(
                    onPanStart: (d) => _onPanStart(d, Size(canvasSide, canvasSide), cons),
                    onPanUpdate: _onPanUpdate,
                    onPanEnd: (d) => _onPanEnd(d, Size(canvasSide, canvasSide)),
                    child: CustomPaint(size: Size(canvasSide, canvasSide), painter: _CurrentPainter(points: _currentPoints)),
                  ),
                  // Symbol watermark center
                  Center(child: Opacity(opacity: 0.07, child: Text(lvl.symbol, style: TextStyle(fontSize: canvasSide * 0.55, fontWeight: FontWeight.w900, color: Colors.black)))),
                  // Endpoints markers for current expected stroke
                  if (_completedStrokes < lvl.strokePaths.length)
                    CustomPaint(
                      size: Size(canvasSide, canvasSide),
                      painter: _EndpointsPainter(
                        stroke: lvl.strokePaths[_completedStrokes],
                        canvasSize: Size(canvasSide, canvasSide),
                        achieved: _currentPoints.isNotEmpty ? _coverageForCurrent(Size(canvasSide, canvasSide), lvl.strokePaths[_completedStrokes]) : null,
                      ),
                    ),
                ]),
              ),
            ),
          ),
          const SizedBox(height: 12),
          _ActionRow(
            onReset: _reset,
            onHint: () => setState(() => _showInstruction = true),
            onUndo: () {
              if (_progressPoints.isEmpty) return;
              setState(() {
                _progressPoints.removeLast();
                if (_completedStrokes > 0) _completedStrokes--;
              });
            },
            onSelectColor: null,
            onDone: () {
              if (_completedStrokes >= lvl.strokePaths.length) {
                widget.onDone?.call();
              } else {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أكمل جميع الخطوات أولاً')));
              }
            },
          ),
          const SizedBox(height: 10),
          _ProgressDots(total: lvl.strokePaths.length, completed: _completedStrokes),
          const SizedBox(height: 18),
        ]);
      }),
    );
  }
}

class _GuidePainter extends CustomPainter {
  _GuidePainter({required this.level, required this.completedCount});
  final TraceLevelSpec level;
  final int completedCount;

  @override
  void paint(Canvas canvas, Size size) {
    for (var i = 0; i < level.strokePaths.length; i++) {
      final st = level.strokePaths[i];
      final isDone = i < completedCount;
      final isCurrent = i == completedCount;
      final pts = st.points.map((np) => Offset(np.x * size.width, np.y * size.height)).toList();
      if (pts.length < 2) continue;
      final paint = Paint()
        ..color = isDone ? _kGreen.withValues(alpha: 0.9) : isCurrent ? _kCyan.withValues(alpha: 0.55) : Colors.grey.withValues(alpha: 0.35)
        ..style = PaintingStyle.stroke
        ..strokeWidth = isCurrent ? 14 : 10
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      // dashed for current
      final path = Path()..moveTo(pts.first.dx, pts.first.dy);
      for (final p in pts.skip(1)) {
        path.lineTo(p.dx, p.dy);
      }
      if (isCurrent) {
        _drawDashed(canvas, path, paint);
        // arrow direction
        _drawArrow(canvas, pts);
      } else {
        canvas.drawPath(path, paint);
      }
    }
  }

  void _drawDashed(Canvas canvas, Path src, Paint p) {
    final dashedPath = _dashPath(src, dashLen: 14, gapLen: 10);
    canvas.drawPath(dashedPath, p);
  }

  Path _dashPath(Path source, {required double dashLen, required double gapLen}) {
    final dashed = Path();
    for (final metric in source.computeMetrics()) {
      double dist = 0;
      while (dist < metric.length) {
        final nextDash = dist + dashLen;
        dashed.addPath(metric.extractPath(dist, nextDash.clamp(0, metric.length)), Offset.zero);
        dist = nextDash + gapLen;
      }
    }
    return dashed;
  }

  void _drawArrow(Canvas canvas, List<Offset> pts) {
    if (pts.length < 2) return;
    final last = pts.last;
    final before = pts[pts.length - 2];
    final angle = (last - before).direction;
    const arrowLen = 18.0;
    final p1 = last - Offset.fromDirection(angle, arrowLen) + Offset.fromDirection(angle + 0.5, arrowLen * 0.5);
    final p2 = last - Offset.fromDirection(angle, arrowLen) + Offset.fromDirection(angle - 0.5, arrowLen * 0.5);
    final ap = Paint()..color = _kCyan..style = PaintingStyle.fill;
    final path = Path()..moveTo(last.dx, last.dy)..lineTo(p1.dx, p1.dy)..lineTo(p2.dx, p2.dy)..close();
    canvas.drawPath(path, ap);
  }

  @override
  bool shouldRepaint(covariant _GuidePainter old) => old.level.id != level.id || old.completedCount != completedCount;
}

class _CompletedStrokesPainter extends CustomPainter {
  _CompletedStrokesPainter({required this.points});
  final List<List<Offset>> points;

  @override
  void paint(Canvas canvas, Size size) {
    for (final stroke in points) {
      if (stroke.length < 2) continue;
      final p = Paint()..color = const Color(0xFF111111)..style = PaintingStyle.stroke..strokeWidth = 12..strokeCap = StrokeCap.round..strokeJoin = StrokeJoin.round;
      final path = Path()..moveTo(stroke.first.dx, stroke.first.dy);
      for (final pt in stroke.skip(1)) {
        path.lineTo(pt.dx, pt.dy);
      }
      canvas.drawPath(path, p);
    }
  }

  @override
  bool shouldRepaint(covariant _CompletedStrokesPainter old) => old.points.length != points.length;
}

class _CurrentPainter extends CustomPainter {
  _CurrentPainter({required this.points});
  final List<Offset> points;
  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final paint = Paint()..color = const Color(0xFF6A3DF2)..style = PaintingStyle.stroke..strokeWidth = 12..strokeCap = StrokeCap.round;
    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final pt in points.skip(1)) {
      path.lineTo(pt.dx, pt.dy);
    }
    canvas.drawPath(path, paint);
  }
  @override
  bool shouldRepaint(covariant _CurrentPainter old) => old.points.length != points.length;
}

class _EndpointsPainter extends CustomPainter {
  _EndpointsPainter({required this.stroke, required this.canvasSize, this.achieved});
  final TraceStroke stroke;
  final Size canvasSize;
  final double? achieved;

  @override
  void paint(Canvas canvas, Size size) {
    if (stroke.points.isEmpty) return;
    final first = stroke.points.first;
    final last = stroke.points.last;
    final s = Offset(first.x * size.width, first.y * size.height);
    final e = Offset(last.x * size.width, last.y * size.height);

    // start green dot with order 1
    canvas.drawCircle(s, 18, Paint()..color = _kGreen);
    _drawText(canvas, s, '1', Colors.white, 16);
    // end red dot
    canvas.drawCircle(e, 18, Paint()..color = const Color(0xFFE23D7A));
    const endIcon = '2';
    _drawText(canvas, e, endIcon, Colors.white, 16);

    // progress badge near current if provided
    if (achieved != null && achieved! > 0) {
      final pct = (achieved! * 100).round();
      final text = '$pct%';
      final tp = TextPainter(text: TextSpan(text: text, style: const TextStyle(color: _kDeep, fontWeight: FontWeight.w800, fontSize: 12)), textDirection: TextDirection.rtl)..layout();
      final rect = RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(size.width / 2, 20), width: tp.width + 16, height: 24), const Radius.circular(12));
      canvas.drawRRect(rect, Paint()..color = _kGold);
      tp.paint(canvas, Offset(rect.left + 8, rect.top + 4));
    }
  }

  void _drawText(Canvas c, Offset center, String txt, Color color, double size) {
    final tp = TextPainter(text: TextSpan(text: txt, style: TextStyle(color: color, fontSize: size, fontWeight: FontWeight.w800)), textDirection: TextDirection.rtl, textAlign: TextAlign.center)..layout();
    tp.paint(c, center - Offset(tp.width / 2, tp.height / 2));
  }

  @override
  bool shouldRepaint(covariant _EndpointsPainter old) => old.stroke.id != stroke.id || old.achieved != achieved;
}

class _ActionRow extends StatelessWidget {
  const _ActionRow({required this.onReset, required this.onHint, required this.onUndo, this.onSelectColor, required this.onDone});
  final VoidCallback onReset;
  final VoidCallback onHint;
  final VoidCallback onUndo;
  final ValueChanged<Color>? onSelectColor;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 16),
    child: Row(children: [
      _CircleAct(icon: Icons.refresh_rounded, color: const Color(0xFF1E2A6A), onTap: onReset, label: 'إعادة'),
      const SizedBox(width: 8),
      _CircleAct(icon: Icons.lightbulb_rounded, color: const Color(0xFF6B5700), bg: _kGold, fg: _kDeep, onTap: onHint, label: 'تلميح'),
      const SizedBox(width: 8),
      _CircleAct(icon: Icons.undo_rounded, color: const Color(0xFF2A1D5E), onTap: onUndo, label: 'تراجع'),
      const Spacer(),
      FilledButton(onPressed: onDone, style: FilledButton.styleFrom(backgroundColor: _kPurple, foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)), padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12)), child: const Row(mainAxisSize: MainAxisSize.min, children: [Text('تم', style: TextStyle(fontWeight: FontWeight.w800)), SizedBox(width: 6), Icon(Icons.check_rounded, size: 18)])),
    ]),
  );
}

class _CircleAct extends StatelessWidget {
  const _CircleAct({required this.icon, required this.color, this.bg, this.fg, required this.onTap, this.label});
  final IconData icon; final Color color; final Color? bg; final Color? fg; final VoidCallback onTap; final String? label;
  @override
  Widget build(BuildContext context) => Column(children: [
    InkWell(onTap: onTap, customBorder: const CircleBorder(), child: Container(width: 42, height: 42, decoration: BoxDecoration(color: bg ?? color, shape: BoxShape.circle, border: Border.all(color: Colors.white12)), child: Icon(icon, color: fg ?? Colors.white70, size: 20))),
    if (label != null) ...[const SizedBox(height: 2), Text(label!, style: const TextStyle(color: Colors.white54, fontSize: 9, fontWeight: FontWeight.w600))],
  ]);
}

class _ProgressDots extends StatelessWidget {
  const _ProgressDots({required this.total, required this.completed});
  final int total; final int completed;
  @override
  Widget build(BuildContext context) => Row(mainAxisAlignment: MainAxisAlignment.center, children: List.generate(total, (i) {
    final done = i < completed;
    return Container(margin: const EdgeInsets.symmetric(horizontal: 4), width: 26, height: 8, decoration: BoxDecoration(color: done ? _kGreen : Colors.white12, borderRadius: BorderRadius.circular(999), border: done ? null : Border.all(color: Colors.white12)));
  }));
}

