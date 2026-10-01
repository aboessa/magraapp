import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../child/application/child_provider.dart';
import '../../../downloads/application/download_providers.dart';
import '../../../downloads/domain/download_models.dart';
import '../../../games/data/local_creation_store.dart';
import '../../../profile/data/progress_store.dart';
import '../../../profile/data/watchlist_store.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

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
          backgroundColor: Color(0xFF080C22).withValues(alpha: 0.88),
          elevation: 0,
          titleSpacing: 16,
          title: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: AppColors.electricCyan.withValues(alpha: 0.18),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.auto_stories_rounded,
                  size: 18,
                  color: AppColors.electricCyan,
                ),
              ),
              SizedBox(width: 10),
              Text(
                AppLocalizationsAr().homelibrarypageText01,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          actions: [
            Padding(
              padding: const EdgeInsetsDirectional.only(end: 12),
              child: IconButton(
                icon: Icon(Icons.search_rounded, color: Colors.white),
                tooltip: AppLocalizationsAr().homelibrarypageTooltip01,
                onPressed: () => context.push('/search'),
              ),
            ),
          ],
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(56),
            child: Container(
              height: 56,
              alignment: Alignment.centerRight,
              padding: const EdgeInsets.only(bottom: 8),
              child: TabBar(
                isScrollable: true,
                tabAlignment: TabAlignment.start,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                labelPadding: const EdgeInsets.symmetric(horizontal: 5),
                indicatorSize: TabBarIndicatorSize.label,
                indicator: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  gradient: const LinearGradient(
                    colors: [Color(0xFF2580FF), Color(0xFF6A3DF2)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Color(0xFF2580FF).withValues(alpha: 0.4),
                      blurRadius: 10,
                      offset: Offset(0, 3),
                    ),
                  ],
                ),
                indicatorPadding: EdgeInsets.zero,
                dividerColor: Colors.transparent,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white60,
                labelStyle: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
                unselectedLabelStyle: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
                tabs: [
                  Tab(
                    child: _TabPill(
                      icon: Icons.play_arrow_rounded,
                      label: AppLocalizationsAr().homelibrarypageLabel01,
                    ),
                  ),
                  Tab(
                    child: _TabPill(
                      icon: Icons.bookmark_rounded,
                      label: AppLocalizationsAr().homelibrarypageLabel02,
                    ),
                  ),
                  Tab(
                    child: _TabPill(
                      icon: Icons.download_rounded,
                      label: AppLocalizationsAr().homelibrarypageLabel03,
                    ),
                  ),
                  Tab(
                    child: _TabPill(
                      icon: Icons.brush_rounded,
                      label: AppLocalizationsAr().homelibrarypageLabel04,
                    ),
                  ),
                ],
              ),
            ),
          ),
          flexibleSpace: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      const Color(0xFF06091A).withValues(alpha: 0.95),
                      const Color(0xFF080C22).withValues(alpha: 0.82),
                    ],
                  ),
                  border: Border(
                    bottom: BorderSide(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        body: catalogAsync.when(
          loading: () => Center(
            child: CircularProgressIndicator(color: AppColors.starGold),
          ),
          error: (e, s) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.cloud_off_rounded, size: 48, color: Colors.white30),
                SizedBox(height: 12),
                Text(
                  AppLocalizationsAr().homelibrarypageText02,
                  style: TextStyle(color: Colors.white),
                ),
                SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => ref.invalidate(homeCatalogProvider),
                  icon: Icon(Icons.refresh_rounded),
                  label: Text(AppLocalizationsAr().homelibrarypageText03),
                ),
              ],
            ),
          ),
          data: (catalog) => TabBarView(
            children: [
              _ContinueTab(catalog: catalog, childId: childId),
              _SavedTab(catalog: catalog),
              const _DownloadsTab(),
              _DrawingsTab(childId: childId),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabPill extends StatelessWidget {
  const _TabPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: Colors.white.withValues(alpha: 0.06),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.10),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Icon(icon, size: 16), const SizedBox(width: 6), Text(label)],
      ),
    );
  }
}

