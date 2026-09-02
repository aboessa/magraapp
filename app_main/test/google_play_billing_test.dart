import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/profile/data/billing_status.dart';
import 'package:majarra/features/profile/data/google_play_billing.dart';

void main() {
  test('parses only paid server-authoritative Google Play products', () {
    final context = GooglePlayBillingContext.fromEnvelope({
      'data': {
        'obfuscated_account_id': 'parent-account-hash',
        'products': {
          'majarra_family_monthly': 'family',
          'majarra_family_plus_monthly': 'family_plus',
          'unexpected_free_product': 'free',
        },
      },
    });

    expect(context.obfuscatedAccountId, 'parent-account-hash');
    expect(context.products, {
      'majarra_family_monthly': BillingPlan.family,
      'majarra_family_plus_monthly': BillingPlan.familyPlus,
    });
  });

  test('rejects a billing context with no paid products', () {
    expect(
      () => GooglePlayBillingContext.fromEnvelope({
        'data': {
          'obfuscated_account_id': 'parent-account-hash',
          'products': {'free_product': 'free'},
        },
      }),
      throwsFormatException,
    );
  });
}
