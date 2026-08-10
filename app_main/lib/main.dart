import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/majarra_app.dart';
import 'core/errors/crash_reporter.dart';
import 'core/widgets/fatal_error_view.dart';
import 'features/downloads/application/download_providers.dart';

void main() {
  // Every uncaught error now funnels through CrashReporter (H8). Previously
  // there were no handlers at all: a framework error printed to a console
  // nobody reads in release, and an async error killed the isolate silently.
  runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // Resolve SharedPreferences once at startup so synchronous consumers (the
      // download manager restores its metadata in its constructor) can read it
      // through a provider override rather than awaiting on every access.
      final prefs = await SharedPreferences.getInstance();

      // Framework errors (build, layout, paint).
      final previousOnError = FlutterError.onError;
      FlutterError.onError = (details) {
        CrashReporter.report(
          details.exception,
          details.stack,
          context: details.context?.toDescription() ?? 'flutter',
          fatal: false,
        );
        // Keep the default handler so debug builds still get the red screen
        // and the usual console dump.
        previousOnError?.call(details);
      };

      // Errors that reach the engine without passing through FlutterError,
      // for example a failed platform channel reply.
      PlatformDispatcher.instance.onError = (error, stack) {
        CrashReporter.report(error, stack, context: 'platform_dispatcher');
        return true;
      };

      // Replaces the grey/red default with a readable Arabic surface. Debug
      // keeps Flutter's own view because it carries the stack trace.
      if (kReleaseMode) {
        ErrorWidget.builder = (details) => const FatalErrorView();
      }

      _registerBundledFontLicenses();
      runApp(
        ProviderScope(
          overrides: [
            sharedPreferencesProvider.overrideWithValue(prefs),
          ],
          child: const MajarraApp(),
        ),
      );
    },
    (error, stack) => CrashReporter.report(
      error,
      stack,
      context: 'zone',
      fatal: true,
    ),
  );
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
