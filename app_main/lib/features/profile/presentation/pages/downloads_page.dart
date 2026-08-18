import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../child/application/child_provider.dart';
import '../../../downloads/application/download_manager.dart';
import '../../../downloads/application/download_providers.dart';
import '../../../downloads/domain/download_models.dart';
import '../widgets/profile_page_content.dart';

/// Real, child-scoped files managed by [DownloadManager].
class DownloadsPage extends ConsumerStatefulWidget {
  const DownloadsPage({super.key});

  @override
  ConsumerState<DownloadsPage> createState() => _DownloadsPageState();
}

class _DownloadsPageState extends ConsumerState<DownloadsPage> {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final childId = ref.watch(childProvider).activeChildId;
    final allItems = ref.watch(downloadManagerProvider);
    final items = childId == null
        ? const <DownloadItem>[]
        : allItems.where((item) => item.childId == childId).toList();
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
                icon: const Icon(
                  Icons.arrow_forward_rounded,
                  color: Colors.white,
                ),
                tooltip: l10n.back,
                onPressed: () => context.pop(),
              ),
              title: Text(
                l10n.downloadsTitle,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
              actions: [
                if (items.isNotEmpty)
                  Semantics(
                    button: true,
                    label: 'حذف كل تنزيلات الطفل الحالي',
                    child: IconButton(
                      tooltip: 'حذف الكل',
                      icon: const Icon(
                        Icons.delete_sweep_rounded,
                        color: Colors.white,
                      ),
                      onPressed: childId == null
                          ? null
                          : () => _confirmDeleteAll(context, manager, childId),
                    ),
                  ),
              ],
            ),
            SliverToBoxAdapter(child: _StorageCard(l10n: l10n)),
            if (items.isEmpty)
              SliverToBoxAdapter(
                child: ProfilePageContent(
                  padding: const EdgeInsetsDirectional.fromSTEB(32, 56, 32, 56),
                  child: _EmptyDownloads(l10n: l10n),
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
            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDeleteAll(
    BuildContext context,
    DownloadManager manager,
    String childId,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف كل تنزيلات الطفل؟'),
        content: const Text(
          'سيُحذف من هذا الجهاز كل المحتوى المحمّل للطفل الحالي فقط.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('حذف'),
          ),
        ],
      ),
    );
    if (confirmed == true) await manager.deleteAll(childId);
  }
}

class _EmptyDownloads extends StatelessWidget {
  const _EmptyDownloads({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: const Color(0xFF111A3A),
          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        ),
        child: const Icon(
          Icons.download_rounded,
          color: AppColors.starGold,
          size: 32,
        ),
      ),
      const SizedBox(height: 16),
      Text(
        l10n.noDownloadsTitle,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
        ),
      ),
      const SizedBox(height: 6),
      Text(
        'يمكن تنزيل الملفات الصوتية العامة من صفحة الاستماع. الوسائط الخاصة المحمية غير متاحة دون اتصال حاليًا.',
        textAlign: TextAlign.center,
        style: TextStyle(
          color: AppColors.mutedText.withValues(alpha: 0.72),
          fontSize: 12,
          height: 1.6,
        ),
      ),
    ],
  );
}

/// Real on-disk storage usage, recalculated whenever the list changes.
class _StorageCard extends ConsumerWidget {
  const _StorageCard({required this.l10n});

  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(downloadManagerProvider);
    final usedFuture = ref
        .read(downloadManagerProvider.notifier)
        .storageUsedBytes();

    return ProfilePageContent(
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
              child: const Icon(
                Icons.storage_rounded,
                color: AppColors.electricCyan,
              ),
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
                      Text(
                        l10n.storageUsedTitle,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        formatBytes(used),
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.8),
                          fontSize: 12,
                        ),
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
  const _DownloadRow({
    required this.item,
    required this.manager,
    required this.isFirst,
  });

  final DownloadItem item;
  final DownloadManager manager;
  final bool isFirst;

