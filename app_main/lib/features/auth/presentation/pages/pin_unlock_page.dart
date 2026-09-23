import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/security/biometric_auth.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/parent_pin_store.dart';

/// Fetch-only screen for the parental gate (Requirement 11.2).
///
/// Split out of the former `parent_pin_page.dart`. This page never offers
/// enrolment — see `pin_setup_page.dart` for that. If a verify call ever
/// comes back 404 "no PIN has been set" (the server, not this screen, is
/// the only authority on enrolment state), this screen navigates to
/// `/parent-pin` with `hasPin()` re-checked so `_PinGatePage` routes to
/// setup, instead of flipping local state the old single-file version did.
///
/// ## Biometric scope on this screen — re-arm only, never a fresh grant
///
/// Requirement 11.5 asks this screen to try biometrics before falling back
/// to PIN entry. `BiometricAuthenticator` and `ParentPinStore` both document
/// that a successful biometric check proves only device-owner presence: it
/// can unlock a *local* gate, but it can never mint, extend, or substitute
/// a server authorization (see `biometric_auth.dart`, `parent_pin_store.dart`).
///
/// `ParentPinStore` only ever persists a salted PBKDF2 verifier — it cannot
/// recover the plaintext PIN, so there is no PIN a biometric success could
/// hand to `MajarraApiClient.verifyParentPin` for a fresh server round-trip.
/// Requirement 11 also explicitly forbids adding new server API surface for
/// this task (`change_parent_pin`/`setParentPin`/`verifyParentPin`/
/// `authorizeParentAction` stay untouched).
///
/// Given that boundary, the only safe, narrow behaviour is: on entry, if
/// `AuthGuard.hasParentAccess` is already `true` (a live, still-valid
/// `parent_proof` from earlier in this session — e.g. the app backgrounded
/// and resumed, or another `parentVerified` route re-triggered the guard
/// while a grant was still live) *and* biometrics are enrolled and enabled,
/// this screen asks for a biometric confirmation and, on success, simply
/// re-affirms that existing grant by navigating to the return target — it
/// does not call `grantParentAccess` again and never contacts the server.
/// When there is no live proof to re-arm (the common case: PIN version 1
/// unlock, or the previous proof already expired), biometrics are skipped
/// entirely and the screen falls straight to PIN entry — minting a brand
/// new grant from a fingerprint alone, with no server call, would reopen
/// exactly the fail-open gap `parent_pin_fail_closed_test.dart` locks down.
class PinUnlockPage extends ConsumerStatefulWidget {
  const PinUnlockPage({this.returnTo, super.key});

  final String? returnTo;

  @override
  ConsumerState<PinUnlockPage> createState() => _PinUnlockPageState();
}

class _PinUnlockPageState extends ConsumerState<PinUnlockPage> {
  final _pin = TextEditingController();
  ParentPinStore get _store => ref.read(parentPinStoreProvider);

  bool _obscure = true;
  bool _busy = false;
  bool _biometricChecking = false;
  String? _error;
  DateTime? _lockedUntil;

  @override
  void initState() {
    super.initState();
    // Fire-and-forget: a biometric re-arm attempt never blocks PIN entry from
    // being usable immediately, it just runs ahead of it opportunistically.
    // ignore: unawaited_futures
    _tryBiometricReArm();
  }

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
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

  void _navigateToReturnTarget() {
    if (!mounted) return;
    if (widget.returnTo == '/my-collection' && context.canPop()) {
      context.pop(true);
    } else {
      context.go(_returnTarget);
    }
  }

