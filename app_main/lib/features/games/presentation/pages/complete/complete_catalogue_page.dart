/// أكمل الرسمة — Premium catalogue 50 items matching provided screenshots
library;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../application/creative_catalogue_provider.dart';
import '../../../data/creative_catalogue.dart';
import '../../../data/local_creation_store.dart';
import '../../widgets/drawing_asset.dart';
import 'complete_board_page.dart';

class CompleteCataloguePage extends ConsumerStatefulWidget {
  const CompleteCataloguePage({required this.childId, required this.creationStore, this.onSaved, super.key});
  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;
  @override
  ConsumerState<CompleteCataloguePage> createState() => _CompleteCataloguePageState();
}

class _CompleteCataloguePageState extends ConsumerState<CompleteCataloguePage> {
  String _filter = 'الكل';
  final _cats = ['الكل', 'الحيوانات', 'الفضاء', 'الطبيعة', 'المركبات', 'المنزل والحياة', 'الطعام', 'الخيال والمغامرات', 'أخرى'];

  String _groupForCategory(String c) => switch (c) {
        'الحيوانات' => 'animals',
        'الفضاء' => 'space',
        'الطبيعة' => 'nature',
        'المركبات' => 'vehicles',
        'المنزل والحياة' => 'home',
        'الطعام' => 'food',
        'الخيال والمغامرات' => 'fantasy',
        _ => '',
      };

