import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../../core/security/biometric_auth.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/data/parent_pin_store.dart';
import '../../data/settings_store.dart';

/// App settings.
///
/// Previously every toggle lived in plain widget state, so a preference was lost
/// as soon as the page was popped and nothing else in the app could read it.
/// Values now go through [settingsProvider], which persists them on the device.
class SettingsPage extends ConsumerWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(settingsProvider);
    final controller = ref.read(settingsProvider.notifier);
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
                l10n.settings,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _SectionHeader(title: l10n.settingsSectionPlayback),
                    _TileSwitch(
                      title: l10n.autoplayNextTitle,
                      subtitle: l10n.autoplayNextSubtitle,
                      value: settings.autoplayNext,
                      onChanged: controller.setAutoplay,
                    ),
                    const SizedBox(height: 8),
                    _TileNav(
                      title: l10n.videoQualityTitle,
                      trailing: settings.quality.label,
                      onTap: () => _pickQuality(context, ref, settings),
                    ),
                    const SizedBox(height: 18),
                    _SectionHeader(title: l10n.settingsSectionDownload),
                    _TileSwitch(
                      title: l10n.wifiOnlyTitle,
                      subtitle: l10n.wifiOnlySubtitle,
                      value: settings.downloadOverWifiOnly,
                      onChanged: controller.setDownloadOverWifiOnly,
                    ),
                    const SizedBox(height: 18),
                    _SectionHeader(title: l10n.settingsSectionNotifications),
                    _TileSwitch(
                      title: l10n.contentNotificationsTitle,
                      subtitle: l10n.contentNotificationsSubtitle,
                      value: settings.contentNotifications,
                      onChanged: controller.setContentNotifications,
                    ),
                    const SizedBox(height: 18),
                    _SectionHeader(title: l10n.settingsSectionGeneral),
                    // Language and appearance are single-option today: the app
                    // ships Arabic only and one cinematic dark theme. They are
                    // shown as read-only rows rather than as taps that do
                    // nothing when pressed.
                    _TileInfo(title: l10n.languageLabel, value: l10n.languageValueArabic),
                    const SizedBox(height: 8),
                    _TileInfo(title: l10n.appearanceLabel, value: l10n.appearanceValueDark),
                    const SizedBox(height: 24),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.indigoSurface.withValues(alpha: 0.42),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.06),
                        ),
                      ),
                      child: Text(
                        l10n.settingsDeviceOnlyNotice,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.72),
                          fontSize: 11,
                          height: 1.7,
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const _SectionHeader(title: 'الأمان'),
                    const _BiometricTile(),
                    const SizedBox(height: 24),
                    _SectionHeader(title: l10n.settingsSectionAccount),
                    const _LogoutTile(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _pickQuality(BuildContext context, WidgetRef ref, AppSettings settings) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (final option in VideoQuality.values)
              ListTile(
                title: Text(
                  option.label,
                  style: TextStyle(
                    color: option == settings.quality
                        ? AppColors.starGold
                        : Colors.white,
                  ),
                ),
                trailing: option == settings.quality
                    ? const Icon(
                        Icons.check_rounded,
                        color: AppColors.starGold,
                      )
                    : null,
                onTap: () {
                  Navigator.pop(sheetContext);
                  ref.read(settingsProvider.notifier).setQuality(option);
                },
              ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(
      title,
      style: TextStyle(
        color: AppColors.mutedText.withValues(alpha: 0.72),
        fontSize: 12,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.5,
      ),
    ),
  );
}

class _TileSwitch extends StatelessWidget {
  const _TileSwitch({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: 0.72),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
    ),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              Text(
                subtitle,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.62),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: AppColors.starGold,
        ),
      ],
    ),
  );
}

class _TileNav extends StatelessWidget {
  const _TileNav({
    required this.title,
    required this.trailing,
    required this.onTap,
  });

  final String title;
  final String trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF111A3A).withValues(alpha: 0.72),
    borderRadius: BorderRadius.circular(14),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            const Spacer(),
            Text(
              trailing,
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.62),
                fontSize: 12,
              ),
            ),
            const SizedBox(width: 6),
            const Icon(
              Icons.chevron_left_rounded,
              color: Colors.white,
              size: 18,
            ),
          ],
        ),
      ),
    ),
  );
}

/// Sign-out row.
///
/// Stateful so the button can show progress and refuse a second tap: the
/// teardown makes a network call and clears several stores, and a double tap
/// could interleave two wipes.
class _LogoutTile extends ConsumerStatefulWidget {
  const _LogoutTile();

  @override
  ConsumerState<_LogoutTile> createState() => _LogoutTileState();
}

class _LogoutTileState extends ConsumerState<_LogoutTile> {
  bool _busy = false;

