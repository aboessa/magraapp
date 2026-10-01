import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../profile/data/watchlist_store.dart';
import '../../domain/content_models.dart';
import 'tv_hero_trailer.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

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
  // APP-204: on TV a slide stays long enough for its 12 s preview to play.
  Duration get _autoAdvanceDelay =>
      Duration(seconds: widget.isTelevision ? 14 : 8);

  late final PageController _pageController;
  late List<_ResolvedSpotlight> _items;
  Timer? _autoAdvanceTimer;
  int _activeIndex = 0;
  bool? _reducedMotion;

  @override
  void initState() {
    super.initState();
    _items = _resolveSpotlights();
    if (_items.isEmpty) {
      _activeIndex = 0;
    } else if (_items.length > 1) {
      // Guard empty-first: 0 → nextInt(0) throws RangeError max 0 on web (js_primitives.dart:28)
      _activeIndex = Random().nextInt(_items.length);
    } else {
      _activeIndex = 0; // exactly 1 item — no randomization needed
    }
    _pageController = PageController(
      initialPage: _activeIndex.clamp(0, (_items.length - 1).clamp(0, 999)),
    );
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
    // أيّ ماستر يُرسَم — طوليّ 3:4 أم عريض 16:9 — يقرّره [_useBannerMaster]،
    // ويطابقه هنا: صندوقٌ بنسبة الفنّ نفسها، فلا شريطٌ أسود ولا قصّ. القياس
    // على الإنتاج: البوستر 1200×1600 (0.75) والبانر 1920×1080 (1.778) لكل
    // السلاسل المنشورة الخمس عشرة — لا تخمينًا.
    final useBanner = _useBannerMaster(
      isTelevision: widget.isTelevision,
      compact: compact,
    );
    final viewportHeight = MediaQuery.sizeOf(context).height;
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final height = useBanner
        ? (widget.isTelevision ? (viewportHeight - 130) : viewportHeight * 0.58)
              .clamp(300.0, widget.isTelevision ? 570.0 : 460.0)
        // البوستر: العرض يحكم لا الارتفاع، فالصندوق يتّبع 3:4 تمامًا مهما
        // اختلف طول الشاشة. الحدّان الأعلى والأدنى يمنعان صندوقًا هائلًا على
        // جهازٍ لوحيّ ضيق طويل أو ضئيلًا على هاتفٍ قصير.
        : (viewportWidth * (4 / 3)).clamp(440.0, 620.0);

    return Semantics(
      container: true,
      label: AppLocalizationsAr().homecinematicheroLabel01,
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
                useBannerMaster: useBanner,
                isActive: index == _activeIndex,
                onOpenSeries: () => widget.onOpenSeries(_items[index].series),
              ),
            ),
            if (_items.length > 1)
              Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: EdgeInsets.only(
                    bottom: widget.isTelevision ? 18 : 12,
                  ),
                  child: _SliderProgress(
                    count: _items.length,
                    activeIndex: _activeIndex,
                    autoAdvance: _autoAdvanceTimer != null
                        ? _autoAdvanceDelay
                        : null,
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

/// أيّ ماستر فنّي يناسب هذا التخطيط، بلا قصّ ولا فراغ.
///
/// القاعدة: صندوقٌ ضيّق (هاتف) يأخذ البوستر الطوليّ 3:4 لأن نسبته قريبة من
/// نسبة الصندوق، وصندوقٌ عريض (جهاز لوحيّ أو تلفاز) يأخذ البانر 16:9 للسبب
/// نفسه بالضبط. القرار من فئة التخطيط لا من حجم الشاشة الخام، لأنها ما
/// يستعمله باقي التطبيق لتمييز الهاتف عن الجهاز اللوحي (‏`app_layout.dart`).
bool _useBannerMaster({required bool isTelevision, required bool compact}) {
  if (isTelevision) return true;
  return !compact;
}

class _CinematicSlide extends StatelessWidget {
  const _CinematicSlide({
    required this.item,
    required this.compact,
    required this.isTelevision,
    required this.useBannerMaster,
    required this.onOpenSeries,
    this.isActive = false,
  });

  /// Only the slide on screen may start a preview.
  final bool isActive;
  final _ResolvedSpotlight item;
  final bool compact;
  final bool isTelevision;
  final bool useBannerMaster;
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
          isTelevision ? 54 : 34,
        ),
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: isTelevision ? 700 : 570),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _Eyebrow(label: item.spotlight.eyebrow),
              const SizedBox(height: 10),
              Text(
                series.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    (isTelevision
                            ? Theme.of(context).textTheme.displayLarge
                            : compact
                            ? const TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                height: 1.15,
                              )
                            : Theme.of(context).textTheme.displayMedium)
                        ?.copyWith(
                          shadows: const [
                            Shadow(
                              color: Colors.black,
                              blurRadius: 24,
                              offset: Offset(0, 3),
                            ),
                            Shadow(color: Colors.black87, blurRadius: 10),
                          ],
                        ),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _MetaBadge(label: series.ageLabel),
                  if (series.episodesCount > 0)
                    _MetaBadge(label: '${series.episodesCount} حلقات'),
                  if (series.isFree)
                    const _MetaBadge(label: 'مجاني', isHighlight: true),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                series.description,
                maxLines: compact ? 2 : 3,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.88),
                  fontSize: compact ? 12.5 : 14,
                  height: 1.45,
                  shadows: const [
                    Shadow(color: Colors.black87, blurRadius: 12),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: Container(
                      height: 46,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFFFFDF7D), Color(0xFFFFB52E)],
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                        ),
                        borderRadius: BorderRadius.circular(23),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.starGold.withValues(alpha: 0.35),
                            blurRadius: 16,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: onOpenSeries,
                          borderRadius: BorderRadius.circular(23),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(
                                Icons.play_arrow_rounded,
                                color: Color(0xFF0B1026),
                                size: 24,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                item.spotlight.primaryActionLabel,
                                style: const TextStyle(
                                  color: Color(0xFF0B1026),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: _WatchlistButton(
                      seriesId: series.id,
                      title: series.title,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );

    final bloomColor = _accentForPlanet(series.planetId ?? 'abjad');
    return Semantics(
      label: '${series.title}، ${item.spotlight.eyebrow}',
      child: Container(
        margin: EdgeInsets.symmetric(
          horizontal: isTelevision ? padding : padding * 0.85,
          vertical: isTelevision ? 0 : 8,
        ),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(isTelevision ? 24 : 22),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.1),
            width: 1.2,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.55),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // خلفية توهج خفيفة من الكوكب
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.15, -0.15),
                    radius: 1.2,
                    colors: [
                      bloomColor.withValues(alpha: 0.15),
                      Colors.transparent,
                    ],
                    stops: const [0, 1],
                  ),
                ),
              ),
            ),
            ExcludeSemantics(
              child: CinematicImage(
                networkUrl: useBannerMaster
                    ? (series.bannerUrl ?? series.coverUrl)
                    : (series.coverUrl ?? series.bannerUrl),
                assetPath: useBannerMaster
                    ? series.bannerAsset
                    : series.posterAsset,
                semanticLabel: 'مشهد من ${series.title}',
                alignment: Alignment.center,
              ),
            ),
            // APP-204: muted preview over the banner, on TV, active slide only.
            if (isTelevision && isActive)
              Positioned.fill(
                child: TvHeroTrailer(
                  key: ValueKey('trailer-${series.id}'),
                  seriesId: series.id,
                ),
              ),
            // حاجب سينمائي نقي:
            // النصف العلوي (40%) شفاف بالكامل لضمان أقصى نقاء وتشبع للصورة دون أي ضبابية أو تبييض.
            // والتدرج السفلي فقط ينساب بسلاسة إلى خلفية التطبيق لضمان قراءة النص والأزرار.
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.transparent,
                      Color(0x2E06091A),
                      Color(0x8C06091A),
                      Color(0xED06091A),
                      Color(0xFF06091A),
                    ],
                    stops: [0.0, 0.40, 0.62, 0.80, 0.94, 1.0],
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

