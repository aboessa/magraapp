import 'package:flutter/foundation.dart';

/// الهدفان اللذان يمكن بناء التطبيق لهما.
///
/// يُختار وقت البناء بـ`--dart-define=MAJARRA_ENV=<name>`. أي قيمة غير
/// `development` تُحلّ إلى [production]، فخطأ مطبعي في الـdefine لا يمكن أن
/// يُرخي قائمة سماح الإنتاج.
///
/// ## لا توجد بيئة staging
///
/// قرار مالك (2026-08-26): المنتج في مرحلة تطوير وكل شيء يعمل على الإنتاج
/// مباشرة، ولا نية لتوفير بيئة وسطى. كان هناك عضو `staging` في هذا التعداد
/// ومضيف خاص به وسكربتا نشر وترحيل — وكلها لم تكن تشير إلى شيء موجود: السكربتان
/// يطبعان رسالة ويخرجان بخطأ، والمضيف لا يُحلّ في DNS، وافتراضي البيئة كان
/// يُوجَّه إلى الإنتاج على أي حال. عضو تعداد يعني «شيء لم يُنشأ بعد» يجعل كل
/// `switch` عليه فرعًا ميتًا وكل قارئ يظن أن هناك تمييزًا.
///
/// المتبقي هو ما يعمل فعلًا: [development] لبناء محلي يستطيع تجاوز العنوان إلى
/// loopback، و[production] لكل ما عدا ذلك.
enum AppEnvironment { development, production }

/// Result of validating a candidate API base URL against an environment's
/// allowlist. [reason] is populated only when [isValid] is false and is a
/// developer-facing English string (it never reaches an end user).
@immutable
class ApiUrlDecision {
  const ApiUrlDecision._(this.isValid, this.url, this.reason);

  const ApiUrlDecision.valid(String url) : this._(true, url, null);
  const ApiUrlDecision.rejected(String reason) : this._(false, null, reason);

  final bool isValid;
  final String? url;
  final String? reason;
}

/// Environment configuration and the API base-URL allowlist policy (H10/B11).
///
/// ## Why an allowlist
///
/// The previous implementation exposed `--dart-define=API_BASE_URL` with no
/// validation whatsoever: any string was accepted and used verbatim as the base
/// of every request, including the authenticated ones. A release build could be
/// pointed at an arbitrary `http://` host that would then receive the family's
/// bearer token. This class makes the override a request to use a host, which is
/// granted only if the host is on the allowlist for the selected environment.
///
/// مضيف واحد قانوني بلا انقسام staging: كل بناء يتحدث إلى `api.majarra.app`،
/// وبناء التطوير يستطيع تجاوزه إلى loopback عبر `API_BASE_URL`.
abstract final class AppConfig {
  // --- Approved hosts -------------------------------------------------------

  /// The only production + development API host.
  static const _productionHost = 'api.majarra.app';

  /// Superseded workers.dev host, retained on the development allowlist only so
  /// an internal build can still reach it while it is decommissioned.
  static const _legacyWorkersHost = 'majarra-api-prod.aboessa101.workers.dev';

  /// Hosts that are always acceptable when *not* building for production, used
  /// for a worker running on the developer's machine or emulator.
  ///
  /// `10.0.2.2` is the host loopback as seen from the Android emulator.
  static const _loopbackHosts = {
    'localhost',
    '127.0.0.1',
    '10.0.2.2',
  };

  // --- Environment selection ------------------------------------------------

  static const _rawEnv = String.fromEnvironment('MAJARRA_ENV', defaultValue: 'production');

  static AppEnvironment get environment {
    switch (_rawEnv.trim().toLowerCase()) {
      case 'development':
      case 'dev':
        return AppEnvironment.development;
      default:
        // Any unrecognised value fails safe to production. `staging` is one of
        // those values now: there is no staging environment, so a build asking
        // for it gets production rather than a half-configured target.
        return AppEnvironment.production;
    }
  }

  static bool get isProduction => environment == AppEnvironment.production;
  static bool get isDevelopment => environment == AppEnvironment.development;

  // --- Feature flags derived from environment -------------------------------

  /// Verbose network/logging is enabled off-production only.
  static bool get verboseLogging => !isProduction;

  /// Whether analytics events are dispatched. Off in development so local runs
  /// do not pollute product metrics; on for production.
  static bool get analyticsEnabled => !isDevelopment;

  /// Whether to show the small environment banner overlay. Never in production.
  static bool get showEnvironmentBanner => !isProduction;

  /// Short human label for the environment banner.
  static String get environmentLabel {
    switch (environment) {
      case AppEnvironment.development:
        return 'DEV';
      case AppEnvironment.production:
        return 'PROD';
    }
  }

  // --- Base URL resolution --------------------------------------------------

  static String get _defaultHostForEnvironment => _productionHost;

  static const _rawOverride = String.fromEnvironment('API_BASE_URL', defaultValue: '');

