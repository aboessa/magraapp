import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../child/application/child_provider.dart';
import '../../../home/domain/content_models.dart';
import '../../application/parent_reports.dart';

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
          if (child.activeChildId == null || !child.hasSelection)
            const _PendingSection(
              icon: Icons.insights_outlined,
              title: 'التقارير',
              body: 'اختر ملف طفل لعرض نشاطه وتقدّمه في التعلّم.',
              pending: false,
            )
          else
            _ActivityReports(childId: child.activeChildId!),
          const SizedBox(height: 14),
          const _PendingSection(
            icon: Icons.tune_rounded,
            title: 'حدود الوقت والسماحات',
            body:
                'حدود وقت الشاشة ونافذة النوم تُفرَض على مستوى الأسرة في الخادم '
                'لتسري على كل الأجهزة. ستُفعَّل عند إتاحة الحفظ والفرض في الخادم.',
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
            'الملفات تُقرأ من حساب الأسرة على الخادم، وتقاريرها معزولة لكل طفل.',
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
    this.pending = true,
  });

  final IconData icon;
  final String title;
  final String body;

  /// When true, shows the amber "قيد الربط" chip. Set false for a neutral
  /// informational card (e.g. "choose a profile") that is not blocked on a
  /// backend capability.
  final bool pending;

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
              if (pending)
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


/// Real activity for the selected child, aggregated from the family endpoints
/// (`/family/progress`, `/mastery`, `/rewards`). Every number here is derived
/// from server rows; nothing is invented.
class _ActivityReports extends ConsumerWidget {
  const _ActivityReports({required this.childId});

  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(childActivitySummaryProvider(childId));
    final catalog = ref.watch(filteredCatalogProvider).valueOrNull;

    return summary.when(
      loading: () => const _Card(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (_, __) => _Card(
        child: Row(
          children: [
            const Icon(Icons.cloud_off_rounded, color: ParentDashboardPage._inkSoft),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'تعذّر تحميل التقارير. تحقّق من الاتصال وحاول مجددًا.',
                style: TextStyle(color: ParentDashboardPage._inkSoft, fontSize: 12),
              ),
            ),
            TextButton(
              onPressed: () => ref.invalidate(childActivitySummaryProvider(childId)),
              child: const Text('إعادة'),
            ),
          ],
        ),
      ),
      data: (data) {
        if (data.isEmpty) {
          return const _PendingSection(
            icon: Icons.insights_outlined,
            title: 'النشاط والتعلّم',
            body:
                'لم يبدأ هذا الملف أي مشاهدة أو نشاط بعد. ستظهر هنا ملخّصات '
                'المشاهدة والتقدّم فور بدء الاستخدام.',
            pending: false,
          );
        }
        return Column(
          children: [
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionHeader(Icons.insights_outlined, 'ملخّص النشاط'),
                  const Divider(height: 18),
                  Row(
                    children: [
                      _CountTile(label: 'قيد المتابعة', value: '${data.inProgress.length}'),
                      const SizedBox(width: 10),
                      _CountTile(label: 'أكملها', value: '${data.completed.length}'),
                      const SizedBox(width: 10),
                      _CountTile(label: 'أوسمة', value: '${data.rewardsCount}'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            if (data.recent.isNotEmpty)
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader(Icons.history_rounded, 'أحدث النشاط'),
                    const Divider(height: 18),
                    for (final entry in data.recent)
                      _ProgressRow(
                        title: resolveContentTitle(catalog, entry),
                        entry: entry,
                      ),
                  ],
                ),
              ),
            if (data.mastery.isNotEmpty) ...[
              const SizedBox(height: 14),
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader(Icons.school_outlined, 'التعلّم والإتقان'),
                    const Divider(height: 18),
                    for (final m in data.mastery.take(8)) _MasteryRow(entry: m),
                  ],
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  Widget _sectionHeader(IconData icon, String title) => Row(
        children: [
          Icon(icon, color: ParentDashboardPage._brand, size: 20),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              color: ParentDashboardPage._ink,
            ),
          ),
        ],
      );
}

class _ProgressRow extends StatelessWidget {
  const _ProgressRow({required this.title, required this.entry});

  final String title;
  final ProgressEntry entry;

  IconData get _icon => switch (entry.contentType) {
        'episode' => Icons.play_circle_outline_rounded,
        'book' => Icons.menu_book_outlined,
        'game' => Icons.videogame_asset_outlined,
        _ => Icons.play_circle_outline_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(_icon, size: 18, color: ParentDashboardPage._inkSoft),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 12.5,
                    color: ParentDashboardPage._ink,
                  ),
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: entry.fraction,
                    minHeight: 4,
                    backgroundColor: const Color(0xFFE7ECF6),
                    valueColor: const AlwaysStoppedAnimation(ParentDashboardPage._brand),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            entry.completed ? 'اكتمل' : '${(entry.fraction * 100).round()}%',
            style: const TextStyle(
              color: ParentDashboardPage._inkSoft,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _MasteryRow extends StatelessWidget {
  const _MasteryRow({required this.entry});

  final MasteryEntry entry;

  String get _levelLabel => switch (entry.level) {
        'mastered' => 'متقَن',
        'practicing' => 'قيد التمرّن',
        'introduced' => 'مُقدَّم',
        _ => entry.level.isEmpty ? 'قيد التمرّن' : entry.level,
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.stars_rounded, size: 18, color: ParentDashboardPage._brand),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              entry.objectiveId,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 12.5,
                color: ParentDashboardPage._ink,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFEAF0FF),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              _levelLabel,
              style: const TextStyle(
                color: ParentDashboardPage._brand,
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          if (entry.attempts > 0) ...[
            const SizedBox(width: 8),
            Text(
              '${(entry.accuracy * 100).round()}%',
              style: const TextStyle(
                color: ParentDashboardPage._inkSoft,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
