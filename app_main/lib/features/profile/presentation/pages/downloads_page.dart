import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class DownloadsPage extends ConsumerWidget {
  const DownloadsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalog = ref.watch(homeCatalogProvider).valueOrNull;
    final episodes = catalog?.episodes.take(3).toList() ?? [];

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: const Text('التحميلات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
              actions: [IconButton(icon: const Icon(Icons.settings_outlined, color: Colors.white), onPressed: () {})],
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: const Color(0xFF111A3A).withValues(alpha: 0.72),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                  ),
                  child: Row(
                    children: [
                      Container(width: 48, height: 48, decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.storage_rounded, color: AppColors.electricCyan)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          const Text('التخزين المستخدم', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                          const SizedBox(height: 6),
                          ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: 0.32, backgroundColor: Colors.white.withValues(alpha: 0.08), valueColor: const AlwaysStoppedAnimation(AppColors.electricCyan), minHeight: 6)),
                          const SizedBox(height: 4),
                          Text('حجم التخزين يُحسب عند تفعيل التنزيل', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 10)),
                        ]),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (episodes.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Container(width: 72, height: 72, decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0xFF111A3A), border: Border.all(color: Colors.white.withValues(alpha: 0.08))), child: const Icon(Icons.download_rounded, color: AppColors.starGold, size: 32)),
                      const SizedBox(height: 16),
                      const Text('لا يوجد تحميلات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      Text('حمّل من زر التحميل في صفحة التفاصيل', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                    ]),
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate((context, index) {
                  final ep = episodes[index];
                  return Padding(
                    padding: EdgeInsets.fromLTRB(18, index == 0 ? 8 : 0, 18, 10),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
                      child: Row(
                        children: [
                          ClipRRect(borderRadius: BorderRadius.circular(10), child: SizedBox(width: 96, height: 56, child: Image.asset(ep.thumbnailAsset, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppColors.indigoSurface)))),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(ep.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                              const SizedBox(height: 4),
                              Text(ep.seriesTitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 11)),
                              const SizedBox(height: 6),
                              Row(children: [Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2), decoration: BoxDecoration(color: AppColors.success, borderRadius: BorderRadius.circular(4)), child: const Text('تم', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700))), const SizedBox(width: 6), Text(ep.durationLabel, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.6), fontSize: 10))]),
                            ]),
                          ),
                          IconButton(icon: const Icon(Icons.delete_outline_rounded, color: AppColors.mutedText), onPressed: () {}),
                        ],
                      ),
                    ),
                  );
                }, childCount: episodes.length),
              ),
          ],
        ),
      ),
    );
  }
}
