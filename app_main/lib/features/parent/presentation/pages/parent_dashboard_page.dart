import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/diagnostics/ignored_errors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../child/application/child_provider.dart';
import '../../../child/presentation/pages/age_transition_review_page.dart';
import '../../../child/application/family_children_provider.dart';
import '../../../child/domain/child_profile.dart';
import '../../../child/presentation/widgets/child_avatars.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/domain/content_models.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../application/child_controls_controller.dart';
import '../../application/parent_reports.dart';

/// Parent area – production cinematic style matching the rest of the app.
///
/// Previous version was a light "admin" surface (white cards on #F5F7FC) which
/// broke the app's dark cinematic identity. This rewrite uses the same tokens
/// as MembershipPage, ChildSwitcher and Login:
///   • deepSpace background + CinematicBackground
///   • cardSurface 0xFF101835 with white 0.06 border
///   • starGold / electricCyan accents
///   • No invented numbers – only real data from providers.
class ParentDashboardPage extends ConsumerWidget {
  const ParentDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(childProvider);
    final childrenAsync = ref.watch(familyChildrenProvider);
    final filtered = ref.watch(filteredCatalogProvider);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.92),
              foregroundColor: Colors.white,
              leading: IconButton(
                icon: const Icon(Icons.arrow_forward_rounded),
                tooltip: 'رجوع',
                onPressed: () {
                  if (context.canPop()) {
                    context.pop();
                  } else {
                    context.go('/');
                  }
                },
              ),
              title: const Text('منطقة ولي الأمر',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
              centerTitle: true,
              actions: [
                IconButton(
                  icon: const Icon(Icons.settings_outlined, size: 20),
                  tooltip: 'الإعدادات',
                  onPressed: () => context.push('/settings'),
                )
              ],
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Quick family actions – fixes "ناقصة كتير" feedback
                    const _FamilyQuickActions(),
                    const SizedBox(height: 14),

                    _ActiveProfileCard(child: child, onSwitch: () => context.push('/children')),
                    const SizedBox(height: 14),

                    // Children management – CRUD list
                    childrenAsync.when(
                      loading: () => const _DarkCard(
                        child: SizedBox(
                          height: 56,
                          child: Center(
                            child: CircularProgressIndicator(color: AppColors.starGold, strokeWidth: 2),
                          ),
                        ),
                      ),
                      error: (_, __) => const _EmptyDarkCard(
                        icon: Icons.cloud_off_rounded,
                        title: 'تعذّر تحميل ملفات الأطفال',
                        body: 'تحقق من الاتصال ثم حاول مرة أخرى.',
                      ),
                      data: (list) => _ChildrenManagementCard(
                        children: list,
                        activeId: child.activeChildId,
                        onSelect: (p) {
                          ref.read(childProvider.notifier).selectChild(
                                childId: p.id,
                                ageTrack: p.ageTrack,
                                displayName: p.displayName,
                              );
                          context.go('/');
                        },
                      ),
                    ),
                    const SizedBox(height: 14),

                    _LibraryScopeCard(child: child, catalog: filtered.valueOrNull, loading: filtered.isLoading),
                    const SizedBox(height: 14),

                    if (child.activeChildId == null || !child.hasSelection)
                      _NoChildSelectedCTA(onSelect: () => context.push('/children'))
                    else ...[
                      _ActivityReports(childId: child.activeChildId!),
                      const SizedBox(height: 14),
                      ParentalControlsSection(childId: child.activeChildId!),
                    ],

                    const SizedBox(height: 28),
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

// ── Dark card primitive (matches app) ──
class _DarkCard extends StatelessWidget {
  // بلا `padding` قابل للتمرير: لم يُمرَّر من أي موضع، وكل الاستدعاءات تعتمد
  // الحشو الافتراضي أدناه. خيار غير مستخدَم في primitive مشترك يوهم بتنوّع لا وجود له.
  const _DarkCard({required this.child});
  final Widget child;
  final EdgeInsetsGeometry? padding = null;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.28), blurRadius: 18, offset: const Offset(0, 8))],
      ),
      child: child,
    );
  }
}

// ── Active profile ──
class _ActiveProfileCard extends StatelessWidget {
  const _ActiveProfileCard({required this.child, required this.onSwitch});
  final ChildState child;
  final VoidCallback onSwitch;

