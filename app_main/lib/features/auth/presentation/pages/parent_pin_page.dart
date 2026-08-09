import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../../core/security/biometric_auth.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/parent_pin_store.dart';

/// Gate for the parental area.
///
/// The verification is **local to this device**. See [ParentPinStore] for the
/// precise security limitations and the list of backend endpoints that must
/// exist before this gate can be considered a real authorization boundary.
class ParentPinPage extends ConsumerStatefulWidget {
  const ParentPinPage({super.key});

  @override
  ConsumerState<ParentPinPage> createState() => _ParentPinPageState();
}

class _ParentPinPageState extends ConsumerState<ParentPinPage> {
  final _pin = TextEditingController();
  final _confirmPin = TextEditingController();
  final _store = ParentPinStore();

  bool _obscure = true;
  bool _loading = true;
  bool _busy = false;
  bool _isEnrolling = false;
  String? _error;
  String? _notice;
  DateTime? _lockedUntil;

  bool _biometricEnabled = false;
  BiometricAvailability _biometricAvailability =
      BiometricAvailability.unsupported;

  bool get _canUseBiometric =>
      !_isEnrolling &&
      _biometricEnabled &&
      _biometricAvailability == BiometricAvailability.available;

  @override
  void initState() {
    super.initState();
    _loadEnrolmentState();
  }

  @override
  void dispose() {
    _pin.dispose();
    _confirmPin.dispose();
    super.dispose();
  }

  Future<void> _loadEnrolmentState() async {
    final hasPin = await _store.hasPin();
    final biometricEnabled = await _store.isBiometricEnabled();
    final availability =
        await ref.read(biometricAuthenticatorProvider).availability();
    if (!mounted) return;
    setState(() {
      _isEnrolling = !hasPin;
      _biometricEnabled = biometricEnabled;
      _biometricAvailability = availability;
      _loading = false;
    });
    // Offer a one-tap unlock immediately when the parent already opted in, so a
    // returning parent does not have to reach for the button.
    if (_canUseBiometric) {
      // A microtask so the first frame paints before the system dialog appears.
      Future.microtask(_unlockWithBiometric);
    }
  }

