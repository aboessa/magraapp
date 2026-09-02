/// Creative Studio design tokens and shared chrome.
///
/// ## Why the studio has its own token layer
///
/// The rest of the app is cinematic and restrained — dark surfaces, one accent,
/// a lot of negative space. The studio is the one place a child drives, so it is
/// deliberately louder: saturated per-activity gradients, thicker corners, glow
/// borders. Those choices are collected here instead of being inlined per widget
/// because the studio home, the category pages and the activity headers all have
/// to agree. Before this file existed the same grid delegate and the same
/// section header were copy-pasted six times in `creative_studio_page.dart`, and
/// they had already drifted apart by a few pixels.
///
/// Everything here builds on [AppColors]; no new brand colour is invented. The
/// per-activity gradients are new, but they are all mixed from the existing
/// cyan / royal blue / cosmic purple / star gold family so the studio still
/// reads as the same product.
library;

import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';

/// Vertical and horizontal rhythm.
///
/// The studio previously hardcoded 6/8/10/12/16/20/24 in no particular order.
/// These five steps are the only ones the redesign uses.
abstract final class StudioSpace {
  static const double xs = 6;
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 24;
  static const double xxl = 32;

  /// Page gutter. Matches the home feed so the two screens line up when a child
  /// moves between them.
  static const double gutter = 16;
}

abstract final class StudioRadius {
  static const double tile = 18;
  static const double card = 22;
  static const double strip = 18;
  static const double pill = 999;

  /// The small rounded square behind an app-bar glyph.
  static const double badge = 9;
}

/// Chrome surfaces: the app bar and the controls that sit inside it.
///
/// These five colours were previously inline literals repeated across the
/// studio. The audit that produced this class found `0xFF05081A` in 3 files,
/// `0xFF1E2A6A` in 12, and `0xFF11183D` in 4 — none of them named anywhere, and
/// the two bar backgrounds (`0xFF0C1030` for coloring/trace, `0xFF05081A` for
/// the reference pages) differed by enough to be visible when navigating
/// between the two groups. Naming them here is what lets [StudioAppBar] be the
/// single definition of the bar.
abstract final class StudioSurfaces {
  /// Bar and page background. One value for the whole studio: the reference
  /// pages used to be four steps darker than the coloring pages, which read as
  /// a rendering glitch on push transitions rather than as a deliberate change.
  static const Color bar = Color(0xFF0C1030);

  /// Fill behind an app-bar leading glyph.
  static const Color badge = Color(0xFF1E2A6A);

  /// Fill of a circular bar button (back, help).
  static const Color control = Color(0xFF11183D);

  /// Hairline around a circular bar button.
  static const Color controlBorder = Color(0xFF2A2E6A);
}

