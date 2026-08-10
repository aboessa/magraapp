import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/device/device_profile.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/animated_brand_logo.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../home/application/home_providers.dart';
import 'package:share_plus/share_plus.dart';

import '../../home/domain/content_models.dart';
import '../../home/presentation/widgets/content_cards.dart';
import '../../profile/data/watchlist_store.dart';

class SeriesDetailsPage extends ConsumerWidget {
  const SeriesDetailsPage({required this.seriesId, super.key});

  final String seriesId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isTelevision = ref.watch(deviceProfileProvider).maybeWhen(data: (p) => p.isTelevision, orElse: () => false);
    final catalog = ref.watch(homeCatalogProvider);

    return catalog.when(
      loading: () => const Scaffold(body: BrandLoadingView()),
      error: (_, __) => _MissingSeries(onBack: () => _back(context)),
      data: (value) {
        final series = value.seriesById(seriesId);
        if (series == null) return _MissingSeries(onBack: () => _back(context));
        return _SeriesDetailsContent(catalog: value, series: series, isTelevision: isTelevision);
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
  const _SeriesDetailsContent({required this.catalog, required this.series, required this.isTelevision});
  final HomeCatalog catalog;
  final SeriesItem series;
  final bool isTelevision;

  @override
  ConsumerState<_SeriesDetailsContent> createState() => _SeriesDetailsContentState();
}

class _SeriesDetailsContentState extends ConsumerState<_SeriesDetailsContent> {
  bool _expanded = false;

  /// Whether this series is saved, read from the persisted watchlist rather than
  /// from local widget state.
  bool get _inWatchlist => ref.watch(watchlistProvider).contains(widget.series.id);

  /// Returns a real episode-count label, or null when the count is unknown.
  ///
  /// `series.episodesCount` is the count declared by the catalogue; [loaded] is
  /// how many episode records actually arrived. Neither is invented.
  String? _episodeCountLabel(int loaded) {
    final declared = widget.series.episodesCount;
    final count = declared > 0 ? declared : loaded;
    if (count <= 0) return null;
    return count == 1 ? 'حلقة واحدة' : '$count حلقة';
  }

  void _toggleWatchlist() {
    HapticFeedback.selectionClick();
    // Persisted on the device via WatchlistStore, so the watchlist page shows
    // what the user actually saved. Previously this only flipped a local bool,
    // which was lost as soon as the page was popped.
    final added = !ref.read(watchlistProvider).contains(widget.series.id);
    ref.read(watchlistProvider.notifier).toggle(widget.series.id);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(added ? 'تمت الإضافة إلى قائمتي' : 'تمت الإزالة من قائمتي')));
  }

