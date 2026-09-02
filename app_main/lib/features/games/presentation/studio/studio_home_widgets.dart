/// Presentation widgets for the Creative Studio home.
///
/// These are deliberately dumb: every one takes plain values and callbacks and
/// holds no provider, no store and no navigation. The studio's data and routing
/// live in `creative_studio_page.dart`, which owns the activity hosts and the
/// local creation store. Keeping the chrome free of both is what makes the home
/// layout reviewable — and testable — without standing up a child profile.
library;

import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import 'studio_categories.dart';
import 'studio_design.dart';

/// Child badge in the app bar.
///
/// Shows the first character of the profile name over the brand gradient, with
/// the child's real drawing count as a badge. There is no photo and no avatar
/// artwork here on purpose: [ChildState] carries no avatar id, so rendering
/// `ChildAvatarView` would show the same fallback planet for every profile and
/// look like a bug.
class StudioProfileBadge extends StatelessWidget {
  const StudioProfileBadge({
    required this.displayName,
    required this.drawingCount,
    this.onTap,
    super.key,
  });

  final String? displayName;

  /// Saved drawings for this child on this device. Shown only when non-zero so
  /// a new profile does not start with a "0" chip.
  final int drawingCount;
  final VoidCallback? onTap;

  /// First character of the profile name, or null when there is no name.
  ///
  /// Null renders a person icon rather than a glyph placeholder. A literal
  /// character standing in for artwork is rejected by
  /// `engine_content_separation_test` — correctly, since a pictograph is a font
  /// dependency masquerading as an asset.
  String? get _initial {
    final name = displayName?.trim() ?? '';
    if (name.isEmpty) return null;
    return name.characters.first;
  }

  @override
  Widget build(BuildContext context) {
    final initial = _initial;
    return Semantics(
      button: onTap != null,
      label: initial == null
          ? 'ملف الطفل'
          : 'ملف ${displayName!.trim()} — $drawingCount رسمة',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(StudioRadius.pill),
        child: SizedBox(
          width: 28,
          height: 28,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 28,
                height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppColors.brandGradient,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.22),
                    ),
                  ),
                  child: initial == null
                      ? const Icon(
                          Icons.person_rounded,
                          color: Colors.white,
                          size: 22,
                        )
                      : Text(
                          initial,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                ),
                if (drawingCount > 0)
                  PositionedDirectional(
                    bottom: -2,
                    start: -4,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 5,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.starGold,
                        borderRadius: BorderRadius.circular(StudioRadius.pill),
                        border: Border.all(color: AppColors.deepSpace, width: 2),
                      ),
                      child: Text(
                        '$drawingCount',
                        style: const TextStyle(
                          color: AppColors.deepSpace,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
    );
  }
}

/// One of the two large gradient shortcuts under the app bar.
///
/// ## What was wrong with the first version
///
/// It was a flat gradient rectangle holding a bare Material glyph, a bold label
/// and — on لوحة جديدة only — a second glyph pinned to the far edge. Three
/// problems, all visible on device: the lone trailing "+" read as an unrelated
/// control rather than part of "new canvas", the glyph and label floated with no
/// anchor so the two buttons looked like different components, and a single flat
/// gradient with nothing on top of it looked unfinished next to the illustrated
/// cards below.
///
/// This version gives the glyph a circular translucent plate, so it reads as an
/// icon rather than a stray symbol; adds a caption line so the button explains
/// itself; and lays a soft radial highlight over the gradient so the surface has
/// a light source instead of being a flat fill.
class StudioQuickAction extends StatelessWidget {
  const StudioQuickAction({
    required this.title,
    required this.caption,
    required this.icon,
    required this.gradient,
    required this.onTap,
    this.iconAsset,
    super.key,
  });

  final String title;

  /// One short line under the label. Not decoration: "لوحة جديدة" and
  /// "ارسم مثلي" are both drawing entry points, and the caption is what tells a
  /// parent which one starts from nothing.
  final String caption;

  /// Fallback glyph, used whenever [iconAsset] is null or fails to decode.
  final IconData icon;

  final LinearGradient gradient;
  final VoidCallback onTap;

