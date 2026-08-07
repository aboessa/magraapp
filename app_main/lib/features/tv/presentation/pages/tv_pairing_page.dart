import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class TvPairingPage extends StatelessWidget {
  const TvPairingPage({super.key});

  @override
  Widget build(BuildContext context) {
    // Pairing codes must be issued and validated by the server. There is no
    // pairing endpoint yet, so no code is displayed: a constant placeholder
    // code previously looked like a working handoff.
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Align(alignment: AlignmentDirectional.centerStart, child: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop())),
                const SizedBox(height: 12),
                const Icon(Icons.qr_code_rounded, color: AppColors.starGold, size: 48),
                const SizedBox(height: 12),
                const Text('اقتران التلفزيون', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 8),
                Text('افتح مجرة على هاتفك وامسح الكود', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20)),
                  child: Column(
                    children: [
                      Container(
                        width: 180,
                        height: 180,
                        decoration: BoxDecoration(color: const Color(0xFF0B1026), borderRadius: BorderRadius.circular(12)),
                        child: const Center(child: Icon(Icons.qr_code_2_rounded, color: Colors.white, size: 96)),
                      ),
                      const SizedBox(height: 14),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                        decoration: BoxDecoration(color: const Color(0xFFF5F7FC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFDCE3F0))),
                        child: const Text('— — —', style: TextStyle(color: Color(0xFF0B1026), fontSize: 22, fontWeight: FontWeight.w900, letterSpacing: 4)),
                      ),
                      const SizedBox(height: 8),
                      Text('خدمة الاقتران غير متاحة بعد', style: TextStyle(color: const Color(0xFF546078), fontSize: 11)),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
                  child: Row(children: [const Icon(Icons.info_outline_rounded, color: AppColors.electricCyan, size: 18), const SizedBox(width: 8), Expanded(child: Text('الموافقة والدفع وإدارة الأجهزة تتم على هاتف ولي الأمر فقط، وليس على التلفزيون', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.78), fontSize: 11)))]),
                ),
                const Spacer(),
                SizedBox(width: double.infinity, height: 48, child: FilledButton(onPressed: () => context.pop(), style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.deepSpace), child: const Text('تم'))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
