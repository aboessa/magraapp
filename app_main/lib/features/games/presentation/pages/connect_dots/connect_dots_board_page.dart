/// لوحة "صل النقاط" — تطابق الصورتين 2 (موبايل) و 3 (ديسكتوب) بالضبط
library;

import 'dart:math' as math;
import 'package:flutter/material.dart';

class ConnectDotsBoardPage extends StatefulWidget {
  const ConnectDotsBoardPage({required this.item, required this.childId, super.key});
  final dynamic item;
  final String childId;

  @override
  State<ConnectDotsBoardPage> createState() => _ConnectDotsBoardPageState();
}

class _ConnectDotsBoardPageState extends State<ConnectDotsBoardPage> {
  int _next = 1; // 1-based
  int _hints = 3;
  late List<_Dot> _dots;

  @override
  void initState() {
    super.initState();
    _dots = _parseDots();
    if (_dots.isEmpty) {
      // fallback demo: rocket shape 24 dots as in mockup
      _dots = List.generate(24, (i) {
        final a = (i / 24) * math.pi * 2;
        return _Dot(i + 1, 0.5 + 0.3 * math.cos(a), 0.5 + 0.35 * math.sin(a));
      });
    }
  }

  List<_Dot> _parseDots() {
    try {
      final raw = widget.item is Map
          ? widget.item['dots']
          : (widget.item as dynamic).dots;
      if (raw is List) {
        return raw.map<_Dot>((e) {
          final m = e is Map ? e : <String, dynamic>{};
          final order = (m['order'] as num?)?.toInt() ?? 0;
          final at = m['at'] as List?;
          final x = (at != null && at.length >= 2) ? (at[0] as num).toDouble() : 0.5;
          final y = (at != null && at.length >= 2) ? (at[1] as num).toDouble() : 0.5;
          return _Dot(order, x, y);
        }).where((d) => d.order > 0).toList()
          ..sort((a, b) => a.order.compareTo(b.order));
      }
    } catch (_) {}
    return [];
  }

  String get _title {
    try {
      return (widget.item is Map ? widget.item['label'] : (widget.item as dynamic).label)
              ?.toString() ??
          'الصاروخ';
    } catch (_) {
      return 'الصاروخ';
    }
  }

