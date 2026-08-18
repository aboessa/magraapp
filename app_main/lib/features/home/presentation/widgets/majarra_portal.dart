import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/analytics/analytics.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../domain/content_models.dart';

/// Focusable portal trigger shared by touch, keyboard and television shells.
class MajarraPortalButton extends StatefulWidget {
  const MajarraPortalButton({
    required this.onPressed,
    this.size = 78,
    this.semanticLabel = 'فتح بوابة مجرة',
    super.key,
  });

  final VoidCallback onPressed;
  final double size;
  final String semanticLabel;

  @override
  State<MajarraPortalButton> createState() => _MajarraPortalButtonState();
}

class _MajarraPortalButtonState extends State<MajarraPortalButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _orbitController;
  bool? _reducedMotion;
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reducedMotion = MediaQuery.disableAnimationsOf(context);
    if (_reducedMotion == reducedMotion) return;
    _reducedMotion = reducedMotion;
    if (reducedMotion) {
      _orbitController.stop();
    } else {
      _orbitController.repeat();
    }
  }

  @override
  void dispose() {
    _orbitController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: widget.semanticLabel,
      child: Semantics(
        button: true,
        label: widget.semanticLabel,
        child: Material(
          color: Colors.transparent,
          shape: const CircleBorder(),
          child: InkResponse(
            onTap: widget.onPressed,
            onFocusChange: (focused) => setState(() => _focused = focused),
            radius: widget.size * 0.62,
            containedInkWell: true,
            customBorder: const CircleBorder(),
            focusColor: AppColors.electricCyan.withValues(alpha: 0.24),
            hoverColor: Colors.white.withValues(alpha: 0.08),
            child: SizedBox.square(
              dimension: widget.size,
              child: ExcludeSemantics(
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    AnimatedContainer(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 140),
                      width: widget.size,
                      height: widget.size,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: _focused
                              ? AppColors.electricCyan
                              : Colors.white.withValues(alpha: 0.14),
                          width: _focused ? 3 : 1,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(
                              0xFF6A3DF2,
                            ).withValues(alpha: _focused ? 0.62 : 0.38),
                            blurRadius: widget.size * 0.34,
                            spreadRadius: _focused ? 3 : 1,
                          ),
                        ],
                      ),
                    ),
                    AnimatedBuilder(
                      animation: _orbitController,
                      builder: (context, _) => Transform.rotate(
                        angle: _orbitController.value * math.pi * 2,
                        child: CustomPaint(
                          size: Size.square(widget.size * 0.9),
                          painter: const _PortalOrbitPainter(),
                        ),
                      ),
                    ),
                    Container(
                      width: widget.size * 0.72,
                      height: widget.size * 0.72,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(
                          center: Alignment(0.18, -0.28),
                          radius: 1.2,
                          colors: [
                            Color(0xFFEDE8FF),
                            Color(0xFF9B8CFF),
                            Color(0xFF6A3DF2),
                            Color(0xFF24186D),
                          ],
                        ),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3),
                        ),
                      ),
                      child: Icon(
                        Icons.auto_awesome_rounded,
                        color: const Color(0xFFFFE27A),
                        size: widget.size * 0.28,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Future<void> showMajarraPortal(
  BuildContext context, {
  required HomeCatalog catalog,
  required VoidCallback onExplore,
  required VoidCallback onOpenLibrary,
  required VoidCallback onOpenProfile,
  required VoidCallback onOpenReading,
  required VoidCallback onOpenListening,
  required ValueChanged<SeriesItem> onOpenSeries,
  required ValueChanged<ExperienceItem> onOpenGame,
  ValueChanged<String>? onOpenPlanet,
}) {
  final reduceMotion = MediaQuery.disableAnimationsOf(context);
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'إغلاق بوابة مجرة',
    barrierColor: const Color(0xFF02040E).withValues(alpha: 0.9),
    transitionDuration: reduceMotion
        ? Duration.zero
        : const Duration(milliseconds: 240),
    pageBuilder: (context, _, __) => _PremiumPortalDialog(
      catalog: catalog,
      onExplore: onExplore,
      onOpenLibrary: onOpenLibrary,
      onOpenProfile: onOpenProfile,
      onOpenReading: onOpenReading,
      onOpenListening: onOpenListening,
      onOpenSeries: onOpenSeries,
      onOpenGame: onOpenGame,
      onOpenPlanet: onOpenPlanet,
    ),
    transitionBuilder: (context, animation, _, child) {
      if (reduceMotion) return child;
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween(begin: 0.97, end: 1.0).animate(curved),
          child: child,
        ),
      );
    },
  );
}

