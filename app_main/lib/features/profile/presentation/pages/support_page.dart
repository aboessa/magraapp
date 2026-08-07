import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class SupportPage extends StatelessWidget {
  const SupportPage({super.key});

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
              title: const Text('الدعم الفني', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [const Color(0xFF6A3DF2), const Color(0xFF1B2550)]),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      child: Column(
                        children: [
                          Container(width: 56, height: 56, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.12)), child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 28)),
                          const SizedBox(height: 14),
                          const Text('كيف نساعدك؟', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text('فريق مجرة جاهز للإجابة خلال 24 ساعة', style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 12)),
                          const SizedBox(height: 16),
                          SizedBox(width: double.infinity, height: 44, child: FilledButton.icon(onPressed: () {}, style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.deepSpace), icon: const Icon(Icons.chat_rounded, size: 18), label: const Text('تواصل معنا'))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _SupportTile(icon: Icons.help_outline_rounded, title: 'الأسئلة الشائعة', subtitle: 'إجابات سريعة', onTap: () {}),
                    const SizedBox(height: 10),
                    _SupportTile(icon: Icons.bug_report_outlined, title: 'الإبلاغ عن مشكلة', subtitle: 'أخبرنا بما حدث', onTap: () {}),
                    const SizedBox(height: 10),
                    _SupportTile(icon: Icons.lightbulb_outline_rounded, title: 'اقتراح ميزة', subtitle: 'شاركنا فكرتك', onTap: () {}),
                    const SizedBox(height: 10),
                    _SupportTile(icon: Icons.phone_outlined, title: 'اتصل بنا', subtitle: 'رقم الدعم يُعلن قريباً', onTap: () {}),
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

class _SupportTile extends StatelessWidget {
  const _SupportTile({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xFF111A3A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(border: Border.all(color: Colors.white.withValues(alpha: 0.06)), borderRadius: BorderRadius.circular(14)),
            child: Row(children: [Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: Colors.white, size: 20)), const SizedBox(width: 12), Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)), Text(subtitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11))])), const Icon(Icons.chevron_left_rounded, color: AppColors.mutedText)]),
          ),
        ),
      );
}
