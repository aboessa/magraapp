import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class PrivacyPage extends StatelessWidget {
  const PrivacyPage({super.key});

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
              title: const Text('سياسة الخصوصية', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.electricCyan.withValues(alpha: 0.18))),
                      child: Row(children: [const Icon(Icons.shield_rounded, color: AppColors.electricCyan), const SizedBox(width: 10), Expanded(child: Text('خصوصية طفلك أولوية. لا إعلانات، لا تتبع إعلاني، وبيانات الأطفال معزولة حسب child_id.', style: TextStyle(color: AppColors.starlight.withValues(alpha: 0.9), fontSize: 12, height: 1.5)))]),
                    ),
                    const SizedBox(height: 16),
                    _Section(title: 'ما نجمعه', points: ['اسم العرض للملف (بدون لقب حقيقي)', 'التقدم والمفضلة والتنزيلات حسب child_id', 'أحداث تقنية مجهولة (نوع الجهاز، الأخطاء) بدون PII']),
                    _Section(title: 'ما لا نجمعه', points: ['نص بحث الأطفال الخام', 'موقع دقيق', 'معرف إعلاني', 'محتوى دردشة (لا يوجد دردشة)']),
                    _Section(title: 'التخزين', points: ['بيانات كل أسرة معزولة عن غيرها', 'كتالوج المحتوى للقراءة فقط', 'الأرشيف مخزَّن في تخزين خاص', 'الإعدادات العامة فقط في تخزين مشترك']),
                    _Section(title: 'حقوقك', points: ['حذف بيانات طفل منفردة', 'تصدير التقدم', 'إيقاف التحليلات']),
                    const SizedBox(height: 16),
                    Text('آخر تحديث: أغسطس 2026', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.5), fontSize: 11)),
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

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.points});
  final String title;
  final List<String> points;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
              const SizedBox(height: 10),
              ...points.map((p) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Container(width: 6, height: 6, margin: const EdgeInsets.only(top: 6), decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.electricCyan)), const SizedBox(width: 8), Expanded(child: Text(p, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.82), fontSize: 12, height: 1.5)))]),
                  )),
            ],
          ),
        ),
      );
}