  /// Re-affirms an already-live `parent_proof` after a fresh biometric
  /// check, without contacting the server. See the class doc comment for
  /// why this never mints a new grant. No-ops silently on any failure or
  /// unavailability — the PIN field below always remains the fallback.
  Future<void> _tryBiometricReArm() async {
    final guard = ref.read(authGuardProvider);
    if (!guard.hasParentAccess) return; // Nothing live to re-arm.

    bool enabled;
    BiometricAvailability availability;
    try {
      enabled = await _store.isBiometricEnabled();
      availability = await ref.read(biometricAuthenticatorProvider).availability();
    } catch (_) {
      return;
    }
    if (!enabled || availability != BiometricAvailability.available) return;
    if (!mounted) return;

    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() => _biometricChecking = true);
    bool ok;
    try {
      ok = await ref
          .read(biometricAuthenticatorProvider)
          .authenticate(localizedReason: l10n.enterParentPin);
    } catch (_) {
      ok = false;
    }
    if (!mounted) return;
    setState(() => _biometricChecking = false);
    // Re-check liveness: the proof may have expired during the biometric
    // prompt (it can take several seconds of user interaction).
    if (ok && guard.hasParentAccess) {
      _navigateToReturnTarget();
    }
  }

  bool _completeUnlock(Map<String, dynamic> envelope) {
    final data = envelope['data'] is Map ? envelope['data'] as Map : envelope;
    final proof = data['parent_proof'] as String?;
    final expiresAtValue = data['expires_at'] as String?;
    final issuedAtValue = data['issued_at'] as String?;

    DateTime? expiresAt = expiresAtValue != null ? DateTime.tryParse(expiresAtValue) : null;
    // Fallback: if server clock is far ahead (e.g. DO fake time 2026) or parse fails,
    // use issued_at + 15m or now + 15m so grant never fails due to clock skew.
    if (expiresAt == null) {
      final issued = issuedAtValue != null ? DateTime.tryParse(issuedAtValue) : null;
      if (issued != null) {
        expiresAt = issued.add(const Duration(minutes: 15));
      } else {
        expiresAt = DateTime.now().add(const Duration(minutes: 15));
      }
    }

    if (proof == null || proof.isEmpty) return false;

    final guard = ref.read(authGuardProvider);
    final granted = guard.grantParentAccess(proof: proof, expiresAt: expiresAt);

    // Even if grant says false due to transient auth state, still navigate –
    // the router will re-check hasParentAccess and show PIN again if truly invalid.
    // This prevents the "hang" where UI stays on PIN with no error.
    if (mounted) {
      if (granted) {
        _navigateToReturnTarget();
      } else {
        // Force a second attempt: sometimes guard.isRealAuthenticated flips between
        // reads (secure storage async). Copy proof directly for one navigation.
        if (proof.isNotEmpty) {
          // Small delay to let guard notify listeners
          Future.microtask(() {
            if (!mounted) return;
            if (guard.hasParentAccess) {
              _navigateToReturnTarget();
            } else {
              // Grant failed – show explicit error instead of hanging
              final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
              setState(() => _error = l10n.pinGrantFailedRetry);
            }
          });
        }
      }
    }
    return granted;
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _error = null;
    });

    final guard = ref.read(authGuardProvider);
    if (!guard.isRealAuthenticated) {
      if (mounted) {
        setState(() => _error = l10n.sessionExpiredShort);
      }
      return;
    }

    final pin = _pin.text;
    if (pin.isEmpty) {
      setState(() => _error = l10n.pinEmpty);
      return;
    }

    if (guard.hasParentAccess) {
      _navigateToReturnTarget();
      return;
    }

    setState(() => _busy = true);
    try {
      final response = await ref.read(majarraApiClientProvider).verifyParentPin(pin: pin);
      if (!mounted) return;

      // نوقف المؤشّر وننتقل قبل الكتابة المحلية، لا لأنها ثقيلة — صارت تجري
      // عبر `PinKdf.deriveVerifierAsync` خارج خيط الواجهة — بل لأن الانتقال
      // لا يعتمد عليها أصلًا: الخادم هو المرجع، والمخزن المحلي مرآةٌ لقفل
      // الطفل. فلا معنى لجعل المستخدم ينتظرها.
      final enteredPin = pin;
      setState(() => _busy = false);
      _pin.clear();
      final ok = _completeUnlock(response);
      if (!ok && mounted) {
        setState(() => _error = l10n.serverErrorGeneric);
      }
      // ignore: unawaited_futures
      _store.setPin(enteredPin, ownerId: guard.parentId).catchError((_) {});
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      final msg = e.message;
      if (msg.contains('423') || msg.contains('Too many attempts') || msg.contains('locked_until')) {
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
        // The server, not this screen, is authoritative on enrolment state.
        // Route to `/parent-pin` with the server's answer carried in `stage`
        // so `_PinGatePage` lands on setup.
        //
        // كان يعود بلا مُعامِل، فيُعيد المُوزِّع سؤال `ParentPinStore.hasPin()`
        // — وهو من قال «يوجد رمز» فأوصلَنا إلى هنا — فيُعيد بناء هذه الصفحة
        // نفسها ويُعاد 404: حلقة لا تطبيبٌ ذاتي. و`stage=setup` يكسرها.
        setState(() => _busy = false);
        context.go(Uri(path: '/parent-pin', queryParameters: {
          if (widget.returnTo != null) 'from': widget.returnTo,
          'stage': 'setup',
        }).toString());
        return;
      }
      if (msg.contains('401') || msg.contains('Unauthorized')) {
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
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _biometricChecking
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(color: AppColors.starGold),
                        const SizedBox(height: 16),
                        Text(
                          l10n.pinUnlockingWithBiometric,
                          style: TextStyle(
                            color: AppColors.mutedText.withValues(alpha: 0.72),
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  )
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
                        l10n.parentArea,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.enterParentPin,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.72),
                          fontSize: 12,
                        ),
                      ),
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
                                  l10n.enter,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        l10n.pinServerVerificationFooter,
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
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
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
          tooltip: obscure ? l10n.pinToggleShow : l10n.pinToggleHide,
          onPressed: onToggleObscure,
        ),
      ),
    );
  }
}
