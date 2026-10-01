import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/majarra_app.dart';
import 'core/device/device_profile.dart';
import 'core/env/app_version.dart';
import 'core/env/app_environment.dart';
import 'core/errors/crash_reporter.dart';
import 'core/errors/crash_upload.dart';
import 'core/widgets/fatal_error_view.dart';
import 'features/downloads/application/download_providers.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Resolve device profile early so TV orientation (landscape) and UI mode
    // are ready synchronously without transient orientation jumps or phone layouts.
    final deviceProfile = await DeviceProfileService().load();

    // ── Orientation Lock ──
    // Kids app should NOT rotate on phones – locks to portrait.
    // On TV, orientation is locked to landscape (never force portrait on a TV!).
    if (!kIsWeb) {
      try {
        if (deviceProfile.isTelevision) {
          await SystemChrome.setPreferredOrientations([
            DeviceOrientation.landscapeLeft,
            DeviceOrientation.landscapeRight,
          ]);
        } else {
          await SystemChrome.setPreferredOrientations([
            DeviceOrientation.portraitUp,
            DeviceOrientation.portraitDown,
          ]);
        }
      } catch (_) {
        // Safe ignore – can fail in tests
      }
    }

    // Resolve SharedPreferences once at startup so synchronous consumers (the
    // download manager restores its metadata in its constructor) can read it
    // through a provider override rather than awaiting on every access.
    final prefs = await SharedPreferences.getInstance();

    // The running build's version, read once before any request goes out: the
    // API client sends it as `X-App-Version` and the forced-update gate compares
    // against it. Both used to use a hardcoded '0.1.0'. A failed read resolves
    // to 0.0.0, which is older than every published minimum, so the gate errs
    // towards prompting an update rather than towards allowing an unsupported
    // build to keep running.
    await AppVersion.load();

    // OPS-202: crash reports to the platform's own API, production release
    // only. Flushes whatever the previous run queued before it died.
    if (kReleaseMode && AppConfig.isProduction) {
      final uploader = CrashUploader(
        deviceKind: kIsWeb
            ? 'web'
            : (deviceProfile.isTelevision ? 'tv' : 'phone'),
      );
      CrashReporter.uploader = uploader;
      unawaited(uploader.flush());
    }

    // Framework errors (build, layout, paint).
    final previousOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      try {
        CrashReporter.report(
          details.exception,
          details.stack,
          context: details.context?.toDescription() ?? 'flutter',
          fatal: false,
        );
      } catch (_) {}

      // On Flutter Web with DDC, `dumpErrorToConsole` (the default `previousOnError`)
      // triggers a known engine/inspector bug in `widget_inspector.dart` (line 4124:
      // `debugTransformDebugCreator` throws `TypeError: Instance of 'LegacyJavaScriptObject'
      // is not a subtype of type 'DiagnosticsNode'`), which throws inside the error handler
      // and triggers an infinite recursive error loop and DevTools spam.
      // On web we safely log using debugPrint instead of traversing the inspector tree.
      if (kIsWeb) {
        try {
          debugPrint(
            '⚠️ Flutter error [${details.context?.toDescription() ?? 'flutter'}]: ${details.exceptionAsString()}',
          );
          if (details.stack != null) {
            debugPrint(details.stack.toString());
          }
        } catch (_) {}
      } else {
        try {
          previousOnError?.call(details);
        } catch (_) {}
      }
    };

    // Errors that reach the engine without passing through FlutterError,
    // for example a failed platform channel reply.
    PlatformDispatcher.instance.onError = (error, stack) {
      try {
        CrashReporter.report(error, stack, context: 'platform_dispatcher');
      } catch (_) {}
      return true;
    };

    // Replaces the grey/red default with a readable Arabic surface. Debug
    // keeps Flutter's own view because it carries the stack trace.
    ErrorWidget.builder = (details) {
      if (kReleaseMode) {
        return FatalErrorView();
      }
      if (kIsWeb) {
        return Material(
          color: Color(0xFF0B1026),
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                AppLocalizationsAr().mainText01(details.exceptionAsString()),
                style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                textDirection: TextDirection.rtl,
                textAlign: TextAlign.center,
              ),
            ),
          ),
        );
      }
      return ErrorWidget(details.exception);
    };

    _registerBundledFontLicenses();
    runApp(
      ProviderScope(
        overrides: [
          sharedPreferencesProvider.overrideWithValue(prefs),
          deviceProfileProvider.overrideWith((ref) async => deviceProfile),
          currentDeviceProfileProvider.overrideWithValue(deviceProfile),
        ],
        child: const MajarraApp(),
      ),
    );
  }, (error, stack) => CrashReporter.report(error, stack, context: 'zone', fatal: true));
}

/// Surfaces the SIL Open Font License for the bundled Readex Pro files in the
/// standard "Licenses" page (`showLicensePage`).
///
/// The OFL requires its text to accompany the font, so this is a licence
/// obligation, not a nicety.
void _registerBundledFontLicenses() {
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString('assets/fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(const ['Readex Pro'], license);
  });
}
