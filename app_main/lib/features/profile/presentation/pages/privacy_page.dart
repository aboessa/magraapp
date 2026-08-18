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
              leading: IconButton(
                icon: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                ),
                tooltip: 'رجوع',
                onPressed: () => context.pop(),
              ),
              title: const Text(
                'الخصوصية والبيانات',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.electricCyan.withValues(
                              alpha: 0.08,
                            ),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: AppColors.electricCyan.withValues(
                                alpha: 0.18,
                              ),
                            ),
                          ),
                          child: const Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.info_outline_rounded,
                                color: AppColors.electricCyan,
                              ),
                              SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'هذا ملخص للبيانات والضوابط التي ينفذها التطبيق الآن، وليس نصًا قانونيًا أو شروط استخدام معتمدة.',
                                  style: TextStyle(
                                    color: AppColors.starlight,
                                    fontSize: 12,
                                    height: 1.6,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        const _Section(
                          title: 'البيانات المرتبطة بالحساب',
                          points: [
                            'اسم عرض الأسرة عند توفره من خدمة الحساب.',
                            'ملفات الأطفال والتقدم والمسلسلات المحفوظة مرتبطة بالأسرة والطفل على الخادم.',
                            'بيانات الجلسة والأجهزة اللازمة لتسجيل الدخول وتشغيل المحتوى المحمي.',
                          ],
                        ),
                        const _Section(
                          title: 'العزل والتخزين داخل التطبيق',
                          points: [
                            'المسلسلات المحفوظة معزولة محليًا حسب حساب ولي الأمر والطفل، وتُزامن مع مفضلة الطفل.',
                            'قائمة التنزيلات وأوامر الحذف تعرض عناصر الطفل النشط فقط.',
                            'إعدادات التشغيل والتنزيل عامة لهذا التثبيت وليست ملفًا شخصيًا للطفل.',
                            'رسومات السحابة تبقى في مساحة الأسرة الخاصة ولا تظهر في فهرس المحتوى.',
                          ],
                        ),
                        const _Section(
                          title: 'ضوابط متاحة حاليًا',
                          points: [
                            'إضافة مسلسل إلى محفوظات الطفل أو إزالته.',
                            'حذف تنزيل منفرد أو جميع تنزيلات الطفل النشط.',
                            'حذف كل رسومات الأسرة المخزنة في السحابة وسحب موافقة حفظها.',
                            'تعديل اسم عرض الأسرة وتغيير كلمة المرور مع إغلاق الجلسات الأخرى.',
                            'تصدير بيانات الحساب والأسرة والأطفال بصيغة JSON قابلة للحفظ.',
                            'طلب حذف ملف طفل منفرد أو حساب الأسرة بالكامل مع حذف الرسومات الخاصة من التخزين.',
                            'تسجيل الخروج لمسح بيانات الجلسة والتنزيلات المحلية المرتبطة بالحساب.',
                          ],
                        ),
                        const _Section(
                          title: 'غير متاح للخدمة الذاتية حاليًا',
                          points: [
                            'تغيير البريد الإلكتروني قبل اكتمال مسار تحقق ونقل آمن للهوية.',
                            'ربط رقم هاتف دون مزود رسائل SMS للتحقق من الملكية.',
                            'إعداد مستقل لإيقاف أحداث القياس التقنية.',
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'آخر تحديث: أغسطس 2026',
                          style: TextStyle(
                            color: AppColors.mutedText.withValues(alpha: 0.55),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
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
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 10),
          for (final point in points)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    margin: const EdgeInsets.only(top: 6),
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.electricCyan,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      point,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.84),
                        fontSize: 12,
                        height: 1.55,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}
