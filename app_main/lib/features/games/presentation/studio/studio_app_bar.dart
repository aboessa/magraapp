/// The one top bar for every studio screen.
///
/// ## Why this exists
///
/// Before this file the studio had thirty-plus hand-rolled `AppBar`s and four
/// competing designs of the same bar:
///
/// * the reference pages — `0xFF05081A` background, a 38px circular back
///   button, `Icons.arrow_back_rounded`, an 18px title, a gold star, and a 44px
///   circular help button with a 7px "مساعدة" caption;
/// * the coloring and trace pages — `0xFF0C1030` background, a bare
///   `IconButton` with `Icons.arrow_forward_ios_rounded`, a 26px rounded-square
///   glyph badge, an 18px title, and a pill plus a circle in the actions;
/// * `deepAppBar()` in `studio_v2/image_slot.dart` — the same as above at a 17px
///   title, reached by six pages and nothing else;
/// * the studio home — a 14px title, no back button, and a 28px profile badge.
///
/// Four backgrounds, three back icons pointing two different ways, title sizes
/// from 14 to 18, and help captions at 7px and 8px. Navigating from the studio
/// home into a drawing page changed the bar's colour, its title size and the
/// direction of its back arrow, which reads as a rendering fault rather than a
/// transition.
///
/// ## What this fixes beyond consolidation
///
/// * **Back direction follows the locale.** The old bars hardcoded the arrow.
///   The reference group pointed one way and the coloring group the other, so
///   one of the two was always wrong, and both would be wrong if the app ran
///   LTR. [_BackButton] resolves the glyph from [Directionality].
/// * **Tap targets reach 48dp.** The old circles were 30-44px of *visual* size
///   with no larger hit area, below the 48dp floor for a touch control aimed at
///   children.
/// * **The help button has readable text.** A 7px caption inside a 44px circle
///   is decoration, not a label. [StudioBarCircle] is icon-only with a real
///   semantic label; [StudioBarPill] carries text when text is wanted.
/// * **The bar keeps its colour while scrolling.** None of the old bars set
///   `scrolledUnderElevation`, so Material 3 tinted each one with the surface
///   colour as content scrolled under it — the unified background would have
///   drifted anyway without this.
library;

import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import 'studio_design.dart';

/// Standard studio bar height. Matches [kToolbarHeight]; named so the pages
/// that wrap the bar in a `PreferredSize` agree with it.
const double kStudioAppBarHeight = kToolbarHeight;

/// Minimum touch size for a bar control.
///
/// The visual circle stays at [_controlVisual]; this is the hit area around it.
const double _controlTapTarget = 48;
const double _controlVisual = 38;

class StudioAppBar extends StatelessWidget implements PreferredSizeWidget {
  const StudioAppBar({
    required this.title,
    this.glyph,
    this.showStar = false,
    this.actions = const <Widget>[],
    this.onBack,
    this.showBack,
    this.background,
    this.bottom,
    super.key,
  });

  /// Screen title, e.g. `'ارسم مثلي'`.
  final String title;

  /// Optional glyph shown in a rounded badge before the title. Null renders the
  /// title alone, which is what the bare host routes want.
  final IconData? glyph;

  /// The gold star the draw-like-me pages put after the title.
  final bool showStar;

  final List<Widget> actions;

  /// Overrides the default `maybePop()`.
  final VoidCallback? onBack;

  /// Forces the back button on or off.
  ///
  /// Defaults to whether the route can actually be popped, so the studio home
  /// renders without one and every pushed page renders with one. The old bars
  /// decided this per file and `_V2AppBar` got it wrong — it drew a back button
  /// on a screen reached as a tab.
  final bool? showBack;

  /// Bar fill. Defaults to [StudioSurfaces.bar]; pages should not pass this
  /// unless they genuinely need a different surface.
  final Color? background;

  final PreferredSizeWidget? bottom;

  @override
  Size get preferredSize => Size.fromHeight(
    kStudioAppBarHeight + (bottom?.preferredSize.height ?? 0),
  );

