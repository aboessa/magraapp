import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/parent_pin_store.dart';

/// Gate for the parental area.
///
/// Unlocking requires a short-lived proof signed by the API and bound to the
/// current parent session and PIN version. The proof remains only in [AuthGuard]
/// memory and is cleared on backgrounding, logout, expiry and PIN changes.
class ParentPinPage extends ConsumerStatefulWidget {
  const ParentPinPage({this.returnTo, super.key});

  final String? returnTo;

  @override
  ConsumerState<ParentPinPage> createState() => _ParentPinPageState();
}

class _ParentPinPageState extends ConsumerState<ParentPinPage> {
  final _pin = TextEditingController();
  final _confirmPin = TextEditingController();
  ParentPinStore get _store => ref.read(parentPinStoreProvider);

  bool _obscure = true;
  bool _loading = true;
  bool _busy = false;
  bool _isEnrolling = false;
  String? _error;
  String? _notice;
  DateTime? _lockedUntil;

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

  void _loadEnrolmentState() {
    // A local verifier cannot tell us whether the family has a server PIN. The
    // first authenticated verify call is authoritative; only its explicit 404
    // opens enrolment.
    _isEnrolling = false;
    _loading = false;
  }

  static const _allowedReturnTargets = {
    '/parent',
    '/account',
    '/devices',
    '/membership',
    '/settings',
    '/my-collection',
  };

  String get _returnTarget => _allowedReturnTargets.contains(widget.returnTo)
      ? widget.returnTo!
      : '/parent';

