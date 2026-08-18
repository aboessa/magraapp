import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';

/// Design tokens for the v2 cinematic home.
///
/// The v1 feed hardcoded sizes at every call site and branched only on
/// `isTelevision`, which is why tablets inherited phone geometry. Everything
/// here resolves from a single [HomeV2Metrics] value derived from the layout
/// class plus the television flag, so one surface description drives phone,
/// tablet and TV.
abstract final class HomeV2Tokens {
  /// Rail title size, tuned for a 3 metre viewing distance on TV.
  static const railTitleMobile = 15.0;
  static const railTitleTablet = 17.0;
  static const railTitleTv = 22.0;

  /// Corner radius used across posters and panels.
  static const radiusCard = 14.0;
  static const radiusPanel = 22.0;

  /// Gap between cards inside a rail.
  static const railGap = 12.0;
  static const railGapTv = 18.0;

  /// Vertical rhythm between rails. Generous on TV so focus movement reads.
  static const railSpacing = 30.0;
  static const railSpacingTv = 44.0;

  /// Duration for the ambient backdrop crossfade. Long enough to feel like a
  /// lighting change rather than a state flip.
  static const ambientFade = Duration(milliseconds: 900);

  /// Focus/selection animation.
  static const focusAnim = Duration(milliseconds: 190);
}

/// Resolved geometry for the current surface.
class HomeV2Metrics {
  const HomeV2Metrics({
    required this.isTelevision,
    required this.layoutClass,
    required this.posterWidth,
    required this.wideWidth,
    required this.circleSize,
    required this.railGap,
    required this.railSpacing,
    required this.railTitleSize,
    required this.pagePadding,
    required this.billboardHeightFactor,
    required this.textScaleFactor,
  });

  factory HomeV2Metrics.of(BuildContext context, {required bool isTelevision}) {
    final layoutClass = context.layoutClass;
    final padding = context.horizontalPagePadding;
    final textScaleFactor = MediaQuery.textScalerOf(context).scale(1);

    if (isTelevision) {
      return HomeV2Metrics(
        isTelevision: true,
        layoutClass: layoutClass,
        posterWidth: 210,
        wideWidth: 372,
        circleSize: 128,
        railGap: HomeV2Tokens.railGapTv,
        railSpacing: HomeV2Tokens.railSpacingTv,
        railTitleSize: HomeV2Tokens.railTitleTv,
        pagePadding: 48,
        // TV billboard occupies most of the first screen, like Google TV.
        billboardHeightFactor: 0.72,
        textScaleFactor: textScaleFactor,
      );
    }

    return switch (layoutClass) {
      AppLayoutClass.compact => HomeV2Metrics(
        isTelevision: false,
        layoutClass: layoutClass,
        posterWidth: 132,
        wideWidth: 244,
        circleSize: 76,
        railGap: HomeV2Tokens.railGap,
        railSpacing: HomeV2Tokens.railSpacing,
        railTitleSize: HomeV2Tokens.railTitleMobile,
        pagePadding: padding,
        // Tall poster hero on phones so the artwork carries the screen.
        billboardHeightFactor: 0.78,
        textScaleFactor: textScaleFactor,
      ),
      AppLayoutClass.medium => HomeV2Metrics(
        isTelevision: false,
        layoutClass: layoutClass,
        posterWidth: 164,
        wideWidth: 300,
        circleSize: 92,
        railGap: 14,
        railSpacing: 34,
        railTitleSize: HomeV2Tokens.railTitleTablet,
        pagePadding: padding,
        billboardHeightFactor: 0.62,
        textScaleFactor: textScaleFactor,
      ),
      AppLayoutClass.expanded => HomeV2Metrics(
        isTelevision: false,
        layoutClass: layoutClass,
        posterWidth: 182,
        wideWidth: 332,
        circleSize: 104,
        railGap: 16,
        railSpacing: 38,
        railTitleSize: HomeV2Tokens.railTitleTablet,
        pagePadding: padding,
        billboardHeightFactor: 0.58,
        textScaleFactor: textScaleFactor,
      ),
    };
  }

  final bool isTelevision;
  final AppLayoutClass layoutClass;
  final double posterWidth;
  final double wideWidth;
  final double circleSize;
  final double railGap;
  final double railSpacing;
  final double railTitleSize;
  final double pagePadding;
  final double billboardHeightFactor;
  final double textScaleFactor;

  double get posterHeight => posterWidth * 1.46;
  double get wideHeight => wideWidth * 0.5625;

  double get _captionScale => textScaleFactor.clamp(1.0, 2.0);

  /// Rail viewport heights include explicit, text-scale-aware caption space.
  /// Arabic titles commonly wrap to two lines, so a fixed 46px allowance
  /// overflowed by 3px even at the default scale.
  double get posterRailHeight {
    final title = 2 * (isTelevision ? 14 : 12) * 1.28 * _captionScale;
    final meta = (isTelevision ? 12 : 10.5) * 1.25 * _captionScale;
    final gap = isTelevision ? 10.0 : 7.0;
    return posterHeight + title + meta + gap + 5;
  }

  double get wideRailHeight {
    final title = 2 * (isTelevision ? 15 : 12.5) * 1.25 * _captionScale;
    final meta = (isTelevision ? 12 : 10.5) * 1.25 * _captionScale;
    final gap = isTelevision ? 10.0 : 7.0;
    return wideHeight + title + meta + gap + 5;
  }

  double get circleRailHeight {
    final label = (isTelevision ? 13 : 11) * 1.3 * _captionScale;
    final gap = isTelevision ? 10.0 : 7.0;
    return circleSize + label + gap + 5;
  }

  bool get isTablet => !isTelevision && layoutClass != AppLayoutClass.compact;
}

/// Parses the `#RRGGBB` strings stored on [Planet.colorHex].
///
/// Falls back to the brand blue rather than throwing, because catalog colour
/// values come from the API and a malformed value should not break the home
/// screen.
Color parsePlanetColor(String? hex, {Color fallback = AppColors.royalBlue}) {
  final raw = (hex ?? '').replaceFirst('#', '').trim();
  if (raw.length != 6 && raw.length != 8) return fallback;
  final parsed = int.tryParse(raw, radix: 16);
  if (parsed == null) return fallback;
  return Color(raw.length == 6 ? (parsed | 0xFF000000) : parsed);
}
