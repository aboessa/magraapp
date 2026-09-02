/// The Creative Studio landing screen.
///
/// ## What changed and why
///
/// This screen used to be eleven stacked grids — one per activity — each showing
/// its whole catalogue inline. On a phone that was a ~130 tile scroll with no
/// hierarchy, and the only visual difference between "لوّن" and "لوّن الصور" was
/// the tile background colour. The layout here is a hub instead: shortcuts, a
/// banner that either starts a drawing or resumes one, one card per activity, and
/// a progress strip. Each card opens a page that owns its own catalogue.
///
/// ## Why it takes callbacks
///
/// Everything the studio can navigate to is an activity host or a page declared
/// privately inside `creative_studio_page.dart`, next to the local creation store
/// and the `GamePack` construction. Rather than make those public just to reach
/// them from here, this view reports intent and lets the page do the pushing. It
/// is a `ConsumerWidget` only to read activity counts, which are display data.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import 'studio_app_bar.dart';
import 'studio_categories.dart';
import 'studio_category_counts.dart';
import 'studio_design.dart';
import 'studio_home_widgets.dart';

class StudioHomeView extends ConsumerWidget {
  const StudioHomeView({
    required this.savedDrawings,
    required this.resumable,
    required this.loadingCreations,
    required this.creationError,
    required this.onRefresh,
    required this.onStartFreeDraw,
    required this.onOpenBoards,
    required this.onOpenReference,
    required this.onOpenCategory,
    required this.onOpenAllCategories,
    this.displayName,
    this.onOpenProfile,
    super.key,
  });

  /// Total drawings saved on this device for the active child.
  final int savedDrawings;

  /// Unfinished drawings offered by the hero carousel, newest first.
  final List<StudioHeroResume> resumable;

  final bool loadingCreations;

  /// Non-null when reading the local store failed. Only the hero degrades; the
  /// activities below do not depend on saved drawings and stay usable.
  final Object? creationError;

  final Future<void> Function() onRefresh;
  final VoidCallback onStartFreeDraw;
  final VoidCallback onOpenBoards;
  final VoidCallback onOpenReference;
  final void Function(StudioCategory category) onOpenCategory;
  final VoidCallback onOpenAllCategories;
  final String? displayName;
  final VoidCallback? onOpenProfile;

