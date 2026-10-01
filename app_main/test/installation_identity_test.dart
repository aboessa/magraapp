import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/auth/data/installation_identity.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// TV-004: a reinstalled TV must be the same device, not a new one on the plan.
void main() {
  test('the same platform seed gives the same id after a reinstall', () async {
    SharedPreferences.setMockInitialValues({});
    final first = await InstallationIdentityStore(
      seed: () async => 'a1b2c3d4e5f60718',
    ).getOrCreate();
    // Reinstall: app storage is wiped, the seed is not.
    SharedPreferences.setMockInitialValues({});
    final second = await InstallationIdentityStore(
      seed: () async => 'a1b2c3d4e5f60718',
    ).getOrCreate();
    expect(second, first);
    expect(
      first,
      isNot(contains('a1b2c3d4e5f60718')),
      reason: 'the raw seed never leaves the device',
    );
    expect(
      first,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
  });

  test(
    'an id already stored is kept, so existing installs are not new devices',
    () async {
      SharedPreferences.setMockInitialValues({
        'majarra_installation_id': 'existing-installation-0001',
      });
      final id = await InstallationIdentityStore(
        seed: () async => 'a1b2c3d4e5f60718',
      ).getOrCreate();
      expect(id, 'existing-installation-0001');
    },
  );

  test('without a seed the id is random', () async {
    SharedPreferences.setMockInitialValues({});
    final a = await InstallationIdentityStore(
      seed: () async => null,
    ).getOrCreate();
    SharedPreferences.setMockInitialValues({});
    final b = await InstallationIdentityStore(
      seed: () async => null,
    ).getOrCreate();
    expect(a, isNot(b));
  });
}
