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
import '../../home/domain/content_models.dart';
import '../../home/presentation/widgets/content_cards.dart';

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

class _SeriesDetailsContent extends StatefulWidget {
  const _SeriesDetailsContent({required this.catalog, required this.series, required this.isTelevision});
  final HomeCatalog catalog;
  final SeriesItem series;
  final bool isTelevision;

  @override
  State<_SeriesDetailsContent> createState() => _SeriesDetailsContentState();
}

class _SeriesDetailsContentState extends State<_SeriesDetailsContent> {
  bool _liked = false;
  bool _inWatchlist = false;
  bool _expanded = false;

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

  void _toggleLike() {
    HapticFeedback.lightImpact();
    // Local-only preference. There is no likes endpoint in the API, so no
    // aggregate count is shown: a fabricated total would be invented social
    // proof. See AUDIT_FLUTTER_APP.md §7.2.
    setState(() => _liked = !_liked);
  }

  void _toggleWatchlist() {
    HapticFeedback.selectionClick();
    setState(() => _inWatchlist = !_inWatchlist);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_inWatchlist ? 'تمت الإضافة إلى قائمتي' : 'تمت الإزالة من قائمتي')));
  }

  void _share() {
    Clipboard.setData(ClipboardData(text: 'شاهد ${widget.series.title} على مجرة'));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم نسخ رابط المشاركة')));
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
                            context.push('/playback/$firstEp');
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
                    // Actions: like/share/watchlist
                    Row(
                      children: [
                        // Like + comment
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(color: const Color(0xFF111A3A), borderRadius: BorderRadius.circular(24), border: Border.all(color: Colors.white.withValues(alpha: 0.08))),
                          child: Row(
                            children: [
                              InkWell(
                                onTap: _toggleLike,
                                borderRadius: BorderRadius.circular(20),
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                  child: Row(
                                    children: [
                                      Icon(_liked ? Icons.thumb_up_rounded : Icons.thumb_up_outlined, color: _liked ? AppColors.starGold : Colors.white, size: 18),
                                      const SizedBox(width: 6),
                                      Text(_liked ? 'أعجبني' : 'إعجاب', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                ),
                              ),
                              Container(width: 1, height: 16, color: Colors.white.withValues(alpha: 0.12), margin: const EdgeInsets.symmetric(horizontal: 10)),
                              InkWell(
                                onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('التعليقات قادمة قريباً'))),
                                child: Row(children: [const Icon(Icons.chat_bubble_outline_rounded, color: Colors.white, size: 18), const SizedBox(width: 6), Text('تعليقات', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.8), fontSize: 12))]),
                              ),
                            ],
                          ),
                        ),
                        const Spacer(),
                        // Share + Watchlist
                        Material(
                          color: const Color(0xFF111A3A),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _share,
                            child: const Padding(padding: EdgeInsets.all(11), child: Icon(Icons.share_rounded, color: Colors.white, size: 20)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Material(
                          color: _inWatchlist ? AppColors.starGold : const Color(0xFF111A3A),
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _toggleWatchlist,
                            child: Padding(
                              padding: const EdgeInsets.all(11),
                              child: Icon(_inWatchlist ? Icons.check_rounded : Icons.add_rounded, color: _inWatchlist ? AppColors.deepSpace : Colors.white, size: 20),
                            ),
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

            // Tabs: الحلقات / الإعلانات / أعمال
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 14, padding, 0),
                child: DefaultTabController(
                  length: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: TabBar(
                              isScrollable: true,
                              tabAlignment: TabAlignment.start,
                              labelColor: Colors.white,
                              unselectedLabelColor: AppColors.mutedText.withValues(alpha: 0.6),
                              indicatorColor: AppColors.starGold,
                              indicatorWeight: 3,
                              dividerColor: Colors.transparent,
                              labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                              unselectedLabelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                              tabs: [
                                Tab(text: 'الحلقات (${episodes.length})'),
                                const Tab(text: 'الإعلانات المشوقة'),
                                const Tab(text: 'أعمال'),
                              ],
                            ),
                          ),
                          Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(color: const Color(0xFF111A3A), borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.white.withValues(alpha: 0.08))),
                            child: const Icon(Icons.swap_vert_rounded, color: Colors.white, size: 18),
                          ),
                        ],
                      ),
                      Container(height: 1, color: Colors.white.withValues(alpha: 0.06), margin: const EdgeInsets.only(top: 8)),
                      SizedBox(
                        height: widget.isTelevision ? 360 : 300,
                        child: TabBarView(
                          children: [
                            // الحلقات list
                            episodes.isEmpty
                                ? Center(child: Text('الحلقات قادمة قريباً', style: TextStyle(color: AppColors.mutedText)))
                                : ListView.separated(
                                    padding: const EdgeInsets.only(top: 14, bottom: 12),
                                    itemCount: episodes.length,
                                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                                    itemBuilder: (context, idx) {
                                      final ep = episodes[idx];
                                      return _EpisodeTile(
                                        episode: ep,
                                        index: idx + 1,
                                        isFree: widget.series.isFree,
                                        onTap: () => context.push('/playback/${ep.id}'),
                                        onDownload: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('التحميل قادم قريباً'))),
                                      );
                                    },
                                  ),
                            Center(child: Text('الإعلانات قريباً', style: TextStyle(color: AppColors.mutedText))),
                            Center(child: Text('أعمال مشابهة قريباً', style: TextStyle(color: AppColors.mutedText))),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
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

            // More like this
            if (widget.catalog.series.length > 1)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 22),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
                        child: const Text('المزيد مثل هذا', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: widget.isTelevision ? 220 : 190,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          padding: EdgeInsetsDirectional.symmetric(horizontal: padding),
                          itemCount: widget.catalog.series.take(6).length,
                          separatorBuilder: (_, __) => const SizedBox(width: 12),
                          itemBuilder: (context, idx) {
                            final s = widget.catalog.series[idx];
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

  static void _notPublished(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('الفيديو غير منشور بعد. سيعمل زر المشاهدة تلقائيًا عند إتاحة الحلقة.')));
  }

  /// RETAINED, CURRENTLY UNREFERENCED (analyzer: unused_element).
  ///
  /// Kept deliberately during Phase 0 stabilisation rather than deleted: the
  /// two call sites currently inline `context.push('/playback/...')`. Either
  /// route both call sites through this helper or delete it once the real
  /// player lands (AUDIT_FLUTTER_APP.md §9 H1).
  void _openPlayback(BuildContext context, String episodeId) {
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
  const _EpisodeTile({required this.episode, required this.index, required this.isFree, required this.onTap, required this.onDownload});
  final EpisodeItem episode;
  final int index;
  final bool isFree;
  final VoidCallback onTap;
  final VoidCallback onDownload;

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
              IconButton(onPressed: onDownload, icon: const Icon(Icons.download_rounded, color: Colors.white, size: 20)),
              const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.mutedText, size: 20),
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
