import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../downloads/application/download_manager.dart';
import '../../../downloads/application/download_providers.dart';
import '../../../downloads/domain/download_models.dart';

/// Offline downloads (§4).
///
/// This page reflects the real [DownloadManager] state: each row is a file on
/// disk (or a download in flight), with its true status, progress, size and
/// expiry, and actions that operate on the actual file. There are no catalogue
/// stand-ins here anymore.
class DownloadsPage extends ConsumerStatefulWidget {
  const DownloadsPage({super.key});

  @override
  ConsumerState<DownloadsPage> createState() => _DownloadsPageState();
}

class _DownloadsPageState extends ConsumerState<DownloadsPage> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final items = ref.watch(downloadManagerProvider);
    final manager = ref.read(downloadManagerProvider.notifier);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(
                icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
                onPressed: () => context.pop(),
              ),
              title: Text(l10n.downloadsTitle,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
              actions: [
                if (items.isNotEmpty)
                  IconButton(
                    tooltip: 'حذف الكل',
                    icon: const Icon(Icons.delete_sweep_rounded, color: Colors.white),
                    onPressed: () => _confirmDeleteAll(context, manager),
                  ),
              ],
            ),
            SliverToBoxAdapter(child: _StorageCard(l10n: l10n)),
            if (items.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: const Color(0xFF111A3A),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        ),
                        child: const Icon(Icons.download_rounded, color: AppColors.starGold, size: 32),
                      ),
                      const SizedBox(height: 16),
                      Text(l10n.noDownloadsTitle,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 6),
                      Text(l10n.noDownloadsBody,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12)),
                    ]),
                  ),
                ),
              )
            else
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, index) => _DownloadRow(
                    item: items[index],
                    manager: manager,
                    isFirst: index == 0,
                  ),
                  childCount: items.length,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDeleteAll(BuildContext context, DownloadManager manager) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف كل التحميلات؟'),
        content: const Text('سيُحذف كل المحتوى المُحمّل من هذا الجهاز.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('إلغاء')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('حذف')),
        ],
      ),
    );
    if (ok == true) await manager.deleteAll();
  }
}

/// Real on-disk storage usage, read from the manager.
class _StorageCard extends ConsumerWidget {
  const _StorageCard({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Re-read whenever the list changes so deleting frees the bar immediately.
    ref.watch(downloadManagerProvider);
    final usedFuture = ref.read(downloadManagerProvider.notifier).storageUsedBytes();

    return Padding(
      padding: const EdgeInsets.all(18),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: const Color(0xFF111A3A).withValues(alpha: 0.72),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: AppColors.electricCyan.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.storage_rounded, color: AppColors.electricCyan),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FutureBuilder<int>(
                future: usedFuture,
                builder: (context, snapshot) {
                  final used = snapshot.data ?? 0;
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.storageUsedTitle,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                      const SizedBox(height: 6),
                      Text(
                        formatBytes(used),
                        style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.8), fontSize: 12),
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DownloadRow extends StatelessWidget {
  const _DownloadRow({required this.item, required this.manager, required this.isFirst});

  final DownloadItem item;
  final DownloadManager manager;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(18, isFirst ? 4 : 0, 18, 10),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF111A3A).withValues(alpha: 0.72),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
        ),
        child: Column(
          children: [
            Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 84,
                    height: 50,
                    child: item.posterUrl != null
                        ? CinematicImage(
                            assetPath: 'assets/brand/majarra-logo.png',
                            networkUrl: item.posterUrl,
                            semanticLabel: item.title,
                            fit: BoxFit.cover,
                          )
                        : Container(color: AppColors.indigoSurface),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                      const SizedBox(height: 2),
                      Text(item.subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7), fontSize: 11)),
                      const SizedBox(height: 6),
                      Row(children: [
                        _StatusChip(status: item.status),
                        const SizedBox(width: 6),
                        if (item.status == DownloadStatus.ready)
                          Text(formatBytes(item.totalBytes),
                              style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.6), fontSize: 10)),
                      ]),
                    ],
                  ),
                ),
                _actions(context),
              ],
            ),
            if (item.status == DownloadStatus.downloading) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: item.totalBytes > 0 ? item.progress : null,
                  backgroundColor: Colors.white.withValues(alpha: 0.08),
                  valueColor: const AlwaysStoppedAnimation(AppColors.electricCyan),
                  minHeight: 5,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _actions(BuildContext context) {
    switch (item.status) {
      case DownloadStatus.downloading:
      case DownloadStatus.queued:
        return IconButton(
          tooltip: 'إيقاف مؤقت',
          icon: const Icon(Icons.pause_circle_outline_rounded, color: Colors.white),
          onPressed: () => manager.pause(item.id),
        );
      case DownloadStatus.paused:
        return IconButton(
          tooltip: 'استئناف',
          icon: const Icon(Icons.play_circle_outline_rounded, color: AppColors.electricCyan),
          onPressed: () => manager.resume(item.id),
        );
      case DownloadStatus.failed:
      case DownloadStatus.expired:
        return Row(mainAxisSize: MainAxisSize.min, children: [
          IconButton(
            tooltip: 'إعادة المحاولة',
            icon: const Icon(Icons.refresh_rounded, color: AppColors.starGold),
            onPressed: () => manager.retry(item.id),
          ),
          _deleteButton(context),
        ]);
      case DownloadStatus.ready:
        return _deleteButton(context);
    }
  }

  Widget _deleteButton(BuildContext context) => IconButton(
        tooltip: 'حذف',
        icon: const Icon(Icons.delete_outline_rounded, color: AppColors.mutedText),
        onPressed: () => manager.delete(item.id),
      );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final DownloadStatus status;

  Color get _color => switch (status) {
        DownloadStatus.ready => AppColors.success,
        DownloadStatus.downloading => AppColors.electricCyan,
        DownloadStatus.queued => AppColors.mutedText,
        DownloadStatus.paused => AppColors.starGold,
        DownloadStatus.expired => AppColors.mutedText,
        DownloadStatus.failed => const Color(0xFFE0564F),
      };

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(color: _color, borderRadius: BorderRadius.circular(4)),
      child: Text(status.label,
          style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
    );
  }
}