enum _PortalMode { actions, planets }

class _PremiumPortalDialog extends StatefulWidget {
  const _PremiumPortalDialog({
    required this.catalog,
    required this.onExplore,
    required this.onOpenLibrary,
    required this.onOpenProfile,
    required this.onOpenReading,
    required this.onOpenListening,
    required this.onOpenSeries,
    required this.onOpenGame,
    this.onOpenPlanet,
  });

  final HomeCatalog catalog;
  final VoidCallback onExplore;
  final VoidCallback onOpenLibrary;
  final VoidCallback onOpenProfile;
  final VoidCallback onOpenReading;
  final VoidCallback onOpenListening;
  final ValueChanged<SeriesItem> onOpenSeries;
  final ValueChanged<ExperienceItem> onOpenGame;
  final ValueChanged<String>? onOpenPlanet;

  @override
  State<_PremiumPortalDialog> createState() => _PremiumPortalDialogState();
}

class _PremiumPortalDialogState extends State<_PremiumPortalDialog> {
  _PortalMode _mode = _PortalMode.actions;

  SeriesItem? get _featuredSeries {
    for (final spotlight in widget.catalog.spotlights) {
      if (!spotlight.enabled) continue;
      final series = widget.catalog.seriesById(spotlight.seriesId);
      if (series != null) return series;
    }
    return widget.catalog.series.firstOrNull;
  }

  ExperienceItem? get _featuredGame => widget.catalog.experiences
      .where((item) => item.isServerBacked)
      .firstOrNull;

  bool get _hasReading =>
      widget.catalog.stories.isNotEmpty ||
      widget.catalog.books.any((book) => book.type != 'audio_story');

  bool get _hasListening => widget.catalog.books.any(
    (book) => book.type == 'audio_story' || book.isPlayable,
  );

  List<_PortalAction> get _actions => [
    if (_featuredSeries case final series?)
      _PortalAction(
        id: 'watch',
        label: 'شاهد',
        description: series.title,
        icon: Icons.play_arrow_rounded,
        color: AppColors.starGold,
        onPressed: () => _closeThen(() => widget.onOpenSeries(series)),
      ),
    if (_featuredGame case final game?)
      _PortalAction(
        id: 'play',
        label: 'العب',
        description: game.title,
        icon: Icons.sports_esports_rounded,
        color: const Color(0xFF5BE7A9),
        onPressed: () => _closeThen(() => widget.onOpenGame(game)),
      ),
    if (_hasReading)
      _PortalAction(
        id: 'read',
        label: 'اقرأ',
        description: 'القصص والكتب المنشورة',
        icon: Icons.menu_book_rounded,
        color: AppColors.electricCyan,
        onPressed: () => _closeThen(widget.onOpenReading),
      ),
    if (_hasListening)
      _PortalAction(
        id: 'listen',
        label: 'استمع',
        description: 'القصص الصوتية المتاحة',
        icon: Icons.headphones_rounded,
        color: AppColors.cosmicPurple,
        onPressed: () => _closeThen(widget.onOpenListening),
      ),
    _PortalAction(
      id: 'library',
      label: 'المسلسلات المحفوظة',
      description: 'المسلسلات التي حفظها الطفل',
      icon: Icons.bookmark_rounded,
      color: const Color(0xFF5BE7A9),
      onPressed: () => _closeThen(widget.onOpenLibrary),
    ),
    _PortalAction(
      id: 'profile',
      label: 'ملفي',
      description: 'الملف والإعدادات',
      icon: Icons.face_rounded,
      color: const Color(0xFFFF6FAE),
      onPressed: () => _closeThen(widget.onOpenProfile),
    ),
    if (widget.catalog.planets.isNotEmpty)
      _PortalAction(
        id: 'planets',
        label: 'الكواكب',
        description: '${widget.catalog.planets.length} عوالم متاحة',
        icon: Icons.public_rounded,
        color: AppColors.royalBlue,
        onPressed: () {
          MajarraAnalytics.log(
            'portal_mode_selected',
            params: {'mode': 'planets'},
          );
          setState(() => _mode = _PortalMode.planets);
        },
      ),
  ];

  void _closeThen(VoidCallback action) {
    Navigator.of(context).pop();
    action();
  }

