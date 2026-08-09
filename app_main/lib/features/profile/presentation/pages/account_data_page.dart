import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../games/application/creation_cloud_service.dart';
import '../../../home/application/home_providers.dart';

class AccountDataPage extends StatelessWidget {
  const AccountDataPage({super.key});

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
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: Text(l10n.accountDataTitle, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Center(
                      child: Stack(
                        children: [
                          // A series poster previously stood in for the account
                          // avatar. No avatar is loaded from the API yet.
                          Container(
                            width: 92,
                            height: 92,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.indigoSurface, border: Border.all(color: Colors.white.withValues(alpha: 0.14), width: 2)),
                            child: const Icon(Icons.person_rounded, color: Colors.white, size: 40),
                          ),
                          PositionedDirectional(
                            bottom: 0,
                            end: 0,
                            child: Container(
                              width: 28,
                              height: 28,
                              decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.starGold, border: Border.all(color: AppColors.deepSpace, width: 2)),
                              child: const Icon(Icons.edit_rounded, size: 14, color: AppColors.deepSpace),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    const Center(child: Text('—', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800))),
                    Center(child: Text(l10n.accountNotLinkedYet, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12))),
                    const SizedBox(height: 24),
                    _Field(label: l10n.nameLabel, value: '—', icon: Icons.person_outline_rounded),
                    const SizedBox(height: 12),
                    _Field(label: l10n.emailLabel, value: '—', icon: Icons.mail_outline_rounded),
                    const SizedBox(height: 12),
                    // "إضافة" / "تغيير" / "حفظ التغييرات" each had an empty
                    // callback. There is no account-update endpoint: the API
                    // exposes `GET /auth/me` only, with no PATCH and no
                    // password-change route. Disabled buttons state that
                    // honestly; empty callbacks implied the edits were saved.
                    _Field(label: l10n.phoneLabel, value: '—', icon: Icons.phone_outlined, trailing: TextButton(onPressed: null, child: Text(l10n.addAction))),
                    const SizedBox(height: 12),
                    _Field(label: l10n.passwordLabel, value: '••••••••', icon: Icons.lock_outline_rounded, trailing: TextButton(onPressed: null, child: Text(l10n.changeAction))),
                    const SizedBox(height: 20),
                    SizedBox(height: 48, child: FilledButton(onPressed: null, child: Text(l10n.accountEditUnavailable))),
                    const SizedBox(height: 28),
                    const _StoredDrawingsControl(),
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

/// The retention control for stored child drawings.
///
/// `docs/games/10-child-creations-storage.md` promises a parent can withdraw
/// consent and have stored images removed. That promise had no surface: the purge
/// endpoint existed and nothing called it, so the only way to exercise it was a
/// hand-written HTTP request.
///
/// It is a family-wide purge, which is what an account-level data control should be.
/// Per-drawing removal already lives in «مجموعتي».
class _StoredDrawingsControl extends ConsumerStatefulWidget {
  const _StoredDrawingsControl();

  @override
  ConsumerState<_StoredDrawingsControl> createState() => _StoredDrawingsControlState();
}

class _StoredDrawingsControlState extends ConsumerState<_StoredDrawingsControl> {
  bool _busy = false;
  String? _message;

  Future<void> _purge() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف رسومات الأطفال المحفوظة؟'),
        content: const Text(
          'سيُحذف كل ما حُفظ في مساحة أسرتك، وتُسحب الموافقة على الحفظ.\n\n'
          'الرسومات الموجودة على هذا الجهاز لا تتأثّر.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('احذف')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() {
      _busy = true;
      _message = null;
    });

    final api = ref.read(majarraApiClientProvider);
    try {
      // Purge before revoking: if revocation succeeded and the purge then failed,
      // images the parent has just refused would remain in storage.
      final result = await api.purgeCreations();
      final deleted = result['data'] is Map ? (result['data'] as Map)['objects_deleted'] : null;
      await api.setConsent(
        consentType: kCreationsConsentType,
        version: kCreationsConsentVersion,
        revoke: true,
      );
      if (!mounted) return;
      setState(() => _message = 'تم الحذف. عناصر مُزالة: ${deleted ?? 0}.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'لم نتمكّن من الحذف. حاول لاحقًا.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.indigoSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'رسومات الأطفال المحفوظة',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            'ما يُحفظ يبقى خاصًّا بأسرتك: لا يُنشر ولا يُشارك ولا يظهر في أي فهرس.',
            style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.80), fontSize: 12),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 44,
            child: OutlinedButton.icon(
              onPressed: _busy ? null : _purge,
              icon: const Icon(Icons.delete_sweep_outlined),
              label: const Text('احذف كل الرسومات المحفوظة'),
            ),
          ),
          if (_message != null) ...[
            const SizedBox(height: 8),
            Text(
              _message!,
              style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.85), fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.value, required this.icon, this.trailing});
  final String label;
  final String value;
  final IconData icon;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
      child: Row(
        children: [
          Container(width: 36, height: 36, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(8)), child: Icon(icon, color: Colors.white, size: 18)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 10)), Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600))]),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
