import 'package:flutter_riverpod/flutter_riverpod.dart';
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
/// ## Server boundary
///
/// This verifier is only a convenience for child-facing locks. Parental API
/// actions use a separate, signed `parent_proof` issued after the server verifies
/// the PIN. That proof is bound to the family session, auth epoch, PIN version,
/// purpose and expiry; destructive-purpose JTIs are consumed once by
/// `FamilyState`. Flutter keeps it in memory only and clears it on background,
/// logout, refresh failure and PIN change.
class ParentPinStore {
  ParentPinStore({FlutterSecureStorage? storage})
    : _store = storage ?? const FlutterSecureStorage();

  static const _ownerKey = 'majarra_parent_pin_owner';
  static const _saltKey = 'majarra_parent_pin_salt';
  static const _verifierKey = 'majarra_parent_pin_verifier';
  static const _failuresKey = 'majarra_parent_pin_failures';
  static const _lockedUntilKey = 'majarra_parent_pin_locked_until';
  static const _biometricKey = 'majarra_parent_biometric_enabled';

  static const minPinLength = PinKdf.minPinLength;
  static const maxPinLength = PinKdf.maxPinLength;
  static const maxAttemptsBeforeLockout = 5;
  static const lockoutDuration = Duration(minutes: 15);

  final FlutterSecureStorage _store;

  /// Returns an Arabic description of why [pin] is unacceptable, or null when
  /// the PIN satisfies policy.
  static String? validatePin(String pin) => PinKdf.validatePin(pin);

  Future<bool> hasPin({String? ownerId}) async {
    final verifier = await _store.read(key: _verifierKey);
    final salt = await _store.read(key: _saltKey);
    final owner = await _store.read(key: _ownerKey);
    final ownerMatches =
        ownerId == null ||
        ownerId.isEmpty ||
        (owner != null && owner == ownerId);
    return ownerMatches &&
        verifier != null &&
        verifier.isNotEmpty &&
        salt != null &&
        salt.isNotEmpty;
  }

  /// Enrols [pin]. Throws [ArgumentError] when the PIN fails policy so callers
  /// cannot silently persist a weak value.
  Future<void> setPin(String pin, {String? ownerId}) async {
    final problem = validatePin(pin);
    if (problem != null) throw ArgumentError(problem);

    final salt = PinKdf.randomSalt();
    final verifier = PinKdf.deriveVerifier(pin, salt);

    if (ownerId != null && ownerId.isNotEmpty) {
      await _store.write(key: _ownerKey, value: ownerId);
    }
    await _store.write(key: _saltKey, value: PinKdf.toHex(salt));
    await _store.write(key: _verifierKey, value: PinKdf.toHex(verifier));
    await _store.delete(key: _failuresKey);
    await _store.delete(key: _lockedUntilKey);
  }

  Future<ParentPinVerification> verify(String pin, {String? ownerId}) async {
    if (ownerId != null && ownerId.isNotEmpty) {
      final owner = await _store.read(key: _ownerKey);
      if (owner != ownerId) {
        return const ParentPinVerification(ParentPinResult.notEnrolled);
      }
    }
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

  /// Whether the parent opted in to unlocking the local gate with biometrics.
  ///
  /// Opt-in is only offered after a successful PIN verification, so enabling
  /// this can never bypass the initial proof that the parent knows the PIN.
  Future<bool> isBiometricEnabled() async {
    return (await _store.read(key: _biometricKey)) == 'true';
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    if (enabled) {
      await _store.write(key: _biometricKey, value: 'true');
    } else {
      await _store.delete(key: _biometricKey);
    }
  }

  /// Removes the enrolled PIN. Must be called on sign-out so a PIN from one
  /// account can never unlock another account's parent area.
  Future<void> clear() async {
    await _store.delete(key: _ownerKey);
    await _store.delete(key: _saltKey);
    await _store.delete(key: _verifierKey);
    await _store.delete(key: _failuresKey);
    await _store.delete(key: _lockedUntilKey);
    // The biometric opt-in is tied to the enrolled PIN: clearing one must clear
    // the other, or a new account's PIN could be unlocked by the old opt-in.
    await _store.delete(key: _biometricKey);
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

/// Injectable so sign-out teardown can be exercised without a Keychain.
final parentPinStoreProvider = Provider<ParentPinStore>(
  (ref) => ParentPinStore(),
);