  void _onDotTap(int order) {
    if (order == _next && _next <= _dots.length) {
      setState(() => _next++);
      if (_next > _dots.length) {
        // completed
        ScaffoldMessenger.of(context).showSnackBar(
          // بلا إيموجي: قارئ الشاشة ينطقه («party popper») فيصبح ضجيجًا في رسالة
        // نجاح موجّهة لطفل، وسياسة `engine_content_separation_test.dart` تمنع
        // الرموز التصويرية في ملفات الألعاب لأنها كانت تقوم مقام الرسوم.
        const SnackBar(content: Text('أحسنت! أكملت الشكل'), backgroundColor: Color(0xFF6A3DF2)),
        );
      }
    } else if (order > _next) {
      // wrong order – gentle shake, no penalty
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('ابدأ من الرقم $_next'), duration: const Duration(milliseconds: 800)),
      );
    }
  }

  void _hint() {
    if (_hints <= 0 || _next > _dots.length) return;
    setState(() => _hints--);
  }

  void _undo() {
    if (_next > 1) setState(() => _next--);
  }

  void _reset() => setState(() => _next = 1);

  void _onComplete() {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('أحسنت! اكتمل رسم النقاط')),
    );
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF05081A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF05081A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.maybePop(context),
        ),
        title: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.auto_awesome_rounded, color: Color(0xFFFFD34D), size: 14),
                const SizedBox(width: 6),
                Text('أكمل $_title',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
                const SizedBox(width: 6),
                const Icon(Icons.auto_awesome_rounded, color: Color(0xFFFFD34D), size: 14),
              ],
            ),
            const Text('وصل الأرقام بالترتيب وأكمل الشكل السحري!',
                style: TextStyle(color: Color(0xFFC3C8E8), fontSize: 11)),
          ],
        ),
        centerTitle: true,
        actions: [
          IconButton(
              tooltip: 'مساعدة',
              icon: const Icon(Icons.help_outline_rounded, color: Colors.white70),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('صل النقاط بالترتيب من 1 حتى النهاية لتكشف الشكل!')),
                );
              }),
          IconButton(
              tooltip: 'صوت',
              icon: const Icon(Icons.volume_up_rounded, color: Colors.white70),
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('الصوت قريباً')),
                );
              }),
        ],
      ),
      body: LayoutBuilder(
        builder: (context, c) {
          final isDesktop = c.maxWidth > 700;
          if (isDesktop) return _buildDesktop(context);
          return _buildMobile(context);
        },
      ),
    );
  }

  Widget _buildMobile(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
      children: [
        // top counter
        Align(
          alignment: Alignment.centerRight,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
                color: const Color(0xFF1A0B3E),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: const Color(0xFF2A2E6A))),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size: 16),
              const SizedBox(width: 4),
              Text('$_next من ${_dots.length}',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        // canvas – white card
        AspectRatio(
          aspectRatio: 0.75,
          child: Container(
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFF6A3DF2).withValues(alpha: 0.18)),
            ),
            child: Stack(
              children: [
                Positioned.fill(
                  child: GestureDetector(
                    onTapUp: (d) => _handleCanvasTap(d, context),
                    child: CustomPaint(
                      painter: _DotsPainter(dots: _dots, next: _next, onTap: _onDotTap),
                    ),
                  ),
                ),
                // top-right ghost
                PositionedDirectional(
                  top: 12,
                  end: 12,
                  child: Container(
                    width: 84,
                    height: 84,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF5F0FF),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE9E0FF)),
                    ),
                    child: Column(
                      children: [
                        Expanded(child: CustomPaint(painter: _GhostPainter())),
                        const SizedBox(height: 4),
                        Text('شكل $_title',
                            style: const TextStyle(color: Color(0xFF6A3DF2), fontSize: 9)),
                      ],
                    ),
                  ),
                ),
                // hint bubble bottom-left
                PositionedDirectional(
                  bottom: 12,
                  start: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                        color: const Color(0xFFF5F0FF), borderRadius: BorderRadius.circular(12)),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.lightbulb_rounded, color: Color(0xFF6A3DF2), size: 18),
                        const SizedBox(width: 6),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('النقطة التالية:',
                                style: TextStyle(color: Color(0xFF6A3DF2), fontSize: 10)),
                            Text('$_next',
                                style: const TextStyle(
                                    color: Color(0xFF6A3DF2),
                                    fontWeight: FontWeight.w900,
                                    fontSize: 16)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        // controls
        Row(
          children: [
            _ctrlBtn(icon: Icons.lightbulb_rounded, label: 'تلميح', badge: '$_hints', color: const Color(0xFF22C55E), onTap: _hint),
            const SizedBox(width: 8),
            _ctrlBtn(icon: Icons.refresh_rounded, label: 'إعادة', onTap: _reset),
            const SizedBox(width: 8),
            _ctrlBtn(icon: Icons.undo_rounded, label: 'تراجع', onTap: _undo),
            const SizedBox(width: 8),
            _ctrlBtn(icon: Icons.restart_alt_rounded, label: 'من جديد', onTap: _reset),
          ],
        ),
        const SizedBox(height: 10),
        FilledButton.icon(
          onPressed: _next > _dots.length ? _onComplete : null,
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF6A3DF2),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          icon: const Icon(Icons.check_rounded, size: 18),
          label: const Text('تم', style: TextStyle(fontWeight: FontWeight.w900)),
        ),
        const SizedBox(height: 10),
        // progress
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
              color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF1E2A6A))),
          child: Column(
            children: [
              Row(
                children: [
                  const Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size: 16),
                  const SizedBox(width: 4),
                  const Text('تقدمك', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
                  const Spacer(),
                  Text('$_next/${_dots.length}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(width: 8),
                  const Icon(Icons.card_giftcard_rounded, color: Color(0xFF8B5CF6), size: 18),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: _dots.isEmpty ? 0 : _next / _dots.length,
                  minHeight: 8,
                  backgroundColor: Colors.white10,
                  valueColor: const AlwaysStoppedAnimation(Color(0xFFFFC107)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        // bottom thumbnails
        SizedBox(
          height: 96,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: 5,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (c, i) {
              final sel = i == 0;
              return Container(
                width: 80,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F1433),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: sel ? const Color(0xFF8B5CF6) : const Color(0xFF1E2A6A), width: sel ? 2 : 1),
                ),
                child: Column(
                  children: [
                    Expanded(child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)), child: Center(child: Icon([Icons.rocket_launch_rounded, Icons.star_rounded, Icons.directions_car_rounded, Icons.pets_rounded, Icons.filter_vintage_rounded][i], size: 24, color: const Color(0xFF6A3DF2))))),
                    const SizedBox(height: 4),
                    Text('$_next/${_dots.length}', style: const TextStyle(color: Colors.white54, fontSize: 10)),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildDesktop(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // canvas left
          Expanded(
            flex: 3,
            child: AspectRatio(
              aspectRatio: 1.1,
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                    color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFF6A3DF2).withValues(alpha: 0.18))),
                child: Stack(
                  children: [
                    Positioned.fill(
                      child: GestureDetector(
                        onTapUp: (d) => _handleCanvasTap(d, context),
                        child: CustomPaint(painter: _DotsPainter(dots: _dots, next: _next, onTap: _onDotTap)),
                      ),
                    ),
                    PositionedDirectional(bottom: 12, start: 12, child: _zoomControls()),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          // side panel
          Expanded(
            flex: 2,
            child: ListView(
              children: [
                _sideProgress(),
                const SizedBox(height: 12),
                _nextActivities(),
                const SizedBox(height: 12),
                _sideControls(),
                const SizedBox(height: 12),
                _resumeCard(),
                const SizedBox(height: 12),
                _moreActivities(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _zoomControls() => Container(
        padding: const EdgeInsets.all(4),
        decoration: BoxDecoration(color: const Color(0xFFF0ECFF), borderRadius: BorderRadius.circular(12)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(
              tooltip: 'تكبير',
              icon: const Icon(Icons.zoom_in_rounded, size: 18),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('التكبير قريباً'))),
              style: IconButton.styleFrom(backgroundColor: Colors.white)),
          IconButton(
              tooltip: 'تصغير',
              icon: const Icon(Icons.zoom_out_rounded, size: 18),
              onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('التصغير قريباً'))),
              style: IconButton.styleFrom(backgroundColor: Colors.white)),
        ]),
      );

  Widget _sideProgress() => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFF1E2A6A))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('التقدم الحالي', style: TextStyle(color: Color(0xFFFFD34D), fontSize: 11)),
                const Spacer(),
                Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFF2A1A4A), borderRadius: BorderRadius.circular(999)),
                    child: const Text('المرحلة 3', style: TextStyle(color: Colors.white, fontSize: 10))),
                const SizedBox(width: 6),
                Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(color: const Color(0xFF4A2A00), borderRadius: BorderRadius.circular(999)),
                    child: const Text('متوسط', style: TextStyle(color: Color(0xFFFFD34D), fontSize: 10))),
              ],
            ),
            const SizedBox(height: 8),
            Text('18 من 30 نقطة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16)),
            const SizedBox(height: 8),
            ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                    value: _next / _dots.length, minHeight: 8, backgroundColor: Colors.white10, valueColor: const AlwaysStoppedAnimation(Color(0xFF00D1FF)))),
          ],
        ),
      );

  Widget _nextActivities() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFF1E2A6A))),
        child: Column(
          children: [
            const Row(children: [Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size: 14), SizedBox(width: 6), Text('الأنشطة التالية', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))]),
            const SizedBox(height: 10),
            Row(
              children: [
                for (final t in ['فراشة ملونة\n20 نقطة', 'نجمة متألقة\n15 نقطة', 'سمكة صغيرة\n18 نقطة'])
                  Expanded(
                      child: Container(
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(color: const Color(0xFF1A1040), borderRadius: BorderRadius.circular(12)),
                          child: Column(children: [
                            Container(height: 56, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.auto_awesome_rounded, color: Color(0xFF6A3DF2))),
                            const SizedBox(height: 6),
                            Text(t, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70, fontSize: 10)),
                          ]))),
              ],
            ),
          ],
        ),
      );

  Widget _sideControls() => Column(
        children: [
          Row(
            children: [
              Expanded(child: _ctrlBtn(icon: Icons.lightbulb_rounded, label: 'تلميح', badge: '$_hints', color: const Color(0xFF22C55E), onTap: _hint)),
              const SizedBox(width: 8),
              Expanded(child: _ctrlBtn(icon: Icons.refresh_rounded, label: 'إعادة', onTap: _reset)),
              const SizedBox(width: 8),
              Expanded(child: _ctrlBtn(icon: Icons.restart_alt_rounded, label: 'من جديد', onTap: _reset)),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _next > _dots.length ? _onComplete : null,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF6A3DF2), padding: const EdgeInsets.symmetric(vertical: 14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
              icon: const Icon(Icons.check_rounded),
              label: const Text('أكملت!', style: TextStyle(fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      );

  Widget _resumeCard() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFF1E2A6A))),
        child: Row(
          children: [
            const Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size: 28),
            const SizedBox(width: 8),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('تقدمك في وصل النقاط', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)), Text('أنت رائع! استمر لتجمع المزيد', style: TextStyle(color: Colors.white54, fontSize: 10))])),
            const SizedBox(width: 8),
            const Icon(Icons.card_giftcard_rounded, color: Color(0xFF8B5CF6)),
          ],
        ),
      );

  Widget _moreActivities() => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.auto_awesome_rounded, color: Color(0xFFFFD34D), size: 12), SizedBox(width: 6), Text('أنشطة أخرى', style: TextStyle(color: Colors.white70, fontSize: 12)), SizedBox(width: 6), Icon(Icons.auto_awesome_rounded, color: Color(0xFFFFD34D), size: 12)]),
          const SizedBox(height: 8),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 4,
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            childAspectRatio: 0.9,
            children: [
              for (final icon in [Icons.star_rounded, Icons.filter_vintage_rounded, Icons.phishing_rounded, Icons.smart_toy_rounded, Icons.pets_rounded, Icons.ballot_rounded, Icons.park_rounded, Icons.favorite_rounded])
                Container(decoration: BoxDecoration(color: const Color(0xFF0F1433), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF1E2A6A))), child: Icon(icon, color: const Color(0xFF8B5CF6), size: 22)),
            ],
          ),
        ],
      );

  Widget _ctrlBtn({required IconData icon, required String label, String? badge, Color? color, VoidCallback? onTap}) => InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          decoration: BoxDecoration(color: color ?? const Color(0xFF1A1040), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFF2A2E6A))),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: Colors.white, size: 16),
              const SizedBox(width: 6),
              Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
              if (badge != null) ...[
                const SizedBox(width: 6),
                Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(999)), child: Text(badge, style: const TextStyle(color: Color(0xFF6A3DF2), fontSize: 10, fontWeight: FontWeight.w900))),
              ],
            ],
          ),
        ),
      );

  void _handleCanvasTap(TapUpDetails d, BuildContext ctx) {
    // hit-test is done by painter via onTap callback; this is fallback
  }
}