  @override
  Widget build(BuildContext context) {
    return _DarkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(
                  color: AppColors.electricCyan.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.family_restroom_rounded, color: AppColors.electricCyan, size: 18),
              ),
              const SizedBox(width: 10),
              const Expanded(child: Text('الملف النشط', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13))),
              TextButton(
                onPressed: onSwitch,
                style: TextButton.styleFrom(foregroundColor: AppColors.starGold, padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4)),
                child: const Text('تبديل', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              ),
            ],
          ),
          const Divider(height: 18, color: Colors.white12),
          if (!child.hasSelection)
            const Text('لم يُختر ملف طفل بعد.', style: TextStyle(color: AppColors.mutedText, fontSize: 11))
          else
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(colors: [AppColors.electricCyan.withValues(alpha: 0.9), AppColors.cosmicPurple.withValues(alpha: 0.9)]),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
                  ),
                  child: const Icon(Icons.person_rounded, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(child.displayName ?? 'ملف طفل', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.white)),
                      const SizedBox(height: 2),
                      Text(child.trackLabel, style: const TextStyle(color: AppColors.mutedText, fontSize: 11)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: AppColors.starGold.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)),
                  child: Text(child.trackLabel, style: const TextStyle(color: AppColors.starGold, fontSize: 9, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

// ── Library scope ──
class _LibraryScopeCard extends StatelessWidget {
  const _LibraryScopeCard({required this.child, required this.catalog, required this.loading});
  final ChildState child;
  final HomeCatalog? catalog;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return _DarkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32, height: 32,
                decoration: BoxDecoration(color: AppColors.royalBlue.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)),
                child: const Icon(Icons.auto_awesome_rounded, color: AppColors.royalBlue, size: 18),
              ),
              const SizedBox(width: 10),
              const Text('نطاق المكتبة لهذا الملف', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
            ],
          ),
          const Divider(height: 18, color: Colors.white12),
          if (loading)
            const Padding(padding: EdgeInsets.symmetric(vertical: 14), child: Center(child: CircularProgressIndicator(color: AppColors.starGold)))
          else if (catalog == null)
            const Text('تعذّر تحميل المكتبة.', style: TextStyle(color: AppColors.mutedText, fontSize: 11))
          else
            Row(
              children: [
                _CountTile(label: 'سلاسل متاحة', value: '${catalog!.series.length}'),
                const SizedBox(width: 10),
                _CountTile(label: 'حلقات', value: '${catalog!.episodes.length}'),
                const SizedBox(width: 10),
                _CountTile(label: 'أنشطة', value: '${catalog!.experiences.length}'),
              ],
            ),
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
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF0B112A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Column(
            children: [
              Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Colors.white)),
              const SizedBox(height: 4),
              Text(label, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.mutedText, fontSize: 10)),
            ],
          ),
        ),
      );
}

// ── Empty dark ──
class _EmptyDarkCard extends StatelessWidget {
  const _EmptyDarkCard({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return _DarkCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.mutedText, size: 18),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
            ],
          ),
          const SizedBox(height: 10),
          Text(body, style: const TextStyle(color: AppColors.mutedText, fontSize: 11, height: 1.6)),
        ],
      ),
    );
  }
}

// ── Activity reports – dark ──
class _ActivityReports extends ConsumerWidget {
  const _ActivityReports({required this.childId});
  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(childActivitySummaryProvider(childId));
    final catalog = ref.watch(filteredCatalogProvider).valueOrNull;