  Future<void> _confirmAndLogout() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF111A3A),
        title: Text(
          l10n.logoutTitle,
          style: const TextStyle(color: Colors.white, fontSize: 16),
        ),
        content: Text(
          l10n.logoutConfirmBody,
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.82),
            fontSize: 12.5,
            height: 1.7,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(l10n.cancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.danger,
              foregroundColor: Colors.white,
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(l10n.logoutTitle),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    await ref.read(authControllerProvider).logout();
    if (!mounted) return;
    setState(() => _busy = false);
    // The router guard also redirects on the auth flag flipping; going
    // explicitly clears this page off the stack so back cannot return to it.
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) => Material(
    color: const Color(0xFF111A3A).withValues(alpha: 0.72),
    borderRadius: BorderRadius.circular(14),
    child: InkWell(
      onTap: _busy ? null : _confirmAndLogout,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.danger.withValues(alpha: 0.24)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.logout_rounded,
              color: AppColors.danger,
              size: 18,
            ),
            const SizedBox(width: 10),
            const Text(
              'تسجيل الخروج',
              style: TextStyle(
                color: AppColors.danger,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Spacer(),
            if (_busy)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.danger,
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

/// Read-only row for a setting that currently has a single possible value.
class _TileInfo extends StatelessWidget {
  const _TileInfo({required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: 0.48),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
    ),
    child: Row(
      children: [
        Text(
          title,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.82),
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.62),
            fontSize: 12,
          ),
        ),
      ],
    ),
  );
}


/// Manages the biometric parent-area unlock (§8).
///
/// This is where a parent turns the convenience on or off after the fact, and
/// the only place it can be turned off. Enabling requires a live biometric check
/// (proving the device owner is present) and an enrolled PIN — biometrics unlock
/// the local gate but never replace the server-verified PIN. When there is no
/// PIN or no biometric hardware, the row states why rather than offering a
/// switch that would silently fail.
class _BiometricTile extends ConsumerStatefulWidget {
  const _BiometricTile();

  @override
  ConsumerState<_BiometricTile> createState() => _BiometricTileState();
}

class _BiometricTileState extends ConsumerState<_BiometricTile> {
  bool _hasPin = false;
  bool _enabled = false;
  bool _busy = false;
  BiometricAvailability _availability = BiometricAvailability.unsupported;

  ParentPinStore get _store => ref.read(parentPinStoreProvider);

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    // Guarded: on a platform without the secure-storage/biometric plugins (e.g.
    // a widget test host) these throw MissingPluginException. Treating that as
    // "no pin / unsupported" keeps the page building instead of crashing.
    var hasPin = false;
    var enabled = false;
    var availability = BiometricAvailability.unsupported;
    try {
      hasPin = await _store.hasPin();
      enabled = await _store.isBiometricEnabled();
      availability = await ref.read(biometricAuthenticatorProvider).availability();
    } catch (_) {
      // Safe defaults already set above.
    }
    if (!mounted) return;
    setState(() {
      _hasPin = hasPin;
      _enabled = enabled;
      _availability = availability;
    });
  }

  String get _subtitle {
    if (!_hasPin) return 'أنشئ رمز ولي الأمر أولًا لتفعيل البصمة';
    switch (_availability) {
      case BiometricAvailability.unsupported:
        return 'لا يدعم هذا الجهاز البصمة أو Face ID';
      case BiometricAvailability.notEnrolled:
        return 'سجّل بصمة أو Face ID في إعدادات الجهاز أولًا';
      case BiometricAvailability.available:
        return 'افتح منطقة ولي الأمر بالبصمة بدل إدخال الرمز';
    }
  }

  bool get _canToggle =>
      !_busy &&
      _hasPin &&
      _availability == BiometricAvailability.available;

  Future<void> _onChanged(bool value) async {
    if (_busy) return;
    setState(() => _busy = true);
    if (value) {
      // Prove presence before enabling, so turning it on is itself gated.
      final ok = await ref.read(biometricAuthenticatorProvider).authenticate(
            localizedReason: 'أكّد هويتك لتفعيل الدخول بالبصمة',
          );
      if (ok) await _store.setBiometricEnabled(true);
      if (mounted) setState(() => _enabled = ok);
    } else {
      await _store.setBiometricEnabled(false);
      if (mounted) setState(() => _enabled = false);
    }
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Row(
        children: [
          const Icon(Icons.fingerprint_rounded, color: AppColors.starGold, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'الدخول بالبصمة / Face ID',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                ),
                Text(
                  _subtitle,
                  style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11),
                ),
              ],
            ),
          ),
          Switch(
            value: _enabled,
            onChanged: _canToggle ? _onChanged : null,
            activeThumbColor: AppColors.starGold,
          ),
        ],
      ),
    );
  }
}
