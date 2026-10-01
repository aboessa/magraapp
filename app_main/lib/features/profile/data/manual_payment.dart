import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../home/application/home_providers.dart';
import 'billing_status.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// Which store this build is for. A Google Play build must sell digital
/// subscriptions through Play Billing only, so it is built with
/// `--dart-define=MAJARRA_DISTRIBUTION=play` and never shows manual payment.
const String majarraDistribution = String.fromEnvironment(
  'MAJARRA_DISTRIBUTION',
  defaultValue: 'direct',
);
bool get manualPaymentAllowedInThisBuild => majarraDistribution != 'play';

class ManualPaymentMethod {
  const ManualPaymentMethod({
    required this.code,
    required this.label,
    required this.account,
    required this.holder,
  });

  final String code;
  final String label;
  final String account;
  final String holder;

  bool get isInstaPay => code == 'instapay';
}

class ManualPaymentOffer {
  const ManualPaymentOffer({
    required this.plan,
    required this.period,
    required this.days,
    required this.amountEgp,
  });

  final BillingPlan plan;
  final String period;
  final int days;
  final int amountEgp;

  String get planKey =>
      plan == BillingPlan.familyPlus ? 'family_plus' : 'family';
  String get periodLabel => period == 'annual'
      ? AppLocalizationsAr().profilemanualpaymentGet01
      : AppLocalizationsAr().profilemanualpaymentGet02;
}

class ManualPaymentRequest {
  const ManualPaymentRequest({
    required this.id,
    required this.plan,
    required this.period,
    required this.amountEgp,
    required this.method,
    required this.status,
    required this.hasReceipt,
    this.rejectReason,
    this.expiresAt,
  });

  final String id;
  final BillingPlan plan;
  final String period;
  final int amountEgp;
  final String method;
  final String status;
  final bool hasReceipt;
  final String? rejectReason;
  final DateTime? expiresAt;

  bool get isPending => status == 'pending';
}

class ManualPaymentOptions {
  const ManualPaymentOptions({
    required this.enabled,
    required this.methods,
    required this.offers,
    required this.instructions,
    required this.receiptRequired,
    required this.requests,
  });

  static final unavailable = ManualPaymentOptions(
    enabled: false,
    methods: [],
    offers: [],
    instructions: '',
    receiptRequired: false,
    requests: [],
  );

  factory ManualPaymentOptions.fromJson(Map<String, Object?> json) {
    String str(Object? v) => v is String ? v : '';
    int number(Object? v) => v is num ? v.toInt() : 0;
    List<Map<String, Object?>> maps(Object? v) => v is List
        ? v
              .whereType<Map<Object?, Object?>>()
              .map((m) => m.cast<String, Object?>())
              .toList()
        : const [];

    return ManualPaymentOptions(
      enabled: json['enabled'] == true,
      instructions: str(json['instructions']),
      receiptRequired: json['receipt_required'] == true,
      methods: [
        for (final m in maps(json['methods']))
          ManualPaymentMethod(
            code: str(m['code']),
            label: str(m['label']),
            account: str(m['account']),
            holder: str(m['holder']),
          ),
      ],
      offers: [
        for (final o in maps(json['offers']))
          ManualPaymentOffer(
            plan: BillingPlanLabel.fromKey(str(o['plan'])),
            period: str(o['period']),
            days: number(o['days']),
            amountEgp: number(o['amount_egp']),
          ),
      ],
      requests: [
        for (final r in maps(json['requests']))
          ManualPaymentRequest(
            id: str(r['id']),
            plan: BillingPlanLabel.fromKey(str(r['plan'])),
            period: str(r['period']),
            amountEgp: number(r['amount_egp']),
            method: str(r['method']),
            status: str(r['status']),
            hasReceipt: r['has_receipt'] == true,
            rejectReason: r['reject_reason'] is String
                ? r['reject_reason'] as String
                : null,
            expiresAt: r['expires_at'] is String
                ? DateTime.tryParse(r['expires_at'] as String)
                : null,
          ),
      ],
    );
  }

  final bool enabled;
  final List<ManualPaymentMethod> methods;
  final List<ManualPaymentOffer> offers;
  final String instructions;
  final bool receiptRequired;

  /// Newest first.
  final List<ManualPaymentRequest> requests;

  ManualPaymentRequest? get latest => requests.isEmpty ? null : requests.first;
  ManualPaymentRequest? get pending {
    for (final r in requests) {
      if (r.isPending) return r;
    }
    return null;
  }
}

/// `GET /api/v1/billing/manual/options`. Nothing is requested for a guest or
/// in a Play build, where manual payment is never offered.
final manualPaymentOptionsProvider = FutureProvider<ManualPaymentOptions>((
  ref,
) async {
  if (!manualPaymentAllowedInThisBuild || ref.watch(authGuardProvider).isDemo) {
    return ManualPaymentOptions.unavailable;
  }
  final envelope = await ref
      .watch(majarraApiClientProvider)
      .getManualPaymentOptions();
  final data = envelope['data'];
  if (data is! Map) return ManualPaymentOptions.unavailable;
  return ManualPaymentOptions.fromJson(data.cast<String, Object?>());
});