    return summary.when(
      loading: () => const _DarkCard(child: Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Center(child: CircularProgressIndicator(color: AppColors.starGold)))),
      error: (_, __) => _DarkCard(
        child: Row(children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.mutedText),
          const SizedBox(width: 10),
          const Expanded(child: Text('تعذّر تحميل التقارير.', style: TextStyle(color: AppColors.mutedText, fontSize: 12))),
          TextButton(onPressed: () => ref.invalidate(childActivitySummaryProvider(childId)), child: const Text('إعادة', style: TextStyle(color: AppColors.starGold))),
        ]),
      ),
      data: (data) {
        if (data.isEmpty) {
          return const _EmptyDarkCard(icon: Icons.insights_rounded, title: 'النشاط والتعلّم', body: 'لم يبدأ هذا الملف أي نشاط بعد.');
        }
        return Column(
          children: [
            _DarkCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _sectionHeader(Icons.insights_rounded, 'ملخّص النشاط'),
                  const Divider(height: 18, color: Colors.white12),
                  Row(children: [
                    _CountTile(label: 'قيد المتابعة', value: '${data.inProgress.length}'),
                    const SizedBox(width: 10),
                    _CountTile(label: 'أكملها', value: '${data.completed.length}'),
                    const SizedBox(width: 10),
                    _CountTile(label: 'أوسمة', value: '${data.rewardsCount}'),
                  ]),
                ],
              ),
            ),
            if (data.recent.isNotEmpty) ...[
              const SizedBox(height: 14),
              _DarkCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader(Icons.history_rounded, 'أحدث النشاط'),
                    const Divider(height: 18, color: Colors.white12),
                    for (final entry in data.recent) _ProgressRow(title: resolveContentTitle(catalog, entry), entry: entry),
                  ],
                ),
              ),
            ],
            if (data.mastery.isNotEmpty) ...[
              const SizedBox(height: 14),
              _DarkCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader(Icons.school_rounded, 'التعلّم والإتقان'),
                    const Divider(height: 18, color: Colors.white12),
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

  Widget _sectionHeader(IconData icon, String title) => Row(children: [
        Icon(icon, color: AppColors.starGold, size: 18),
        const SizedBox(width: 8),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
      ]);
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
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Icon(_icon, size: 18, color: AppColors.mutedText),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Colors.white)),
                const SizedBox(height: 5),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: entry.fraction,
                    minHeight: 4,
                    backgroundColor: Colors.white.withValues(alpha: 0.08),
                    valueColor: const AlwaysStoppedAnimation(AppColors.starGold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(entry.completed ? 'اكتمل' : '${(entry.fraction * 100).round()}%', style: const TextStyle(color: AppColors.mutedText, fontSize: 11, fontWeight: FontWeight.w700)),
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
          const Icon(Icons.stars_rounded, size: 18, color: AppColors.starGold),
          const SizedBox(width: 10),
          Expanded(child: Text(entry.objectiveId, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5, color: Colors.white))),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(6)),
            child: Text(_levelLabel, style: const TextStyle(color: AppColors.electricCyan, fontSize: 10, fontWeight: FontWeight.w700)),
          ),
          if (entry.attempts > 0) ...[
            const SizedBox(width: 8),
            Text('${(entry.accuracy * 100).round()}%', style: const TextStyle(color: AppColors.mutedText, fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ],
      ),
    );
  }
}

/// Basic parental controls (daily screen-time, bedtime window, speed change
/// permission, autoplay override) for one child.
///
/// Made public (was `_ParentalControlsSection`, private to this file) so
/// `OnboardingFlowPage`'s basic-controls step (Requirement 8.2) hosts the
/// exact same controls surface a parent sees later in the dashboard,
/// instead of a second, divergent minimal widget — one control surface, one
/// implementation, consistent with Component 10's "no duplicated logic"
/// direction in `design.md`.
class ParentalControlsSection extends ConsumerStatefulWidget {
  const ParentalControlsSection({required this.childId, super.key});
  final String childId;
  @override
  ConsumerState<ParentalControlsSection> createState() => _ParentalControlsSectionState();
}

