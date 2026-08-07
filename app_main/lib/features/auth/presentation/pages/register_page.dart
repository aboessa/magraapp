import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';

class RegisterPage extends ConsumerStatefulWidget {
  const RegisterPage({super.key});

  @override
  ConsumerState<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends ConsumerState<RegisterPage> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  bool _loading = false;

  Future<void> _register() async {
    if (_name.text.isEmpty || _email.text.isEmpty || _pass.text.length < 12) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('كلمة المرور 12 حرف على الأقل')));
      return;
    }
    setState(() => _loading = true);
    try {
      final api = ref.read(majarraApiClientProvider);
      final res = await api.register(email: _email.text.trim(), password: _pass.text, displayName: _name.text.trim());
      if (!mounted) return;
      final devToken = (res['data'] as Map?)?['development_verification_token'] as String?;
      if (devToken != null) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تم الإنشاء - تحقق: $devToken')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إنشاء الحساب - تحقق من بريدك')));
      }
      context.go('/login');
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تعذر الاتصال')));
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
                    Align(alignment: AlignmentDirectional.centerStart, child: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop())),
                    const SizedBox(height: 8),
                    const Text('أنشئ حساب العائلة', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text('حساب واحد لكل العائلة', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                    const SizedBox(height: 24),
                    _Field(controller: _name, label: 'اسم ولي الأمر', icon: Icons.person_outline_rounded),
                    const SizedBox(height: 12),
                    _Field(controller: _email, label: 'البريد الإلكتروني', icon: Icons.mail_outline_rounded, keyboardType: TextInputType.emailAddress),
                    const SizedBox(height: 12),
                    _Field(controller: _pass, label: 'كلمة المرور', icon: Icons.lock_outline_rounded, obscure: true),
                    const SizedBox(height: 20),
                    SizedBox(height: 50, child: FilledButton(onPressed: _loading ? null : _register, style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))), child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('إنشاء حساب', style: TextStyle(fontWeight: FontWeight.w800)))),
                    const SizedBox(height: 12),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text('لديك حساب؟', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 12)), TextButton(onPressed: () => context.pop(), child: const Text('تسجيل دخول', style: TextStyle(color: AppColors.starGold)))]),
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

class _Field extends StatelessWidget {
  const _Field({required this.controller, required this.label, required this.icon, this.keyboardType, this.obscure = false});
  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;
  final bool obscure;
  @override
  Widget build(BuildContext context) => TextField(
        controller: controller,
        obscureText: obscure,
        keyboardType: keyboardType,
        style: const TextStyle(color: Colors.white),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7)),
          prefixIcon: Icon(icon, color: AppColors.mutedText),
          filled: true,
          fillColor: const Color(0xFF111A3A).withValues(alpha: 0.72),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
        ),
      );
}