  void _recommend() {
    final featured = _featuredSeries;
    if (featured != null) {
      MajarraAnalytics.log(
        'portal_recommendation_opened',
        params: {'kind': 'series'},
      );
      _closeThen(() => widget.onOpenSeries(featured));
      return;
    }
    final game = _featuredGame;
    if (game != null) {
      MajarraAnalytics.log(
        'portal_recommendation_opened',
        params: {'kind': 'game'},
      );
      _closeThen(() => widget.onOpenGame(game));
      return;
    }
    if (_hasReading) {
      MajarraAnalytics.log(
        'portal_recommendation_opened',
        params: {'kind': 'reading'},
      );
      _closeThen(widget.onOpenReading);
      return;
    }
    if (_hasListening) {
      MajarraAnalytics.log(
        'portal_recommendation_opened',
        params: {'kind': 'audio'},
      );
      _closeThen(widget.onOpenListening);
      return;
    }
    final planet = widget.catalog.planets.firstOrNull;
    if (planet != null) {
      _openPlanet(planet);
      return;
    }
    _closeThen(widget.onOpenLibrary);
  }

  void _openPlanet(Planet planet) {
    MajarraAnalytics.planetSelected(planet.id);
    Navigator.of(context).pop();
    if (widget.onOpenPlanet case final openPlanet?) {
      openPlanet(planet.id);
    } else {
      widget.onExplore();
    }
  }

  void _back() {
    if (_mode == _PortalMode.planets) {
      setState(() => _mode = _PortalMode.actions);
    } else {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.escape): _back,
        const SingleActivator(LogicalKeyboardKey.goBack): _back,
      },
      child: Focus(
        autofocus: true,
        child: Semantics(
          scopesRoute: true,
          namesRoute: true,
          label: 'بوابة مجرة',
          child: Material(
            type: MaterialType.transparency,
            child: SafeArea(
              minimum: const EdgeInsets.all(16),
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(
                    maxWidth: 780,
                    maxHeight: 760,
                  ),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: const Color(0xFF080D24),
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.1),
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.cosmicPurple.withValues(alpha: 0.2),
                          blurRadius: 48,
                        ),
                      ],
                      gradient: const RadialGradient(
                        center: Alignment(0.6, -0.8),
                        radius: 1.5,
                        colors: [Color(0xFF1A2552), Color(0xFF080D24)],
                      ),
                    ),
                    child: Column(
                      children: [
                        _PortalHeader(mode: _mode, onBack: _back),
                        Expanded(
                          child: AnimatedSwitcher(
                            duration: MediaQuery.disableAnimationsOf(context)
                                ? Duration.zero
                                : const Duration(milliseconds: 180),
                            child: _mode == _PortalMode.actions
                                ? _buildActions(context)
                                : _buildPlanets(context),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildActions(BuildContext context) {
    return LayoutBuilder(
      key: const ValueKey('portal-actions'),
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 620 ? 3 : 2;
        return Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 4, 20, 22),
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 18),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.auto_awesome_rounded,
                        color: AppColors.starGold,
                        size: 42,
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'إلى أين نذهب؟',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'كل اختيار يفتح وجهة متاحة فعلًا',
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.78),
                        ),
                      ),
                      const SizedBox(height: 14),
                      FilledButton.icon(
                        autofocus: true,
                        onPressed: _recommend,
                        icon: const Icon(Icons.auto_awesome_rounded),
                        label: const Text('اقترح لي محتوى'),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.starGold,
                          foregroundColor: AppColors.deepSpace,
                          minimumSize: const Size(180, 48),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: columns,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: constraints.maxWidth >= 620 ? 1.75 : 1.35,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) =>
                      _PortalActionCard(action: _actions[index]),
                  childCount: _actions.length,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPlanets(BuildContext context) {
    final planets = widget.catalog.planets;
    if (planets.isEmpty) {
      return Center(
        key: const ValueKey('portal-planets-empty'),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.public_off_rounded,
              color: AppColors.mutedText,
              size: 44,
            ),
            const SizedBox(height: 12),
            const Text('لا توجد كواكب منشورة الآن'),
            TextButton(onPressed: _back, child: const Text('العودة')),
          ],
        ),
      );
    }

    return LayoutBuilder(
      key: const ValueKey('portal-planets'),
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 660
            ? 4
            : constraints.maxWidth >= 430
            ? 3
            : 2;
        return GridView.builder(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 8, 20, 22),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: columns,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.95,
          ),
          itemCount: planets.length,
          itemBuilder: (context, index) {
            final planet = planets[index];
            return _PlanetPortalCard(
              planet: planet,
              onPressed: () => _openPlanet(planet),
            );
          },
        );
      },
    );
  }
}

