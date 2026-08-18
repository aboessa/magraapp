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

class ForgotPasswordPage extends ConsumerStatefulWidget {
  const ForgotPasswordPage({super.key, this.initialEmail});

  final String? initialEmail;

  @override
  ConsumerState<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends ConsumerState<ForgotPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _email;
  bool _loading = false;
  String? _message;
  String? _error;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: widget.initialEmail ?? '');
  }

  @override
  void dispose() {
    _email.dispose();
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

  Future<void> _submit() async {
    if (_loading || !(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    setState(() {
      _loading = true;
      _message = null;
      _error = null;
    });
    try {
      final result = await ref
          .read(majarraApiClientProvider)
          .forgotPassword(email: _email.text.trim());
      final data = result['data'];
      final developmentToken = data is Map
          ? data['development_password_reset_token']
          : null;
      if (!mounted) return;
      if (developmentToken is String && developmentToken.isNotEmpty) {
        context.go(
          Uri(
            path: '/reset-password',
            queryParameters: {'token': developmentToken},
          ).toString(),
        );
        return;
      }
      setState(() {
        _message =
            'إذا كان الحساب مؤهلًا، أرسلنا رابط إعادة التعيين إلى البريد. تحقق أيضًا من مجلد الرسائل غير المرغوبة.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = AppFailure.fromException(error).message);
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
                constraints: const BoxConstraints(maxWidth: 440),
                child: Form(
                  key: _formKey,
                  autovalidateMode: AutovalidateMode.onUserInteraction,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: IconButton(
                          tooltip: l10n.back,
                          onPressed: () => context.go('/login'),
                          icon: const Icon(
                            Icons.arrow_forward_rounded,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.mark_email_read_outlined,
                        color: AppColors.starGold,
                        size: 58,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        l10n.forgotPassword,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'أدخل بريد الحساب وسنرسل رابطًا قصير الصلاحية لاختيار كلمة مرور جديدة.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.78),
                          height: 1.6,
                        ),
                      ),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.email],
                        autocorrect: false,
                        validator: _validateEmail,
                        onFieldSubmitted: (_) => _submit(),
                        style: const TextStyle(color: Colors.white),
                        decoration: InputDecoration(
                          labelText: l10n.emailLabel,
                          prefixIcon: const Icon(Icons.mail_outline_rounded),
                          filled: true,
                          fillColor: const Color(0xFF111A3A),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(14),
                          ),
                        ),
                      ),
                      if (_message != null || _error != null) ...[
                        const SizedBox(height: 14),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _message ?? _error!,
                            style: TextStyle(
                              color: _error == null
                                  ? AppColors.electricCyan
                                  : AppColors.danger,
                              height: 1.5,
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      FilledButton.icon(
                        onPressed: _loading ? null : _submit,
                        icon: _loading
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.send_outlined),
                        label: const Text('أرسل رابط إعادة التعيين'),
                        style: FilledButton.styleFrom(
                          minimumSize: const Size.fromHeight(50),
                          backgroundColor: AppColors.starGold,
                          foregroundColor: AppColors.deepSpace,
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
    );
  }
}
