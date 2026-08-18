import 'package:package_info_plus/package_info_plus.dart';

/// The version of the build that is actually running.
///
/// ## Why this exists
///
/// The forced-update gate compared against a hardcoded `'0.1.0'`, and the
/// `X-App-Version` header sent to the API was the same literal. Both were
/// therefore lies the moment a real version shipped: the server could publish any
/// `min_app_version` it liked and the gate would never fire, while platform and
/// version analytics were fed a constant.
///
/// Read once and cached, because it is asked for on every request. A failure to
/// read is reported by [readFailed] rather than swallowed: a gate that cannot
/// establish its own version must not silently conclude that it passes.
abstract final class AppVersion {
  /// Used until the real version has been read, and if reading fails.
  ///
  /// Deliberately `0.0.0`: it is **older than every published minimum**, so a
  /// failed read errs towards prompting an update rather than towards allowing an
  /// unsupported build to keep running.
  static const String unknown = '0.0.0';

  static String? _cached;
  static bool _readFailed = false;

  /// True when the platform could not report the version.
  static bool get readFailed => _readFailed;

  /// The cached value, or [unknown] before [load] has completed.
  static String get current => _cached ?? unknown;

  /// Reads the version from the package metadata. Safe to call more than once.
  static Future<String> load() async {
    final cached = _cached;
    if (cached != null) return cached;
    try {
      final info = await PackageInfo.fromPlatform();
      final version = info.version.trim();
      _cached = version.isEmpty ? unknown : version;
      _readFailed = version.isEmpty;
    } catch (_) {
      _cached = unknown;
      _readFailed = true;
    }
    return _cached!;
  }

  /// Test seam. Production code never calls this.
  static void overrideForTest(String? version, {bool failed = false}) {
    _cached = version;
    _readFailed = failed;
  }
}
