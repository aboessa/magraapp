import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../search/presentation/search_page.dart';
import '../../../shorts/presentation/shorts_page.dart';
import '../../domain/content_models.dart';
import '../v2/home_v2_page.dart';
import 'home_feed.dart';

/// Index of each destination, referenced by the v2 home chrome so it can switch
/// tabs instead of pushing a route on top of the shell.
abstract final class HomeDestinationIndex {
  static const home = 0;
  static const shorts = 1;
  static const search = 2;
  static const profile = 3;
}

List<Widget> buildHomeDestinations({
  required HomeCatalog catalog,
  required bool isTelevision,
  String? selectedPlanetId,
  ValueChanged<String>? onOpenPlanet,
  bool useV2Home = true,
  ValueChanged<int>? onSelectDestination,
  VoidCallback? onOpenPortal,
}) {
  final defaultPlanetId = catalog.planets.isEmpty ? null : selectedPlanetId ?? catalog.planets.first.id;

  // The v1 feed is the default surface. The v2 cinematic home is kept reachable
  // via `/home-v2` so the two can be compared side by side on a real device.
  final Widget homeSurface = useV2Home
      ? HomeV2Page(
          catalog: catalog,
          isTelevision: isTelevision,
          onOpenSearch: () =>
              onSelectDestination?.call(HomeDestinationIndex.search),
          onOpenProfile: () =>
              onSelectDestination?.call(HomeDestinationIndex.profile),
          onOpenPortal: onOpenPortal,
        )
      : HomeFeed(catalog: catalog, isTelevision: isTelevision, onOpenPlanets: defaultPlanetId == null ? null : () => onOpenPlanet?.call(defaultPlanetId), onOpenPlanet: onOpenPlanet);

  return [
    homeSurface,
    ShortsPage(catalog: catalog, isTelevision: isTelevision),
    SearchPage(catalog: catalog, isTelevision: isTelevision),
    _ProfileDestination(catalog: catalog, isTelevision: isTelevision),
  ];
}

// The "مكتبتي" destination was removed rather than wired up.
//
// It was a complete but unreachable screen whose three tabs each depended on
// data the app cannot produce: continue-watching drew progress from
// `0.68 - index * 0.15`, and downloads badged every catalog episode as
// "تم التنزيل" unconditionally. Its one honest tab, the watchlist, is now a
// real feature at `/watchlist` backed by `WatchlistStore`.
//
// Reinstating a library tab is a Phase 1 decision that depends on progress
// sync and the download feature actually existing.

