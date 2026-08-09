import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/env/app_environment.dart';
import '../core/input/input_mode.dart';
import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'theme/app_theme.dart';

class MajarraApp extends ConsumerWidget {
  const MajarraApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'مجرة',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      routerConfig: router,
      // Arabic is pinned rather than following the device locale: the ARB for
      // English exists but only covers the strings migrated so far, so letting
      // an English device pick `en` would show a half-translated app. Remove
      // this line once migration is complete.
      locale: const Locale('ar'),
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      // Remote and gamepad keys that Android TV sends but Flutter does not map
      // to ActivateIntent by default. Without these, the select button and the
      // gamepad A button do nothing on focused controls that rely on Material's
      // default activation.
      shortcuts: <ShortcutActivator, Intent>{
        ...WidgetsApp.defaultShortcuts,
        const SingleActivator(LogicalKeyboardKey.select): const ActivateIntent(),
        const SingleActivator(LogicalKeyboardKey.gameButtonA):
            const ActivateIntent(),
      },
      builder: (context, child) {
        final media = MediaQuery.of(context);
        return MediaQuery(
          // The layout uses fixed control heights and small caption sizes, so an
          // unbounded system font scale clips text. Clamping keeps the large-text
          // accessibility setting useful without breaking rails and cards.
          data: media.copyWith(
            textScaler: media.textScaler.clamp(
              minScaleFactor: 0.9,
              maxScaleFactor: 1.3,
            ),
          ),
          child: InputModeTracker(
            child: _EnvironmentBanner(
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        );
      },
    );
  }
}

/// Corner ribbon marking non-production builds (STAGING / DEV).
///
/// Renders nothing in production, so it can never ship a banner to an end user.
/// Uses [Directionality] from the surrounding app so it sits in the leading
/// corner regardless of text direction.
class _EnvironmentBanner extends StatelessWidget {
  const _EnvironmentBanner({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (!AppConfig.showEnvironmentBanner) return child;
    return Banner(
      message: AppConfig.environmentLabel,
      location: BannerLocation.topStart,
      color: AppConfig.isStaging ? const Color(0xFFB8860B) : const Color(0xFF8B0000),
      child: child,
    );
  }
}
