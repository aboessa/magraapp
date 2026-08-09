import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../core/widgets/focusable_scale.dart';
import 'home_v2_tokens.dart';

/// Horizontal rail for the v2 home.
///
/// Differences from the v1 `ContentRail` this replaces:
///  * geometry comes from [HomeV2Metrics] instead of per-call-site literals
///  * the whole rail is one [FocusTraversalGroup], so a D-pad moves along a rail
///    and jumps to the next rail rather than snaking diagonally
///  * `cacheExtent` scales with card width instead of a fixed 1000px
class HomeRail extends StatelessWidget {
  const HomeRail({
    required this.title,
    required this.metrics,
    required this.itemCount,
    required this.itemBuilder,
    required this.height,
    this.subtitle,
    this.onSeeAll,
    super.key,
  });

  final String title;
  final String? subtitle;
  final HomeV2Metrics metrics;
  final int itemCount;
  final Widget Function(BuildContext context, int index) itemBuilder;
  final double height;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    if (itemCount == 0) return const SizedBox.shrink();
    final isTv = metrics.isTelevision;

    return FocusTraversalGroup(
      policy: ReadingOrderTraversalPolicy(),
      child: Semantics(
        container: true,
        label: title,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: EdgeInsetsDirectional.only(
                start: metrics.pagePadding,
                end: metrics.pagePadding,
                bottom: isTv ? 14 : 10,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: metrics.railTitleSize,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        if (subtitle != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              subtitle!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: AppColors.mutedText.withValues(
                                  alpha: 0.78,
                                ),
                                fontSize: isTv ? 13 : 11.5,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (onSeeAll != null)
                    _SeeAllButton(onPressed: onSeeAll!, isTv: isTv),
                ],
              ),
            ),
            SizedBox(
              height: height,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: EdgeInsetsDirectional.only(
                  start: metrics.pagePadding,
                  end: metrics.pagePadding,
                ),
                // Roughly three cards of pre-render on either side.
                cacheExtent: metrics.posterWidth * 3,
                physics: isTv
                    ? const ClampingScrollPhysics()
                    : const BouncingScrollPhysics(),
                itemCount: itemCount,
                separatorBuilder: (_, __) => SizedBox(width: metrics.railGap),
                itemBuilder: itemBuilder,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SeeAllButton extends StatelessWidget {
  const _SeeAllButton({required this.onPressed, required this.isTv});

  final VoidCallback onPressed;
  final bool isTv;

  @override
  Widget build(BuildContext context) {
    return FocusableScale(
      onPressed: onPressed,
      semanticLabel: 'عرض الكل',
      borderRadius: BorderRadius.circular(99),
      focusScale: 1.08,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'عرض الكل',
              style: TextStyle(
                color: AppColors.electricCyan,
                fontSize: isTv ? 13 : 11.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 3),
            Icon(
              Icons.chevron_left_rounded,
              size: isTv ? 20 : 17,
              color: AppColors.electricCyan,
            ),
          ],
        ),
      ),
    );
  }
}

/// Portrait poster card with the caption *below* the artwork.
///
/// v1 overlaid the title on the poster, which fought the artwork and clipped at
/// large text scales. Separating them keeps the image clean and lets titles wrap
/// to two lines without covering faces.
class PosterCard extends StatelessWidget {
  const PosterCard({
    required this.title,
    required this.meta,
    required this.assetPath,
    required this.metrics,
    required this.onPressed,
    this.networkUrl,
    this.badge,
    this.badgeColor,
    this.progress,
    this.autofocus = false,
    super.key,
  });

  final String title;
  final String meta;
  final String assetPath;
  final String? networkUrl;
  final HomeV2Metrics metrics;
  final VoidCallback onPressed;
  final String? badge;
  final Color? badgeColor;