class _ContinueTab extends ConsumerWidget {
  const _ContinueTab({required this.catalog, this.childId});

  final HomeCatalog catalog;
  final String? childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progress = ref.watch(progressProvider).valueOrNull ?? const {};
    final fractions = <String, double>{
      for (final e in progress.entries)
        if (e.value.isResumable && e.value.fraction != null)
          e.key: e.value.fraction!,
    };
    final eps = catalog.episodes
        .where((ep) => fractions.containsKey(ep.id))
        .toList();
    final padding = context.horizontalPagePadding;

    if (eps.isEmpty && (childId == null)) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.10),
                  ),
                ),
                child: Icon(
                  Icons.history_rounded,
                  color: Colors.white38,
                  size: 48,
                ),
              ),
              SizedBox(height: 16),
              Text(
                AppLocalizationsAr().homelibrarypageText04,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'شاهد مسلسلاتك وحكاياتك المفضلة وستظهر هنا لتكملها لاحقاً',
                style: TextStyle(color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () => context.push('/watch'),
                icon: const Icon(Icons.play_circle_fill_rounded),
                label: const Text('استكشف السلاسل'),
              ),
            ],
          ),
        ),
      );
    }

    return CinematicBackground(
      child: CustomScrollView(
        slivers: [
          if (eps.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 22),
                child: ContentRail<EpisodeItem>(
                  title: 'متابعة المشاهدة',
                  items: eps.take(6).toList(),
                  height: 208,
                  horizontalPadding: padding,
                  itemBuilder: (c, item, i) => EpisodeCard(
                    item: item,
                    isTelevision: false,
                    onPressed: () => context.push('/playback/${item.id}'),
                  ),
                ),
              ),
            ),
          if (childId != null)
            _DrawingsContinueRail(childId: childId!, padding: padding),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}

class _DrawingsContinueRail extends StatelessWidget {
  const _DrawingsContinueRail({required this.childId, required this.padding});

  final String childId;
  final double padding;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<LocalCreation>>(
      future: LocalCreationStore().list(childId),
      builder: (c, snap) {
        final items = (snap.data ?? [])
            .where((e) => e.isEditable)
            .take(6)
            .toList();
        if (items.isEmpty) {
          return const SliverToBoxAdapter(child: SizedBox.shrink());
        }
        return SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: 22),
            child: ContentRail<LocalCreation>(
              title: 'متابعة الرسم والتلوين',
              items: items,
              height: 180,
              horizontalPadding: padding,
              itemBuilder: (ctx, item, i) => Container(
                width: 140,
                decoration: BoxDecoration(
                  color: const Color(0xFF121A38),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                ),
                child: InkWell(
                  onTap: () => ctx.push('/studio', extra: item),
                  borderRadius: BorderRadius.circular(12),
                  child: Column(
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(11),
                          ),
                          child: Image.memory(
                            item.bytes,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) =>
                                const Icon(Icons.brush, color: Colors.white),
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(6),
                        child: Text(
                          item.displayTitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _SavedTab extends ConsumerWidget {
  const _SavedTab({required this.catalog});

  final HomeCatalog catalog;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedIds = ref.watch(watchlistProvider);
    final items = <SeriesItem>[];
    for (final id in savedIds) {
      final match = catalog.seriesById(id);
      if (match != null) items.add(match);
    }
    final padding = context.horizontalPagePadding;

    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.10),
                  ),
                ),
                child: const Icon(
                  Icons.bookmark_border_rounded,
                  color: Colors.white38,
                  size: 48,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'لا توجد مسلسلات محفوظة بعد',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'احفظ مسلسلاتك وقصصك المفضلة للوصول إليها بسرعة هنا',
                style: TextStyle(color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () => context.push('/watch'),
                icon: const Icon(Icons.explore_rounded),
                label: const Text('استكشف المسلسلات'),
              ),
            ],
          ),
        ),
      );
    }

    return CinematicBackground(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: EdgeInsets.all(padding),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.72,
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) => SeriesCard(
                  item: items[index],
                  isTelevision: false,
                  onPressed: () => context.push('/series/${items[index].id}'),
                ),
                childCount: items.length,
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 80)),
        ],
      ),
    );
  }
}

