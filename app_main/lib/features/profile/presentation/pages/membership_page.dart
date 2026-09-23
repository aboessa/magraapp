import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/device/device_profile.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../data/billing_catalog.dart';
import '../../data/billing_status.dart';
import '../../data/google_play_billing.dart';
import '../../../home/application/home_providers.dart';
import '../widgets/profile_page_content.dart';

@visibleForTesting
bool shouldInitializePurchaseStore({
  bool isWeb = kIsWeb,
  TargetPlatform? platform,
}) =>
    !isWeb && (platform ?? defaultTargetPlatform) == TargetPlatform.android;

/// Membership and subscription state.
///
/// This page previously had no data source at all: `GET /api/v1/billing/status`
/// did not exist on the server, so the card showed `'غير مربوط'` with an em-dash
/// price and both actions were disabled. The endpoint now exists and reports the
/// same effective plan the server uses to enforce limits, so what is shown here
/// cannot disagree with what the account actually grants.
class MembershipPage extends ConsumerStatefulWidget {
  const MembershipPage({super.key});

  @override
  ConsumerState<MembershipPage> createState() => _MembershipPageState();
}

class _MembershipPageState extends ConsumerState<MembershipPage> {
  // `in_app_purchase` has no web implementation in this app. Reading
  // `InAppPurchase.instance` while constructing the page therefore reaches the
  // platform interface's uninitialised `late _instance` and replaces the whole
  // membership screen with Flutter's red error view. Create the store client
  // only on the one platform whose purchase flow is implemented.
  InAppPurchase? _purchases;
  final Set<String> _knownProductIds = <String>{};
  final Set<String> _verifyingPurchaseIds = <String>{};
  StreamSubscription<List<PurchaseDetails>>? _purchaseSubscription;
  bool _billingActionInProgress = false;
  String? _billingMessage;

  @override
  void initState() {
    super.initState();
    if (!shouldInitializePurchaseStore()) return;
    final purchases = InAppPurchase.instance;
    _purchases = purchases;
    _purchaseSubscription = purchases.purchaseStream.listen(
      _handlePurchaseUpdates,
      onError: (_, __) =>
          _setBillingMessage('تعذر إتمام عملية الشراء. أعد المحاولة.'),
    );
    _restorePendingPurchases();
  }

  @override
  void dispose() {
    _purchaseSubscription?.cancel();
    super.dispose();
  }

  void _setBillingMessage(String? message) {
    if (!mounted) return;
    setState(() => _billingMessage = message);
  }

