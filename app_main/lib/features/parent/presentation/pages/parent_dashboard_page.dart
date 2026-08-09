import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../child/application/child_provider.dart';
import '../../../home/domain/content_models.dart';

/// Parent area.
///
/// Rewritten from a fully hardcoded screen. The previous version imported no
/// providers at all and displayed invented figures — `'3 أطفال'`, `'42%'`,
/// `'32 دقيقة اليوم'`, and `LinearProgressIndicator(value: 0.6)` repeated for
/// every child — which told a parent things about their child that the app had
/// no way of knowing.
///
/// This version shows only what the app can actually observe today:
///   * the profile the user selected in the chooser (`childProvider`)
///   * the library that profile can reach (`filteredCatalogProvider`)
///
/// Watch time and per-title progress require `POST /api/v1/family/progress`
/// reads, which are not wired yet, so those sections state that plainly instead
/// of rendering a plausible number.
class ParentDashboardPage extends ConsumerWidget {
  const ParentDashboardPage({super.key});

  // Light surface tokens, kept local: the parent area is deliberately a light
  // "admin" surface, distinct from the child-facing cinematic theme.
  static const _pageBg = Color(0xFFF5F7FC);
  static const _cardBg = Colors.white;
  static const _cardBorder = Color(0xFFDCE3F0);
  static const _tileBg = Color(0xFFF8FAFD);
  static const _tileBorder = Color(0xFFEDF1F9);
  static const _ink = Color(0xFF10162F);
  static const _inkSoft = Color(0xFF546078);
  static const _inkFaint = Color(0xFF7B879D);
  static const _brand = Color(0xFF2856D8);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(childProvider);
    final filtered = ref.watch(filteredCatalogProvider);

    return Scaffold(
      backgroundColor: _pageBg,
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1026),
        foregroundColor: Colors.white,
        title: const Text(
          'منطقة ولي الأمر',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward_rounded),
          tooltip: 'رجوع',
          onPressed: () => context.pop(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          _ActiveProfileCard(
            child: child,
            onSwitch: () => context.push('/children'),
          ),
          const SizedBox(height: 14),
          _LibraryScopeCard(
            child: child,
            catalog: filtered.valueOrNull,
            loading: filtered.isLoading,
          ),
          const SizedBox(height: 14),
          const _PendingSection(
            icon: Icons.timer_outlined,
            title: 'وقت المشاهدة',
            body:
                'يحتاج وقت المشاهدة إلى مزامنة التقدّم من الخادم. لم تُربط بعد، '
                'فلا نعرض أرقامًا تقديرية هنا.',
          ),
          const SizedBox(height: 14),
          const _PendingSection(
            icon: Icons.insights_outlined,
            title: 'تقارير التقدّم',
            body:
                'سيظهر تقدّم كل طفل في كل سلسلة بعد ربط مزامنة التقدّم لكل '
                'child_id.',
          ),
          const SizedBox(height: 14),
          const _PendingSection(
            icon: Icons.tune_rounded,
            title: 'السماحات وحدود الوقت',
            body:
                'التحكم في الكواكب المسموحة وحدود وقت الشاشة يُحفظ على مستوى '
                'الأسرة في الخادم. الأزرار ستُفعّل عند إتاحة الحفظ.',
          ),
          const SizedBox(height: 18),
          Text(
            'كل طفل معزول حسب child_id — لا تُدمج أعمار مختلفة في درجة واحدة.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _inkFaint.withValues(alpha: 0.9), fontSize: 11),
          ),
        ],
      ),
    );
  }
}

/// The profile currently selected in the chooser.
class _ActiveProfileCard extends StatelessWidget {
  const _ActiveProfileCard({required this.child, required this.onSwitch});

