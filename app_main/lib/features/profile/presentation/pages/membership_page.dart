import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../data/billing_status.dart';

/// Membership and subscription state.
///
/// This page previously had no data source at all: `GET /api/v1/billing/status`
/// did not exist on the server, so the card showed `'غير مربوط'` with an em-dash
/// price and both actions were disabled. The endpoint now exists and reports the
/// same effective plan the server uses to enforce limits, so what is shown here
/// cannot disagree with what the account actually grants.
class MembershipPage extends ConsumerWidget {
  const MembershipPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(billingStatusProvider);

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
                'العضوية',
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
                  onPressed: () => ref.invalidate(billingStatusProvider),
                ),
              ],
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: status.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.symmetric(vertical: 60),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: AppColors.starGold,
                      ),
                    ),
                  ),
                  error: (_, __) => _SignInNotice(
                    onSignIn: () => context.push('/login'),
                  ),
                  data: (data) => Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _PlanCard(status: data),
                      if (data.subscription?.inGrace == true) ...[
                        const SizedBox(height: 12),
                        const _GraceWarning(),
                      ],
                      const SizedBox(height: 16),
                      _UsageSection(limits: data.limits),
                      const SizedBox(height: 16),
                      _EntitlementsSection(status: data),
                      const SizedBox(height: 22),
                      // Purchase and management flows require Google Play
                      // Billing on the client, which is not integrated. The
                      // buttons stay disabled rather than opening a dead end.
                      SizedBox(
                        height: 52,
                        child: FilledButton(
                          onPressed: null,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.starGold,
                            foregroundColor: AppColors.deepSpace,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: Text(
                            data.plan.isPaid
                                ? 'إدارة الاشتراك — عبر Google Play'
                                : 'الترقية — غير متاحة بعد',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'الشراء والإلغاء يتمّان من خلال متجر Google Play. لم '
                        'تُدمج واجهة الشراء في التطبيق بعد.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.mutedText.withValues(alpha: 0.6),
                          fontSize: 11,
                          height: 1.7,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({required this.status});

  final BillingStatus status;

  @override
  Widget build(BuildContext context) {
    final subscription = status.subscription;
    final paid = status.plan.isPaid;

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF6A3DF2),
            Color(0xFF1B2550),
            Color(0xFF0B1026),
          ],
        ),
        border: Border.all(
          color: AppColors.starGold.withValues(alpha: paid ? 0.42 : 0.16),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.cosmicPurple.withValues(alpha: 0.22),
            blurRadius: 24,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: paid
                      ? AppColors.success.withValues(alpha: 0.24)
                      : AppColors.mutedText.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  subscription?.statusLabel ?? 'بدون اشتراك',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const Spacer(),
              Icon(
                Icons.workspace_premium_rounded,
                color: paid
                    ? AppColors.starGold
                    : AppColors.starGold.withValues(alpha: 0.4),
                size: 28,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            status.plan.label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            paid
                ? 'الباقة سارية على هذا الحساب'
                : 'يمكنك تصفّح المكتبة المجانية بدون اشتراك',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.72),
              fontSize: 12,
            ),
          ),
          if (subscription != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                Text(
                  subscription.sourceLabel,
                  style: const TextStyle(
                    color: AppColors.starGold,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                Text(
                  // Renewal date is only shown when the server actually
                  // reported one; a null expiry means a non-expiring grant.
                  subscription.expiresAt == null
                      ? 'بدون تاريخ انتهاء'
                      : 'حتى ${_formatDate(subscription.expiresAt!)}',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.72),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  static String _formatDate(DateTime value) {
    final local = value.toLocal();
    final month = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return '$day/$month/${local.year}';
  }
}

/// Shown while a payment is failing but access is still granted.
class _GraceWarning extends StatelessWidget {
  const _GraceWarning();

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.starGold.withValues(alpha: 0.10),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.starGold.withValues(alpha: 0.32)),
    ),
    child: Row(
      children: [
        const Icon(
          Icons.warning_amber_rounded,
          color: AppColors.starGold,
          size: 20,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            'هناك مشكلة في الدفع. الوصول ما زال متاحًا خلال مهلة السماح، '
            'راجع طريقة الدفع في Google Play.',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.9),
              fontSize: 11.5,
              height: 1.7,
            ),
          ),
        ),
      ],
    ),
  );
}

/// Plan caps and how much of each is currently used.
class _UsageSection extends StatelessWidget {
  const _UsageSection({required this.limits});

  final BillingLimits limits;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: 0.72),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'حدود الباقة',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 14),
        _UsageRow(
          icon: Icons.family_restroom_rounded,
          label: 'ملفات الأطفال',
          used: limits.usedChildren,
          total: limits.children,
        ),
        const SizedBox(height: 10),
        _UsageRow(
          icon: Icons.devices_rounded,
          label: 'الأجهزة المسجّلة',
          used: limits.usedDevices,
          total: limits.devices,
        ),
        const SizedBox(height: 14),
        const Divider(height: 1, color: Colors.white12),
        const SizedBox(height: 12),
        _LimitLine(
          label: 'مشاهدة متزامنة',
          value: '${limits.concurrentStreams}',
        ),
        const SizedBox(height: 6),
        _LimitLine(
          label: 'أجهزة التنزيل',
          value: limits.downloadDevices == 0
              ? 'غير متاح في هذه الباقة'
              : '${limits.downloadDevices}',
        ),
      ],
    ),
  );
}

