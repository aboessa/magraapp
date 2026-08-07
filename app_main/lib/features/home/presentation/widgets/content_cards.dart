import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../core/widgets/focusable_scale.dart';
import '../../domain/content_models.dart';

class SeriesCard extends StatelessWidget {
  const SeriesCard({
    required this.item,
    required this.onPressed,
    required this.isTelevision,
    this.focusOrder,
    super.key,
  });

  final SeriesItem item;
  final VoidCallback onPressed;
  final bool isTelevision;
  final FocusOrder? focusOrder;

  @override
  Widget build(BuildContext context) {
    final compact = context.layoutClass == AppLayoutClass.compact;
    final width = isTelevision ? 228.0 : (compact ? 148.0 : 172.0);
    final height = width * 1.42;

    return SizedBox(
      width: width,
      height: height,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: '${item.title}، ${item.ageLabel}',
        focusOrder: focusOrder,
        child: Container(
          decoration: CinematicCardDecoration.premiumCard(borderRadius: 16),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CinematicImage(
                networkUrl: item.coverUrl,
                assetPath: item.posterAsset,
                semanticLabel: 'ملصق ${item.title}',
              ),
              // Cinematic scrim: dark gradient from middle to bottom
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x00000000),
                      Color(0x00000000),
                      Color(0x3306091A),
                      Color(0xE606091A),
                    ],
                    stops: [0, 0.32, 0.62, 1],
                  ),
                ),
              ),
              // Subtle top light for depth
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.center,
                      colors: [
                        Colors.white.withValues(alpha: 0.035),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              // Free badge
              if (item.isFree)
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: _FreeBadge(),
                )
              else
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: _AgeBadge(label: item.ageLabel),
                ),
              // Title area like reference - clean, bottom aligned
              PositionedDirectional(
                start: 10,
                end: 10,
                bottom: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isTelevision ? 15 : 13.5,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                        shadows: [
                          Shadow(
                            color: Colors.black.withValues(alpha: 0.85),
                            blurRadius: 8,
                            offset: const Offset(0, 1),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.planetName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.88),
                        fontSize: 10.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
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

class BookCard extends StatelessWidget {
  const BookCard({required this.item, required this.onPressed, required this.isTelevision, super.key});
  final BookItem item;
  final VoidCallback onPressed;
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    final compact = context.layoutClass == AppLayoutClass.compact;
    final width = isTelevision ? 228.0 : (compact ? 148.0 : 172.0);
    final height = width * 1.42;
    return SizedBox(
      width: width,
      height: height,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: item.title,
        child: Container(
          decoration: CinematicCardDecoration.premiumCard(borderRadius: 16),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CinematicImage(assetPath: item.posterAsset, semanticLabel: item.title),
              const DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.transparent, Color(0x3306091A), Color(0xE606091A)], stops: [0, 0.32, 0.62]))),
              PositionedDirectional(top: 8, start: 8, child: Container(padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3), decoration: BoxDecoration(color: const Color(0xFF9D68FF).withValues(alpha: 0.88), borderRadius: BorderRadius.circular(6)), child: Text(item.type == 'comic' ? 'كوميكس' : item.type == 'audio_story' ? 'صوتي' : 'قصة', style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w700)))),
              PositionedDirectional(start: 10, end: 10, bottom: 10, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(item.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white, fontSize: isTelevision ? 15 : 13.5, fontWeight: FontWeight.w700, shadows: [Shadow(color: Colors.black.withValues(alpha: 0.85), blurRadius: 8)])), const SizedBox(height: 2), Text(item.ageLabel, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.88), fontSize: 10.5))]))],
          ),
        ),
      ),
    );
  }
}

