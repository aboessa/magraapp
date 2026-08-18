import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';

class ListenPage extends ConsumerWidget {
  const ListenPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    return catalogAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, s) => const Scaffold(body: Center(child: Text('تعذّر التحميل'))),
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        final audioBooks = catalog.books.where((b) => b.type=='audio_story' || b.isPlayable).toList();
        if (audioBooks.isEmpty) {
          return Scaffold(
            backgroundColor: AppColors.deepSpace,
            appBar: AppBar(title: const Text('استمع'), backgroundColor: AppColors.deepSpace, foregroundColor: Colors.white),
            body: const Center(child: Padding(padding: EdgeInsets.all(24), child: Text('المحتوى الصوتي قادم قريباً — سيظهر هنا عندما تُنشر حكايات مسموعة', style: TextStyle(color: Colors.white70), textAlign: TextAlign.center))),
          );
        }
        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(title: const Text('استمع'), backgroundColor: AppColors.deepSpace, foregroundColor: Colors.white),
          body: CinematicBackground(
            child: CustomScrollView(slivers: [
              SliverToBoxAdapter(
                child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<BookItem>(title: 'حكايات مسموعة', subtitle: 'استمع قبل النوم', items: audioBooks.take(8).toList(), height: 282, horizontalPadding: padding, itemBuilder: (c, item, i) => BookCard(item: item, isTelevision: false, onPressed: () => context.push('/audio?bookId=${item.id}')))),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ]),
          ),
        );
      },
    );
  }
}