  bool _completeUnlock(Map<String, dynamic> envelope) {
    final data = envelope['data'];
    final proof = data is Map ? data['parent_proof'] : null;
    final expiresAtValue = data is Map ? data['expires_at'] : null;
    final expiresAt = expiresAtValue is String
        ? DateTime.tryParse(expiresAtValue)
        : null;
    if (proof is! String || proof.isEmpty || expiresAt == null) return false;

    final granted = ref
        .read(authGuardProvider)
        .grantParentAccess(proof: proof, expiresAt: expiresAt);
    if (granted && mounted) {
      if (widget.returnTo == '/my-collection' && context.canPop()) {
        context.pop(true);
      } else {
        context.go(_returnTarget);
      }
    }
    return granted;
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _error = null;
      _notice = null;
    });

    final guard = ref.read(authGuardProvider);
    if (!guard.isRealAuthenticated) {
      if (mounted) {
        setState(() => _error = l10n.sessionExpiredShort);
      }
      return;
    }

    // Do not pre-emptively reject a missing access token here: the API client
    // can use the retained refresh token after the initial 401. Session teardown
    // remains exclusively owned by the refresh endpoint's definitive 401.
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
      try {
        final response = await ref
            .read(majarraApiClientProvider)
            .setParentPin(pin: pin);
        try {
          await _store.setPin(pin, ownerId: guard.parentId);
        } catch (_) {
          // Local verifier is only a child-lock convenience; the signed server
          // proof remains the parental authorization boundary.
        }
        if (!mounted) return;
        setState(() => _busy = false);
        _pin.clear();
        _confirmPin.clear();
        if (!_completeUnlock(response) && mounted) {
          setState(() => _error = l10n.serverErrorGeneric);
        }
      } on MajarraApiException catch (e) {
        if (!mounted) return;
        setState(() {
          _busy = false;
          _error = _userFacing(e.message);
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _busy = false;
          _error = l10n.serverErrorGeneric;
        });
      }
      return;
    }

    if (pin.isEmpty) {
      setState(() => _error = l10n.pinEmpty);
      return;
    }

    setState(() => _busy = true);
    try {
      final response = await ref
          .read(majarraApiClientProvider)
          .verifyParentPin(pin: pin);
      try {
        await _store.setPin(pin, ownerId: guard.parentId);
      } catch (_) {
        // Parent access still succeeds without a local child-lock verifier.
      }
      if (!mounted) return;
      setState(() => _busy = false);
      _pin.clear();
      if (!_completeUnlock(response) && mounted) {
        setState(() => _error = l10n.serverErrorGeneric);
      }
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      final msg = e.message;
      if (msg.contains('423') ||
          msg.contains('Too many attempts') ||
          msg.contains('locked_until')) {
        _pin.clear();
        setState(() {
          _busy = false;
          _lockedUntil = DateTime.now().add(ParentPinStore.lockoutDuration);
          _error = l10n.pinLockedOut(_remainingLockoutLabel(l10n));
        });
        return;
      }
      if (msg.contains('403') || msg.contains('Incorrect PIN')) {
        _pin.clear();
        setState(() {
          _busy = false;
          _error = l10n.pinIncorrect;
        });
        return;
      }
      if (msg.contains('404') || msg.contains('No PIN')) {
        setState(() {
          _busy = false;
          _isEnrolling = true;
          _notice = l10n.pinNotEnrolledYet;
        });
        return;
      }
      if (msg.contains('401') || msg.contains('Unauthorized')) {
        // Session teardown is owned exclusively by MajarraApiClient when the
        // refresh endpoint itself returns 401. The original request can be 401
        // while refresh is temporarily 5xx/offline, so this page must not wipe.
        setState(() {
          _busy = false;
          _error = l10n.serverErrorGeneric;
        });
        return;
      }
      setState(() {
        _busy = false;
        _error = _userFacing(msg);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = l10n.serverErrorGeneric;
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
                          icon: const Icon(
                            Icons.arrow_forward_rounded,
                            color: Colors.white,
                          ),
                          onPressed: () => context.pop(),
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.lock_rounded,
                        color: AppColors.starGold,
                        size: 48,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _isEnrolling ? 'أنشئ رمز ولي الأمر' : 'منطقة ولي الأمر',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _isEnrolling
                            ? 'اختر رمزًا من ${ParentPinStore.minPinLength} إلى ${ParentPinStore.maxPinLength} أرقام يعرفه ولي الأمر فقط'
                            : 'أدخل رمز ولي الأمر',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.72),
                          fontSize: 12,
                        ),
                      ),
                      if (_notice != null) ...[
                        const SizedBox(height: 10),
                        Text(
                          _notice!,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: AppColors.starGold,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      _PinField(
                        controller: _pin,
                        obscure: _obscure,
                        enabled: !_isLockedOut && !_busy,
                        hintText: '••••',
                        onToggleObscure: () =>
                            setState(() => _obscure = !_obscure),
                        onSubmitted: (_) => _submit(),
                      ),
                      if (_isEnrolling) ...[
                        const SizedBox(height: 12),
                        _PinField(
                          controller: _confirmPin,
                          obscure: _obscure,
                          enabled: !_busy,
                          hintText: 'تأكيد الرمز',
                          onToggleObscure: () =>
                              setState(() => _obscure = !_obscure),
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
                              const Icon(
                                Icons.error_outline_rounded,
                                color: AppColors.danger,
                                size: 16,
                              ),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  _error!,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
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
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: _busy
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.deepSpace,
                                  ),
                                )
                              : Text(
                                  _isEnrolling ? 'حفظ الرمز' : 'دخول',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        'يُتحقَّق من الرمز على الخادم، ويُحفظ إثبات الوصول الموقّع في الذاكرة فقط لمدة قصيرة. '
                        'يُمسح الإثبات عند إغلاق الجلسة أو انتقال التطبيق إلى الخلفية.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.42),
                          fontSize: 10,
                          height: 1.5,
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
      style: const TextStyle(
        color: Colors.white,
        fontSize: 22,
        letterSpacing: 8,
        fontWeight: FontWeight.w800,
      ),
      decoration: InputDecoration(
        counterText: '',
        hintText: hintText,
        hintStyle: TextStyle(
          color: AppColors.mutedText.withValues(alpha: 0.32),
          letterSpacing: 8,
          fontSize: 16,
        ),
        filled: true,
        fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded,
            color: AppColors.mutedText,
          ),
          tooltip: obscure ? 'إظهار الرمز' : 'إخفاء الرمز',
          onPressed: onToggleObscure,
        ),
      ),
    );
  }
}
