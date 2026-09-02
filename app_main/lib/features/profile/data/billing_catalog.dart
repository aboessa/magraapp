import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../home/application/home_providers.dart';
import 'billing_status.dart';

class BillingCatalog {
  const BillingCatalog({
    required this.country,
    required this.platform,
    required this.plans,
    required this.offers,
    required this.paymentMethods,
  });

  factory BillingCatalog.fromEnvelope(Map<String, dynamic> envelope) {
    final rawData = envelope['data'];
    if (rawData is! Map) {
      throw const FormatException('Billing catalogue is missing data');
    }
    final data = rawData.cast<String, Object?>();
    final plans = _mapList(data['plans'], BillingCatalogPlan.fromJson);
    final offers = _mapList(data['offers'], BillingOffer.fromJson);
    final methods = _mapList(
      data['payment_methods'],
      BillingPaymentMethod.fromJson,
    );
    return BillingCatalog(
      country: _text(data['country'], fallback: 'GLOBAL'),
      platform: _text(data['platform'], fallback: 'unknown'),
      plans: plans,
      offers: offers,
      paymentMethods: methods,
    );
  }

  final String country;
  final String platform;

  /// Plan comparison for the local guest session.
  ///
  /// Limits mirror `PLAN_LIMITS` on the server. Offers and payment methods stay
  /// empty because a price and a checkout may only come from the authenticated
  /// catalogue and the store, never from a client constant.
  static const guestPreview = BillingCatalog(
    country: 'GLOBAL',
    platform: 'guest_preview',
    plans: [
      BillingCatalogPlan(
        plan: BillingPlan.family,
        children: 4,
        devices: 4,
        concurrentStreams: 2,
        downloadDevices: 2,
      ),
      BillingCatalogPlan(
        plan: BillingPlan.familyPlus,
        children: 4,
        devices: 8,
        concurrentStreams: 4,
        downloadDevices: 4,
      ),
    ],
    offers: [],
    paymentMethods: [],
  );

  final List<BillingCatalogPlan> plans;
  final List<BillingOffer> offers;
  final List<BillingPaymentMethod> paymentMethods;

  BillingOffer? offerFor(BillingPlan plan, {String? period}) {
    for (final offer in offers) {
      if (offer.plan == plan && (period == null || offer.period == period)) {
        return offer;
      }
    }
    return null;
  }
}

class BillingCatalogPlan {
  const BillingCatalogPlan({
    required this.plan,
    required this.children,
    required this.devices,
    required this.concurrentStreams,
    required this.downloadDevices,
  });

  factory BillingCatalogPlan.fromJson(Map<String, Object?> json) {
    final limits = json['limits'] is Map
        ? (json['limits'] as Map).cast<String, Object?>()
        : const <String, Object?>{};
    return BillingCatalogPlan(
      plan: BillingPlanLabel.fromKey(_text(json['id'])),
      children: _integer(limits['children']),
      devices: _integer(limits['devices']),
      concurrentStreams: _integer(limits['concurrent_streams']),
      downloadDevices: _integer(limits['download_devices']),
    );
  }

  final BillingPlan plan;
  final int children;
  final int devices;
  final int concurrentStreams;
  final int downloadDevices;
}

class BillingOffer {
  const BillingOffer({
    required this.id,
    required this.provider,
    required this.productId,
    required this.plan,
    required this.period,
    required this.country,
    required this.currency,
    required this.currencyExponent,
    required this.priceMinor,
  });

  factory BillingOffer.fromJson(Map<String, Object?> json) => BillingOffer(
    id: _text(json['id']),
    provider: _text(json['provider']),
    productId: _text(json['product_id']),
    plan: BillingPlanLabel.fromKey(_text(json['plan'])),
    period: _text(json['billing_period'], fallback: 'monthly'),
    country: _text(json['country'], fallback: 'GLOBAL'),
    currency: _text(json['currency']),
    currencyExponent: _currencyExponent(json['currency_exponent']),
    priceMinor: _integer(json['price_minor']),
  );

  final String id;
  final String provider;
  final String productId;
  final BillingPlan plan;
  final String period;
  final String country;
  final String currency;
  final int currencyExponent;
  final int priceMinor;

  num get majorAmount => priceMinor / math.pow(10, currencyExponent);
}

class BillingPaymentMethod {
  const BillingPaymentMethod({
    required this.id,
    required this.provider,
    required this.code,
    required this.nameAr,
    required this.nameEn,
    required this.checkoutMode,
  });

  factory BillingPaymentMethod.fromJson(Map<String, Object?> json) =>
      BillingPaymentMethod(
        id: _text(json['id']),
        provider: _text(json['provider']),
        code: _text(json['code']),
        nameAr: _text(json['name_ar']),
        nameEn: _text(json['name_en']),
        checkoutMode: _text(json['checkout_mode']),
      );

  final String id;
  final String provider;
  final String code;
  final String nameAr;
  final String nameEn;
  final String checkoutMode;
}

final billingCatalogProvider = FutureProvider<BillingCatalog>((ref) async {
  if (ref.watch(authGuardProvider).isDemo) return BillingCatalog.guestPreview;

  final api = ref.watch(majarraApiClientProvider);
  final platform = kIsWeb
      ? 'web'
      : switch (defaultTargetPlatform) {
          TargetPlatform.android => 'android',
          TargetPlatform.iOS => 'ios',
          _ => 'unsupported',
        };
  final envelope = await api.getBillingCatalog(platform: platform);
  return BillingCatalog.fromEnvelope(envelope);
});

List<T> _mapList<T>(Object? value, T Function(Map<String, Object?>) parse) {
  if (value is! List) return const [];
  return value
      .whereType<Map<Object?, Object?>>()
      .map((item) => parse(item.cast<String, Object?>()))
      .toList(growable: false);
}

String _text(Object? value, {String fallback = ''}) {
  if (value is! String) return fallback;
  final result = value.trim();
  return result.isEmpty ? fallback : result;
}

int _integer(Object? value) {
  if (value is int) return value < 0 ? 0 : value;
  if (value is num) return value.isNegative ? 0 : value.toInt();
  return 0;
}

int _currencyExponent(Object? value) {
  final parsed = _integer(value);
  return parsed > 3 ? 3 : parsed;
}