  void _share() {
    // OS share sheet with descriptive text. No public deep link is invented;
    // the app has no confirmed public web URL scheme for content yet.
    Share.share('شاهد "${widget.series.title}" على تطبيق مجرة');
  }

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding + (widget.isTelevision ? 18 : 0);
    // NOTE: this page does not yet adapt its layout by size class. A `compact`
    // value was computed here and never used. Responsive treatment for the
    // details page is tracked as Phase 1 work (AUDIT_FLUTTER_APP.md §6.5).
    final episodes = widget.catalog.episodesFor(widget.series.id);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            // Hero image with close button
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 0),
                child: Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(18),
                      child: AspectRatio(
                        aspectRatio: widget.isTelevision ? 2.4 : 1.82,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            CinematicImage(networkUrl: widget.series.coverUrl, assetPath: widget.series.bannerAsset, semanticLabel: widget.series.title),
                            DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black.withValues(alpha: 0.08), Colors.transparent, Colors.black.withValues(alpha: 0.22)]))),
                          ],
                        ),
                      ),
                    ),
                    PositionedDirectional(
                      top: 10,
                      start: 10,
                      child: Material(
                        color: Colors.black.withValues(alpha: 0.42),
                        shape: const CircleBorder(),
                        child: InkWell(
                          customBorder: const CircleBorder(),
                          onTap: () => Navigator.of(context).canPop() ? context.pop() : context.go('/'),
                          child: const Padding(padding: EdgeInsets.all(10), child: Icon(Icons.close_rounded, color: Colors.white, size: 20)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Title logo + Watch button
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 14, padding, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Title plate. The eyebrow and footer previously carried
                    // branding inherited from a different product; they now show
                    // real series metadata (planet + age range) instead.
                    Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [AppColors.cosmicPurple.withValues(alpha: 0.14), AppColors.starGold.withValues(alpha: 0.08)]),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
                        ),
                        child: Column(
                          children: [
                            Text(widget.series.planetName, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 1)),
                            Text(
                              widget.series.title,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: widget.isTelevision ? 30 : 24,
                                fontWeight: FontWeight.w900,
                                height: 1.15,
                                shadows: [Shadow(color: Colors.black.withValues(alpha: 0.5), blurRadius: 12)],
                              ),
                            ),
                            Text(widget.series.ageLabel, style: const TextStyle(color: AppColors.starGold, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    // Watch now pill - full width
                    SizedBox(
                      height: 52,
                      child: FilledButton.icon(
                        onPressed: () {
                          final firstEp = episodes.isNotEmpty ? episodes.first.id : '';
                          if (firstEp.isNotEmpty) {
                            _openPlayback(context, firstEp);
                          } else {
                            _notPublished(context);
                          }
                        },
                        style: FilledButton.styleFrom(backgroundColor: const Color(0xFF2A3447), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
                        icon: const Icon(Icons.play_arrow_rounded, size: 26),
                        label: Text(episodes.isEmpty ? 'شاهد الآن' : 'شاهد الآن • ${episodes.first.title}', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Info row
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 18, padding, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.indigoSurface, border: Border.all(color: Colors.white.withValues(alpha: 0.12))),
                          child: const Icon(Icons.auto_awesome_rounded, color: AppColors.starGold, size: 16),
                        ),
                        const SizedBox(width: 10),
                        Expanded(child: Text(widget.series.title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800))),
                        IconButton(
                          onPressed: () => setState(() => _expanded = !_expanded),
                          tooltip: _expanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل',
                          icon: const Icon(Icons.info_outline_rounded, color: Colors.white, size: 22),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    // Metadata chips. These previously showed genre labels and
                    // a weekly release cadence inherited from a different
                    // product. Majarra has no genre or cadence field, so only
                    // real model data is shown here.
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 6,
                      runSpacing: 6,
                      children: [
                        const _MetaChip(label: 'مسلسل'),
                        _dot(),
                        _MetaChip(label: widget.series.planetName),
                        if (_episodeCountLabel(episodes.length) != null) ...[
                          _dot(),
                          _MetaChip(label: _episodeCountLabel(episodes.length)!),
                        ],
                        _dot(),
                        _MetaChip(label: widget.series.isFree ? 'مجاني' : 'بالاشتراك'),
                        _dot(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(6), border: Border.all(color: Colors.white.withValues(alpha: 0.12))),
                          child: Text('${widget.series.ageMin}+', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Description expandable
                    GestureDetector(
                      onTap: () => setState(() => _expanded = !_expanded),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.series.description,
                            maxLines: _expanded ? null : 2,
                            overflow: _expanded ? TextOverflow.visible : TextOverflow.ellipsis,
                            style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.82), fontSize: 12.5, height: 1.7),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            children: [
                              Icon(_expanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded, color: Colors.white, size: 18),
                              const SizedBox(width: 4),
                              Text(_expanded ? 'عرض أقل' : 'المزيد', style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Divider(color: Colors.white.withValues(alpha: 0.08), height: 1),
                    const SizedBox(height: 14),
                    // Actions: watchlist (persisted, real) + OS share. Like and
                    // comments were removed — there is no likes endpoint, and
                    // child comments require a separate moderation/safety
                    // decision, so neither is shown rather than faked.
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _toggleWatchlist,
                            icon: Icon(
                              _inWatchlist ? Icons.check_rounded : Icons.add_rounded,
                              color: _inWatchlist ? AppColors.starGold : Colors.white,
                              size: 20,
                            ),
                            label: Text(
                              _inWatchlist ? 'في قائمتي' : 'أضف إلى قائمتي',
                              style: TextStyle(
                                color: _inWatchlist ? AppColors.starGold : Colors.white,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(
                                color: (_inWatchlist ? AppColors.starGold : Colors.white)
                                    .withValues(alpha: 0.4),
                              ),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Material(
                          color: const Color(0xFF111A3A),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _share,
                            child: const Padding(padding: EdgeInsets.all(12), child: Icon(Icons.share_rounded, color: Colors.white, size: 20)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Divider(color: Colors.white.withValues(alpha: 0.08), height: 1),
                  ],
                ),
              ),
            ),

            // Episodes — a real section, not tabs. The previous three-tab layout
            // had two placeholder tabs ("الإعلانات المشوقة" / "أعمال") that only
            // ever showed "قريباً"; there is no trailer or bundle data to fill
            // them, so they are removed rather than shown empty.
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 16, padding, 0),
                child: Row(
                  children: [
                    Text('الحلقات (${episodes.length})',
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
            ),
            if (episodes.isEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(padding, 20, padding, 0),
                  child: Text('الحلقات قادمة قريباً', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.8))),
                ),
              )
            else
              SliverPadding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 0),
                sliver: SliverList.separated(
                  itemCount: episodes.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (context, idx) {
                    final ep = episodes[idx];
                    return _EpisodeTile(
                      episode: ep,
                      index: idx + 1,
                      isFree: widget.series.isFree,
                      onTap: () => _openPlayback(context, ep.id),
                    );
                  },
                ),
              ),

            // About section
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 22, padding, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('عن السلسلة', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(widget.series.description, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.82), fontSize: 12.5, height: 1.6)),
                  ],
                ),
              ),
            ),

            // From the same planet — a real relation, not a "first N series"
            // fill. Series are related when they share a planet (by id, or by
            // name as a fallback for local catalogue rows). When nothing shares
            // the planet the section is hidden rather than padded with unrelated
            // titles.
            if (_relatedByPlanet().isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
                        child: Text('المزيد من ${widget.series.planetName}',
                            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: widget.isTelevision ? 220 : 190,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
                          itemCount: _relatedByPlanet().length,
                          separatorBuilder: (_, __) => const SizedBox(width: 12),
                          itemBuilder: (context, idx) {
                            final s = _relatedByPlanet()[idx];
                            return SeriesCard(item: s, isTelevision: widget.isTelevision, onPressed: () => context.push('/series/${s.id}'));
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            SliverToBoxAdapter(child: SizedBox(height: widget.isTelevision ? 40 : 24)),
          ],
        ),
      ),
    );
  }

  /// Series sharing this one's planet, excluding itself. Matches on planet id
  /// when present, else on planet name for local-catalogue rows.
  List<SeriesItem> _relatedByPlanet() {
    final planetId = widget.series.planetId;
    return widget.catalog.series.where((s) {
      if (s.id == widget.series.id) return false;
      if (planetId != null && s.planetId != null) return s.planetId == planetId;
      return s.planetName == widget.series.planetName;
    }).toList(growable: false);
  }

  static void _notPublished(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('الفيديو غير منشور بعد. سيعمل زر المشاهدة تلقائيًا عند إتاحة الحلقة.')));
  }

  /// Single entry point to the player. Both the hero "watch now" button and the
  /// episode list route through here so the playback path exists in one place.
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
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.07), borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.82), fontSize: 11, fontWeight: FontWeight.w500)),
    );
  }
}

