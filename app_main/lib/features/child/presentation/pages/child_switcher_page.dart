import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/child_provider.dart';
import '../../application/family_children_provider.dart';
import '../../domain/child_profile.dart';
import '../widgets/child_avatars.dart';
import 'child_profile_form_page.dart';

/// Premium streaming-style profile selector – Netflix / Disney+ inspiration
class ChildSwitcherPage extends ConsumerWidget {
  const ChildSwitcherPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(familyChildrenProvider);
    final auth = ref.watch(authGuardProvider);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: children.when(
            loading: () => const Center(child: CircularProgressIndicator(color: AppColors.starGold)),
            error: (_, __) => _AuthRequired(onLogin: () => context.go('/login')),
            data: (items) => _ProfilesView(
              items: items,
              isDemo: auth.isDemo,
              onCreate: () => _openForm(context, ref),
              onEdit: (profile) => _openForm(context, ref, existingProfile: profile),
            ),
          ),
        ),
      ),
    );
  }

  /// Opens [ChildProfileFormPage] via a direct [Navigator.push] rather than a
  /// new `GoRoute`. This surface's only entry point is `ChildSwitcherPage`
  /// itself (create button, or the edit action on an existing profile card);
  /// there is no deep link or redirect target that needs a named route, so a
  /// `MaterialPageRoute` push — the same pattern already used throughout
  /// `features/games/presentation/pages` for screens reached the same way —
  /// is enough. A `GoRoute` can be added later if a deep link into this form
  /// becomes necessary (e.g. from a notification).
  Future<void> _openForm(
    BuildContext context,
    WidgetRef ref, {
    ChildProfile? existingProfile,
  }) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ChildProfileFormPage(existingProfile: existingProfile),
      ),
    );
    if (saved == true) ref.invalidate(familyChildrenProvider);
  }
}

/// ── Main profiles view – true streaming UX ──
class _ProfilesView extends ConsumerWidget {
  const _ProfilesView({
    required this.items,
    required this.isDemo,
    required this.onCreate,
    required this.onEdit,
  });
  final List<ChildProfile> items;
  final bool isDemo;
  final VoidCallback onCreate;
  final void Function(ChildProfile) onEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // We keep "من يشاهد الآن؟" + grid + very minimal footer (no big family card)
    return LayoutBuilder(
      builder: (context, constraints) {
        final isWide = constraints.maxWidth > 600;
        return CustomScrollView(
          slivers: [
            // Top bar – minimal: back to login if needed? No, just logo/title area
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, isWide ? 32 : 48, 20, 12),
                child: Column(
                  children: [
                    // Title only – no email, no PIN, no package badge
                    Text(
                      'من يشاهد الآن؟',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: isWide ? 32 : 26,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                        height: 1.2,
                      ),
                    ),
                    const SizedBox(height: 28),
                    // Profile grid – centered, Netflix-like
                    _ProfileGrid(
                      items: items,
                      isDemo: isDemo,
                      onCreate: onCreate,
                      onEdit: onEdit,
                    ),
                    const SizedBox(height: 32),
                    // Minimal family management – tiny row, not a huge card
                    if (!isDemo) _MinimalFamilyActions(),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ProfileGrid extends ConsumerWidget {
  const _ProfileGrid({
    required this.items,
    required this.isDemo,
    required this.onCreate,
    required this.onEdit,
  });
  final List<ChildProfile> items;
  final bool isDemo;
  final VoidCallback onCreate;
  final void Function(ChildProfile) onEdit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canAdd = !isDemo && items.length < 4;

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Wrap(
          alignment: WrapAlignment.center,
          spacing: 20,
          runSpacing: 24,
          children: [
            for (var i = 0; i < items.length; i++)
              _ProfileCard(
                profile: items[i],
                autofocus: i == 0,
                // Editing a real family's profile requires an authenticated
                // session (the endpoint carries a `manage_children` proof
                // regardless); the demo/guest list has no server-side row to
                // edit at all, so its card omits the affordance entirely.
                onEdit: isDemo ? null : () => onEdit(items[i]),
                onTap: () {
                  ref.read(childProvider.notifier).selectChild(
                        childId: items[i].id,
                        ageTrack: items[i].ageTrack,
                        displayName: items[i].displayName,
                        interests: items[i].interests,
                        language: items[i].language,
                      );
                  context.go('/');
                },
              ),
            if (canAdd) _AddProfileCard(onTap: onCreate),
          ],
        ),
      ),
    );
  }
}

class _ProfileCard extends StatefulWidget {
  const _ProfileCard({
    required this.profile,
    required this.onTap,
    this.onEdit,
    this.autofocus = false,
  });
  final ChildProfile profile;
  final VoidCallback onTap;
  final VoidCallback? onEdit;
  final bool autofocus;

  @override
  State<_ProfileCard> createState() => _ProfileCardState();
}

class _ProfileCardState extends State<_ProfileCard> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return FocusableActionDetector(
      autofocus: widget.autofocus,
      onShowFocusHighlight: (v) => setState(() => _hover = v),
      onShowHoverHighlight: (v) => setState(() => _hover = v),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedScale(
          scale: _hover ? 1.06 : 1.0,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          child: SizedBox(
            width: 112,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Premium avatar – ChildAvatarView already has border + shadow + gradient
                // Don't double-wrap with Container to avoid cutting
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    AnimatedScale(
                      scale: _hover ? 1.04 : 1.0,
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOutCubic,
                      child: ChildAvatarView(
                        avatarId: widget.profile.avatarId,
                        size: 96,
                        showBorder: true,
                        showShadow: true,
                      ),
                    ),
                    if (widget.onEdit != null)
                      Positioned(
                        right: -4,
                        top: -4,
                        child: _EditBadge(onTap: widget.onEdit!),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  widget.profile.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _hover ? Colors.white : Colors.white.withValues(alpha: 0.86),
                    fontSize: 13.5,
                    fontWeight: _hover ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: _hover ? 0.10 : 0.06),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    widget.profile.trackLabel,
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.58), fontSize: 9, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Small pencil badge overlaid on a profile card's avatar — the entry point
/// into `ChildProfileFormPage`'s edit mode for that profile (Requirement
/// 10.4). Kept as an unobtrusive overlay rather than a full row action so the
/// primary tap target (select this child) stays the whole card.
class _EditBadge extends StatelessWidget {
  const _EditBadge({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'تعديل الملف',
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF111A3A),
            border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
            boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 6)],
          ),
          child: const Icon(Icons.edit_rounded, size: 13, color: AppColors.starGold),
        ),
      ),
    );
  }
}

