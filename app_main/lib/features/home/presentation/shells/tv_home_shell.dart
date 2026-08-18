import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../domain/content_models.dart';
import '../widgets/home_destinations.dart';
import '../widgets/majarra_portal.dart';

class TvHomeShell extends StatefulWidget {
  const TvHomeShell({required this.catalog, super.key});

  final HomeCatalog catalog;

  @override
  State<TvHomeShell> createState() => _TvHomeShellState();
}

class _TvHomeShellState extends State<TvHomeShell> {
  int _selectedIndex = 0;

  /// Destinations the user has actually opened. A plain [IndexedStack] builds
  /// every child on the first frame, which meant all four screens — including
  /// their rails and blurs — were laid out before the TV drew anything. Tracking
  /// visits keeps state for opened tabs while deferring the rest.
  final Set<int> _visited = {0};

  void _select(int index) {
    setState(() {
      _selectedIndex = index;
      _visited.add(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    final pages = buildHomeDestinations(
      catalog: widget.catalog,
      isTelevision: true,
      onOpenPlanet: (planetId) => context.push('/planets?planetId=$planetId'),
      onSelectDestination: _select,
      onOpenPortal: _showPortal,
    );

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: FocusTraversalGroup(
          policy: ReadingOrderTraversalPolicy(),
          child: SafeArea(
            minimum: EdgeInsets.all(
              MediaQuery.of(context).size.shortestSide * 0.055,
            ),
            child: Row(
              children: [
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.midnight,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: AppColors.starlight.withValues(alpha: 0.08),
                    ),
                  ),
                  child: NavigationRail(
                    extended: true,
                    minExtendedWidth: 226,
                    backgroundColor: Colors.transparent,
                    selectedIndex: _selectedIndex,
                    onDestinationSelected: _select,
                    leading: Padding(
                      padding: const EdgeInsets.only(bottom: 30),
                      child: Image.asset(
                        'assets/brand/majarra-logo.png',
                        width: 128,
                        height: 72,
                        fit: BoxFit.contain,
                        semanticLabel: 'مجرة',
                      ),
                    ),
                    trailing: Padding(
                      padding: const EdgeInsets.only(top: 34, bottom: 20),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          MajarraPortalButton(size: 62, onPressed: _showPortal),
                          const SizedBox(height: 14),
                          IconButton(
                            tooltip: 'اقتران التلفزيون',
                            onPressed: () => context.push('/tv-pairing'),
                            icon: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.08),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(
                                Icons.qr_code_2_rounded,
                                color: Colors.white,
                                size: 18,
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          const _TvProfileBadge(),
                        ],
                      ),
                    ),
                    destinations: const [
                      NavigationRailDestination(
                        icon: Icon(Icons.home_outlined),
                        selectedIcon: Icon(Icons.home_rounded),
                        label: Text('الرئيسية'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.play_circle_outline_rounded),
                        selectedIcon: Icon(Icons.play_circle_rounded),
                        label: Text('مقاطع الحلقات'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.search_rounded),
                        selectedIcon: Icon(Icons.search_rounded),
                        label: Text('بحث'),
                      ),
                      NavigationRailDestination(
                        icon: Icon(Icons.face_outlined),
                        selectedIcon: Icon(Icons.face_rounded),
                        label: Text('ملفي'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 22),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(30),
                    child: IndexedStack(
                      index: _selectedIndex,
                      children: [
                        for (var i = 0; i < pages.length; i++)
                          if (_visited.contains(i))
                            pages[i]
                          else
                            const SizedBox.shrink(),
                      ],
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

  void _openReading() {
    final story = widget.catalog.stories.firstOrNull;
    if (story != null) {
      context.push('/reader/${story.id}?contentType=story');
      return;
    }
    final book = widget.catalog.books
        .where((item) => item.type != 'audio_story')
        .firstOrNull;
    if (book != null) context.push('/reader/${book.id}?contentType=book');
  }

  void _openListening() {
    final book = widget.catalog.books
        .where((item) => item.type == 'audio_story' || item.isPlayable)
        .firstOrNull;
    if (book == null) return;
    context.push(
      Uri(path: '/audio', queryParameters: {'bookId': book.id}).toString(),
    );
  }

  void _showPortal() {
    showMajarraPortal(
      context,
      catalog: widget.catalog,
      onExplore: () => context.push('/planets'),
      onOpenPlanet: (id) => context.push('/planets?planetId=$id'),
      onOpenLibrary: () => context.push('/watchlist'),
      onOpenProfile: () => _select(HomeDestinationIndex.profile),
      onOpenReading: _openReading,
      onOpenListening: _openListening,
      onOpenSeries: (item) => context.push('/series/${item.id}'),
      onOpenGame: (item) => context.push('/game/${item.id}'),
    );
  }
}

class _TvProfileBadge extends StatelessWidget {
  const _TvProfileBadge();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'الملف الحالي، عمر 6 إلى 8 سنوات',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const CircleAvatar(
            radius: 18,
            backgroundColor: AppColors.cosmicPurple,
            child: Icon(Icons.auto_awesome_rounded, size: 19),
          ),
          const SizedBox(width: 10),
          Text('مستكشف • 6–8', style: Theme.of(context).textTheme.labelLarge),
        ],
      ),
    );
  }
}
