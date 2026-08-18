import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/device/device_profile.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/animated_brand_logo.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../home/application/home_providers.dart';
import '../../home/domain/content_models.dart';
import '../../home/presentation/widgets/content_cards.dart';
import '../../profile/data/watchlist_store.dart';

class SeriesDetailsPage extends ConsumerWidget {
  const SeriesDetailsPage({required this.seriesId, super.key});

  final String seriesId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isTelevision = ref
        .watch(deviceProfileProvider)
        .maybeWhen(
          data: (profile) => profile.isTelevision,
          orElse: () => false,
        );
    final catalog = ref.watch(homeCatalogProvider);

    return catalog.when(
      loading: () => const Scaffold(body: BrandLoadingView()),
      error: (_, __) => _CatalogError(
        onRetry: () => ref.invalidate(homeCatalogProvider),
        onBack: () => _back(context),
      ),
      data: (value) {
        final series = value.seriesById(seriesId);
        if (series == null) return _MissingSeries(onBack: () => _back(context));
        return _SeriesDetailsContent(
          catalog: value,
          series: series,
          isTelevision: isTelevision,
        );
      },
    );
  }

  static void _back(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }
}

class _SeriesDetailsContent extends ConsumerStatefulWidget {
  const _SeriesDetailsContent({
    required this.catalog,
    required this.series,
    required this.isTelevision,
  });

  final HomeCatalog catalog;
  final SeriesItem series;
  final bool isTelevision;

  @override
  ConsumerState<_SeriesDetailsContent> createState() =>
      _SeriesDetailsContentState();
}

class _SeriesDetailsContentState extends ConsumerState<_SeriesDetailsContent> {
  bool _expanded = false;

  bool get _inWatchlist =>
      ref.watch(watchlistProvider).contains(widget.series.id);

  String? _episodeCountLabel(int loaded) {
    final declared = widget.series.episodesCount;
    final count = declared > 0 ? declared : loaded;
    if (count <= 0) return null;
    return count == 1 ? 'حلقة واحدة' : '$count حلقة';
  }

