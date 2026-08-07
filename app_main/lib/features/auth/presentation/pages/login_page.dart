import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _obscure = true;
  bool _loading = false;

  Future<void> _login() async {
    if (_email.text.isEmpty || _pass.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أدخل البريد وكلمة المرور')));
      return;
    }
    setState(() => _loading = true);
    try {
      final api = ref.read(majarraApiClientProvider);
      final storage = ref.read(authStorageProvider);
      final res = await api.login(email: _email.text.trim(), password: _pass.text, installationId: 'flutter-${_email.text.hashCode}', platform: 'android', deviceName: 'Flutter');
      final data = res['data'] as Map<String, dynamic>?;
      final access = data?['access_token'] as String?;
      final refresh = data?['refresh_token'] as String?;
      final parent = data?['parent'] as Map<String, dynamic>?;
      final parentId = parent?['id']?.toString();
      if (access != null && refresh != null && parentId != null) {
        await storage.save(accessToken: access, refreshToken: refresh, parentId: parentId);
        if (!mounted) return;
        context.go('/children');
      } else {
        throw const MajarraApiException('استجابة غير متوقعة');
      }
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال - تأكد من الشبكة')));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 12),
                    Center(child: Image.asset('assets/brand/majarra-logo.png', width: 90, height: 90, errorBuilder: (_, __, ___) => const Icon(Icons.auto_awesome_rounded, color: AppColors.starGold, size: 48))),
                    const SizedBox(height: 16),
                    const Text('أهلاً بك في مجرة', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text('مساحة آمنة للخيال ومجرة كاملة للتعلم', textAlign: TextAlign.center, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                    const SizedBox(height: 28),
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'البريد الإلكتروني',
                        labelStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7)),
                        prefixIcon: const Icon(Icons.mail_outline_rounded, color: AppColors.mutedText),
                        filled: true,
                        fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _pass,
                      obscureText: _obscure,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'كلمة المرور',
                        labelStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7)),
                        prefixIcon: const Icon(Icons.lock_outline_rounded, color: AppColors.mutedText),
                        suffixIcon: IconButton(icon: Icon(_obscure ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: AppColors.mutedText), onPressed: () => setState(() => _obscure = !_obscure)),
                        filled: true,
                        fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Align(alignment: AlignmentDirectional.centerEnd, child: TextButton(onPressed: () {}, child: Text('نسيت كلمة المرور؟', style: TextStyle(color: AppColors.electricCyan.withValues(alpha: 0.9), fontSize: 12)))),
                    const SizedBox(height: 8),
                    SizedBox(
                      height: 50,
                      child: FilledButton(
                        onPressed: _loading ? null : _login,
                        style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))),
                        child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.deepSpace)) : const Text('تسجيل دخول', style: TextStyle(fontWeight: FontWeight.w800)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text('ليس لديك حساب؟', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 12)),
                        TextButton(onPressed: () => context.push('/register'), child: const Text('إنشاء حساب', style: TextStyle(color: AppColors.starGold))),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Center(child: Text('بالدخول توافق على الشروط وسياسة الخصوصية', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.42), fontSize: 10))),
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
