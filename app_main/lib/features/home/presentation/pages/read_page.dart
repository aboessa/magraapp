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
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, s) =>
          const Scaffold(body: Center(child: Text('تعذّر التحميل'))),
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        final storyIds = catalog.stories.map((s) => s.id).toSet();

        // Separate stories by track for clear rails - fixes "where are the 15 stories?" confusion
        // a-calm-tale (3-5), bedtime-stories (6-8), qisas-min-alhayat (9-12)
        final calmTale = catalog.stories
            .where((s) => s.id.startsWith('story-bird') || s.id.contains('goodnight') || s.id.contains('moon') || s.id.contains('warm'))
            .toList();
        final bedtime = catalog.stories
            .where((s) => s.id.contains('ant-journey') || s.id.contains('garden') || s.id.contains('new-friend') || s.id.contains('rainy') || s.id.contains('lantern') || s.id.contains('lost-star'))
            .toList();
        final lifeStories = catalog.stories
            .where((s) => s.id.contains('promised') || s.id.contains('nine-metres') || s.id.contains('taller') || s.id.contains('key-left') || s.id.contains('extra-page'))
            .toList();

        // Fallback if id patterns change: split by age
        final byAge = catalog.stories.length == calmTale.length + bedtime.length + lifeStories.length
            ? null
            : {
                'preschool': catalog.stories.where((s) => s.ageMax <= 5).toList(),
                'kids': catalog.stories.where((s) => s.ageMin >= 6 && s.ageMax <= 8).toList(),
                'junior': catalog.stories.where((s) => s.ageMin >= 9).toList(),
              };

        final preschoolStories = byAge != null ? byAge['preschool']! : calmTale;
        final kidsStories = byAge != null ? byAge['kids']! : bedtime;
        final juniorStories = byAge != null ? byAge['junior']! : lifeStories;

        final books = <BookItem>[
          for (final s in catalog.stories)
            BookItem(
              id: s.id,
              title: s.title,
              description: s.description,
              type: s.type,
              ageMin: s.ageMin,
              ageMax: s.ageMax,
              posterAsset: 'assets/images/explore/explore-read.webp',
              coverUrl: s.coverUrl,
            ),
          for (final b in catalog.books)
            if (!storyIds.contains(b.id)) b,
        ];

        Widget storyRail(String title, String subtitle, List<StoryItem> stories) {
          if (stories.isEmpty) return const SizedBox.shrink();
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 22),
              child: ContentRail<StoryItem>(
                title: title,
                subtitle: subtitle,
                items: stories,
                height: 282,
                horizontalPadding: padding,
                itemBuilder: (c, item, i) => BookCard(
                  item: BookItem(
                    id: item.id,
                    title: item.title,
                    description: item.description,
                    type: item.type,
                    ageMin: item.ageMin,
                    ageMax: item.ageMax,
                    posterAsset: 'assets/images/explore/explore-read.webp',
                    coverUrl: item.coverUrl,
                  ),
                  isTelevision: false,
                  onPressed: () => c.push('/reader/${item.id}?contentType=story'),
                ),
              ),
            ),
          );
        }

        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(
            title: Text('اقرأ • ${catalog.stories.length} قصة'),
            backgroundColor: AppColors.deepSpace,
            foregroundColor: Colors.white,
          ),
          body: CinematicBackground(
            child: CustomScrollView(
              slivers: [
                // Show new stories first – each rail shows ALL stories in that track
                storyRail(
                  'حكاية هادئة • 3-5 سنوات',
                  '${preschoolStories.length} قصص',
                  preschoolStories,
                ),
                storyRail(
                  'حكايات قبل النوم • 6-8 سنوات',
                  '${kidsStories.length} قصص',
                  kidsStories,
                ),
                storyRail(
                  'قصص من الحياة • 9-12 سنة',
                  '${juniorStories.length} قصص',
                  juniorStories,
                ),
                // Legacy mixed rail for backward compat / books shelf
                if (books.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 22),
                      child: ContentRail<BookItem>(
                        title: 'كل القصص والكتب',
                        subtitle: '${books.length} عنصر • ${catalog.stories.length} قصص مصورة',
                        items: books,
                        height: 282,
                        horizontalPadding: padding,
                        itemBuilder: (c, item, i) => BookCard(
                          item: item,
                          isTelevision: false,
                          onPressed: () => c.push(
                            item.type == 'audio_story'
                                ? '/audio?bookId=${item.id}'
                                : '/reader/${item.id}?contentType=${storyIds.contains(item.id) ? 'story' : 'book'}',
                          ),
                        ),
                      ),
                    ),
                  ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(padding),
                    child: Text(
                      'القصص والكتب منفصلان خلف الكواليس — الواجهة فقط تجمعهما للاستكشاف • ${catalog.stories.length} قصة مصورة + ${catalog.books.length} كتاب',
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.6),
                        fontSize: 11,
                      ),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          ),
        );
      },
    );
  }
}

class StoryItemCard extends StatelessWidget {
  const StoryItemCard({super.key});
  @override
  Widget build(BuildContext context) => const SizedBox();
}