  Future<void> _restorePendingPurchases() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    final purchases = _purchases;
    if (purchases == null) return;
    try {
      final contextData = GooglePlayBillingContext.fromEnvelope(
        await ref.read(majarraApiClientProvider).getGooglePlayBillingContext(),
      );
      _knownProductIds
        ..clear()
        ..addAll(contextData.products.keys);
      if (await purchases.isAvailable()) {
        await purchases.restorePurchases(
          applicationUserName: contextData.obfuscatedAccountId,
        );
      }
    } catch (_) {
      // A fresh purchase still loads the same context when the parent opens
      // plans; restoration must not make the membership screen unusable.
    }
  }

  Future<void> _handlePurchaseUpdates(List<PurchaseDetails> purchases) async {
    final store = _purchases;
    if (store == null) return;
    for (final purchase in purchases) {
      if (!_knownProductIds.contains(purchase.productID)) continue;
      if (purchase.status == PurchaseStatus.pending) {
        if (mounted) setState(() => _billingActionInProgress = true);
        continue;
      }
      if (purchase.status == PurchaseStatus.error) {
        _setBillingMessage(
          'لم يكتمل الشراء. لم يتم خصم أي مبلغ إن ألغيت العملية.',
        );
        if (mounted) setState(() => _billingActionInProgress = false);
        continue;
      }
      if (purchase.status == PurchaseStatus.canceled) {
        if (mounted) setState(() => _billingActionInProgress = false);
        continue;
      }
      if (purchase.status != PurchaseStatus.purchased &&
          purchase.status != PurchaseStatus.restored) {
        continue;
      }

      final token = purchase.verificationData.serverVerificationData;
      if (token.isEmpty || !_verifyingPurchaseIds.add(token)) continue;
      try {
        await ref
            .read(majarraApiClientProvider)
            .verifyGooglePlayPurchase(token);
        if (purchase.pendingCompletePurchase) {
          await store.completePurchase(purchase);
        }
        ref.invalidate(billingStatusProvider);
        _setBillingMessage('تم تفعيل الباقة بنجاح.');
      } catch (_) {
        // Do not acknowledge an unverified purchase. Google Play will send it
        // again when the app reopens, which lets verification recover safely.
        _setBillingMessage(
          'تم استلام الشراء، لكن تعذر التحقق منه الآن. أعد فتح الصفحة لاحقًا.',
        );
      } finally {
        _verifyingPurchaseIds.remove(token);
        if (mounted) setState(() => _billingActionInProgress = false);
      }
    }
  }

  Future<void> _openPlans() async {
    // يُقرأ قبل أي `await`: قراءة `BuildContext` بعد نقطة تعليق تحتاج حرس
    // `mounted` ويُبلّغ عنها المحلّل، والرسالة نفسها لا تتغيّر بانتظار المتجر.
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final isTelevision =
        ref.read(deviceProfileProvider).valueOrNull?.isTelevision ?? false;
    if (isTelevision) {
      _setBillingMessage('أكمل الاشتراك من هاتف أو متصفح ولي الأمر.');
      return;
    }
    if (kIsWeb) {
      _setBillingMessage(
        'سيتم تفعيل الدفع عبر الويب بعد ربط بوابة الدفع والتحقق الآمن من عملياتها.',
      );
      return;
    }
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      _setBillingMessage(
        'سيتم تفعيل App Store بعد ربط منتجات Apple والتحقق الخادمي من الاشتراك.',
      );
      return;
    }
    if (defaultTargetPlatform != TargetPlatform.android) {
      _setBillingMessage('الاشتراك غير متاح من هذه المنصة حاليًا.');
      return;
    }
    final purchases = _purchases;
    if (purchases == null) {
      _setBillingMessage(l10n.googlePlayUnavailableOnDevice);
      return;
    }
    if (_billingActionInProgress) return;
    setState(() {
      _billingActionInProgress = true;
      _billingMessage = null;
    });

    try {
      final contextData = GooglePlayBillingContext.fromEnvelope(
        await ref.read(majarraApiClientProvider).getGooglePlayBillingContext(),
      );
      _knownProductIds
        ..clear()
        ..addAll(contextData.products.keys);
      if (!await purchases.isAvailable()) {
        throw StateError(l10n.googlePlayUnavailableOnDevice);
      }
      final response = await purchases.queryProductDetails(_knownProductIds);
      final available = response.productDetails
          .where((product) => _knownProductIds.contains(product.id))
          .toList(growable: false);
      if (available.isEmpty) {
        // Distinguish a store/query failure from products that the store does
        // not serve for this build, account or country. Collapsing both into one
        // message hid the actual reason a purchase could not start.
        final storeError = response.error?.message.trim();
        throw StateError(
          storeError != null && storeError.isNotEmpty
              ? 'تعذر قراءة الباقات من Google Play: $storeError'
              : response.notFoundIDs.isNotEmpty
              ? 'الباقات غير متاحة لهذا الحساب أو البلد أو إصدار التطبيق الحالي.'
              : 'لا توجد باقات متاحة في Google Play حاليًا.',
        );
      }
      if (!mounted) return;
      setState(() => _billingActionInProgress = false);
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF0B1026),
        builder: (sheetContext) => _GooglePlayPlansSheet(
          products: available,
          plans: contextData.products,
          onSelect: (product) async {
            Navigator.of(sheetContext).pop();
            await _startPurchase(product, contextData.obfuscatedAccountId);
          },
        ),
      );
    } catch (error) {
      _setBillingMessage(
        error is StateError
            ? error.message.toString()
            : 'تعذر تحميل الباقات. حاول مرة أخرى.',
      );
      if (mounted) setState(() => _billingActionInProgress = false);
    }
  }

  Future<void> _startPurchase(ProductDetails product, String accountId) async {
    final purchases = _purchases;
    if (purchases == null) {
      _setBillingMessage(
        (AppLocalizations.of(context) ?? AppLocalizationsAr())
            .googlePlayUnavailableOnDevice,
      );
      return;
    }
    if (_billingActionInProgress) return;
    setState(() {
      _billingActionInProgress = true;
      _billingMessage = null;
    });
    final parameter = GooglePlayPurchaseParam(
      productDetails: product,
      applicationUserName: accountId,
      offerToken: product is GooglePlayProductDetails
          ? product.offerToken
          : null,
    );
    try {
      final started = await purchases.buyNonConsumable(
        purchaseParam: parameter,
      );
      if (!started) {
        _setBillingMessage('تعذر فتح Google Play. حاول مرة أخرى.');
        if (mounted) setState(() => _billingActionInProgress = false);
      }
    } catch (_) {
      _setBillingMessage('تعذر بدء عملية الشراء. حاول مرة أخرى.');
      if (mounted) setState(() => _billingActionInProgress = false);
    }
  }

  Future<void> _manageSubscription(String? source) async {
    final uri = switch (source) {
      'google_play' => Uri.parse(
        'https://play.google.com/store/account/subscriptions?package=com.majarra.majarra',
      ),
      'app_store' => Uri.parse('https://apps.apple.com/account/subscriptions'),
      _ => null,
    };
    if (uri == null) {
      _setBillingMessage(
        'تتم إدارة هذا الاشتراك من وسيلة الدفع التي استخدمتها عند الاشتراك.',
      );
      return;
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      _setBillingMessage('تعذر فتح صفحة إدارة الاشتراك.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final status = ref.watch(billingStatusProvider);
    final catalog = ref.watch(billingCatalogProvider);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(
                icon: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                ),
                tooltip: 'رجوع',
                onPressed: () => context.pop(),
              ),
              title: const Text(
                'العضوية',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  tooltip: 'تحديث',
                  onPressed: () {
                    ref.invalidate(billingStatusProvider);
                    ref.invalidate(billingCatalogProvider);
                  },
                ),
              ],
            ),
            SliverToBoxAdapter(
              child: ProfilePageContent(
                child: status.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 60),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: AppColors.starGold,
                      ),
                    ),
                  ),
                  error: (error, _) => _MembershipError(
                    failure: AppFailure.fromException(error),
                    onRetry: () => ref.invalidate(billingStatusProvider),
                    onSignIn: () => context.push('/login'),
                  ),
                  data: (data) => Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _PlanCard(status: data),
                      if (data.subscription?.inGrace == true) ...[
                        const SizedBox(height: 12),
                        _GraceWarning(
                          source:
                              data.subscription?.sourceLabel ?? 'وسيلة الدفع',
                        ),
                      ],
                      const SizedBox(height: 16),
                      _UsageSection(limits: data.limits),
                      const SizedBox(height: 16),
                      _EntitlementsSection(status: data),
                      const SizedBox(height: 22),
                      _UpgradeSection(
                        status: data,
                        catalog: catalog,
                        busy: _billingActionInProgress,
                        message: _billingMessage,
                        onOpenPlans: _openPlans,
                        onManageSubscription: () =>
                            _manageSubscription(data.subscription?.source),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _UpgradeSection extends StatelessWidget {
  const _UpgradeSection({
    required this.status,
    required this.catalog,
    required this.busy,
    required this.message,
    required this.onOpenPlans,
    required this.onManageSubscription,
  });

  final BillingStatus status;
  final AsyncValue<BillingCatalog> catalog;
  final bool busy;
  final String? message;
  final VoidCallback onOpenPlans;
  final VoidCallback onManageSubscription;

  @override
  Widget build(BuildContext context) {
    final paid = status.plan.isPaid;
    final catalogData = catalog.valueOrNull;
    final plans = catalogData?.plans ?? const <BillingCatalogPlan>[];
    final family = _findPlan(plans, BillingPlan.family);
    final familyPlus = _findPlan(plans, BillingPlan.familyPlus);
    final familyOffer = catalogData?.offerFor(BillingPlan.family);
    final familyPlusOffer = catalogData?.offerFor(BillingPlan.familyPlus);
    final methods =
        catalogData?.paymentMethods ?? const <BillingPaymentMethod>[];
    // A guest can compare plans but cannot buy: a subscription must belong to a
    // real family account that the server can grant entitlements to.
    final checkoutAvailable = !status.isGuestPreview && methods.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: AlignmentDirectional.topStart,
              end: AlignmentDirectional.bottomEnd,
              colors: [
                AppColors.royalBlue.withValues(alpha: 0.28),
                AppColors.cosmicPurple.withValues(alpha: 0.20),
                AppColors.cardSurface.withValues(alpha: 0.86),
              ],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.electricCyan.withValues(alpha: 0.18),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  const Text(
                    'اختر الباقة المناسبة لأسرتك',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (catalogData != null)
                    _CatalogueBadge(country: catalogData.country),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'السعر ووسيلة الدفع يتحددان تلقائيًا حسب بلد الحساب والمنصة. '
                'لن يتم خصم أي مبلغ قبل عرض السعر النهائي والتجديد بوضوح.',
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.9),
                  fontSize: 11.5,
                  height: 1.65,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        _PlanOption(
          title: 'باقة العائلة',
          subtitle: family == null
              ? 'حتى 4 أطفال، 4 أجهزة، ومشاهدتان في الوقت نفسه'
              : 'حتى ${family.children} أطفال، ${family.devices} أجهزة، '
                    'و${family.concurrentStreams} مشاهدة متزامنة',
          details: family == null
              ? 'تنزيل محمي على جهازين'
              : 'تنزيل محمي على ${family.downloadDevices} أجهزة',
          price: _offerPrice(context, familyOffer),
          period: _periodLabel(familyOffer?.period),
          icon: Icons.family_restroom_rounded,
        ),
        const SizedBox(height: 10),
        _PlanOption(
          title: 'باقة العائلة بلس',
          subtitle: familyPlus == null
              ? 'حتى 4 أطفال، 8 أجهزة، و4 مشاهدات في الوقت نفسه'
              : 'حتى ${familyPlus.children} أطفال، ${familyPlus.devices} أجهزة، '
                    'و${familyPlus.concurrentStreams} مشاهدة متزامنة',
          details: familyPlus == null
              ? 'تنزيل محمي على 4 أجهزة'
              : 'تنزيل محمي على ${familyPlus.downloadDevices} أجهزة',
          price: _offerPrice(context, familyPlusOffer),
          period: _periodLabel(familyPlusOffer?.period),
          icon: Icons.workspace_premium_rounded,
          highlighted: true,
        ),
        if (catalog.isLoading) ...[
          const SizedBox(height: 12),
          const LinearProgressIndicator(
            minHeight: 2,
            color: AppColors.electricCyan,
            backgroundColor: Colors.white10,
          ),
        ] else if (catalog.hasError) ...[
          const SizedBox(height: 10),
          Text(
            'تعذر تحديث الأسعار الإقليمية الآن؛ سيظهر السعر النهائي داخل وسيلة الدفع قبل التأكيد.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.76),
              fontSize: 11,
              height: 1.55,
            ),
          ),
        ],
        if (methods.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text(
            'طرق الدفع المتاحة',
            style: TextStyle(
              color: Colors.white,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: methods
                .map(
                  (method) => Chip(
                    avatar: const Icon(
                      Icons.verified_user_outlined,
                      size: 17,
                      color: AppColors.electricCyan,
                    ),
                    label: Text(method.nameAr),
                    backgroundColor: AppColors.indigoSurface,
                    side: BorderSide(
                      color: AppColors.electricCyan.withValues(alpha: 0.2),
                    ),
                    labelStyle: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ],
        if (status.isGuestPreview) ...[
          const SizedBox(height: 14),
          const _BillingNotice(
            message:
                'هذه معاينة للباقات في تجربة الضيف. أنشئ حساب أسرة أو سجّل '
                'الدخول لعرض باقتك الحالية وإتمام الاشتراك.',
          ),
        ] else if (!paid && catalogData != null && !checkoutAvailable) ...[
          const SizedBox(height: 14),
          const _BillingNotice(
            message:
                'لا توجد وسيلة دفع مفعّلة لهذه المنصة حاليًا. يمكنك مراجعة الباقات، وسنُظهر الدفع فور اكتمال ربط المزود الآمن.',
          ),
        ],
        const SizedBox(height: 16),
        Semantics(
          button: true,
          enabled: status.isGuestPreview || paid || checkoutAvailable,
          label: status.isGuestPreview
              ? 'تسجيل الدخول لإتمام الاشتراك'
              : paid
              ? 'إدارة الاشتراك الحالي'
              : checkoutAvailable
              ? 'متابعة اختيار الباقة والدفع'
              : 'الدفع غير متاح حاليًا',
          child: FilledButton.icon(
            onPressed: status.isGuestPreview
                ? () => context.push('/login')
                : busy || (!paid && !checkoutAvailable)
                ? null
                : (paid ? onManageSubscription : onOpenPlans),
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
              backgroundColor: AppColors.starGold,
              foregroundColor: AppColors.deepSpace,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
              ),
            ),
            icon: busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.deepSpace,
                    ),
                  )
                : Icon(
                    status.isGuestPreview
                        ? Icons.login_rounded
                        : paid
                        ? Icons.settings_outlined
                        : Icons.lock_outline_rounded,
                  ),
            label: Text(
              status.isGuestPreview
                  ? 'تسجيل الدخول أو إنشاء حساب'
                  : paid
                  ? 'إدارة الاشتراك'
                  : checkoutAvailable
                  ? 'متابعة آمنة للدفع'
                  : 'الدفع غير متاح حاليًا',
              style: const TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ),
        const SizedBox(height: 9),
        Text(
          _checkoutDisclosure(catalogData?.platform),
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.72),
            fontSize: 10.8,
            height: 1.6,
          ),
        ),
        if (message != null) ...[
          const SizedBox(height: 10),
          _BillingNotice(message: message!),
        ],
      ],
    );
  }

  static BillingCatalogPlan? _findPlan(
    List<BillingCatalogPlan> plans,
    BillingPlan target,
  ) {
    for (final plan in plans) {
      if (plan.plan == target) return plan;
    }
    return null;
  }

  static String? _offerPrice(BuildContext context, BillingOffer? offer) {
    if (offer == null || offer.currency.isEmpty) return null;
    // Native storefront prices must come from ProductDetails/StoreKit. D1 is
    // catalogue metadata only and may not include taxes or live store changes.
    if (offer.provider == 'google_play' || offer.provider == 'app_store') {
      return null;
    }
    try {
      return NumberFormat.simpleCurrency(
        locale: Localizations.localeOf(context).toLanguageTag(),
        name: offer.currency,
        decimalDigits: offer.currencyExponent,
      ).format(offer.majorAmount);
    } catch (_) {
      return '${offer.majorAmount} ${offer.currency}';
    }
  }

  static String? _periodLabel(String? value) => switch (value) {
    'annual' => 'سنويًا',
    'monthly' => 'شهريًا',
    'weekly' => 'أسبوعيًا',
    'lifetime' => 'مرة واحدة',
    _ => null,
  };

  static String _checkoutDisclosure(String? platform) => switch (platform) {
    'ios' =>
      'تتم مشتريات المحتوى الرقمي على iPhone وiPad من خلال App Store وفق بلد المتجر.',
    'android' =>
      'تظهر أسعار Google Play المحلية وشروط التجديد قبل تأكيد عملية الشراء.',
    'web' =>
      'تظهر فقط وسائل الدفع المفعّلة لبلدك، ويؤكد الخادم السعر قبل إنشاء عملية الدفع.',
    _ => 'تظهر الأسعار النهائية وشروط التجديد قبل تأكيد أي عملية دفع.',
  };
}

