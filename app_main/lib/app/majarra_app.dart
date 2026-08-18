import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/env/app_environment.dart';
import '../core/env/app_version.dart';
import '../core/errors/crash_reporter.dart';
import '../core/input/input_mode.dart';
import '../core/l10n/locale_catalog.dart';
import '../features/auth/application/auth_controller.dart';
import '../features/home/application/home_providers.dart';
import '../l10n/app_localizations.dart';
import 'router/app_router.dart';
import 'router/auth_guard.dart';
import 'theme/app_colors.dart';
import 'theme/app_theme.dart';

class MajarraApp extends ConsumerStatefulWidget {
  const MajarraApp({super.key});

  @override
  ConsumerState<MajarraApp> createState() => _MajarraAppState();
}

class _MajarraAppState extends ConsumerState<MajarraApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      ref.read(authGuardProvider).revokeParentAccess();
    }
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(authBootstrapProvider);
    if (bootstrap.isLoading) {
      return const _AuthBootstrapScreen();
    }
    if (bootstrap.hasError) {
      return _AuthBootstrapScreen(
        failed: true,
        onRetry: () => ref.invalidate(authBootstrapProvider),
      );
    }

    // The router and its route providers are not constructed until persisted
    // auth has resolved and any terminal account-scoped wipe has fully succeeded.
    final router = ref.watch(routerProvider);
    // Min version enforcement handled via overlay — check async without blocking router build
    return _VersionGate(
      child: MaterialApp.router(
        title: 'مجرة',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.dark,
        routerConfig: router,
        // The locale is pinned to the only language whose translation is actually
        // complete (see `core/l10n/locale_catalog.dart`, enforced by
        // locale_catalog_test). English/French delegates are declared so the
        // architecture is ready, but the app never follows a device locale into a
        // half-translated language. When a locale's coverage reaches the threshold
        // its flag flips to `complete` and it becomes selectable.
        locale: AppLocales.fallback.locale,
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
          const SingleActivator(LogicalKeyboardKey.select):
              const ActivateIntent(),
          const SingleActivator(LogicalKeyboardKey.gameButtonA):
              const ActivateIntent(),
        },
        builder: (context, child) => InputModeTracker(
          child: _EnvironmentBanner(child: child ?? const SizedBox.shrink()),
        ),
      ),
    );
  }
}

class _AuthBootstrapScreen extends StatelessWidget {
  const _AuthBootstrapScreen({this.failed = false, this.onRetry});

  final bool failed;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'مجرة',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark,
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          backgroundColor: AppColors.deepSpace,
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: failed
                    ? Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.security_rounded,
                            color: AppColors.starGold,
                            size: 48,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'تعذّر تأمين بيانات الجلسة السابقة',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'لن يفتح التطبيق قبل اكتمال المسح المحلي. أعد المحاولة.',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white70),
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: onRetry,
                            child: const Text('إعادة المحاولة'),
                          ),
                        ],
                      )
                    : Semantics(
                        label: 'جارٍ تأمين الجلسة',
                        child: const CircularProgressIndicator(
                          color: AppColors.starGold,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _VersionGate extends ConsumerStatefulWidget {
  const _VersionGate({required this.child});
  final Widget child;
  @override
  ConsumerState<_VersionGate> createState() => _VersionGateState();
}

class _VersionGateState extends ConsumerState<_VersionGate> {
  bool _blocked = false;
  String? _updateUrl;

  @override
  void initState() {
    super.initState();
    _check();
  }

  Future<void> _check() async {
    try {
      // The running build's version, not a literal. `'0.1.0'` was hardcoded here,
      // so the gate could never fire for any build whose real version differed —
      // which is every build. A failed read resolves to `0.0.0`, older than every
      // published minimum, so the gate errs towards prompting an update.
      final current = await AppVersion.load();
      final api = ref.read(majarraApiClientProvider);
      final res = await api.fetchAppConfig();
      final data = res['data'] as Map<String, dynamic>?;
      final minVer = data?['min_app_version']?.toString();
      if (minVer != null && minVer.isNotEmpty) {
        if (_isOlder(current, minVer)) {
          setState(() {
            _blocked = true;
            _updateUrl = data?['forced_update_url']?.toString();
          });
        }
      }
    } catch (error, stackTrace) {
      // Reported, not swallowed. A version gate that cannot run is an outage of a
      // release control, and `catch (_) {}` made it indistinguishable from a build
      // that passed the check.
      CrashReporter.report(
        error,
        stackTrace,
        context: 'min_app_version check failed',
      );
    }
  }

  bool _isOlder(String cur, String min) {
    List<int> parse(String v) =>
        v.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    final c = parse(cur);
    final m = parse(min);
    for (var i = 0; i < 3; i++) {
      final cv = i < c.length ? c[i] : 0;
      final mv = i < m.length ? m[i] : 0;
      if (cv < mv) return true;
      if (cv > mv) return false;
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    if (_blocked) {
      return Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(
          backgroundColor: const Color(0xFF0B1026),
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.system_update_rounded,
                    color: Colors.white,
                    size: 64,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'تحديث مطلوب',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'إصدار التطبيق الحالي غير مدعوم. يرجى التحديث للمتابعة.',
                    style: TextStyle(color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                  if (_updateUrl != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _updateUrl!,
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      );
    }
    return widget.child;
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
      color: AppConfig.isStaging
          ? const Color(0xFFB8860B)
          : const Color(0xFF8B0000),
      child: child,
    );
  }
}
