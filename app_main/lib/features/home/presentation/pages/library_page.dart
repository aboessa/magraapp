import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../child/application/child_provider.dart';
import '../../../games/data/local_creation_store.dart';
import '../../../profile/data/progress_store.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';

class LibraryPage extends ConsumerWidget {
  const LibraryPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    final childId = ref.watch(childProvider).activeChildId;
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        backgroundColor: AppColors.deepSpace,
        appBar: AppBar(
          backgroundColor: AppColors.deepSpace,
          foregroundColor: Colors.white,
          title: const Text('مكتبتي'),
          bottom: const TabBar(tabs: [Tab(text: 'أكمل'), Tab(text: 'المحفوظة'), Tab(text: 'التحميلات'), Tab(text: 'رسوماتي')]),
        ),
        body: catalogAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => const Center(child: Text('تعذّر التحميل', style: TextStyle(color: Colors.white))),
          data: (catalog) => TabBarView(children: [
            _ContinueTab(catalog: catalog, childId: childId),
            _SavedTab(catalog: catalog),
            _DownloadsTab(),
            _DrawingsTab(childId: childId),
          ]),
        ),
      ),
    );
  }
}

class _ContinueTab extends ConsumerWidget {
  const _ContinueTab({required this.catalog, this.childId});
  final HomeCatalog catalog; final String? childId;
  @override Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(progressProvider).valueOrNull ?? const {};
    final fractions = <String, double>{for (final e in progress.entries) if (e.value.isResumable && e.value.fraction != null) e.key: e.value.fraction!};
    final eps = catalog.episodes.where((ep) => fractions.containsKey(ep.id)).toList();
    final padding = context.horizontalPagePadding;
    if (eps.isEmpty && (childId==null)) return const Center(child: Text('لا يوجد ما تكمله حالياً', style: TextStyle(color: Colors.white54)));
    return CinematicBackground(
      child: CustomScrollView(slivers: [
        if (eps.isNotEmpty) SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<EpisodeItem>(title: 'فيديو', items: eps.take(6).toList(), height: 208, horizontalPadding: padding, itemBuilder: (c, item, i) => EpisodeCard(item: item, isTelevision: false, onPressed: () => context.push('/playback/${item.id}'))))),
        if (childId != null) _DrawingsContinueRail(childId: childId!, padding: padding),
        const SliverToBoxAdapter(child: SizedBox(height: 80)),
      ]),
    );
  }
}

class _DrawingsContinueRail extends StatelessWidget {
  const _DrawingsContinueRail({required this.childId, required this.padding});
  final String childId; final double padding;
  @override Widget build(BuildContext context) {
    return FutureBuilder<List<LocalCreation>>(future: LocalCreationStore().list(childId), builder: (c, snap) {
      final items = (snap.data ?? []).where((e) => e.isEditable).take(6).toList();
      if (items.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());
      return SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<LocalCreation>(title: 'رسومات', items: items, height: 180, horizontalPadding: padding, itemBuilder: (ctx, item, i) => Container(width: 140, decoration: BoxDecoration(color: const Color(0xFF121A38), borderRadius: BorderRadius.circular(12)), child: InkWell(onTap: () => ctx.push('/studio', extra: item), child: Column(children: [Expanded(child: Image.memory(item.bytes, fit: BoxFit.cover, errorBuilder: (_,__,___) => const Icon(Icons.brush, color: Colors.white))), Padding(padding: const EdgeInsets.all(6), child: Text(item.displayTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 11)))]))))));
    });
  }
}

class _SavedTab extends StatelessWidget {
  const _SavedTab({required this.catalog});
  final HomeCatalog catalog;
  @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.bookmark_rounded, color: Colors.white54, size: 48), const SizedBox(height: 12), const Text('المسلسلات المحفوظة في: قائمة المشاهدة', style: TextStyle(color: Colors.white)), const SizedBox(height: 12), FilledButton(onPressed: () => context.push('/watchlist'), child: const Text('افتح قائمة المشاهدة'))])));
}

class _DownloadsTab extends StatelessWidget {
  @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.download_rounded, color: Colors.white54, size: 48), const Text('إدارة التحميلات', style: TextStyle(color: Colors.white)), const SizedBox(height: 12), FilledButton(onPressed: () => context.push('/downloads'), child: const Text('افتح التحميلات'))])));
}

class _DrawingsTab extends StatelessWidget {
  const _DrawingsTab({required this.childId});
  final String? childId;
  @override Widget build(BuildContext context) {
    if (childId==null) return const Center(child: Text('اختر طفلاً', style: TextStyle(color: Colors.white54)));
    return FutureBuilder<List<LocalCreation>>(future: LocalCreationStore().list(childId!), builder: (c, snap) {
      final items = snap.data ?? [];
      if (items.isEmpty) return const Center(child: Text('لا توجد رسومات بعد', style: TextStyle(color: Colors.white54)));
      return GridView.builder(padding: const EdgeInsets.all(16), gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.9), itemCount: items.length, itemBuilder: (ctx, i) { final it = items[i]; return Container(decoration: BoxDecoration(color: const Color(0xFF121A38), borderRadius: BorderRadius.circular(12)), child: InkWell(onTap: () => ctx.push('/studio', extra: it), borderRadius: BorderRadius.circular(12), child: Column(children: [Expanded(child: Image.memory(it.bytes, fit: BoxFit.cover, errorBuilder: (_,__,___) => const Icon(Icons.brush, color: Colors.white))), Padding(padding: const EdgeInsets.all(8), child: Text(it.displayTitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white)))]))); });
    });
  }
}
