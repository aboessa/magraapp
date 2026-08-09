import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import '../../application/child_provider.dart';
import '../widgets/child_avatars.dart';

/// A child profile on the family account.
class ChildProfile {
  const ChildProfile({
    required this.id,
    required this.nickname,
    required this.ageTrack,
    required this.birthMonth,
    required this.birthYear,
    this.avatarId = '',
  });

  factory ChildProfile.fromJson(Map<String, Object?> json) {
    String text(String key) {
      final value = json[key];
      return value is String ? value.trim() : '';
    }

    int number(String key) {
      final value = json[key];
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) return int.tryParse(value) ?? 0;
      return 0;
    }

    return ChildProfile(
      id: text('id'),
      nickname: text('nickname'),
      // The Durable Object derives and stores the track; the client never
      // asserts one. See FamilyState.ts:456.
      ageTrack: text('age_track'),
      birthMonth: number('birth_month'),
      birthYear: number('birth_year'),
      avatarId: text('avatar_id'),
    );
  }

  final String id;
  final String nickname;
  final String ageTrack;
  final int birthMonth;
  final int birthYear;
  final String avatarId;

  String get displayName => nickname.isEmpty ? 'ملف طفل' : nickname;

  /// Age in whole years, derived from the stored birth date.
  ///
  /// Computed rather than stored so it does not go stale, and returns null when
  /// the birth date is missing instead of showing a wrong number.
  int? get ageYears {
    if (birthYear <= 0 || birthMonth <= 0) return null;
    final now = DateTime.now();
    var years = now.year - birthYear;
    if (now.month < birthMonth) years -= 1;
    return years < 0 ? null : years;
  }

  String get ageLabel {
    final years = ageYears;
    return years == null ? trackLabel : '$years سنوات';
  }

  String get trackLabel => switch (ageTrack) {
    'preschool' => 'براعم',
    'kids' => 'مستكشفون',
    'junior' => 'روّاد',
    _ => 'غير محدد',
  };

  bool get isPreschool => ageTrack == 'preschool';

  Color get color => switch (ageTrack) {
    'preschool' => const Color(0xFFFF6FAE),
    'kids' => const Color(0xFF00D6F5),
    'junior' => const Color(0xFF6A3DF2),
    _ => AppColors.mutedText,
  };

  IconData get icon => switch (ageTrack) {
    'preschool' => Icons.child_care_rounded,
    'kids' => Icons.face_rounded,
    'junior' => Icons.school_rounded,
    _ => Icons.person_rounded,
  };
}

/// Child profiles on the signed-in family account.
///
/// `GET /api/v1/family/children` was already implemented on the server but had no
/// caller, while this page rendered a hardcoded `ليلى/عمر/سارة` array. The list is
/// now real; an unauthenticated visit surfaces a sign-in prompt rather than fake
/// profiles.
final familyChildrenProvider = FutureProvider<List<ChildProfile>>((ref) async {
  final api = ref.watch(majarraApiClientProvider);
  final rows = await api.fetchChildren();
  return rows
      .map(ChildProfile.fromJson)
      .where((child) => child.id.isNotEmpty)
      .toList(growable: false);
});