  IconData _iconFor(String c) => switch (c) {
        'الحيوانات' => Icons.pets_rounded,
        'الفضاء' => Icons.rocket_launch_rounded,
        'الطبيعة' => Icons.eco_rounded,
        'المركبات' => Icons.directions_car_rounded,
        'المنزل والحياة' => Icons.home_rounded,
        'الطعام' => Icons.cake_rounded,
        'الخيال والمغامرات' => Icons.auto_awesome_rounded,
        'أخرى' => Icons.star_rounded,
        _ => Icons.brush_rounded,
      };

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(completeCatalogueProvider);
    return async.when(
      loading: () => Scaffold(backgroundColor: const Color(0xFF05081A), appBar: _appBar(), body: const Center(child: CircularProgressIndicator(color: Color(0xFFFFD34D)))),
      error: (_, __) => _build(context, const []),
      data: (list) => _build(context, list),
    );
  }

  PreferredSizeWidget _appBar() => AppBar(
        backgroundColor: const Color(0xFF05081A),
        elevation: 0,
        leading: IconButton(onPressed: () => Navigator.maybePop(context), icon: const Icon(Icons.arrow_back_rounded, color: Colors.white)),
        centerTitle: true,
        title: Row(mainAxisSize: MainAxisSize.min, children: [const Text('أكمل الرسمة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)), const SizedBox(width: 6), const Icon(Icons.edit_rounded, color: Color(0xFFFFD34D), size: 18)]),
        actions: [Padding(padding: const EdgeInsetsDirectional.only(end: 12), child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: const Color(0xFF1A0B3E), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFF6A3DF2))), child: const Row(children: [Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size: 16), SizedBox(width: 4), Text('250', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800))])) )],
      );

  Widget _build(BuildContext context, List<StudioCatalogItem> list) {
    // 'أخرى' has no group of its own: it catches anything whose group is not
    // one of the named chips, so no activity becomes unreachable if the
    // manifest gains a new group later.
    final known = _cats
        .map(_groupForCategory)
        .where((g) => g.isNotEmpty)
        .toSet();
    final filtered = switch (_filter) {
      'الكل' => list,
      'أخرى' => list.where((e) => !known.contains(e.group ?? '')).toList(),
      _ => list.where((e) => e.group == _groupForCategory(_filter)).toList(),
    };

    return Scaffold(
      backgroundColor: const Color(0xFF05081A),
      appBar: _appBar() as AppBar,
      body: Container(
        decoration: const BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF05081A), Color(0xFF080C2A)])),
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(child: _hero(context)),
            SliverToBoxAdapter(child: _chips()),
            SliverToBoxAdapter(child: _progressHeader(context, filtered.length)),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, childAspectRatio: 0.72, crossAxisSpacing: 10, mainAxisSpacing: 10),
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _card(context, filtered[i]),
                  childCount: filtered.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _hero(BuildContext context) => Container(
        margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(20), border: Border.all(color: Color(0xFF6A3DF2).withValues(alpha: 0.45)), gradient: const LinearGradient(begin: Alignment.topRight, end: Alignment.bottomLeft, colors: [Color(0xFF1A0B3E), Color(0xFF0F1433)])),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('أكمل الرسمة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 20)),
            const SizedBox(height: 6),
            const Text('استخدم خيالك وأضف الجزء\nالمفقود لتكتمل الرسمة!', style: TextStyle(color: Color(0xFFDCE2FF), fontSize: 11, height: 1.4)),
            const SizedBox(height: 4),
            const Text('لونها واجعلها رائعة!', style: TextStyle(color: Color(0xFFFFD34D), fontSize: 11, fontWeight: FontWeight.w700)),
            const SizedBox(height: 10),
            Container(padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), decoration: BoxDecoration(color: Color(0xFF6A3DF2), borderRadius: BorderRadius.circular(999)), child: const Row(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.rocket_launch_rounded, color: Colors.white, size: 14), SizedBox(width: 6), Text('ابدأ الآن', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800))])),
          ])),
          const SizedBox(width: 10),
          ClipRRect(borderRadius: BorderRadius.circular(14), child: Container(width: 120, height: 110, color: Colors.white, child: const Icon(Icons.rocket_rounded, size: 48, color: Color(0xFF6A3DF2)))),
        ]),
      );

  Widget _chips() => Padding(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
        child: SingleChildScrollView(scrollDirection: Axis.horizontal, child: Row(children: _cats.map((c) {
          final sel = _filter == c;
          return Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: InkWell(onTap: () => setState(() => _filter = c), borderRadius: BorderRadius.circular(999), child: Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7), decoration: BoxDecoration(color: sel ? Color(0xFF6A3DF2) : Color(0xFF0F1433), borderRadius: BorderRadius.circular(999), border: Border.all(color: sel ? Color(0xFF9D68FF) : Color(0xFF1E2A6A))), child: Row(children: [Icon(_iconFor(c), size: 14, color: sel ? Colors.white : Color(0xFF7EA0FF)), SizedBox(width: 4), Text(c, style: TextStyle(color: sel ? Colors.white : Color(0xFFDCE2FF), fontSize: 11, fontWeight: FontWeight.w700))]))));
        }).toList())),
      );

  Widget _progressHeader(BuildContext context, int count) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(children: [
          Row(children: [const Icon(Icons.auto_awesome_rounded, color: Color(0xFFFFD34D), size: 14), SizedBox(width: 4), Text('اختر رسمة لتكملها', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13))]),
          const Spacer(),
          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(999), border: Border.all(color: Color(0xFF1E2A6A))), child: Row(children: [Container(width: 50, height: 6, decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(999)), child: FractionallySizedBox(alignment: Alignment.centerRight, widthFactor: 0.23, child: Container(decoration: BoxDecoration(color: Color(0xFF22C55E), borderRadius: BorderRadius.circular(999))))), SizedBox(width: 6), Text('7/30 مكتملة', style: TextStyle(color: Colors.white70, fontSize: 11)) , SizedBox(width: 4), Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size: 14)])),
        ]),
      );

  Widget _card(BuildContext context, StudioCatalogItem item) {
    final label = item.label;
    // Authored per-activity in the manifest (سهل / متوسط / متقدم). This used to be
    // hardcoded to 'سهل', so all 50 cards showed the same green badge.
    final difficulty = item.difficulty ?? 'سهل';
    final isHard = difficulty.contains('صعب') || difficulty.contains('متقدم');
    final isMedium = difficulty.contains('متوسط');
    final badgeColor = isHard ? Color(0xFFEF4444) : isMedium ? Color(0xFFF59E0B) : Color(0xFF22C55E);
    // previewAssetId prefers the 512px thumbnail over the full challenge image.
    final assetId = item.previewAssetId ?? '';
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => CompleteBoardPage(childId: widget.childId, creationStore: widget.creationStore, item: item, titleAr: label))),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(16), border: Border.all(color: Color(0xFF1E2A6A))),
        clipBehavior: Clip.antiAlias,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Expanded(child: Stack(children: [
            Positioned.fill(child: Container(color: Colors.white, child: Padding(padding: const EdgeInsets.all(6), child: DrawingAsset(assetIdOrPath: assetId.isEmpty ? 'asset-complete-half-sun' : assetId, fit: BoxFit.contain)))),
            Positioned(top: 6, right: 6, child: Container(width: 22, height: 22, decoration: BoxDecoration(color: Color(0xFF11183D).withValues(alpha: 0.92), shape: BoxShape.circle, border: Border.all(color: Color(0xFFFFD34D))), child: Icon(Icons.star_rounded, size: 12, color: Color(0xFFFFD34D)))),
            Positioned(top: 6, left: 6, child: Container(width: 22, height: 22, decoration: BoxDecoration(color: Color(0xFF6A3DF2), shape: BoxShape.circle), child: Icon(Icons.emoji_events_rounded, size: 12, color: Colors.white))),
          ])),
          Container(color: Color(0xFF0F1433), padding: const EdgeInsets.fromLTRB(6, 6, 6, 6), child: Column(children: [
            Text(label, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center),
            SizedBox(height: 4),
            Container(padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3), decoration: BoxDecoration(color: badgeColor, borderRadius: BorderRadius.circular(999)), child: Text(difficulty, style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800))),
            SizedBox(height: 4),
            Row(children: [Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(999), child: LinearProgressIndicator(value: 0.33, minHeight: 4, backgroundColor: Colors.white10, valueColor: AlwaysStoppedAnimation(Color(0xFF22C55E))))), SizedBox(width: 4), Icon(Icons.star_rounded, size: 10, color: Color(0xFFFFD34D)), Text('1/3', style: TextStyle(color: Colors.white54, fontSize: 9))]),
          ])),
        ]),
      ),
    );
  }
}
