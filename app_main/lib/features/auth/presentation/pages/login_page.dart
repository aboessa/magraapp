import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../child/application/child_provider.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../application/auth_controller.dart';
import '../../data/installation_identity.dart';
import 'email_verification_page.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  String? _submitError;

  @override
  void dispose() {
    _email.dispose();
    _pass.dispose();
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

  Future<void> _login() async {
    if (_loading || !(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    setState(() {
      _loading = true;
      _submitError = null;
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
          platform: currentAuthPlatform,
          deviceName: currentDeviceLabel,
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
      setState(() {
        _submitError = error.statusCode == 401
            ? 'تعذّر تسجيل الدخول. تحقق من البيانات ومن تأكيد البريد الإلكتروني.'
            : AppFailure.fromException(error).message;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _submitError = AppFailure.fromException(error).message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
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
                            color: AppColors.mutedText.withValues(alpha: 0.72),
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 28),
                        TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [
                            AutofillHints.username,
                            AutofillHints.email,
                          ],
                          autocorrect: false,
                          validator: _validateEmail,
                          style: const TextStyle(color: Colors.white),
                          decoration: _fieldDecoration(
                            label: l10n.emailLabel,
                            icon: Icons.mail_outline_rounded,
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: _pass,
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
                        Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: TextButton(
                            onPressed: () => context.push(
                              '/verify-email',
                              extra: EmailVerificationArgs(
                                email: _email.text.trim(),
                              ),
                            ),
                            child: const Text('لم يصلك رابط تأكيد البريد؟'),
                          ),
                        ),
                        if (_submitError != null) ...[
                          const SizedBox(height: 6),
                          Semantics(
                            liveRegion: true,
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.danger.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppColors.danger.withValues(
                                    alpha: 0.28,
                                  ),
                                ),
                              ),
                              child: Text(
                                _submitError!,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 10),
                        FilledButton(
                          onPressed: _loading ? null : _login,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 18,
                              vertical: 14,
                            ),
                            backgroundColor: AppColors.starGold,
                            foregroundColor: AppColors.deepSpace,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
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
                              : const Text(
                                  'تسجيل دخول',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontWeight: FontWeight.w800),
                                ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _loading
                              ? null
                              : () async {
                                  setState(() {
                                    _loading = true;
                                    _submitError = null;
                                  });
                                  try {
                                    await ref
                                        .read(authControllerProvider)
                                        .prepareDemoSession();
                                    if (!mounted) return;
                                    final guard = ref.read(authGuardProvider);
                                    guard.startDemoSession();
                                    ref
                                        .read(childProvider.notifier)
                                        .selectChild(
                                          childId: 'demo-child',
                                          ageTrack: 'preschool',
                                          displayName: 'الضيف',
                                        );
                                    syncAuthGuardWithChild(
                                      ref.read(childProvider),
                                      guard,
                                    );
                                    if (context.mounted) context.go('/');
                                  } catch (_) {
                                    if (!mounted) return;
                                    setState(() {
                                      _submitError =
                                          'تعذّر تأمين بيانات الحساب السابق. أعد المحاولة.';
                                    });
                                  } finally {
                                    if (mounted) {
                                      setState(() => _loading = false);
                                    }
                                  }
                                },
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.14),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text(
                            'الدخول كضيف — حساب تجريبي',
                            style: TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(height: 6),
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
                              onPressed: () => context.push('/register'),
                              child: const Text(
                                'إنشاء حساب',
                                style: TextStyle(color: AppColors.starGold),
                              ),
                            ),
                          ],
                        ),
                        Center(
                          child: TextButton.icon(
                            onPressed: () => context.push('/deletion-status'),
                            icon: const Icon(
                              Icons.hourglass_top_rounded,
                              size: 16,
                            ),
                            label: const Text('متابعة طلب حذف حساب سابق'),
                          ),
                        ),
                        Center(
                          child: TextButton.icon(
                            onPressed: () => context.push('/privacy'),
                            icon: const Icon(
                              Icons.privacy_tip_outlined,
                              size: 16,
                            ),
                            label: const Text(
                              'راجع معلومات الخصوصية والبيانات',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _fieldDecoration({
    required String label,
    required IconData icon,
  }) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
    );
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7)),
      prefixIcon: Icon(icon, color: AppColors.mutedText),
      filled: true,
      fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
      border: border,
      enabledBorder: border,
    );
  }
}
