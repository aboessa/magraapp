import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../home/domain/content_models.dart';
import '../../profile/data/watchlist_store.dart';

/// A vertical feed of playable episode clips.
///
/// The catalogue has no independent short-form content type yet, so this surface
/// is deliberately named "episode clips" and never claims that every episode is
/// a short. Unpublished episodes are excluded rather than opening a dead player.
class ShortsPage extends StatefulWidget {
  const ShortsPage({
    required this.catalog,
    required this.isTelevision,
    super.key,
  });

  final HomeCatalog catalog;
  final bool isTelevision;

  @override
  State<ShortsPage> createState() => _ShortsPageState();
}

class _ShortsPageState extends State<ShortsPage> {
  final PageController _controller = PageController();
  int _index = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _moveBy(int delta, int itemCount) {
    final target = _index + delta;
    if (target < 0 || target >= itemCount || !_controller.hasClients) return;
    _controller.animateToPage(
      target,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final clips = widget.catalog.episodes
        .where((episode) => episode.isPlayable)
        .toList(growable: false);

    if (clips.isEmpty) {
      return CinematicBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.video_library_outlined,
                  color: AppColors.mutedText,
                  size: 52,
                ),
                const SizedBox(height: 14),
                Text(
                  'لا توجد مقاطع حلقات متاحة للمشاهدة حاليًا',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.mutedText),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return CinematicBackground(
      child: Column(
        children: [
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: context.horizontalPagePadding,
                vertical: 10,
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.play_circle_rounded,
                    color: AppColors.starGold,
                    size: 22,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'مقاطع الحلقات',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: CallbackShortcuts(
              bindings: <ShortcutActivator, VoidCallback>{
                const SingleActivator(LogicalKeyboardKey.arrowUp): () =>
                    _moveBy(-1, clips.length),
                const SingleActivator(LogicalKeyboardKey.arrowDown): () =>
                    _moveBy(1, clips.length),
                const SingleActivator(LogicalKeyboardKey.enter): () {
                  context.push('/playback/${clips[_index].id}');
                },
              },
              child: Focus(
                autofocus: widget.isTelevision,
                child: PageView.builder(
                  controller: _controller,
                  scrollDirection: Axis.vertical,
                  itemCount: clips.length,
                  onPageChanged: (index) => setState(() => _index = index),
                  itemBuilder: (context, index) {
                    final episode = clips[index];
                    return _ReelCard(
                      episode: episode,
                      isActive: index == _index,
                      isTelevision: widget.isTelevision,
                      onTap: () => context.push('/playback/${episode.id}'),
                    );
                  },
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(24, 8, 24, 6),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 320),
                child: Semantics(
                  label: 'المقطع ${_index + 1} من ${clips.length}',
                  value: '${_index + 1} من ${clips.length}',
                  child: Column(
                    children: [
                      LinearProgressIndicator(
                        value: (_index + 1) / clips.length,
                        minHeight: 6,
                        borderRadius: BorderRadius.circular(99),
                        color: AppColors.starGold,
                        backgroundColor: Colors.white.withValues(alpha: 0.16),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${_index + 1} / ${clips.length}',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.68),
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReelCard extends StatelessWidget {
  const _ReelCard({
    required this.episode,
    required this.isActive,
    required this.isTelevision,
    required this.onTap,
  });

  final EpisodeItem episode;
  final bool isActive;
  final bool isTelevision;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding;
    final radius = BorderRadius.circular(20);

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: radius,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.42),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: Semantics(
          button: true,
          selected: isActive,
          label: 'تشغيل ${episode.title} من ${episode.seriesTitle}',
          child: Material(
            color: Colors.transparent,
            borderRadius: radius,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              borderRadius: radius,
              child: Container(
                foregroundDecoration: BoxDecoration(
                  borderRadius: radius,
                  border: Border.all(
                    color: isActive && isTelevision
                        ? AppColors.starGold.withValues(alpha: 0.72)
                        : Colors.white.withValues(alpha: 0.08),
                    width: isActive && isTelevision ? 2 : 1,
                  ),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CinematicImage(
                      networkUrl: episode.thumbnailUrl,
                      assetPath: episode.thumbnailAsset,
                      semanticLabel: episode.title,
                      fit: BoxFit.cover,
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.08),
                            const Color(0xFF06091A).withValues(alpha: 0.82),
                          ],
                          stops: const [0, 0.45, 1],
                        ),
                      ),
                    ),
                    PositionedDirectional(
                      top: 12,
                      start: 12,
                      child: IgnorePointer(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.starGold,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.bolt_rounded,
                                size: 12,
                                color: AppColors.deepSpace,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                episode.durationLabel,
                                style: const TextStyle(
                                  color: AppColors.deepSpace,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    Center(
                      child: IgnorePointer(
                        child: Container(
                          width: isTelevision ? 64 : 52,
                          height: isTelevision ? 64 : 52,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.28),
                                blurRadius: 16,
                              ),
                            ],
                          ),
                          child: Icon(
                            Icons.play_arrow_rounded,
                            size: isTelevision ? 36 : 30,
                            color: AppColors.deepSpace,
                          ),
                        ),
                      ),
                    ),
                    PositionedDirectional(
                      end: 12,
                      bottom: 90,
                      child: _ReelActions(episode: episode),
                    ),
                    PositionedDirectional(
                      start: 12,
                      end: 64,
                      bottom: 14,
                      child: IgnorePointer(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              episode.title,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                shadows: [
                                  Shadow(color: Colors.black87, blurRadius: 8),
                                ],
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              episode.seriesTitle,
                              style: TextStyle(
                                color: AppColors.mutedText.withValues(
                                  alpha: 0.82,
                                ),
                                fontSize: 11,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                Container(
                                  width: 22,
                                  height: 22,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.indigoSurface,
                                    border: Border.all(
                                      color: Colors.white.withValues(
                                        alpha: 0.14,
                                      ),
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.person_rounded,
                                    size: 12,
                                    color: Colors.white,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'مجرة • ${episode.seriesTitle}',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.7),
                                    fontSize: 10,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The two real side actions on a reel: Save and Share.
class _ReelActions extends ConsumerWidget {
  const _ReelActions({required this.episode});

  final EpisodeItem episode;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(watchlistProvider).contains(episode.seriesId);
    return Column(
      children: [
        _ReelAction(
          icon: saved ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
          label: saved ? 'محفوظ' : 'حفظ',
          highlighted: saved,
          onTap: () async {
            await ref.read(watchlistProvider.notifier).toggle(episode.seriesId);
            if (!context.mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  saved ? 'تمت إزالة المسلسل من المحفوظات' : 'تم حفظ المسلسل',
                ),
                duration: const Duration(seconds: 1),
              ),
            );
          },
        ),
        const SizedBox(height: 14),
        _ReelAction(
          icon: Icons.share_rounded,
          label: 'مشاركة',
          onTap: () {
            Share.share(
              'شاهد "${episode.title}" من ${episode.seriesTitle} على تطبيق مجرة',
              subject: episode.title,
            );
          },
        ),
      ],
    );
  }
}

class _ReelAction extends StatelessWidget {
  const _ReelAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final foreground = highlighted ? AppColors.starGold : Colors.white;

    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Column(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.18),
                  ),
                ),
                child: Icon(icon, color: foreground, size: 20),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: foreground,
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
