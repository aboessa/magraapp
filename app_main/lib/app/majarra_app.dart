import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' show SchedulerPhase;
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

  /// يُبطل إثبات وليّ الأمر عند مغادرة التطبيق للمقدّمة (`APP-107`).
  ///
  /// ## ما كان
  ///
  /// الإبطال كان مقصورًا على `detached` وحدها، وتعليقه يقول إن «مؤقّت الخمس دقائق
  /// يحدّ النافذة أصلًا» — و`AuthGuard.parentAccessDuration` **خمس عشرة دقيقة**.
  /// أي أن قارئ الكود يُطمَأن بنافذةٍ ثلثِ الحقيقية.
  ///
  /// وأثره: وليّ أمر يفتح منطقة الوالدين ثم يضع الجهاز جانبًا أو ينتقل إلى تطبيق
  /// آخر، فيبقى الوصول الأبوي **حيًّا خمس عشرة دقيقة** — وقد يمسك الطفل الجهاز
  /// خلالها. والمنطقة تحمل وقت الشاشة، ووقت النوم، وحذف الحساب.
  ///
  /// ## القرار: `paused` تُبطل على الجوال، و`detached` في كل مكان
  ///
  /// `paused` تعني أن التطبيق لم يبقَ في المقدّمة، وهي بالضبط اللحظة التي ينتقل
  /// فيها الجهاز إلى يدٍ أخرى. وكلفتها معروفة ومقبولة: وليّ الأمر الذي يعود بعد
  /// ثوانٍ يُعيد إدخال الرمز — وإعادة إدخال رمزٍ أرخص من نافذةٍ مفتوحة على ضوابط
  /// طفل.
  ///
  /// والويب مستثنًى من `paused` **لسببٍ مقيس لا احتياطًا**: العطل الأصلي كان حلقةً
  /// في شاشة الرمز (إدخال → تنقّل → فقدان تركيز → إبطال → عودة إلى الشاشة)، ولا
  /// نملك اليوم بيئة ويب مُختبَرة نتحقّق فيها أن `paused` لا تُطلقها. فيبقى الويب
  /// على `detached` حتى يُختبَر، والاستثناء مكتوب لا مُستنتَج.
  ///
  /// و`inactive` غير مشمولة قصدًا: تُطلقها إشعارات النظام ومركز التحكّم على iOS
  /// والتطبيق ما زال في يد وليّ الأمر.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final leftForeground = state == AppLifecycleState.detached ||
        (!kIsWeb && state == AppLifecycleState.paused);
    if (leftForeground) {
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
        // ‏`I18N-201`: الكتالوج هو ما يُعلَن، لا القائمة المولَّدة.
        //
        // كان هنا `AppLocalizations.supportedLocales`، وهي مُشتقّة من ملفات ARB
        // **الموجودة** لا من جهوزيتها. و`app_fr.arb` صار موجودًا بـ257 مفتاحًا،
        // فصارت الفرنسية تُعلَن لـMaterial بينما `AppLocales.french.completeness`
        // تقول `planned`. أي أن `locale_catalog.dart` يزعم أنه «البوابة الوحيدة
        // التي تستشيرها الواجهة، ولا علَم تمكينٍ ثانٍ يمكن أن يفترق» — وقد افترق.
        //
        // `materialSupported` تُعيد `[ar, en]` ويحرسها `locale_catalog_test`،
        // فالإعلان صار مربوطًا بالجهوزية المُقاسة لا بوجود ملف.
        supportedLocales: AppLocales.materialSupported,
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
        builder: (context, child) {
          final content = child ?? const SizedBox.shrink();
          // `APP-108`: قرار الاتجاه من بيانات المسار في `go_router`.
          //
          // كان `ModalRoute.of(context)?.settings.name?.contains('playback')`، و
          // هذا الموضع **فوق الـNavigator** فلا `ModalRoute` أعلاه: القيمة `null`
          // دائمًا. أي أن الشرط لم يكن هشًّا بل مكسورًا في اتجاهٍ ثابت — تُغطّى
          // شاشة المُشغِّل بـ«أدِر الجهاز» في الوضع الأفقي، وهو الوضع الذي يفتحه
          // المُشغِّل بنفسه للفيديو.
          //
          // و`ListenableBuilder` على المُفوِّض شرطٌ لا تحسين: القرار يتغيّر
          // بالتنقّل، وهذا الـ`builder` كان يُعاد بناؤه على تغيّر `MediaQuery`
          // وحده — فحتى لو صحّ الشرط لكان يتأخّر إلى أوّل دورة إطار أخرى.
          return InputModeTracker(
            child: _EnvironmentBanner(
              child: _OrientationGate(router: router, child: content),
            ),
          );
        },
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

/// بوابة الاتجاه: تقرأ المسار الحالي من `go_router` لتحديد ما إذا كان الأفقي
/// مسموحًا (`APP-108`)، مع تأجيل إعادة البناء خارج طور البناء.
///
/// ## لماذا لا `ListenableBuilder`
///
/// هذا الموضع داخل `MaterialApp.router(builder:)`، وهو **فوق** ودجت `Router`
/// نفسها. فالاشتراك المباشر على `router.routerDelegate` يجعل مستمعًا **سلفًا**
/// لشجرة الراوتر: أوّل إعادة توجيه (`/` → `/login`) يُخطر المُفوِّض مستمعيه
/// **أثناء بناء الشجرة تحته**، فيُوسم السلف «قذرًا» في منتصف بنائه ويسقط
/// `assert(!_dirty)` في `framework.dart` — وهو ما ظهر كـ
/// `(building _EnvironmentBanner) Assertion failed: !_dirty`.
///
/// والحلّ نفس حلّ `AuthGuard._scheduleNotify`: إن جاء الإخطار وسط إطارٍ جارٍ
/// يُؤجَّل `setState` إلى ما بعد الإطار، وإلا يُطبَّق فورًا.
class _OrientationGate extends StatefulWidget {
  const _OrientationGate({required this.router, required this.child});

  final GoRouter router;
  final Widget child;

  @override
  State<_OrientationGate> createState() => _OrientationGateState();
}

class _OrientationGateState extends State<_OrientationGate> {
  @override
  void initState() {
    super.initState();
    widget.router.routerDelegate.addListener(_onRouteChanged);
  }

  @override
  void didUpdateWidget(_OrientationGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.router != widget.router) {
      oldWidget.router.routerDelegate.removeListener(_onRouteChanged);
      widget.router.routerDelegate.addListener(_onRouteChanged);
    }
  }

  @override
  void dispose() {
    widget.router.routerDelegate.removeListener(_onRouteChanged);
    super.dispose();
  }

  void _onRouteChanged() {
    if (!mounted) return;
    final binding = WidgetsBinding.instance;
    // SchedulerPhase.idle == لسنا داخل build/layout/paint/commit.
    if (binding.schedulerPhase == SchedulerPhase.idle) {
      setState(() {});
      return;
    }
    // وسط إطارٍ جارٍ: نُؤجّل إلى ما بعده حتى لا نُوسم قذرين أثناء البناء.
    binding.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    // هاتف مضغوط في الأفقي (مثل 844×390): الشاشة تُكسر، فتُعرَض دعوةُ إدارة
    // الجهاز بدل تخطيط مشوَّه. والحدّ 900 يستثني الأجهزة اللوحية والتلفاز.
    final isLandscapeTooWide =
        media.size.width > media.size.height && media.size.width < 900;
    if (isLandscapeTooWide && !routeAllowsLandscape(widget.router)) {
      return const _PortraitRequiredScreen();
    }
    return widget.child;
  }
}

