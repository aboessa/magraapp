import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/skeleton.dart';
import '../../../profile/data/progress_store.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import 'home_ambient_stage.dart';
import 'home_billboard.dart';
import 'home_cards.dart';
import 'home_feed_model.dart';
import 'home_top_chrome.dart';
import 'home_v2_tokens.dart';

/// The v2 cinematic home surface.
///
/// One widget serves phone, tablet and television. Rather than three parallel
/// trees, the differences are expressed through [HomeV2Metrics] and a small
/// number of behavioural flags, which is what keeps the three surfaces visually
/// consistent as the design evolves.
///
/// Structure, top to bottom:
///   [HomeAmbientStage]   — backdrop that re-lights around the active accent
///     [CustomScrollView] — billboard sliver, then one sliver per feed row
///     [HomeTopChrome]    — floating glass bar, tints on scroll
class HomeV2Page extends ConsumerStatefulWidget {
  const HomeV2Page({
    required this.catalog,
    required this.isTelevision,
    this.onOpenSearch,
    this.onOpenProfile,
    this.onOpenPortal,
    super.key,
  });

  final HomeCatalog catalog;
  final bool isTelevision;

  /// Supplied by the hosting shell so the chrome can switch destinations
  /// instead of pushing a route. Falls back to a route push when absent.
  final VoidCallback? onOpenSearch;
  final VoidCallback? onOpenProfile;
  final VoidCallback? onOpenPortal;

  @override
  ConsumerState<HomeV2Page> createState() => _HomeV2PageState();
}

class _HomeV2PageState extends ConsumerState<HomeV2Page> {
  final ScrollController _scroll = ScrollController();
  final ChromeOpacityController _chrome = ChromeOpacityController();

