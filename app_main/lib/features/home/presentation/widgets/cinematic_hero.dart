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
    if (_items.isEmpty) {
      _activeIndex = 0;
    } else if (_items.length > 1) {
      // Guard empty-first: 0 → nextInt(0) throws RangeError max 0 on web (js_primitives.dart:28)
      _activeIndex = Random().nextInt(_items.length);
    } else {
      _activeIndex = 0; // exactly 1 item — no randomization needed
    }
    _pageController = PageController(initialPage: _activeIndex.clamp(0, (_items.length - 1).clamp(0, 999)));
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
                    // مدّة التقدّم التلقائي، أو `null` حين لا تقدّم — فالشريط
                    // يمتلئ فعلًا بقدر ما بقي، ولا يكذب امتلاءً حين يكون
                    // الدوّار متوقّفًا (حركة مُقلَّلة، أو شريحة واحدة).
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
                  _WatchlistButton(seriesId: series.id, title: series.title),
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
            // `bannerUrl` لا `coverUrl`.
            //
            // البانر عريض 16:9 والبوستر طوليّ. وكان هذا السطر يقرأ البوستر
            // فيُمَدّ في صندوقٍ عريض — وهو سبب أن الهيرو لا يبدو كتطبيق بثّ:
            // وجهٌ مقطوع، وتكوينٌ مُزاح، وتفاصيل مفقودة خارج الإطار.
            //
            // و`SeriesItem.bannerUrl` يسقط إلى `coverUrl` عند غياب البانر
            // (`content_dtos.dart:203`)، فالحالة الأسوأ هي ما كان يحدث دائمًا،
            // والأفضل صار هو المعتاد: الخمس عشرة سلسلة المنشورة كلّها لها بانر
            // في `asset_links`.
            ExcludeSemantics(
              child: CinematicImage(
                networkUrl: series.bannerUrl ?? series.coverUrl,
                assetPath: series.bannerAsset,
                semanticLabel: 'مشهد من ${series.title}',
                // البانر مُؤلَّف ليُقرأ كاملًا، فلا إزاحة: التوسيط يحفظ التكوين
                // الذي رسمه الفنّان. الإزاحة `0.15` كانت تعويضًا عن قصّ البوستر.
                alignment: Alignment.center,
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

/// زرّ «في قائمتي» في الهيرو.
///
/// ## ما كان
///
/// دائرةٌ بعلامة `+` مُسنَدة إلى `onOpenSeries` — أي **نفس فعل زرّ التشغيل**
/// بجوارها. علامةُ زائد تعني «أضِف»، وكانت تنقل إلى صفحة السلسلة: زرٌّ يقول غير
/// ما يفعل. وهو نفس العطل الذي رُصد في «أكمل الرسمة» (زرّان بنصَّين مختلفَين
/// وفعلٍ واحد)، فلا يصحّ إصلاحه هناك وتركه في أبرز موضعٍ في التطبيق.
///
/// ## وما صار
///
/// `WatchlistNotifier.toggle` الحقيقي، والأيقونة تتبع الحالة — فالزرّ يفعل ما
/// تقوله صورته، ويُخبر بالنتيجة.
class _WatchlistButton extends ConsumerWidget {
  const _WatchlistButton({required this.seriesId, required this.title});

  final String seriesId;
  final String title;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final saved = ref.watch(watchlistProvider).contains(seriesId);
    return Container(
      width: 46,
      height: 46,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: saved ? 0.24 : 0.14),
        shape: BoxShape.circle,
        border: Border.all(
          color: Colors.white.withValues(alpha: saved ? 0.42 : 0.22),
        ),
      ),
      child: IconButton(
        // النصّ يذكر العمل والحالة، فقارئ الشاشة لا يحتاج أن يرى الأيقونة.
        tooltip: saved ? 'إزالة من قائمتي' : 'إضافة إلى قائمتي',
        onPressed: () => ref.read(watchlistProvider.notifier).toggle(seriesId),
        icon: Icon(
          saved ? Icons.check_rounded : Icons.add_rounded,
          color: Colors.white,
          size: 22,
        ),
        padding: EdgeInsets.zero,
      ),
    );
  }
}

/// مؤشّر الشرائح.
///
/// الشريحة النشطة شريطٌ يمتلئ بمقدار ما بقي من التقدّم التلقائي، وبقيتها نقاط.
/// وهذا هو النمط الذي تستعمله تطبيقات البثّ لأنه يجيب سؤالًا يسأله المشاهد
/// فعلًا: «هل سينتقل عنّي الآن؟». والنقاط الساكنة كانت تقول العدد والموضع فقط.
///
/// و[autoAdvance] يساوي `null` حين لا تقدّم — حركةٌ مُقلَّلة أو شريحة واحدة —
/// فيبقى الشريط ممتلئًا بلا حركة بدل أن يوهم بعدٍّ تنازليّ لا يحدث.
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

  static const double _activeWidth = 30;
  static const double _dotWidth = 7;
  static const double _trackHeight = 5;

  @override
  Widget build(BuildContext context) {
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
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
                duration: reducedMotion
                    ? Duration.zero
                    : const Duration(milliseconds: 260),
                curve: Curves.easeOutCubic,
                width: selected ? _activeWidth : _dotWidth,
                height: _trackHeight,
                margin: const EdgeInsetsDirectional.only(start: 5),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(99),
                  color: AppColors.starlight.withValues(
                    alpha: selected ? 0.3 : 0.45,
                  ),
                ),
                // المِلء داخل المسار: `Align` بـ`widthFactor` يتجنّب حساب عرضٍ
                // بالبكسل، فيبقى صحيحًا مع أي قيمة لـ`_activeWidth`.
                child: selected
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(99),
                        child: _AutoAdvanceFill(
                          // المفتاح يُعيد تشغيل المِلء من الصفر عند كل شريحة،
                          // وإلّا لاستمرّ من موضع الشريحة السابقة.
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
    );
  }
}

class _AutoAdvanceFill extends StatelessWidget {
  const _AutoAdvanceFill({required this.duration, super.key});

  /// `null` تعني «لا تقدّم»: يُرسَم ممتلئًا بلا حركة.
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
