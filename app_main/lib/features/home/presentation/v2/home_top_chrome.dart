import 'dart:ui';

import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/focusable_scale.dart';
import 'home_v2_tokens.dart';

/// Translucent top chrome that hardens as the feed scrolls.
///
/// The billboard runs edge-to-edge underneath, so at rest the bar is fully
/// transparent and the artwork reads as the top of the screen. Once content
/// starts passing behind it, a blurred tinted panel fades in to keep the
/// controls legible. This is the standard streaming pattern and it is the reason
/// the v1 opaque pinned `SliverAppBar` felt like a website header.
class HomeTopChrome extends StatelessWidget {
  const HomeTopChrome({
    required this.opacity,
    required this.metrics,
    required this.onSearch,
    required this.onProfile,
    this.onPortal,
    super.key,
  });

  /// 0 = fully transparent, 1 = fully tinted. Driven by scroll offset.
  final double opacity;
  final HomeV2Metrics metrics;
  final VoidCallback onSearch;
  final VoidCallback onProfile;
  final VoidCallback? onPortal;

  @override
  Widget build(BuildContext context) {
    final isTv = metrics.isTelevision;
    final barHeight = isTv ? 78.0 : 58.0;
    final clamped = opacity.clamp(0.0, 1.0);

    return ClipRect(
      child: BackdropFilter(
        // Blur scales with opacity so there is no blur at all over the
        // billboard, avoiding a visible seam at the bar's bottom edge.
        filter: ImageFilter.blur(
          sigmaX: 18 * clamped,
          sigmaY: 18 * clamped,
        ),
        child: Container(
          height: barHeight + MediaQuery.paddingOf(context).top,
          padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
          decoration: BoxDecoration(
            color: AppColors.abyss.withValues(alpha: 0.82 * clamped),
            border: Border(
              bottom: BorderSide(
                color: AppColors.starlight.withValues(alpha: 0.08 * clamped),
              ),
            ),
          ),
          child: Padding(
            padding: EdgeInsetsDirectional.only(
              start: metrics.pagePadding,
              end: metrics.pagePadding,
            ),
            child: Row(
              children: [
                Image.asset(
                  'assets/brand/majarra-logo.png',
                  height: isTv ? 44 : 32,
                  fit: BoxFit.contain,
                  semanticLabel: 'مجرة',
                  errorBuilder: (_, __, ___) => const Icon(
                    Icons.auto_awesome_rounded,
                    color: AppColors.starGold,
                  ),
                ),
                const Spacer(),
                if (onPortal != null) ...[
                  _ChromeAction(
                    icon: Icons.travel_explore_rounded,
                    label: 'بوابة مجرة',
                    isTv: isTv,
                    onPressed: onPortal!,
                  ),
                  SizedBox(width: isTv ? 14 : 8),
                ],
                _ChromeAction(
                  icon: Icons.search_rounded,
                  label: 'بحث',
                  isTv: isTv,
                  onPressed: onSearch,
                ),
                SizedBox(width: isTv ? 14 : 8),
                _ChromeAction(
                  icon: Icons.person_rounded,
                  label: 'ملفي',
                  isTv: isTv,
                  onPressed: onProfile,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChromeAction extends StatelessWidget {
  const _ChromeAction({
    required this.icon,
    required this.label,
    required this.isTv,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final bool isTv;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final size = isTv ? 46.0 : 36.0;

    return FocusableScale(
      onPressed: onPressed,
      semanticLabel: label,
      borderRadius: BorderRadius.circular(size),
      focusScale: 1.1,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.starlight.withValues(alpha: 0.1),
        ),
        child: Icon(icon, color: Colors.white, size: isTv ? 23 : 19),
      ),
    );
  }
}

/// Tracks scroll offset and exposes a 0..1 value for [HomeTopChrome].
///
/// Kept as a small [ValueNotifier] rather than page state so scrolling rebuilds
/// only the bar, not the whole feed.
class ChromeOpacityController extends ValueNotifier<double> {
  ChromeOpacityController() : super(0);

  /// Offset over which the bar reaches full tint.
  static const _travel = 190.0;

  void onScroll(double offset) {
    final next = (offset / _travel).clamp(0.0, 1.0);
    // Avoid a setState-per-pixel; 2% steps are imperceptible.
    if ((next - value).abs() > 0.02 || next == 0 || next == 1) {
      value = next;
    }
  }
}
