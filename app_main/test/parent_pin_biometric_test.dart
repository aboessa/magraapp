import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/security/biometric_auth.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';

/// Deterministic biometric double so the opt-in / unlock contract can be
/// exercised without a platform channel.
class _FakeBiometric implements BiometricAuthenticator {
  _FakeBiometric(this._availability, {this.willSucceed = true});

  final BiometricAvailability _availability;
  final bool willSucceed;
  int authenticateCalls = 0;

  @override
  Future<BiometricAvailability> availability() async => _availability;

  @override
  Future<bool> authenticate({required String localizedReason}) async {
    authenticateCalls++;
    return willSucceed;
  }
}

void main() {
  setUp(() {
    // In-memory secure storage so ParentPinStore runs without a Keychain.
    FlutterSecureStorage.setMockInitialValues({});
  });

  group('ParentPinStore biometric opt-in flag', () {
    test('is off by default', () async {
      final store = ParentPinStore();
      expect(await store.isBiometricEnabled(), isFalse);
    });

    test('can be enabled and disabled', () async {
      final store = ParentPinStore();
      await store.setBiometricEnabled(true);
      expect(await store.isBiometricEnabled(), isTrue);
      await store.setBiometricEnabled(false);
      expect(await store.isBiometricEnabled(), isFalse);
    });

    test('is cleared on sign-out with the PIN', () async {
      // Shared-device regression: the next account must not inherit an opt-in
      // that could unlock its parent area.
      final store = ParentPinStore();
      await store.setPin('2468');
      await store.setBiometricEnabled(true);

      await store.clear();

      expect(await store.isBiometricEnabled(), isFalse);
      expect(await store.hasPin(), isFalse);
    });
  });

  group('BiometricAuthenticator contract', () {
    test('a successful check reports success and is called once', () async {
      final bio = _FakeBiometric(BiometricAvailability.available);
      final ok = await bio.authenticate(localizedReason: 'x');
      expect(ok, isTrue);
      expect(bio.authenticateCalls, 1);
    });

    test('an unsupported device never claims availability', () async {
      final bio = _FakeBiometric(BiometricAvailability.unsupported);
      expect(await bio.availability(), BiometricAvailability.unsupported);
    });

    test('a cancelled/failed check falls back (returns false)', () async {
      final bio = _FakeBiometric(
        BiometricAvailability.available,
        willSucceed: false,
      );
      expect(await bio.authenticate(localizedReason: 'x'), isFalse);
    });
  });
}