class _FreeBadge extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
      decoration: BoxDecoration(
        color: const Color(0xFF0B1026).withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.25),
            blurRadius: 8,
          ),
        ],
      ),
      child: const Text(
        'مجاني',
        style: TextStyle(
          color: Color(0xFF00D6F5),
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _AgeBadge extends StatelessWidget {
  const _AgeBadge({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.85),
          fontSize: 9,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class EpisodeCard extends StatelessWidget {
  const EpisodeCard({
    required this.item,
    required this.onPressed,
    required this.isTelevision,
    super.key,
  });

  final EpisodeItem item;
  final VoidCallback onPressed;
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    // 16:9 landscape cards - wider
    final width = isTelevision ? 360.0 : 264.0;
    final height = isTelevision ? 202.0 : 148.0;

    return SizedBox(
      width: width,
      height: height,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: '${item.title}، ${item.durationLabel}',
        child: Container(
          decoration: CinematicCardDecoration.premiumCard(borderRadius: 14),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CinematicImage(
                networkUrl: item.thumbnailUrl,
                assetPath: item.thumbnailAsset,
                semanticLabel: 'لقطة من ${item.title}',
              ),
              // Cinematic gradient
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x1A06091A),
                      Color(0x9906091A),
                    ],
                    stops: [0.3, 1],
                  ),
                ),
              ),
              // Center play button - more premium, like video thumbnails
              Center(
                child: Container(
                  width: 44,
                  height: 44,
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
                  child: const Icon(
                    Icons.play_arrow_rounded,
                    size: 28,
                    color: Color(0xFF0B1026),
                  ),
                ),
              ),
              PositionedDirectional(
                start: 10,
                end: 10,
                bottom: 8,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
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
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              shadows: [
                                Shadow(color: Colors.black87, blurRadius: 6),
                              ],
                            ),
                          ),
                          const SizedBox(height: 1),
                          Text(
                            item.seriesTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: AppColors.mutedText.withValues(alpha: 0.85),
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    _Pill(label: item.durationLabel),
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

class PlanetCard extends StatelessWidget {
  const PlanetCard({
    required this.item,
    required this.onPressed,
    required this.isTelevision,
    super.key,
  });

  final Planet item;
  final VoidCallback onPressed;
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    // Cinematic planet card
    final width = isTelevision ? 340.0 : 248.0;
    final height = isTelevision ? 196.0 : 152.0;

    return SizedBox(
      width: width,
      height: height,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: '${item.name}، ${item.description}',
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                const Color(0xFF1C2550),
                const Color(0xFF121A38),
                const Color(0xFF0A102A),
              ],
            ),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.09),
              width: 1,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.42),
                blurRadius: 26,
                offset: const Offset(0, 14),
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.03),
                blurRadius: 0,
                spreadRadius: 1,
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              // Cinematic glow behind
              Positioned(
                top: -30,
                right: -20,
                child: Container(
                  width: 120,
                  height: 120,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        _colorFromHex(item.colorHex).withValues(alpha: 0.22),
                        Colors.transparent,
                      ],
                    ),
                  ),
                ),
              ),
              // Top tiny sparkle icon like screenshot
              PositionedDirectional(
                top: 10,
                end: 10,
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.07),
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    color: AppColors.starGold,
                    size: 14,
                  ),
                ),
              ),
              // Planet Symbol - centered prominent, like screenshot
              Positioned.fill(
                child: Align(
                  alignment: const Alignment(0, -0.15),
                  child: PlanetSymbol(
                    planetId: item.id,
                    colorHex: item.colorHex,
                    semanticLabel: item.name,
                    size: isTelevision ? 116 : 88,
                    selected: false,
                    imageAsset: item.imageAsset,
                  ),
                ),
              ),
              // Bottom text - like screenshot: name bold + description
              PositionedDirectional(
                start: 14,
                end: 14,
                bottom: 12,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      // Remove "كوكب " prefix for cleaner look like screenshot
                      item.name.replaceFirst('كوكب ', ''),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'رحلة تعليمية مليئة بالاكتشاف',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.72),
                        fontSize: 10,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _colorFromHex(String value) {
    final normalized = value.replaceFirst('#', '');
    return Color(int.parse(normalized, radix: 16) | 0xFF000000);
  }
}

class ExperienceCard extends StatelessWidget {
  const ExperienceCard({
    required this.item,
    required this.onPressed,
    required this.isTelevision,
    super.key,
  });

  final ExperienceItem item;
  final VoidCallback onPressed;
  final bool isTelevision;

  @override
  Widget build(BuildContext context) {
    final width = isTelevision ? 218.0 : 162.0;
    final height = isTelevision ? 268.0 : 210.0;

    return SizedBox(
      width: width,
      height: height,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: '${item.title}، ${item.subtitle}',
        child: Container(
          decoration: CinematicCardDecoration.premiumCard(borderRadius: 14),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              CinematicImage(
                assetPath: item.imageAsset,
                semanticLabel: item.title,
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Color(0xE606091A)],
                    stops: [0.38, 1],
                  ),
                ),
              ),
              PositionedDirectional(
                top: 8,
                end: 8,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.18),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.22),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.sports_esports_rounded,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
              ),
              PositionedDirectional(
                start: 10,
                end: 10,
                bottom: 10,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.8),
                        fontSize: 10,
                      ),
                    ),
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

/// Character circular avatars 
class CharacterCircleCard extends StatelessWidget {
  const CharacterCircleCard({
    required this.name,
    required this.imageAsset,
    required this.onPressed,
    this.size = 82,
    this.isSelected = false,
    super.key,
  });

  final String name;
  final String imageAsset;
  final VoidCallback onPressed;
  final double size;
  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size + 12,
      child: FocusableScale(
        onPressed: onPressed,
        semanticLabel: name,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: size,
              height: size,
              decoration: CinematicCardDecoration.circularAvatar(
                selected: isSelected,
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
                      child: const Icon(Icons.person, color: Colors.white54),
                    ),
                  ),
                  // Subtle inner vignette for cinematic
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        colors: [
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.22),
                        ],
                        stops: const [0.6, 1],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.mutedText,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3.5),
      decoration: BoxDecoration(
        color: const Color(0xFF0B1026).withValues(alpha: 0.84),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