class ChildSwitcherPage extends ConsumerWidget {
  const ChildSwitcherPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(familyChildrenProvider);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 12),
                const Text(
                  'من يشاهد الآن؟',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'يعرض كل ملف مكتبة مناسبة لعمره',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.72),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 24),
                Expanded(
                  child: children.when(
                    loading: () => const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.starGold,
                      ),
                    ),
                    error: (_, __) => _ChildNotice(
                      icon: Icons.lock_outline_rounded,
                      title: 'يتطلب تسجيل الدخول',
                      body:
                          'ملفات الأطفال مرتبطة بحساب الأسرة. سجّل الدخول لعرض '
                          'الملفات أو إنشاء ملف جديد.',
                      actionLabel: 'تسجيل الدخول',
                      onAction: () => context.push('/login'),
                    ),
                    data: (items) {
                      if (items.isEmpty) {
                        return _ChildNotice(
                          icon: Icons.person_add_alt_1_rounded,
                          title: 'لا توجد ملفات أطفال',
                          body:
                              'أنشئ ملفًا لكل طفل حتى تُخصّص المكتبة والتقارير '
                              'حسب عمره.',
                          actionLabel: 'إنشاء ملف طفل',
                          onAction: () => _openCreateSheet(context, ref),
                        );
                      }
                      return _ChildGrid(
                        children: items,
                        onSelect: (child) {
                          ref.read(childProvider.notifier).selectChild(
                            childId: child.id,
                            ageTrack: child.ageTrack,
                            displayName: child.displayName,
                          );
                          context.go('/');
                        },
                        onAdd: () => _openCreateSheet(context, ref),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () => context.push('/parent-pin'),
                  icon: const Icon(Icons.lock_outline_rounded, size: 18),
                  label: const Text('منطقة ولي الأمر'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.12),
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openCreateSheet(BuildContext context, WidgetRef ref) async {
    final created = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0B1026),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _CreateChildSheet(),
    );
    if (created == true) ref.invalidate(familyChildrenProvider);
  }
}

class _ChildGrid extends StatelessWidget {
  const _ChildGrid({
    required this.children,
    required this.onSelect,
    required this.onAdd,
  });

  final List<ChildProfile> children;
  final ValueChanged<ChildProfile> onSelect;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) => GridView.builder(
    // Extent-based so a tablet shows more than the phone's two columns
    // instead of stretching each card.
    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
      maxCrossAxisExtent: 220,
      childAspectRatio: 0.88,
      crossAxisSpacing: 14,
      mainAxisSpacing: 14,
    ),
    itemCount: children.length + 1,
    itemBuilder: (context, index) {
      if (index == children.length) return _AddChildCard(onTap: onAdd);
      final child = children[index];
      return _ChildCard(
        profile: child,
        // First profile receives focus so a remote has an entry point on
        // this full-screen chooser.
        autofocus: index == 0,
        onTap: () => onSelect(child),
      );
    },
  );
}

/// Create-profile form.
///
/// Collects only what the server needs: nickname plus birth month and year. The
/// age track is intentionally absent because `FamilyState` derives it and
/// rejects an age outside 3–12.
class _CreateChildSheet extends ConsumerStatefulWidget {
  const _CreateChildSheet();

  @override
  ConsumerState<_CreateChildSheet> createState() => _CreateChildSheetState();
}

class _CreateChildSheetState extends ConsumerState<_CreateChildSheet> {
  final _nickname = TextEditingController();
  int _birthMonth = DateTime.now().month;
  late int _birthYear = DateTime.now().year - 6;
  bool _submitting = false;
  String? _error;

  /// Avatar identifier stored on the family record. Chosen from the fixed
  /// [ChildAvatars] catalogue via the picker below.
  String _avatarId = ChildAvatars.all.first.id;

  @override
  void dispose() {
    _nickname.dispose();
    super.dispose();
  }

  /// Years that keep the child inside the 3–12 range the server enforces.
  List<int> get _selectableYears {
    final now = DateTime.now().year;
    return [for (var age = 3; age <= 12; age++) now - age];
  }

