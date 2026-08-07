import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../domain/content_models.dart';

/// A curated home hero. Randomness is limited to the enabled editorial
/// spotlight list; it never chooses blindly from the full content catalog.
class CinematicHeroSlider extends StatefulWidget {
  const CinematicHeroSlider({
    required this.spotlights,
    required this.series,
    required this.isTelevision,
    required this.onOpenSeries,
    super.key,
  });

  final List<HomeSpotlight> spotlights;
  final List<SeriesItem> series;
  final bool isTelevision;
  final ValueChanged<SeriesItem> onOpenSeries;

  @override
  State<CinematicHeroSlider> createState() => _CinematicHeroSliderState();
}

class _CinematicHeroSliderState extends State<CinematicHeroSlider> {
  static const _autoAdvanceDelay = Duration(seconds: 8);

  late final PageController _pageController;
  late List<_ResolvedSpotlight> _items;
  Timer? _autoAdvanceTimer;
  int _activeIndex = 0;
  bool? _reducedMotion;

  @override
  void initState() {
    super.initState();
    _items = _resolveSpotlights();
    if (_items.length > 1) {
      _activeIndex = Random().nextInt(_items.length);
    }
    _pageController = PageController(initialPage: _activeIndex);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    if (_reducedMotion != reducedMotion) {
      _reducedMotion = reducedMotion;
      _configureAutoAdvance();
    }
  }

  @override
  void didUpdateWidget(covariant CinematicHeroSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.spotlights != widget.spotlights ||
        oldWidget.series != widget.series) {
      _items = _resolveSpotlights();
      if (_activeIndex >= _items.length) _activeIndex = 0;
      _configureAutoAdvance();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _pageController.hasClients && _items.isNotEmpty) {
          _pageController.jumpToPage(_activeIndex);
        }
      });
    }
  }

  @override
  void dispose() {
    _autoAdvanceTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  List<_ResolvedSpotlight> _resolveSpotlights() {
    final resolved = <_ResolvedSpotlight>[];
    for (final spotlight in widget.spotlights.where((item) => item.enabled)) {
      SeriesItem? series;
      for (final candidate in widget.series) {
        if (candidate.id == spotlight.seriesId) {
          series = candidate;
          break;
        }
      }
      if (series != null) {
        resolved.add(_ResolvedSpotlight(spotlight: spotlight, series: series));
      }
    }
    return resolved;
  }

  void _configureAutoAdvance() {
    _autoAdvanceTimer?.cancel();
    if (_reducedMotion == true || _items.length < 2) return;

    _autoAdvanceTimer = Timer.periodic(_autoAdvanceDelay, (_) {
      if (!mounted || !_pageController.hasClients || _items.isEmpty) return;
      final next = (_activeIndex + 1) % _items.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 620),
        curve: Curves.easeInOutCubic,
      );
    });
  }

  void _onPageChanged(int index) {
    setState(() => _activeIndex = index);
    _configureAutoAdvance();
  }

  @override
  Widget build(BuildContext context) {
    if (_items.isEmpty) return const SizedBox.shrink();

    final compact = context.layoutClass == AppLayoutClass.compact;
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final height = widget.isTelevision
        ? (viewportHeight - 130).clamp(420.0, 570.0)
        : (compact ? viewportHeight * 0.68 : viewportHeight * 0.58).clamp(
            408.0,
            compact ? 560.0 : 600.0,
          );
    final horizontalPadding = context.horizontalPagePadding;

    return Semantics(
      container: true,
      label: 'قصص مجرة المختارة',
      child: SizedBox(
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            PageView.builder(
              controller: _pageController,
              itemCount: _items.length,
              allowImplicitScrolling: true,
              onPageChanged: _onPageChanged,
              itemBuilder: (context, index) => _CinematicSlide(
                item: _items[index],
                compact: compact,
                isTelevision: widget.isTelevision,
                onOpenSeries: () => widget.onOpenSeries(_items[index].series),
              ),
            ),
            if (_items.length > 1)
              Align(
                alignment: AlignmentDirectional.bottomEnd,
                child: Padding(
                  padding: EdgeInsetsDirectional.only(
                    end: horizontalPadding,
                    bottom: widget.isTelevision ? 28 : 20,
                  ),
                  child: _SliderProgress(
                    count: _items.length,
                    activeIndex: _activeIndex,
                    onSelected: (index) {
                      _pageController.animateToPage(
                        index,
                        duration: const Duration(milliseconds: 340),
                        curve: Curves.easeOutCubic,
                      );
                    },
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _CinematicSlide extends StatelessWidget {
  const _CinematicSlide({
    required this.item,
    required this.compact,
    required this.isTelevision,
    required this.onOpenSeries,
  });

  final _ResolvedSpotlight item;
  final bool compact;
  final bool isTelevision;
  final VoidCallback onOpenSeries;

  @override
  Widget build(BuildContext context) {
    final series = item.series;
    final padding = context.horizontalPagePadding;
    final copy = Align(
      alignment: AlignmentDirectional.bottomStart,
      child: Padding(
        padding: EdgeInsetsDirectional.fromSTEB(
          padding,
          24,
          padding,
          isTelevision ? 54 : 44,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: isTelevision ? 700 : 570),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Eyebrow(label: item.spotlight.eyebrow),
              const SizedBox(height: 13),
              Text(
                series.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    (isTelevision
                            ? Theme.of(context).textTheme.displayLarge
                            : compact
                            ? Theme.of(context).textTheme.displayMedium
                            : Theme.of(context).textTheme.displayLarge)
                        ?.copyWith(
                          shadows: const [
                            Shadow(color: Colors.black87, blurRadius: 18),
                          ],
                        ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _MetaChip(label: series.ageLabel),
                  _MetaChip(
                    label: series.episodesCount > 0
                        ? '${series.episodesCount} حلقات'
                        : 'سلسلة جديدة',
                  ),
                  if (series.isFree) const _MetaChip(label: 'مجاني'),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                series.description,
                maxLines: compact ? 2 : 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: AppColors.starlight.withValues(alpha: 0.9),
                  shadows: const [
                    Shadow(color: Colors.black87, blurRadius: 12),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 46,
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
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: onOpenSeries,
                          borderRadius: BorderRadius.circular(24),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.play_arrow_rounded,
                                color: Color(0xFF0B1026),
                                size: 22,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                item.spotlight.primaryActionLabel,
                                style: const TextStyle(
                                  color: Color(0xFF0B1026),
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.14),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.22),
                      ),
                    ),
                    child: IconButton(
                      onPressed: onOpenSeries,
                      icon: const Icon(
                        Icons.add_rounded,
                        color: Colors.white,
                        size: 22,
                      ),
                      padding: EdgeInsets.zero,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    // Bloom مستخرج من لون الكوكب 8-18% - MAJARRA_CINEMATIC_STREAMING_UX_PLAN.md:108
    final bloomColor = _accentForPlanet(series.planetId ?? 'abjad');
    return Semantics(
      label: '${series.title}، ${item.spotlight.eyebrow}',
      child: Container(
        margin: EdgeInsets.symmetric(
          horizontal: isTelevision ? padding : padding * 0.85,
          vertical: isTelevision ? 0 : 8,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(isTelevision ? 24 : 20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          boxShadow: AppColors.heroShadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Bloom خلف الصورة
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.15, -0.15),
                    radius: 1.1,
                    colors: [bloomColor.withValues(alpha: 0.22), bloomColor.withValues(alpha: 0.06), Colors.transparent],
                    stops: const [0, 0.35, 1],
                  ),
                ),
              ),
            ),
            ExcludeSemantics(
              child: CinematicImage(
                networkUrl: series.coverUrl,
                assetPath: series.bannerAsset,
                semanticLabel: 'مشهد من ${series.title}',
                alignment: const Alignment(0.15, 0),
              ),
            ),
            // Premium cinematic scrim - like Haikyu banner
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x0A06091A),
                    Color(0x1A06091A),
                    Color(0x8006091A),
                    Color(0xF506091A),
                  ],
                  stops: [0, 0.35, 0.62, 1],
                ),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: AlignmentDirectional.centerStart,
                  end: AlignmentDirectional.centerEnd,
                  colors: [
                    Color(0xF506091A),
                    Color(0x8A06091A),
                    Color(0x1406091A),
                  ],
                  stops: const [0, 0.52, 1],
                ),
              ),
            ),
            // Subtle top highlight
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.center,
                    colors: [
                      Colors.white.withValues(alpha: 0.04),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            _enterWithMotion(context, copy),
          ],
        ),
      ),
    );
  }
}