Widget _dot() => Container(width: 4, height: 4, decoration: BoxDecoration(color: AppColors.mutedText.withValues(alpha: 0.42), shape: BoxShape.circle));

class _EpisodeTile extends StatelessWidget {
  const _EpisodeTile({required this.episode, required this.index, required this.isFree, required this.onTap});
  final EpisodeItem episode;
  final int index;
  final bool isFree;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF111A3A).withValues(alpha: 0.72),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
          child: Row(
            children: [
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SizedBox(
                      width: 120,
                      height: 68,
                      child: CinematicImage(networkUrl: episode.thumbnailUrl, assetPath: episode.thumbnailAsset, semanticLabel: episode.title),
                    ),
                  ),
                  Positioned.fill(child: Center(child: Container(width: 28, height: 28, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.88), shape: BoxShape.circle), child: const Icon(Icons.play_arrow_rounded, size: 18, color: AppColors.deepSpace)))),
                  // The badge previously read 'مجاني' on every episode
                  // regardless of the series' is_free flag.
                  if (isFree)
                    PositionedDirectional(
                      top: 4,
                      end: 4,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(color: AppColors.success, borderRadius: BorderRadius.circular(5)),
                        child: const Text('مجاني', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w800)),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('$index. ${episode.title}', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(episode.durationLabel, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11)),
                  ],
                ),
              ),
              // Per-episode download was a "coming soon" no-op. Video is
              // protected content and offline playback needs a backend offline
              // licence endpoint that does not exist yet, so a real download
              // cannot be offered here; the fake affordance is removed. A play
              // chevron remains as the affordance to open the episode.
              const Icon(Icons.chevron_left_rounded, color: AppColors.mutedText, size: 22),
            ],
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
    return Scaffold(body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const AnimatedBrandLogo(size: 108), const SizedBox(height: 24), Text('لم نجد هذه السلسلة', style: Theme.of(context).textTheme.headlineMedium), const SizedBox(height: 18), FilledButton(onPressed: onBack, child: const Text('العودة'))])));
  }
}
