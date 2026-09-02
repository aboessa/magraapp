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

/// First-time enrolment screen for the parental gate (Requirement 11.1).
///
/// Split out of the former `parent_pin_page.dart`, which served both
/// enrolment and unlock through a single `_isEnrolling` branch. This page
/// keeps only the enrolment half: PIN + confirmation, no
/// `expected_pin_version` on the request (`MajarraApiClient.setParentPin`
/// omits it for a first enrolment — a value is only sent for an
/// authorized change, which this screen never performs). See
/// `pin_unlock_page.dart` for the fetch-only counterpart.
///
/// Reached from `_PinGatePage` in `app_router.dart` when
/// `ParentPinStore.hasPin()` says no PIN is mirrored locally for this
/// owner yet. That is a fast local heuristic, not a server fact — the
/// server is the only authority on whether a PIN actually exists. If a
/// submit here comes back 403 "a current parent proof is required to
/// change the PIN" (i.e. the server already has one and the heuristic
/// guessed wrong, e.g. a fresh install signing back into an account with
/// PIN history), this screen self-heals by navigating to
/// `pin_unlock_page.dart` instead of trying to force an enrolment the
/// server will never accept without a `change_parent_pin` proof.
class PinSetupPage extends ConsumerStatefulWidget {
  const PinSetupPage({this.returnTo, this.onComplete, super.key});

  final String? returnTo;

  /// When non-null, called instead of the `context.go`/`context.pop`
  /// navigation inside `_completeUnlock` once the PIN is enrolled and the
  /// resulting proof has been granted. Lets a hosting flow
  /// (`OnboardingFlowPage`, Requirement 8.2) treat this page as a step that
  /// reports completion outward, rather than always navigating on its own.
  /// `null` (the default) preserves the original standalone behaviour used
  /// by the `/parent-pin` dispatcher.
  final VoidCallback? onComplete;

  @override
  ConsumerState<PinSetupPage> createState() => _PinSetupPageState();
}

class _PinSetupPageState extends ConsumerState<PinSetupPage> {
  final _pin = TextEditingController();
  final _confirmPin = TextEditingController();
  ParentPinStore get _store => ref.read(parentPinStoreProvider);

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    _confirmPin.dispose();
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
        if (widget.onComplete != null) {
          widget.onComplete!();
        } else if (widget.returnTo == '/my-collection' && context.canPop()) {
          context.pop(true);
        } else {
          context.go(_returnTarget);
        }
      } else {
        // Force a second attempt: sometimes guard.isRealAuthenticated flips between
        // reads (secure storage async). Copy proof directly for one navigation.
        if (proof.isNotEmpty) {
          // Small delay to let guard notify listeners
          Future.microtask(() {
            if (!mounted) return;
            if (guard.hasParentAccess) {
              if (widget.onComplete != null) {
                widget.onComplete!();
              } else {
                context.go(_returnTarget);
              }
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
      final response = await ref.read(majarraApiClientProvider).setParentPin(pin: pin);
      if (!mounted) return;
      // Navigate immediately – local PBKDF2 KDF is pure Dart 100k iterations and
      // blocks the UI thread for seconds on web. Server proof is the real gate;
      // local store is only a child-lock convenience, so persist it in background.
      setState(() {
        _busy = false;
      });
      _pin.clear();
      _confirmPin.clear();
      final ok = _completeUnlock(response);
      if (!ok && mounted) {
        setState(() => _error = l10n.serverErrorGeneric);
      }
      // Background – do not await before navigation
      // ignore: unawaited_futures
      _store.setPin(pin, ownerId: guard.parentId).catchError((_) {});
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      if (e.message.contains('403')) {
        // The local heuristic that routed us here (`ParentPinStore.hasPin()`)
        // guessed wrong: the server already has a PIN for this family and
        // refused enrolment without a `change_parent_pin` proof. Self-heal by
        // sending the user to the unlock screen instead of showing an error
        // for a state this screen cannot fix.
        setState(() => _busy = false);
        context.go(Uri(path: '/parent-pin', queryParameters: {
          if (widget.returnTo != null) 'from': widget.returnTo,
        }).toString());
        return;
      }
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

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
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
                  l10n.createParentPin,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  l10n.pinRangeHint(
                    ParentPinStore.minPinLength,
                    ParentPinStore.maxPinLength,
                  ),
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
                  enabled: !_busy,
                  hintText: '••••',
                  onToggleObscure: () => setState(() => _obscure = !_obscure),
                  onSubmitted: (_) => _submit(),
                ),
                const SizedBox(height: 12),
                _PinField(
                  controller: _confirmPin,
                  obscure: _obscure,
                  enabled: !_busy,
                  hintText: l10n.pinConfirmLabel,
                  onToggleObscure: () => setState(() => _obscure = !_obscure),
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
                    onPressed: _busy ? null : _submit,
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
                            l10n.savePin,
                            style: const TextStyle(fontWeight: FontWeight.w800),
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
