import 'package:flutter/material.dart';
import '../../app/theme/app_colors.dart';

/// Cinematic professional background for premium streaming surfaces
/// Layers:
/// 1. Deep Space base
/// 2. Radial blooms (purple, blue, cyan) - subtle 8-22% opacity
/// 3. Vertical vignette
/// 4. Grain texture (painter)
/// 5. Optional top glow for header
class CinematicBackground extends StatelessWidget {
  const CinematicBackground({
    required this.child,
    this.showTopGlow = false,
    this.showBottomVignette = true,
    super.key,
  });

  final Widget child;
  final bool showTopGlow;
  final bool showBottomVignette;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Base deep space
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.deepSpace,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFF0B1026),
                  Color(0xFF06091A),
                  Color(0xFF050817),
                ],
                stops: [0, 0.58, 1],
              ),
            ),
          ),
        ),

        // Radial bloom - Top right purple (main identity glow)
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0.82, -0.28),
                  radius: 1.1,
                  colors: [
                    const Color(0xFF6A3DF2).withValues(alpha: 0.18),
                    const Color(0xFF6A3DF2).withValues(alpha: 0.06),
                    Colors.transparent,
                  ],
                  stops: const [0, 0.35, 1],
                ),
              ),
            ),
          ),
        ),

        // Radial bloom - Top left blue
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.75, -0.15),
                  radius: 0.95,
                  colors: [
                    const Color(0xFF2856D8).withValues(alpha: 0.16),
                    const Color(0xFF2856D8).withValues(alpha: 0.04),
                    Colors.transparent,
                  ],
                  stops: const [0, 0.45, 1],
                ),
              ),
            ),
          ),
        ),

        // Radial bloom - Center left cyan subtle
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(-0.45, 0.15),
                  radius: 0.85,
                  colors: [
                    const Color(0xFF00D6F5).withValues(alpha: 0.07),
                    Colors.transparent,
                  ],
                  stops: const [0, 1],
                ),
              ),
            ),
          ),
        ),

        // Vertical vignette - darken edges, keep center slightly lighter like cinema
        Positioned.fill(
          child: IgnorePointer(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: const Alignment(0, 0),
                  radius: 1.35,
                  colors: [
                    Colors.transparent,
                    const Color(0xFF050817).withValues(alpha: 0.35),
                    const Color(0xFF02040E).withValues(alpha: 0.82),
                  ],
                  stops: const [0.55, 0.85, 1],
                ),
              ),
            ),
          ),
        ),

        // Top header glow line (very subtle)
        if (showTopGlow)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            child: IgnorePointer(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Colors.transparent,
                      const Color(0xFF2856D8).withValues(alpha: 0.22),
                      const Color(0xFF00D6F5).withValues(alpha: 0.18),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),

        // Grain texture overlay - adds premium film feel
        Positioned.fill(
          child: IgnorePointer(
            child: CustomPaint(
              painter: _FilmGrainPainter(),
              size: Size.infinite,
            ),
          ),
        ),

        // Ambient bottom vignette reinforcement
        if (showBottomVignette)
          Positioned.fill(
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.transparent,
                      const Color(0xFF050817).withValues(alpha: 0.55),
                    ],
                    stops: const [0, 0.6, 1],
                  ),
                ),
              ),
            ),
          ),

        // Actual content
        child,
      ],
    );
  }
}

/// Scaffold with cinematic background built-in
class CinematicScaffold extends StatelessWidget {
  const CinematicScaffold({
    required this.body,
    this.appBar,
    this.bottomNavigationBar,
    this.showTopGlow = true,
    super.key,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final Widget? bottomNavigationBar;
  final bool showTopGlow;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: appBar,
      body: CinematicBackground(
        showTopGlow: showTopGlow,
        child: body,
      ),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}

class _FilmGrainPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Very subtle grain using random dots - but we keep it cheap
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.012)
      ..style = PaintingStyle.fill;

    // Only draw a few dots to simulate grain without perf hit
    // Using deterministic pattern
    const spacing = 32.0;
    for (double y = 0; y < size.height; y += spacing) {
      for (double x = 0; x < size.width; x += spacing) {
        // Pseudo-random offset based on position
        final seed = (x * 0.1 + y * 0.13) % 1;
        if (seed > 0.6) {
          canvas.drawCircle(
            Offset(x + (seed * 3), y + (seed * 2)),
            0.5,
            paint,
          );
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Cinematic card decoration - reusable for all premium cards
class CinematicCardDecoration {
  static BoxDecoration premiumCard({
    double borderRadius = 18,
    bool withGlow = true,
    Color glowColor = const Color(0xFF2856D8),
  }) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: const Color(0xFFF2F6FF).withValues(alpha: 0.08),
        width: 1,
      ),
      boxShadow: [
        BoxShadow(
          color: const Color(0xFF000000).withValues(alpha: 0.38),
          blurRadius: 28,
          offset: const Offset(0, 16),
        ),
        BoxShadow(
          color: const Color(0xFFF2F6FF).withValues(alpha: 0.04),
          blurRadius: 0,
          spreadRadius: 1,
          offset: const Offset(0, 0),
        ),
        if (withGlow)
          BoxShadow(
            color: glowColor.withValues(alpha: 0.06),
            blurRadius: 20,
            offset: const Offset(0, 0),
          ),
      ],
    );
  }

  static BoxDecoration heroCard({
    double borderRadius = 20,
  }) {
    return BoxDecoration(
      borderRadius: BorderRadius.circular(borderRadius),
      border: Border.all(
        color: Colors.white.withValues(alpha: 0.10),
        width: 1,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.55),
          blurRadius: 40,
          offset: const Offset(0, 20),
        ),
        BoxShadow(
          color: AppColors.cosmicPurple.withValues(alpha: 0.12),
          blurRadius: 32,
          offset: const Offset(0, 0),
        ),
      ],
    );
  }

  static BoxDecoration circularAvatar({
    bool selected = false,
  }) {
    return BoxDecoration(
      shape: BoxShape.circle,
      border: Border.all(
        color: selected
            ? AppColors.starGold
            : Colors.white.withValues(alpha: 0.12),
        width: selected ? 2.2 : 1,
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.32),
          blurRadius: 16,
          offset: const Offset(0, 8),
        ),
        if (selected)
          BoxShadow(
            color: AppColors.starGold.withValues(alpha: 0.22),
            blurRadius: 16,
          ),
      ],
    );
  }
}