  Future<void> _submit() async {
    final nickname = _nickname.text.trim();
    if (nickname.isEmpty) {
      setState(() => _error = 'اكتب اسمًا للملف.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await ref.read(majarraApiClientProvider).createChild(
        nickname: nickname,
        birthMonth: _birthMonth,
        birthYear: _birthYear,
        avatarId: _avatarId,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        // The server rejects on plan limit, age range, and session validity.
        // The specific reason is not exposed, so the copy stays general rather
        // than guessing which rule fired.
        _error = 'تعذّر إنشاء الملف. تحقّق من تسجيل الدخول وحدّ الباقة.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        18,
        20,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 38,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.18),
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            'ملف طفل جديد',
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'يُحدَّد المسار العمري تلقائيًا من تاريخ الميلاد',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.72),
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 18),
          TextField(
            controller: _nickname,
            enabled: !_submitting,
            maxLength: 40,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              labelText: 'الاسم أو اللقب',
              counterText: '',
              labelStyle: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.72),
              ),
              filled: true,
              fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _Dropdown<int>(
                  label: 'شهر الميلاد',
                  value: _birthMonth,
                  items: [for (var m = 1; m <= 12; m++) m],
                  labelBuilder: (m) => '$m',
                  onChanged: _submitting
                      ? null
                      : (value) => setState(() => _birthMonth = value),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _Dropdown<int>(
                  label: 'سنة الميلاد',
                  value: _birthYear,
                  items: _selectableYears,
                  labelBuilder: (y) => '$y',
                  onChanged: _submitting
                      ? null
                      : (value) => setState(() => _birthYear = value),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'الصورة الرمزية',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.72),
              fontSize: 11.5,
            ),
          ),
          const SizedBox(height: 10),
          ChildAvatarPicker(
            selectedId: _avatarId,
            enabled: !_submitting,
            onSelected: (id) => setState(() => _avatarId = id),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.danger, fontSize: 11.5),
            ),
          ],
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.starGold,
              foregroundColor: AppColors.deepSpace,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text(
                    'إنشاء الملف',
                    style: TextStyle(fontWeight: FontWeight.w800),
                  ),
          ),
        ],
      ),
    );
  }
}

class _Dropdown<T> extends StatelessWidget {
  const _Dropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.labelBuilder,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<T> items;
  final String Function(T) labelBuilder;
  final ValueChanged<T>? onChanged;

  @override
  Widget build(BuildContext context) => InputDecorator(
    decoration: InputDecoration(
      labelText: label,
      labelStyle: TextStyle(
        color: AppColors.mutedText.withValues(alpha: 0.72),
        fontSize: 12,
      ),
      filled: true,
      fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 12,
        vertical: 10,
      ),
    ),
    child: DropdownButtonHideUnderline(
      child: DropdownButton<T>(
        value: value,
        isDense: true,
        isExpanded: true,
        dropdownColor: const Color(0xFF111A3A),
        style: const TextStyle(color: Colors.white, fontSize: 13),
        items: [
          for (final item in items)
            DropdownMenuItem(value: item, child: Text(labelBuilder(item))),
        ],
        onChanged: onChanged == null
            ? null
            : (selected) {
                if (selected != null) onChanged!(selected);
              },
      ),
    ),
  );
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({
    required this.profile,
    required this.onTap,
    this.autofocus = false,
  });

  final ChildProfile profile;
  final VoidCallback onTap;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final isLarge = profile.isPreschool;
    final color = profile.color;
    final radius = BorderRadius.circular(isLarge ? 22 : 18);

    return Material(
      color: const Color(0xFF111A3A).withValues(alpha: 0.82),
      borderRadius: radius,
      child: InkWell(
        onTap: onTap,
        autofocus: autofocus,
        borderRadius: radius,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: radius,
            border: Border.all(color: color.withValues(alpha: 0.22)),
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.12),
                blurRadius: 16,
              ),
            ],
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              ChildAvatarView(
                avatarId: profile.avatarId,
                size: isLarge ? 64 : 56,
              ),
              const Spacer(),
              Text(
                profile.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: isLarge ? 16 : 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                profile.ageLabel,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.62),
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  profile.trackLabel,
                  style: TextStyle(
                    color: color,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddChildCard extends StatelessWidget {
  const _AddChildCard({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
          color: Colors.white.withValues(alpha: 0.04),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.14),
                ),
              ),
              child: const Icon(
                Icons.add_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              'إضافة طفل',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
            Text(
              '3–12 سنة',
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.62),
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _ChildNotice extends StatelessWidget {
  const _ChildNotice({
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: AppColors.mutedText.withValues(alpha: 0.5),
            size: 46,
          ),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.72),
              fontSize: 12,
              height: 1.7,
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 18),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    ),
  );
}
