import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:flutter/foundation.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
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

  /// Server-enforced minimum. `IdentityState.register` rejects anything shorter,
  /// so this constant must not drift from the API.
  static const _minPasswordLength = 12;

  Future<void> _register() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    if (_name.text.isEmpty ||
        _email.text.isEmpty ||
        _pass.text.length < _minPasswordLength) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.passwordMinLength(_minPasswordLength))),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      final api = ref.read(majarraApiClientProvider);
      final res = await api.register(email: _email.text.trim(), password: _pass.text, displayName: _name.text.trim());
      if (!mounted) return;
      final devToken = (res['data'] as Map?)?['development_verification_token'] as String?;
      if (kDebugMode && devToken != null) {
        // Debug-only diagnostic, deliberately not translated: it exists to let a
        // developer complete verification without a mail server.
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('dev verification token: $devToken')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(l10n.accountCreatedCheckEmail)));
      }
      context.go('/login');
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      final failure = AppFailure.fromException(e);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message)));
    } catch (e) {
      if (!mounted) return;
      final failure = AppFailure.fromException(e);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(failure.message)));
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(alignment: AlignmentDirectional.centerStart, child: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), tooltip: l10n.back, onPressed: () => context.pop())),
                    const SizedBox(height: 8),
                    Text(l10n.createFamilyAccount, style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 6),
                    Text(l10n.oneAccountPerFamily, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                    const SizedBox(height: 24),
                    _Field(controller: _name, label: l10n.parentNameLabel, icon: Icons.person_outline_rounded),
                    const SizedBox(height: 12),
                    _Field(controller: _email, label: l10n.emailLabel, icon: Icons.mail_outline_rounded, keyboardType: TextInputType.emailAddress),
                    const SizedBox(height: 12),
                    _Field(controller: _pass, label: l10n.passwordLabel, icon: Icons.lock_outline_rounded, obscure: true),
                    const SizedBox(height: 20),
                    SizedBox(height: 50, child: FilledButton(onPressed: _loading ? null : _register, style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))), child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text(l10n.registerButton, style: const TextStyle(fontWeight: FontWeight.w800)))),
                    const SizedBox(height: 12),
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text(l10n.hasAccount, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 12)), TextButton(onPressed: () => context.pop(), child: Text(l10n.loginButton, style: const TextStyle(color: AppColors.starGold)))]),
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