class _SliderProgress extends StatelessWidget {
  const _SliderProgress({
    required this.count,
    required this.activeIndex,
    required this.onSelected,
  });

  final int count;
  final int activeIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'اختيار القصة المعروضة',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(count, (index) {
          final selected = index == activeIndex;
          return Semantics(
            button: true,
            selected: selected,
            label: 'القصة ${index + 1} من $count',
            child: GestureDetector(
              onTap: () => onSelected(index),
              child: AnimatedContainer(
                duration: MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                width: selected ? 23 : 7,
                height: 7,
                margin: const EdgeInsetsDirectional.only(start: 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  color: selected
                      ? AppColors.starGold
                      : AppColors.starlight.withValues(alpha: 0.45),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(
          Icons.auto_awesome_rounded,
          color: AppColors.starGold,
          size: 19,
        ),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.starGold,
              letterSpacing: 0.15,
            ),
          ),
        ),
      ],
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.deepSpace.withValues(alpha: 0.74),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: AppColors.starlight.withValues(alpha: 0.2)),
      ),
      child: Text(label, style: Theme.of(context).textTheme.labelMedium),
    );
  }
}

Widget _enterWithMotion(BuildContext context, Widget child) {
  if (MediaQuery.disableAnimationsOf(context)) return child;
  return child
      .animate()
      .fadeIn(duration: 380.ms, curve: Curves.easeOutCubic)
      .slideY(
        begin: 0.055,
        end: 0,
        duration: 480.ms,
        curve: Curves.easeOutCubic,
      );
}

Color _accentForPlanet(String planetId) {
  return switch (planetId) {
    'abjad' => const Color(0xFF2580FF),
    'arqam' => const Color(0xFFFFB52E),
    'oloom' => const Color(0xFF32C979),
    'qiyam' => const Color(0xFFFF6FAE),
    'qisas' => const Color(0xFF9D68FF),
    'ibdaa' => const Color(0xFF6A3DF2),
    'maharat' => const Color(0xFF00BFA6),
    'tarikh' => const Color(0xFFD9903D),
    'iman' => const Color(0xFF2FBF8F),
    _ => AppColors.cosmicPurple,
  };
}

class _ResolvedSpotlight {
  const _ResolvedSpotlight({required this.spotlight, required this.series});

  final HomeSpotlight spotlight;
  final SeriesItem series;
}
