import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/application/reset_token_vault.dart';
import '../../../home/application/home_providers.dart';

class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key, this.initialToken});

  final String? initialToken;

  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _token;
  late final bool _hasCapturedToken;
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  bool _obscure = true;
  bool _loading = false;
  bool _serverCommitted = false;
  bool _localCleanupPending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final capturedToken =
        widget.initialToken ?? ref.read(resetTokenVaultProvider).take();
    _hasCapturedToken = (capturedToken ?? '').trim().isNotEmpty;
    _token = TextEditingController(text: capturedToken ?? '');
  }

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  String? _validatePassword(String? value) {
    if (value == null || value.length < 12) {
      return 'استخدم 12 حرفًا على الأقل';
    }
    if (value.length > 256) return 'كلمة المرور طويلة جدًا';
    return null;
  }

  Future<void> _submit() async {
    if (_loading) return;

    String? token;
    if (!_serverCommitted) {
      if (!(_formKey.currentState?.validate() ?? false)) return;
      if (_password.text != _confirmation.text) {
        setState(() => _error = 'كلمتا المرور غير متطابقتين');
        return;
      }
      token = _token.text.trim();
      if (token.isEmpty) {
        setState(() => _error = 'رابط إعادة التعيين ناقص أو غير صالح');
        return;
      }
    }

    FocusScope.of(context).unfocus();
    TextInput.finishAutofillContext();
    setState(() {
      _loading = true;
      _error = null;
    });

    if (!_serverCommitted) {
      try {
        await ref
            .read(majarraApiClientProvider)
            .resetPassword(token: token!, newPassword: _password.text);
      } catch (error) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = AppFailure.fromException(error).message;
          });
        }
        return;
      }

      // The final 2xx response is the server commit boundary. The reset token
      // is consumed and must never be submitted again, even if local teardown
      // fails afterwards.
      _serverCommitted = true;
      _localCleanupPending = true;
      _token.clear();
      _password.clear();
      _confirmation.clear();
      ref.read(resetTokenVaultProvider).clear();
      if (mounted) setState(() {});
    }

    try {
      await ref.read(authControllerProvider).completePasswordReset();
      _localCleanupPending = false;
      if (!mounted) return;
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم تغيير كلمة المرور وإغلاق الجلسات السابقة.'),
        ),
      );
      context.go('/login');
    } catch (_) {
      _localCleanupPending = true;
      if (mounted) {
        setState(() {
          _error =
              'تم تغيير كلمة المرور على الخادم، لكن تعذّر مسح بيانات الحساب من هذا الجهاز. أعد محاولة المسح المحلي.';
        });
      }
    } finally {
      _loading = false;
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasLinkToken = _hasCapturedToken;
    final committed = _serverCommitted;
    return PopScope(
      canPop: !_loading && !_localCleanupPending,
      child: Scaffold(
        backgroundColor: AppColors.deepSpace,
        body: CinematicBackground(
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
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
                              tooltip: 'رجوع',
                              onPressed: _loading || _localCleanupPending
                                  ? null
                                  : () => context.go('/login'),
                              icon: const Icon(
                                Icons.arrow_forward_rounded,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          Icon(
                            committed
                                ? Icons.cleaning_services_rounded
                                : Icons.password_rounded,
                            color: committed
                                ? AppColors.electricCyan
                                : AppColors.starGold,
                            size: 58,
                          ),
                          const SizedBox(height: 18),
                          Text(
                            committed
                                ? 'أكمل مسح بيانات الجهاز'
                                : 'اختيار كلمة مرور جديدة',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            committed
                                ? 'تم تغيير كلمة المرور وإغلاق الجلسات خادميًا. بقي إكمال المسح المحلي فقط.'
                                : 'بعد الحفظ سنغلق كل الجلسات السابقة لحماية الحساب.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.mutedText.withValues(
                                alpha: 0.78,
                              ),
                              height: 1.6,
                            ),
                          ),
                          const SizedBox(height: 24),
                          if (!committed) ...[
                            if (!hasLinkToken) ...[
                              TextFormField(
                                controller: _token,
                                autocorrect: false,
                                enableSuggestions: false,
                                minLines: 2,
                                maxLines: 4,
                                style: const TextStyle(color: Colors.white),
                                decoration: _decoration(
                                  'رمز إعادة التعيين',
                                  Icons.link_rounded,
                                ),
                              ),
                              const SizedBox(height: 12),
                            ],
                            TextFormField(
                              controller: _password,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.newPassword],
                              enableSuggestions: false,
                              autocorrect: false,
                              validator: _validatePassword,
                              style: const TextStyle(color: Colors.white),
                              decoration:
                                  _decoration(
                                    'كلمة المرور الجديدة',
                                    Icons.lock_outline_rounded,
                                  ).copyWith(
                                    suffixIcon: IconButton(
                                      tooltip: _obscure ? 'إظهار' : 'إخفاء',
                                      onPressed: () =>
                                          setState(() => _obscure = !_obscure),
                                      icon: Icon(
                                        _obscure
                                            ? Icons.visibility_off_rounded
                                            : Icons.visibility_rounded,
                                      ),
                                    ),
                                  ),
                            ),
                            const SizedBox(height: 12),
                            TextFormField(
                              controller: _confirmation,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.newPassword],
                              enableSuggestions: false,
                              autocorrect: false,
                              validator: _validatePassword,
                              onFieldSubmitted: (_) => _submit(),
                              style: const TextStyle(color: Colors.white),
                              decoration: _decoration(
                                'تأكيد كلمة المرور',
                                Icons.lock_reset_rounded,
                              ),
                            ),
                          ],
                          if (_error != null) ...[
                            const SizedBox(height: 14),
                            Semantics(
                              liveRegion: true,
                              child: Text(
                                _error!,
                                style: const TextStyle(color: AppColors.danger),
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
                                : Icon(
                                    committed
                                        ? Icons.cleaning_services_rounded
                                        : Icons.check_rounded,
                                  ),
                            label: Text(
                              committed
                                  ? 'أعد محاولة المسح المحلي'
                                  : 'احفظ كلمة المرور',
                            ),
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
        ),
      ),
    );
  }

  InputDecoration _decoration(String label, IconData icon) => InputDecoration(
    labelText: label,
    prefixIcon: Icon(icon),
    filled: true,
    fillColor: const Color(0xFF111A3A),
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
  );
}