class _ParentalControlsSectionState extends ConsumerState<ParentalControlsSection> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final settingsAsync = ref.watch(childSettingsProvider(widget.childId));
    // `APP-102`: علَم الحفظ ونتيجة الكتابة صارا في المتحكّم، لا في حالة العنصر.
    // كانت ستّ كتابات لضوابط رقابية بلا `catch`، فيفشل الطلب ويبقى وليّ الأمر
    // يظنّ الضبط ساريًا.
    final controls = ref.watch(childControlsControllerProvider(widget.childId));
    final controller = ref.read(childControlsControllerProvider(widget.childId).notifier);
    return settingsAsync.when(
      loading: () => const _DarkCard(child: Center(child: CircularProgressIndicator(color: AppColors.starGold))),
      error: (e, _) => _DarkCard(
        child: Text(
          // نصّ الاستثناء لا يُعرَض على وليّ أمر: قد يكون جسم ردّ خادم أو
          // `SocketException`.
          'تعذر تحميل الإعدادات: ${AppFailure.fromException(e).message}',
          style: const TextStyle(color: AppColors.mutedText),
        ),
      ),
      data: (data) {
        // `null` = لم يفعّل وليّ الأمر حدًّا يوميًّا (قرار المالك، `DECIDE-108`).
        // وكان هنا `?? 30`: يعرض حدًّا لم يُضبَط، فيقرأ وليّ الأمر «الحدّ مفعَّل
        // على 30» وهو غير مفعَّل — أو كان مفعَّلًا لأن الخادم كان يفرضه بالفعل
        // ولا يملك إلغاءه.
        final daily = (data['daily_minutes'] as num?)?.toInt();
        final bedStart = data['bedtime_start'] as String?;
        final bedEnd = data['bedtime_end'] as String?;
        final allowSpeed = (data['allow_speed_change'] as num?)?.toInt() == 1;
        final autoplay = data['autoplay_override'] as String? ?? 'inherit';
        return _DarkCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(width: 32, height: 32, decoration: BoxDecoration(color: AppColors.cosmicPurple.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.tune_rounded, color: AppColors.cosmicPurple, size: 18)),
              const SizedBox(width: 10),
              const Text('حدود الوقت والسماحات', style: TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
            ]),
            const Divider(height: 18, color: Colors.white12),
            // التفعيل مفتاحٌ صريح، والشريط يظهر بعده. والنصّ يقول الحالة صراحةً
            // بدل أن يعرض رقمًا يُقرأ حدًّا ساريًا وهو ليس كذلك.
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(l10n.parentDailyLimitTitle, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.white, fontSize: 12)),
              subtitle: Text(
                daily == null ? l10n.parentDailyLimitOff : l10n.parentDailyLimitOn(daily),
                style: const TextStyle(fontSize: 11, color: AppColors.mutedText),
              ),
              value: daily != null,
              activeThumbColor: AppColors.starGold,
              // القيمة الابتدائية عند التفعيل 30 دقيقة، وهي **اختيار وليّ الأمر**
              // لحظة تحويله المفتاح لا افتراضًا صامتًا يُطبَّق عليه — وذاك الفرق
              // هو `DECIDE-108` كلّه. وله بعدها الشريط.
              onChanged: (on) => on
                  ? controller.setDailyMinutes(30)
                  : controller.clearDailyLimit(),
            ),
            if (daily != null)
              Slider(
                value: daily.clamp(5, 180).toDouble(), min: 5, max: 180, divisions: 35, label: '$daily',
                activeColor: AppColors.starGold, inactiveColor: Colors.white12,
                onChanged: (v) => controller.setDailyMinutes(v.round()),
              ),
            if (controls.saving) const LinearProgressIndicator(minHeight: 2, color: AppColors.starGold, backgroundColor: Colors.white12),
            // فشلُ كتابة ضابطٍ رقابي **يُقال**. وهو ما لم يكن يحدث: خمس كتابات
            // بلا `catch` وواحدة بـ`finally` وحده.
            if (controls.failure != null)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  const Icon(Icons.error_outline_rounded, size: 14, color: Colors.redAccent),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'لم يُحفَظ: ${controls.failure}',
                      style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                  ),
                  TextButton(
                    onPressed: controller.acknowledgeFailure,
                    child: const Text('حسنًا', style: TextStyle(fontSize: 11)),
                  ),
                ]),
              ),
            const SizedBox(height: 10),
            Text('نافذة النوم: ${bedStart ?? '--:--'} – ${bedEnd ?? '--:--'}', style: const TextStyle(fontSize: 11, color: AppColors.mutedText)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              children: [
                OutlinedButton(onPressed: () async { final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 21, minute: 0)); if (t != null) await controller.setBedtimeStart(_hhmm(t)); }, style: OutlinedButton.styleFrom(foregroundColor: Colors.white70, side: BorderSide(color: Colors.white.withValues(alpha: 0.12))), child: const Text('بداية', style: TextStyle(fontSize: 11))),
                OutlinedButton(onPressed: () async { final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 7, minute: 0)); if (t != null) await controller.setBedtimeEnd(_hhmm(t)); }, style: OutlinedButton.styleFrom(foregroundColor: Colors.white70, side: BorderSide(color: Colors.white.withValues(alpha: 0.12))), child: const Text('نهاية', style: TextStyle(fontSize: 11))),
                OutlinedButton(onPressed: controller.clearBedtime, style: OutlinedButton.styleFrom(foregroundColor: Colors.white70, side: BorderSide(color: Colors.white.withValues(alpha: 0.12))), child: const Text('مسح', style: TextStyle(fontSize: 11))),
              ],
            ),
            const Divider(height: 18, color: Colors.white12),
            SwitchListTile(
              title: const Text('السماح بتغيير السرعة', style: TextStyle(fontSize: 12, color: Colors.white)),
              value: allowSpeed,
              activeThumbColor: AppColors.starGold,
              onChanged: controller.setAllowSpeedChange,
            ),
            const SizedBox(height: 4),
            DropdownButtonFormField<String>(
              initialValue: ['off','on','inherit'].contains(autoplay) ? autoplay : 'inherit',
              dropdownColor: const Color(0xFF111A3A),
              style: const TextStyle(color: Colors.white, fontSize: 12),
              decoration: InputDecoration(labelText: 'التشغيل التلقائي', labelStyle: const TextStyle(color: AppColors.mutedText), border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12))), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)))),
              items: const [DropdownMenuItem(value: 'inherit', child: Text('افتراضي حسب العمر')), DropdownMenuItem(value: 'off', child: Text('إيقاف')), DropdownMenuItem(value: 'on', child: Text('تشغيل'))],
              onChanged: (v) { if (v != null) controller.setAutoplayOverride(v); },
            ),
          ]),
        );
      },
    );
  }

  /// `HH:mm` — الصيغة التي يقرأها الخادم.
  static String _hhmm(TimeOfDay time) =>
      '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
}

