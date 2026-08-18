import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import '../../../profile/data/billing_status.dart';
import '../widgets/profile_page_content.dart';

/// A device session on the family account.
class FamilyDevice {
  const FamilyDevice({
    required this.id,
    required this.name,
    required this.platform,
    required this.isActive,
    this.lastSeen,
  });

  factory FamilyDevice.fromJson(Map<String, Object?> json) {
    // The Durable Object stores snake_case; accept both spellings so a future
    // serialisation change does not silently blank the list.
    String text(String a, String b) {
      final value = json[a] ?? json[b];
      return value is String && value.trim().isNotEmpty ? value.trim() : '';
    }

    final revokedAt = json['revoked_at'] ?? json['revokedAt'];
    return FamilyDevice(
      id: text('device_id', 'deviceId').isNotEmpty
          ? text('device_id', 'deviceId')
          : text('id', 'id'),
      name: text('device_name', 'deviceName'),
      platform: text('platform', 'platform'),
      isActive: revokedAt == null,
      lastSeen: text('last_seen_at', 'lastSeenAt'),
    );
  }

  final String id;
  final String name;
  final String platform;
  final bool isActive;
  final String? lastSeen;

  String get displayName => name.isEmpty ? 'جهاز غير مسمّى' : name;

  String get subtitle {
    final parts = <String>[
      if (platform.isNotEmpty) platform,
      if (!isActive) 'تم إلغاء الوصول',
    ];
    return parts.isEmpty ? 'بدون تفاصيل' : parts.join(' • ');
  }
}

/// Devices registered to the family account.
///
/// `GET /api/v1/family/devices` and `POST /api/v1/family/devices/revoke` were
/// already implemented on the server but had no caller, while this page showed a
/// hardcoded three-item array and a fixed `'3 من 4 أجهزة'` count. Both are now
/// wired; the page requires a signed-in parent, so an unauthenticated visit gets
/// an explicit sign-in prompt rather than an empty list.
final familyDevicesProvider = FutureProvider<List<FamilyDevice>>((ref) async {
  final api = ref.watch(majarraApiClientProvider);
  final rows = await api.fetchDevices();
  return rows.map(FamilyDevice.fromJson).toList(growable: false);
});

class DevicesPage extends ConsumerWidget {
  const DevicesPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devices = ref.watch(familyDevicesProvider);

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
                tooltip: 'رجوع',
                onPressed: () => context.pop(),
              ),
              title: const Text(
                'إدارة الأجهزة',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh_rounded, color: Colors.white),
                  tooltip: 'تحديث',
                  onPressed: () => ref.invalidate(familyDevicesProvider),
                ),
              ],
            ),
            ...devices.when(
              loading: () => [
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.starGold),
                  ),
                ),
              ],
              error: (error, _) {
                final failure = AppFailure.fromException(error);
                final needsLogin = failure.kind == FailureKind.unauthorized;
                return [
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: _DevicesNotice(
                      icon: needsLogin
                          ? Icons.lock_outline_rounded
                          : Icons.cloud_off_outlined,
                      title: needsLogin
                          ? 'يتطلب تسجيل الدخول'
                          : 'تعذّر تحميل الأجهزة',
                      body: needsLogin
                          ? 'إدارة الأجهزة مرتبطة بحساب الأسرة. سجّل الدخول لعرض الأجهزة المسجّلة.'
                          : failure.message,
                      actionLabel: needsLogin
                          ? 'تسجيل الدخول'
                          : 'إعادة المحاولة',
                      onAction: needsLogin
                          ? () => context.push('/login')
                          : () => ref.invalidate(familyDevicesProvider),
                    ),
                  ),
                ];
              },
              data: (items) {
                if (items.isEmpty) {
                  return [
                    const SliverFillRemaining(
                      hasScrollBody: false,
                      child: _DevicesNotice(
                        icon: Icons.devices_other_rounded,
                        title: 'لا توجد أجهزة مسجّلة',
                        body:
                            'يُسجَّل الجهاز تلقائيًا عند تسجيل الدخول عليه، ثم '
                            'يظهر هنا.',
                      ),
                    ),
                  ];
                }

                final activeCount = items.where((d) => d.isActive).length;
                final billing = ref.watch(billingStatusProvider).valueOrNull;
                final maxDevices = billing?.limits.devices;
                return [
                  SliverToBoxAdapter(
                    child: ProfilePageContent(
                      child: _DevicesSummary(
                        activeCount: activeCount,
                        total: items.length,
                        maxDevices: maxDevices,
                      ),
                    ),
                  ),
                  SliverList(
                    delegate: SliverChildBuilderDelegate((context, index) {
                      final device = items[index];
                      return ProfilePageContent(
                        padding: const EdgeInsetsDirectional.fromSTEB(
                          18,
                          0,
                          18,
                          10,
                        ),
                        child: _DeviceTile(
                          device: device,
                          onRevoke: device.isActive
                              ? () => _confirmRevoke(context, ref, device)
                              : null,
                        ),
                      );
                    }, childCount: items.length),
                  ),
                  const SliverToBoxAdapter(child: SizedBox(height: 24)),
                ];
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmRevoke(
    BuildContext context,
    WidgetRef ref,
    FamilyDevice device,
  ) async {
    // Revoking signs the device out. That is disruptive and not obviously
    // reversible from the device's point of view, so it is confirmed first.
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: const Color(0xFF111A3A),
        title: const Text(
          'إلغاء وصول الجهاز؟',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
        ),
        content: Text(
          'سيُسجَّل الخروج من «${device.displayName}» ويحتاج تسجيل دخول جديدًا.',
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.86),
            fontSize: 12.5,
            height: 1.7,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: const Text('تأكيد'),
          ),
        ],
      ),
    );

    if (confirmed != true || !context.mounted) return;
    if (!ref.read(authGuardProvider).hasParentAccess) {
      context.go(
        Uri(
          path: '/parent-pin',
          queryParameters: {'from': '/devices'},
        ).toString(),
      );
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref
          .read(majarraApiClientProvider)
          .revokeDevice(deviceId: device.id);
      ref.invalidate(familyDevicesProvider);
      messenger.showSnackBar(
        const SnackBar(content: Text('تم إلغاء وصول الجهاز')),
      );
    } catch (_) {
      messenger.showSnackBar(
        const SnackBar(content: Text('تعذّر إلغاء الوصول. حاول مرة أخرى.')),
      );
    }
  }
}

