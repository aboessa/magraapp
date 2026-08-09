import 'dart:async';

import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../core/widgets/focusable_scale.dart';
import '../../domain/content_models.dart';
import 'home_v2_tokens.dart';

/// Full-bleed cinematic billboard, the anchor of the v2 home.
///
/// Layout differs by surface rather than being one design stretched:
///  * phone  — portrait artwork, copy stacked over a bottom scrim
///  * tablet — landscape artwork, copy in a side column over a lateral scrim
///  * TV     — same side layout, larger type, focusable actions
///
/// The active slide's planet colour is pushed up through [onAccentChanged] so
/// the surrounding [HomeAmbientStage] can re-light with the artwork.
class HomeBillboard extends StatefulWidget {
  const HomeBillboard({
    required this.items,
    required this.metrics,
    required this.onPlay,
    required this.onDetails,
    required this.onAccentChanged,
    this.autofocus = false,
    super.key,
  });

  final List<BillboardItem> items;
  final HomeV2Metrics metrics;
  final ValueChanged<BillboardItem> onPlay;
  final ValueChanged<BillboardItem> onDetails;
  final ValueChanged<Color> onAccentChanged;
  final bool autofocus;

  @override
  State<HomeBillboard> createState() => _HomeBillboardState();
}

class _HomeBillboardState extends State<HomeBillboard> {
  late final PageController _controller;
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _controller = PageController();
    // Publish the first accent after mount; doing it during build would mutate
    // an ancestor mid-frame.
    WidgetsBinding.instance.addPostFrameCallback((_) => _publishAccent());
    _restartTimer();
  }

  @override
  void didUpdateWidget(HomeBillboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Catalog swaps (e.g. switching child profile) can shrink the list under us.
    if (_index >= widget.items.length && widget.items.isNotEmpty) {
      _index = 0;
      if (_controller.hasClients) _controller.jumpToPage(0);
      _publishAccent();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _restartTimer() {
    _timer?.cancel();
    if (widget.items.length < 2) return;
    _timer = Timer.periodic(const Duration(seconds: 9), (_) {
      if (!mounted || !_controller.hasClients) return;
      final next = (_index + 1) % widget.items.length;
      if (MediaQuery.disableAnimationsOf(context)) {
        _controller.jumpToPage(next);
      } else {
        _controller.animateToPage(
          next,
          duration: const Duration(milliseconds: 620),
          curve: Curves.easeOutCubic,
        );
      }
    });
  }

  void _publishAccent() {
    if (!mounted || widget.items.isEmpty) return;
    widget.onAccentChanged(widget.items[_index].accent);
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();

    final metrics = widget.metrics;
    final size = MediaQuery.sizeOf(context);
    final height = (size.height * metrics.billboardHeightFactor).clamp(
      340.0,
      metrics.isTelevision ? 720.0 : 620.0,
    );
    final sideLayout = metrics.isTelevision || metrics.isTablet;

    return SizedBox(
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.items.length,
            onPageChanged: (value) {
              setState(() => _index = value);
              _publishAccent();
              _restartTimer();
            },
            itemBuilder: (context, index) => _BillboardArtwork(
              item: widget.items[index],
              sideLayout: sideLayout,
            ),
          ),
          // Copy sits outside the PageView so it does not slide with artwork:
          // the text crossfades while the image pans, which reads as one
          // composed frame rather than a carousel.
          Positioned.fill(
            child: IgnorePointer(
              ignoring: false,
              child: _BillboardCopy(
                item: widget.items[_index],
                metrics: metrics,
                sideLayout: sideLayout,
                autofocus: widget.autofocus,
                onPlay: () => widget.onPlay(widget.items[_index]),
                onDetails: () => widget.onDetails(widget.items[_index]),
              ),
            ),
          ),
          if (widget.items.length > 1)
            PositionedDirectional(
              start: metrics.pagePadding,
              bottom: metrics.isTelevision ? 30 : 18,
              child: _BillboardDots(
                count: widget.items.length,
                index: _index,
                accent: widget.items[_index].accent,
              ),
            ),
        ],
      ),
    );
  }
}

