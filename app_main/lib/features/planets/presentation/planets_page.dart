import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../home/domain/content_models.dart';
import '../../home/presentation/widgets/content_cards.dart';
import '../../home/presentation/widgets/content_rail.dart';

class PlanetsPage extends StatefulWidget {
  const PlanetsPage({
    required this.catalog,
    required this.isTelevision,
    this.selectedPlanetId,
    super.key,
  });

  final HomeCatalog catalog;
  final bool isTelevision;
  final String? selectedPlanetId;

  @override
  State<PlanetsPage> createState() => _PlanetsPageState();
}

class _PlanetsPageState extends State<PlanetsPage> {
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _selectedIndex = _indexFor(widget.selectedPlanetId);
  }

  @override
  void didUpdateWidget(covariant PlanetsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.selectedPlanetId != widget.selectedPlanetId ||
        oldWidget.catalog.planets != widget.catalog.planets) {
      final selectedIndex = _indexFor(widget.selectedPlanetId);
      if (selectedIndex != _selectedIndex) {
        setState(() => _selectedIndex = selectedIndex);
      }
    }
  }

  int _indexFor(String? planetId) {
    if (widget.catalog.planets.isEmpty) return 0;
    final requestedIndex = widget.catalog.planets.indexWhere(
      (planet) => planet.id == planetId,
    );
    return requestedIndex < 0 ? 0 : requestedIndex;
  }

  @override
  Widget build(BuildContext context) {
    if (widget.catalog.planets.isEmpty) return const SizedBox.shrink();

    final padding = context.horizontalPagePadding;
    final selectedPlanet = widget.catalog.planets[_selectedIndex];
    final series = widget.catalog.seriesForPlanet(selectedPlanet);
    final episodes = widget.catalog.episodesForPlanet(selectedPlanet);
    final experiences = widget.catalog.experiencesForPlanet(selectedPlanet);

    return CinematicBackground(
      child: CustomScrollView(
        key: const PageStorageKey('planets-page'),
        slivers: [
          SliverAppBar(
            pinned: true,
            toolbarHeight: widget.isTelevision ? 86 : 72,
            backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
            titleSpacing: padding,
            title: Text(
              'كواكب مجرة',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          SliverToBoxAdapter(
            child: _PlanetChooser(
              planets: widget.catalog.planets,
              selectedIndex: _selectedIndex,
              isTelevision: widget.isTelevision,
              onSelected: (index) => setState(() => _selectedIndex = index),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 8, padding, 0),
              child: _PlanetIntroduction(
                planet: selectedPlanet,
                key: ValueKey(selectedPlanet.id),
              ),
            ),
          ),
          if (series.isNotEmpty)
            SliverToBoxAdapter(
              child: _sectionWithMotion(
                context,
                key: ValueKey('series-${selectedPlanet.id}'),
                child: Padding(
                  padding: const EdgeInsets.only(top: 28),
                  child: ContentRail<SeriesItem>(
                    title: 'سلاسل ${selectedPlanet.name}',
                    subtitle: 'اختر قصة تناسب فضولك اليوم',
                    items: series,
                    height: widget.isTelevision ? 354 : 282,
                    horizontalPadding: padding,
                    itemBuilder: (context, item, index) => SeriesCard(
                      item: item,
                      isTelevision: widget.isTelevision,
                      onPressed: () => context.push('/series/${item.id}'),
                    ),
                  ),
                ),
              ),
            )
          else
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(
                  padding,
                  28,
                  padding,
                  0,
                ),
                child: _EmptyPlanetSection(
                  planet: selectedPlanet,
                  label: 'السلاسل الجديدة تصل قريبًا إلى هذا الكوكب.',
                ),
              ),
            ),
          if (episodes.isNotEmpty)
            SliverToBoxAdapter(
              child: _sectionWithMotion(
                context,
                key: ValueKey('episodes-${selectedPlanet.id}'),
                child: Padding(
                  padding: const EdgeInsets.only(top: 28),
                  child: ContentRail<EpisodeItem>(
                    title: 'حلقات من ${selectedPlanet.name}',
                    subtitle: 'رحلات قصيرة تحت هذا الكوكب',
                    items: episodes,
                    height: widget.isTelevision ? 247 : 208,
                    horizontalPadding: padding,
                    itemBuilder: (context, item, index) => EpisodeCard(
                      item: item,
                      isTelevision: widget.isTelevision,
                      onPressed: () => _showUnavailableEpisode(context),
                    ),
                  ),
                ),
              ),
            ),
          if (experiences.isNotEmpty)
            SliverToBoxAdapter(
              child: _sectionWithMotion(
                context,
                key: ValueKey('experiences-${selectedPlanet.id}'),
                child: Padding(
                  padding: const EdgeInsets.only(top: 28),
                  child: ContentRail<ExperienceItem>(
                    title: 'أنشطة ${selectedPlanet.name}',
                    subtitle: 'ألعاب قصيرة ومناسبة للعمر',
                    items: experiences,
                    height: widget.isTelevision ? 322 : 266,
                    horizontalPadding: padding,
                    itemBuilder: (context, item, index) => ExperienceCard(
                      item: item,
                      isTelevision: widget.isTelevision,
                      onPressed: () => _showComingSoon(context, item.title),
                    ),
                  ),
                ),
              ),
            ),
          SliverToBoxAdapter(
            child: SizedBox(height: widget.isTelevision ? 72 : 38),
          ),
        ],
      ),
    );
  }

  static void _showUnavailableEpisode(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('ستبدأ المشاهدة عند نشر ملف الحلقة.')),
    );
  }

  static void _showComingSoon(BuildContext context, String title) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$title قيد التجهيز للنسخة القادمة.')),
    );
  }
}

