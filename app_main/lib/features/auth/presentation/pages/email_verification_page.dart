import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';

class EmailVerificationArgs {
  const EmailVerificationArgs({this.email, this.token});

  final String? email;
  final String? token;
}

enum _VerificationState { pending, verifying, verified, failed }

class EmailVerificationPage extends ConsumerStatefulWidget {
  const EmailVerificationPage({this.email, this.token, super.key});

  final String? email;
  final String? token;

  @override
  ConsumerState<EmailVerificationPage> createState() =>
      _EmailVerificationPageState();
}

class _EmailVerificationPageState extends ConsumerState<EmailVerificationPage> {
  final _emailKey = GlobalKey<FormState>();
  late final TextEditingController _email;
  late _VerificationState _state;
  bool _resending = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _email = TextEditingController(text: widget.email ?? '');
    final token = widget.token?.trim();
    _state = token == null || token.isEmpty
        ? _VerificationState.pending
        : _VerificationState.verifying;
    if (_state == _VerificationState.verifying) {
      Future<void>.microtask(() => _verify(token!));
    }
  }

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final email = value?.trim() ?? '';
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      return 'أدخل البريد الذي استخدمته لإنشاء الحساب';
    }
    return null;
  }

  Future<void> _verify(String token) async {
    try {
      await ref.read(majarraApiClientProvider).verifyEmail(token: token);
      if (!mounted) return;
      setState(() {
        _state = _VerificationState.verified;
        _message = 'تم تأكيد البريد. يمكنك تسجيل الدخول الآن.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _state = _VerificationState.failed;
        _message =
            'رابط التأكيد غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا.';
      });
    }
  }

  Future<void> _resend() async {
    if (_resending || !(_emailKey.currentState?.validate() ?? false)) return;
    setState(() {
      _resending = true;
      _message = null;
    });
    try {
      final response = await ref
          .read(majarraApiClientProvider)
          .resendVerification(email: _email.text.trim());
      final data = response['data'];
      final developmentToken = kDebugMode && data is Map
          ? data['development_verification_token'] as String?
          : null;
      if (developmentToken != null && developmentToken.isNotEmpty) {
        if (mounted) {
          setState(() => _state = _VerificationState.verifying);
        }
        await _verify(developmentToken);
        return;
      }
      if (!mounted) return;
      setState(() {
        _state = _VerificationState.pending;
        _message =
            'إذا كان الحساب يحتاج إلى تأكيد، أُرسل رابط جديد إلى البريد.';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _message = AppFailure.fromException(error).message);
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final verified = _state == _VerificationState.verified;
    final verifying = _state == _VerificationState.verifying;
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(
                      verified
                          ? Icons.mark_email_read_rounded
                          : Icons.outgoing_mail,
                      color: verified ? AppColors.success : AppColors.starGold,
                      size: 64,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      verified ? 'تم تأكيد البريد' : 'تحقق من بريدك الإلكتروني',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      verifying
                          ? 'نتحقق من رابط التأكيد…'
                          : verified
                          ? 'حساب الأسرة جاهز لتسجيل الدخول.'
                          : 'افتح الرابط الذي أُرسل إلى بريدك قبل تسجيل الدخول. صلاحية الرابط ساعة واحدة.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.78),
                        height: 1.6,
                      ),
                    ),
                    if (verifying) ...[
                      const SizedBox(height: 24),
                      const Center(
                        child: CircularProgressIndicator(
                          color: AppColors.starGold,
                        ),
                      ),
                    ],
                    if (!verified && !verifying) ...[
                      const SizedBox(height: 24),
                      Form(
                        key: _emailKey,
                        child: TextFormField(
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.done,
                          autofillHints: const [AutofillHints.email],
                          autocorrect: false,
                          validator: _validateEmail,
                          onFieldSubmitted: (_) => _resend(),
                          style: const TextStyle(color: Colors.white),
                          decoration: InputDecoration(
                            labelText: 'البريد الإلكتروني',
                            prefixIcon: const Icon(Icons.mail_outline_rounded),
                            filled: true,
                            fillColor: const Color(
                              0xFF111A3A,
                            ).withValues(alpha: 0.72),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton.icon(
                        onPressed: _resending ? null : _resend,
                        icon: _resending
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.refresh_rounded),
                        label: const Text('إرسال رابط جديد'),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'لمنع إساءة الاستخدام، قد يتجاهل الخادم الطلبات المتكررة خلال دقيقتين.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.58),
                          fontSize: 11,
                        ),
                      ),
                    ],
                    if (_message != null) ...[
                      const SizedBox(height: 16),
                      Semantics(
                        liveRegion: true,
                        child: Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color:
                                (verified
                                        ? AppColors.success
                                        : AppColors.electricCyan)
                                    .withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color:
                                  (verified
                                          ? AppColors.success
                                          : AppColors.electricCyan)
                                      .withValues(alpha: 0.25),
                            ),
                          ),
                          child: Text(
                            _message!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    OutlinedButton.icon(
                      onPressed: () => context.go('/login'),
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('العودة إلى تسجيل الدخول'),
                    ),
                    TextButton(
                      onPressed: () => context.push('/privacy'),
                      child: const Text('معلومات الخصوصية والبيانات'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
