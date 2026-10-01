import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/device/device_profile.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/images/heavy_assets.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/installation_identity.dart';
import '../../../tv/data/tv_session_origin.dart';

enum _LoginErrorKind {
  none,
  invalidCredentials,
  emailNotVerified,
  pendingDeletion,
  generic,
}

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _emailFocus = FocusNode(debugLabel: 'login_email');
  final _passFocus = FocusNode(debugLabel: 'login_password');
  final _submitFocus = FocusNode(debugLabel: 'login_submit');
  final _forgotFocus = FocusNode(debugLabel: 'login_forgot');
  final _demoFocus = FocusNode(debugLabel: 'login_demo');
  final _registerFocus = FocusNode(debugLabel: 'login_register');
  bool _obscure = true;
  bool _loading = false;
  bool _sentToPairing = false;

  _LoginErrorKind _errorKind = _LoginErrorKind.none;
  String? _errorMessage;
  Map<String, dynamic>? _errorMeta;

  // Email verification resend
  bool _resending = false;
  int _resendCountdown = 0;
  Timer? _countdownTimer;

  @override
  void dispose() {
    _email.dispose();
    _pass.dispose();
    _emailFocus.dispose();
    _passFocus.dispose();
    _submitFocus.dispose();
    _forgotFocus.dispose();
    _demoFocus.dispose();
    _registerFocus.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return 'أدخل البريد الإلكتروني';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'أدخل بريدًا إلكترونيًا صالحًا';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'أدخل كلمة المرور';
    return null;
  }

  String _obscuredEmail(String email) {
    final parts = email.split('@');
    if (parts.length != 2) return email;
    final local = parts[0];
    if (local.length <= 2) return '${local[0]}***@${parts[1]}';
    return '${local[0]}***${local.substring(local.length - 1)}@${parts[1]}';
  }

  void _startResendCountdown([int seconds = 60]) {
    _countdownTimer?.cancel();
    setState(() => _resendCountdown = seconds);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) {
        t.cancel();
        return;
      }
      if (_resendCountdown <= 1) {
        t.cancel();
        setState(() => _resendCountdown = 0);
      } else {
        setState(() => _resendCountdown--);
      }
    });
  }

  Future<void> _resendVerification() async {
    if (_resending || _resendCountdown > 0) return;
    setState(() => _resending = true);
    try {
      await ref
          .read(majarraApiClientProvider)
          .resendVerification(email: _email.text.trim());
      if (!mounted) return;
      setState(() {
        _errorMessage = 'تم إرسال رابط جديد';
      });
      _startResendCountdown(60);
    } catch (error) {
      if (!mounted) return;
      setState(() => _errorMessage = AppFailure.fromException(error).message);
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  // Demo family – production + local, both have real data
  // Local:  demo.family@majarra.app (http://127.0.0.1:8787)
  // Prod:   demo.family@majarra.app + demo.family2@majarra.app (https://api.majarra.app)
  // Both have PIN 3535 (or 353535 for 6 digits) and 3 children: ليلى, أحمد, سارة – all under same family, package active
  static const _demoFamilyEmails = [
    'demo.family@majarra.app',
    'demo.family2@majarra.app',
  ];
  static const _demoFamilyPassword = 'DemoFamily123!@#';

  // Single family account – as requested: one button, then inside choose child profile
  Future<void> _useDemoFamily() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _errorKind = _LoginErrorKind.none;
      _errorMessage = null;
    });

    try {
      final api = ref.read(majarraApiClientProvider);
      final storage = ref.read(authStorageProvider);
      final guard = ref.read(authGuardProvider);

      Map<String, dynamic>? loginData;
      // Fixed installation ID for demo family to avoid device-limit bloat.
      // Each browser normally generates a random ID via SharedPreferences, but
      // repeated test runs with cleared storage created 13+ devices and hit the
      // family plan limit (4). Using a constant ID makes all demo logins reuse
      // the same device record.
      const demoInstallationId = 'demo-family-web-fixed-12345678';
      // TV-005: on a television the demo family is a real TV sign-in with this
      // TV's own identity, so it lands in the TV allowance, not as "web".
      final isTv = ref.read(currentDeviceProfileProvider).isTelevision;
      final installationId = isTv
          ? await ref.read(installationIdentityProvider).getOrCreate()
          : demoInstallationId;
      for (final email in _demoFamilyEmails) {
        try {
          final res = await api.login(
            email: email,
            password: _demoFamilyPassword,
            installationId: installationId,
            platform: isTv ? 'android_tv' : 'web',
            deviceName: isTv ? await televisionLabel() : 'متصفح تجريبي',
          );
          final data = res['data'] as Map<String, dynamic>?;
          if (data != null && data['access_token'] != null) {
            loginData = data;
            if (mounted) {
              setState(() {
                _email.text = email;
                _pass.text = _demoFamilyPassword;
              });
            }
            break;
          }
        } catch (_) {
          continue;
        }
      }

      if (loginData == null) {
        throw Exception('تعذّر تسجيل دخول الأسرة التجريبية');
      }

      final access = loginData['access_token'] as String?;
      final refresh = loginData['refresh_token'] as String?;
      final parent = loginData['parent'] as Map<String, dynamic>?;
      final parentId = parent?['id']?.toString();
      if (access == null || refresh == null || parentId == null) {
        throw Exception('استجابة دخول غير متوقعة');
      }

      await storage.save(
        accessToken: access,
        refreshToken: refresh,
        parentId: parentId,
      );
      if (isTv) await TvSessionOrigin.record(TvSessionOrigin.email);
      guard.setAuthenticated(true, parentId: parentId);

      if (!mounted) return;
      // Ensure guard is fully notified before navigation – small delay to let
      // ChangeNotifier propagate to router's refreshListenable on web.
      await Future<void>.delayed(const Duration(milliseconds: 80));
      if (!mounted) return;
      // Go to "من يشاهد الآن؟" – the child selector under same family account
      context.go('/children');
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorKind = _LoginErrorKind.generic;
        _errorMessage = AppFailure.fromException(error).message;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _login() async {
    if (_loading || !(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    setState(() {
      _loading = true;
      _errorKind = _LoginErrorKind.none;
      _errorMessage = null;
      _errorMeta = null;
    });

    try {
      final api = ref.read(majarraApiClientProvider);
      final storage = ref.read(authStorageProvider);
      final guard = ref.read(authGuardProvider);
      var recoveryPending = false;
      await storage.runDeletionReceiptWorkflow(() async {
        if (await storage.getDeletionReceipt() != null) {
          recoveryPending = true;
          return;
        }
        final installationId = await ref
            .read(installationIdentityProvider)
            .getOrCreate();
        final res = await api.login(
          email: _email.text.trim(),
          password: _pass.text,
          installationId: installationId,
          // TV-001: a television using the email fallback is still a TV in
          // the family's device list, not "جهاز Android".
          platform: ref.read(currentDeviceProfileProvider).isTelevision
              ? 'android_tv'
              : currentAuthPlatform,
          deviceName: ref.read(currentDeviceProfileProvider).isTelevision
              ? await televisionLabel()
              : currentDeviceLabel,
        );
        final data = res['data'] as Map<String, dynamic>?;
        final access = data?['access_token'] as String?;
        final refresh = data?['refresh_token'] as String?;
        final parent = data?['parent'] as Map<String, dynamic>?;
        final parentId = parent?['id']?.toString();
        if (access == null || refresh == null || parentId == null) {
          throw const MajarraApiException('Unexpected login response');
        }
        await storage.save(
          accessToken: access,
          refreshToken: refresh,
          parentId: parentId,
        );
        if (ref.read(currentDeviceProfileProvider).isTelevision) {
          await TvSessionOrigin.record(TvSessionOrigin.email);
        }
        guard.setAuthenticated(true, parentId: parentId);
      });
      if (!mounted) return;
      if (recoveryPending) {
        context.go('/deletion-status');
        return;
      }
      context.go('/children');
    } on MajarraApiException catch (error) {
      if (!mounted) return;
      // Exception has code/statusCode/message only – data comes from envelope if available
      // We keep meta empty for now; pending_deletion date comes from server message or extra endpoint
      Map<String, dynamic>? data;
      String? code = error.code;
      // Heuristic from status + message
      final message = error.message.toLowerCase();
      if (message.contains('not verified') ||
          message.contains('لم يتم تأكيد') ||
          message.contains('email_not_verified') ||
          code == 'email_not_verified' ||
          code == 'EMAIL_NOT_VERIFIED') {
        setState(() {
          _errorKind = _LoginErrorKind.emailNotVerified;
          _errorMessage = null;
          _errorMeta = data;
        });
      } else if (message.contains('pending_deletion') ||
          message.contains('قيد الحذف') ||
          code == 'pending_deletion' ||
          code == 'ACCOUNT_PENDING_DELETION') {
        setState(() {
          _errorKind = _LoginErrorKind.pendingDeletion;
          _errorMessage = null;
          _errorMeta = data;
        });
      } else if (error.statusCode == 401) {
        setState(() {
          _errorKind = _LoginErrorKind.invalidCredentials;
          _errorMessage = null;
        });
      } else {
        setState(() {
          _errorKind = _LoginErrorKind.generic;
          _errorMessage = AppFailure.fromException(error).message;
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _errorKind = _LoginErrorKind.generic;
        _errorMessage = AppFailure.fromException(error).message;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final width = MediaQuery.sizeOf(context).width;
    final device = ref.watch(deviceProfileProvider).valueOrNull;
    final isTelevision = device?.isTelevision ?? false;
    final isTablet = width >= 600 && width < 1024 && !isTelevision;
    final isDesktopTv = width >= 1024 || isTelevision;

    // TV-001: typing credentials with a remote is the slowest way in, so a
    // television opens on the pairing code instead. `?method=email` is how the
    // pairing screen offers this form as the fallback.
    if (isTelevision && !_sentToPairing) {
      String? method;
      try {
        method = GoRouterState.of(context).uri.queryParameters['method'];
      } catch (_) {
        method = 'email'; // Not under a router (e.g. a widget test): stay here.
      }
      if (method != 'email') {
        _sentToPairing = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) context.go('/tv-pairing');
        });
      }
    }

    // Responsive background mapping (R2-first, bundled webp instant):
    // Mobile portrait (<600): login-bg-mobile — CDN WebP, bundled 44KB webp
    // Tablet landscape (600-1023) / TV / Desktop: login-bg-landscape — CDN,
    // bundled 24KB webp. The PNG (317–824KB) and JPG legacy rungs are GONE:
    // they were never uploaded to R2 (only the webp twins were), and the
    // bundled webp is already the sharpest instant paint. `CinematicImage`
    // shows the bundled webp immediately, then swaps to the cached CDN file
    // when the lookup completes — no blank first paint, no 800KB PNG.
    String bgBundled;
    String? bgNetwork;
    BoxFit bgFit;
    Alignment bgAlign;

    if (isTelevision) {
      // TV: wide landscape, center, cover
      bgBundled = 'assets/images/landing/login-bg-landscape.webp';
      bgNetwork = heavyCdnUrl('assets/images/landing/login-bg-landscape.png');
      bgFit = BoxFit.cover;
      bgAlign = Alignment.center;
    } else if (isDesktopTv) {
      // Desktop / big tablet
      bgBundled = 'assets/images/landing/login-bg-landscape.webp';
      bgNetwork = heavyCdnUrl('assets/images/landing/login-bg-landscape.png');
      bgFit = BoxFit.cover;
      bgAlign = Alignment.center;
    } else if (isTablet) {
      // Tablet: landscape wide
      bgBundled = 'assets/images/landing/login-bg-landscape.webp';
      bgNetwork = heavyCdnUrl('assets/images/landing/login-bg-landscape.png');
      bgFit = BoxFit.cover;
      bgAlign = Alignment.center;
    } else {
      // Mobile portrait
      bgBundled = 'assets/images/landing/login-bg-mobile.webp';
      bgNetwork = heavyCdnUrl('assets/images/landing/login-bg-mobile.png');
      bgFit = BoxFit.cover;
      bgAlign = Alignment.topCenter;
    }

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Responsive background: bundled webp paints instantly, CDN WebP
          // (same bytes, via disk cache after first load) swaps in behind it.
          CinematicImage(
            assetPath: bgBundled,
            networkUrl: bgNetwork,
            semanticLabel: '',
            fit: bgFit,
            alignment: bgAlign,
          ),
          // Scrim adapts per device: TV needs stronger scrim for readability over wide landscape
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: isTelevision
                    ? const [
                        Color(0xE50A1028),
                        Color(0xED091024),
                        Color(0xFF050817),
                      ]
                    : isTablet || isDesktopTv
                    ? const [
                        Color(0xD90A1028),
                        Color(0xE0091024),
                        Color(0xF5050817),
                      ]
                    : const [
                        Color(0xC90A1028),
                        Color(0xD9091024),
                        Color(0xF5050817),
                      ],
                stops: const [0, 0.52, 1],
              ),
            ),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: AutofillGroup(
                    child: Form(
                      key: _formKey,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const SizedBox(height: 12),
                          Center(
                            child: Image.asset(
                              'assets/brand/majarra-logo.png',
                              width: 90,
                              height: 90,
                              errorBuilder: (_, __, ___) => const Icon(
                                Icons.auto_awesome_rounded,
                                color: AppColors.starGold,
                                size: 48,
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            l10n.loginTitle,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            l10n.loginSubtitle,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.mutedText.withValues(
                                alpha: 0.72,
                              ),
                              fontSize: 12,
                            ),
                          ),
                          const SizedBox(height: 28),
                          TextFormField(
                            controller: _email,
                            focusNode: _emailFocus,
                            autofocus: isTelevision,
                            keyboardType: TextInputType.emailAddress,
                            textInputAction: TextInputAction.next,
                            autofillHints: const [
                              AutofillHints.username,
                              AutofillHints.email,
                            ],
                            autocorrect: false,
                            validator: _validateEmail,
                            onFieldSubmitted: (_) => _passFocus.requestFocus(),
                            style: const TextStyle(color: Colors.white),
                            decoration: _fieldDecoration(
                              label: l10n.emailLabel,
                              icon: Icons.mail_outline_rounded,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _pass,
                            focusNode: _passFocus,
                            obscureText: _obscure,
                            textInputAction: TextInputAction.done,
                            autofillHints: const [AutofillHints.password],
                            enableSuggestions: false,
                            autocorrect: false,
                            validator: _validatePassword,
                            onFieldSubmitted: (_) => _login(),
                            style: const TextStyle(color: Colors.white),
                            decoration:
                                _fieldDecoration(
                                  label: l10n.passwordLabel,
                                  icon: Icons.lock_outline_rounded,
                                ).copyWith(
                                  suffixIcon: IconButton(
                                    focusNode: FocusNode(
                                      skipTraversal: true,
                                      canRequestFocus: false,
                                    ),
                                    tooltip: _obscure
                                        ? 'إظهار كلمة المرور'
                                        : 'إخفاء كلمة المرور',
                                    icon: Icon(
                                      _obscure
                                          ? Icons.visibility_off_rounded
                                          : Icons.visibility_rounded,
                                      color: AppColors.mutedText,
                                    ),
                                    onPressed: () =>
                                        setState(() => _obscure = !_obscure),
                                  ),
                                ),
                          ),
                          const SizedBox(height: 8),
                          Align(
                            alignment: AlignmentDirectional.centerEnd,
                            child: TextButton(
                              focusNode: _forgotFocus,
                              onPressed: () => context.push(
                                Uri(
                                  path: '/forgot-password',
                                  queryParameters: {
                                    if (_email.text.trim().isNotEmpty)
                                      'email': _email.text.trim(),
                                  },
                                ).toString(),
                              ),
                              child: Text(l10n.forgotPassword),
                            ),
                          ),

                          // Contextual error cards
                          if (_errorKind != _LoginErrorKind.none) ...[
                            const SizedBox(height: 8),
                            _buildErrorCard(),
                          ],

                          const SizedBox(height: 14),
                          FilledButton(
                            focusNode: _submitFocus,
                            onPressed: _loading ? null : _login,
                            style: ButtonStyle(
                              minimumSize: WidgetStateProperty.all(
                                const Size.fromHeight(50),
                              ),
                              padding: WidgetStateProperty.all(
                                const EdgeInsets.symmetric(
                                  horizontal: 18,
                                  vertical: 14,
                                ),
                              ),
                              backgroundColor: WidgetStateProperty.resolveWith((
                                states,
                              ) {
                                if (states.contains(WidgetState.focused)) {
                                  return const Color(0xFFFFE580);
                                }
                                return AppColors.starGold;
                              }),
                              foregroundColor: WidgetStateProperty.all(
                                AppColors.deepSpace,
                              ),
                              side: WidgetStateProperty.resolveWith((states) {
                                if (states.contains(WidgetState.focused)) {
                                  return const BorderSide(
                                    color: Colors.white,
                                    width: 2.8,
                                  );
                                }
                                return BorderSide.none;
                              }),
                              elevation: WidgetStateProperty.resolveWith((
                                states,
                              ) {
                                if (states.contains(WidgetState.focused)) {
                                  return 8;
                                }
                                return 0;
                              }),
                              shape: WidgetStateProperty.all(
                                RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14),
                                ),
                              ),
                            ),
                            child: _loading
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: AppColors.deepSpace,
                                    ),
                                  )
                                : Text(
                                    l10n.loginButton,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),

                          const SizedBox(height: 18),
                          Row(
                            children: [
                              Expanded(
                                child: Divider(
                                  color: Colors.white.withValues(alpha: 0.08),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                ),
                              ),
                              Expanded(
                                child: Divider(
                                  color: Colors.white.withValues(alpha: 0.08),
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 18),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'ليس لديك حساب؟',
                                style: TextStyle(
                                  color: AppColors.mutedText.withValues(
                                    alpha: 0.7,
                                  ),
                                  fontSize: 12,
                                ),
                              ),
                              TextButton(
                                focusNode: _registerFocus,
                                onPressed: () => context.push('/register'),
                                child: const Text(
                                  'إنشاء حساب',
                                  style: TextStyle(color: AppColors.starGold),
                                ),
                              ),
                            ],
                          ),

                          // Demo Family Account – single family button, children chosen inside on /children page
                          const SizedBox(height: 14),
                          _DemoFamilyCard(
                            focusNode: _demoFocus,
                            loading: _loading,
                            onUseFamily: _useDemoFamily,
                          ),

                          const SizedBox(height: 12),
                          // Footer minimal
                          Center(
                            child: Wrap(
                              alignment: WrapAlignment.center,
                              spacing: 8,
                              children: [
                                TextButton(
                                  onPressed: () => context.push('/privacy'),
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppColors.mutedText
                                        .withValues(alpha: 0.5),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                    ),
                                    minimumSize: const Size(0, 32),
                                  ),
                                  child: const Text(
                                    'الخصوصية',
                                    style: TextStyle(fontSize: 11),
                                  ),
                                ),
                                Text(
                                  '•',
                                  style: TextStyle(
                                    color: AppColors.mutedText.withValues(
                                      alpha: 0.3,
                                    ),
                                    fontSize: 11,
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => context.push('/terms'),
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppColors.mutedText
                                        .withValues(alpha: 0.5),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                    ),
                                    minimumSize: const Size(0, 32),
                                  ),
                                  child: const Text(
                                    'الشروط',
                                    style: TextStyle(fontSize: 11),
                                  ),
                                ),
                                Text(
                                  '•',
                                  style: TextStyle(
                                    color: AppColors.mutedText.withValues(
                                      alpha: 0.3,
                                    ),
                                    fontSize: 11,
                                  ),
                                ),
                                TextButton(
                                  onPressed: () => context.push('/help-signin'),
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppColors.mutedText
                                        .withValues(alpha: 0.5),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                    ),
                                    minimumSize: const Size(0, 32),
                                  ),
                                  child: const Text(
                                    'مساعدة',
                                    style: TextStyle(fontSize: 11),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    switch (_errorKind) {
      case _LoginErrorKind.emailNotVerified:
        return _EmailNotVerifiedCard(
          email: _email.text.trim(),
          obscuredEmail: _obscuredEmail(_email.text.trim()),
          resending: _resending,
          countdown: _resendCountdown,
          message: _errorMessage,
          onResend: _resendVerification,
          onChangeEmail: () {
            setState(() {
              _errorKind = _LoginErrorKind.none;
            });
            // Focus email field
          },
        );
      case _LoginErrorKind.pendingDeletion:
        final until =
            _errorMeta?['deletion_scheduled_until']?.toString() ??
            _errorMeta?['scheduled_until']?.toString() ??
            '';
        return _PendingDeletionCard(
          scheduledUntil: until,
          onViewStatus: () => context.push('/deletion-status'),
          onRestore: () => context.push('/deletion-status'),
        );
      case _LoginErrorKind.invalidCredentials:
        return _InfoCard(
          icon: Icons.error_outline_rounded,
          color: AppColors.danger,
          title: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
          body: null,
        );
      case _LoginErrorKind.generic:
        return _InfoCard(
          icon: Icons.warning_amber_rounded,
          color: AppColors.danger,
          title: _errorMessage ?? 'حدث خطأ',
          body: null,
        );
      case _LoginErrorKind.none:
        return const SizedBox.shrink();
    }
  }

  InputDecoration _fieldDecoration({
    required String label,
    required IconData icon,
  }) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
    );
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7)),
      floatingLabelStyle: const TextStyle(
        color: AppColors.starGold,
        fontWeight: FontWeight.w700,
      ),
      prefixIcon: Icon(icon, color: AppColors.mutedText),
      filled: true,
      fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
      border: border,
      enabledBorder: border,
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.starGold, width: 2.8),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: AppColors.danger, width: 2.8),
      ),
    );
  }
}