/// Per-surface gradients.
///
/// Each activity gets a fixed pair so a card is recognisable by colour before a
/// pre-reader can read its label. The ids these belong to live in
/// `studio_categories.dart`; the colours live here so a future art pass can
/// retune the palette in one file.
abstract final class StudioGradients {
  static const LinearGradient page = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF0C1030), Color(0xFF070A1C), Color(0xFF05060F)],
    stops: [0, 0.55, 1],
  );

  /// The hero banner. Purple-forward so it separates from the blue category
  /// cards underneath it.
  static const LinearGradient hero = LinearGradient(
    begin: AlignmentDirectional.topEnd,
    end: AlignmentDirectional.bottomStart,
    colors: [Color(0xFF3A1E7A), Color(0xFF241A5E), Color(0xFF0D1235)],
    stops: [0, 0.52, 1],
  );

  static const LinearGradient drawLikeMe = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF8B4DF5), Color(0xFF5B27D6)],
  );

  static const LinearGradient newCanvas = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF2E86FF), Color(0xFF1442C9)],
  );

  static const LinearGradient coloring = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF1F8A5B), Color(0xFF0E5C46)],
  );

  static const LinearGradient freeDraw = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF2A5BE0), Color(0xFF16307F)],
  );

  static const LinearGradient reference = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF17796F), Color(0xFF0C4A4B)],
  );

  static const LinearGradient complete = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF3F3AA8), Color(0xFF201C6B)],
  );

  static const LinearGradient copyPattern = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFFB07A18), Color(0xFF6B3F10)],
  );

  static const LinearGradient connectDots = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF294273), Color(0xFF141C3F)],
  );

  static const LinearGradient trace = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF1D6E9C), Color(0xFF103F63)],
  );

  static const LinearGradient letters = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF9B3B7A), Color(0xFF5A1D4C)],
  );

  static const LinearGradient numbers = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF6A3DF2), Color(0xFF32218C)],
  );

  static const LinearGradient promptDraw = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFFC24E7C), Color(0xFF6E2247)],
  );

  /// The achievements strip. Gold on violet, the only place star gold is used
  /// as a fill in the studio.
  static const LinearGradient achievement = LinearGradient(
    begin: AlignmentDirectional.centerStart,
    end: AlignmentDirectional.centerEnd,
    colors: [Color(0xFF3B1F6E), Color(0xFF1D1546)],
  );

  static const LinearGradient progressFill = LinearGradient(
    begin: AlignmentDirectional.centerStart,
    end: AlignmentDirectional.centerEnd,
    colors: [AppColors.starGold, Color(0xFFFF9F45)],
  );
}

abstract final class StudioShadows {
  /// Card lift. Softer and shorter than [AppColors.premiumCardShadow] because
  /// studio cards sit in a dense grid. Use BoxFit.cover center, not topCenter, to avoid cropping the art designed for full-bleed.
  /// The card art is composed for 16:9 center-safe, so cover-center preserves it.
  /// grey haze between tiles.
  static List<BoxShadow> get tile => [
    BoxShadow(
      color: const Color(0xFF000000).withValues(alpha: 0.38),
      blurRadius: 16,
      offset: const Offset(0, 8),
    ),
  ];

  /// Hero glow. The coloured pass is what produces the lit edge in the design;
  /// it is drawn behind the border, not as the border, so it survives a rounded
  /// clip without banding.
  static List<BoxShadow> get hero => [
    BoxShadow(
      color: const Color(0xFF000000).withValues(alpha: 0.45),
      blurRadius: 26,
      offset: const Offset(0, 14),
    ),
    BoxShadow(
      color: AppColors.cosmicPurple.withValues(alpha: 0.28),
      blurRadius: 30,
      spreadRadius: -4,
    ),
  ];
}

abstract final class StudioBorders {
  /// Hairline used on every studio surface. White at low alpha rather than a
  /// solid grey so it reads correctly over both the dark page and a saturated
  /// gradient.
  static Border get hairline =>
      Border.all(color: Colors.white.withValues(alpha: 0.08));

  static Border get lit =>
      Border.all(color: AppColors.electricCyan.withValues(alpha: 0.30));
}

/// The single grid recipe for every studio item grid.
///
/// Three columns on a phone is what the design calls for, but a fixed
/// `crossAxisCount: 3` produces 60px tiles on a 320dp device and 200px tiles on
/// a tablet. `maxCrossAxisExtent` keeps the tile size stable and lets the column
/// count grow on wide screens instead.
SliverGridDelegate studioGridDelegate({double maxExtent = 172}) =>
    SliverGridDelegateWithMaxCrossAxisExtent(
      maxCrossAxisExtent: maxExtent,
      childAspectRatio: 0.86,
      crossAxisSpacing: StudioSpace.sm,
      mainAxisSpacing: StudioSpace.sm,
    );

/// Section title with an optional trailing action.
///
/// The trailing slot is a real button, not a decorative chevron: in the
/// reference design "عرض الكل" is the only way to reach the activities that do
/// not fit in the six-card grid, so it has to be focusable and labelled.
class StudioSectionHeader extends StatelessWidget {
  const StudioSectionHeader({
    required this.title,
    this.subtitle,
    this.trailingLabel,
    this.onTrailingTap,
    this.accent,
    super.key,
  });

