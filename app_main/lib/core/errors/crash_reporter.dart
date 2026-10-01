import 'dart:async';

import 'package:flutter/foundation.dart';

import 'crash_upload.dart';

/// Crash and uncaught-error capture (H8).
///
/// The audit found zero error handlers: no `FlutterError.onError`, no
/// `PlatformDispatcher.instance.onError`, no `runZonedGuarded`, no
/// `ErrorWidget.builder`. Any framework or async error therefore either
/// printed to a console nobody reads in release, or killed the isolate
/// silently.
///
/// ## First-party, not a third party (`OPS-202`)
///
/// Sentry and Crashlytics would send a children's app's diagnostics to a third
/// party before a privacy disclosure covers it. Reports go to the platform's own
/// API instead ([CrashUploader], `POST /api/v1/analytics/crashes`) and appear
/// in the dashboard's «تشخيص التطبيق».
///
/// ## PII
///
/// [report] never forwards the error object's `toString()` anywhere off-device;
/// [CrashPayload] carries only the runtime type and shaped stack frames.
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
      // `debugPrint` لا `print`: هي قناة Flutter المعتمدة (تُخنَق عند الإغراق
      // ولا تُطبَع في الإصدار)، فتزول الحاجة إلى إسكات `avoid_print` سطرًا
      // بسطر — وكل إسكاتٍ زائل هو قاعدةٌ تعمل من جديد (`DEBT-102`).
      debugPrint(
        '[crash]${fatal ? ' FATAL' : ''}${context == null ? '' : ' ($context)'} $error',
      );
      if (stack != null) debugPrintStack(stackTrace: stack);
    }

    // OPS-202: first-party upload, privacy-shaped (type + frames, no message).
    final sink = uploader;
    if (sink != null) {
      unawaited(
        sink.enqueue(
          CrashPayload.from(
            error,
            stack,
            context: context,
            fatal: fatal,
            at: record.at,
          ),
        ),
      );
    }
  }

  /// Installed by `main.dart` in production release builds only (`OPS-202`).
  static CrashUploader? uploader;
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
