import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/features/tv/data/tv_session_origin.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// TV-005: the parent PIN must not be asked again because the device clock is off.
void main() {
  test(
    'a server grant lasts its duration even when the device clock is far off',
    () {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);
      // The server issued a 15-minute proof "an hour ago" by this device's clock
      // (i.e. the TV runs an hour fast). Comparing absolute times would reject it.
      final serverIssued = DateTime.now().subtract(const Duration(hours: 1));
      final granted = guard.grantParentAccess(
        proof: 'proof',
        expiresAt: serverIssued.add(const Duration(minutes: 15)),
        issuedAt: serverIssued,
      );
      expect(granted, isTrue);
      expect(guard.hasParentAccess, isTrue);
      guard.revokeParentAccess();
    },
  );

  test('without issued_at the absolute expiry still applies', () {
    final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
    addTearDown(guard.dispose);
    final ok = guard.grantParentAccess(
      proof: 'proof',
      expiresAt: DateTime.now().subtract(const Duration(minutes: 1)),
    );
    expect(ok, isFalse);
  });

  test(
    'a TV session is known only after pairing or the email fallback recorded it',
    () async {
      SharedPreferences.setMockInitialValues({});
      expect(
        await TvSessionOrigin.isKnown(),
        isFalse,
        reason: 'an old session from before pairing',
      );
      await TvSessionOrigin.record(TvSessionOrigin.pairing);
      expect(await TvSessionOrigin.isKnown(), isTrue);
      await TvSessionOrigin.clear();
      await TvSessionOrigin.record(TvSessionOrigin.email);
      expect(await TvSessionOrigin.isKnown(), isTrue);
    },
  );
}