class _CatalogueBadge extends StatelessWidget {
  const _CatalogueBadge({required this.country});

  final String country;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
    decoration: BoxDecoration(
      color: AppColors.electricCyan.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(99),
      border: Border.all(color: AppColors.electricCyan.withValues(alpha: 0.22)),
    ),
    child: Text(
      country == 'GLOBAL' ? 'السعر العالمي' : 'أسعار $country',
      style: const TextStyle(
        color: AppColors.electricCyan,
        fontSize: 10,
        fontWeight: FontWeight.w800,
      ),
    ),
  );
}

class _PlanOption extends StatelessWidget {
  const _PlanOption({
    required this.title,
    required this.subtitle,
    required this.details,
    required this.icon,
    this.price,
    this.period,
    this.highlighted = false,
  });

  final String title;
  final String subtitle;
  final String details;
  final IconData icon;
  final String? price;
  final String? period;
  final bool highlighted;

  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label: [
      title,
      price,
      period,
      subtitle,
      details,
    ].whereType<String>().join('، '),
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlighted
            ? AppColors.cosmicPurple.withValues(alpha: 0.18)
            : AppColors.cardSurface.withValues(alpha: 0.84),
        borderRadius: BorderRadius.circular(17),
        border: Border.all(
          color: highlighted
              ? AppColors.starGold.withValues(alpha: 0.48)
              : Colors.white.withValues(alpha: 0.08),
        ),
        boxShadow: highlighted
            ? [
                BoxShadow(
                  color: AppColors.cosmicPurple.withValues(alpha: 0.12),
                  blurRadius: 20,
                ),
              ]
            : null,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: highlighted
                  ? AppColors.starGold.withValues(alpha: 0.14)
                  : Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(
              icon,
              color: highlighted ? AppColors.starGold : Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    if (highlighted)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.starGold,
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: const Text(
                          'الأفضل للعائلة',
                          style: TextStyle(
                            color: AppColors.deepSpace,
                            fontSize: 8.5,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                  ],
                ),
                if (price != null) ...[
                  const SizedBox(height: 7),
                  Wrap(
                    spacing: 5,
                    crossAxisAlignment: WrapCrossAlignment.end,
                    children: [
                      Text(
                        price!,
                        style: const TextStyle(
                          color: AppColors.starGold,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      if (period != null)
                        Text(
                          period!,
                          style: TextStyle(
                            color: AppColors.mutedText.withValues(alpha: 0.75),
                            fontSize: 10,
                          ),
                        ),
                    ],
                  ),
                ] else ...[
                  const SizedBox(height: 6),
                  Text(
                    'السعر المحلي يظهر قبل الدفع',
                    style: TextStyle(
                      color: AppColors.starGold.withValues(alpha: 0.9),
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                const SizedBox(height: 7),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.88),
                    fontSize: 11,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  details,
                  style: const TextStyle(
                    color: AppColors.electricCyan,
                    fontSize: 10.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _BillingNotice extends StatelessWidget {
  const _BillingNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.electricCyan.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.electricCyan.withValues(alpha: 0.2)),
    ),
    child: Text(
      message,
      textAlign: TextAlign.center,
      style: const TextStyle(color: Colors.white, fontSize: 12, height: 1.5),
    ),
  );
}

class _GooglePlayPlansSheet extends StatelessWidget {
  const _GooglePlayPlansSheet({
    required this.products,
    required this.plans,
    required this.onSelect,
  });

  final List<ProductDetails> products;
  final Map<String, BillingPlan> plans;
  final ValueChanged<ProductDetails> onSelect;

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'اختر الباقة',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'يتم الدفع بأمان من خلال Google Play.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.75),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 18),
          ...products.map(
            (product) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: OutlinedButton(
                onPressed: () => onSelect(product),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.all(16),
                  side: BorderSide(
                    color: plans[product.id] == BillingPlan.familyPlus
                        ? AppColors.starGold.withValues(alpha: 0.65)
                        : Colors.white.withValues(alpha: 0.15),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            plans[product.id]?.label ?? product.title,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          if (product.description.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                product.description,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: AppColors.mutedText.withValues(
                                    alpha: 0.72,
                                  ),
                                  fontSize: 11,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      product.price,
                      style: const TextStyle(
                        color: AppColors.starGold,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.status});

  final BillingStatus status;

  @override
  Widget build(BuildContext context) {
    final subscription = status.subscription;
    final paid = status.plan.isPaid;

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF6A3DF2), Color(0xFF1B2550), Color(0xFF0B1026)],
        ),
        border: Border.all(
          color: AppColors.starGold.withValues(alpha: paid ? 0.42 : 0.16),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.cosmicPurple.withValues(alpha: 0.22),
            blurRadius: 24,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: paid
                      ? AppColors.success.withValues(alpha: 0.24)
                      : AppColors.mutedText.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  subscription?.statusLabel ?? 'بدون اشتراك',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const Spacer(),
              Icon(
                Icons.workspace_premium_rounded,
                color: paid
                    ? AppColors.starGold
                    : AppColors.starGold.withValues(alpha: 0.4),
                size: 28,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            status.plan.label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            paid
                ? 'الباقة سارية على هذا الحساب'
                : 'يمكنك تصفّح المكتبة المجانية بدون اشتراك',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.72),
              fontSize: 12,
            ),
          ),
          if (subscription != null) ...[
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 16,
              runSpacing: 8,
              children: [
                Text(
                  subscription.sourceLabel,
                  style: const TextStyle(
                    color: AppColors.starGold,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  subscription.expiresAt == null
                      ? 'بدون تاريخ انتهاء'
                      : 'حتى ${MaterialLocalizations.of(context).formatShortDate(subscription.expiresAt!.toLocal())}',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.72),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Shown while a payment is failing but access is still granted.
class _GraceWarning extends StatelessWidget {
  const _GraceWarning({required this.source});

  final String source;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.starGold.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.starGold.withValues(alpha: 0.32)),
    ),
    child: Row(
      children: [
        const Icon(
          Icons.warning_amber_rounded,
          color: AppColors.starGold,
          size: 20,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'هناك مشكلة في الدفع. الوصول ما زال متاحًا خلال مهلة السماح، '
            'راجع طريقة الدفع في $source.',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.9),
              fontSize: 11.5,
              height: 1.7,
            ),
          ),
        ),
      ],
    ),
  );
}

/// Plan caps and how much of each is currently used.
class _UsageSection extends StatelessWidget {
  const _UsageSection({required this.limits});

  final BillingLimits limits;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: 0.72),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'حدود الباقة',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 14),
        _UsageRow(
          icon: Icons.family_restroom_rounded,
          label: 'ملفات الأطفال',
          used: limits.usedChildren,
          total: limits.children,
        ),
        const SizedBox(height: 10),
        _UsageRow(
          icon: Icons.devices_rounded,
          label: 'الأجهزة المسجّلة',
          used: limits.usedDevices,
          total: limits.devices,
        ),
        const SizedBox(height: 14),
        const Divider(height: 1, color: Colors.white12),
        const SizedBox(height: 12),
        _LimitLine(
          label: 'مشاهدة متزامنة',
          value: '${limits.concurrentStreams}',
        ),
        const SizedBox(height: 6),
        _LimitLine(
          label: 'أجهزة التنزيل المحمي',
          value: limits.downloadDevices == 0
              ? 'غير متاح في هذه الباقة'
              : '${limits.downloadDevices}',
        ),
      ],
    ),
  );
}

