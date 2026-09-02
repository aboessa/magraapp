/// Minimal smoke tests proving `PinSetupPage` and `PinUnlockPage` (task 23)
/// build and render without crashing, ahead of the deeper full-flow
/// integration test in task 24.
///
/// This deliberately does not exercise the network paths (`setParentPin`,
/// `verifyParentPin`) or the biometric re-arm path — those are covered by
/// `parent_pin_fail_closed_test.dart` (AuthGuard properties) and will be
/// covered end-to-end by task 24. Here we only assert each page mounts with
/// its expected static content, matching the "keep this lightweight" scope
/// given for this task.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/app/router/auth_guard.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';
import 'package:majarra/features/auth/presentation/pages/pin_setup_page.dart';
import 'package:majarra/features/auth/presentation/pages/pin_unlock_page.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations.dart';

class _NoopApiClient extends MajarraApiClient {
  _NoopApiClient() : super(http.Client());
}

/// Never reports a PIN as enrolled and never touches secure storage, so the
/// widget under test never needs a real Keychain/EncryptedSharedPreferences
/// plugin.
class _FakeParentPinStore extends ParentPinStore {
  @override
  Future<bool> hasPin({String? ownerId}) async => false;

  @override
  Future<bool> isBiometricEnabled() async => false;
}

Future<void> _pumpPage(WidgetTester tester, Widget page) async {
  final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
  addTearDown(guard.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        majarraApiClientProvider.overrideWithValue(_NoopApiClient()),
        parentPinStoreProvider.overrideWithValue(_FakeParentPinStore()),
        authGuardProvider.overrideWithValue(guard),
      ],
      child: MaterialApp(
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Navigator(
          pages: [
            const MaterialPage(child: Scaffold(body: SizedBox())),
            MaterialPage(child: page),
          ],
          onDidRemovePage: (page) {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('PinSetupPage (Requirement 11.1)', () {
    testWidgets('يُبنى بلا استثناء ويعرض حقلي الرمز والتأكيد', (tester) async {
      await _pumpPage(tester, const PinSetupPage());

      expect(find.byType(PinSetupPage), findsOneWidget);
      // Two obscured PIN entry fields: the code and its confirmation.
      expect(find.byType(TextField), findsNWidgets(2));
      expect(find.byType(FilledButton), findsOneWidget);
    });

    testWidgets('returnTo غير معروف يُستبدل بالهدف الافتراضي بأمان', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        const PinSetupPage(returnTo: '/not-an-allowed-target'),
      );

      expect(find.byType(PinSetupPage), findsOneWidget);
    });
  });

  group('PinUnlockPage (Requirement 11.2)', () {
    testWidgets('يُبنى بلا استثناء ويعرض حقل الرمز فقط', (tester) async {
      await _pumpPage(tester, const PinUnlockPage());

      expect(find.byType(PinUnlockPage), findsOneWidget);
      // Unlock never renders a confirmation field, unlike setup.
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byType(FilledButton), findsOneWidget);
    });

    testWidgets('لا يحاول إعادة تسليح البصمة بلا وصول والد فعّال', (
      tester,
    ) async {
      // AuthGuard here has no live parent proof (only setAuthenticated), so
      // `_tryBiometricReArm` must no-op and the PIN field must render
      // immediately instead of a biometric-checking spinner.
      await _pumpPage(tester, const PinUnlockPage());

      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(find.byType(TextField), findsOneWidget);
    });
  });
}
