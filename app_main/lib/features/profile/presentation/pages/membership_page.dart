import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class MembershipPage extends StatelessWidget {
  const MembershipPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: const Text('العضويات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Current plan card - premium
                    Container(
                      padding: const EdgeInsets.all(22),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [const Color(0xFF6A3DF2), const Color(0xFF1B2550), const Color(0xFF0B1026)],
                        ),
                        border: Border.all(color: AppColors.starGold.withValues(alpha: 0.22), width: 1.2),
                        boxShadow: [BoxShadow(color: AppColors.cosmicPurple.withValues(alpha: 0.22), blurRadius: 24)],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // This card previously asserted an ACTIVE subscription
                          // with a concrete price and renewal date, none of which
                          // came from the billing API. Advertising a price the
                          // app cannot honour is a consumer-protection risk, so
                          // the card now states that billing is not connected.
                          Row(
                            children: [
                              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: AppColors.mutedText.withValues(alpha: 0.22), borderRadius: BorderRadius.circular(8)), child: const Text('غير مربوط', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800))),
                              const Spacer(),
                              const Icon(Icons.workspace_premium_rounded, color: AppColors.starGold, size: 28),
                            ],
                          ),
                          const SizedBox(height: 16),
                          const Text('العضويات', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          Text('لم تُربط خدمة الاشتراكات بعد، فلا يمكن عرض باقتك الحالية أو سعرها.', style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 12)),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Text('—', style: TextStyle(color: AppColors.starGold, fontSize: 20, fontWeight: FontWeight.w800)),
                              const Spacer(),
                              Text('الأسعار تُعرض عند الربط', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Planned plan features. Labelled as planned so they do not
                    // read as entitlements the account already has.
                    _PlanFeature(icon: Icons.download_rounded, title: 'تحميل دون اتصال', subtitle: 'مخطط — غير متاح بعد'),
                    const SizedBox(height: 10),
                    _PlanFeature(icon: Icons.family_restroom_rounded, title: 'ملفات متعددة للأطفال', subtitle: 'كل طفل له كوكبه ومساره'),
                    const SizedBox(height: 10),
                    _PlanFeature(icon: Icons.block_rounded, title: 'بدون إعلانات', subtitle: 'تجربة آمنة 100%'),
                    const SizedBox(height: 22),
                    // Disabled rather than silently inert: neither action can do
                    // anything until Google Play Billing is wired up.
                    SizedBox(height: 52, child: FilledButton(onPressed: null, style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))), child: const Text('إدارة الاشتراك — قريباً', style: TextStyle(fontWeight: FontWeight.w800)))),
                    const SizedBox(height: 10),
                    SizedBox(height: 48, child: OutlinedButton(onPressed: null, style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: BorderSide(color: Colors.white.withValues(alpha: 0.12)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))), child: const Text('عرض كل الباقات — قريباً'))),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanFeature extends StatelessWidget {
  const _PlanFeature({required this.icon, required this.title, required this.subtitle});
  final IconData icon;
  final String title;
  final String subtitle;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
      child: Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.cosmicPurple.withValues(alpha: 0.18), border: Border.all(color: Colors.white.withValues(alpha: 0.07))), child: Icon(icon, color: Colors.white, size: 20)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)), Text(subtitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 11))]))]),
    );
  }
}