class _UsageRow extends StatelessWidget {
  const _UsageRow({
    required this.icon,
    required this.label,
    required this.used,
    required this.total,
  });

  final IconData icon;
  final String label;
  final int used;
  final int total;

  @override
  Widget build(BuildContext context) {
    final ratio = total <= 0 ? 0.0 : (used / total).clamp(0.0, 1.0);
    final atLimit = total > 0 && used >= total;

    return Row(
      children: [
        Icon(icon, color: AppColors.mutedText, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    '$used / $total',
                    style: TextStyle(
                      color: atLimit
                          ? AppColors.starGold
                          : AppColors.mutedText.withValues(alpha: 0.72),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 4,
                  backgroundColor: Colors.white.withValues(alpha: 0.08),
                  valueColor: AlwaysStoppedAnimation(
                    atLimit ? AppColors.starGold : AppColors.electricCyan,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LimitLine extends StatelessWidget {
  const _LimitLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Expanded(
        child: Text(
          label,
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.82),
            fontSize: 11.5,
          ),
        ),
      ),
      const SizedBox(width: 12),
      Flexible(
        child: Text(
          value,
          textAlign: TextAlign.end,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    ],
  );
}

/// What the current plan does and does not include.
///
/// Derived from the plan tier rather than listed as fixed marketing copy, so a
/// free account is not shown paid features as if it already had them.
class _EntitlementsSection extends StatelessWidget {
  const _EntitlementsSection({required this.status});

  final BillingStatus status;

  @override
  Widget build(BuildContext context) {
    final paid = status.plan.isPaid;

    return Column(
      children: [
        const _Feature(
          icon: Icons.download_rounded,
          title: 'تنزيل الصوت العام',
          included: true,
          note:
              'مدعوم للمحتوى الصوتي العام فقط؛ الوسائط الخاصة المحمية غير متاحة دون اتصال.',
        ),
        const SizedBox(height: 10),
        _Feature(
          icon: Icons.family_restroom_rounded,
          title: 'ملفات متعددة للأطفال',
          included: status.limits.children > 1,
          note: 'حتى ${status.limits.children} ملف',
        ),
        const SizedBox(height: 10),
        _Feature(
          icon: Icons.hd_rounded,
          title: 'مشاهدة على أكثر من جهاز',
          included: status.limits.concurrentStreams > 1,
          note: '${status.limits.concurrentStreams} مشاهدة متزامنة',
        ),
        const SizedBox(height: 10),
        _Feature(
          icon: Icons.block_rounded,
          title: 'بدون إعلانات',
          included: paid,
          note: paid ? 'مضمّن' : 'مضمّن في الباقات المدفوعة',
        ),
      ],
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({
    required this.icon,
    required this.title,
    required this.included,
    required this.note,
  });

  final IconData icon;
  final String title;
  final bool included;
  final String note;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: included ? 0.72 : 0.4),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
    ),
    child: Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: included
                ? AppColors.cosmicPurple.withValues(alpha: 0.18)
                : Colors.white.withValues(alpha: 0.05),
            border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
          ),
          child: Icon(
            icon,
            color: included
                ? Colors.white
                : Colors.white.withValues(alpha: 0.4),
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: included
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.52),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              Text(
                note,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.7),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        Icon(
          included ? Icons.check_circle_rounded : Icons.remove_circle_outline,
          color: included
              ? AppColors.success
              : AppColors.mutedText.withValues(alpha: 0.4),
          size: 18,
        ),
      ],
    ),
  );
}

class _MembershipError extends StatelessWidget {
  const _MembershipError({
    required this.failure,
    required this.onRetry,
    required this.onSignIn,
  });

  final AppFailure failure;
  final VoidCallback onRetry;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final needsLogin = failure.kind == FailureKind.unauthorized;
    return Semantics(
      liveRegion: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            Icon(
              needsLogin
                  ? Icons.lock_outline_rounded
                  : Icons.cloud_off_outlined,
              color: AppColors.mutedText.withValues(alpha: 0.6),
              size: 46,
            ),
            const SizedBox(height: 14),
            Text(
              needsLogin ? 'يتطلب تسجيل الدخول' : 'تعذّر تحميل العضوية',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              needsLogin
                  ? 'العضوية مرتبطة بحساب الأسرة. سجّل الدخول لعرض باقتك وحدودها.'
                  : failure.message,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.72),
                fontSize: 12,
                height: 1.7,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: needsLogin ? onSignIn : onRetry,
              icon: Icon(
                needsLogin ? Icons.login_rounded : Icons.refresh_rounded,
              ),
              label: Text(needsLogin ? 'تسجيل الدخول' : 'إعادة المحاولة'),
            ),
          ],
        ),
      ),
    );
  }
}
