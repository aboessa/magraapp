import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import 'home_v2_tokens.dart';

/// Ambient backdrop that re-lights itself around an accent colour.
///
/// Large streaming apps do not paint a static gradient behind the feed: the
/// backdrop picks up the artwork of whatever is currently featured, so moving
/// between titles feels like a lighting change on a stage. [HomeAmbientStage]
/// reproduces that by crossfading two bloom layers whenever [accent] changes.
///
/// The colour is supplied by the caller (billboard page, or focused card on TV)
/// rather than sampled from the image, because palette extraction would mean
/// decoding every poster on the main isolate.
class HomeAmbientStage extends StatelessWidget {
  const HomeAmbientStage({
    required this.accent,
    required this.child,
    this.intensity = 1,
    super.key,
  });

  final Color accent;
  final Widget child;

  /// Scales bloom opacity. TV uses a lower value because the panel is larger
  /// and the same alpha reads as haze rather than glow.
  final double intensity;

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.cinematicBackground),
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Bloom layer. AnimatedContainer gives us the crossfade between
          // accents for free; under reduce-motion it snaps instead.
          AnimatedContainer(
            duration: reduceMotion ? Duration.zero : HomeV2Tokens.ambientFade,
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0.62, -0.86),
                radius: 1.32,
                colors: [
                  accent.withValues(alpha: 0.30 * intensity),
                  accent.withValues(alpha: 0.10 * intensity),
                  Colors.transparent,
                ],
                stops: const [0, 0.42, 1],
              ),
            ),
          ),
          // Counter-bloom on the opposite corner keeps the frame from looking
          // lit from a single lamp.
          AnimatedContainer(
            duration: reduceMotion ? Duration.zero : HomeV2Tokens.ambientFade,
            curve: Curves.easeOutCubic,
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(-0.78, 0.52),
                radius: 1.1,
                colors: [
                  AppColors.royalBlue.withValues(alpha: 0.16 * intensity),
                  Colors.transparent,
                ],
              ),
            ),
          ),
          // Vignette: pulls the eye to the centre and stops rails from
          // visually bleeding off the edges.
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.05,
                colors: [Colors.transparent, Color(0x8A050817)],
                stops: [0.52, 1],
              ),
            ),
          ),
          RepaintBoundary(
            child: CustomPaint(
              painter: const _StarfieldPainter(),
              size: Size.infinite,
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// Deterministic starfield.
///
/// Uses a fixed seed so stars never re-shuffle between rebuilds, which would
/// read as flicker. Painted once inside a [RepaintBoundary].
class _StarfieldPainter extends CustomPainter {
  const _StarfieldPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final random = math.Random(20260807);
    final paint = Paint()..color = AppColors.starlight;

    for (var i = 0; i < 90; i++) {
      final dx = random.nextDouble() * size.width;
      // Bias stars to the upper two thirds where the billboard sits.
      final dy = random.nextDouble() * size.height * 0.68;
      final radius = random.nextDouble() * 1.05 + 0.35;
      paint.color = AppColors.starlight.withValues(
        alpha: random.nextDouble() * 0.34 + 0.05,
      );
      canvas.drawCircle(Offset(dx, dy), radius, paint);
    }
  }

  @override
  bool shouldRepaint(_StarfieldPainter oldDelegate) => false;
}