  /// 0..1 watch progress. Draws a bar across the bottom of the artwork.
  final double? progress;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final width = metrics.posterWidth;

    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FocusableScale(
            onPressed: onPressed,
            semanticLabel: '$title، $meta',
            autofocus: autofocus,
            borderRadius: BorderRadius.circular(HomeV2Tokens.radiusCard),
            child: SizedBox(
              width: width,
              height: metrics.posterHeight,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CinematicImage(
                    assetPath: assetPath,
                    networkUrl: networkUrl,
                    semanticLabel: title,
                    decodeWidth: width,
                  ),
                  // Light bottom gradient so a badge or progress bar stays
                  // legible over pale artwork.
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.center,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0x8A050817)],
                      ),
                    ),
                  ),
                  if (badge != null)
                    PositionedDirectional(
                      top: 7,
                      start: 7,
                      child: _Badge(
                        label: badge!,
                        color: badgeColor ?? AppColors.success,
                      ),
                    ),
                  if (progress != null && progress! > 0)
                    PositionedDirectional(
                      start: 0,
                      end: 0,
                      bottom: 0,
                      child: _ProgressBar(value: progress!),
                    ),
                ],
              ),
            ),
          ),
          SizedBox(height: metrics.isTelevision ? 10 : 7),
          Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white,
              fontSize: metrics.isTelevision ? 14 : 12,
              height: 1.28,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            meta,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.dimText,
              fontSize: metrics.isTelevision ? 12 : 10.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// 16:9 card for episodes and "continue watching".
class WideCard extends StatelessWidget {
  const WideCard({
    required this.title,
    required this.meta,
    required this.assetPath,
    required this.metrics,
    required this.onPressed,
    this.networkUrl,
    this.progress,
    this.showPlayIcon = true,
    this.autofocus = false,
    super.key,
  });

  final String title;
  final String meta;
  final String assetPath;
  final String? networkUrl;
  final HomeV2Metrics metrics;
  final VoidCallback onPressed;
  final double? progress;
  final bool showPlayIcon;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final width = metrics.wideWidth;

    return SizedBox(
      width: width,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          FocusableScale(
            onPressed: onPressed,
            semanticLabel: '$title، $meta',
            autofocus: autofocus,
            borderRadius: BorderRadius.circular(HomeV2Tokens.radiusCard),
            child: SizedBox(
              width: width,
              height: metrics.wideHeight,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CinematicImage(
                    assetPath: assetPath,
                    networkUrl: networkUrl,
                    semanticLabel: title,
                    decodeWidth: width,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.center,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0x9E050817)],
                      ),
                    ),
                  ),
                  if (showPlayIcon)
                    Center(
                      child: Container(
                        width: metrics.isTelevision ? 52 : 40,
                        height: metrics.isTelevision ? 52 : 40,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.42),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.72),
                            width: 1.4,
                          ),
                        ),
                        child: Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: metrics.isTelevision ? 30 : 24,
                        ),
                      ),
                    ),
                  if (progress != null && progress! > 0)
                    PositionedDirectional(
                      start: 0,
                      end: 0,
                      bottom: 0,
                      child: _ProgressBar(value: progress!),
                    ),
                ],
              ),
            ),
          ),
          SizedBox(height: metrics.isTelevision ? 10 : 7),
          Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white,
              fontSize: metrics.isTelevision ? 14 : 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            meta,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: AppColors.dimText,
              fontSize: metrics.isTelevision ? 12 : 10.5,
            ),
          ),
        ],
      ),
    );
  }
}

/// Top 10 card with an oversized outlined rank numeral beside the poster.
///
/// The numeral is drawn as stroked text so it reads against any artwork without
/// needing a scrim, which is what keeps the effect crisp on a large panel.
class RankedCard extends StatelessWidget {
  const RankedCard({
    required this.rank,
    required this.title,
    required this.assetPath,
    required this.metrics,
    required this.onPressed,
    this.networkUrl,
    this.autofocus = false,
    super.key,
  });

