import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class AccountDataPage extends StatelessWidget {
  const AccountDataPage({super.key});

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
              title: const Text('بيانات الحساب', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Stack(
                        children: [
                          // A series poster previously stood in for the account
                          // avatar. No avatar is loaded from the API yet.
                          Container(
                            width: 92,
                            height: 92,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.indigoSurface, border: Border.all(color: Colors.white.withValues(alpha: 0.14), width: 2)),
                            child: const Icon(Icons.person_rounded, color: Colors.white, size: 40),
                          ),
                          PositionedDirectional(
                            bottom: 0,
                            end: 0,
                            child: Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.starGold, border: Border.all(color: AppColors.deepSpace, width: 2)),
                              child: const Icon(Icons.edit_rounded, size: 14, color: AppColors.deepSpace),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Center(child: Text('—', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800))),
                    Center(child: Text('لم تُربط بيانات الحساب بعد', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12))),
                    const SizedBox(height: 24),
                    _Field(label: 'الاسم', value: '—', icon: Icons.person_outline_rounded),
                    const SizedBox(height: 12),
                    _Field(label: 'البريد الإلكتروني', value: '—', icon: Icons.mail_outline_rounded),
                    const SizedBox(height: 12),
                    _Field(label: 'رقم الهاتف', value: '+20 1———', icon: Icons.phone_outlined, trailing: TextButton(onPressed: () {}, child: const Text('إضافة'))),
                    const SizedBox(height: 12),
                    _Field(label: 'كلمة المرور', value: '••••••••', icon: Icons.lock_outline_rounded, trailing: TextButton(onPressed: () {}, child: const Text('تغيير'))),
                    const SizedBox(height: 20),
                    SizedBox(height: 48, child: FilledButton(onPressed: () {}, style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.deepSpace), child: const Text('حفظ التغييرات'))),
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

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value, required this.icon, this.trailing});
  final String label;
  final String value;
  final IconData icon;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
      child: Row(
        children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: Colors.white, size: 18)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 10)), Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600))]),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
