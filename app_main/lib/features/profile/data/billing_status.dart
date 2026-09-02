import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../home/application/home_providers.dart';

/// Plan tiers the server recognises.
enum BillingPlan { free, family, familyPlus }

extension BillingPlanLabel on BillingPlan {
  static BillingPlan fromKey(String? value) => switch (value) {
    'family' => BillingPlan.family,
    'family_plus' => BillingPlan.familyPlus,
    _ => BillingPlan.free,
  };

  String get label => switch (this) {
    BillingPlan.free => 'الباقة المجانية',
    BillingPlan.family => 'باقة العائلة',
    BillingPlan.familyPlus => 'باقة العائلة بلس',
  };

  bool get isPaid => this != BillingPlan.free;
}

/// A paid entitlement currently granting access.
class BillingSubscription {
  const BillingSubscription({
    required this.plan,
    required this.status,
    required this.source,
    required this.inGrace,
    this.startsAt,
    this.expiresAt,
  });

  static BillingSubscription? fromJson(Object? value) {
    if (value is! Map) return null;
    final json = value.cast<String, Object?>();

    String text(String key) {
      final raw = json[key];
      return raw is String ? raw.trim() : '';
    }

    DateTime? date(String key) {
      final raw = json[key];
      return raw is String ? DateTime.tryParse(raw) : null;
    }

    return BillingSubscription(
      plan: BillingPlanLabel.fromKey(text('plan')),
      status: text('status'),
      source: text('source'),
      inGrace: json['in_grace'] == true,
      startsAt: date('starts_at'),
      expiresAt: date('expires_at'),
    );
  }

  final BillingPlan plan;
  final String status;
  final String source;

  /// True while a payment problem is being retried. Access is still granted, so
  /// this is surfaced as a warning rather than as a lapsed subscription.
  final bool inGrace;
  final DateTime? startsAt;
  final DateTime? expiresAt;

  String get statusLabel => switch (status) {
    'active' => 'نشط',
    'grace' => 'مهلة سماح',
    'expired' => 'منتهٍ',
    'revoked' => 'ملغى',
    _ => status.isEmpty ? 'غير معروف' : status,
  };

  String get sourceLabel => switch (source) {
    'google_play' => 'Google Play',
    'app_store' => 'App Store',
    'stripe' => 'الدفع الإلكتروني',
    'payment_gateway' => 'بوابة الدفع',
    'manual' => 'دفع مباشر',
    _ => source.isEmpty ? '—' : source,
  };
}

/// Plan caps as enforced by the server, plus how much of each is in use.
class BillingLimits {
  const BillingLimits({
    required this.children,
    required this.devices,
    required this.concurrentStreams,
    required this.downloadDevices,
    required this.usedChildren,
    required this.usedDevices,
  });

  final int children;
  final int devices;
  final int concurrentStreams;
  final int downloadDevices;
  final int usedChildren;
  final int usedDevices;
}

/// Subscription state for the signed-in family account.
class BillingStatus {
  const BillingStatus({
    required this.plan,
    required this.basePlan,
    required this.limits,
    this.subscription,
    this.isGuestPreview = false,
  });

  factory BillingStatus.fromJson(Map<String, Object?> json) {
    int number(Object? source, String key) {
      if (source is! Map) return 0;
      final raw = source.cast<String, Object?>()[key];
      if (raw is int) return raw;
      if (raw is num) return raw.toInt();
      return 0;
    }

    final limits = json['limits'];
    final usage = json['usage'];

    return BillingStatus(
      plan: BillingPlanLabel.fromKey(
        json['plan'] is String ? json['plan'] as String : null,
      ),
      basePlan: BillingPlanLabel.fromKey(
        json['base_plan'] is String ? json['base_plan'] as String : null,
      ),
      subscription: BillingSubscription.fromJson(json['subscription']),
      limits: BillingLimits(
        children: number(limits, 'children'),
        devices: number(limits, 'devices'),
        concurrentStreams: number(limits, 'concurrent_streams'),
        downloadDevices: number(limits, 'download_devices'),
        usedChildren: number(usage, 'children'),
        usedDevices: number(usage, 'devices'),
      ),
    );
  }

  /// Read-only preview for the local guest session.
  ///
  /// The guest has no account, so `GET /billing/status` cannot be called. The
  /// free tier is reported with the same limits the server enforces, and
  /// [isGuestPreview] keeps the screen from offering a purchase that would need
  /// a real family account.
  static const guestPreview = BillingStatus(
    plan: BillingPlan.free,
    basePlan: BillingPlan.free,
    limits: BillingLimits(
      children: 1,
      devices: 1,
      concurrentStreams: 1,
      downloadDevices: 0,
      usedChildren: 1,
      usedDevices: 1,
    ),
    isGuestPreview: true,
  );

  /// Plan currently in force, including any paid entitlement.
  final BillingPlan plan;

  /// Tier the account falls back to once paid entitlements lapse.
  final BillingPlan basePlan;
  final BillingLimits limits;
  final BillingSubscription? subscription;

  /// True when this is the guest preview rather than a real account entitlement.
  final bool isGuestPreview;

  bool get hasSubscription => subscription != null;
}

/// Reads `GET /api/v1/billing/status`.
///
/// The endpoint did not exist previously, so the membership screen had no data
/// source at all. It reports the same plan the server uses to enforce limits, so
/// the screen cannot advertise a tier the app does not grant.
final billingStatusProvider = FutureProvider<BillingStatus>((ref) async {
  // The guest session holds no credentials, so requesting the account ledger
  // would only produce an authentication error on a screen the guest is
  // explicitly allowed to preview.
  if (ref.watch(authGuardProvider).isDemo) return BillingStatus.guestPreview;

  final api = ref.watch(majarraApiClientProvider);
  final envelope = await api.getBillingStatus();
  final data = envelope['data'];
  if (data is! Map) {
    throw StateError('Billing status response did not contain data');
  }
  return BillingStatus.fromJson(data.cast<String, Object?>());
});
