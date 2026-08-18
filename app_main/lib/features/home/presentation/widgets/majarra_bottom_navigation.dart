import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../child/application/child_provider.dart';
import 'majarra_portal.dart';

/// Bottom Navigation - cinematic, orb floats centered on bar top edge (not clipped)
///
/// The profile tab used to be labelled with a literal personal name
/// (`'عبدالله'`), so every user of the app saw the same stranger's name on the
/// primary navigation bar. It now follows the active child, and falls back to a
/// generic label when no child is selected.
class MajarraBottomNavigation extends ConsumerWidget {
  const MajarraBottomNavigation({
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.onPortalPressed,
    super.key,
  });

  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onPortalPressed;

  /// Shown before a child profile is chosen. A generic word, never a name.
  @visibleForTesting
  static const String defaultProfileLabel = 'حسابي';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childName = ref.watch(childProvider).displayName?.trim();
    final profileLabel = childName == null || childName.isEmpty
        ? defaultProfileLabel
        : childName;
    const barHeight = 64.0;
    const orbSize = 68.0;
    const orbOverlap = 34.0;
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final totalHeight = barHeight + orbOverlap + bottomInset;

    return SizedBox(
      height: totalHeight,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.bottomCenter,
        children: [
          // Bar - blurred, with bottom inset
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: barHeight + bottomInset,
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
                child: Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF080C22).withValues(alpha: 0.96),
                    border: Border(
                      top: BorderSide(
                        color: Colors.white.withValues(alpha: 0.08),
                      ),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.55),
                        blurRadius: 28,
                        offset: const Offset(0, -4),
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: EdgeInsets.only(bottom: bottomInset),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: Row(
                        children: [
                          Expanded(
                            child: _NavItem(
                              selected: selectedIndex == 0,
                              label: 'الرئيسية',
                              icon: Icons.home_outlined,
                              activeIcon: Icons.home_rounded,
                              onTap: () => onDestinationSelected(0),
                            ),
                          ),
                          Expanded(
                            child: _NavItem(
                              selected: selectedIndex == 1,
                              label: 'استكشف',
                              icon: Icons.explore_outlined,
                              activeIcon: Icons.explore_rounded,
                              onTap: () => onDestinationSelected(1),
                            ),
                          ),
                          const SizedBox(width: 72),
                          Expanded(
                            child: _NavItem(
                              selected: selectedIndex == 2,
                              label: 'مكتبتي',
                              icon: Icons.bookmark_outline_rounded,
                              activeIcon: Icons.bookmarks_rounded,
                              onTap: () => onDestinationSelected(2),
                            ),
                          ),
                          Expanded(
                            child: _NavItem(
                              selected: selectedIndex == 3,
                              label: profileLabel,
                              icon: Icons.person_outline_rounded,
                              activeIcon: Icons.person_rounded,
                              isProfile: true,
                              onTap: () => onDestinationSelected(3),
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
          // Center galaxy orb - centered on bar's top edge
          Positioned(
            bottom: barHeight + bottomInset - orbSize / 2,
            child: MajarraPortalButton(
              size: orbSize,
              onPressed: onPortalPressed,
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.selected,
    required this.label,
    required this.icon,
    required this.activeIcon,
    required this.onTap,
    this.isProfile = false,
  });

  final bool selected;
  final String label;
  final IconData icon;
  final IconData activeIcon;
  final bool isProfile;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (isProfile)
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: selected
                      ? Colors.white.withValues(alpha: 0.12)
                      : Colors.transparent,
                  border: Border.all(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.22)
                        : Colors.white.withValues(alpha: 0.12),
                  ),
                ),
                child: Icon(
                  selected ? activeIcon : icon,
                  size: 14,
                  color: selected
                      ? Colors.white
                      : AppColors.mutedText.withValues(alpha: 0.7),
                ),
              )
            else
              Icon(
                selected ? activeIcon : icon,
                size: 22,
                color: selected
                    ? Colors.white
                    : AppColors.mutedText.withValues(alpha: 0.62),
              ),
            const SizedBox(height: 3),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  style: TextStyle(
                    color: selected
                        ? Colors.white
                        : AppColors.mutedText.withValues(alpha: 0.58),
                    fontSize: 10,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  ),
                ),
              ),
            ),
            if (selected) ...[
              const SizedBox(height: 2),
              Container(
                width: 3,
                height: 3,
                decoration: const BoxDecoration(
                  color: AppColors.electricCyan,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