class _PortalHeader extends StatelessWidget {
  const _PortalHeader({required this.mode, required this.onBack});

  final _PortalMode mode;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(14, 14, 18, 10),
      child: Row(
        children: [
          IconButton(
            autofocus: false,
            tooltip: mode == _PortalMode.planets ? 'العودة' : 'إغلاق',
            onPressed: onBack,
            icon: mode == _PortalMode.planets
                ? const BackButtonIcon()
                : const Icon(Icons.close_rounded),
            color: Colors.white,
            style: IconButton.styleFrom(
              backgroundColor: Colors.white.withValues(alpha: 0.08),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  mode == _PortalMode.planets ? 'اختر كوكبًا' : 'بوابة مجرة',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  mode == _PortalMode.planets
                      ? 'العوالم المنشورة في مكتبتك'
                      : 'وصول سريع لوجهاتك',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.7),
                    fontSize: 11,
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

class _PortalAction {
  const _PortalAction({
    required this.id,
    required this.label,
    required this.description,
    required this.icon,
    required this.color,
    required this.onPressed,
  });

  final String id;
  final String label;
  final String description;
  final IconData icon;
  final Color color;
  final VoidCallback onPressed;
}

class _PortalActionCard extends StatefulWidget {
  const _PortalActionCard({required this.action});

  final _PortalAction action;

  @override
  State<_PortalActionCard> createState() => _PortalActionCardState();
}

class _PortalActionCardState extends State<_PortalActionCard> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final action = widget.action;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return Semantics(
      button: true,
      label: '${action.label}، ${action.description}',
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: action.onPressed,
          onFocusChange: (focused) => setState(() => _focused = focused),
          borderRadius: BorderRadius.circular(18),
          focusColor: action.color.withValues(alpha: 0.18),
          child: AnimatedContainer(
            duration: reduceMotion
                ? Duration.zero
                : const Duration(milliseconds: 130),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _focused
                  ? action.color.withValues(alpha: 0.16)
                  : const Color(0xFF121A38).withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: _focused
                    ? action.color
                    : Colors.white.withValues(alpha: 0.09),
                width: _focused ? 2.5 : 1,
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: action.color.withValues(alpha: 0.18),
                  ),
                  child: Icon(action.icon, color: action.color, size: 25),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        action.label,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        action.description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.76),
                          fontSize: 10.5,
                        ),
                      ),
                    ],
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

class _PlanetPortalCard extends StatefulWidget {
  const _PlanetPortalCard({required this.planet, required this.onPressed});

  final Planet planet;
  final VoidCallback onPressed;

  @override
  State<_PlanetPortalCard> createState() => _PlanetPortalCardState();
}

class _PlanetPortalCardState extends State<_PlanetPortalCard> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final planet = widget.planet;
    return Semantics(
      button: true,
      label: '${planet.name}، ${planet.description}',
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: widget.onPressed,
          onFocusChange: (focused) => setState(() => _focused = focused),
          borderRadius: BorderRadius.circular(18),
          child: AnimatedContainer(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 130),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF121A38),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: _focused
                    ? AppColors.electricCyan
                    : Colors.white.withValues(alpha: 0.09),
                width: _focused ? 2.5 : 1,
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                PlanetSymbol(
                  planetId: planet.id,
                  colorHex: planet.colorHex,
                  semanticLabel: planet.name,
                  size: 68,
                  selected: _focused,
                  imageAsset: planet.imageAsset,
                ),
                const SizedBox(height: 10),
                Text(
                  planet.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  planet.description,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.72),
                    fontSize: 10,
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

class _PortalOrbitPainter extends CustomPainter {
  const _PortalOrbitPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * 0.46;
    final ring = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..color = Colors.white.withValues(alpha: 0.34);
    canvas.drawCircle(center, radius, ring);

    final gold = Paint()..color = AppColors.starGold;
    final cyan = Paint()..color = AppColors.electricCyan;
    canvas.drawCircle(Offset(center.dx, center.dy - radius), 3, gold);
    canvas.drawCircle(
      Offset(
        center.dx + radius * math.cos(math.pi * 0.7),
        center.dy + radius * math.sin(math.pi * 0.7),
      ),
      2.3,
      cyan,
    );
  }

  @override
  bool shouldRepaint(covariant _PortalOrbitPainter oldDelegate) => false;
}