  /// Unlocks the LOCAL gate with device biometrics.
  ///
  /// This does not call the server verify endpoint — biometrics cannot produce
  /// the PIN. It grants entry to the parent surface only; any server-consequential
  /// action there re-verifies the PIN against the backend on its own.
  Future<void> _unlockWithBiometric() async {
    if (_busy || _isLockedOut) return;
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _busy = true;
      _error = null;
    });
    final ok = await ref.read(biometricAuthenticatorProvider).authenticate(
          localizedReason: l10n.biometricReason,
        );
    if (!mounted) return;
    setState(() => _busy = false);
    if (ok) {
      context.go('/parent');
    }
    // A failed/cancelled biometric silently leaves the PIN field ready; no
    // error, because cancelling is a legitimate choice, not a failure.
  }

  /// After a successful PIN entry, invites the parent to enable biometrics.
  Future<void> _maybeOfferBiometricOptIn() async {
    if (_biometricEnabled ||
        _biometricAvailability != BiometricAvailability.available) {
      return;
    }
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final enable = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Icon(Icons.fingerprint_rounded, size: 32),
        title: Text(l10n.biometricEnableTitle),
        content: Text(l10n.biometricEnablePrompt),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.notNow),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.enable),
          ),
        ],
      ),
    );
    if (enable == true) {
      await _store.setBiometricEnabled(true);
    }
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _error = null;
      _notice = null;
    });

    final pin = _pin.text;

    if (_isEnrolling) {
      final problem = ParentPinStore.validatePin(pin);
      if (problem != null) {
        setState(() => _error = problem);
        return;
      }
      if (_confirmPin.text != pin) {
        setState(() => _error = l10n.pinMismatch);
        return;
      }

      setState(() => _busy = true);
      // Enrol locally first so the device stays gated even if the network
      // is unavailable; then try to mirror to the server when authenticated.
      try {
        await _store.setPin(pin);
        final api = ref.read(majarraApiClientProvider);
        final token = await ref.read(authStorageProvider).getAccessToken();
        if (token != null && token.isNotEmpty) {
          try {
            await api.setParentPin(pin: pin);
          } on MajarraApiException catch (e) {
            // Server enrol is the real security boundary. Surface its error
            // but do not roll back the local PIN — the device gate is still
            // better than nothing.
            if (mounted) {
              setState(() => _notice = l10n.pinSavedLocallyOnly(_userFacing(e.message)));
            }
          }
        }
      } finally {
        if (mounted) setState(() => _busy = false);
      }
      if (!mounted) return;
      context.go('/parent');
      return;
    }

    if (pin.isEmpty) {
      setState(() => _error = l10n.pinEmpty);
      return;
    }

    setState(() => _busy = true);
    // Try server verification first when a session exists; fall back to local.
    final token = await ref.read(authStorageProvider).getAccessToken();
    if (token != null && token.isNotEmpty) {
      try {
        await ref.read(majarraApiClientProvider).verifyParentPin(pin: pin);
        if (!mounted) return;
        setState(() => _busy = false);
        _pin.clear();
        await _maybeOfferBiometricOptIn();
        if (!mounted) return;
        context.go('/parent');
        return;
      } on MajarraApiException catch (e) {
        final msg = e.message;
        if (msg.contains('423') || msg.contains('Too many attempts') || msg.contains('locked_until')) {
          if (!mounted) return;
          setState(() => _busy = false);
          _pin.clear();
          // Extract locked_until if present; otherwise use local lockout duration.
          setState(() {
            _lockedUntil = DateTime.now().add(const Duration(minutes: 15));
            _error = l10n.pinLockedOut(_remainingLockoutLabel(l10n));
          });
          return;
        }
        if (msg.contains('403') || msg.contains('Incorrect PIN')) {
          if (!mounted) return;
          setState(() => _busy = false);
          _pin.clear();
          setState(() => _error = l10n.pinIncorrect);
          return;
        }
        if (msg.contains('404') || msg.contains('No PIN')) {
          // No server PIN — fall through to local verification below.
        } else if (msg.contains('401') || msg.contains('Unauthorized')) {
          // Session expired — fall through to local so the gate does not
          // disappear entirely.
        } else {
          // Network or unexpected error — fall through to local.
        }
      }
    }

    final outcome = await _store.verify(pin);
    if (!mounted) return;
    setState(() => _busy = false);

    switch (outcome.result) {
      case ParentPinResult.success:
        _pin.clear();
        await _maybeOfferBiometricOptIn();
        if (!mounted) return;
        context.go('/parent');
      case ParentPinResult.wrongPin:
        _pin.clear();
        setState(() {
          _error = outcome.attemptsRemaining == 1
              ? l10n.pinIncorrectOneLeft
              : l10n.pinIncorrectAttemptsLeft(outcome.attemptsRemaining);
        });
      case ParentPinResult.lockedOut:
        _pin.clear();
        setState(() {
          _lockedUntil = outcome.lockedUntil;
          _error = l10n.pinLockedOut(_remainingLockoutLabel(l10n));
        });
      case ParentPinResult.notEnrolled:
        // Storage was cleared between opening the screen and submitting.
        setState(() {
          _isEnrolling = true;
          _notice = l10n.pinNotEnrolledYet;
        });
    }
  }

  String _remainingLockoutLabel(AppLocalizations l10n) {
    final until = _lockedUntil;
    // Falls back to the full lockout window when no deadline is known, which is
    // the worst case and therefore never understates the wait.
    if (until == null) {
      return l10n.minutesLabel(ParentPinStore.lockoutDuration.inMinutes);
    }
    final remaining = until.difference(DateTime.now());
    if (remaining.isNegative) return l10n.momentsLabel;
    return l10n.minutesLabel(remaining.inMinutes + 1);
  }

  String _userFacing(String raw) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    if (raw.contains('401')) return l10n.sessionExpiredShort;
    if (raw.contains('423')) return l10n.tooManyAttemptsShort;
    if (raw.contains('Network') || raw.contains('timed out')) {
      return l10n.serverUnreachable;
    }
    return l10n.serverErrorGeneric;
  }

  bool get _isLockedOut {
    final until = _lockedUntil;
    return until != null && until.isAfter(DateTime.now());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: IconButton(
                          icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
                          onPressed: () => context.pop(),
                        ),
                      ),
                      const Spacer(),
                      const Icon(Icons.lock_rounded, color: AppColors.starGold, size: 48),
                      const SizedBox(height: 16),
                      Text(
                        _isEnrolling ? 'أنشئ رمز ولي الأمر' : 'منطقة ولي الأمر',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _isEnrolling
                            ? 'اختر رمزًا من ${ParentPinStore.minPinLength} إلى ${ParentPinStore.maxPinLength} أرقام يعرفه ولي الأمر فقط'
                            : 'أدخل رمز ولي الأمر',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12),
                      ),
                      if (_notice != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          _notice!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.starGold, fontSize: 11.5, fontWeight: FontWeight.w600),
                        ),
                      ],
                      const SizedBox(height: 24),
                      _PinField(
                        controller: _pin,
                        obscure: _obscure,
                        enabled: !_isLockedOut && !_busy,
                        hintText: '••••',
                        onToggleObscure: () => setState(() => _obscure = !_obscure),
                        onSubmitted: (_) => _submit(),
                      ),
                      if (_isEnrolling) ...[
                        const SizedBox(height: 12),
                        _PinField(
                          controller: _confirmPin,
                          obscure: _obscure,
                          enabled: !_busy,
                          hintText: 'تأكيد الرمز',
                          onToggleObscure: () => setState(() => _obscure = !_obscure),
                          onSubmitted: (_) => _submit(),
                        ),
                      ],
                      if (_error != null) ...[
                        const SizedBox(height: 12),
                        Semantics(
                          liveRegion: true,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 16),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  _error!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 50,
                        child: FilledButton(
                          onPressed: (_isLockedOut || _busy) ? null : _submit,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.starGold,
                            foregroundColor: AppColors.deepSpace,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          child: _busy
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.deepSpace),
                                )
                              : Text(
                                  _isEnrolling ? 'حفظ الرمز' : 'دخول',
                                  style: const TextStyle(fontWeight: FontWeight.w800),
                                ),
                        ),
                      ),
                      // Biometric unlock: shown as an active convenience only
                      // when the parent has opted in on a capable device. It
                      // unlocks the local gate; server-consequential parent
                      // actions still re-verify the PIN with the backend.
                      if (_canUseBiometric) ...[
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: (_isLockedOut || _busy)
                              ? null
                              : _unlockWithBiometric,
                          icon: const Icon(
                            Icons.fingerprint_rounded,
                            color: Colors.white,
                          ),
                          label: const Text(
                            'الدخول بالبصمة / Face ID',
                            style: TextStyle(color: Colors.white),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.28),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ],
                      const Spacer(),
                      Text(
                        'الرمز محفوظ مشفَّرًا على هذا الجهاز وتتم مزامنته مع الخادم عند تسجيل الدخول. '
                        'التحقق على الخادم هو الحدود الحقيقي؛ الحماية المحلية تمنع الطفل من فتح المنطقة دون اتصال.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.42), fontSize: 10, height: 1.5),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class _PinField extends StatelessWidget {
  const _PinField({
    required this.controller,
    required this.obscure,
    required this.enabled,
    required this.hintText,
    required this.onToggleObscure,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final bool obscure;
  final bool enabled;
  final String hintText;
  final VoidCallback onToggleObscure;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      obscureText: obscure,
      enabled: enabled,
      keyboardType: TextInputType.number,
      textAlign: TextAlign.center,
      maxLength: ParentPinStore.maxPinLength,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
      onSubmitted: onSubmitted,
      style: const TextStyle(color: Colors.white, fontSize: 22, letterSpacing: 8, fontWeight: FontWeight.w800),
      decoration: InputDecoration(
        counterText: '',
        hintText: hintText,
        hintStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.32), letterSpacing: 8, fontSize: 16),
        filled: true,
        fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        suffixIcon: IconButton(
          icon: Icon(obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: AppColors.mutedText),
          tooltip: obscure ? 'إظهار الرمز' : 'إخفاء الرمز',
          onPressed: onToggleObscure,
        ),
      ),
    );
  }
}
