import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

class AnimatedBrandLogo extends StatefulWidget {
  const AnimatedBrandLogo({this.size = 132, super.key});

  final double size;

  @override
  State<AnimatedBrandLogo> createState() => _AnimatedBrandLogoState();
}

class _AnimatedBrandLogoState extends State<AnimatedBrandLogo>
    with TickerProviderStateMixin {
  late final AnimationController _orbitController;
  late final AnimationController _pulseController;
  bool? _reduceMotion;

  @override
  void initState() {
    super.initState();
    _orbitController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 12),
    );
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2800),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    if (_reduceMotion == reduceMotion) return;
    _reduceMotion = reduceMotion;
    if (reduceMotion) {
      _orbitController.stop();
      _pulseController.stop();
      _orbitController.value = 0.08;
      _pulseController.value = 0.5;
    } else {
      _orbitController.repeat();
      _pulseController.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _orbitController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      label: 'شعار مجرة',
      child: SizedBox.square(
        dimension: widget.size,
        child: AnimatedBuilder(
          animation: Listenable.merge([_orbitController, _pulseController]),
          builder: (context, child) {
            final pulse = 0.94 + (_pulseController.value * 0.06);
            return Stack(
              alignment: Alignment.center,
              children: [
                Transform.rotate(
                  angle: _orbitController.value * math.pi * 2,
                  child: _Orbit(size: widget.size, reverse: false),
                ),
                Transform.rotate(
                  angle: -_orbitController.value * math.pi * 1.45,
                  child: _Orbit(size: widget.size * 0.79, reverse: true),
                ),
                Transform.scale(
                  scale: pulse,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.midnight.withValues(alpha: 0.82),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.electricCyan.withValues(
                            alpha: 0.18 + _pulseController.value * 0.16,
                          ),
                          blurRadius: 24 + _pulseController.value * 16,
                          spreadRadius: 1,
                        ),
                      ],
                    ),
                    child: Padding(
                      padding: EdgeInsets.all(widget.size * 0.18),
                      child: Image.asset(
                        'assets/brand/majarra-logo.png',
                        fit: BoxFit.contain,
                        filterQuality: FilterQuality.high,
                        excludeFromSemantics: true,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Orbit extends StatelessWidget {
  const _Orbit({required this.size, required this.reverse});

  final double size;
  final bool reverse;

  @override
  Widget build(BuildContext context) {
    return SizedBox.square(
      dimension: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            margin: EdgeInsets.all(size * 0.04),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color:
                    (reverse ? AppColors.cosmicPurple : AppColors.electricCyan)
                        .withValues(alpha: 0.3),
                width: 1.2,
              ),
            ),
          ),
          Align(
            alignment: reverse
                ? AlignmentDirectional.bottomStart
                : AlignmentDirectional.topEnd,
            child: Container(
              width: size * 0.075,
              height: size * 0.075,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: reverse ? AppColors.starGold : AppColors.electricCyan,
                boxShadow: [
                  BoxShadow(
                    color:
                        (reverse ? AppColors.starGold : AppColors.electricCyan)
                            .withValues(alpha: 0.7),
                    blurRadius: 12,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class BrandLoadingView extends StatelessWidget {
  const BrandLoadingView({
    this.message = 'نجهّز لك رحلة بين النجوم',
    super.key,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.deepSpace,
      child: Center(
        child: Semantics(
          liveRegion: true,
          label: message,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AnimatedBrandLogo(),
              const SizedBox(height: 24),
              Text(
                message,
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