/// Demo family account – single button as requested: one family account, children inside
class _DemoFamilyCard extends StatelessWidget {
  const _DemoFamilyCard({
    required this.loading,
    required this.onUseFamily,
    this.focusNode,
  });

  final bool loading;
  final VoidCallback onUseFamily;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    return FilledButton.icon(
      focusNode: focusNode,
      onPressed: loading ? null : onUseFamily,
      icon: loading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFF1A1A2E),
              ),
            )
          : const Icon(Icons.login_rounded, size: 18),
      label: const Text(
        'دخول بحساب الأسرة التجريبي',
        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13),
      ),
      style: ButtonStyle(
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.focused)) {
            return const Color(0xFFFFE580);
          }
          return AppColors.starGold;
        }),
        foregroundColor: WidgetStateProperty.all(const Color(0xFF1A1A2E)),
        side: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.focused)) {
            return const BorderSide(color: Colors.white, width: 2.8);
          }
          return BorderSide.none;
        }),
        elevation: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.focused)) return 8;
          return 0;
        }),
        minimumSize: WidgetStateProperty.all(const Size.fromHeight(52)),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );
  }
}

class _EmailNotVerifiedCard extends StatelessWidget {
  const _EmailNotVerifiedCard({
    required this.email,
    required this.obscuredEmail,
    required this.resending,
    required this.countdown,
    this.message,
    required this.onResend,
    required this.onChangeEmail,
  });