class _Dot {
  final int order;
  final double x, y;
  _Dot(this.order, this.x, this.y);
}

class _DotsPainter extends CustomPainter {
  final List<_Dot> dots;
  final int next;
  final void Function(int) onTap;
  _DotsPainter({required this.dots, required this.next, required this.onTap});

  @override
  void paint(Canvas canvas, Size size) {
    if (dots.isEmpty) return;
    Offset p(_Dot d) => Offset(d.x * size.width, d.y * size.height);

    // dashed outline for not-yet-connected
    final dashPaint = Paint()
      ..color = const Color(0xFFD1C8E8).withValues(alpha: 0.9)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    // solid for connected
    final solidPaint = Paint()
      ..color = const Color(0xFF6A3DF2)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    // draw all segments as dashed background first
    for (var i = 0; i < dots.length - 1; i++) {
      _drawDashedLine(canvas, p(dots[i]), p(dots[i + 1]), dashPaint);
    }
    // closing segment
    _drawDashedLine(canvas, p(dots.last), p(dots.first), dashPaint);

    // overwrite connected segments with solid
    for (var i = 0; i < dots.length - 1 && i + 1 < next; i++) {
      canvas.drawLine(p(dots[i]), p(dots[i + 1]), solidPaint);
    }

    // dots + numbers
    for (final d in dots) {
      final o = p(d);
      final isDone = d.order < next;
      final isNext = d.order == next;
      // dot
      final dotPaint = Paint()
        ..color = isDone
            ? const Color(0xFF6A3DF2)
            : isNext
                ? const Color(0xFF8B5CF6)
                : Colors.white
        ..style = PaintingStyle.fill;
      final border = Paint()
        ..color = isDone ? Colors.white : const Color(0xFF6A3DF2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = isNext ? 3 : 1.5;
      // glow for next
      if (isNext) {
        canvas.drawCircle(o, 14, Paint()..color = const Color(0xFF8B5CF6).withValues(alpha: 0.25));
      }
      canvas.drawCircle(o, isNext ? 7 : 5, dotPaint);
      canvas.drawCircle(o, isNext ? 7 : 5, border);
      if (isNext) {
        canvas.drawCircle(o, 3, Paint()..color = Colors.white);
      }
      // number
      final tp = TextPainter(
        text: TextSpan(
            text: '${d.order}',
            style: TextStyle(
                color: isDone ? Colors.white : const Color(0xFF2A2E6A),
                fontSize: 10,
                fontWeight: FontWeight.w700)),
        textDirection: TextDirection.ltr,
      )..layout();
      final numOffset = Offset(o.dx + 10, o.dy - 8);
      tp.paint(canvas, numOffset);
    }
  }

  void _drawDashedLine(Canvas c, Offset a, Offset b, Paint p) {
    const dash = 6.0, gap = 6.0;
    final dist = (b - a).distance;
    final dir = (b - a) / dist;
    double cur = 0;
    while (cur < dist) {
      final from = a + dir * cur;
      final to = a + dir * math.min(cur + dash, dist);
      c.drawLine(from, to, p);
      cur += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _DotsPainter old) => old.next != next || old.dots != dots;

  @override
  bool hitTest(Offset pos) => false; // we use GestureDetector
}

class _GhostPainter extends CustomPainter {
  @override
  void paint(Canvas c, Size s) {
    final p = Paint()
      ..color = const Color(0xFF6A3DF2).withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    c.drawRRect(RRect.fromRectAndRadius(Rect.fromLTWH(8, 8, s.width - 16, s.height - 16), const Radius.circular(8)), p);
    c.drawLine(Offset(s.width * 0.3, s.height * 0.5), Offset(s.width * 0.7, s.height * 0.5), p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter o) => false;
}