class _DevicesSummary extends StatelessWidget {
  const _DevicesSummary({
    required this.activeCount,
    required this.total,
    this.maxDevices,
  });

  final int activeCount;
  final int total;
  final int? maxDevices;

  @override
  Widget build(BuildContext context) {
    final isNearLimit = maxDevices != null && activeCount >= maxDevices! - 1;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: (isNearLimit ? AppColors.starGold : AppColors.electricCyan)
              .withValues(alpha: 0.18),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.electricCyan.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.devices_rounded,
              color: AppColors.electricCyan,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activeCount == 1
                      ? 'جهاز نشط واحد'
                      : '$activeCount أجهزة نشطة',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  maxDevices != null
                      ? '$activeCount من $maxDevices أجهزة'
                      : 'من إجمالي $total جهاز مسجّل',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.7),
                    fontSize: 11,
                  ),
                ),
                if (isNearLimit)
                  Text(
                    'اقتربت من الحد الأقصى',
                    style: TextStyle(
                      color: AppColors.starGold.withValues(alpha: 0.9),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
          if (isNearLimit)
            const Icon(
              Icons.warning_amber_rounded,
              color: AppColors.starGold,
              size: 20,
            ),
        ],
      ),
    );
  }
}

class _DeviceTile extends StatelessWidget {
  const _DeviceTile({required this.device, required this.onRevoke});

  final FamilyDevice device;
  final VoidCallback? onRevoke;

  IconData get _icon {
    final platform = device.platform.toLowerCase();
    if (platform.contains('tv')) return Icons.tv_rounded;
    if (platform.contains('tablet') || platform.contains('ipad')) {
      return Icons.tablet_rounded;
    }
    if (platform.contains('web')) return Icons.language_rounded;
    if (platform.contains('windows')) return Icons.desktop_windows_rounded;
    if (platform.contains('mac')) return Icons.laptop_mac_rounded;
    if (platform.contains('linux')) return Icons.computer_rounded;
    if (platform.contains('ios')) return Icons.phone_iphone_rounded;
    return Icons.phone_android_rounded;
  }

  @override
  Widget build(BuildContext context) {
    final active = device.isActive;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: active
              ? AppColors.success.withValues(alpha: 0.22)
              : Colors.white.withValues(alpha: 0.06),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: active
                  ? AppColors.success.withValues(alpha: 0.14)
                  : Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              _icon,
              color: active ? AppColors.success : Colors.white,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  device.subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.62),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          if (active)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'نشط',
                style: TextStyle(
                  color: AppColors.success,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          if (onRevoke != null) ...[
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(
                Icons.logout_rounded,
                color: AppColors.mutedText,
                size: 18,
              ),
              tooltip: 'إلغاء الوصول',
              onPressed: onRevoke,
            ),
          ],
        ],
      ),
    );
  }
}

class _DevicesNotice extends StatelessWidget {
  const _DevicesNotice({
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => ProfilePageContent(
    padding: const EdgeInsets.all(32),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: AppColors.mutedText.withValues(alpha: 0.5), size: 46),
        const SizedBox(height: 14),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          body,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.72),
            fontSize: 12,
            height: 1.7,
          ),
        ),
        if (actionLabel != null && onAction != null) ...[
          const SizedBox(height: 18),
          FilledButton(onPressed: onAction, child: Text(actionLabel!)),
        ],
      ],
    ),
  );
}
