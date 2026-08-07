import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class DevicesPage extends StatelessWidget {
  const DevicesPage({super.key});

  @override
  Widget build(BuildContext context) {
    final devices = [
      {'name': 'هذا الجهاز', 'type': 'Android • Chrome', 'active': true, 'icon': Icons.phone_android_rounded},
      {'name': 'تلفزيون العائلة', 'type': 'TV • 55 بوصة', 'active': true, 'icon': Icons.tv_rounded},
      {'name': 'تابلت', 'type': 'iPad • غير نشط منذ 3 أيام', 'active': false, 'icon': Icons.tablet_rounded},
    ];

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: const Text('إدارة الأجهزة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: AppColors.electricCyan.withValues(alpha: 0.18))),
                  child: Row(
                    children: [
                      Container(width: 44, height: 44, decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.devices_rounded, color: AppColors.electricCyan)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('3 من 4 أجهزة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)), Text('يمكنك إضافة جهاز آخر', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 11))])),
                      FilledButton(onPressed: () {}, style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace), child: const Text('إضافة')),
                    ],
                  ),
                ),
              ),
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final d = devices[index];
                final active = d['active'] as bool;
                return Padding(
                  padding: EdgeInsets.fromLTRB(18, index == 0 ? 8 : 0, 18, 10),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: active ? AppColors.success.withValues(alpha: 0.22) : Colors.white.withValues(alpha: 0.06))),
                    child: Row(
                      children: [
                        Container(width: 44, height: 44, decoration: BoxDecoration(color: active ? AppColors.success.withValues(alpha: 0.14) : Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)), child: Icon(d['icon'] as IconData, color: active ? AppColors.success : Colors.white, size: 22)),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(d['name'] as String, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)), Text(d['type'] as String, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11))])),
                        if (active) Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: AppColors.success.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(6)), child: const Text('نشط', style: TextStyle(color: AppColors.success, fontSize: 10, fontWeight: FontWeight.w800))),
                        const SizedBox(width: 8),
                        PopupMenuButton(itemBuilder: (_) => [const PopupMenuItem(child: Text('إزالة'))], icon: const Icon(Icons.more_vert_rounded, color: AppColors.mutedText, size: 18)),
                      ],
                    ),
                  ),
                );
              }, childCount: devices.length),
            ),
            SliverToBoxAdapter(child: Padding(padding: const EdgeInsets.all(18), child: Text('هذه قائمة عرض توضيحية. إدارة الأجهزة الحقيقية تُربط لاحقًا.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.58), fontSize: 11)))),
          ],
        ),
      ),
    );
  }
}
