import 'package:flutter/foundation.dart';

/// Crash and uncaught-error capture (H8).
///
/// The audit found zero error handlers: no `FlutterError.onError`, no
/// `PlatformDispatcher.instance.onError`, no `runZonedGuarded`, no
/// `ErrorWidget.builder`. Any framework or async error therefore either
/// printed to a console nobody reads in release, or killed the isolate
/// silently.
///
/// ## No third-party provider yet
///
/// This deliberately does NOT add Sentry or Crashlytics. Both need a project
/// DSN / `google-services.json` that does not exist, and adding either would
/// mean a children's app sends diagnostics to a third party before the privacy
/// disclosure covering it is written. What this class does provide is the
/// single funnel every error now passes through, so wiring a provider later is
/// one method body rather than a hunt through the codebase.
///
/// ## PII
///
/// [report] never forwards the error object's `toString()` anywhere off-device.
/// Server error bodies routinely contain request payloads, so treating them as
/// potentially sensitive is the safe default.
abstract final class CrashReporter {
  /// Errors recorded this session, newest last. Bounded so a crash loop cannot
  /// grow without limit. Exposed for a future diagnostics screen.
  static final List<CrashRecord> recent = <CrashRecord>[];
  static const _maxRetained = 50;

  static void report(
    Object error,
    StackTrace? stack, {
    String? context,
    bool fatal = false,
  }) {
    final record = CrashRecord(
      error: error.toString(),
      stack: stack?.toString(),
      context: context,
      fatal: fatal,
      at: DateTime.now(),
    );

    recent.add(record);
    if (recent.length > _maxRetained) recent.removeAt(0);

    if (kDebugMode) {
      // ignore: avoid_print
      print('[crash]${fatal ? ' FATAL' : ''}${context == null ? '' : ' ($context)'} $error');
      if (stack != null) {
        // ignore: avoid_print
        print(stack);
      }
    }

    // Provider hook. See class docs for why this is intentionally empty.
  }
}

class CrashRecord {
  const CrashRecord({
    required this.error,
    required this.stack,
    required this.context,
    required this.fatal,
    required this.at,
  });

  final String error;
  final String? stack;
  final String? context;
  final bool fatal;
  final DateTime at;
}