  final int rank;
  final String title;
  final String assetPath;
  final String? networkUrl;
  final HomeV2Metrics metrics;
  final VoidCallback onPressed;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final posterWidth = metrics.posterWidth * 0.82;
    final height = posterWidth * 1.46;
    final numeralSize = height * 0.86;
    // Two-digit numerals need more room or they clip against the poster.
    final numeralWidth = rank >= 10 ? numeralSize * 0.92 : numeralSize * 0.52;

    return SizedBox(
      width: posterWidth + numeralWidth,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: 'المرتبة $rank، $title',
        autofocus: autofocus,
        borderRadius: BorderRadius.circular(HomeV2Tokens.radiusCard),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            SizedBox(
              width: numeralWidth,
              height: height,
              child: Align(
                alignment: AlignmentDirectional.bottomStart,
                child: _OutlinedNumeral(value: rank, fontSize: numeralSize),
              ),
            ),
            ClipRRect(
              borderRadius: BorderRadius.circular(HomeV2Tokens.radiusCard),
              child: SizedBox(
                width: posterWidth,
                height: height,
                child: CinematicImage(
                  assetPath: assetPath,
                  networkUrl: networkUrl,
                  semanticLabel: title,
                  decodeWidth: posterWidth,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Stroke-only numeral. Two [Text] layers: a stroked paint over a subtle fill.
class _OutlinedNumeral extends StatelessWidget {
  const _OutlinedNumeral({required this.value, required this.fontSize});

  final int value;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final label = '$value';
    final base = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w900,
      height: 0.82,
      letterSpacing: -4,
    );

    return Stack(
      children: [
        Text(
          label,
          style: base.copyWith(
            color: AppColors.abyss.withValues(alpha: 0.55),
          ),
        ),
        Text(
          label,
          style: base.copyWith(
            foreground: Paint()
              ..style = PaintingStyle.stroke
              ..strokeWidth = 2.2
              ..color = Colors.white.withValues(alpha: 0.9),
          ),
        ),
      ],
    );
  }
}

/// Circular planet/character entry point.
class OrbCard extends StatelessWidget {
  const OrbCard({
    required this.label,
    required this.assetPath,
    required this.accent,
    required this.metrics,
    required this.onPressed,
    this.autofocus = false,
    super.key,
  });

  final String label;
  final String assetPath;
  final Color accent;
  final HomeV2Metrics metrics;
  final VoidCallback onPressed;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final size = metrics.circleSize;

    return SizedBox(
      width: size + 14,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FocusableScale(
            onPressed: onPressed,
            semanticLabel: label,
            autofocus: autofocus,
            borderRadius: BorderRadius.circular(size),
            focusScale: 1.09,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(-0.3, -0.4),
                  colors: [
                    accent.withValues(alpha: 0.42),
                    AppColors.abyss.withValues(alpha: 0.9),
                  ],
                ),
                border: Border.all(color: accent.withValues(alpha: 0.55)),
                boxShadow: [
                  BoxShadow(
                    color: accent.withValues(alpha: 0.3),
                    blurRadius: 18,
                    spreadRadius: 1,
                  ),
                ],
              ),
              child: Padding(
                padding: EdgeInsets.all(size * 0.13),
                child: Image.asset(
                  assetPath,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => Icon(
                    Icons.public_rounded,
                    color: accent,
                    size: size * 0.42,
                  ),
                ),
              ),
            ),
          ),
          SizedBox(height: metrics.isTelevision ? 10 : 7),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.92),
              fontSize: metrics.isTelevision ? 13 : 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(5),
    ),
    child: Text(
      label,
      style: const TextStyle(
        color: AppColors.abyss,
        fontSize: 9.5,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) => Container(
    height: 3.5,
    color: Colors.white.withValues(alpha: 0.22),
    alignment: AlignmentDirectional.centerStart,
    child: FractionallySizedBox(
      widthFactor: value.clamp(0.0, 1.0),
      child: Container(color: AppColors.starGold),
    ),
  );
}