/// When phone is rotated to landscape (short side < 480), show a
/// child-friendly "rotate to portrait" screen instead of broken layout.
/// Video playback is exempt – handled by PlaybackPage itself.
class _PortraitRequiredScreen extends StatelessWidget {
  const _PortraitRequiredScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B1026),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 88,
                  height: 88,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.starGold.withValues(alpha: 0.14),
                    border: Border.all(color: AppColors.starGold.withValues(alpha: 0.24), width: 1.5),
                  ),
                  child: const Icon(Icons.screen_rotation_rounded, color: AppColors.starGold, size: 42),
                ),
                const SizedBox(height: 20),
                const Text(
                  'اقلب الجهاز عمودياً',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 10),
                const Text(
                  'مجرة مصممة للعرض العمودي فقط على الهاتف.\nالفيديو يدعم العرض الأفقي تلقائياً.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.mutedText, fontSize: 13, height: 1.6),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Corner ribbon marking a non-production build (DEV).
class _EnvironmentBanner extends StatelessWidget {
  const _EnvironmentBanner({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) {
    if (!AppConfig.showEnvironmentBanner) return child;
    return Banner(
      message: AppConfig.environmentLabel,
      location: BannerLocation.topStart,
      // لون واحد: البيئة غير الإنتاجية الوحيدة هي DEV بعد إزالة staging.
      color: const Color(0xFF8B0000),
      child: child,
    );
  }
}