class _AddProfileCard extends StatefulWidget {
  const _AddProfileCard({required this.onTap});
  final VoidCallback onTap;

  @override
  State<_AddProfileCard> createState() => _AddProfileCardState();
}

class _AddProfileCardState extends State<_AddProfileCard> {
  bool _hover = false;

  @override
  Widget build(BuildContext context) {
    return FocusableActionDetector(
      onShowHoverHighlight: (v) => setState(() => _hover = v),
      onShowFocusHighlight: (v) => setState(() => _hover = v),
      child: GestureDetector(
        onTap: widget.onTap,
        child: SizedBox(
          width: 112,
          child: Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: _hover ? 0.10 : 0.04),
                  border: Border.all(color: Colors.white.withValues(alpha: _hover ? 0.24 : 0.10), width: 1.2, strokeAlign: BorderSide.strokeAlignCenter),
                ),
                child: Icon(Icons.add_rounded, color: Colors.white.withValues(alpha: _hover ? 0.9 : 0.42), size: 34),
              ),
              const SizedBox(height: 12),
              Text('إضافة طفل', style: TextStyle(color: Colors.white.withValues(alpha: _hover ? 0.9 : 0.56), fontSize: 12.5, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Minimal family actions – replaces the big "مدير الأسرة" card.
/// Just 3 tiny ghost buttons in a row, not a huge card with PIN.
class _MinimalFamilyActions extends StatelessWidget {
  const _MinimalFamilyActions();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 8),
        Divider(color: Colors.white.withValues(alpha: 0.06), thickness: 1),
        const SizedBox(height: 14),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 12,
          runSpacing: 8,
          children: [
            _GhostAction(icon: Icons.admin_panel_settings_outlined, label: 'إدارة الأسرة', onTap: () => context.push('/parent')),
            _GhostAction(icon: Icons.workspace_premium_outlined, label: 'العضوية', onTap: () => context.push('/membership')),
            _GhostAction(icon: Icons.lock_outline_rounded, label: 'منطقة ولي الأمر', onTap: () => context.push('/parent-pin')),
          ],
        ),
      ],
    );
  }
}

class _GhostAction extends StatelessWidget {
  const _GhostAction({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white.withValues(alpha: 0.10)), color: Colors.white.withValues(alpha: 0.03)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: AppColors.mutedText),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}

class _AuthRequired extends StatelessWidget {
  const _AuthRequired({required this.onLogin});
  final VoidCallback onLogin;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 64, height: 64,
            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06), border: Border.all(color: Colors.white.withValues(alpha: 0.08))),
            child: const Icon(Icons.lock_outline_rounded, color: AppColors.mutedText, size: 28),
          ),
          const SizedBox(height: 18),
          const Text('يتطلب تسجيل الدخول', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text('ملفات الأطفال مرتبطة بحساب الأسرة', style: TextStyle(color: AppColors.mutedText, fontSize: 12)),
          const SizedBox(height: 20),
          FilledButton(onPressed: onLogin, style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))), child: const Text('تسجيل الدخول', style: TextStyle(fontWeight: FontWeight.w800))),
        ]),
      ),
    );
  }
}


