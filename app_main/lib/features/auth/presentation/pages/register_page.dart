import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../../data/installation_identity.dart';
import 'email_verification_page.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  static final _minPasswordLength = 12;

  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _confirmPass = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmation = true;
  bool _loading = false;
  String? _submitError;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _pass.dispose();
    _confirmPass.dispose();
    super.dispose();
  }

  String? _validateName(String? value) => (value?.trim().isEmpty ?? true)
      ? AppLocalizationsAr().authregisterpageDispose01
      : null;

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (email.isEmpty) return AppLocalizationsAr().authregisterpageDispose02;
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return AppLocalizationsAr().authregisterpageDispose03;
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if ((value ?? '').length < _minPasswordLength) {
      return AppLocalizationsAr().authregisterpageText01(_minPasswordLength);
    }
    return null;
  }

  String? _validateConfirmation(String? value) {
    if (value != _pass.text) return AppLocalizationsAr().authregisterpageText02;
    return null;
  }

  Future<void> _register() async {
    if (_loading || !(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    setState(() {
      _loading = true;
      _submitError = null;
    });

    try {
      final installationId = await ref
          .read(installationIdentityProvider)
          .getOrCreate();
      final response = await ref
          .read(majarraApiClientProvider)
          .register(
            email: _email.text.trim(),
            password: _pass.text,
            displayName: _name.text.trim(),
            installationId: installationId,
            platform: currentAuthPlatform,
            deviceName: currentDeviceLabel,
          );
      if (!mounted) return;
      final data = response['data'];
      final developmentToken = kDebugMode && data is Map
          ? data['development_verification_token'] as String?
          : null;
      context.go(
        '/verify-email',
        extra: EmailVerificationArgs(
          email: _email.text.trim(),
          token: developmentToken,
        ),
      );
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
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: IconButton(
                            icon: const Icon(
                              Icons.arrow_forward_rounded,
                              color: Colors.white,
                            ),
                            tooltip: l10n.back,
                            onPressed: () => context.pop(),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          l10n.createFamilyAccount,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          l10n.oneAccountPerFamily,
                          style: TextStyle(
                            color: AppColors.mutedText.withValues(alpha: 0.72),
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _AuthField(
                          controller: _name,
                          label: l10n.parentNameLabel,
                          icon: Icons.person_outline_rounded,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.name],
                          validator: _validateName,
                        ),
                        const SizedBox(height: 12),
                        _AuthField(
                          controller: _email,
                          label: l10n.emailLabel,
                          icon: Icons.mail_outline_rounded,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [
                            AutofillHints.username,
                            AutofillHints.email,
                          ],
                          validator: _validateEmail,
                        ),
                        const SizedBox(height: 12),
                        _AuthField(
                          controller: _pass,
                          label: l10n.passwordLabel,
                          icon: Icons.lock_outline_rounded,
                          obscure: _obscurePassword,
                          textInputAction: TextInputAction.next,
                          autofillHints: const [AutofillHints.newPassword],
                          validator: _validatePassword,
                          onToggleObscure: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _AuthField(
                          controller: _confirmPass,
                          label: 'تأكيد كلمة المرور',
                          icon: Icons.lock_reset_rounded,
                          obscure: _obscureConfirmation,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.newPassword],
                          validator: _validateConfirmation,
                          onFieldSubmitted: (_) => _register(),
                          onToggleObscure: () => setState(
                            () => _obscureConfirmation = !_obscureConfirmation,
                          ),
                        ),
                        const SizedBox(height: 12),
                        // Required: an account is created only by a parent
                        // who accepted the terms and the privacy policy.
                        FormField<bool>(
                          initialValue: false,
                          validator: (value) => value == true
                              ? null
                              : 'لازم توافق على الشروط وسياسة الخصوصية',
                          builder: (field) => Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CheckboxListTile(
                                value: field.value ?? false,
                                onChanged: (value) => field.didChange(value),
                                controlAffinity:
                                    ListTileControlAffinity.leading,
                                contentPadding: EdgeInsets.zero,
                                activeColor: AppColors.starGold,
                                checkColor: AppColors.deepSpace,
                                title: const Text(
                                  'أنا ولي الأمر (18 سنة فأكثر)، وموافق على شروط الاستخدام وسياسة الخصوصية وخصوصية الأطفال',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 12.5,
                                    height: 1.5,
                                  ),
                                ),
                              ),
                              Wrap(
                                spacing: 4,
                                children: [
                                  for (final (slug, label) in const [
                                    ('terms', 'الشروط'),
                                    ('privacy', 'الخصوصية'),
                                    ('children-privacy', 'خصوصية الأطفال'),
                                  ])
                                    TextButton(
                                      onPressed: () =>
                                          context.push('/legal/$slug'),
                                      child: Text(label),
                                    ),
                                ],
                              ),
                              if (field.hasError)
                                Text(
                                  field.errorText!,
                                  style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (_submitError != null) ...[
                          const SizedBox(height: 14),
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
                        const SizedBox(height: 20),
                        FilledButton(
                          onPressed: _loading ? null : _register,
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
                                  ),
                                )
                              : Text(
                                  l10n.registerButton,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          alignment: WrapAlignment.center,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              l10n.hasAccount,
                              style: TextStyle(
                                color: AppColors.mutedText.withValues(
                                  alpha: 0.7,
                                ),
                                fontSize: 12,
                              ),
                            ),
                            TextButton(
                              onPressed: () => context.pop(),
                              child: Text(
                                l10n.loginButton,
                                style: const TextStyle(
                                  color: AppColors.starGold,
                                ),
                              ),
                            ),
                          ],
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
}

class _AuthField extends StatelessWidget {
  const _AuthField({
    required this.controller,
    required this.label,
    required this.icon,
    required this.textInputAction,
    required this.validator,
    this.keyboardType,
    this.autofillHints,
    this.obscure = false,
    this.onToggleObscure,
    this.onFieldSubmitted,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction textInputAction;
  final Iterable<String>? autofillHints;
  final bool obscure;
  final VoidCallback? onToggleObscure;
  final FormFieldValidator<String> validator;
  final ValueChanged<String>? onFieldSubmitted;

  @override
  Widget build(BuildContext context) {
    final border = OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
    );
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      validator: validator,
      onFieldSubmitted: onFieldSubmitted,
      autocorrect: false,
      enableSuggestions: !obscure,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
          color: AppColors.mutedText.withValues(alpha: 0.7),
        ),
        prefixIcon: Icon(icon, color: AppColors.mutedText),
        suffixIcon: onToggleObscure == null
            ? null
            : IconButton(
                focusNode: FocusNode(
                  skipTraversal: true,
                  canRequestFocus: false,
                ),
                tooltip: obscure ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور',
                onPressed: onToggleObscure,
                icon: Icon(
                  obscure
                      ? Icons.visibility_off_rounded
                      : Icons.visibility_rounded,
                  color: AppColors.mutedText,
                ),
              ),
        filled: true,
        fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
        border: border,
        enabledBorder: border,
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.starGold, width: 2.8),
        ),
        floatingLabelStyle: const TextStyle(
          color: AppColors.starGold,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