  final String email;
  final String obscuredEmail;
  final bool resending;
  final int countdown;
  final String? message;
  final VoidCallback onResend;
  final VoidCallback onChangeEmail;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1A2348).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.starGold.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.starGold.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.mark_email_unread_rounded,
                  color: AppColors.starGold,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'بريدك الإلكتروني لم يتم تأكيده بعد',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            'أرسلنا رابط التأكيد إلى $obscuredEmail',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.8),
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: (resending || countdown > 0) ? null : onResend,
            icon: resending
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.black,
                    ),
                  )
                : const Icon(Icons.send_rounded, size: 18),
            label: Text(
              countdown > 0
                  ? 'إعادة الإرسال بعد $countdownث'
                  : (message == 'تم إرسال رابط جديد'
                        ? message!
                        : 'إعادة إرسال رابط التأكيد'),
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.starGold,
              foregroundColor: AppColors.deepSpace,
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onChangeEmail,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white70,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('تغيير البريد', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _PendingDeletionCard extends StatelessWidget {
  const _PendingDeletionCard({
    required this.scheduledUntil,
    required this.onViewStatus,
    required this.onRestore,
  });

  final String scheduledUntil;
  final VoidCallback onViewStatus;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF2A1A1A).withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.orange.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 20),
              SizedBox(width: 8),
              Text(
                'حسابك قيد الحذف',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          if (scheduledUntil.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'طلب حذف الحساب ما زال قيد التنفيذ حتى $scheduledUntil.',
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.8),
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: 14),
          FilledButton(
            onPressed: onRestore,
            style: FilledButton.styleFrom(
              backgroundColor: Colors.orange,
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(44),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text(
              'إلغاء طلب الحذف واستعادة الحساب',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12),
            ),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: onViewStatus,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white70,
              side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            child: const Text('عرض حالة الطلب', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.icon,
    required this.color,
    required this.title,
    this.body,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (body != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    body!,
                    style: TextStyle(
                      color: AppColors.mutedText.withValues(alpha: 0.8),
                      fontSize: 11,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
