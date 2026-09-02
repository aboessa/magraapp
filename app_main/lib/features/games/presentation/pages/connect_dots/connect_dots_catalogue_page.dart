/// كتالوج "صل النقاط" — نسخة بريميوم مطابقة للصورة 1
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../application/creative_catalogue_provider.dart';
import '../../../data/local_creation_store.dart';
import 'connect_dots_board_page.dart';

class ConnectDotsCataloguePage extends ConsumerStatefulWidget {
  const ConnectDotsCataloguePage({
    required this.childId,
    required this.creationStore,
    this.onSaved,
    super.key,
  });
  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  @override
  ConsumerState<ConnectDotsCataloguePage> createState() =>
      _ConnectDotsCataloguePageState();
}

class _ConnectDotsCataloguePageState
    extends ConsumerState<ConnectDotsCataloguePage> {
  String _filter = 'الكل';
  final _cats = const [
    ('الكل', Icons.grid_view_rounded),
    ('سهل', Icons.eco_rounded),
    ('متوسط', Icons.star_rounded),
    ('حيوانات', Icons.pets_rounded),
    ('فضاء', Icons.rocket_launch_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(dotsCatalogueProvider);
    return Scaffold(
      backgroundColor: const Color(0xFF05081A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF05081A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
          onPressed: () => Navigator.maybePop(context),
        ),
        centerTitle: true,
        title: Column(
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('صل النقاط',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 22)),
                const SizedBox(width: 6),
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFD34D),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.star_rounded,
                      size: 18, color: Color(0xFF05081A)),
                ),
              ],
            ),
            const Text('وصل الأرقام بالترتيب واكتشف الشكل السحري!',
                style: TextStyle(color: Color(0xFFC3C8E8), fontSize: 11)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(end: 12),
            child: CircleAvatar(
              radius: 18,
              backgroundColor: const Color(0xFF1A0B3E),
              child: ClipOval(
                child: Image.asset(
                  'assets/images/studio/card-connect-dots.webp',
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) =>
                      const Icon(Icons.person_rounded, color: Colors.white),
                ),
              ),
            ),
          )
        ],
      ),
      body: async.when(
        loading: () => const Center(
            child: CircularProgressIndicator(color: Color(0xFFFFD34D))),
        error: (_, __) => _build(context, const []),
        data: (list) => _build(context, list),
      ),
    );
  }

  Widget _build(BuildContext context, List<dynamic> list) {
    // simple difficulty filter: 'سهل'/'متوسط' maps to item's mode or fallback
    final filtered = _filter == 'الكل'
        ? list
        : list.where((e) {
            final d = (e is Map ? e['difficulty'] : (e as dynamic).difficulty)
                    ?.toString() ??
                '';
            if (_filter == 'سهل') return d.contains('سهل');
            if (_filter == 'متوسط') return d.contains('متوسط');
            if (_filter == 'حيوانات') {
              final g = (e is Map ? e['group'] : (e as dynamic).group)
                      ?.toString() ??
                  '';
              return g == 'animals';
            }
            if (_filter == 'فضاء') {
              final g = (e is Map ? e['group'] : (e as dynamic).group)
                      ?.toString() ??
                  '';
              return g == 'space';
            }
            return true;
          }).toList();

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF05081A), Color(0xFF080C2A)]),
      ),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _hero(context)),
          SliverToBoxAdapter(child: _progressStrip(context)),
          SliverToBoxAdapter(child: _chips()),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome_rounded,
                      color: Color(0xFFFFD34D), size: 14),
                  const SizedBox(width: 6),
                  const Text('اختر نشاطك',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 13)),
                  const Spacer(),
                  Text('${filtered.length} نشاط',
                      style:
                          const TextStyle(color: Colors.white54, fontSize: 11)),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                childAspectRatio: 0.68,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final it = filtered[i];
                  return _ActivityCard(
                    item: it,
                    onTap: () => _openPlay(it),
                  );
                },
                childCount: filtered.length,
              ),
            ),
          ),
          SliverToBoxAdapter(child: _resumeStrip(context)),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }

  Widget _hero(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: const Color(0xFF6A3DF2).withValues(alpha: 0.35),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF6A3DF2).withValues(alpha: 0.22),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: AspectRatio(
          aspectRatio: 2.4,
          child: Image.asset(
            'assets/images/studio/connect-dots-banner.webp',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Image.asset(
              'assets/images/studio/connect-dots-banner.png',
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                color: const Color(0xFF1A0B3E),
                child: const Center(
                  child: Icon(
                    Icons.rocket_launch_rounded,
                    color: Colors.white24,
                    size: 48,
                  ),
                ),
              ),
            ),
          ),
        ),
      );

  List<dynamic> get filteredForQuickStart {
    final async = ref.read(dotsCatalogueProvider);
    return async.asData?.value ?? [];
  }

  Widget _progressStrip(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF0F1433),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF1E2A6A)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: const Color(0xFFFFD34D),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.star_rounded,
                  color: Color(0xFF7A4A00), size: 28),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('تقدمك في وصل النقاط',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 12)),
                  const Text('انت رائع! استمر لتجمع المزيد من النجوم',
                      style: TextStyle(color: Colors.white54, fontSize: 10)),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      value: 26 / 60,
                      minHeight: 6,
                      backgroundColor: Colors.white10,
                      valueColor:
                          const AlwaysStoppedAnimation(Color(0xFF8B5CF6)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            const Text('26/60',
                style: TextStyle(
                    color: Color(0xFFFFD34D),
                    fontWeight: FontWeight.w800,
                    fontSize: 13)),
            const Icon(Icons.star_rounded,
                color: Color(0xFFFFD34D), size: 16),
            const SizedBox(width: 12),
            const Icon(Icons.emoji_events_rounded,
                color: Color(0xFFFFD34D), size: 22),
            const SizedBox(width: 2),
            const Text('240\nنجمة',
                textAlign: TextAlign.center,
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                    height: 1.1)),
            const SizedBox(width: 8),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFF6A3DF2),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.card_giftcard_rounded,
                  color: Colors.white, size: 20),
            ),
          ],
        ),
      );

  Widget _chips() => Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: _cats.map((c) {
              final label = c.$1;
              final icon = c.$2;
              final sel = _filter == label;
              return Padding(
                padding: const EdgeInsetsDirectional.only(end: 8),
                child: ChoiceChip(
                  label: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon,
                          size: 14,
                          color: sel ? Colors.white : const Color(0xFF7EA0FF)),
                      const SizedBox(width: 6),
                      Text(label,
                          style: TextStyle(
                              color:
                                  sel ? Colors.white : const Color(0xFFDCE2FF),
                              fontSize: 12,
                              fontWeight: FontWeight.w700)),
                    ],
                  ),
                  selected: sel,
                  onSelected: (_) => setState(() => _filter = label),
                  backgroundColor: const Color(0xFF0F1433),
                  selectedColor: const Color(0xFF6A3DF2),
                  side: BorderSide(
                      color: sel
                          ? const Color(0xFF9D68FF)
                          : const Color(0xFF1E2A6A)),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(999)),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                ),
              );
            }).toList(),
          ),
        ),
      );

  Widget _resumeStrip(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF0F1433),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF1E2A6A)),
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
              ),
              child: CustomPaint(
                painter: _MiniDotsPainter(dotsCount: 20),
              ),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('صاروخ الفضاء',
                      style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 13)),
                  Text('تابع متعة الوصل!',
                      style: TextStyle(color: Colors.white54, fontSize: 11)),
                  SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.all(Radius.circular(999)),
                    child: LinearProgressIndicator(
                      value: 12 / 20,
                      minHeight: 6,
                      backgroundColor: Colors.white10,
                      valueColor: AlwaysStoppedAnimation(Color(0xFF8B5CF6)),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            const Text('12/20',
                style: TextStyle(color: Color(0xFFFFD34D), fontSize: 12)),
            const Icon(Icons.star_rounded,
                color: Color(0xFFFFD34D), size: 16),
            const SizedBox(width: 10),
            FilledButton(
              // زر «استكمال» بلا وجهة بعد.
              //
              // كان جسمه `try { final list = context as dynamic; } catch (_) {}`
              // — تحويل بلا استخدام داخل try بلا سبب، أي لا شيء إطلاقًا مع
              // مظهر كود عامل. الزر معطَّل صريحًا الآن حتى يوجد مصدر لآخر نشاط
              // مفتوح، فالطفل لا يضغط زرًّا لا يفعل شيئًا.
              onPressed: null,
              style: FilledButton.styleFrom(
                backgroundColor: Color(0xFF6A3DF2),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.all(Radius.circular(999))),
                padding: EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('متابعة',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w800)),
                  SizedBox(width: 6),
                  Icon(Icons.chevron_left_rounded,
                      color: Colors.white, size: 18),
                ],
              ),
            ),
          ],
        ),
      );

  void _openPlay(dynamic item) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ConnectDotsBoardPage(
        item: item,
        childId: widget.childId,
      ),
    ));
  }
}