  /// Colour the ambient stage is currently lit with.
  Color _accent = AppColors.royalBlue;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scroll.removeListener(_onScroll);
    _scroll.dispose();
    _chrome.dispose();
    super.dispose();
  }

  void _onScroll() => _chrome.onScroll(_scroll.offset);

  void _setAccent(Color color) {
    if (!mounted || color == _accent) return;
    setState(() => _accent = color);
  }

  @override
  Widget build(BuildContext context) {
    final metrics = HomeV2Metrics.of(
      context,
      isTelevision: widget.isTelevision,
    );
    final billboard = HomeFeedBuilder.billboard(widget.catalog);

    // Real watch progress for the active child. An empty map simply omits the
    // continue-watching row rather than showing invented progress bars.
    final progress = ref.watch(progressProvider).valueOrNull ?? const {};
    final fractions = <String, double>{
      for (final entry in progress.entries)
        if (entry.value.isResumable && entry.value.fraction != null)
          entry.key: entry.value.fraction!,
    };

    final rows = HomeFeedBuilder.rows(widget.catalog, progress: fractions);

    return HomeAmbientStage(
      accent: _accent,
      // A large panel needs less alpha to read as the same amount of glow.
      intensity: widget.isTelevision ? 0.72 : 1,
      child: Stack(
        children: [
          CustomScrollView(
            controller: _scroll,
            // Retains scroll position when the shell switches tabs and back.
            key: const PageStorageKey('home-v2'),
            slivers: [
              if (billboard.isNotEmpty)
                SliverToBoxAdapter(
                  child: HomeBillboard(
                    items: billboard,
                    metrics: metrics,
                    // On TV the billboard's play button is the entry point for
                    // the remote; on touch surfaces nothing should steal focus.
                    autofocus: widget.isTelevision,
                    onAccentChanged: _setAccent,
                    onPlay: _playFromBillboard,
                    onDetails: (item) =>
                        context.push('/series/${item.series.id}'),
                  ),
                ),

              // Pull the first row up over the billboard's scrim so the feed
              // reads as emerging from the artwork instead of starting after it.
              SliverToBoxAdapter(
                child: SizedBox(height: billboard.isEmpty ? metrics.railSpacing : 0),
              ),

              // Rows are built lazily. Emitting one SliverToBoxAdapter per row
              // in a loop would construct every rail — and every card in it —
              // during the first frame, which is the cost that made the v1 feed
              // expensive to open on a television.
              SliverList.builder(
                itemCount: rows.length,
                itemBuilder: (context, index) {
                  final row = rows[index];
                  return Padding(
                    padding: EdgeInsets.only(bottom: metrics.railSpacing),
                    child: _RowView(
                      row: row,
                      metrics: metrics,
                      onOpen: (entry) => context.push(entry.onOpenRoute),
                      onSeeAll: row.id == 'planets'
                          ? () => context.push('/planets')
                          : null,
                      // Moving focus along a rail on TV re-lights the backdrop,
                      // which is what makes the screen feel alive on a remote.
                      onEntryFocused: widget.isTelevision
                          ? (entry) {
                              if (entry.accent != null) {
                                _setAccent(entry.accent!);
                              }
                            }
                          : null,
                    ),
                  );
                },
              ),

              if (widget.catalog.usesLocalFallback)
                SliverToBoxAdapter(
                  child: _OfflineNotice(
                    metrics: metrics,
                    onRetry: () => ref.invalidate(homeCatalogProvider),
                  ),
                ),

              // Clearance for the bottom navigation / TV safe area.
              SliverToBoxAdapter(
                child: SizedBox(height: widget.isTelevision ? 56 : 104),
              ),
            ],
          ),

          // Floating chrome. Rebuilds independently of the feed.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: ValueListenableBuilder<double>(
              valueListenable: _chrome,
              builder: (context, opacity, _) => HomeTopChrome(
                opacity: opacity,
                metrics: metrics,
                onSearch: widget.onOpenSearch ?? () {},
                onProfile: widget.onOpenProfile ?? () {},
                onPortal: widget.onOpenPortal,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Plays the first episode of the billboard title, or opens details when the
  /// series has no episodes yet so the button is never a dead end.
  void _playFromBillboard(BillboardItem item) {
    final episodes = widget.catalog.episodesFor(item.series.id);
    if (episodes.isEmpty) {
      context.push('/series/${item.series.id}');
      return;
    }
    context.push('/playback/${episodes.first.id}');
  }
}

/// Renders one [HomeRow] using the card shape its [HomeRowKind] implies.
class _RowView extends StatelessWidget {
  const _RowView({
    required this.row,
    required this.metrics,
    required this.onOpen,
    this.onSeeAll,
    this.onEntryFocused,
  });

  final HomeRow row;
  final HomeV2Metrics metrics;
  final ValueChanged<HomeEntry> onOpen;
  final VoidCallback? onSeeAll;
  final ValueChanged<HomeEntry>? onEntryFocused;

  @override
  Widget build(BuildContext context) {
    final height = switch (row.kind) {
      HomeRowKind.poster => metrics.posterRailHeight,
      HomeRowKind.wide => metrics.wideRailHeight,
      HomeRowKind.ranked => metrics.posterHeight * 0.82 + 12,
      HomeRowKind.orb => metrics.circleRailHeight,
    };

    return HomeRail(
      title: row.title,
      subtitle: row.subtitle,
      metrics: metrics,
      height: height,
      onSeeAll: row.showSeeAll ? onSeeAll : null,
      itemCount: row.entries.length,
      itemBuilder: (context, index) {
        final entry = row.entries[index];
        final card = _card(entry, index);

        if (onEntryFocused == null) return card;
        // Focus is observed here rather than inside the cards so the card
        // widgets stay free of ambient-lighting concerns.
        return Focus(
          canRequestFocus: false,
          skipTraversal: true,
          onFocusChange: (hasFocus) {
            if (hasFocus) onEntryFocused!(entry);
          },
          child: card,
        );
      },
    );
  }

  Widget _card(HomeEntry entry, int index) {
    switch (row.kind) {
      case HomeRowKind.poster:
        return PosterCard(
          title: entry.title,
          meta: entry.meta,
          assetPath: entry.assetPath,
          networkUrl: entry.networkUrl,
          badge: entry.badge,
          badgeColor: entry.badgeColor,
          progress: entry.progress,
          metrics: metrics,
          onPressed: () => onOpen(entry),
        );
      case HomeRowKind.wide:
        return WideCard(
          title: entry.title,
          meta: entry.meta,
          assetPath: entry.assetPath,
          networkUrl: entry.networkUrl,
          progress: entry.progress,
          metrics: metrics,
          onPressed: () => onOpen(entry),
        );
      case HomeRowKind.ranked:
        return RankedCard(
          rank: index + 1,
          title: entry.title,
          assetPath: entry.assetPath,
          networkUrl: entry.networkUrl,
          metrics: metrics,
          onPressed: () => onOpen(entry),
        );
      case HomeRowKind.orb:
        return OrbCard(
          label: entry.title,
          assetPath: entry.assetPath,
          accent: entry.accent ?? AppColors.royalBlue,
          metrics: metrics,
          onPressed: () => onOpen(entry),
        );
    }
  }
}

class _OfflineNotice extends StatelessWidget {
  const _OfflineNotice({required this.metrics, required this.onRetry});

  final HomeV2Metrics metrics;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsetsDirectional.only(
        start: metrics.pagePadding,
        end: metrics.pagePadding,
        bottom: 20,
      ),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.indigoSurface.withValues(alpha: 0.66),
          borderRadius: BorderRadius.circular(HomeV2Tokens.radiusPanel),
          border: Border.all(
            color: AppColors.starGold.withValues(alpha: 0.24),
          ),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: AppColors.starGold,
              size: 20,
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'نعرض نسخة محفوظة من المكتبة. أعد المحاولة للحصول على أحدث المحتوى.',
                style: TextStyle(color: AppColors.mutedText, fontSize: 11.5),
              ),
            ),
            TextButton(
              onPressed: onRetry,
              child: const Text('تحديث'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Loading state shaped like the real feed, so the transition into content does
/// not shift layout.
class HomeV2Skeleton extends StatelessWidget {
  const HomeV2Skeleton({required this.isTelevision, super.key});

  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    final metrics = HomeV2Metrics.of(context, isTelevision: isTelevision);
    final billboardHeight =
        MediaQuery.sizeOf(context).height * metrics.billboardHeightFactor;

    return HomeAmbientStage(
      accent: AppColors.royalBlue,
      child: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SkeletonCard(
              width: double.infinity,
              height: billboardHeight.clamp(340.0, 620.0),
              borderRadius: 0,
            ),
            SizedBox(height: metrics.railSpacing),
            for (var i = 0; i < 3; i++)
              Padding(
                padding: EdgeInsets.only(bottom: metrics.railSpacing),
                child: SkeletonRail(
                  height: metrics.posterRailHeight,
                  cardWidth: metrics.posterWidth,
                  cardHeight: metrics.posterHeight,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
