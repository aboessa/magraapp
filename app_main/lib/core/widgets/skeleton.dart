import 'package:flutter/material.dart';

/// Skeleton loader بنفس أبعاد البطاقات - MAJARRA_CINEMATIC_STREAMING_UX_PLAN.md:567
class SkeletonCard extends StatefulWidget {
  const SkeletonCard({required this.width, required this.height, this.borderRadius = 16, super.key});
  final double width;
  final double height;
  final double borderRadius;

  @override
  State<SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<SkeletonCard> with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) {
        final t = reduce ? 0.5 : _ctrl.value;
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(widget.borderRadius),
            gradient: LinearGradient(
              begin: AlignmentDirectional.centerStart,
              end: AlignmentDirectional.centerEnd,
              colors: [
                const Color(0xFF0B1026).withValues(alpha: 0.72 + t * 0.12),
                const Color(0xFF161F45).withValues(alpha: 0.42 + t * 0.14),
                const Color(0xFF0B1026).withValues(alpha: 0.72 + t * 0.12),
              ],
            ),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
        );
      },
    );
  }
}

class SkeletonRail extends StatelessWidget {
  const SkeletonRail({required this.height, required this.cardWidth, required this.cardHeight, super.key});
  final double height;
  final double cardWidth;
  final double cardHeight;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsetsDirectional.symmetric(horizontal: MediaQuery.sizeOf(context).width < 600 ? 18 : 32),
        itemCount: 4,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (_, __) => SkeletonCard(width: cardWidth, height: cardHeight),
      ),
    );
  }
}
