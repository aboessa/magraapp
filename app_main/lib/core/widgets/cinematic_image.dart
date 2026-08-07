import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

class CinematicImage extends StatelessWidget {
  const CinematicImage({
    required this.assetPath,
    required this.semanticLabel,
    this.networkUrl,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    super.key,
  });

  final String assetPath;
  final String semanticLabel;
  final String? networkUrl;
  final BoxFit fit;
  final AlignmentGeometry alignment;

  bool get _hasSafeNetworkUrl {
    final uri = Uri.tryParse(networkUrl ?? '');
    return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final fallback = Image.asset(
      assetPath,
      fit: fit,
      alignment: alignment,
      filterQuality: FilterQuality.medium,
      errorBuilder: (context, error, stackTrace) => const _ImageFallback(),
    );

    return Semantics(
      image: true,
      label: semanticLabel,
      child: ExcludeSemantics(
        child: _hasSafeNetworkUrl
            ? Image.network(
                networkUrl!,
                fit: fit,
                alignment: alignment,
                filterQuality: FilterQuality.medium,
                errorBuilder: (context, error, stackTrace) => fallback,
                frameBuilder: (context, child, frame, syncLoaded) {
                  if (syncLoaded || MediaQuery.disableAnimationsOf(context)) {
                    return child;
                  }
                  return AnimatedOpacity(
                    opacity: frame == null ? 0 : 1,
                    duration: const Duration(milliseconds: 260),
                    child: child,
                  );
                },
              )
            : fallback,
      ),
    );
  }
}

/// Retained for non-planet artwork which includes an embedded title.
class CroppedCinematicImage extends StatelessWidget {
  const CroppedCinematicImage({
    required this.assetPath,
    required this.semanticLabel,
    this.networkUrl,
    this.visibleFraction = 0.58,
    this.borderRadius = BorderRadius.zero,
    super.key,
  });

  final String assetPath;
  final String semanticLabel;
  final String? networkUrl;
  final double visibleFraction;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedHeight || constraints.maxHeight <= 0) {
          return CinematicImage(
            assetPath: assetPath,
            networkUrl: networkUrl,
            semanticLabel: semanticLabel,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          );
        }

        final sourceHeight = constraints.maxHeight / visibleFraction;
        return SizedBox.expand(
          child: ClipRRect(
            borderRadius: borderRadius,
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned(
                  top: 0,
                  right: 0,
                  left: 0,
                  height: sourceHeight,
                  child: CinematicImage(
                    assetPath: assetPath,
                    networkUrl: networkUrl,
                    semanticLabel: semanticLabel,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                  ),
                ),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    height: constraints.maxHeight * 0.28,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xB006091A)],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Cinematic premium planet marker - Majarra original artwork treatment
/// - 3D sphere gradient, inner highlight, outer glow
/// - Bright orbit ellipse with dots
/// - Readable at 48/64px
class PlanetSymbol extends StatelessWidget {
  const PlanetSymbol({
    required this.planetId,
    required this.colorHex,
    required this.semanticLabel,
    required this.size,
    this.showOrbit = true,
    this.selected = false,
    this.imageAsset,
    super.key,
  });

  final String planetId;
  final String colorHex;
  final String semanticLabel;
  final double size;
  final bool showOrbit;
  final bool selected;
  final String? imageAsset;

