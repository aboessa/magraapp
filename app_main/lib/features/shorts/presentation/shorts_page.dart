import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../home/domain/content_models.dart';

/// فيديوهات قصيرة - Reels style vertical feed
class ShortsPage extends StatefulWidget {
  const ShortsPage({required this.catalog, required this.isTelevision, super.key});
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

  @override
  Widget build(BuildContext context) {
    if (widget.catalog.episodes.isEmpty) {
      return CinematicBackground(
        child: Center(child: Text('لا توجد فيديوهات قصيرة حالياً', style: TextStyle(color: AppColors.mutedText))),
      );
    }

    // استخدم الحلقات كفيديوهات قصيرة - كل حلقة = reel
    final shorts = widget.catalog.episodes;

    return CinematicBackground(
      child: Column(
        children: [
          // AppBar
          SafeArea(
            bottom: false,
            child: Padding(
              padding: EdgeInsetsDirectional.symmetric(horizontal: context.horizontalPagePadding, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.play_circle_rounded, color: AppColors.starGold, size: 22),
                  const SizedBox(width: 8),
                  Text('فيديوهات قصيرة', style: Theme.of(context).textTheme.titleLarge),
                  const Spacer(),
                  IconButton(onPressed: () {}, icon: const Icon(Icons.search_rounded, color: Colors.white)),
                ],
              ),
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _controller,
              scrollDirection: Axis.vertical,
              itemCount: shorts.length,
              onPageChanged: (i) => setState(() => _index = i),
              itemBuilder: (context, index) {
                final ep = shorts[index];
                return _ReelCard(
                  episode: ep,
                  isActive: index == _index,
                  isTelevision: widget.isTelevision,
                  onTap: () => context.push('/playback/${ep.id}'),
                );
              },
            ),
          ),
          // Progress dots + actions
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(shorts.length, (i) => Container(
                    width: i == _index ? 18 : 6,
                    height: 6,
                    margin: const EdgeInsets.symmetric(horizontal: 3),
                    decoration: BoxDecoration(
                      color: i == _index ? AppColors.starGold : Colors.white.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(99),
                    ),
                  )),
            ),
          ),
          const SizedBox(height: 6),
        ],
      ),
    );
  }
}

class _ReelCard extends StatelessWidget {
  const _ReelCard({required this.episode, required this.isActive, required this.isTelevision, required this.onTap});
  final EpisodeItem episode;
  final bool isActive;
  final bool isTelevision;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding;
    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 12),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.42), blurRadius: 28, offset: const Offset(0, 12))],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CinematicImage(networkUrl: episode.thumbnailUrl, assetPath: episode.thumbnailAsset, semanticLabel: episode.title, fit: BoxFit.cover),
              // Gradient scrim bottom
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Colors.black.withValues(alpha: 0.08), const Color(0xFF06091A).withValues(alpha: 0.82)], stops: const [0, 0.45, 1]),
                ),
              ),
              // Top badge
              PositionedDirectional(
                top: 12,
                start: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.starGold, borderRadius: BorderRadius.circular(6)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.bolt_rounded, size: 12, color: AppColors.deepSpace), const SizedBox(width: 4), Text(episode.durationLabel, style: const TextStyle(color: AppColors.deepSpace, fontSize: 10, fontWeight: FontWeight.w800))]),
                ),
              ),
              // Center play
              Center(
                child: Container(
                  width: isTelevision ? 64 : 52,
                  height: isTelevision ? 64 : 52,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.92), shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.28), blurRadius: 16)]),
                  child: Icon(Icons.play_arrow_rounded, size: isTelevision ? 36 : 30, color: AppColors.deepSpace),
                ),
              ),
              // Side actions - like reels
              PositionedDirectional(
                end: 12,
                bottom: 90,
                child: Column(
                  children: [
                    // Counts previously read '1.2k' and '86'. There are no
                    // likes or comments endpoints, so no totals are shown.
                    _ReelAction(icon: Icons.favorite_border_rounded, label: 'إعجاب', onTap: () {}),
                    const SizedBox(height: 14),
                    _ReelAction(icon: Icons.chat_bubble_outline_rounded, label: 'تعليق', onTap: () {}),
                    const SizedBox(height: 14),
                    _ReelAction(icon: Icons.share_rounded, label: 'مشاركة', onTap: () {}),
                    const SizedBox(height: 14),
                    _ReelAction(icon: Icons.bookmark_border_rounded, label: 'حفظ', onTap: () {}),
                  ],
                ),
              ),
              // Bottom info
              PositionedDirectional(
                start: 12,
                end: 64,
                bottom: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(episode.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800, shadows: [Shadow(color: Colors.black87, blurRadius: 8)])),
                    const SizedBox(height: 4),
                    Text(episode.seriesTitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.82), fontSize: 11)),
                    const SizedBox(height: 6),
                    Row(children: [Container(width: 22, height: 22, decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.indigoSurface, border: Border.all(color: Colors.white.withValues(alpha: 0.14))), child: const Icon(Icons.person_rounded, size: 12, color: Colors.white)), const SizedBox(width: 6), Text('مجرة • ${episode.seriesTitle}', style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 10))]),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ReelAction extends StatelessWidget {
  const _ReelAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.12), shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: 0.14))),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
