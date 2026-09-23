import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/profile/data/billing_catalog.dart';
import 'package:majarra/features/profile/data/billing_status.dart';
import 'package:majarra/features/profile/presentation/pages/membership_page.dart';

void main() {
  test('native purchase store is never initialized by a Web build', () {
    expect(
      shouldInitializePurchaseStore(
        isWeb: true,
        platform: TargetPlatform.android,
      ),
      isFalse,
    );
    expect(
      shouldInitializePurchaseStore(
        isWeb: false,
        platform: TargetPlatform.android,
      ),
      isTrue,
    );
    expect(
      shouldInitializePurchaseStore(
        isWeb: false,
        platform: TargetPlatform.iOS,
      ),
      isFalse,
    );
  });

  testWidgets(
    'MembershipPage builds on a non-store platform without plugin access',
    (tester) async {
      tester.view.physicalSize = const Size(1280, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            billingStatusProvider.overrideWith(
              (ref) async => BillingStatus.guestPreview,
            ),
            billingCatalogProvider.overrideWith(
              (ref) async => BillingCatalog.guestPreview,
            ),
          ],
          child: const MaterialApp(home: MembershipPage()),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('العضوية'), findsOneWidget);
      expect(find.text('الباقة المجانية'), findsWidgets);
    },
  );
}
