import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/analytics/analytics.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../domain/content_models.dart';

/// Central portal orb button - cinematic premium glowing orb
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
    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        onTap: widget.onPressed,
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer glow
              Container(
                width: widget.size,
                height: widget.size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF6A3DF2).withValues(alpha: 0.38),
                      blurRadius: widget.size * 0.32,
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: const Color(0xFF00D6F5).withValues(alpha: 0.18),
                      blurRadius: widget.size * 0.5,
                    ),
                  ],
                ),
              ),
              // Rotating orbit ring
              AnimatedBuilder(
                animation: _orbitController,
                builder: (_, __) => Transform.rotate(
                  angle: _orbitController.value * math.pi * 2,
                  child: CustomPaint(
                    size: Size.square(widget.size),
                    painter: _PortalOrbitPainter(),
                  ),
                ),
              ),
              // Core orb - Majarra Galaxy professional
              Container(
                width: widget.size * 0.78,
                height: widget.size * 0.78,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: const RadialGradient(
                    center: Alignment(0.18, -0.28),
                    radius: 1.22,
                    colors: [
                      Color(0xFFEDE8FF),
                      Color(0xFFB8AAFF),
                      Color(0xFF7A5CFF),
                      Color(0xFF4A2DB8),
                      Color(0xFF1B1450),
                      Color(0xFF0B0F2A),
                    ],
                    stops: [0, 0.18, 0.38, 0.62, 0.84, 1],
                  ),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.24),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.32),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Galaxy spiral arms
                    Positioned.fill(
                      child: CustomPaint(
                        painter: _GalaxySpiralPainter(),
                      ),
                    ),
                    // Center star
                    Container(
                      width: widget.size * 0.26,
                      height: widget.size * 0.26,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(
                          colors: [Color(0xFFFFF8D0), Color(0xFFFFD34D), Color(0xFFFF9F1C)],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFFFFD34D).withValues(alpha: 0.85),
                            blurRadius: 12,
                            spreadRadius: 1,
                          ),
                        ],
                        border: Border.all(color: Colors.white.withValues(alpha: 0.55)),
                      ),
                      child: Icon(
                        Icons.auto_awesome_rounded,
                        color: const Color(0xFF1A1450),
                        size: widget.size * 0.15,
                      ),
                    ),
                  ],
                ),
              ),
              // Hidden semantics helper
              IgnorePointer(
                child: SizedBox(
                  width: widget.size * 0.1,
                  height: widget.size * 0.1,
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    color: Colors.transparent,
                    size: 1,
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

Future<void> showMajarraPortal(
  BuildContext context, {
  required HomeCatalog catalog,
  required VoidCallback onExplore,
  required VoidCallback onOpenLibrary,
  required VoidCallback onOpenProfile,
  required ValueChanged<SeriesItem> onOpenSeries,
  ValueChanged<String>? onOpenPlanet,
}) {
  final reduceMotion = MediaQuery.disableAnimationsOf(context);
  return showGeneralDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'إغلاق بوابة مجرة',
    barrierColor: const Color(0xFF050817).withValues(alpha: 0.84),
    transitionDuration: reduceMotion ? Duration.zero : const Duration(milliseconds: 340),
    pageBuilder: (_, __, ___) => _PremiumPortalDialog(
      catalog: catalog,
      onExplore: onExplore,
      onOpenLibrary: onOpenLibrary,
      onOpenProfile: onOpenProfile,
      onOpenSeries: onOpenSeries,
      onOpenPlanet: onOpenPlanet,
    ),
    transitionBuilder: (_, animation, __, child) {
      if (reduceMotion) return child;
      return FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
        child: child,
      );
    },
  );
}

enum _PortalMode { main, planets }

class _PremiumPortalDialog extends StatefulWidget {
  const _PremiumPortalDialog({
    required this.catalog,
    required this.onExplore,
    required this.onOpenLibrary,
    required this.onOpenProfile,
    required this.onOpenSeries,
    this.onOpenPlanet,
  });

  final HomeCatalog catalog;
  final VoidCallback onExplore;
  final VoidCallback onOpenLibrary;
  final VoidCallback onOpenProfile;
  final ValueChanged<SeriesItem> onOpenSeries;
  final ValueChanged<String>? onOpenPlanet;

  @override
  State<_PremiumPortalDialog> createState() => _PremiumPortalDialogState();
}

