import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';

class SupportPage extends StatelessWidget {
  const SupportPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
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
                tooltip: l10n.back,
                onPressed: () => context.pop(),
              ),
              title: Text(
                l10n.supportTitle,
                style: const TextStyle(
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
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [Color(0xFF6A3DF2), Color(0xFF1B2550)],
                            ),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                          ),
                          child: Column(
                            children: [
                              Container(
                                width: 56,
                                height: 56,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white.withValues(alpha: 0.12),
                                ),
                                child: const Icon(
                                  Icons.support_agent_rounded,
                                  color: Colors.white,
                                  size: 28,
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                l10n.supportHeadline,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'لا توجد قناة دعم للمستهلك أو مدة استجابة منشورة داخل التطبيق حاليًا.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.76),
                                  fontSize: 12,
                                  height: 1.6,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        const _UnavailableSupportNotice(),
                        const SizedBox(height: 12),
                        _LicenseTile(
                          title: l10n.licensesTitle,
                          subtitle: l10n.licensesSubtitle,
                          onTap: () => showLicensePage(
                            context: context,
                            applicationName: l10n.appTitle,
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

class _UnavailableSupportNotice extends StatelessWidget {
  const _UnavailableSupportNotice();

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'خدمات الدعم غير المتاحة حاليًا',
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.62),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'غير متاح حاليًا',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          for (final item in const [
            'الأسئلة الشائعة',
            'الإبلاغ عن مشكلة',
            'اقتراح محتوى',
            'الهاتف أو المحادثة',
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(
                children: [
                  Icon(
                    Icons.remove_circle_outline,
                    color: AppColors.mutedText.withValues(alpha: 0.55),
                    size: 17,
                  ),
                  const SizedBox(width: 9),
                  Text(
                    item,
                    style: TextStyle(
                      color: AppColors.mutedText.withValues(alpha: 0.76),
                      fontSize: 12,
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

class _LicenseTile extends StatelessWidget {
  const _LicenseTile({
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    child: Material(
      color: const Color(0xFF111A3A).withValues(alpha: 0.82),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Icon(Icons.description_outlined, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.68),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_left_rounded,
                color: AppColors.mutedText,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