  /// Illustrated glyph plate.
  ///
  /// A 144px WebP whose own background is painted in this button's gradient
  /// colours, so it can be shown as an opaque rounded square that looks built in
  /// rather than pasted on. The provider emits JPEG with no alpha channel, so a
  /// cut-out glyph on a translucent chip was never an option; matching the
  /// backgrounds is what makes an opaque tile acceptable here.
  final String? iconAsset;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return StudioSurface(
      onTap: onTap,
      gradient: gradient,
      radius: StudioRadius.tile,
      semanticLabel: '$title. $caption',
      child: Stack(
        children: [
          // Light source. Without it the gradient reads as a printed swatch.
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.6, -0.9),
                  radius: 1.3,
                  colors: [
                    Colors.white.withValues(alpha: 0.20),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(StudioSpace.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                _QuickActionGlyph(icon: icon, iconAsset: iconAsset),
                const SizedBox(height: StudioSpace.sm),
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  caption,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.72),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The glyph plate on a [StudioQuickAction].
///
/// Illustrated tile when artwork exists, translucent circle with a Material glyph
/// when it does not. Both are 42dp so swapping one for the other cannot shift the
/// button's layout, which matters because the two buttons sit side by side and
/// only one may have art at a given moment.
class _QuickActionGlyph extends StatelessWidget {
  const _QuickActionGlyph({required this.icon, this.iconAsset});

  final IconData icon;
  final String? iconAsset;

  /// 52, not 42.
  ///
  /// Rendered at 42 both illustrated tiles collapsed to "a white shape on a
  /// coloured square": the brush on the new-canvas tile and the offset second
  /// card on the draw-like-me tile both fell below the size where they read, so
  /// the two buttons stopped being distinguishable by anything except hue.
  static const double _size = 52;

  @override
  Widget build(BuildContext context) {
    final asset = iconAsset;
    if (asset == null) return _fallback();

    return Container(
      width: _size,
      height: _size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.28),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Image.asset(
        asset,
        fit: BoxFit.cover,
        // 42dp on a 3x screen is 126 physical pixels against a 144px source, so
        // decoding at full size and letting the GPU scale is already close to
        // 1:1; decodeWidth would only add a resize for no memory win.
        excludeFromSemantics: true,
        errorBuilder: (_, __, ___) => _fallback(),
      ),
    );
  }

  Widget _fallback() => Container(
    width: _size,
    height: _size,
    alignment: Alignment.center,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      color: Colors.white.withValues(alpha: 0.18),
      border: Border.all(color: Colors.white.withValues(alpha: 0.24)),
    ),
    child: Icon(icon, color: Colors.white, size: 21),
  );
}

/// Full-width navigation row — "لوحاتي".
class StudioNavStrip extends StatelessWidget {
  const StudioNavStrip({
    required this.title,
    required this.icon,
    required this.onTap,
    this.count,
    super.key,
  });

  final String title;
  final IconData icon;
  final VoidCallback onTap;

  /// Item count, shown as a pill. Null hides the pill entirely rather than
  /// showing a placeholder while the store is still loading.
  final int? count;

  @override
  Widget build(BuildContext context) {
    final itemCount = count;
    return StudioSurface(
      onTap: onTap,
      color: AppColors.cardSurface,
      radius: StudioRadius.strip,
      semanticLabel: itemCount == null ? title : '$title — $itemCount لوحة',
      padding: const EdgeInsets.symmetric(
        horizontal: StudioSpace.md,
        vertical: StudioSpace.md,
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.electricCyan),
          const SizedBox(width: StudioSpace.sm),
          Expanded(
            child: Row(
              children: [
                Flexible(
                  child: Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: AppColors.starlight,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (itemCount != null) ...[
                  const SizedBox(width: StudioSpace.sm),
                  Flexible(child: StudioPill(label: '$itemCount')),
                ],
              ],
            ),
          ),
          const SizedBox(width: StudioSpace.sm),
          const Icon(
            Icons.chevron_left_rounded,
            size: 22,
            color: AppColors.dimText,
          ),
        ],
      ),
    );
  }
}

/// One resumable drawing offered by the hero carousel.
@immutable
class StudioHeroResume {
  const StudioHeroResume({
    required this.title,
    required this.thumbnail,
    required this.onTap,
  });

  final String title;

  /// Flattened PNG of the saved drawing, straight from `LocalCreation.bytes`.
  final Uint8List thumbnail;
  final VoidCallback onTap;
}

/// The banner at the top of the studio.
///
/// Page one is always "ابدأ الرسم"; every further page is a real unfinished
/// drawing. That is why this is a carousel rather than a static banner — the
/// design's edge chevron implies paging, and resumable work is the only honest
/// thing to page through. With nothing saved it degrades to a single
/// non-scrollable page and hides the dots.
class StudioHeroCarousel extends StatefulWidget {
  const StudioHeroCarousel({
    required this.onStartDrawing,
    this.resumable = const <StudioHeroResume>[],
    this.artAsset,
    super.key,
  });