  @override
  Widget build(BuildContext context) {
    final accent = _colorFromHex(colorHex);
    final hasImage = imageAsset != null && imageAsset!.isNotEmpty;
    final lightAccent = Color.lerp(accent, Colors.white, 0.42) ?? accent;

    // If we have a real planet artwork, show it with cinematic treatment
    if (hasImage) {
      return Semantics(
        image: true,
        label: semanticLabel,
        child: SizedBox.square(
          dimension: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (selected)
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.42),
                        blurRadius: size * 0.32,
                        spreadRadius: size * 0.04,
                      ),
                    ],
                  ),
                ),
              // Image with circular clip + border + shadow
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.30)
                        : Colors.white.withValues(alpha: 0.13),
                    width: selected ? 1.8 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.40),
                      blurRadius: size * 0.24,
                      offset: Offset(0, size * 0.08),
                    ),
                    BoxShadow(
                      color: accent.withValues(alpha: 0.22),
                      blurRadius: size * 0.18,
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Image.asset(
                  imageAsset!,
                  width: size,
                  height: size,
                  fit: BoxFit.cover,
                  filterQuality: FilterQuality.high,
                  errorBuilder: (_, __, ___) => _fallbackSphere(accent, lightAccent, selected, size),
                ),
              ),
              if (showOrbit)
                Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(
                      painter: _PlanetOrbitPainter(accent: accent, selected: selected),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    final icon = _iconForPlanet(planetId);
    return Semantics(
      image: true,
      label: semanticLabel,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer glow - cinematic
              if (selected)
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.42),
                        blurRadius: size * 0.32,
                        spreadRadius: size * 0.04,
                      ),
                    ],
                  ),
                ),

              // Main sphere - 3D gradient like planet
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    center: const Alignment(-0.34, -0.42),
                    radius: 1.15,
                    colors: [
                      lightAccent,
                      accent,
                      accent.withValues(alpha: 0.78),
                      const Color(0xFF101735),
                      const Color(0xFF06091A),
                    ],
                    stops: const [0, 0.22, 0.42, 0.72, 1],
                  ),
                  border: Border.all(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.32)
                        : Colors.white.withValues(alpha: 0.14),
                    width: selected ? 1.6 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.38),
                      blurRadius: size * 0.22,
                      offset: Offset(0, size * 0.08),
                    ),
                    BoxShadow(
                      color: accent.withValues(alpha: 0.28),
                      blurRadius: size * 0.18,
                    ),
                  ],
                ),
              ),

              // Inner highlight - top left glass reflection
              Positioned(
                top: size * 0.10,
                left: size * 0.14,
                child: Container(
                  width: size * 0.28,
                  height: size * 0.28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.white.withValues(alpha: 0.42),
                        Colors.white.withValues(alpha: 0.0),
                      ],
                      stops: const [0, 1],
                    ),
                  ),
                ),
              ),

              // Orbit - bright cinematic planet orbit
              if (showOrbit)
                Positioned.fill(
                  child: CustomPaint(
                    painter: _PlanetOrbitPainter(
                      accent: accent,
                      selected: selected,
                    ),
                  ),
                ),

              // Center icon - with shadow
              Icon(
                icon,
                color: Colors.white,
                size: size * 0.46,
                shadows: [
                  Shadow(
                    color: Colors.black.withValues(alpha: 0.42),
                    blurRadius: 8,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _iconForPlanet(String id) {
    return switch (id) {
      'abjad' => Icons.translate_rounded,
      'arqam' => Icons.calculate_rounded,
      'oloom' => Icons.biotech_rounded,
      'qiyam' => Icons.volunteer_activism_rounded,
      'qisas' => Icons.menu_book_rounded,
      'ibdaa' => Icons.palette_rounded,
      'maharat' => Icons.extension_rounded,
      'tarikh' => Icons.account_balance_rounded,
      'iman' => Icons.favorite_rounded,
      _ => Icons.public_rounded,
    };
  }

  Widget _fallbackSphere(Color accent, Color lightAccent, bool selected, double size) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: const Alignment(-0.34, -0.42),
          radius: 1.15,
          colors: [lightAccent, accent, const Color(0xFF101735), const Color(0xFF06091A)],
          stops: const [0, 0.22, 0.72, 1],
        ),
      ),
      child: Center(
        child: Icon(_iconForPlanet(planetId), color: Colors.white, size: size * 0.46),
      ),
    );
  }
}

class _PlanetOrbitPainter extends CustomPainter {
  const _PlanetOrbitPainter({required this.accent, required this.selected});

  final Color accent;
  final bool selected;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final shortSide = size.shortestSide;

    // Main orbit ellipse
    final orbitPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 1.5 : 1.2
      ..color = Colors.white.withValues(alpha: selected ? 0.42 : 0.28)
      ..strokeCap = StrokeCap.round;

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(-0.38);
    canvas.scale(1, 0.52);
    canvas.drawCircle(Offset.zero, shortSide * 0.49, orbitPaint);
    canvas.restore();

    // Secondary faint orbit
    final secondOrbitPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8
      ..color = accent.withValues(alpha: 0.32);

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(0.25);
    canvas.scale(1, 0.38);
    canvas.drawCircle(Offset.zero, shortSide * 0.58, secondOrbitPaint);
    canvas.restore();

    // Orbit dots - gold and accent
    final dotPaint = Paint()..style = PaintingStyle.fill;

    // Gold star dot
    dotPaint.color = AppColors.starGold;
    canvas.drawCircle(
      Offset(
        center.dx + shortSide * 0.38,
        center.dy - shortSide * 0.18,
      ),
      shortSide * 0.042,
      dotPaint,
    );

    // Accent dot
    dotPaint.color = accent.withValues(alpha: 0.92);
    canvas.drawCircle(
      Offset(
        center.dx - shortSide * 0.34,
        center.dy + shortSide * 0.22,
      ),
      shortSide * 0.032,
      dotPaint,
    );

    // Small white dot for depth
    dotPaint.color = Colors.white.withValues(alpha: 0.65);
    canvas.drawCircle(
      Offset(
        center.dx - shortSide * 0.18,
        center.dy - shortSide * 0.36,
      ),
      shortSide * 0.022,
      dotPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _PlanetOrbitPainter oldDelegate) {
    return oldDelegate.accent != accent || oldDelegate.selected != selected;
  }
}

Color _colorFromHex(String value) {
  final normalized = value.replaceFirst('#', '');
  return Color(int.parse(normalized, radix: 16) | 0xFF000000);
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(gradient: AppColors.brandGradient),
      child: Center(
        child: Icon(
          Icons.auto_awesome_rounded,
          color: AppColors.starlight,
          size: 42,
        ),
      ),
    );
  }
}
