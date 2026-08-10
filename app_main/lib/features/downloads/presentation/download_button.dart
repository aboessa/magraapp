import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../application/download_manager.dart';
import '../application/download_providers.dart';
import '../domain/download_models.dart';

/// A self-contained download control for one piece of content (§4).
///
/// Reflects the real [DownloadManager] state for [request.id]: it shows a
/// download affordance when nothing is stored, live progress while downloading,
/// a "downloaded" state when ready (tap to delete), and a retry affordance on
/// failure. A refused enqueue surfaces the true reason (entitlement, network,
/// storage) rather than failing silently.
class DownloadButton extends ConsumerWidget {
  const DownloadButton({required this.request, super.key});

  final DownloadRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(downloadManagerProvider);
    final manager = ref.read(downloadManagerProvider.notifier);
    final existing = items.where((i) => i.id == request.id).firstOrNull;

    if (existing == null) {
      return _Chip(
        icon: Icons.download_rounded,
        label: 'تنزيل',
        onTap: () => _start(context, manager),
      );
    }

    switch (existing.status) {
      case DownloadStatus.queued:
      case DownloadStatus.downloading:
        return _Chip(
          icon: Icons.hourglass_top_rounded,
          label: existing.totalBytes > 0
              ? '${(existing.progress * 100).round()}%'
              : 'يُحمّل',
          onTap: () => manager.pause(existing.id),
        );
      case DownloadStatus.paused:
        return _Chip(icon: Icons.play_arrow_rounded, label: 'استئناف', onTap: () => manager.resume(existing.id));
      case DownloadStatus.ready:
        return _Chip(
          icon: Icons.download_done_rounded,
          label: 'مُحمّل',
          highlighted: true,
          onTap: () => _confirmDelete(context, manager, existing.id),
        );
      case DownloadStatus.failed:
        return _Chip(icon: Icons.refresh_rounded, label: 'إعادة', onTap: () => manager.retry(existing.id));
      case DownloadStatus.expired:
        return _Chip(icon: Icons.refresh_rounded, label: 'تجديد', onTap: () => manager.retry(existing.id));
    }
  }

  Future<void> _start(BuildContext context, DownloadManager manager) async {
    final rejection = await manager.enqueue(request);
    if (!context.mounted || rejection == DownloadRejection.none) return;
    final message = switch (rejection) {
      DownloadRejection.notEntitled => 'التنزيل متاح في باقات الاشتراك المدفوعة.',
      DownloadRejection.offlineOrMetered =>
        'التنزيل عبر Wi-Fi فقط مفعّل، أو لا يوجد اتصال. تحقّق من الشبكة أو الإعدادات.',
      DownloadRejection.storageFull => 'لا توجد مساحة تخزين كافية.',
      DownloadRejection.alreadyExists => 'هذا المحتوى في قائمة التنزيلات بالفعل.',
      DownloadRejection.noSource => 'هذا المحتوى غير متاح للتنزيل بعد.',
      DownloadRejection.none => '',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _confirmDelete(BuildContext context, DownloadManager manager, String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف التنزيل؟'),
        content: const Text('سيُحذف الملف المُحمّل من هذا الجهاز.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) await manager.delete(id);
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.icon,
    required this.label,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final color = highlighted ? const Color(0xFF3DDC97) : Colors.white;
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }
}