class _ActivityCard extends StatelessWidget {
  const _ActivityCard({required this.item, required this.onTap});
  final dynamic item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = (item is Map ? item['label'] : (item as dynamic).label)
            ?.toString() ??
        'نشاط';
    final diffRaw = (item is Map ? item['difficulty'] : (item as dynamic).difficulty)
            ?.toString() ??
        'سهل';
    final isHard = diffRaw.contains('متوسط');
    final badgeColor =
        isHard ? const Color(0xFFF59E0B) : const Color(0xFF22C55E);
    final badgeText = isHard ? 'متوسط' : 'سهل';
    // dots count from geometry if present
    int dotsCount = 15;
    try {
      final d = (item is Map ? item['dots'] : (item as dynamic).dots) as List?;
      if (d != null && d.isNotEmpty) dotsCount = d.length;
    } catch (_) {}
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0F1433),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF1E2A6A)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Container(
                color: const Color(0xFF0B0F2E),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: CustomPaint(
                        painter: _CardPreviewPainter(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Container(
              color: const Color(0xFF0F1433),
              padding: const EdgeInsets.fromLTRB(6, 6, 6, 8),
              child: Column(
                children: [
                  Text(label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 11)),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                            color: badgeColor,
                            borderRadius: BorderRadius.circular(999)),
                        child: Text(badgeText,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 9,
                                fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 6),
                      const Icon(Icons.star_rounded,
                          size: 10, color: Color(0xFFFFD34D)),
                      Text(' $dotsCount',
                          style: const TextStyle(
                              color: Colors.white70, fontSize: 10)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CardPreviewPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final dotPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.9)
      ..style = PaintingStyle.fill;
    final linePaint = Paint()
      ..color = const Color(0xFF8B5CF6).withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2;
    final points = [
      Offset(size.width * 0.3, size.height * 0.2),
      Offset(size.width * 0.6, size.height * 0.15),
      Offset(size.width * 0.75, size.height * 0.35),
      Offset(size.width * 0.65, size.height * 0.6),
      Offset(size.width * 0.4, size.height * 0.75),
      Offset(size.width * 0.2, size.height * 0.5),
    ];
    for (var i = 0; i < points.length - 1; i++) {
      canvas.drawLine(points[i], points[i + 1], linePaint);
    }
    for (final p in points) {
      canvas.drawCircle(p, 3, dotPaint);
      canvas.drawCircle(
          p,
          5,
          Paint()
            ..color = const Color(0xFF8B5CF6).withValues(alpha: 0.2)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _MiniDotsPainter extends CustomPainter {
  final int dotsCount;
  _MiniDotsPainter({required this.dotsCount});
  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(size.width * 0.2, size.height * 0.7)
      ..quadraticBezierTo(
          size.width * 0.5, size.height * 0.2, size.width * 0.8, size.height * 0.5);
    canvas.drawPath(
        path,
        Paint()
          ..color = const Color(0xFF8B5CF6).withValues(alpha: 0.3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5
          ..strokeCap = StrokeCap.round);
    for (var i = 0; i < 4; i++) {
      final t = i / 3;
      final x = size.width * (0.2 + t * 0.6);
      final y = size.height * (0.7 - t * 0.2);
      canvas.drawCircle(Offset(x, y), 3, Paint()..color = const Color(0xFF8B5CF6));
      canvas.drawCircle(Offset(x, y), 3,
          Paint()..color = Colors.white ..style = PaintingStyle.fill);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}