  final VoidCallback onStartDrawing;
  final List<StudioHeroResume> resumable;

  /// Illustration for the first page. Null renders the gradient with a glyph.
  final String? artAsset;

  @override
  State<StudioHeroCarousel> createState() => _StudioHeroCarouselState();
}

class _StudioHeroCarouselState extends State<StudioHeroCarousel> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final resumable = widget.resumable.take(4).toList();
    final pageCount = 1 + resumable.length;

    return Column(
      children: [
        SizedBox(
          // 184 rather than the original 168: the banner now carries an eyebrow,
          // a headline, a caption and a real CTA, and the illustration needs
          // enough height that a full-length character is not scaled to a smear.
          height: 184,
          child: PageView.builder(
            controller: _controller,
            physics: pageCount == 1
                ? const NeverScrollableScrollPhysics()
                : const PageScrollPhysics(),
            onPageChanged: (value) => setState(() => _page = value),
            itemCount: pageCount,
            itemBuilder: (context, index) {
              if (index == 0) {
                return _HeroStartCard(
                  onTap: widget.onStartDrawing,
                  artAsset: widget.artAsset,
                );
              }
              return _HeroResumeCard(entry: resumable[index - 1]);
            },
          ),
        ),
        if (pageCount > 1) ...[
          const SizedBox(height: StudioSpace.sm),
          _Dots(count: pageCount, active: _page),
        ],
      ],
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});

  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var index = 0; index < count; index++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: index == active ? 18 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: index == active
                    ? AppColors.electricCyan
                    : Colors.white.withValues(alpha: 0.22),
                borderRadius: BorderRadius.circular(StudioRadius.pill),
              ),
            ),
        ],
      ),
    );
  }
}

class _HeroStartCard extends StatelessWidget {
  const _HeroStartCard({required this.onTap, this.artAsset});

  final VoidCallback onTap;
  final String? artAsset;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final art = artAsset;