  final ChildState child;
  final VoidCallback onSwitch;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.family_restroom_rounded,
                color: ParentDashboardPage._brand,
              ),
              const SizedBox(width: 8),
              const Text(
                'الملف النشط',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: ParentDashboardPage._ink,
                ),
              ),
              const Spacer(),
              TextButton(
                onPressed: onSwitch,
                child: const Text('تبديل'),
              ),
            ],
          ),
          const Divider(height: 18),
          if (!child.hasSelection)
            const _InlineEmpty(
              text: 'لم يُختر ملف طفل بعد. اختر ملفًا لعرض نطاق مكتبته.',
            )
          else
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: ParentDashboardPage._brand.withValues(alpha: 0.12),
                  ),
                  child: const Icon(
                    Icons.person_rounded,
                    color: ParentDashboardPage._brand,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        child.displayName ?? 'ملف طفل',
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                          color: ParentDashboardPage._ink,
                        ),
                      ),
                      Text(
                        child.trackLabel,
                        style: const TextStyle(
                          color: ParentDashboardPage._inkSoft,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          const SizedBox(height: 10),
          const Text(
            'ملفات العائلة تُقرأ حاليًا من قائمة تجريبية على الجهاز، وليست من '
            'الخادم.',
            style: TextStyle(
              color: ParentDashboardPage._inkFaint,
              fontSize: 10.5,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

/// What the active profile's age track actually filters the library down to.
///
/// This is real, derived information: `filteredCatalogProvider` performs the
/// age-track filtering, so these counts describe genuine app behaviour.
class _LibraryScopeCard extends StatelessWidget {
  const _LibraryScopeCard({
    required this.child,
    required this.catalog,
    required this.loading,
  });

  final ChildState child;
  final HomeCatalog? catalog;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.filter_alt_outlined, color: ParentDashboardPage._brand),
              SizedBox(width: 8),
              Text(
                'نطاق المكتبة لهذا الملف',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: ParentDashboardPage._ink,
                ),
              ),
            ],
          ),
          const Divider(height: 18),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (catalog == null)
            const _InlineEmpty(text: 'تعذّر تحميل المكتبة.')
          else ...[
            Row(
              children: [
                _CountTile(
                  label: 'سلاسل متاحة',
                  value: '${catalog!.series.length}',
                ),
                const SizedBox(width: 10),
                _CountTile(
                  label: 'حلقات',
                  value: '${catalog!.episodes.length}',
                ),
                const SizedBox(width: 10),
                _CountTile(
                  label: 'أنشطة',
                  value: '${catalog!.experiences.length}',
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              child.hasSelection
                  ? 'هذه الأرقام بعد تطبيق فلتر العمر الخاص بالملف النشط.'
                  : 'هذه أرقام المكتبة الكاملة، بدون فلتر عمر.',
              style: const TextStyle(
                color: ParentDashboardPage._inkFaint,
                fontSize: 10.5,
                height: 1.6,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _CountTile extends StatelessWidget {
  const _CountTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          decoration: BoxDecoration(
            color: ParentDashboardPage._tileBg,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: ParentDashboardPage._tileBorder),
          ),
          child: Column(
            children: [
              Text(
                value,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 20,
                  color: ParentDashboardPage._ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: ParentDashboardPage._inkSoft,
                  fontSize: 10.5,
                ),
              ),
            ],
          ),
        ),
      );
}

/// A section whose data depends on a backend capability that is not wired yet.
///
/// Rendered as an explicit, labelled pending state rather than as a chart filled
/// with placeholder values.
class _PendingSection extends StatelessWidget {
  const _PendingSection({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: ParentDashboardPage._inkSoft, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: ParentDashboardPage._ink,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3D6),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: const Text(
                  'قيد الربط',
                  style: TextStyle(
                    color: Color(0xFF8A6300),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            body,
            style: const TextStyle(
              color: ParentDashboardPage._inkSoft,
              fontSize: 11.5,
              height: 1.75,
            ),
          ),
        ],
      ),
    );
  }
}

class _InlineEmpty extends StatelessWidget {
  const _InlineEmpty({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: ParentDashboardPage._tileBg,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ParentDashboardPage._tileBorder),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: ParentDashboardPage._inkSoft,
            fontSize: 11.5,
            height: 1.6,
          ),
        ),
      );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: ParentDashboardPage._cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: ParentDashboardPage._cardBorder),
        ),
        child: child,
      );
}