  final String title;
  final String? subtitle;
  final String? trailingLabel;
  final VoidCallback? onTrailingTap;

  /// Small leading glyph, e.g. a sparkle next to "اختر نشاطك الإبداعي".
  final IconData? accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subtitleText = subtitle;
    final trailing = trailingLabel;
    return Padding(
      padding: const EdgeInsets.only(bottom: StudioSpace.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        title,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: AppColors.starlight,
                        ),
                      ),
                    ),
                    if (accent != null) ...[
                      const SizedBox(width: StudioSpace.xs),
                      Icon(accent, size: 16, color: AppColors.starGold),
                    ],
                  ],
                ),
                if (subtitleText != null && subtitleText.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitleText,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: AppColors.dimText,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null && onTrailingTap != null)
            TextButton(
              onPressed: onTrailingTap,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.electricCyan,
                padding: const EdgeInsets.symmetric(
                  horizontal: StudioSpace.xs,
                  vertical: StudioSpace.xs,
                ),
                minimumSize: const Size(32, 32),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                visualDensity: VisualDensity.compact,
                textStyle: theme.textTheme.labelSmall,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      trailing,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: AppColors.electricCyan,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 2),
                  const Icon(Icons.chevron_left_rounded, size: 14),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Small label chip. Used for the "ابدأ الآن" hero badge and item counts.
class StudioPill extends StatelessWidget {
  const StudioPill({
    required this.label,
    this.icon,
    this.background,
    this.foreground,
    super.key,
  });

  final String label;
  final IconData? icon;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final fg = foreground ?? AppColors.starlight;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background ?? Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(StudioRadius.pill),
        border: StudioBorders.hairline,
      ),
      // The label is Flexible because a pill is placed inside whatever column
      // happens to host it — the hero badge sits in a copy column that is a
      // fraction of the card width, and on a 320dp phone "ابدأ الآن" plus its
      // icon missed the available width by 1.4dp. A pill must never be the thing
      // that overflows a layout, so it gives up characters instead.
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: fg,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (icon != null) ...[
            const SizedBox(width: 4),
            Icon(icon, size: 13, color: fg),
          ],
        ],
      ),
    );
  }
}

/// A tappable studio surface: rounded, clipped, gradient or solid, with the
/// standard hairline and lift.
///
/// Wrapping every studio card in one widget is what keeps the ripple inside the
/// rounded corners. `Card` + `InkWell` + a `Container` decoration was producing
/// a square splash on the gradient tiles because the ink was painted above the
/// clip.
class StudioSurface extends StatelessWidget {
  const StudioSurface({
    required this.child,
    this.onTap,
    this.gradient,
    this.color,
    this.radius = StudioRadius.tile,
    this.border,
    this.shadows,
    this.padding = EdgeInsets.zero,
    this.semanticLabel,
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final Gradient? gradient;
  final Color? color;
  final double radius;
  final Border? border;
  final List<BoxShadow>? shadows;
  final EdgeInsetsGeometry padding;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(radius);
    Widget content = Padding(padding: padding, child: child);

    // The label is applied *inside* the InkWell rather than around the whole
    // surface. Wrapping from the outside and excluding the subtree would remove
    // the tap action the InkWell contributes, leaving a card a screen reader can
    // read but not activate.
    final label = semanticLabel;
    if (label != null) {
      content = Semantics(label: label, excludeSemantics: true, child: content);
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: shape,
        gradient: gradient,
        color: gradient == null ? (color ?? AppColors.cardSurface) : null,
        border: border ?? StudioBorders.hairline,
        boxShadow: shadows ?? StudioShadows.tile,
      ),
      child: ClipRRect(
        borderRadius: shape,
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(onTap: onTap, child: content),
        ),
      ),
    );
  }
}
