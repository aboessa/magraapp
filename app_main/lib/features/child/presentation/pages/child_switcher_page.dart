import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/child_provider.dart';

class ChildSwitcherPage extends ConsumerWidget {
  const ChildSwitcherPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = [
      {'name': 'ليلى', 'age': '5 سنوات', 'track': 'preschool', 'color': const Color(0xFFFF6FAE), 'icon': Icons.child_care_rounded, 'id': 'child-laila'},
      {'name': 'عمر', 'age': '7 سنوات', 'track': 'kids', 'color': const Color(0xFF00D6F5), 'icon': Icons.face_rounded, 'id': 'child-omar'},
      {'name': 'سارة', 'age': '10 سنوات', 'track': 'junior', 'color': const Color(0xFF6A3DF2), 'icon': Icons.school_rounded, 'id': 'child-sara'},
    ];

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 12),
                const Text('من يشاهد الآن؟', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                Text('ملفات تجريبية لتصفّح التجربة — لم تُربط ملفات العائلة بعد', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                const SizedBox(height: 24),
                Expanded(
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 0.88, crossAxisSpacing: 14, mainAxisSpacing: 14),
                    itemCount: children.length + 1,
                    itemBuilder: (context, index) {
                      if (index == children.length) {
                        return _AddChildCard(onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('إضافة ملف طفل غير متاحة بعد'))));
                      }
                      final c = children[index];
                      final track = c['track'] as String;
                      final isPreschool = track == 'preschool';
                      return _ChildCard(
                        name: c['name'] as String,
                        age: c['age'] as String,
                        track: track,
                        color: c['color'] as Color,
                        icon: c['icon'] as IconData,
                        onTap: () {
                          ref.read(childProvider.notifier).selectChild(childId: c['id'] as String, ageTrack: track);
                          context.go('/');
                        },
                        isLarge: isPreschool,
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(onPressed: () => context.push('/parent-pin'), icon: const Icon(Icons.lock_outline_rounded, size: 18), label: const Text('منطقة ولي الأمر'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: BorderSide(color: Colors.white.withValues(alpha: 0.12)), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ChildCard extends StatelessWidget {
  const _ChildCard({required this.name, required this.age, required this.track, required this.color, required this.icon, required this.onTap, required this.isLarge});
  final String name;
  final String age;
  final String track;
  final Color color;
  final IconData icon;
  final VoidCallback onTap;
  final bool isLarge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF111A3A).withValues(alpha: 0.82),
      borderRadius: BorderRadius.circular(isLarge ? 22 : 18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(isLarge ? 22 : 18),
        child: Container(
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(isLarge ? 22 : 18), border: Border.all(color: color.withValues(alpha: 0.22)), boxShadow: [BoxShadow(color: color.withValues(alpha: 0.12), blurRadius: 16)]),
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              Container(
                width: isLarge ? 64 : 56,
                height: isLarge ? 64 : 56,
                decoration: BoxDecoration(shape: BoxShape.circle, color: color.withValues(alpha: 0.18), border: Border.all(color: color.withValues(alpha: 0.32))),
                child: Icon(icon, color: color, size: isLarge ? 32 : 26),
              ),
              const Spacer(),
              Text(name, style: TextStyle(color: Colors.white, fontSize: isLarge ? 16 : 14, fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(age, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11)),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: color.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(6)),
                child: Text(track == 'preschool' ? 'براعم' : track == 'kids' ? 'مستكشفون' : 'روّاد', style: TextStyle(color: color, fontSize: 9, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddChildCard extends StatelessWidget {
  const _AddChildCard({required this.onTap});
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white.withValues(alpha: 0.12), style: BorderStyle.solid), color: Colors.white.withValues(alpha: 0.04)),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Container(width: 48, height: 48, decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: Colors.white.withValues(alpha: 0.14), style: BorderStyle.solid)), child: const Icon(Icons.add_rounded, color: Colors.white, size: 28)), const SizedBox(height: 10), const Text('إضافة طفل', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)), Text('3–12 سنة', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11))]),
          ),
        ),
      );
}