class _ProfileDestination extends StatelessWidget {
  const _ProfileDestination({required this.catalog, required this.isTelevision});
  final HomeCatalog catalog;
  final bool isTelevision;
  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding;
    // Cinematic backdrop: colourful banner + planet as decoration
    final bannerAsset = 'assets/images/series/banners/hekaya-wa-hikma-banner.webp';
    return CinematicBackground(
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Stack(
              children: [
                SizedBox(
                  height: isTelevision ? 390 : 340,
                  width: double.infinity,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // لون أساسي غامق
                      Container(color: const Color(0xFF050817)),
                      // صورة كبيرة واضحة - هيكايا (ألوان غنية)
                      Opacity(
                        opacity: 0.72,
                        child: Image.asset(bannerAsset, fit: BoxFit.cover, alignment: const Alignment(0, -0.2), errorBuilder: (_, __, ___) => Image.asset('assets/images/planets/planet-science.webp', fit: BoxFit.cover, errorBuilder: (_, __, ___) => const SizedBox.shrink())),
                      ),
                      // Blur خفيف يحافظ على التفاصيل
                      ClipRect(child: BackdropFilter(filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14), child: Container(color: const Color(0xFF06091A).withValues(alpha: 0.32)))),
                      // Scrim يحمي النص
                      DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF06091A).withValues(alpha: 0.18), Color(0xFF06091A).withValues(alpha: 0.58), Color(0xFF06091A)], stops: [0, 0.45, 1]))),
                      // توهج كوني
                      DecoratedBox(decoration: BoxDecoration(gradient: RadialGradient(center: Alignment(0.8, -0.2), radius: 1.1, colors: [Color(0xFF6A3DF2).withValues(alpha: 0.22), Colors.transparent]))),
                    ],
                  ),
                ),
                SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: EdgeInsetsDirectional.fromSTEB(padding, 18, padding, 18),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(color: const Color(0xFF101735).withValues(alpha: 0.88), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: 0.08))),
                          child: Column(
                            children: [
                              Row(children: [const Text('👋', style: TextStyle(fontSize: 18)), const SizedBox(width: 6), Text('أهلاً بك في مجرة', style: TextStyle(color: Colors.white, fontSize: isTelevision ? 20 : 17, fontWeight: FontWeight.w800))]),
                              const SizedBox(height: 8),
                              Text('كواكب تعليمية، حكايات، وأنشطة لكل عمر من 3 إلى 12 سنة', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.82), fontSize: 11, height: 1.5)),
                              const SizedBox(height: 12),
                              Container(padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10), decoration: BoxDecoration(borderRadius: BorderRadius.circular(99), border: Border.all(color: AppColors.starGold.withValues(alpha: 0.9)), color: AppColors.starGold.withValues(alpha: 0.12)), child: Text('تعرّف على العضويات', textAlign: TextAlign.center, style: TextStyle(color: AppColors.starGold, fontSize: 12.5, fontWeight: FontWeight.w800))),
                              const SizedBox(height: 6),
                              Text('اختر باقتك من صفحة العضويات', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 10)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                children: [
                                  // Placeholder avatar: no child profile is
                                  // loaded from the API yet, so a series poster
                                  // must not stand in for a real child.
                                  Container(width: 72, height: 72, decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.indigoSurface, border: Border.all(color: Colors.white.withValues(alpha: 0.18), width: 2)), child: const Icon(Icons.person_rounded, color: Colors.white, size: 30)),
                                  const SizedBox(height: 8),
                                  Text('ملف الطفل', style: TextStyle(color: Colors.white.withValues(alpha: 0.92), fontSize: 11, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ),
                  Expanded(
                    child: InkWell(
                      onTap: () => context.push('/children'),
                      borderRadius: BorderRadius.circular(16),
                      child: Column(
                        children: [
                          Container(width: 72, height: 72, decoration: BoxDecoration(shape: BoxShape.circle, color: const Color(0xFF1B2550).withValues(alpha: 0.72), border: Border.all(color: Colors.white.withValues(alpha: 0.10))), child: const Icon(Icons.person_add_alt_1_rounded, color: Colors.white, size: 28)),
                          const SizedBox(height: 8),
                          Text('إضافة', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                  ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 14, padding, 0),
              child: OutlinedButton.icon(
                onPressed: () => context.push('/parent-pin'),
                icon: const Icon(Icons.lock_outline_rounded, size: 16, color: Colors.white),
                label: const Text('منطقة ولي الأمر - PIN / بصمة', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                style: OutlinedButton.styleFrom(backgroundColor: const Color(0xFF111A3A).withValues(alpha: 0.72), side: BorderSide(color: Colors.white.withValues(alpha: 0.12)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 28, padding, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('ملفي الشخصي', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 14),
                  Stack(
                    children: [
                      Positioned.fill(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: RadialGradient(center: const Alignment(0, 0), radius: 1.1, colors: [const Color(0xFF1B2550).withValues(alpha: 0.22), Colors.transparent]),
                          ),
                        ),
                      ),
                  Row(
                    children: [
                      Expanded(child: _ProfileQuickCard(icon: Icons.card_giftcard_rounded, label: 'العضويات', onTap: () => context.push('/membership'))),
                      const SizedBox(width: 10),
                      Expanded(child: _ProfileQuickCard(icon: Icons.grid_view_rounded, label: 'قائمتي', onTap: () => context.push('/watchlist'))),
                      const SizedBox(width: 10),
                      Expanded(child: _ProfileQuickCard(icon: Icons.download_rounded, label: 'التحميلات', onTap: () => context.push('/downloads'))),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      // The child's own space. Sits beside the family shelves
                      // rather than inside them, because what a child made is not
                      // catalogue content they saved.
                      Expanded(child: _ProfileQuickCard(icon: Icons.brush_rounded, label: 'مجموعتي', onTap: () => context.push('/my-collection'))),
                    ],
                  ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 28, padding, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('إعدادات الحساب', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 14),
                  _ProfileSettingTile(icon: Icons.person_outline_rounded, label: 'بيانات الحساب', onTap: () => context.push('/account')),
                  const SizedBox(height: 10),
                  _ProfileSettingTile(icon: Icons.devices_other_rounded, label: 'إدارة الاجهزة', onTap: () => context.push('/devices')),
                  const SizedBox(height: 10),
                  _ProfileSettingTile(icon: Icons.settings_outlined, label: 'الإعدادات', onTap: () => context.push('/settings')),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 28, padding, 18),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _FooterLink(label: 'الدعم الفني', onTap: () => context.push('/support')),
                  _FooterLink(label: 'سياسة الخصوصية', onTap: () => context.push('/privacy')),
                  _FooterLink(label: 'الشروط والأحكام', onTap: () => context.push('/privacy')),
                ],
              ),
            ),
          ),
          SliverToBoxAdapter(child: SizedBox(height: isTelevision ? 32 : 98)),
        ],
      ),
    );
  }
}

class _ProfileQuickCard extends StatelessWidget {
  const _ProfileQuickCard({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF111A3A).withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 88,
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.07))),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(icon, color: Colors.white, size: 26), const SizedBox(height: 8), Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))]),
        ),
      ),
    );
  }
}

class _ProfileSettingTile extends StatelessWidget {
  const _ProfileSettingTile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF111A3A).withValues(alpha: 0.88),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          height: 56,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
          child: Row(children: [Icon(icon, color: Colors.white, size: 22), const SizedBox(width: 12), Expanded(child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w600))), const Icon(Icons.chevron_left_rounded, color: Colors.white, size: 20)]),
        ),
      ),
    );
  }
}

class _FooterLink extends StatelessWidget {
  const _FooterLink({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6), child: Text(label, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.58), fontSize: 11, fontWeight: FontWeight.w500))),
    );
  }
}