  /// The effective API base URL, after applying and validating any override.
  ///
  /// If the override is empty, the environment default is used. If it is set but
  /// rejected by [validateBaseUrl], the override is ignored and the environment
  /// default is used instead — a build must never silently target a host the
  /// policy refused. In debug/profile a rejected override also trips an
  /// assertion so the misconfiguration is caught during development.
  static String get baseUrl {
    if (_rawOverride.isEmpty) {
      return 'https://$_defaultHostForEnvironment';
    }
    final decision = validateBaseUrl(_rawOverride, environment: environment);
    if (decision.isValid) return decision.url!;
    assert(
      false,
      'API_BASE_URL override rejected (${decision.reason}); '
      'falling back to $_defaultHostForEnvironment',
    );
    return 'https://$_defaultHostForEnvironment';
  }

  // --- Public asset (CDN) base ----------------------------------------------

  /// مضيف الأصول العامة (الأغلفة والصور المنشورة) عبر الـCDN.
  ///
  /// نطاقٌ مستقلّ عن مضيف الـAPI بحكم البنية: الأصول من دلو R2 عامّ أمامه
  /// `cdn.majarra.app`، والـAPI على `api.majarra.app`.
  static const String assetHost = 'cdn.majarra.app';

  /// أصل الأصول العامة، مصدرًا واحدًا (`APP-103`).
  ///
  /// كان النطاق مُعلَنًا **ثلاث مرّات مستقلّة** — `_cdnBase` في `content_dtos.dart`
  /// و`kR2Base` في `image_slot.dart` — ومكتوبًا حرفيًّا **إحدى وخمسين مرّة** في
  /// `local_catalog.dart`، ومقارَنًا كمضيف مسموح في `bundled_story_assets.dart`.
  ///
  /// فتغيير النطاق كان يعني أربعة مواضع والاعتماد على أن أحدًا لم ينسَ سطرًا.
  /// والنسيان هنا لا يظهر كخطأ ترجمة، بل **كصورةٍ مكسورة عند طفل** — أو أسوأ: في
  /// موضع التحقّق، كأصلٍ صحيح يُرفَض بلا سبب ظاهر.
  ///
  /// ولا يُقبَل تجاوزٌ من بيئة التشغيل: عنوان الأصول ليس نقطة تكامل مع مشغّل، وكل
  /// تجاوزٍ مقبول هنا يفتح بابًا لتوجيه صور الأطفال إلى أصل آخر. النطاق يتغيّر
  /// بإصدار.
  /// و`const` لا getter: تُستخدَم داخل خرائط `const` للأغلفة، وgetter كان يُجبر
  /// على إسقاط `const` عن كاتالوج كامل مكتوب في الكود.
  static const String assetBaseUrl = 'https://$assetHost';

  /// The set of hosts acceptable for [env].
  static Set<String> allowedHosts(AppEnvironment env) {
    switch (env) {
      case AppEnvironment.production:
        return const {_productionHost};
      case AppEnvironment.development:
        // بناء التطوير يصل إلى الإنتاج (لا توجد بيئة أخرى)، وإلى loopback عبر
        // تجاوز `API_BASE_URL` لتشغيل wrangler محليًّا، وإلى مضيف workers.dev
        // القديم حتى يُسحب من الخدمة.
        //
        // قائمة الإنتاج أعلاه تبقى مضيفًا واحدًا: بناء إصدار لا يجوز إعادة
        // توجيهه إلى أي أصل آخر، ولا حتى loopback.
        return {
          _productionHost,
          _legacyWorkersHost,
          ..._loopbackHosts,
        };
    }
  }

  /// Validates a candidate base URL against the allowlist for [environment].
  ///
  /// Rejects, in order: unparseable URLs, unexpected schemes, credential-bearing
  /// authorities, plain `http` to a non-loopback host, and any host not on the
  /// environment's allowlist. A loopback host may use `http` off production
  /// because a locally-run worker is not reached over TLS.
  static ApiUrlDecision validateBaseUrl(
    String candidate, {
    required AppEnvironment environment,
  }) {
    final trimmed = candidate.trim();
    if (trimmed.isEmpty) {
      return const ApiUrlDecision.rejected('empty URL');
    }

    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      return const ApiUrlDecision.rejected('malformed URL');
    }

    final scheme = uri.scheme.toLowerCase();
    if (scheme != 'https' && scheme != 'http') {
      return ApiUrlDecision.rejected('unexpected scheme "$scheme"');
    }

    // A `user:password@host` authority would leak credentials into every
    // request line and is never legitimate for an API base.
    if (uri.userInfo.isNotEmpty) {
      return const ApiUrlDecision.rejected('URL must not contain credentials');
    }

    final host = uri.host.toLowerCase();
    final isLoopback = _loopbackHosts.contains(host);

    if (scheme == 'http' && !isLoopback) {
      return const ApiUrlDecision.rejected('plain http is only allowed for loopback');
    }

    if (!allowedHosts(environment).contains(host)) {
      return ApiUrlDecision.rejected('host "$host" is not on the $environment allowlist');
    }

    // A trailing slash or path is harmless; normalise to origin so callers can
    // append `/api/v1/...` without doubling separators.
    final normalized = Uri(scheme: scheme, host: host, port: uri.hasPort ? uri.port : null);
    return ApiUrlDecision.valid(normalized.toString());
  }
}