// ── NEW: Quick family actions ──
class _FamilyQuickActions extends StatelessWidget {
  const _FamilyQuickActions();
  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10, runSpacing: 10,
      children: [
        _QuickAction(icon: Icons.lock_outline_rounded, label: 'PIN و الأمان', onTap: () => context.push('/parent-pin')),
        _QuickAction(icon: Icons.devices_rounded, label: 'الأجهزة', onTap: () => context.push('/devices')),
        _QuickAction(icon: Icons.workspace_premium_outlined, label: 'العضوية', onTap: () => context.push('/membership')),
        _QuickAction(icon: Icons.person_outline_rounded, label: 'حسابي', onTap: () => context.push('/account')),
        _QuickAction(icon: Icons.support_agent_outlined, label: 'الدعم', onTap: () => context.push('/support')),
      ],
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.onTap});
  final IconData icon; final String label; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap, borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF111A3A).withValues(alpha: 0.78),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 16, color: AppColors.mutedText),
          const SizedBox(width: 7),
          Text(label, style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w700)),
        ]),
      ),
    );
  }
}

class _NoChildSelectedCTA extends StatelessWidget {
  const _NoChildSelectedCTA({required this.onSelect});
  final VoidCallback onSelect;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Column(children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.starGold.withValues(alpha: 0.14),
            border: Border.all(color: AppColors.starGold.withValues(alpha: 0.22))),
          child: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.starGold, size: 26),
        ),
        const SizedBox(height: 14),
        const Text('اختر ملف طفل للمتابعة', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 14)),
        const SizedBox(height: 6),
        const Text('منطقة ولي الأمر تحتاج ملف نشط لعرض التقارير وحدود الوقت.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.mutedText, fontSize: 11.5, height: 1.5)),
        const SizedBox(height: 16),
        FilledButton.icon(
          onPressed: onSelect,
          icon: const Icon(Icons.family_restroom_rounded, size: 18),
          label: const Text('من يشاهد الآن؟', style: TextStyle(fontWeight: FontWeight.w800)),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12)),
        ),
      ]),
    );
  }
}

