import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../home/presentation/widgets/content_cards.dart';

class WatchlistPage extends ConsumerWidget {
  const WatchlistPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(homeCatalogProvider).valueOrNull;
    final items = catalog?.series.where((s) => s.isFree).toList() ?? [];

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: const Text('قائمتي', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 8),
                child: Row(
                  children: [
                    Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6), decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(8)), child: Text('${items.length} عناصر', style: const TextStyle(color: AppColors.electricCyan, fontSize: 11, fontWeight: FontWeight.w700))),
                    const Spacer(),
                    TextButton.icon(onPressed: () {}, icon: const Icon(Icons.sort_rounded, size: 16), label: const Text('ترتيب')),
                  ],
                ),
              ),
            ),
            if (items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(width: 72, height: 72, decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0xFF111A3A), border: Border.all(color: Colors.white.withValues(alpha: 0.08))), child: const Icon(Icons.bookmark_add_rounded, color: AppColors.starGold, size: 32)),
                        const SizedBox(height: 16),
                        const Text('قائمتك فارغة', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 6),
                        Text('أضف سلاسل بالضغط على ♡ في صفحة التفاصيل', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, crossAxisSpacing: 12, mainAxisSpacing: 12, childAspectRatio: 0.68),
                  delegate: SliverChildBuilderDelegate((context, index) {
                    final item = items[index % items.length];
                    return SeriesCard(item: item, isTelevision: false, onPressed: () => context.push('/series/${item.id}'));
                  }, childCount: items.length),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