class _PlanetChooser extends StatelessWidget {
  const _PlanetChooser({
    required this.planets,
    required this.selectedIndex,
    required this.isTelevision,
    required this.onSelected,
  });

  final List<Planet> planets;
  final int selectedIndex;
  final bool isTelevision;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding;
    final height = isTelevision ? 152.0 : 128.0;

    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsetsDirectional.fromSTEB(padding, 14, padding, 14),
        itemCount: planets.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (context, index) => _PlanetChoice(
          planet: planets[index],
          selected: selectedIndex == index,
          isTelevision: isTelevision,
          onPressed: () => onSelected(index),
        ),
      ),
    );
  }
}

class _PlanetChoice extends StatelessWidget {
  const _PlanetChoice({
    required this.planet,
    required this.selected,
    required this.isTelevision,
    required this.onPressed,
  });

  final Planet planet;
  final bool selected;
  final bool isTelevision;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final size = isTelevision ? 128.0 : 104.0;
    final accent = _colorFromHex(planet.colorHex);
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 320);

    return Semantics(
      button: true,
      selected: selected,
      label: '${planet.name}، ${planet.description}',
      child: AnimatedContainer(
        duration: duration,
        curve: Curves.easeOutCubic,
        width: size,
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: selected
              ? const Color(0xFF1B2550).withValues(alpha: 0.92)
              : const Color(0xFF121A38).withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected
                ? Colors.white.withValues(alpha: 0.18)
                : Colors.white.withValues(alpha: 0.07),
            width: selected ? 1.4 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.32),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
            if (selected)
              BoxShadow(
                color: accent.withValues(alpha: 0.28),
                blurRadius: 22,
              ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(14),
            child: Column(
              children: [
                Expanded(
                  child: AnimatedScale(
                    scale: selected ? 1.08 : 0.92,
                    duration: duration,
                    curve: Curves.easeOutBack,
                    child: ExcludeSemantics(
                      child: Center(
                        child: PlanetSymbol(
                          planetId: planet.id,
                          colorHex: planet.colorHex,
                          semanticLabel: planet.name,
                          size: isTelevision ? 72 : 58,
                          selected: selected,
                          imageAsset: planet.imageAsset,
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  planet.name.replaceFirst('كوكب ', ''),
                  textDirection: TextDirection.rtl,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: selected ? Colors.white : AppColors.mutedText,
                    fontSize: 12,
                    fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
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

class _PlanetIntroduction extends StatelessWidget {
  const _PlanetIntroduction({required this.planet, super.key});

  final Planet planet;

  @override
  Widget build(BuildContext context) {
    final accent = _colorFromHex(planet.colorHex);
    final content = Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            const Color(0xFF1E2A5A),
            const Color(0xFF121B3E),
            const Color(0xFF0A112A),
          ],
        ),
        border: Border.all(color: Colors.white.withValues(alpha: 0.09)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.34),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Glow behind
          Positioned(
            top: -20,
            left: -20,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [accent.withValues(alpha: 0.18), Colors.transparent],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(18, 18, 18, 18),
            child: Row(
              children: [
                PlanetSymbol(
                  planetId: planet.id,
                  colorHex: planet.colorHex,
                  semanticLabel: planet.name,
                  size: 64,
                  selected: true,
                  imageAsset: planet.imageAsset,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        planet.name,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        planet.description,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.84),
                          fontSize: 12.5,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return AnimatedSwitcher(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : const Duration(milliseconds: 280),
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, 0.035),
            end: Offset.zero,
          ).animate(animation),
          child: child,
        ),
      ),
      child: content,
    );
  }
}

class _EmptyPlanetSection extends StatelessWidget {
  const _EmptyPlanetSection({required this.planet, required this.label});

  final Planet planet;
  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.indigoSurface.withValues(alpha: 0.62),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.starlight.withValues(alpha: 0.09)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            const Icon(Icons.auto_awesome_outlined, color: AppColors.starGold),
            const SizedBox(width: 11),
            Expanded(child: Text(label)),
          ],
        ),
      ),
    );
  }
}

Widget _sectionWithMotion(
  BuildContext context, {
  required Key key,
  required Widget child,
}) {
  final keyedChild = KeyedSubtree(key: key, child: child);
  if (MediaQuery.disableAnimationsOf(context)) return keyedChild;
  return keyedChild
      .animate(key: key)
      .fadeIn(duration: 260.ms, curve: Curves.easeOutCubic)
      .slideY(
        begin: 0.025,
        end: 0,
        duration: 330.ms,
        curve: Curves.easeOutCubic,
      );
}

Color _colorFromHex(String value) {
  final normalized = value.replaceFirst('#', '');
  return Color(int.parse(normalized, radix: 16) | 0xFF000000);
}
