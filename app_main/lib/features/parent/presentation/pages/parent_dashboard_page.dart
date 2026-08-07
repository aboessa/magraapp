import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';


class ParentDashboardPage extends StatelessWidget {
  const ParentDashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0B1026),
        foregroundColor: Colors.white,
        title: const Text('منطقة ولي الأمر', style: TextStyle(fontWeight: FontWeight.w800)),
        leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded), onPressed: () => context.pop()),
      ),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFDCE3F0))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [const Icon(Icons.family_restroom_rounded, color: Color(0xFF2856D8)), const SizedBox(width: 8), const Text('العائلة', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF10162F))), const Spacer(), Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: const Color(0xFFE3F0FF), borderRadius: BorderRadius.circular(6)), child: const Text('3 أطفال', style: TextStyle(color: Color(0xFF2856D8), fontSize: 11, fontWeight: FontWeight.w700)))]),
                const SizedBox(height: 12),
                const Divider(height: 1),
                const SizedBox(height: 12),
                _ChildReport(name: 'ليلى • 5 سنوات', progress: 'مغامرات الأرقام - 42%', color: const Color(0xFFFF6FAE), time: '32 دقيقة اليوم'),
                const SizedBox(height: 10),
                _ChildReport(name: 'عمر • 7 سنوات', progress: 'حكاية وحكمة - 68%', color: const Color(0xFF00D6F5), time: '48 دقيقة اليوم'),
                const SizedBox(height: 10),
                _ChildReport(name: 'سارة • 10 سنوات', progress: 'اكتشف جسمك - 90%', color: const Color(0xFF6A3DF2), time: '21 دقيقة اليوم'),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFDCE3F0))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('وقت المشاهدة', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF10162F))),
                const SizedBox(height: 12),
                _TimeTile(name: 'ليلى', time: '32د', limit: '45د', color: const Color(0xFFFF6FAE)),
                const SizedBox(height: 8),
                _TimeTile(name: 'عمر', time: '48د', limit: '60د', color: const Color(0xFF00D6F5)),
                const SizedBox(height: 8),
                _TimeTile(name: 'سارة', time: '21د', limit: '90د', color: const Color(0xFF6A3DF2)),
                const SizedBox(height: 12),
                SizedBox(height: 44, child: OutlinedButton(onPressed: () {}, child: const Text('تعديل الحدود'))),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFDCE3F0))),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('السماحات', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF10162F))),
                const SizedBox(height: 12),
                _SwitchTile(title: 'كوكب الإيمان والآداب', subtitle: 'يظهر فقط بموافقتك - لا يؤثر على ترتيب الكواكب', value: false, onChanged: (_) {}),
                const SizedBox(height: 8),
                _SwitchTile(title: 'التنزيل دون اتصال', subtitle: 'السماح بالتحميل على أجهزة الأطفال', value: true, onChanged: (_) {}),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text('كل طفل معزول حسب child_id - لا يتم دمج أعمار مختلفة في درجة واحدة', textAlign: TextAlign.center, style: TextStyle(color: const Color(0xFF66718C), fontSize: 11)),
        ],
      ),
    );
  }
}

class _ChildReport extends StatelessWidget {
  const _ChildReport({required this.name, required this.progress, required this.color, required this.time});
  final String name;
  final String progress;
  final Color color;
  final String time;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFF8FAFD), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEDF1F9))),
        child: Row(
          children: [
            Container(width: 36, height: 36, decoration: BoxDecoration(shape: BoxShape.circle, color: color.withValues(alpha: 0.14)), child: Icon(Icons.person_rounded, color: color, size: 18)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12, color: Color(0xFF10162F))), Text(progress, style: TextStyle(color: const Color(0xFF546078), fontSize: 11))])),
            Text(time, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
          ],
        ),
      );
}

class _TimeTile extends StatelessWidget {
  const _TimeTile({required this.name, required this.time, required this.limit, required this.color});
  final String name;
  final String time;
  final String limit;
  final Color color;
  @override
  Widget build(BuildContext context) => Row(
        children: [
          SizedBox(width: 40, child: Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF10162F)))),
          Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: 0.6, backgroundColor: const Color(0xFFEDF1F9), valueColor: AlwaysStoppedAnimation(color)))),
          const SizedBox(width: 8),
          Text('$time / $limit', style: TextStyle(color: const Color(0xFF546078), fontSize: 11)),
        ],
      );
}

class _SwitchTile extends StatelessWidget {
  const _SwitchTile({required this.title, required this.subtitle, required this.value, required this.onChanged});
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(color: const Color(0xFFF8FAFD), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFEDF1F9))),
        child: Row(
          children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Color(0xFF10162F))), Text(subtitle, style: TextStyle(color: const Color(0xFF7B879D), fontSize: 10))])),
            Switch(value: value, onChanged: onChanged),
          ],
        ),
      );
}
