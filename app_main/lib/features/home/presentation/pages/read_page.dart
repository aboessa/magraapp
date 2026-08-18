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

class ReadPage extends ConsumerWidget {
  const ReadPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    return catalogAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, s) => const Scaffold(body: Center(child: Text('تعذّر التحميل'))),
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        final storyIds = catalog.stories.map((s) => s.id).toSet();
        final books = <BookItem>[
          for (final s in catalog.stories) BookItem(id: s.id, title: s.title, description: s.description, type: s.type, ageMin: s.ageMin, ageMax: s.ageMax, posterAsset: 'assets/brand/majarra-logo.png', coverUrl: s.coverUrl),
          for (final b in catalog.books) if (!storyIds.contains(b.id)) b
        ];
        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(title: const Text('اقرأ'), backgroundColor: AppColors.deepSpace, foregroundColor: Colors.white),
          body: CinematicBackground(
            child: CustomScrollView(slivers: [
              if (books.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<BookItem>(title: 'حكايات وقصص', subtitle: 'قراءة وصوت', items: books.take(8).toList(), height: 282, horizontalPadding: padding, itemBuilder: (c, item, i) => BookCard(item: item, isTelevision: false, onPressed: () => context.push(item.type=='audio_story' ? '/audio?bookId=${item.id}' : '/reader/${item.id}?contentType=${storyIds.contains(item.id) ? 'story' : 'book'}')))),
                ),
              if (catalog.stories.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<StoryItem>(title: 'قصص مصورة', items: catalog.stories.take(6).toList(), height: 282, horizontalPadding: padding, itemBuilder: (c, item, i) => BookCard(item: BookItem(id: item.id, title: item.title, description: item.description, type: item.type, ageMin: item.ageMin, ageMax: item.ageMax, posterAsset: 'assets/brand/majarra-logo.png', coverUrl: item.coverUrl), isTelevision: false, onPressed: () => context.push('/reader/${item.id}?contentType=story')))),
                ),
              SliverToBoxAdapter(
                child: Padding(padding: EdgeInsets.all(padding), child: Text('القصص والكتب منفصلان خلف الكواليس — الواجهة فقط تجمعهما للاستكشاف', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.6), fontSize: 11))),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ]),
          ),
        );
      },
    );
  }
}

class StoryItemCard extends StatelessWidget { const StoryItemCard({super.key}); @override Widget build(BuildContext context) => const SizedBox(); }
