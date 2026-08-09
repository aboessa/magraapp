import 'package:flutter/foundation.dart';

/// The three deployment targets the app can be built for.
///
/// Selected at build time with `--dart-define=MAJARRA_ENV=<name>`. Anything
/// other than `staging` or `development` resolves to [production] so a typo in
/// the define can never accidentally relax the production allowlist.
enum AppEnvironment { development, staging, production }

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
/// Production accepts only approved HTTPS Majarra hosts. Development and staging
/// additionally accept the staging host and loopback (for a locally-run worker),
/// but still reject plain-`http` remote hosts, credential-bearing URLs, and
/// unexpected schemes.
abstract final class AppConfig {
  // --- Approved hosts -------------------------------------------------------

  /// The canonical production API host.
  static const _productionHost = 'api.majarra.app';

  /// The staging host. It currently resolves to the same worker as production
  /// because no isolated staging backend exists yet (A3 — EXTERNAL BLOCKER,
  /// infrastructure not code). Kept as a distinct constant so that the day a
  /// real staging environment is provisioned, only this value changes.
  static const _stagingHost = 'staging-api.majarra.app';

  /// Superseded workers.dev host, retained on the development/staging allowlist
  /// only so an internal build can still reach it while it is decommissioned.
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
      case 'staging':
        return AppEnvironment.staging;
      default:
        // Any unrecognised value fails safe to production.
        return AppEnvironment.production;
    }
  }

  static bool get isProduction => environment == AppEnvironment.production;
  static bool get isStaging => environment == AppEnvironment.staging;
  static bool get isDevelopment => environment == AppEnvironment.development;

  // --- Feature flags derived from environment -------------------------------

  /// Verbose network/logging is enabled off-production only.
  static bool get verboseLogging => !isProduction;

  /// Whether analytics events are dispatched. Off in development so local runs
  /// do not pollute product metrics; on for staging and production.
  static bool get analyticsEnabled => !isDevelopment;

  /// Whether to show the small environment banner overlay. Never in production.
  static bool get showEnvironmentBanner => !isProduction;

  /// Short human label for the environment banner.
  static String get environmentLabel {
    switch (environment) {
      case AppEnvironment.development:
        return 'DEV';
      case AppEnvironment.staging:
        return 'STAGING';
      case AppEnvironment.production:
        return 'PROD';
    }
  }

  // --- Base URL resolution --------------------------------------------------

  static String get _defaultHostForEnvironment {
    switch (environment) {
      case AppEnvironment.production:
        return _productionHost;
      case AppEnvironment.staging:
        return _stagingHost;
      case AppEnvironment.development:
        // Default a development build to the staging host, not localhost: most
        // developers run the app against staging and only override when they
        // have a worker running locally.
        return _stagingHost;
    }
  }

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

  /// The set of hosts acceptable for [env].
  static Set<String> allowedHosts(AppEnvironment env) {
    switch (env) {
      case AppEnvironment.production:
        return const {_productionHost};
      case AppEnvironment.staging:
      case AppEnvironment.development:
        return {
          _productionHost,
          _stagingHost,
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
