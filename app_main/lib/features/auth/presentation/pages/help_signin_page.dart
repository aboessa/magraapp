import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class HelpSignInPage extends StatelessWidget {
  const HelpSignInPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: AppBar(
        backgroundColor: AppColors.deepSpace,
        foregroundColor: Colors.white,
        title: const Text('مساعدة في تسجيل الدخول'),
      ),
      body: CinematicBackground(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _OptionCard(
              icon: Icons.mark_email_unread_rounded,
              title: 'لم يصلك رابط تأكيد البريد؟',
              subtitle: 'أدخل بريدك وسنرسل رابط تأكيد جديد',
              onTap: () => context.push('/verify-email'),
            ),
            const SizedBox(height: 12),
            _OptionCard(
              icon: Icons.lock_reset_rounded,
              title: 'نسيت كلمة المرور؟',
              subtitle: 'استعد حسابك عبر البريد',
              onTap: () => context.push('/forgot-password'),
            ),
            const SizedBox(height: 12),
            _OptionCard(
              icon: Icons.hourglass_top_rounded,
              title: 'لدي طلب حذف حساب',
              subtitle: 'عرض حالة طلب الحذف أو إلغاؤه',
              onTap: () => context.push('/deletion-status'),
            ),
            const SizedBox(height: 12),
            _OptionCard(
              icon: Icons.support_agent_rounded,
              title: 'تواصل مع الدعم',
              subtitle: 'تحتاج مساعدة إضافية؟',
              onTap: () => context.push('/support'),
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionCard extends StatelessWidget {
  const _OptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: const Color(0xFF111A3A).withValues(alpha: 0.8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: ListTile(
        leading: Icon(icon, color: AppColors.starGold),
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        subtitle: Text(subtitle, style: TextStyle(color: AppColors.mutedText)),
        trailing: const Icon(Icons.chevron_right_rounded, color: Colors.white54),
        onTap: onTap,
      ),
    );
  }
}