  @override
  Widget build(BuildContext context) {
    return ProfilePageContent(
      padding: EdgeInsetsDirectional.fromSTEB(18, isFirst ? 4 : 0, 18, 10),
      child: Semantics(
        container: true,
        label: '${item.title}، حالة التنزيل: ${item.status.label}',
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF111A3A).withValues(alpha: 0.72),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SizedBox(
                      width: 84,
                      height: 58,
                      child: item.posterUrl != null
                          ? CinematicImage(
                              assetPath:
                                  'assets/images/explore/explore-watch.webp',
                              networkUrl: item.posterUrl,
                              semanticLabel: 'غلاف ${item.title}',
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
                        Text(
                          item.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                        if (item.subtitle.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            item.subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: AppColors.mutedText.withValues(alpha: 0.7),
                              fontSize: 11,
                            ),
                          ),
                        ],
                        const SizedBox(height: 7),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            _StatusChip(status: item.status),
                            if (item.status == DownloadStatus.ready)
                              Text(
                                formatBytes(item.totalBytes),
                                style: TextStyle(
                                  color: AppColors.mutedText.withValues(
                                    alpha: 0.6,
                                  ),
                                  fontSize: 10,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (item.status == DownloadStatus.downloading) ...[
                const SizedBox(height: 10),
                Semantics(
                  label: 'تقدم التنزيل',
                  value: item.totalBytes > 0
                      ? '${(item.progress * 100).round()} بالمئة'
                      : 'جارٍ الحساب',
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: item.totalBytes > 0 ? item.progress : null,
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                      valueColor: const AlwaysStoppedAnimation(
                        AppColors.electricCyan,
                      ),
                      minHeight: 5,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 6),
              Align(
                alignment: AlignmentDirectional.centerEnd,
                child: _actions(context),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _actions(BuildContext context) {
    final actions = switch (item.status) {
      DownloadStatus.downloading || DownloadStatus.queued => <Widget>[
        _ActionButton(
          label: 'إيقاف تنزيل ${item.title} مؤقتًا',
          icon: Icons.pause_circle_outline_rounded,
          onPressed: () => manager.pause(item.id),
        ),
      ],
      DownloadStatus.paused => <Widget>[
        _ActionButton(
          label: 'استئناف تنزيل ${item.title}',
          icon: Icons.play_circle_outline_rounded,
          color: AppColors.electricCyan,
          onPressed: () => manager.resume(item.id),
        ),
      ],
      DownloadStatus.failed || DownloadStatus.expired => <Widget>[
        _ActionButton(
          label: 'إعادة محاولة تنزيل ${item.title}',
          icon: Icons.refresh_rounded,
          color: AppColors.starGold,
          onPressed: () => manager.retry(item.id),
        ),
        _deleteButton(),
      ],
      DownloadStatus.ready => <Widget>[
        if (item.contentType == 'episode' || item.contentType == 'audio_story')
          _ActionButton(
            label: 'فتح ${item.title}',
            icon: Icons.play_circle_fill_rounded,
            color: AppColors.electricCyan,
            onPressed: () => _open(context),
          ),
        _deleteButton(),
      ],
    };
    return Wrap(spacing: 4, runSpacing: 4, children: actions);
  }

  void _open(BuildContext context) {
    if (item.contentType == 'episode') {
      context.push('/playback/${item.id}');
      return;
    }
    if (item.contentType == 'audio_story') {
      context.push(
        Uri(
          path: '/audio',
          queryParameters: {
            'downloadId': item.id,
            'title': item.title,
            if (item.subtitle.isNotEmpty) 'subtitle': item.subtitle,
            if ((item.posterUrl ?? '').isNotEmpty) 'artworkUrl': item.posterUrl,
          },
        ).toString(),
      );
    }
  }

  Widget _deleteButton() => _ActionButton(
    label: 'حذف تنزيل ${item.title}',
    icon: Icons.delete_outline_rounded,
    color: AppColors.mutedText,
    onPressed: () => manager.delete(item.id),
  );
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.color = Colors.white,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final Color color;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    child: IconButton(
      tooltip: label,
      icon: Icon(icon, color: color),
      onPressed: onPressed,
    ),
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
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    decoration: BoxDecoration(
      color: _color,
      borderRadius: BorderRadius.circular(4),
    ),
    child: Text(
      status.label,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 9,
        fontWeight: FontWeight.w700,
      ),
    ),
  );
}