class _UsageRow extends StatelessWidget {
  const _UsageRow({
    required this.icon,
    required this.label,
    required this.used,
    required this.total,
  });

  final IconData icon;
  final String label;
  final int used;
  final int total;

  @override
  Widget build(BuildContext context) {
    final ratio = total <= 0 ? 0.0 : (used / total).clamp(0.0, 1.0);
    final atLimit = total > 0 && used >= total;

    return Row(
      children: [
        Icon(icon, color: AppColors.mutedText, size: 18),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    label,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '$used / $total',
                    style: TextStyle(
                      color: atLimit
                          ? AppColors.starGold
                          : AppColors.mutedText.withValues(alpha: 0.72),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 4,
                  backgroundColor: Colors.white.withValues(alpha: 0.08),
                  valueColor: AlwaysStoppedAnimation(
                    atLimit ? AppColors.starGold : AppColors.electricCyan,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _LimitLine extends StatelessWidget {
  const _LimitLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Text(
        label,
        style: TextStyle(
          color: AppColors.mutedText.withValues(alpha: 0.82),
          fontSize: 11.5,
        ),
      ),
      const Spacer(),
      Text(
        value,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
        ),
      ),
    ],
  );
}

/// What the current plan does and does not include.
///
/// Derived from the plan tier rather than listed as fixed marketing copy, so a
/// free account is not shown paid features as if it already had them.
class _EntitlementsSection extends StatelessWidget {
  const _EntitlementsSection({required this.status});

  final BillingStatus status;

  @override
  Widget build(BuildContext context) {
    final paid = status.plan.isPaid;
    final downloads = status.limits.downloadDevices > 0;

    return Column(
      children: [
        _Feature(
          icon: Icons.download_rounded,
          title: 'تحميل دون اتصال',
          included: downloads,
          // Downloads need the offline service, which is not implemented, so
          // this is stated even when the plan would allow it.
          note: downloads
              ? 'مسموح في باقتك — الميزة قيد التطوير'
              : 'غير مضمّن في باقتك',
        ),
        const SizedBox(height: 10),
        _Feature(
          icon: Icons.family_restroom_rounded,
          title: 'ملفات متعددة للأطفال',
          included: status.limits.children > 1,
          note: 'حتى ${status.limits.children} ملف',
        ),
        const SizedBox(height: 10),
        _Feature(
          icon: Icons.hd_rounded,
          title: 'مشاهدة على أكثر من جهاز',
          included: status.limits.concurrentStreams > 1,
          note: '${status.limits.concurrentStreams} مشاهدة متزامنة',
        ),
        const SizedBox(height: 10),
        _Feature(
          icon: Icons.block_rounded,
          title: 'بدون إعلانات',
          included: paid,
          note: paid ? 'مضمّن' : 'مضمّن في الباقات المدفوعة',
        ),
      ],
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({
    required this.icon,
    required this.title,
    required this.included,
    required this.note,
  });

  final IconData icon;
  final String title;
  final bool included;
  final String note;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: included ? 0.72 : 0.4),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
    ),
    child: Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: included
                ? AppColors.cosmicPurple.withValues(alpha: 0.18)
                : Colors.white.withValues(alpha: 0.05),
            border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
          ),
          child: Icon(
            icon,
            color: included
                ? Colors.white
                : Colors.white.withValues(alpha: 0.4),
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: included
                      ? Colors.white
                      : Colors.white.withValues(alpha: 0.52),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              Text(
                note,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.7),
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        Icon(
          included ? Icons.check_circle_rounded : Icons.remove_circle_outline,
          color: included
              ? AppColors.success
              : AppColors.mutedText.withValues(alpha: 0.4),
          size: 18,
        ),
      ],
    ),
  );
}

class _SignInNotice extends StatelessWidget {
  const _SignInNotice({required this.onSignIn});

  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40),
    child: Column(
      children: [
        Icon(
          Icons.lock_outline_rounded,
          color: AppColors.mutedText.withValues(alpha: 0.5),
          size: 46,
        ),
        const SizedBox(height: 14),
        const Text(
          'يتطلب تسجيل الدخول',
          style: TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'العضوية مرتبطة بحساب الأسرة. سجّل الدخول لعرض باقتك وحدودها.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.72),
            fontSize: 12,
            height: 1.7,
          ),
        ),
        const SizedBox(height: 18),
        FilledButton(
          onPressed: onSignIn,
          child: const Text('تسجيل الدخول'),
        ),
      ],
    ),
  );
}