/// زرّ «في قائمتي» في الهيرو بنمط تطبيقات البث الاحترافية.
class _WatchlistButton extends ConsumerWidget {
  const _WatchlistButton({required this.seriesId, required this.title});

  final String seriesId;
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(watchlistProvider).contains(seriesId);
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: saved
            ? AppColors.starGold.withValues(alpha: 0.2)
            : Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(23),
        border: Border.all(
          color: saved
              ? AppColors.starGold.withValues(alpha: 0.6)
              : Colors.white.withValues(alpha: 0.2),
          width: 1.2,
        ),
        boxShadow: [
          if (saved)
            BoxShadow(
              color: AppColors.starGold.withValues(alpha: 0.25),
              blurRadius: 12,
            ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(23),
          onTap: () => ref.read(watchlistProvider.notifier).toggle(seriesId),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  saved ? Icons.check_rounded : Icons.add_rounded,
                  color: saved ? AppColors.starGold : Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 5),
                Flexible(
                  child: Text(
                    saved ? 'في قائمتي' : 'قائمتي',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: saved ? AppColors.starGold : Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// مؤشّر الشرائح بتصميم كبسولة زجاجية عائمة.
class _SliderProgress extends StatelessWidget {
  const _SliderProgress({
    required this.count,
    required this.activeIndex,
    required this.autoAdvance,
    required this.onSelected,
  });

  final int count;
  final int activeIndex;
  final Duration? autoAdvance;
  final ValueChanged<int> onSelected;

  static const double _activeWidth = 24;
  static const double _dotWidth = 6;
  static const double _trackHeight = 4;

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      label: 'اختيار القصة المعروضة',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.38),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
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
                  duration: reducedMotion
                      ? Duration.zero
                      : const Duration(milliseconds: 260),
                  curve: Curves.easeOutCubic,
                  width: selected ? _activeWidth : _dotWidth,
                  height: _trackHeight,
                  margin: const EdgeInsets.symmetric(horizontal: 2.5),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    color: selected
                        ? AppColors.starGold
                        : Colors.white.withValues(alpha: 0.35),
                  ),
                  child: selected
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(99),
                          child: _AutoAdvanceFill(
                            key: ValueKey(activeIndex),
                            duration: reducedMotion ? null : autoAdvance,
                          ),
                        )
                      : null,
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _AutoAdvanceFill extends StatelessWidget {
  const _AutoAdvanceFill({required this.duration, super.key});

  final Duration? duration;

  @override
  Widget build(BuildContext context) {
    final bar = Align(
      alignment: AlignmentDirectional.centerStart,
      child: FractionallySizedBox(
        widthFactor: 1,
        child: ColoredBox(color: AppColors.starGold),
      ),
    );
    if (duration == null) return bar;
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0, end: 1),
      duration: duration!,
      curve: Curves.linear,
      builder: (context, value, _) => Align(
        alignment: AlignmentDirectional.centerStart,
        child: FractionallySizedBox(
          widthFactor: value.clamp(0.0, 1.0),
          child: const ColoredBox(color: AppColors.starGold),
        ),
      ),
    );
  }
}

class _Eyebrow extends StatelessWidget {
  const _Eyebrow({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.starGold.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.starGold.withValues(alpha: 0.38),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.auto_awesome_rounded,
            color: AppColors.starGold,
            size: 14,
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.starGold,
                fontSize: 12,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.15,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaBadge extends StatelessWidget {
  const _MetaBadge({required this.label, this.isHighlight = false});

  final String label;
  final bool isHighlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: isHighlight
            ? AppColors.electricCyan.withValues(alpha: 0.15)
            : const Color(0xFF06091A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: isHighlight
              ? AppColors.electricCyan.withValues(alpha: 0.5)
              : Colors.white.withValues(alpha: 0.18),
          width: 1,
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isHighlight
              ? AppColors.electricCyan
              : Colors.white.withValues(alpha: 0.9),
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
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