/// A resolved billboard entry: artwork plus the copy that goes over it.
class BillboardItem {
  const BillboardItem({
    required this.series,
    required this.accent,
    required this.eyebrow,
    required this.actionLabel,
  });

  final SeriesItem series;
  final Color accent;
  final String eyebrow;
  final String actionLabel;
}

class _BillboardArtwork extends StatelessWidget {
  const _BillboardArtwork({required this.item, required this.sideLayout});

  final BillboardItem item;
  final bool sideLayout;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    return Stack(
      fit: StackFit.expand,
      children: [
        CinematicImage(
          // Banner art is landscape; on phones the poster fills the tall frame
          // far better than a letterboxed banner would.
          assetPath: sideLayout ? item.series.bannerAsset : item.series.posterAsset,
          networkUrl: item.series.coverUrl,
          semanticLabel: 'غلاف ${item.series.title}',
          fit: BoxFit.cover,
          decodeWidth: width,
        ),
        // Bottom scrim always present so the feed below can overlap cleanly.
        const DecoratedBox(
          decoration: BoxDecoration(gradient: AppColors.heroScrimMobile),
        ),
        // Lateral scrim only where copy sits beside the art.
        if (sideLayout)
          const DecoratedBox(
            decoration: BoxDecoration(gradient: AppColors.heroScrimSide),
          ),
      ],
    );
  }
}

class _BillboardCopy extends StatelessWidget {
  const _BillboardCopy({
    required this.item,
    required this.metrics,
    required this.sideLayout,
    required this.autofocus,
    required this.onPlay,
    required this.onDetails,
  });

  final BillboardItem item;
  final HomeV2Metrics metrics;
  final bool sideLayout;
  final bool autofocus;
  final VoidCallback onPlay;
  final VoidCallback onDetails;

  @override
  Widget build(BuildContext context) {
    final series = item.series;
    final isTv = metrics.isTelevision;
    final titleSize = isTv ? 46.0 : (sideLayout ? 34.0 : 28.0);

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: sideLayout
          ? CrossAxisAlignment.start
          : CrossAxisAlignment.center,
      children: [
        _Eyebrow(text: item.eyebrow, accent: item.accent),
        SizedBox(height: isTv ? 14 : 10),
        Text(
          series.title,
          textAlign: sideLayout ? TextAlign.start : TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Colors.white,
            fontSize: titleSize,
            height: 1.14,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.6,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.6),
                blurRadius: 18,
              ),
            ],
          ),
        ),
        SizedBox(height: isTv ? 12 : 8),
        _MetaRow(series: series, isTv: isTv, centered: !sideLayout),
        SizedBox(height: isTv ? 14 : 10),
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: isTv ? 640 : 480),
          child: Text(
            series.description,
            textAlign: sideLayout ? TextAlign.start : TextAlign.center,
            maxLines: sideLayout ? 3 : 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.82),
              fontSize: isTv ? 16 : 13,
              height: 1.7,
            ),
          ),
        ),
        SizedBox(height: isTv ? 26 : 18),
        _BillboardActions(
          isTv: isTv,
          actionLabel: item.actionLabel,
          autofocus: autofocus,
          onPlay: onPlay,
          onDetails: onDetails,
        ),
      ],
    );

    if (!sideLayout) {
      return Padding(
        padding: EdgeInsets.fromLTRB(
          metrics.pagePadding,
          0,
          metrics.pagePadding,
          46,
        ),
        child: Align(alignment: Alignment.bottomCenter, child: content),
      );
    }

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        metrics.pagePadding,
        0,
        metrics.pagePadding,
        isTv ? 58 : 40,
      ),
      child: Align(
        alignment: AlignmentDirectional.bottomStart,
        child: FractionallySizedBox(
          widthFactor: isTv ? 0.52 : 0.62,
          child: content,
        ),
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow({required this.text, required this.accent});

  final String text;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: accent.withValues(alpha: 0.5)),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: Color.lerp(accent, Colors.white, 0.55),
          fontSize: 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({
    required this.series,
    required this.isTv,
    required this.centered,
  });

  final SeriesItem series;
  final bool isTv;
  final bool centered;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      color: Colors.white.withValues(alpha: 0.9),
      fontSize: isTv ? 14 : 11.5,
      fontWeight: FontWeight.w600,
    );

    return Wrap(
      alignment: centered ? WrapAlignment.center : WrapAlignment.start,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 8,
      runSpacing: 6,
      children: [
        if (series.isFree)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.success,
              borderRadius: BorderRadius.circular(5),
            ),
            child: Text(
              'مجاني',
              style: TextStyle(
                color: AppColors.abyss,
                fontSize: isTv ? 12 : 10,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        Text(series.ageLabel, style: style),
        _Dot(isTv: isTv),
        Text('${series.episodesCount} حلقة', style: style),
        _Dot(isTv: isTv),
        Text(series.planetName, style: style),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.isTv});
  final bool isTv;

  @override
  Widget build(BuildContext context) => Container(
    width: isTv ? 4 : 3,
    height: isTv ? 4 : 3,
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: 0.45),
      shape: BoxShape.circle,
    ),
  );
}