  /// Main studio banner — user-provided "رئيسيه الاستوديو الابداعي.png"
  /// WebP optimized (56KB) with PNG fallback (174KB) for older devices.
  static const String _heroArt = 'assets/images/studio/studio-main-banner.webp';
  static const String _heroArtFallback = 'assets/images/studio/studio-main-banner.png';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = ref.watch(studioCategoryCountsProvider);
    final primary = kPrimaryStudioCategories;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      // The studio home is the root of the tab, so it has no back button —
      // StudioAppBar derives that from the route rather than being told.
      //
      // The previous bar here set its title to 14px with a 10px sparkle and
      // squeezed the profile badge into a 28px slot with 2px of end padding.
      // That was four points smaller than every screen it navigates into, so
      // pushing a page made the title jump. It now uses the shared 17px.
      appBar: StudioAppBar(
        title: 'الاستوديو',
        glyph: Icons.palette_rounded,
        showStar: true,
        actions: [
          Padding(
            padding: const EdgeInsetsDirectional.only(start: StudioSpace.xs),
            child: Center(
              child: StudioProfileBadge(
                displayName: displayName,
                drawingCount: savedDrawings,
                onTap: onOpenProfile,
              ),
            ),
          ),
        ],
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: StudioGradients.page),
        child: RefreshIndicator(
          onRefresh: onRefresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              StudioSpace.gutter,
              StudioSpace.md,
              StudioSpace.gutter,
              StudioSpace.xxl,
            ),
            children: [
              const SizedBox(height: StudioSpace.sm),
              _hero(),
              const SizedBox(height: StudioSpace.xl),
              StudioSectionHeader(
                title: 'اختر نشاطك الإبداعي',
                accent: Icons.auto_awesome_rounded,
                trailingLabel: 'عرض الكل',
                onTrailingTap: onOpenAllCategories,
              ),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: studioGridDelegate(),
                itemCount: primary.length,
                itemBuilder: (context, index) {
                  final category = primary[index];
                  return StudioCategoryCard(
                    category: category,
                    itemCount: counts[category.id],
                    onTap: () => _openCategory(category),
                  );
                },
              ),
              const SizedBox(height: StudioSpace.xl),
              StudioAchievementStrip(
                savedDrawings: savedDrawings,
                onTap: onOpenBoards,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openCategory(StudioCategory category) {
    // A blank canvas has nothing to browse, so its card is a shortcut rather than
    // a link to a one-item list.
    if (category.opensCanvasDirectly) {
      onStartFreeDraw();
      return;
    }
    if (category.id == StudioCategoryId.drawLikeMe) {
      onOpenReference();
      return;
    }
    onOpenCategory(category);
  }

  Widget _hero() {
    if (loadingCreations) {
      return const SizedBox(
        height: 168,
        child: StudioStateCard(
          icon: Icons.brush_rounded,
          title: 'جاري تحضير الاستوديو…',
        ),
      );
    }
    if (creationError != null) {
      return StudioStateCard(
        icon: Icons.cloud_off_rounded,
        title: 'تعذّر قراءة رسوماتك',
        body: 'رسوماتك ما زالت محفوظة على هذا الجهاز. حاول مرة أخرى.',
        actionLabel: 'إعادة المحاولة',
        onAction: () => onRefresh(),
      );
    }

    // New main banner image — full illustrated "رئيسيه الاستوديو الابداعي" replaces old carousel
    // Keeps tap to start drawing + keeps resume strip below as separate layer if exists
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onStartFreeDraw,
              borderRadius: BorderRadius.circular(22),
              child: AspectRatio(
                aspectRatio: 1.85,
                child: Image.asset(
                  _heroArt,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Image.asset(
                    _heroArtFallback,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      color: const Color(0xFF1A0B3E),
                      child: const Center(
                        child: Icon(Icons.palette_rounded, size: 48, color: Colors.white24),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (resumable.isNotEmpty) ...[
          const SizedBox(height: 12),
          // Keep resume carousel only for unfinished work — main banner stays on top
          SizedBox(
            height: 96,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: resumable.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                final r = resumable[index];
                return InkWell(
                  onTap: r.onTap,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: 200,
                    decoration: BoxDecoration(
                      color: const Color(0xFF151A3A),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: Row(
                      children: [
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.all(10),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(999),
                                  ),
                                  child: const Text('أكمل', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  r.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          ),
                        ),
                        SizedBox(
                          width: 64,
                          height: double.infinity,
                          child: Image.memory(r.thumbnail, fit: BoxFit.cover),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ],
    );
  }
}

/// Full activity list behind "عرض الكل".
///
/// Deliberately a list, not another grid: this page exists for the activities
/// that did not fit the six-card home grid, and several of them (الحروف،
/// الأرقام، ارسم من الفكرة) only make sense once a parent or older child has read
/// the subtitle.
class StudioAllCategoriesView extends ConsumerWidget {
  const StudioAllCategoriesView({
    required this.onOpenCategory,
    required this.onStartFreeDraw,
    required this.onOpenReference,
    super.key,
  });

  final void Function(StudioCategory category) onOpenCategory;
  final VoidCallback onStartFreeDraw;
  final VoidCallback onOpenReference;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = ref.watch(studioCategoryCountsProvider);
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: const StudioAppBar(
        title: 'كل الأنشطة',
        glyph: Icons.grid_view_rounded,
      ),
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: StudioGradients.page),
        child: ListView.separated(
          padding: const EdgeInsets.fromLTRB(
            StudioSpace.gutter,
            StudioSpace.md,
            StudioSpace.gutter,
            StudioSpace.xxl,
          ),
          itemCount: kStudioCategories.length,
          separatorBuilder: (_, __) => const SizedBox(height: StudioSpace.sm),
          itemBuilder: (context, index) {
            final category = kStudioCategories[index];
            final count = counts[category.id];
            return StudioSurface(
              gradient: category.gradient,
              radius: StudioRadius.strip,
              semanticLabel: count == null
                  ? '${category.title}. ${category.subtitle}'
                  : '${category.title}. ${category.subtitle}. $count نشاط',
              padding: const EdgeInsets.all(StudioSpace.md),
              onTap: () {
                if (category.opensCanvasDirectly) {
                  onStartFreeDraw();
                } else if (category.id == StudioCategoryId.drawLikeMe) {
                  onOpenReference();
                } else {
                  onOpenCategory(category);
                }
              },
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(StudioRadius.tile),
                    ),
                    child: Icon(category.icon, color: Colors.white, size: 24),
                  ),
                  const SizedBox(width: StudioSpace.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          category.title,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          category.subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.bodySmall
                              ?.copyWith(
                                color: Colors.white.withValues(alpha: 0.78),
                              ),
                        ),
                      ],
                    ),
                  ),
                  if (count != null) ...[
                    const SizedBox(width: StudioSpace.sm),
                    StudioPill(
                      label: '$count',
                      background: Colors.black.withValues(alpha: 0.28),
                    ),
                  ],
                  const Icon(
                    Icons.chevron_left_rounded,
                    color: Colors.white70,
                    size: 22,
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}