class _ChildrenManagementCard extends ConsumerWidget {
  const _ChildrenManagementCard({required this.children, required this.activeId, required this.onSelect});
  final List<ChildProfile> children;
  final String? activeId;
  final void Function(ChildProfile) onSelect;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 32, height: 32,
            decoration: BoxDecoration(color: AppColors.royalBlue.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(8)),
            child: const Icon(Icons.child_care_rounded, color: AppColors.royalBlue, size: 18)),
          const SizedBox(width: 10),
          Text('ملفات الأطفال (${children.length}/4)', style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
          const Spacer(),
          IconButton(
            tooltip: 'إضافة طفل',
            icon: const Icon(Icons.person_add_rounded, size: 18, color: AppColors.starGold),
            onPressed: children.length >= 4 ? null : () => context.push('/children')),
        ]),
        const Divider(height: 16, color: Colors.white12),
        if (children.isEmpty)
          const Text('لا يوجد أطفال بعد.', style: TextStyle(color: AppColors.mutedText, fontSize: 11))
        else
          ...children.map((c) {
            final isActive = c.id == activeId;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: InkWell(
                onTap: () => onSelect(c),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: isActive ? AppColors.starGold.withValues(alpha: 0.10) : const Color(0xFF0B112A),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isActive ? AppColors.starGold.withValues(alpha: 0.28) : Colors.white.withValues(alpha: 0.06))),
                  child: Row(children: [
                    ChildAvatarView(avatarId: c.avatarId, size: 42, showBorder: false, showShadow: false),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(c.displayName, style: TextStyle(fontWeight: isActive ? FontWeight.w800 : FontWeight.w600, color: Colors.white, fontSize: 12.5)),
                      const SizedBox(height: 2),
                      Text('${c.trackLabel} • ${c.birthMonth}/${c.birthYear}', style: const TextStyle(color: AppColors.mutedText, fontSize: 10.5)),
                    ])),
                    if (isActive)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(color: AppColors.starGold.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(6)),
                        child: const Text('نشط', style: TextStyle(color: AppColors.starGold, fontSize: 9, fontWeight: FontWeight.w800))),
                    const SizedBox(width: 6),
                    _ChildTrackTransitionBadge(childId: c.id),
                    const SizedBox(width: 6),
                    PopupMenuButton<String>(
                      icon: const Icon(Icons.more_horiz_rounded, size: 16, color: AppColors.mutedText),
                      color: const Color(0xFF111A3A),
                      onSelected: (v) async {
                        if (v == 'delete') {
                          final ok = await showDialog<bool>(
                            context: context,
                            builder: (_) => AlertDialog(
                              backgroundColor: const Color(0xFF111A3A),
                              title: const Text('حذف ملف الطفل؟', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                              content: Text('سيتم حذف "${c.displayName}" ونشاطه. لا يمكن التراجع.', style: const TextStyle(color: AppColors.mutedText)),
                              actions: [
                                TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
                                FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.redAccent), onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
                              ],
                            ));
                          if (ok == true) {
                            try {
                              // `APP-102`: مفتاح التكرار يُولَّد في المستودع، فلا
                              // يُنسى في نداء جديد.
                              await ref
                                  .read(childControlsRepositoryProvider)
                                  .deleteChild(c.id);
                              ref.invalidate(familyChildrenProvider);
                              if (isActive) ref.read(childProvider.notifier).clear();
                            } catch (error, stack) {
                              // كان `'فشل الحذف: $e'` — نصّ استثناء خام يُعرَض على
                              // وليّ أمر: جسم ردّ خادم، أو `SocketException`، أو
                              // مسار ملف. والرسالة الآن من `AppFailure`، والخطأ
                              // مُسجَّل بدل أن يُستهلَك في نصّ عابر.
                              reportIgnoredError('parent_dashboard.delete_child', error, stack);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'فشل الحذف: ${AppFailure.fromException(error).message}',
                                    ),
                                  ),
                                );
                              }
                            }
                          }
                        }
                      },
                      itemBuilder: (_) => [
                        const PopupMenuItem(value: 'delete', child: Row(children: [Icon(Icons.delete_outline_rounded, size: 16, color: Colors.redAccent), SizedBox(width: 8), Text('حذف', style: TextStyle(color: Colors.white, fontSize: 12))])),
                      ],
                    ),
                  ]),
                ),
              ),
            );
          }),
      ]),
    );
  }
}

/// Small entry point into `AgeTransitionReviewPage`, shown only when the
/// server's `review` action reports this child's computed age track differs
/// from the one currently stored (Requirement 12.4's "opened from the
/// parent dashboard ... when computed_track != stored_track" reading of the
/// design's Component 12).
///
/// Deliberately does not show a loading spinner or an error state inline —
/// this is a secondary affordance next to a row that already has its own
/// primary content, so a failed or pending `review` check silently renders
/// nothing rather than competing for attention with the row itself. The
/// full comparison (including any load failure) is always available by
/// opening `AgeTransitionReviewPage` directly if the badge does not appear.
class _ChildTrackTransitionBadge extends ConsumerWidget {
  const _ChildTrackTransitionBadge({required this.childId});
  final String childId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final review = ref.watch(childTrackTransitionReviewProvider(childId));
    final changed = review.valueOrNull?['data'] is Map &&
        (review.valueOrNull!['data'] as Map)['changed'] == true;
    if (!changed) return const SizedBox.shrink();
    return IconButton(
      tooltip: 'مراجعة الانتقال العمري',
      icon: const Icon(Icons.trending_up_rounded, size: 18, color: AppColors.electricCyan),
      onPressed: () => Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => AgeTransitionReviewPage(childId: childId),
        ),
      ),
    );
  }
}
