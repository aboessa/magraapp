import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

/// Whether device biometrics can be used, and if not, why.
enum BiometricAvailability {
  /// Hardware present, enrolled, and usable.
  available,

  /// The device has no biometric hardware or the platform does not support it.
  unsupported,

  /// Hardware present but the user has not enrolled a fingerprint/face, or it
  /// is temporarily locked out after too many attempts.
  notEnrolled,
}

/// Abstraction over device biometric authentication.
///
/// ## Scope — this is a LOCAL convenience, not an authorization authority (§8)
///
/// A successful biometric check proves only that the device owner is present.
/// It unlocks the *local* parent gate so a returning parent need not retype the
/// PIN. It never mints, extends, or substitutes a server authorization: any
/// operation with a server-side consequence still goes through the
/// server-verified parent PIN. Biometrics failing or being unavailable always
/// falls back to the PIN, so the feature can only ever add convenience, never
/// remove a path.
///
/// Defined as an interface so widget tests can inject a deterministic fake
/// without a platform channel (the `local_auth` plugin cannot be driven from a
/// unit test).
abstract interface class BiometricAuthenticator {
  Future<BiometricAvailability> availability();
  Future<bool> authenticate({required String localizedReason});
}

/// Real implementation backed by the `local_auth` plugin.
class LocalAuthBiometric implements BiometricAuthenticator {
  LocalAuthBiometric([LocalAuthentication? auth])
      : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<BiometricAvailability> availability() async {
    try {
      final supported = await _auth.isDeviceSupported();
      if (!supported) return BiometricAvailability.unsupported;
      final canCheck = await _auth.canCheckBiometrics;
      if (!canCheck) return BiometricAvailability.unsupported;
      final enrolled = await _auth.getAvailableBiometrics();
      if (enrolled.isEmpty) return BiometricAvailability.notEnrolled;
      return BiometricAvailability.available;
    } on PlatformException {
      // Any platform error (including a temporary lockout) is treated as "not
      // usable right now" so the caller falls back to the PIN.
      return BiometricAvailability.notEnrolled;
    } on MissingPluginException {
      return BiometricAvailability.unsupported;
    }
  }

  @override
  Future<bool> authenticate({required String localizedReason}) async {
    try {
      return await _auth.authenticate(
        localizedReason: localizedReason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          // A children's app: never let a wandering child dismiss into an
          // unlocked state, and never leave a dangling system dialog.
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }
}

final biometricAuthenticatorProvider = Provider<BiometricAuthenticator>(
  (ref) => LocalAuthBiometric(),
);