    // ## Why the artwork is the background and the card has no gradient
    //
    // The first version painted a purple card gradient and then drew the
    // illustration on top of it. Both carry their own light and their own blues,
    // so they fought: the banner read as a flat purple slab with a picture stuck
    // to one edge. The illustration is already a finished banner composed in the
    // brand palette, so it is now the surface itself, and the only thing over it
    // is a directional scrim sized to the copy.
    return StudioSurface(
      onTap: onTap,
      color: const Color(0xFF0D1235),
      radius: StudioRadius.card,
      border: StudioBorders.lit,
      shadows: StudioShadows.hero,
      semanticLabel: 'ابدأ الرسم — لوحة بيضاء فارغة، ابدأ الآن',
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (art != null)
            Image.asset(
              art,
              fit: BoxFit.cover,
              // Biased up so the vertical crop is taken off her feet, not her
              // face.
              alignment: const Alignment(0, -0.18),
              excludeFromSemantics: true,
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          // Two scrims, doing different jobs. The directional one guarantees
          // headline contrast on the copy side even if the illustration is
          // regenerated brighter. The bottom one grounds the card so the artwork
          // does not stop against the rounded edge.
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: AlignmentDirectional.centerStart,
                end: AlignmentDirectional.centerEnd,
                colors: [
                  const Color(0xFF0B0F2E).withValues(alpha: 0.94),
                  const Color(0xFF0B0F2E).withValues(alpha: 0.62),
                  Colors.transparent,
                ],
                stops: const [0, 0.48, 0.82],
              ),
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  const Color(0xFF06091A).withValues(alpha: 0.55),
                  Colors.transparent,
                ],
                stops: const [0, 0.45],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: StudioSpace.lg,
              vertical: StudioSpace.md,
            ),
            child: Align(
              alignment: AlignmentDirectional.centerStart,
              child: FractionallySizedBox(
                // Held to just over half the card so the copy can never reach
                // the illustration, at any screen width.
                widthFactor: 0.58,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Eyebrow instead of a pill. The old floating chip sat above
                    // the title with its own border and background, which read as
                    // a second button competing with the card's own tap target —
                    // and the whole card is already the button.
                    Row(
                      children: [
                        Container(
                          width: 3,
                          height: 12,
                          decoration: BoxDecoration(
                            color: AppColors.starGold,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(width: StudioSpace.xs),
                        Flexible(
                          child: Text(
                            // Names the activity, not the screen. An eyebrow
                            // repeating the app-bar title adds a line and no
                            // information.
                            'لوحة بيضاء',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: AppColors.starGold,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.2,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: StudioSpace.xs),
                    Text(
                      'ابدأ الرسم',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 2),
                    // Capped at two lines. The copy column is a fraction of the
                    // card so its width shrinks with the screen; left uncapped
                    // this wrapped to three lines on a 390dp phone and pushed the
                    // fixed-height banner 22px past its bounds.
                    Text(
                      'ارسم ما تحب',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: AppColors.mutedText,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: StudioSpace.sm),
                    // A real affordance. The card was tappable but showed nothing
                    // tappable, so it read as a decorative banner.
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: StudioSpace.md,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.electricCyan,
                        borderRadius: BorderRadius.circular(StudioRadius.pill),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.electricCyan.withValues(
                              alpha: 0.35,
                            ),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      // No Flexible on this label. A Flexible child inside a
                      // MainAxisSize.min Row still claims the incoming maximum,
                      // which stretched this pill across the whole copy column and
                      // made it read as a full-width bar rather than a button. The
                      // label is two short words inside a column that is already a
                      // fraction of the card, so it cannot overflow.
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'ابدأ الآن',
                            maxLines: 1,
                            style: theme.textTheme.labelMedium?.copyWith(
                              color: AppColors.deepSpace,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(
                            Icons.arrow_back_rounded,
                            size: 15,
                            color: AppColors.deepSpace,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroResumeCard extends StatelessWidget {
  const _HeroResumeCard({required this.entry});

  final StudioHeroResume entry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return StudioSurface(
      onTap: entry.onTap,
      gradient: StudioGradients.hero,
      radius: StudioRadius.card,
      border: StudioBorders.lit,
      shadows: StudioShadows.hero,
      semanticLabel: 'متابعة ${entry.title}',
      padding: const EdgeInsets.all(StudioSpace.lg),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const StudioPill(
                  label: 'أكمل رسمتك',
                  icon: Icons.play_arrow_rounded,
                  background: Color(0x33FFFFFF),
                ),
                const SizedBox(height: StudioSpace.sm),
                Text(
                  'متابعة الرسم',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  entry.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.mutedText,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: StudioSpace.md),
          Container(
            width: 104,
            height: 104,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(StudioRadius.tile),
              border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
            ),
            child: Image.memory(
              entry.thumbnail,
              fit: BoxFit.cover,
              excludeFromSemantics: true,
              errorBuilder: (_, __, ___) => const ColoredBox(
                color: AppColors.cardSurface,
                child: Center(child: Icon(Icons.broken_image_outlined)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A single activity tile in the "اختر نشاطك الإبداعي" grid.
class StudioCategoryCard extends StatelessWidget {
  const StudioCategoryCard({
    required this.category,
    required this.onTap,
    this.itemCount,
    super.key,
  });

  final StudioCategory category;
  final VoidCallback onTap;

  /// Number of items behind this activity, or null when it is still loading or
  /// the activity opens a canvas directly.
  final int? itemCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final art = category.artAsset;
    final count = itemCount;

    return StudioSurface(
      onTap: onTap,
      gradient: category.gradient,
      radius: StudioRadius.tile,
      semanticLabel: count == null
          ? category.title
          : '${category.title} — $count نشاط',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (art != null)
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
                    child: Image.asset(
                      art,
                      fit: BoxFit.cover,
                      alignment: Alignment.center,
                      width: double.infinity,
                      height: double.infinity,
                      excludeFromSemantics: true,
                      // A missing cover must not break the grid: the gradient
                      // behind it is already a complete design.
                      errorBuilder: (_, __, ___) =>
                          _GlyphFill(icon: category.icon),
                    ),
                  )
                else
                  _GlyphFill(icon: category.icon),
                if (count != null && count > 0)
                  PositionedDirectional(
                    top: StudioSpace.xs,
                    end: StudioSpace.xs,
                    child: StudioPill(
                      label: '$count',
                      background: Colors.black.withValues(alpha: 0.35),
                    ),
                  ),
              ],
            ),
          ),
          Container(
            color: Colors.black.withValues(alpha: 0.30),
            padding: const EdgeInsets.symmetric(
              horizontal: StudioSpace.xs,
              vertical: StudioSpace.sm,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(category.icon, size: 15, color: Colors.white),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    category.title,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Gradient-only card face: a large translucent glyph plus a soft light source.
/// This is what every category shows until illustrated covers are approved.
class _GlyphFill extends StatelessWidget {
  const _GlyphFill({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(-0.5, -0.7),
              radius: 1.1,
              colors: [
                Colors.white.withValues(alpha: 0.18),
                Colors.transparent,
              ],
            ),
          ),
        ),
        Center(
          child: Icon(
            icon,
            size: 42,
            color: Colors.white.withValues(alpha: 0.92),
          ),
        ),
      ],
    );
  }
}

/// Achievements strip at the bottom of the studio home.
///
/// ## The number is real
///
/// There is no rewards backend, no coin balance and no prize catalogue in this
/// product, so this strip does not pretend otherwise. The rule it displays is
/// one a child can verify: one finished drawing is one star, counted from the
/// drawings actually saved on this device. Milestones are local too. If a real
/// rewards service ships later this widget takes its numbers instead — but until
/// then it shows nothing it cannot prove, which is the same reason the home feed
/// stopped rendering its hardcoded learning-journey progress.
class StudioAchievementStrip extends StatelessWidget {
  const StudioAchievementStrip({
    required this.savedDrawings,
    this.onTap,
    super.key,
  });

  final int savedDrawings;
  final VoidCallback? onTap;

  static const List<int> _milestones = <int>[3, 5, 10, 20, 40, 80];

  int get _nextMilestone => _milestones.firstWhere(
    (milestone) => milestone > savedDrawings,
    orElse: () => _milestones.last,
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final target = _nextMilestone;
    final remaining = (target - savedDrawings).clamp(0, target);
    final progress = target == 0
        ? 0.0
        : (savedDrawings / target).clamp(0.0, 1.0);

    final message = savedDrawings == 0
        ? 'أنجز رسمتك الأولى واكسب نجمتك الأولى'
        : remaining == 0
        ? 'أكملت كل المراحل — استمر في الرسم!'
        : 'كل رسمة تكملها نجمة — باقي $remaining للمرحلة التالية';

    return StudioSurface(
      onTap: onTap,
      gradient: StudioGradients.achievement,
      radius: StudioRadius.strip,
      semanticLabel:
          'نجوم الإبداع: $savedDrawings من $target. $message',
      padding: const EdgeInsets.all(StudioSpace.md),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.starGold.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(StudioRadius.tile),
            ),
            child: const Icon(
              Icons.emoji_events_rounded,
              color: AppColors.starGold,
              size: 24,
            ),
          ),
          const SizedBox(width: StudioSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'نجوم الإبداع',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: AppColors.starlight,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: AppColors.dimText,
                  ),
                ),
                const SizedBox(height: StudioSpace.sm),
                Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 16,
                      color: AppColors.starGold,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        '$savedDrawings / $target',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: AppColors.starGold,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    const SizedBox(width: StudioSpace.sm),
                    Expanded(
                      flex: 3,
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(StudioRadius.pill),
                        child: SizedBox(
                          height: 8,
                          child: Stack(
                            children: [
                              ColoredBox(
                                color: Colors.white.withValues(alpha: 0.10),
                                child: const SizedBox.expand(),
                              ),
                              FractionallySizedBox(
                                widthFactor: progress == 0 ? 0.02 : progress,
                                child: const DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: StudioGradients.progressFill,
                                  ),
                                  child: SizedBox.expand(),
                                ),
                              ),
                            ],
                          ),
                        ),
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

/// Loading, error and empty placeholders shared by the category pages.
class StudioStateCard extends StatelessWidget {
  const StudioStateCard({
    required this.icon,
    required this.title,
    this.body,
    this.actionLabel,
    this.onAction,
    super.key,
  });

  factory StudioStateCard.loading() => const StudioStateCard(
    icon: Icons.hourglass_empty_rounded,
    title: 'جاري التحميل…',
  );

  final IconData icon;
  final String title;
  final String? body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bodyText = body;
    final label = actionLabel;
    return StudioSurface(
      color: AppColors.cardSurface,
      radius: StudioRadius.card,
      padding: const EdgeInsets.all(StudioSpace.xl),
      child: Column(
        children: [
          Icon(icon, size: 40, color: AppColors.electricCyan),
          const SizedBox(height: StudioSpace.sm),
          Text(
            title,
            textAlign: TextAlign.center,
            style: theme.textTheme.titleSmall?.copyWith(
              color: AppColors.starlight,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (bodyText != null) ...[
            const SizedBox(height: StudioSpace.xs),
            Text(
              bodyText,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: AppColors.dimText,
              ),
            ),
          ],
          if (label != null && onAction != null) ...[
            const SizedBox(height: StudioSpace.md),
            FilledButton.tonalIcon(
              onPressed: onAction,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(label),
            ),
          ],
        ],
      ),
    );
  }
}
