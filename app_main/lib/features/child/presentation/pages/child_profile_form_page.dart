import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../widgets/child_avatars.dart';
import '../../application/family_children_provider.dart';
import '../../domain/child_profile.dart';

/// The closed interest list a family can pick from when creating or editing
/// a child profile (Requirement 10.1, 10.6).
///
/// The ids intentionally reuse the app's existing nine planet ids from
/// `PlanetDto._displayNames` (`content_dtos.dart`) rather than inventing a
/// second taxonomy: interests describe the same content categories the
/// catalogue is already organised around, so a child's stated interest maps
/// directly onto a planet a later recommendation surface can consume without
/// a translation table between two different vocabularies.
const List<String> kChildInterestIds = <String>[
  'abjad',
  'arqam',
  'oloom',
  'qiyam',
  'qisas',
  'maharat',
  'tarikh',
  'alam',
  'islamic',
];

String _interestLabel(AppLocalizations l10n, String id) => switch (id) {
      'abjad' => l10n.interestAbjad,
      'arqam' => l10n.interestArqam,
      'oloom' => l10n.interestOloom,
      'qiyam' => l10n.interestQiyam,
      'qisas' => l10n.interestQisas,
      'maharat' => l10n.interestMaharat,
      'tarikh' => l10n.interestTarikh,
      'alam' => l10n.interestAlam,
      'islamic' => l10n.interestIman,
      _ => id,
    };

/// Full-screen create/edit surface for a child profile (Requirement 10).
///
/// Replaces the old `_CreateChildSheet` bottom sheet — a real screen instead
/// of a modal makes room for the `interests` and `language` fields the sheet
/// never had, and gives editing an existing profile (previously impossible;
/// there was no update endpoint at all) a natural home.
///
/// [existingProfile] `null` means create mode. Non-null means edit mode: the
/// birth date becomes read-only (age-track changes are exclusive to the
/// future track-transition flow, never a silent side effect of a profile
/// edit) and the call goes through `MajarraApiClient.updateChild` instead of
/// `createChild`.
class ChildProfileFormPage extends ConsumerStatefulWidget {
  const ChildProfileFormPage({
    this.existingProfile,
    this.isFirstChildInOnboarding = false,
    this.onCreated,
    super.key,
  });

  final ChildProfile? existingProfile;

  /// True only for the child-creation step of a first-run onboarding
  /// journey (`OnboardingFlowPage`, Requirement 8.4) — when set, the create
  /// call sends `markOnboardingComplete: true` to
  /// `MajarraApiClient.createChild`, stamping `onboarding_completed_at` on
  /// the server for this child. Defaults to `false` so every other create
  /// call site (a second/third child added later from `ChildSwitcherPage`)
  /// is unaffected, matching Requirement 8.6.
  final bool isFirstChildInOnboarding;

  /// When non-null, called after a successful create/update instead of the
  /// page's own `context.pop(true)` — lets a hosting flow advance to its
  /// next step rather than assuming this page is always opened as a pushed
  /// route with a caller waiting on the popped result. `null` (the
  /// default) preserves the existing standalone behaviour used by
  /// `ChildSwitcherPage`.
  final VoidCallback? onCreated;

  bool get isEditing => existingProfile != null;

  @override
  ConsumerState<ChildProfileFormPage> createState() =>
      _ChildProfileFormPageState();
}

class _ChildProfileFormPageState extends ConsumerState<ChildProfileFormPage> {
  late final TextEditingController _nickname;
  late int _birthMonth;
  late int _birthYear;
  late String _avatarId;
  late Set<String> _interests;

