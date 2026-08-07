import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _autoplay = false;
  bool _downloadWifiOnly = true;
  bool _notifications = true;
  String _quality = 'تلقائي';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: const Text('الإعدادات', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _SectionHeader(title: 'التشغيل'),
                    _TileSwitch(title: 'تشغيل تلقائي للحلقة التالية', subtitle: 'يعمل فقط على Wi-Fi ووفق إعداد ولي الأمر', value: _autoplay, onChanged: (v) => setState(() => _autoplay = v)),
                    const SizedBox(height: 8),
                    _TileNav(title: 'جودة الفيديو', trailing: _quality, onTap: () => _pickQuality()),
                    const SizedBox(height: 18),
                    _SectionHeader(title: 'التنزيل'),
                    _TileSwitch(title: 'التحميل عبر Wi-Fi فقط', subtitle: 'توفير البيانات', value: _downloadWifiOnly, onChanged: (v) => setState(() => _downloadWifiOnly = v)),
                    const SizedBox(height: 18),
                    _SectionHeader(title: 'الإشعارات'),
                    _TileSwitch(title: 'إشعارات المحتوى الجديد', subtitle: 'حلقات وأعمال جديدة', value: _notifications, onChanged: (v) => setState(() => _notifications = v)),
                    const SizedBox(height: 18),
                    _SectionHeader(title: 'عام'),
                    _TileNav(title: 'اللغة', trailing: 'العربية', onTap: () {}),
                    const SizedBox(height: 8),
                    _TileNav(title: 'المظهر', trailing: 'داكن سينمائي', onTap: () {}),
                    const SizedBox(height: 8),
                    _TileNav(title: 'مسح التخزين المؤقت', trailing: '—', onTap: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('لا يوجد تخزين مؤقت لإدارته بعد')))),
                    const SizedBox(height: 24),
                    TextButton(onPressed: () {}, style: TextButton.styleFrom(foregroundColor: AppColors.danger), child: const Text('تسجيل خروج')),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _pickQuality() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: ['تلقائي', 'جودة عالية', 'توفير البيانات'].map((q) => ListTile(title: Text(q, style: const TextStyle(color: Colors.white)), trailing: q == _quality ? const Icon(Icons.check_rounded, color: AppColors.starGold) : null, onTap: () { setState(() => _quality = q); Navigator.pop(context); })).toList(),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Text(title, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.5)));
}

class _TileSwitch extends StatelessWidget {
  const _TileSwitch({required this.title, required this.subtitle, required this.value, required this.onChanged});
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: BorderRadius.circular(14), border: Border.all(color: Colors.white.withValues(alpha: 0.06))),
        child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)), Text(subtitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11))])), Switch(value: value, onChanged: onChanged, activeThumbColor: AppColors.starGold)]),
      );
}

class _TileNav extends StatelessWidget {
  const _TileNav({required this.title, required this.trailing, required this.onTap});
  final String title;
  final String trailing;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: const Color(0xFF111A3A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(border: Border.all(color: Colors.white.withValues(alpha: 0.06)), borderRadius: BorderRadius.circular(14)),
            child: Row(children: [Text(title, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)), const Spacer(), Text(trailing, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 12)), const SizedBox(width: 6), const Icon(Icons.chevron_left_rounded, color: Colors.white, size: 18)]),
          ),
        ),
      );
}
