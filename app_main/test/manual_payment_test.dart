import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/profile/data/billing_status.dart';
import 'package:majarra/features/profile/data/manual_payment.dart';
import 'package:majarra/features/profile/presentation/widgets/manual_payment_section.dart';

void main() {
  test('options are parsed from the server response', () {
    final options = ManualPaymentOptions.fromJson({
      'enabled': true,
      'instructions': 'حوّل وابعت رقمك',
      'receipt_required': false,
      'methods': [
        {
          'code': 'vodafone_cash',
          'label': 'فودافون كاش',
          'account': '01012345678',
          'holder': 'مجرة',
        },
        {
          'code': 'instapay',
          'label': 'إنستاباي',
          'account': 'majarra@instapay',
          'holder': '',
        },
      ],
      'offers': [
        {'plan': 'family', 'period': 'monthly', 'days': 30, 'amount_egp': 99},
        {
          'plan': 'family_plus',
          'period': 'annual',
          'days': 365,
          'amount_egp': 1499,
        },
      ],
      'requests': [
        {
          'id': 'mp-2',
          'plan': 'family',
          'period': 'monthly',
          'amount_egp': 99,
          'method': 'vodafone_cash',
          'status': 'pending',
          'has_receipt': false,
        },
        {
          'id': 'mp-1',
          'plan': 'family',
          'period': 'monthly',
          'amount_egp': 99,
          'method': 'instapay',
          'status': 'rejected',
          'has_receipt': true,
          'reject_reason': 'المبلغ ناقص',
        },
      ],
    });
    expect(options.enabled, isTrue);
    expect(options.methods.last.isInstaPay, isTrue);
    expect(options.offers.last.plan, BillingPlan.familyPlus);
    expect(options.offers.last.planKey, 'family_plus');
    expect(options.offers.last.periodLabel, 'سنة');
    expect(options.pending?.id, 'mp-2');
    expect(options.requests.last.rejectReason, 'المبلغ ناقص');
  });

  test('a malformed or disabled response offers nothing', () {
    final options = ManualPaymentOptions.fromJson({
      'enabled': false,
      'methods': 'x',
      'offers': null,
    });
    expect(options.enabled, isFalse);
    expect(options.methods, isEmpty);
    expect(options.pending, isNull);
  });

  test('a direct build allows manual payment', () {
    // Built without MAJARRA_DISTRIBUTION=play.
    expect(manualPaymentAllowedInThisBuild, isTrue);
  });

  testWidgets('the sheet shows where to send and needs the sender number', (
    tester,
  ) async {
    final options = ManualPaymentOptions.fromJson({
      'enabled': true,
      'methods': [
        {
          'code': 'vodafone_cash',
          'label': 'فودافون كاش',
          'account': '01012345678',
          'holder': 'مجرة',
        },
      ],
      'offers': [
        {'plan': 'family', 'period': 'monthly', 'days': 30, 'amount_egp': 99},
      ],
      'requests': <Object>[],
    });
    const status = BillingStatus(
      plan: BillingPlan.free,
      basePlan: BillingPlan.free,
      limits: BillingLimits(
        children: 1,
        devices: 1,
        concurrentStreams: 1,
        downloadDevices: 0,
        usedChildren: 0,
        usedDevices: 1,
      ),
    );
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: ManualPaymentSection(options: options, status: status),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('اشترك دلوقتي'));
    await tester.pumpAndSettle();
    expect(find.text('01012345678'), findsOneWidget);
    expect(find.text('باسم: مجرة'), findsOneWidget);
    final send = find.widgetWithText(FilledButton, 'ابعت للمراجعة');
    expect(tester.widget<FilledButton>(send).onPressed, isNull);
    await tester.enterText(find.byType(TextField).first, '01099999999');
    await tester.pump();
    expect(tester.widget<FilledButton>(send).onPressed, isNotNull);
  });

  test('receipt type is read from the bytes', () {
    expect(
      receiptMimeType(Uint8List.fromList([0xFF, 0xD8, 0xFF, 0xE0])),
      'image/jpeg',
    );
    expect(
      receiptMimeType(Uint8List.fromList([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A])),
      'image/png',
    );
    expect(
      receiptMimeType(
        Uint8List.fromList([
          0x52,
          0x49,
          0x46,
          0x46,
          0,
          0,
          0,
          0,
          0x57,
          0x45,
          0x42,
          0x50,
        ]),
      ),
      'image/webp',
    );
    expect(receiptMimeType(Uint8List.fromList('<svg>'.codeUnits)), isNull);
  });
}
