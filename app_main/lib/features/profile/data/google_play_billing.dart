import 'billing_status.dart';

/// Server-authoritative product mapping for the native Google Play sheet.
class GooglePlayBillingContext {
  const GooglePlayBillingContext({
    required this.products,
    required this.obfuscatedAccountId,
  });

  factory GooglePlayBillingContext.fromEnvelope(Map<String, dynamic> envelope) {
    final data = envelope['data'];
    if (data is! Map) {
      throw const FormatException(
        'Google Play billing context is missing data',
      );
    }
    final rawProducts = data['products'];
    final accountId = data['obfuscated_account_id'];
    if (rawProducts is! Map || accountId is! String || accountId.isEmpty) {
      throw const FormatException('Google Play billing context is invalid');
    }

    final products = <String, BillingPlan>{};
    rawProducts.forEach((key, value) {
      if (key is! String || value is! String) return;
      final plan = BillingPlanLabel.fromKey(value);
      if (plan.isPaid) products[key] = plan;
    });
    if (products.isEmpty) {
      throw const FormatException('Google Play billing has no paid products');
    }

    return GooglePlayBillingContext(
      products: products,
      obfuscatedAccountId: accountId,
    );
  }

  final Map<String, BillingPlan> products;
  final String obfuscatedAccountId;
}
