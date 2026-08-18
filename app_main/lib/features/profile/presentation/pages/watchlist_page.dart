import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/domain/content_models.dart';
import '../../../home/presentation/widgets/content_cards.dart';
import '../../data/watchlist_store.dart';
import '../widgets/profile_page_content.dart';

/// Saved titles.
///
/// Previously this page displayed `series.where(isFree)` with `items[index %
/// items.length]` modulo indexing, so it listed titles the user had never saved
/// and the "sort" button did nothing.
///
/// It now reads the persisted watchlist from [watchlistProvider] and resolves
/// each saved id against the catalog, so the list is exactly what the user
/// bookmarked on this device.
class WatchlistPage extends ConsumerStatefulWidget {
  const WatchlistPage({super.key});

  @override
  ConsumerState<WatchlistPage> createState() => _WatchlistPageState();
}

enum _SortOrder { recent, title, age }

class _WatchlistPageState extends ConsumerState<WatchlistPage> {
  _SortOrder _sort = _SortOrder.recent;

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(homeCatalogProvider).valueOrNull;
    final savedIds = ref.watch(watchlistProvider);

    // Resolve ids against the catalog. Ids that no longer match a title are
    // skipped rather than rendered as blanks — a title can be unpublished after
    // it was saved.
    final items = <SeriesItem>[];
    for (final id in savedIds) {
      final match = catalog?.seriesById(id);
      if (match != null) items.add(match);
    }
    _applySort(items);

    final unresolved = savedIds.length - items.length;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(
                icon: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                ),
                tooltip: 'رجوع',
                onPressed: () => context.pop(),
              ),
              title: const Text(
                'المسلسلات المحفوظة',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
            ),
            if (savedIds.isNotEmpty)
              SliverToBoxAdapter(
                child: ProfilePageContent(
                  padding: const EdgeInsetsDirectional.fromSTEB(18, 18, 18, 8),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.electricCyan.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          items.length == 1
                              ? 'عنصر واحد'
                              : '${items.length} عناصر',
                          style: const TextStyle(
                            color: AppColors.electricCyan,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const Spacer(),
                      PopupMenuButton<_SortOrder>(
                        initialValue: _sort,
                        tooltip: 'ترتيب',
                        color: const Color(0xFF111A3A),
                        onSelected: (value) => setState(() => _sort = value),
                        itemBuilder: (context) => const [
                          PopupMenuItem(
                            value: _SortOrder.recent,
                            child: Text(
                              'الأحدث إضافة',
                              style: TextStyle(color: Colors.white),
                            ),
                          ),
                          PopupMenuItem(
                            value: _SortOrder.title,
                            child: Text(
                              'الاسم',
                              style: TextStyle(color: Colors.white),
                            ),
                          ),
                          PopupMenuItem(
                            value: _SortOrder.age,
                            child: Text(
                              'الفئة العمرية',
                              style: TextStyle(color: Colors.white),
                            ),
                          ),
                        ],
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.sort_rounded,
                              size: 16,
                              color: AppColors.starGold,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              _sortLabel(_sort),
                              style: const TextStyle(
                                color: AppColors.starGold,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            if (items.isEmpty)
              const SliverToBoxAdapter(
                child: ProfilePageContent(
                  padding: EdgeInsetsDirectional.fromSTEB(32, 64, 32, 64),
                  child: _EmptyWatchlist(),
                ),
              )
            else
              SliverToBoxAdapter(
                child: ProfilePageContent(
                  padding: const EdgeInsetsDirectional.fromSTEB(18, 12, 18, 24),
                  child: Builder(
                    builder: (context) {
                      final textScale = MediaQuery.textScalerOf(
                        context,
                      ).scale(1);
                      return GridView.builder(
                        shrinkWrap: true,
                        primary: false,
                        physics: const NeverScrollableScrollPhysics(),
                        padding: EdgeInsets.zero,
                        gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 200,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: textScale > 1.3 ? 0.58 : 0.68,
                        ),
                        itemCount: items.length,
                        itemBuilder: (context, index) {
                          final item = items[index];
                          return SeriesCard(
                            item: item,
                            isTelevision: false,
                            onPressed: () => context.push('/series/${item.id}'),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            if (unresolved > 0)
              SliverToBoxAdapter(
                child: ProfilePageContent(
                  padding: const EdgeInsetsDirectional.fromSTEB(18, 0, 18, 24),
                  child: Text(
                    'مسلسل محفوظ لم يُعد متاحًا في المكتبة: $unresolved',
                    style: TextStyle(
                      color: AppColors.mutedText.withValues(alpha: 0.6),
                      fontSize: 11,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _applySort(List<SeriesItem> items) {
    switch (_sort) {
      case _SortOrder.recent:
        // The store already keeps newest-first order; nothing to do.
        break;
      case _SortOrder.title:
        items.sort((a, b) => a.title.compareTo(b.title));
      case _SortOrder.age:
        items.sort((a, b) => a.ageMin.compareTo(b.ageMin));
    }
  }

  static String _sortLabel(_SortOrder order) => switch (order) {
    _SortOrder.recent => 'الأحدث',
    _SortOrder.title => 'الاسم',
    _SortOrder.age => 'العمر',
  };
}

class _EmptyWatchlist extends StatelessWidget {
  const _EmptyWatchlist();

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF111A3A),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: const Icon(
              Icons.bookmark_add_rounded,
              color: AppColors.starGold,
              size: 32,
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'لا توجد مسلسلات محفوظة',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'احفظ مسلسلًا من صفحة تفاصيله ليظهر هنا للطفل الحالي',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.72),
              fontSize: 12,
            ),
          ),
        ],
      ),
    ),
  );
}