  void _toggleWatchlist() {
    HapticFeedback.selectionClick();
    final added = !ref.read(watchlistProvider).contains(widget.series.id);
    ref.read(watchlistProvider.notifier).toggle(widget.series.id);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          added ? 'تم حفظ المسلسل' : 'تمت إزالة المسلسل من المحفوظات',
        ),
      ),
    );
  }

  void _share() {
    final url = 'https://majarra.app/series/${widget.series.id}';
    Share.share('شاهد "${widget.series.title}" على تطبيق مجرة\n$url');
  }

  @override
  Widget build(BuildContext context) {
    final layoutClass = context.layoutClass;
    final padding =
        context.horizontalPagePadding + (widget.isTelevision ? 18 : 0);
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final maxContentWidth = widget.isTelevision
        ? 1440.0
        : switch (layoutClass) {
            AppLayoutClass.compact => viewportWidth,
            AppLayoutClass.medium => 900.0,
            AppLayoutClass.expanded => 1200.0,
          };
    final heroAspectRatio = widget.isTelevision
        ? 2.5
        : switch (layoutClass) {
            AppLayoutClass.compact => 1.82,
            AppLayoutClass.medium => 2.08,
            AppLayoutClass.expanded => 2.35,
          };
    final titleSize = widget.isTelevision
        ? 32.0
        : switch (layoutClass) {
            AppLayoutClass.compact => 24.0,
            AppLayoutClass.medium => 27.0,
            AppLayoutClass.expanded => 30.0,
          };
    final relatedRailHeight = widget.isTelevision
        ? 230.0
        : switch (layoutClass) {
            AppLayoutClass.compact => 190.0,
            AppLayoutClass.medium => 208.0,
            AppLayoutClass.expanded => 220.0,
          };

    final episodes = widget.catalog.episodesFor(widget.series.id);
    final playableEpisodes = episodes
        .where((episode) => episode.isPlayable)
        .toList(growable: false);
    final firstPlayable = playableEpisodes.isEmpty
        ? null
        : playableEpisodes.first;
    final related = _relatedByPlanet();

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: Center(
          child: ConstrainedBox(
            constraints: BoxConstraints(maxWidth: maxContentWidth),
            child: SizedBox(
              width: double.infinity,
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                        padding,
                        12,
                        padding,
                        0,
                      ),
                      child: Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(18),
                            child: AspectRatio(
                              aspectRatio: heroAspectRatio,
                              child: Stack(
                                fit: StackFit.expand,
                                children: [
                                  CinematicImage(
                                    networkUrl: widget.series.coverUrl,
                                    assetPath: widget.series.bannerAsset,
                                    semanticLabel: widget.series.title,
                                  ),
                                  DecoratedBox(
                                    decoration: BoxDecoration(
                                      gradient: LinearGradient(
                                        begin: Alignment.topCenter,
                                        end: Alignment.bottomCenter,
                                        colors: [
                                          Colors.black.withValues(alpha: 0.08),
                                          Colors.transparent,
                                          Colors.black.withValues(alpha: 0.3),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          PositionedDirectional(
                            top: 10,
                            start: 10,
                            child: Tooltip(
                              message: 'إغلاق',
                              child: Material(
                                color: Colors.black.withValues(alpha: 0.52),
                                shape: const CircleBorder(),
                                child: InkWell(
                                  customBorder: const CircleBorder(),
                                  onTap: () => Navigator.of(context).canPop()
                                      ? context.pop()
                                      : context.go('/'),
                                  child: const Padding(
                                    padding: EdgeInsets.all(12),
                                    child: Icon(
                                      Icons.close_rounded,
                                      color: Colors.white,
                                      size: 20,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                        padding,
                        14,
                        padding,
                        0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    AppColors.cosmicPurple.withValues(
                                      alpha: 0.14,
                                    ),
                                    AppColors.starGold.withValues(alpha: 0.08),
                                  ],
                                ),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.06),
                                ),
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    widget.series.planetName,
                                    style: TextStyle(
                                      color: AppColors.mutedText.withValues(
                                        alpha: 0.76,
                                      ),
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                  Text(
                                    widget.series.title,
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: titleSize,
                                      fontWeight: FontWeight.w900,
                                      height: 1.15,
                                      shadows: [
                                        Shadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.5,
                                          ),
                                          blurRadius: 12,
                                        ),
                                      ],
                                    ),
                                  ),
                                  Text(
                                    widget.series.ageLabel,
                                    style: const TextStyle(
                                      color: AppColors.starGold,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          SizedBox(
                            height: 52,
                            child: FilledButton.icon(
                              onPressed: firstPlayable == null
                                  ? null
                                  : () => _openPlayback(
                                      context,
                                      firstPlayable.id,
                                    ),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFF2A3447),
                                foregroundColor: Colors.white,
                                disabledBackgroundColor: Colors.white
                                    .withValues(alpha: 0.08),
                                disabledForegroundColor: AppColors.mutedText,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(26),
                                ),
                              ),
                              icon: Icon(
                                firstPlayable == null
                                    ? Icons.videocam_off_outlined
                                    : Icons.play_arrow_rounded,
                                size: 26,
                              ),
                              label: Text(
                                firstPlayable == null
                                    ? 'لا توجد حلقات متاحة للمشاهدة'
                                    : 'شاهد الآن • ${firstPlayable.title}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                        padding,
                        18,
                        padding,
                        0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.indigoSurface,
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.12),
                                  ),
                                ),
                                child: const Icon(
                                  Icons.auto_awesome_rounded,
                                  color: AppColors.starGold,
                                  size: 18,
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  widget.series.title,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              IconButton(
                                onPressed: () =>
                                    setState(() => _expanded = !_expanded),
                                tooltip: _expanded
                                    ? 'إخفاء التفاصيل'
                                    : 'عرض التفاصيل',
                                icon: Icon(
                                  _expanded
                                      ? Icons.expand_less_rounded
                                      : Icons.info_outline_rounded,
                                  color: Colors.white,
                                  size: 24,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 6,
                            runSpacing: 6,
                            children: [
                              const _MetaChip(label: 'مسلسل'),
                              _dot(),
                              _MetaChip(label: widget.series.planetName),
                              if (_episodeCountLabel(episodes.length) !=
                                  null) ...[
                                _dot(),
                                _MetaChip(
                                  label: _episodeCountLabel(episodes.length)!,
                                ),
                              ],
                              _dot(),
                              _MetaChip(
                                label: widget.series.isFree
                                    ? 'مجاني'
                                    : 'بالاشتراك',
                              ),
                              _dot(),
                              _MetaChip(label: '${widget.series.ageMin}+'),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Semantics(
                            button: true,
                            label: _expanded
                                ? 'إخفاء وصف المسلسل'
                                : 'عرض وصف المسلسل كاملًا',
                            child: Material(
                              color: Colors.transparent,
                              child: InkWell(
                                onTap: () =>
                                    setState(() => _expanded = !_expanded),
                                borderRadius: BorderRadius.circular(12),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 6,
                                  ),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        widget.series.description,
                                        maxLines: _expanded ? null : 2,
                                        overflow: _expanded
                                            ? TextOverflow.visible
                                            : TextOverflow.ellipsis,
                                        style: TextStyle(
                                          color: AppColors.mutedText.withValues(
                                            alpha: 0.88,
                                          ),
                                          fontSize: 13,
                                          height: 1.7,
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        children: [
                                          Icon(
                                            _expanded
                                                ? Icons
                                                      .keyboard_arrow_up_rounded
                                                : Icons
                                                      .keyboard_arrow_down_rounded,
                                            color: Colors.white,
                                            size: 20,
                                          ),
                                          const SizedBox(width: 4),
                                          Text(
                                            _expanded ? 'عرض أقل' : 'المزيد',
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Divider(
                            color: Colors.white.withValues(alpha: 0.08),
                            height: 1,
                          ),
                          const SizedBox(height: 14),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: _toggleWatchlist,
                                  icon: Icon(
                                    _inWatchlist
                                        ? Icons.check_rounded
                                        : Icons.add_rounded,
                                    color: _inWatchlist
                                        ? AppColors.starGold
                                        : Colors.white,
                                    size: 20,
                                  ),
                                  label: Text(
                                    _inWatchlist
                                        ? 'المسلسل محفوظ'
                                        : 'احفظ المسلسل',
                                    style: TextStyle(
                                      color: _inWatchlist
                                          ? AppColors.starGold
                                          : Colors.white,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(
                                      color:
                                          (_inWatchlist
                                                  ? AppColors.starGold
                                                  : Colors.white)
                                              .withValues(alpha: 0.4),
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(24),
                                    ),
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Tooltip(
                                message: 'مشاركة المسلسل',
                                child: Semantics(
                                  button: true,
                                  label: 'مشاركة المسلسل',
                                  child: Material(
                                    color: const Color(0xFF111A3A),
                                    shape: const CircleBorder(),
                                    child: InkWell(
                                      customBorder: const CircleBorder(),
                                      onTap: _share,
                                      child: const Padding(
                                        padding: EdgeInsets.all(12),
                                        child: Icon(
                                          Icons.share_rounded,
                                          color: Colors.white,
                                          size: 20,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 14),
                          Divider(
                            color: Colors.white.withValues(alpha: 0.08),
                            height: 1,
                          ),
                        ],
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                        padding,
                        16,
                        padding,
                        0,
                      ),
                      child: Row(
                        children: [
                          Text(
                            'الحلقات (${episodes.length})',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (episodes.isNotEmpty &&
                              playableEpisodes.length != episodes.length) ...[
                            const SizedBox(width: 8),
                            Text(
                              '${playableEpisodes.length} متاحة',
                              style: const TextStyle(
                                color: AppColors.mutedText,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                  if (episodes.isEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsetsDirectional.fromSTEB(
                          padding,
                          20,
                          padding,
                          0,
                        ),
                        child: const _EmptyEpisodes(),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: EdgeInsetsDirectional.fromSTEB(
                        padding,
                        12,
                        padding,
                        0,
                      ),
                      sliver: SliverList.separated(
                        itemCount: episodes.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final episode = episodes[index];
                          return _EpisodeTile(
                            episode: episode,
                            index: index + 1,
                            isFree: widget.series.isFree,
                            onTap: episode.isPlayable
                                ? () => _openPlayback(context, episode.id)
                                : null,
                          );
                        },
                      ),
                    ),
                  if (related.isNotEmpty)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: EdgeInsetsDirectional.symmetric(
                                horizontal: padding,
                              ),
                              child: Text(
                                'المزيد من ${widget.series.planetName}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              height: relatedRailHeight,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                padding: EdgeInsetsDirectional.symmetric(
                                  horizontal: padding,
                                ),
                                itemCount: related.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(width: 12),
                                itemBuilder: (context, index) {
                                  final series = related[index];
                                  return SeriesCard(
                                    item: series,
                                    isTelevision: widget.isTelevision,
                                    onPressed: () =>
                                        context.push('/series/${series.id}'),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  SliverToBoxAdapter(
                    child: SizedBox(height: widget.isTelevision ? 40 : 24),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<SeriesItem> _relatedByPlanet() {
    final planetId = widget.series.planetId;
    return widget.catalog.series
        .where((series) {
          if (series.id == widget.series.id) return false;
          if (planetId != null && series.planetId != null) {
            return series.planetId == planetId;
          }
          return series.planetName == widget.series.planetName;
        })
        .toList(growable: false);
  }

  static void _openPlayback(BuildContext context, String episodeId) {
    context.push('/playback/$episodeId');
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: AppColors.mutedText.withValues(alpha: 0.86),
          fontSize: 11,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

Widget _dot() => Container(
  width: 4,
  height: 4,
  decoration: BoxDecoration(
    color: AppColors.mutedText.withValues(alpha: 0.42),
    shape: BoxShape.circle,
  ),
);

class _EpisodeTile extends StatelessWidget {
  const _EpisodeTile({
    required this.episode,
    required this.index,
    required this.isFree,
    required this.onTap,
  });

  final EpisodeItem episode;
  final int index;
  final bool isFree;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final playable = episode.isPlayable && onTap != null;
    final foreground = playable ? Colors.white : AppColors.mutedText;

    return Semantics(
      button: playable,
      enabled: playable,
      label: playable
          ? 'تشغيل الحلقة $index، ${episode.title}'
          : 'الحلقة $index، ${episode.title}، غير متاحة للمشاهدة',
      child: Material(
        color: const Color(
          0xFF111A3A,
        ).withValues(alpha: playable ? 0.82 : 0.46),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: playable ? onTap : null,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
            ),
            child: Row(
              children: [
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: Opacity(
                        opacity: playable ? 1 : 0.5,
                        child: SizedBox(
                          width: 120,
                          height: 68,
                          child: CinematicImage(
                            networkUrl: episode.thumbnailUrl,
                            assetPath: episode.thumbnailAsset,
                            semanticLabel: episode.title,
                          ),
                        ),
                      ),
                    ),
                    Positioned.fill(
                      child: Center(
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(
                              alpha: playable ? 0.9 : 0.72,
                            ),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            playable
                                ? Icons.play_arrow_rounded
                                : Icons.videocam_off_outlined,
                            size: 18,
                            color: AppColors.deepSpace,
                          ),
                        ),
                      ),
                    ),
                    if (isFree && playable)
                      PositionedDirectional(
                        top: 4,
                        end: 4,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 5,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.success,
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: const Text(
                            'مجاني',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$index. ${episode.title}',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: foreground,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        playable ? episode.durationLabel : 'غير متاحة للمشاهدة',
                        style: TextStyle(
                          color: playable
                              ? AppColors.mutedText.withValues(alpha: 0.72)
                              : AppColors.mutedText,
                          fontSize: 11,
                          fontWeight: playable
                              ? FontWeight.w400
                              : FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  playable ? Icons.chevron_left_rounded : Icons.block_rounded,
                  color: AppColors.mutedText,
                  size: 22,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EmptyEpisodes extends StatelessWidget {
  const _EmptyEpisodes();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: const Column(
        children: [
          Icon(
            Icons.video_library_outlined,
            color: AppColors.mutedText,
            size: 36,
          ),
          SizedBox(height: 10),
          Text(
            'لا توجد حلقات منشورة لهذا المسلسل الآن',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.mutedText),
          ),
        ],
      ),
    );
  }
}

class _CatalogError extends StatelessWidget {
  const _CatalogError({required this.onRetry, required this.onBack});

  final VoidCallback onRetry;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.cloud_off_outlined,
                  color: AppColors.mutedText,
                  size: 64,
                ),
                const SizedBox(height: 18),
                Text(
                  'تعذّر تحميل تفاصيل المسلسل',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const Text(
                  'تحقق من الاتصال ثم حاول مرة أخرى.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                FilledButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('إعادة المحاولة'),
                ),
                TextButton(onPressed: onBack, child: const Text('العودة')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _MissingSeries extends StatelessWidget {
  const _MissingSeries({required this.onBack});

  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AnimatedBrandLogo(size: 108),
              const SizedBox(height: 24),
              Text(
                'لم نجد هذا المسلسل',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 10),
              const Text(
                'ربما لم يعد منشورًا أو أن الرابط غير صحيح.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 18),
              FilledButton(onPressed: onBack, child: const Text('العودة')),
            ],
          ),
        ),
      ),
    );
  }
}
