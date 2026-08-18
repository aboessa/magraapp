import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../domain/content_models.dart';
import '../widgets/home_destinations.dart';
import '../widgets/majarra_bottom_navigation.dart';
import '../widgets/majarra_portal.dart';

class AdaptiveHomeShell extends StatefulWidget {
  const AdaptiveHomeShell({required this.catalog, super.key});

  final HomeCatalog catalog;

  @override
  State<AdaptiveHomeShell> createState() => _AdaptiveHomeShellState();
}

class _AdaptiveHomeShellState extends State<AdaptiveHomeShell> {
  late final PageController _pageController;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pages = buildHomeDestinations(
      catalog: widget.catalog,
      isTelevision: false,
      onOpenPlanet: _openPlanet,
      onSelectDestination: _select,
      onOpenPortal: _showPortal,
    );

    // This shell is, by construction, the non-television experience: HomePage
    // routes television devices to TvHomeShell instead. A stale `!isTelevision`
    // term used to appear here and referenced an identifier that does not exist
    // on this widget, which broke compilation.
    final layoutClass = context.layoutClass;
    final isTablet =
        layoutClass != AppLayoutClass.compact &&
        MediaQuery.sizeOf(context).width >= 600 &&
        MediaQuery.sizeOf(context).height > 480;
    final isDesktop = layoutClass == AppLayoutClass.expanded;

    if (isTablet) {
      return Scaffold(
        backgroundColor: AppColors.deepSpace,
        body: Row(
          children: [
            NavigationRail(
              extended: isDesktop,
              minWidth: 82,
              minExtendedWidth: 204,
              backgroundColor: const Color(0xFF080C22).withValues(alpha: 0.96),
              selectedIndex: _selectedIndex,
              onDestinationSelected: _select,
              labelType: isDesktop
                  ? NavigationRailLabelType.none
                  : NavigationRailLabelType.all,
              useIndicator: true,
              indicatorColor: AppColors.royalBlue.withValues(alpha: 0.22),
              selectedIconTheme: const IconThemeData(color: Colors.white),
              unselectedIconTheme: IconThemeData(
                color: AppColors.mutedText.withValues(alpha: 0.62),
              ),
              selectedLabelTextStyle: TextStyle(
                color: Colors.white,
                fontSize: isDesktop ? 14 : 11,
                fontWeight: FontWeight.w700,
              ),
              unselectedLabelTextStyle: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.58),
                fontSize: isDesktop ? 14 : 11,
              ),
              leading: Padding(
                padding: const EdgeInsets.only(top: 18, bottom: 18),
                child: Column(
                  children: [
                    Image.asset(
                      'assets/brand/majarra-logo.png',
                      width: isDesktop ? 72 : 48,
                      height: isDesktop ? 56 : 48,
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => const Icon(
                        Icons.auto_awesome_rounded,
                        color: AppColors.starGold,
                      ),
                    ),
                    const SizedBox(height: 18),
                    MajarraPortalButton(
                      size: isDesktop ? 60 : 56,
                      onPressed: _showPortal,
                    ),
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
                  label: Text('مقاطع'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.search_rounded),
                  selectedIcon: Icon(Icons.search_rounded),
                  label: Text('بحث'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  selectedIcon: Icon(Icons.person_rounded),
                  label: Text('ملفي'),
                ),
              ],
            ),
            const VerticalDivider(width: 1, color: Color(0xFF1B2550)),
            Expanded(
              child: PageView(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                children: pages,
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      extendBody: true,
      body: PageView(
        controller: _pageController,
        physics: const NeverScrollableScrollPhysics(),
        children: pages,
      ),
      bottomNavigationBar: MajarraBottomNavigation(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _select,
        onPortalPressed: _showPortal,
      ),
    );
  }

  void _select(int index) {
    if (index == _selectedIndex) return;
    setState(() => _selectedIndex = index);
    _moveToPage(index);
  }

  void _openPlanet(String planetId) {
    context.push('/planets?planetId=$planetId');
  }

  void _moveToPage(int index) {
    if (!_pageController.hasClients) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      _pageController.jumpToPage(index);
      return;
    }
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
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
      onOpenPlanet: _openPlanet,
      onOpenLibrary: () => context.push('/watchlist'),
      onOpenProfile: () => _select(HomeDestinationIndex.profile),
      onOpenReading: _openReading,
      onOpenListening: _openListening,
      onOpenSeries: (item) => context.push('/series/${item.id}'),
      onOpenGame: (item) => context.push('/game/${item.id}'),
    );
  }
}