class _PremiumPortalDialogState extends State<_PremiumPortalDialog>
    with TickerProviderStateMixin {
  _PortalMode _mode = _PortalMode.main;
  double _rotation = 0;
  int _activeIndex = 0;
  late final AnimationController _snapController;
  late final AnimationController _enterController;

  List<_PortalOrbAction> get _mainActions {
    final featured = _featuredSeries;
    return [
      _PortalOrbAction(
        id: 'watch',
        label: 'شاهد',
        sub: 'سلاسل وأفلام',
        icon: Icons.play_arrow_rounded,
        color: const Color(0xFFFFD34D),
        onTap: featured == null
            ? null
            : () {
                Navigator.of(context).pop();
                widget.onOpenSeries(featured);
              },
      ),
      _PortalOrbAction(
        id: 'read',
        label: 'اقرأ',
        sub: 'قصص وكوميكس',
        icon: Icons.menu_book_rounded,
        color: const Color(0xFF00D6F5),
        onTap: () {
          Navigator.of(context).pop();
          widget.onExplore();
        },
      ),
      _PortalOrbAction(
        id: 'listen',
        label: 'استمع',
        sub: 'صوتيات وأناشيد',
        icon: Icons.headphones_rounded,
        color: const Color(0xFF6A3DF2),
        onTap: () {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('الصوتيات ستتوفر قريباً في هذا الكوكب.')),
          );
        },
      ),
      _PortalOrbAction(
        id: 'play',
        label: 'العب',
        sub: 'ألعاب تفاعلية',
        icon: Icons.sports_esports_rounded,
        color: const Color(0xFF5BE7A9),
        onTap: () {
          Navigator.of(context).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('الألعاب الآمنة داخل الكواكب.')),
          );
        },
      ),
      _PortalOrbAction(
        id: 'learn',
        label: 'تعلّم',
        sub: 'رحلات ومهارات',
        icon: Icons.science_rounded,
        color: const Color(0xFF2856D8),
        onTap: () {
          Navigator.of(context).pop();
          widget.onExplore();
        },
      ),
      _PortalOrbAction(
        id: 'discover',
        label: 'اكتشف',
        sub: 'الكواكب التسعة',
        icon: Icons.public_rounded,
        color: const Color(0xFFFF6FAE),
        isDiscover: true,
        onTap: () {
          MajarraAnalytics.log('portal_mode_selected', params: {'mode': 'planets'});
          setState(() {
            _mode = _PortalMode.planets;
            _rotation = 0;
            _activeIndex = 0;
          });
          HapticFeedback.lightImpact();
        },
      ),
    ];
  }

  SeriesItem? get _featuredSeries {
    for (final spotlight in widget.catalog.spotlights) {
      if (!spotlight.enabled) continue;
      final series = widget.catalog.seriesById(spotlight.seriesId);
      if (series != null) return series;
    }
    return widget.catalog.series.isEmpty ? null : widget.catalog.series.first;
  }

  @override
  void initState() {
    super.initState();
    _snapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _enterController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 520),
    );
    _enterController.forward();
  }

  @override
  void dispose() {
    _snapController.dispose();
    _enterController.dispose();
    super.dispose();
  }

  void _onPanStart(DragStartDetails _) {
    _snapController.stop();
  }

  void _onPanUpdate(DragUpdateDetails details, int count) {
    // Horizontal drag rotates, like gear
    final delta = details.delta.dx;
    setState(() {
      _rotation += delta * 0.012;
      _updateActive(count);
    });
  }

  void _onPanEnd(DragEndDetails _, int count) {
    _snapToNearest(count);
  }

  void _updateActive(int count) {
    final step = 2 * math.pi / count;
    // active is item whose angle closest to top (-pi/2)
    // angle = base + rotation + i*step, base = -pi/2
    // => we want i where angle % 2pi == -pi/2 => rotation + i*step == 0 mod 2pi
    // => i = -rotation/step
    final raw = (-_rotation / step);
    var idx = raw.round() % count;
    if (idx < 0) idx += count;
    if (idx != _activeIndex) {
      _activeIndex = idx;
      HapticFeedback.selectionClick();
    }
  }

  void _snapToNearest(int count) {
    final step = 2 * math.pi / count;
    final targetRot = -_activeIndex * step;
    // Normalize rotation diff to shortest path
    var diff = targetRot - _rotation;
    // wrap diff to [-pi, pi]
    diff = (diff + math.pi) % (2 * math.pi) - math.pi;

    final startRot = _rotation;
    final endRot = startRot + diff;

    _snapController
      ..value = 0
      ..animateTo(1, curve: Curves.easeOutCubic).whenComplete(() {});
    
    _snapController.addListener(() {
      if (!mounted) return;
      final t = Curves.easeOutCubic.transform(_snapController.value);
      setState(() {
        _rotation = lerpDouble(startRot, endRot, t)!;
      });
    });
  }

  void _selectActiveMain() {
    final action = _mainActions[_activeIndex];
    if (action.onTap != null) action.onTap!();
  }

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return _buildReducedMotion();
    }

    final size = MediaQuery.sizeOf(context);
    final isSmall = size.height < 700;
    final count = _mode == _PortalMode.main ? 6 : widget.catalog.planets.length;
    final step = count == 0 ? 1.0 : 2 * math.pi / count;

    return Semantics(
      scopesRoute: true,
      explicitChildNodes: true,
      namesRoute: true,
      label: 'بوابة مجرة',
      child: Material(
        type: MaterialType.transparency,
        child: Stack(
          children: [
            // Cinematic backdrop with blur
            Positioned.fill(
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: ClipRect(
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                    child: Container(
                      decoration: BoxDecoration(
                        color: const Color(0xFF06091A).withValues(alpha: 0.86),
                        gradient: RadialGradient(
                          center: const Alignment(0, 0.6),
                          radius: 1.2,
                          colors: [
                            const Color(0xFF101A40).withValues(alpha: 0.72),
                            const Color(0xFF06091A).withValues(alpha: 0.92),
                            const Color(0xFF02040E),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),

            // Large circular glow backdrop
            Positioned(
              bottom: -180,
              left: size.width * 0.5 - 340,
              child: IgnorePointer(
                child: Container(
                  width: 680,
                  height: 680,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        const Color(0xFF1B2550).withValues(alpha: 0.92),
                        const Color(0xFF101735).withValues(alpha: 0.88),
                        const Color(0xFF06091A).withValues(alpha: 0.0),
                      ],
                      stops: const [0, 0.58, 1],
                    ),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.06),
                      width: 1,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.cosmicPurple.withValues(alpha: 0.12),
                        blurRadius: 60,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            SafeArea(
              child: Column(
                children: [
                  // Top bar
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(
                      children: [
                        IconButton(
                          onPressed: () {
                            if (_mode == _PortalMode.planets) {
                              setState(() {
                                _mode = _PortalMode.main;
                                _rotation = 0;
                                _activeIndex = 0;
                              });
                            } else {
                              Navigator.of(context).pop();
                            }
                          },
                          icon: Icon(
                            _mode == _PortalMode.planets
                                ? Icons.arrow_forward_rounded
                                : Icons.close_rounded,
                            color: Colors.white.withValues(alpha: 0.82),
                          ),
                          style: IconButton.styleFrom(
                            backgroundColor: Colors.white.withValues(alpha: 0.08),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _mode == _PortalMode.main ? 'بوابة مجرة' : 'الكواكب التسعة',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            Text(
                              _mode == _PortalMode.main
                                  ? 'اسحب الحلقة للدوران • اضغط للاختيار'
                                  : 'اختر كوكبك للانطلاق',
                              style: TextStyle(
                                color: AppColors.mutedText.withValues(alpha: 0.72),
                                fontSize: 10.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const Spacer(),

                  // Active item detail at top of orbit
                  AnimatedBuilder(
                    animation: _enterController,
                    builder: (_, __) {
                      final activeAction = _mode == _PortalMode.main
                          ? _mainActions[_activeIndex]
                          : null;
                      final activePlanet = _mode == _PortalMode.planets &&
                              widget.catalog.planets.isNotEmpty
                          ? widget.catalog.planets[
                              _activeIndex % widget.catalog.planets.length]
                          : null;

                      return Opacity(
                        opacity: _enterController.value.clamp(0.0, 1.0),
                        child: Transform.translate(
                          offset: Offset(0, (1 - _enterController.value) * 18),
                          child: Column(
                            children: [
                              if (activeAction != null) ...[
                                Container(
                                  width: 64,
                                  height: 64,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: activeAction.color.withValues(alpha: 0.18),
                                    border: Border.all(
                                      color: activeAction.color.withValues(alpha: 0.62),
                                      width: 1.4,
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: activeAction.color.withValues(alpha: 0.32),
                                        blurRadius: 22,
                                      ),
                                    ],
                                  ),
                                  child: Icon(
                                    activeAction.icon,
                                    color: Colors.white,
                                    size: 30,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  activeAction.label,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  activeAction.sub,
                                  style: TextStyle(
                                    color: AppColors.mutedText.withValues(alpha: 0.78),
                                    fontSize: 11.5,
                                  ),
                                ),
                              ] else if (activePlanet != null) ...[
                                PlanetSymbol(
                                  planetId: activePlanet.id,
                                  colorHex: activePlanet.colorHex,
                                  semanticLabel: activePlanet.name,
                                  size: 82,
                                  selected: true,
                                  imageAsset: activePlanet.imageAsset,
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  activePlanet.name,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  activePlanet.description,
                                  style: TextStyle(
                                    color: AppColors.mutedText.withValues(alpha: 0.78),
                                    fontSize: 11.5,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),

                  const SizedBox(height: 18),

                  // Orbital fan
                  _buildOrbitalFan(context, count, step, isSmall),

                  const SizedBox(height: 18),

                  // Bottom hint
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.swipe_rounded,
                          size: 14,
                          color: Colors.white.withValues(alpha: 0.32),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          'اسحب يمين أو يسار للدوران',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.32),
                            fontSize: 10,
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
      ),
    );
  }

  Widget _buildOrbitalFan(BuildContext context, int count, double step, bool isSmall) {
    final screenWidth = MediaQuery.sizeOf(context).width;
    final fanWidth = math.min(screenWidth - 24, 400.0);
    final fanHeight = _mode == _PortalMode.main
        ? (isSmall ? 320.0 : 380.0)
        : (isSmall ? 360.0 : 420.0);
    const portalSize = 88.0;
    final portalCenter = Offset(fanWidth / 2, fanHeight - portalSize / 2 - 12);
    final radius = _mode == _PortalMode.main
        ? fanWidth * 0.38
        : fanWidth * 0.40;

    return GestureDetector(
      onHorizontalDragStart: _onPanStart,
      onHorizontalDragUpdate: (d) => _onPanUpdate(d, count),
      onHorizontalDragEnd: (d) => _onPanEnd(d, count),
      onPanStart: (d) => _onPanStart(DragStartDetails()),
      onPanUpdate: (d) => _onPanUpdate(
        DragUpdateDetails(
          delta: d.delta,
          globalPosition: d.globalPosition,
          localPosition: d.localPosition,
        ),
        count,
      ),
      child: SizedBox(
        width: fanWidth,
        height: fanHeight,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.bottomCenter,
          children: [
            // Orbit circle line
            Positioned.fill(
              child: CustomPaint(
                painter: _OrbitLinePainter(
                  center: portalCenter,
                  radius: radius,
                  activeIndex: _activeIndex,
                  count: count,
                  rotation: _rotation,
                ),
              ),
            ),

            // Place actions / planets
            for (int i = 0; i < count; i++)
              _buildOrbItem(
                index: i,
                count: count,
                step: step,
                portalCenter: portalCenter,
                radius: radius,
                fanWidth: fanWidth,
              ),

            // Center portal orb - "اختر لي"
            Positioned(
              left: portalCenter.dx - portalSize / 2,
              top: portalCenter.dy - portalSize / 2,
              child: GestureDetector(
                onTap: () {
                  if (_mode == _PortalMode.main) {
                    _selectActiveMain();
                  } else {
                    final planet = widget.catalog.planets[
                        _activeIndex % widget.catalog.planets.length];
                    // Planet id is a fixed catalogue key, not user content, so
                    // it carries no PII.
                    MajarraAnalytics.planetSelected(planet.id);
                    if (widget.onOpenPlanet != null) {
                      Navigator.of(context).pop();
                      widget.onOpenPlanet!(planet.id);
                    } else {
                      Navigator.of(context).pop();
                      widget.onExplore();
                    }
                  }
                },
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    // Glow
                    Container(
                      width: portalSize + 18,
                      height: portalSize + 18,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF6A3DF2).withValues(alpha: 0.34),
                            blurRadius: 28,
                          ),
                          BoxShadow(
                            color: const Color(0xFF00D6F5).withValues(alpha: 0.18),
                            blurRadius: 42,
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: portalSize,
                      height: portalSize,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: const RadialGradient(
                          center: Alignment(0.15, -0.25),
                          radius: 1.15,
                          colors: [
                            Color(0xFFEDE8FF),
                            Color(0xFF9B8CFF),
                            Color(0xFF6A3DF2),
                            Color(0xFF2A1F80),
                          ],
                          stops: [0, 0.24, 0.52, 1],
                        ),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.22),
                          width: 1.2,
                        ),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.auto_awesome_rounded,
                            color: Colors.white,
                            size: 18,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _mode == _PortalMode.main ? 'اختر لي' : 'ادخل',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrbItem({
    required int index,
    required int count,
    required double step,
    required Offset portalCenter,
    required double radius,
    required double fanWidth,
  }) {
    final angle = -math.pi / 2 + _rotation + index * step;
    final x = portalCenter.dx + radius * math.cos(angle);
    final y = portalCenter.dy + radius * math.sin(angle);
    final isActive = index == _activeIndex;
    final distFromActive = (index - _activeIndex).abs();
    final wrappedDist = math.min(distFromActive, count - distFromActive);
    final scale = isActive ? 1.18 : (0.86 - wrappedDist * 0.06).clamp(0.68, 0.92).toDouble();
    final opacity = isActive ? 1.0 : (0.58 - wrappedDist * 0.08).clamp(0.32, 0.72).toDouble();

    if (_mode == _PortalMode.main) {
      final action = _mainActions[index % _mainActions.length];
      return Positioned(
        left: x - 32,
        top: y - 38,
        child: Opacity(
          opacity: opacity,
          child: Transform.scale(
            scale: scale,
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _activeIndex = index;
                  _rotation = -index * step;
                });
                HapticFeedback.lightImpact();
                Future.delayed(const Duration(milliseconds: 120), () {
                  if (action.onTap != null) action.onTap!();
                });
              },
              child: Column(
                children: [
                  Container(
                    width: isActive ? 62 : 54,
                    height: isActive ? 62 : 54,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isActive
                          ? action.color.withValues(alpha: 0.22)
                          : const Color(0xFF121A38).withValues(alpha: 0.86),
                      border: Border.all(
                        color: isActive
                            ? action.color.withValues(alpha: 0.82)
                            : Colors.white.withValues(alpha: 0.10),
                        width: isActive ? 1.6 : 1,
                      ),
                      boxShadow: [
                        if (isActive)
                          BoxShadow(
                            color: action.color.withValues(alpha: 0.32),
                            blurRadius: 18,
                          ),
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.28),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(
                      action.icon,
                      color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.78),
                      size: isActive ? 28 : 24,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    action.label,
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.62),
                      fontSize: isActive ? 11 : 10,
                      fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    } else {
      final planet = widget.catalog.planets[index % widget.catalog.planets.length];
      return Positioned(
        left: x - 32,
        top: y - 40,
        child: Opacity(
          opacity: opacity,
          child: Transform.scale(
            scale: scale,
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _activeIndex = index;
                  _rotation = -index * step;
                });
                HapticFeedback.lightImpact();
              },
              child: Column(
                children: [
                  PlanetSymbol(
                    planetId: planet.id,
                    colorHex: planet.colorHex,
                    semanticLabel: planet.name,
                    size: isActive ? 62 : 52,
                    selected: isActive,
                    imageAsset: planet.imageAsset,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    planet.name.replaceFirst('كوكب ', ''),
                    style: TextStyle(
                      color: isActive ? Colors.white : Colors.white.withValues(alpha: 0.62),
                      fontSize: isActive ? 11 : 10,
                      fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
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

  Widget _buildReducedMotion() {
    return SafeArea(
      child: Align(
        alignment: Alignment.bottomCenter,
        child: Material(
          color: const Color(0xFF0B1026),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480, maxHeight: 560),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.22),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 18),
                  const Text(
                    'بوابة مجرة',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 16),
                  GridView.count(
                    crossAxisCount: 3,
                    shrinkWrap: true,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    children: _mainActions
                        .map((a) => InkWell(
                              onTap: a.onTap,
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFF121A38),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                                ),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(a.icon, color: Colors.white),
                                    const SizedBox(height: 6),
                                    Text(a.label, style: const TextStyle(color: Colors.white, fontSize: 11)),
                                  ],
                                ),
                              ),
                            ))
                        .toList(),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('إغلاق'),
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

class _PortalOrbAction {
  const _PortalOrbAction({
    required this.id,
    required this.label,
    required this.sub,
    required this.icon,
    required this.color,
    this.isDiscover = false,
    this.onTap,
  });

  final String id;
  final String label;
  final String sub;
  final IconData icon;
  final Color color;
  final bool isDiscover;
  final VoidCallback? onTap;
}

class _OrbitLinePainter extends CustomPainter {
  const _OrbitLinePainter({
    required this.center,
    required this.radius,
    required this.activeIndex,
    required this.count,
    required this.rotation,
  });

  final Offset center;
  final double radius;
  final int activeIndex;
  final int count;
  final double rotation;

  @override
  void paint(Canvas canvas, Size size) {
    final orbitPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = Colors.white.withValues(alpha: 0.09);

    canvas.drawCircle(center, radius, orbitPaint);

    // Active tick
    final step = 2 * math.pi / count;
    final activeAngle = -math.pi / 2 + rotation + activeIndex * step;
    final tickPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = AppColors.starGold.withValues(alpha: 0.52);
    
    final tickStart = Offset(
      center.dx + (radius - 6) * math.cos(activeAngle),
      center.dy + (radius - 6) * math.sin(activeAngle),
    );
    final tickEnd = Offset(
      center.dx + (radius + 6) * math.cos(activeAngle),
      center.dy + (radius + 6) * math.sin(activeAngle),
    );
    canvas.drawLine(tickStart, tickEnd, tickPaint);

    // Dots
    final dotPaint = Paint()..color = AppColors.electricCyan.withValues(alpha: 0.28);
    for (int i = 0; i < count; i++) {
      final ang = -math.pi / 2 + rotation + i * step;
      if (i == activeIndex) continue;
      final p = Offset(
        center.dx + radius * math.cos(ang),
        center.dy + radius * math.sin(ang),
      );
      canvas.drawCircle(p, 2, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _OrbitLinePainter old) =>
      old.center != center ||
      old.radius != radius ||
      old.activeIndex != activeIndex ||
      old.count != count ||
      old.rotation != rotation;
}

class _GalaxySpiralPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final r = size.shortestSide * 0.34;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round;

    // Two spiral arms
    for (int arm = 0; arm < 2; arm++) {
      final path = Path();
      final startAngle = arm * math.pi;
      bool first = true;
      for (double t = 0; t <= 1; t += 0.02) {
        final angle = startAngle + t * math.pi * 1.65;
        final rad = r * (0.18 + t * 0.82);
        final x = center.dx + rad * math.cos(angle);
        final y = center.dy + rad * math.sin(angle) * 0.55;
        if (first) {
          path.moveTo(x, y);
          first = false;
        } else {
          path.lineTo(x, y);
        }
      }
      paint.color = arm == 0
          ? const Color(0xFF00D6F5).withValues(alpha: 0.85)
          : const Color(0xFFFF6FAE).withValues(alpha: 0.75);
      paint.strokeWidth = arm == 0 ? 1.8 : 1.4;
      canvas.drawPath(path, paint);
      // Glow under
      paint.color = paint.color.withValues(alpha: 0.18);
      paint.strokeWidth = 4;
      canvas.drawPath(path, paint);
    }

    // Small stars
    final starPaint = Paint()..color = Colors.white.withValues(alpha: 0.72);
    canvas.drawCircle(Offset(center.dx + r * 0.62, center.dy - r * 0.22), 1.6, starPaint);
    canvas.drawCircle(Offset(center.dx - r * 0.48, center.dy + r * 0.18), 1.2, starPaint);
    canvas.drawCircle(Offset(center.dx + r * 0.22, center.dy + r * 0.42), 1, starPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => false;
}

class _PortalOrbitPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final outerRadius = size.shortestSide * 0.46;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1
      ..color = Colors.white.withValues(alpha: 0.18);

    canvas.drawCircle(center, outerRadius, paint);
    canvas.drawCircle(center, outerRadius * 0.66, paint..color = Colors.white.withValues(alpha: 0.08));

    // Small dots on orbit
    final dotPaint = Paint()..color = AppColors.starGold.withValues(alpha: 0.92);
    canvas.drawCircle(Offset(center.dx, center.dy - outerRadius), 2.6, dotPaint);
    canvas.drawCircle(Offset(center.dx + outerRadius * 0.72, center.dy + outerRadius * 0.42), 1.8, dotPaint);
  }

  @override
  bool shouldRepaint(covariant _PortalOrbitPainter old) => false;
}

double? lerpDouble(double a, double b, double t) => a + (b - a) * t;