  /// Fixed to `'ar'`: `AppLocales.selectable` (`core/l10n/locale_catalog.dart`)
  /// exposes only Arabic as a genuinely complete, selectable language today.
  /// Rendering a picker with a single option would claim a choice that does
  /// not really exist, so the field is shown read-only instead — the model
  /// still carries a real `language` value end to end (sent on create, sent
  /// unchanged on edit) so a second language becomes a UI change only, not a
  /// data-model one, once its translation coverage is complete.
  late String _language;

  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingProfile;
    _nickname = TextEditingController(text: existing?.nickname ?? '');
    _birthMonth = existing?.birthMonth ?? DateTime.now().month;
    _birthYear = existing?.birthYear ?? (DateTime.now().year - 6);
    _avatarId = existing?.avatarId.isNotEmpty == true
        ? existing!.avatarId
        : ChildAvatars.all.first.id;
    _interests = {...(existing?.interests ?? const <String>[])};
    _language = existing?.language ?? 'ar';
  }

  @override
  void dispose() {
    _nickname.dispose();
    super.dispose();
  }

  List<int> get _selectableYears =>
      [for (var age = 3; age <= 12; age++) DateTime.now().year - age];

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final nickname = _nickname.text.trim();
    if (nickname.isEmpty) {
      setState(() => _error = l10n.childFormNicknameEmptyError);
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final api = ref.read(majarraApiClientProvider);
    try {
      if (widget.isEditing) {
        await api.updateChild(
          widget.existingProfile!.id,
          nickname: nickname,
          avatarId: _avatarId,
          language: _language,
          interests: _interests.toList(),
        );
      } else {
        await api.createChild(
          nickname: nickname,
          birthMonth: _birthMonth,
          birthYear: _birthYear,
          avatarId: _avatarId,
          language: _language,
          interests: _interests.toList(),
          markOnboardingComplete: widget.isFirstChildInOnboarding,
        );
      }
      if (!mounted) return;
      ref.invalidate(familyChildrenProvider);
      if (widget.onCreated != null) {
        widget.onCreated!();
      } else {
        context.pop(true);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = widget.isEditing
            ? l10n.childFormEditErrorGeneric
            : l10n.childFormCreateErrorGeneric;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final characterCount = ChildAvatars.characters.length;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: CustomScrollView(
            slivers: [
              SliverAppBar(
                pinned: true,
                backgroundColor:
                    const Color(0xFF0B1026).withValues(alpha: 0.88),
                leading: IconButton(
                  icon: const Icon(
                    Icons.arrow_forward_rounded,
                    color: Colors.white,
                  ),
                  tooltip: l10n.back,
                  onPressed: () => context.pop(),
                ),
                title: Text(
                  widget.isEditing
                      ? l10n.childFormEditTitle
                      : l10n.childFormCreateTitle,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
                centerTitle: true,
              ),
              SliverToBoxAdapter(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 640),
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        20,
                        16,
                        20,
                        20 + MediaQuery.viewInsetsOf(context).bottom,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: AppColors.starGold
                                      .withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  widget.isEditing
                                      ? Icons.edit_rounded
                                      : Icons.person_add_rounded,
                                  color: AppColors.starGold,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      widget.isEditing
                                          ? l10n.childFormEditTitle
                                          : l10n.childFormCreateTitle,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 17,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      widget.isEditing
                                          ? l10n.childFormEditSubtitle
                                          : l10n.childFormCreateSubtitle,
                                      style: const TextStyle(
                                        color: AppColors.mutedText,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: _nickname,
                            enabled: !_submitting,
                            maxLength: 40,
                            textAlign: TextAlign.right,
                            textDirection: TextDirection.rtl,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15,
                            ),
                            decoration: InputDecoration(
                              labelText: l10n.childFormNicknameLabel,
                              hintText: l10n.childFormNicknameHint,
                              hintStyle: TextStyle(
                                color: AppColors.mutedText
                                    .withValues(alpha: 0.42),
                                fontSize: 13,
                              ),
                              counterText: '',
                              labelStyle: TextStyle(
                                color:
                                    AppColors.mutedText.withValues(alpha: 0.72),
                                fontSize: 12,
                              ),
                              filled: true,
                              fillColor:
                                  const Color(0xFF111A3A).withValues(alpha: 0.78),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 16,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide.none,
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: Colors.white.withValues(alpha: 0.08),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 14),
                          if (widget.isEditing)
                            _ReadOnlyBirthDate(
                              label: l10n.childFormBirthDateReadOnlyLabel,
                              notice: l10n.childFormBirthDateEditNotice,
                              birthMonth: _birthMonth,
                              birthYear: _birthYear,
                            )
                          else
                            Row(
                              textDirection: TextDirection.rtl,
                              children: [
                                Expanded(
                                  child: _Dropdown<int>(
                                    key: const Key('birthMonthDropdown'),
                                    label: l10n.childFormBirthMonthLabel,
                                    value: _birthMonth,
                                    items: [
                                      for (var m = 1; m <= 12; m++) m,
                                    ],
                                    labelBuilder: (m) => '$m',
                                    onChanged: _submitting
                                        ? null
                                        : (v) =>
                                            setState(() => _birthMonth = v),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _Dropdown<int>(
                                    key: const Key('birthYearDropdown'),
                                    label: l10n.childFormBirthYearLabel,
                                    value: _birthYear,
                                    items: _selectableYears,
                                    labelBuilder: (y) => '$y',
                                    onChanged: _submitting
                                        ? null
                                        : (v) =>
                                            setState(() => _birthYear = v),
                                  ),
                                ),
                              ],
                            ),
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              const Icon(
                                Icons.auto_awesome_rounded,
                                size: 16,
                                color: AppColors.starGold,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  l10n.childFormAvatarSectionTitle,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                l10n.childFormAvatarCount(characterCount),
                                style: const TextStyle(
                                  color: AppColors.mutedText,
                                  fontSize: 10,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.childFormAvatarSectionSubtitle,
                            style: const TextStyle(
                              color: AppColors.mutedText,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ChildAvatarPicker(
                            selectedId: _avatarId,
                            enabled: !_submitting,
                            onSelected: (id) =>
                                setState(() => _avatarId = id),
                          ),
                          const SizedBox(height: 22),
                          Text(
                            l10n.childFormInterestsTitle,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.childFormInterestsSubtitle,
                            style: const TextStyle(
                              color: AppColors.mutedText,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              for (final id in kChildInterestIds)
                                _InterestChip(
                                  label: _interestLabel(l10n, id),
                                  selected: _interests.contains(id),
                                  enabled: !_submitting,
                                  onTap: () => setState(() {
                                    if (_interests.contains(id)) {
                                      _interests.remove(id);
                                    } else {
                                      _interests.add(id);
                                    }
                                  }),
                                ),
                            ],
                          ),
                          const SizedBox(height: 22),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFF111A3A)
                                  .withValues(alpha: 0.6),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.06),
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.language_rounded,
                                  size: 16,
                                  color: AppColors.mutedText
                                      .withValues(alpha: 0.8),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        l10n.languageLabel,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        l10n.childFormLanguageReadOnlyNotice,
                                        style: const TextStyle(
                                          color: AppColors.mutedText,
                                          fontSize: 9.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 5,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.white
                                        .withValues(alpha: 0.06),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    l10n.languageValueArabic,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 14),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.danger
                                    .withValues(alpha: 0.10),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: AppColors.danger
                                      .withValues(alpha: 0.22),
                                ),
                              ),
                              child: Text(
                                _error!,
                                style: const TextStyle(
                                  color: AppColors.danger,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _submitting ? null : _submit,
                            style: FilledButton.styleFrom(
                              backgroundColor: AppColors.starGold,
                              foregroundColor: AppColors.deepSpace,
                              minimumSize: const Size.fromHeight(52),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: _submitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.deepSpace,
                                    ),
                                  )
                                : Text(
                                    widget.isEditing
                                        ? l10n.childFormSaveButtonEdit
                                        : l10n.childFormSaveButtonCreate,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 14,
                                    ),
                                  ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
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

class _ReadOnlyBirthDate extends StatelessWidget {
  const _ReadOnlyBirthDate({
    required this.label,
    required this.notice,
    required this.birthMonth,
    required this.birthYear,
  });

  final String label;
  final String notice;
  final int birthMonth;
  final int birthYear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.cake_outlined,
            size: 18,
            color: AppColors.mutedText.withValues(alpha: 0.8),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.mutedText,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '$birthMonth / $birthYear',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  notice,
                  style: const TextStyle(
                    color: AppColors.mutedText,
                    fontSize: 9.5,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InterestChip extends StatelessWidget {
  const _InterestChip({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: selected
                ? AppColors.starGold.withValues(alpha: 0.16)
                : Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: selected
                  ? AppColors.starGold.withValues(alpha: 0.55)
                  : Colors.white.withValues(alpha: 0.10),
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                const Icon(
                  Icons.check_rounded,
                  size: 14,
                  color: AppColors.starGold,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  color: selected ? Colors.white : Colors.white70,
                  fontSize: 12,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
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
    super.key,
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
          labelStyle:
              TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 11),
          filled: true,
          fillColor: const Color(0xFF111A3A).withValues(alpha: 0.78),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<T>(
            value: value,
            isDense: true,
            isExpanded: true,
            dropdownColor: const Color(0xFF111A3A),
            icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.mutedText, size: 18),
            style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
            items: [
              for (final item in items)
                DropdownMenuItem(
                  value: item,
                  child: Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: Text(labelBuilder(item)),
                  ),
                ),
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