class _DownloadsTab extends ConsumerWidget {
  const _DownloadsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(childProvider).activeChildId;
    final allItems = ref.watch(downloadManagerProvider);
    final items = childId == null
        ? const <DownloadItem>[]
        : allItems.where((item) => item.childId == childId).toList();
    final padding = context.horizontalPagePadding;

    if (items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.10),
                  ),
                ),
                child: const Icon(
                  Icons.cloud_download_outlined,
                  color: Colors.white38,
                  size: 48,
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'لا توجد تحميلات حالياً',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'حمّل الحلقات لمشاهدتها في أي وقت دون اتصال بالإنترنت',
                style: TextStyle(color: Colors.white54, fontSize: 12),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: () => context.push('/watch'),
                icon: const Icon(Icons.download_rounded),
                label: const Text('تصفح الحلقات للتحميل'),
              ),
            ],
          ),
        ),
      );
    }

    return CinematicBackground(
      child: ListView.separated(
        padding: EdgeInsets.fromLTRB(padding, 16, padding, 80),
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final item = items[index];
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF101735).withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: 70,
                    height: 50,
                    color: const Color(0xFF1B2550),
                    child: const Icon(
                      Icons.play_circle_fill_rounded,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        item.status == DownloadStatus.ready
                            ? 'جاهز للمشاهدة'
                            : item.status.label,
                        style: TextStyle(
                          color: item.status == DownloadStatus.ready
                              ? AppColors.electricCyan
                              : AppColors.starGold,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(
                    Icons.play_circle_outline_rounded,
                    color: Colors.white,
                  ),
                  onPressed: () {
                    if (item.contentType == 'audio_story') {
                      context.push('/audio?bookId=${item.id}');
                    } else {
                      context.push('/playback/${item.id}');
                    }
                  },
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _DrawingsTab extends StatelessWidget {
  const _DrawingsTab({required this.childId});

  final String? childId;

  @override
  Widget build(BuildContext context) {
    if (childId == null) {
      return const Center(
        child: Text('اختر طفلاً', style: TextStyle(color: Colors.white54)),
      );
    }
    return FutureBuilder<List<LocalCreation>>(
      future: LocalCreationStore().list(childId!),
      builder: (c, snap) {
        final items = snap.data ?? [];
        if (items.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.05),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.10),
                      ),
                    ),
                    child: const Icon(
                      Icons.palette_outlined,
                      color: Colors.white38,
                      size: 48,
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'لا توجد رسومات بعد',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'ارسم ولوّن شخصياتك المفضلة واحفظ إبداعاتك هنا',
                    style: TextStyle(color: Colors.white54, fontSize: 12),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: () => context.push('/studio'),
                    icon: const Icon(Icons.brush_rounded),
                    label: const Text('افتح استوديو الإبداع'),
                  ),
                ],
              ),
            ),
          );
        }
        return GridView.builder(
          padding: const EdgeInsets.all(16),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.9,
          ),
          itemCount: items.length,
          itemBuilder: (ctx, i) {
            final it = items[i];
            return Container(
              decoration: BoxDecoration(
                color: const Color(0xFF121A38),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: InkWell(
                onTap: () => ctx.push('/studio', extra: it),
                borderRadius: BorderRadius.circular(14),
                child: Column(
                  children: [
                    Expanded(
                      child: ClipRRect(
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(13),
                        ),
                        child: Image.memory(
                          it.bytes,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const Icon(Icons.brush, color: Colors.white),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(
                        it.displayTitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
