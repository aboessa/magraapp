import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';

/// Content Rail - premium cinematic horizontal rail
/// - Title on right RTL with arrow "<"
/// - Clean spacing, no heavy dividers
/// - Horizontal scroll with snap-like feel
class ContentRail<T> extends StatelessWidget {
  const ContentRail({
    required this.title,
    required this.items,
    required this.itemBuilder,
    required this.height,
    required this.horizontalPadding,
    this.subtitle,
    this.onSeeAll,
    this.isTelevision = false,
    super.key,
  });

  final String title;
  final String? subtitle;
  final List<T> items;
  final Widget Function(BuildContext context, T item, int index) itemBuilder;
  final double height;
  final double horizontalPadding;
  final VoidCallback? onSeeAll;

  /// Switches to clamping physics so a D-pad focus change does not fight the
  /// iOS-style bounce, and keeps the whole rail in one traversal group.
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Semantics(
      container: true,
      label: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header - title on right with arrow
          Padding(
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: horizontalPadding,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Flexible(
                        child: Text(
                          title,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                            height: 1.2,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Icon(
                        Icons.chevron_left_rounded,
                        color: Colors.white.withValues(alpha: 0.62),
                        size: 20,
                      ),
                    ],
                  ),
                ),
                if (onSeeAll != null)
                  InkWell(
                    onTap: onSeeAll,
                    borderRadius: BorderRadius.circular(8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      child: Row(
                        children: [
                          Text(
                            'عرض الكل',
                            style: TextStyle(
                              color: AppColors.mutedText.withValues(alpha: 0.75),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: 2),
                          Icon(
                            Icons.arrow_back_rounded,
                            size: 16,
                            color: AppColors.mutedText.withValues(alpha: 0.6),
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Padding(
              padding: EdgeInsetsDirectional.symmetric(
                horizontal: horizontalPadding,
              ),
              child: Text(
                subtitle!,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.62),
                  fontSize: 11.5,
                  fontWeight: FontWeight.w400,
                ),
              ),
            ),
          ],
          const SizedBox(height: 14),
          SizedBox(
            height: height,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: EdgeInsetsDirectional.fromSTEB(
                horizontalPadding,
                4,
                horizontalPadding,
                18,
              ),
              cacheExtent: 1000,
              // Bounce fights D-pad focus scrolling on a remote, so TV uses
              // clamping physics instead.
              physics: isTelevision
                  ? const ClampingScrollPhysics()
                  : const BouncingScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(width: 12),
              itemBuilder: (context, index) =>
                  itemBuilder(context, items[index], index),
            ),
          ),
        ],
      ),
    );
  }
}

/// Cinematic featured banner - like "هايكيو !!" banner in screenshots
class FeaturedBannerCard extends StatelessWidget {
  const FeaturedBannerCard({
    required this.title,
    required this.description,
    required this.imageAsset,
    required this.onPlay,
    super.key,
  });

  final String title;
  final String description;
  final String imageAsset;
  final VoidCallback onPlay;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 320,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.42),
            blurRadius: 32,
            offset: const Offset(0, 16),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.asset(
            imageAsset,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              color: AppColors.indigoSurface,
            ),
          ),
          // Cinematic scrim - bottom heavy
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.22),
                  const Color(0xFF06091A).withValues(alpha: 0.88),
                  const Color(0xFF06091A),
                ],
                stops: const [0, 0.38, 0.72, 1],
              ),
            ),
          ),
          // Content bottom
          PositionedDirectional(
            start: 20,
            end: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    shadows: [Shadow(color: Colors.black87, blurRadius: 10)],
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.82),
                    fontSize: 12.5,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 48,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.18),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: InkWell(
                          onTap: onPlay,
                          borderRadius: BorderRadius.circular(24),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.play_arrow_rounded,
                                color: Color(0xFF0B1026),
                                size: 26,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'شاهد الآن',
                                style: TextStyle(
                                  color: const Color(0xFF0B1026),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.18),
                        ),
                      ),
                      child: const Icon(
                        Icons.add_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