  @override
  Widget build(BuildContext context) {
    final canPop = showBack ?? (ModalRoute.of(context)?.canPop ?? false);
    return AppBar(
      backgroundColor: background ?? StudioSurfaces.bar,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      // Without this Material 3 blends the surface tint into the bar as content
      // scrolls under it, so a bar that starts at StudioSurfaces.bar does not
      // stay there.
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleSpacing: 0,
      automaticallyImplyLeading: false,
      leading: canPop
          ? _BackButton(onTap: onBack ?? () => Navigator.of(context).maybePop())
          : null,
      leadingWidth: canPop ? _controlTapTarget + StudioSpace.sm : 0,
      title: _Title(title: title, glyph: glyph, showStar: showStar),
      actions: actions.isEmpty
          ? null
          : [
              ...actions,
              const SizedBox(width: StudioSpace.sm),
            ],
      bottom: bottom,
    );
  }
}

class _Title extends StatelessWidget {
  const _Title({required this.title, this.glyph, this.showStar = false});

  final String title;
  final IconData? glyph;
  final bool showStar;

  @override
  Widget build(BuildContext context) {
    final icon = glyph;
    // The row is wrapped so a long category title ellipsises instead of
    // overflowing between the two 48dp control slots. `'تلوين ${page.label}'`
    // in creative_studio_page overflowed a 320dp bar before this.
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: StudioSurfaces.badge,
              borderRadius: BorderRadius.circular(StudioRadius.badge),
            ),
            child: Icon(icon, size: 17, color: AppColors.starlight),
          ),
          const SizedBox(width: StudioSpace.xs + 2),
        ],
        Flexible(
          child: Text(
            title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: AppColors.starlight,
              fontWeight: FontWeight.w800,
              fontSize: 17,
              height: 1.1,
            ),
          ),
        ),
        if (showStar) ...[
          const SizedBox(width: StudioSpace.xs),
          const Icon(Icons.star_rounded, color: AppColors.starGold, size: 18),
        ],
      ],
    );
  }
}

/// Circular back control.
///
/// The glyph is resolved from the ambient directionality rather than hardcoded:
/// "back" in Arabic points to the trailing edge, and the old bars split evenly
/// between the two arrows, so half of them pointed the wrong way.
class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: StudioSpace.sm),
      child: StudioBarCircle(
        icon: rtl
            ? Icons.arrow_forward_rounded
            : Icons.arrow_back_rounded,
        label: 'رجوع',
        onTap: onTap,
      ),
    );
  }
}

/// Icon-only circular bar control.
///
/// Replaces the six private `_CircleIcon` / `_V2Circle` / `_Circle` copies and
/// the inline help circles. [label] is required because an icon-only control is
/// unusable with a screen reader without one — the old help circles compensated
/// with a 7px visible caption, which neither reads nor scales.
class StudioBarCircle extends StatelessWidget {
  const StudioBarCircle({
    required this.icon,
    required this.label,
    this.onTap,
    super.key,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        child: SizedBox(
          width: _controlTapTarget,
          height: _controlTapTarget,
          child: Center(
            child: InkWell(
              onTap: onTap,
              customBorder: const CircleBorder(),
              child: Container(
                width: _controlVisual,
                height: _controlVisual,
                decoration: BoxDecoration(
                  color: StudioSurfaces.control,
                  shape: BoxShape.circle,
                  border: Border.all(color: StudioSurfaces.controlBorder),
                ),
                child: Icon(icon, color: AppColors.starlight, size: 19),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Labelled bar control.
///
/// Replaces `_AppBarPill`, `_V2Pill`, `_Pill` and `_PillBtn`. The label is
/// [Flexible] for the same reason [StudioPill]'s is: a pill must never be the
/// widget that overflows a bar.
class StudioBarPill extends StatelessWidget {
  const StudioBarPill({
    required this.label,
    required this.icon,
    this.onTap,
    super.key,
  });

  final String label;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: onTap != null,
      label: label,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: _controlTapTarget),
        child: Center(
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(StudioRadius.pill),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: StudioSpace.sm,
                vertical: StudioSpace.xs,
              ),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(StudioRadius.pill),
                border: StudioBorders.hairline,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: 14, color: AppColors.mutedText),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.starlight,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
