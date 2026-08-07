import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'pin_kdf.dart';

/// Outcome of a parent PIN verification attempt.
enum ParentPinResult {
  /// The PIN matched the stored verifier.
  success,

  /// The PIN did not match. [ParentPinVerification.attemptsRemaining] tells the
  /// caller how many tries are left before a lockout begins.
  wrongPin,

  /// Too many consecutive failures. Retry after
  /// [ParentPinVerification.lockedUntil].
  lockedOut,

  /// No PIN has been enrolled on this device yet.
  notEnrolled,
}

class ParentPinVerification {
  const ParentPinVerification(
    this.result, {
    this.attemptsRemaining = 0,
    this.lockedUntil,
  });

  final ParentPinResult result;
  final int attemptsRemaining;
  final DateTime? lockedUntil;

  bool get isSuccess => result == ParentPinResult.success;
}

/// Local-only parent PIN gate.
///
/// ## Why this exists and what it is *not*
///
/// The product documentation (`التصاريح والادوار والمستخدمين .md`) requires the
/// parent gate to be verified **server side**, and the Majarra API has no PIN
/// endpoint and no PIN column today — verified against every route in
/// `dashboard/api/src`. Until that exists, this class provides the strongest
/// behaviour achievable on the client alone:
///
/// * The PIN is never stored. Only a PBKDF2-HMAC-SHA256 verifier and a random
///   per-device salt are persisted, inside `flutter_secure_storage`
///   (Keychain / EncryptedSharedPreferences).
/// * Comparison is constant time, so a wrong PIN leaks no timing information.
/// * Consecutive failures are rate limited with a lockout, which is the only
///   meaningful brake on guessing a 4–6 digit secret.
///
/// ## Honest limitation — do not treat this as a security boundary
///
/// A 4–6 digit PIN has at most 10^6 possibilities. Anyone who can read this
/// device's secure storage can brute force the verifier offline regardless of
/// iteration count. This gate stops a **child** wandering into the parent area.
/// It does not stop an attacker, and it must not gate entitlements, billing,
/// content permissions, or any decision with a server-side consequence.
///
/// ## Required backend work before this can be trusted
///
/// See `AUDIT_FLUTTER_APP.md` §9 C2. The API must add:
///  1. A hashed PIN column on the family/identity record (`IdentityState` DO).
///  2. `POST /api/v1/family/parent-pin`        — enrol / change (auth required).
///  3. `POST /api/v1/family/parent-pin/verify` — verify, server-side rate
///     limited and lockout-tracked, returning a short-lived parental-area scope.
///  4. Every parental-area mutation must re-check that scope. The client must
///     never be the sole authority.
class ParentPinStore {
  ParentPinStore({FlutterSecureStorage? storage})
    : _store = storage ?? const FlutterSecureStorage();

  static const _saltKey = 'majarra_parent_pin_salt';
  static const _verifierKey = 'majarra_parent_pin_verifier';
  static const _failuresKey = 'majarra_parent_pin_failures';
  static const _lockedUntilKey = 'majarra_parent_pin_locked_until';

  static const minPinLength = PinKdf.minPinLength;
  static const maxPinLength = PinKdf.maxPinLength;
  static const maxAttemptsBeforeLockout = 5;
  static const lockoutDuration = Duration(minutes: 15);

  final FlutterSecureStorage _store;

  /// Returns an Arabic description of why [pin] is unacceptable, or null when
  /// the PIN satisfies policy.
  static String? validatePin(String pin) => PinKdf.validatePin(pin);

  Future<bool> hasPin() async {
    final verifier = await _store.read(key: _verifierKey);
    final salt = await _store.read(key: _saltKey);
    return verifier != null &&
        verifier.isNotEmpty &&
        salt != null &&
        salt.isNotEmpty;
  }

  /// Enrols [pin]. Throws [ArgumentError] when the PIN fails policy so callers
  /// cannot silently persist a weak value.
  Future<void> setPin(String pin) async {
    final problem = validatePin(pin);
    if (problem != null) throw ArgumentError(problem);

    final salt = PinKdf.randomSalt();
    final verifier = PinKdf.deriveVerifier(pin, salt);

    await _store.write(key: _saltKey, value: PinKdf.toHex(salt));
    await _store.write(key: _verifierKey, value: PinKdf.toHex(verifier));
    await _store.delete(key: _failuresKey);
    await _store.delete(key: _lockedUntilKey);
  }

  Future<ParentPinVerification> verify(String pin) async {
    final lockedUntil = await _lockedUntil();
    if (lockedUntil != null) {
      return ParentPinVerification(
        ParentPinResult.lockedOut,
        lockedUntil: lockedUntil,
      );
    }

    final saltHex = await _store.read(key: _saltKey);
    final verifierHex = await _store.read(key: _verifierKey);
    if (saltHex == null || verifierHex == null) {
      return const ParentPinVerification(ParentPinResult.notEnrolled);
    }

    final expected = PinKdf.fromHex(verifierHex);
    final actual = PinKdf.deriveVerifier(pin, PinKdf.fromHex(saltHex));

    if (PinKdf.constantTimeEquals(expected, actual)) {
      await _store.delete(key: _failuresKey);
      await _store.delete(key: _lockedUntilKey);
      return const ParentPinVerification(ParentPinResult.success);
    }

    final failures =
        (int.tryParse(await _store.read(key: _failuresKey) ?? '') ?? 0) + 1;
    if (failures >= maxAttemptsBeforeLockout) {
      final until = DateTime.now().add(lockoutDuration);
      await _store.write(
        key: _lockedUntilKey,
        value: until.millisecondsSinceEpoch.toString(),
      );
      await _store.delete(key: _failuresKey);
      return ParentPinVerification(
        ParentPinResult.lockedOut,
        lockedUntil: until,
      );
    }

    await _store.write(key: _failuresKey, value: failures.toString());
    return ParentPinVerification(
      ParentPinResult.wrongPin,
      attemptsRemaining: maxAttemptsBeforeLockout - failures,
    );
  }

  /// Removes the enrolled PIN. Must be called on sign-out so a PIN from one
  /// account can never unlock another account's parent area.
  Future<void> clear() async {
    await _store.delete(key: _saltKey);
    await _store.delete(key: _verifierKey);
    await _store.delete(key: _failuresKey);
    await _store.delete(key: _lockedUntilKey);
  }

  Future<DateTime?> _lockedUntil() async {
    final raw = await _store.read(key: _lockedUntilKey);
    if (raw == null) return null;
    final millis = int.tryParse(raw);
    if (millis == null) {
      await _store.delete(key: _lockedUntilKey);
      return null;
    }
    final until = DateTime.fromMillisecondsSinceEpoch(millis);
    if (until.isAfter(DateTime.now())) return until;
    await _store.delete(key: _lockedUntilKey);
    return null;
  }
}