class _BillboardActions extends StatelessWidget {
  const _BillboardActions({
    required this.isTv,
    required this.actionLabel,
    required this.autofocus,
    required this.onPlay,
    required this.onDetails,
  });

  final bool isTv;
  final String actionLabel;
  final bool autofocus;
  final VoidCallback onPlay;
  final VoidCallback onDetails;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        _BillboardButton(
          label: actionLabel,
          icon: Icons.play_arrow_rounded,
          filled: true,
          isTv: isTv,
          autofocus: autofocus,
          onPressed: onPlay,
        ),
        _BillboardButton(
          label: 'التفاصيل',
          icon: Icons.info_outline_rounded,
          filled: false,
          isTv: isTv,
          onPressed: onDetails,
        ),
      ],
    );
  }
}

/// Billboard action built on [FocusableScale] so it is remote-navigable.
class _BillboardButton extends StatelessWidget {
  const _BillboardButton({
    required this.label,
    required this.icon,
    required this.filled,
    required this.isTv,
    required this.onPressed,
    this.autofocus = false,
  });

  final String label;
  final IconData icon;
  final bool filled;
  final bool isTv;
  final VoidCallback onPressed;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final height = isTv ? 56.0 : 46.0;
    final radius = BorderRadius.circular(height / 2);

    return FocusableScale(
      onPressed: onPressed,
      semanticLabel: label,
      autofocus: autofocus,
      borderRadius: radius,
      focusScale: 1.06,
      child: Container(
        height: height,
        padding: EdgeInsets.symmetric(horizontal: isTv ? 30 : 22),
        decoration: BoxDecoration(
          color: filled
              ? Colors.white
              : AppColors.abyss.withValues(alpha: 0.58),
          borderRadius: radius,
          border: filled
              ? null
              : Border.all(color: Colors.white.withValues(alpha: 0.28)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: isTv ? 26 : 21,
              color: filled ? AppColors.abyss : Colors.white,
            ),
            SizedBox(width: isTv ? 10 : 7),
            Text(
              label,
              style: TextStyle(
                color: filled ? AppColors.abyss : Colors.white,
                fontSize: isTv ? 17 : 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BillboardDots extends StatelessWidget {
  const _BillboardDots({
    required this.count,
    required this.index,
    required this.accent,
  });

  final int count;
  final int index;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'العرض ${index + 1} من $count',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: HomeV2Tokens.focusAnim,
              margin: const EdgeInsetsDirectional.only(end: 6),
              width: i == index ? 26 : 7,
              height: 4,
              decoration: BoxDecoration(
                color: i == index
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.34),
                borderRadius: BorderRadius.circular(99),
              ),
            ),
        ],
      ),
    );
  }
}
