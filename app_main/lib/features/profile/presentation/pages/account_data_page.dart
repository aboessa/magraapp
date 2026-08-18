import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../auth/application/auth_controller.dart';
import '../../../auth/data/auth_storage.dart';
import '../../../child/application/child_provider.dart';
import '../../../games/application/creation_cloud_service.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';

class AccountProfile {
  const AccountProfile({
    required this.displayName,
    required this.email,
    required this.emailVerified,
  });

  final String? displayName;
  final String email;
  final bool emailVerified;

  factory AccountProfile.fromEnvelope(Map<String, dynamic> envelope) {
    final data = envelope['data'];
    if (data is! Map) throw StateError('Account profile is missing data');
    final name = data['display_name'];
    final email = data['email'];
    if (email is! String || email.isEmpty) {
      throw StateError('Account profile is missing email');
    }
    return AccountProfile(
      displayName: name is String && name.trim().isNotEmpty
          ? name.trim()
          : null,
      email: email,
      emailVerified: data['email_verified'] == true,
    );
  }
}

final accountProfileProvider = FutureProvider.autoDispose<AccountProfile>((
  ref,
) async {
  final envelope = await ref
      .watch(majarraApiClientProvider)
      .getAccountProfile();
  return AccountProfile.fromEnvelope(envelope);
});

final accountChildrenProvider =
    FutureProvider.autoDispose<List<Map<String, Object?>>>((ref) {
      return ref.watch(majarraApiClientProvider).fetchChildren();
    });

class AccountDataPage extends ConsumerStatefulWidget {
  const AccountDataPage({super.key});

  @override
  ConsumerState<AccountDataPage> createState() => _AccountDataPageState();
}

class _AccountDataPageState extends ConsumerState<AccountDataPage> {
  String? _busyAction;
  String? _message;
  bool _messageIsError = false;

  bool get _busy => _busyAction != null;

  void _showMessage(String value, {bool error = false}) {
    if (!mounted) return;
    setState(() {
      _message = value;
      _messageIsError = error;
    });
  }

  Future<void> _run(String action, Future<void> Function() operation) async {
    if (_busy) return;
    setState(() {
      _busyAction = action;
      _message = null;
    });
    try {
      await operation();
    } catch (error) {
      _showMessage(AppFailure.fromException(error).message, error: true);
    } finally {
      if (mounted) setState(() => _busyAction = null);
    }
  }

  Future<void> _editDisplayName(AccountProfile profile) async {
    final controller = TextEditingController(text: profile.displayName ?? '');
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('تعديل اسم عرض الأسرة'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 80,
          textInputAction: TextInputAction.done,
          decoration: const InputDecoration(labelText: 'اسم العرض'),
          onSubmitted: (value) => Navigator.pop(context, value.trim()),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (value == null || value.isEmpty || value == profile.displayName) return;
    await _run('profile', () async {
      await ref
          .read(majarraApiClientProvider)
          .updateAccountProfile(displayName: value);
      ref.invalidate(accountProfileProvider);
      _showMessage('تم تحديث اسم عرض الأسرة.');
    });
  }

  Future<void> _changePassword() async {
    final current = TextEditingController();
    final next = TextEditingController();
    final confirmation = TextEditingController();
    var obscure = true;
    final values = await showDialog<(String, String)>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('تغيير كلمة المرور'),
          content: SingleChildScrollView(
            child: AutofillGroup(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: current,
                    obscureText: obscure,
                    autofillHints: const [AutofillHints.password],
                    decoration: const InputDecoration(
                      labelText: 'كلمة المرور الحالية',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: next,
                    obscureText: obscure,
                    autofillHints: const [AutofillHints.newPassword],
                    decoration: const InputDecoration(
                      labelText: 'كلمة المرور الجديدة — 12 حرفًا على الأقل',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: confirmation,
                    obscureText: obscure,
                    autofillHints: const [AutofillHints.newPassword],
                    decoration: const InputDecoration(
                      labelText: 'تأكيد كلمة المرور الجديدة',
                    ),
                  ),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: TextButton.icon(
                      onPressed: () => setDialogState(() => obscure = !obscure),
                      icon: Icon(
                        obscure
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      label: Text(obscure ? 'إظهار' : 'إخفاء'),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('إلغاء'),
            ),
            FilledButton(
              onPressed: () {
                if (current.text.isEmpty || next.text.length < 12) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('تحقق من كلمة المرور الحالية والجديدة.'),
                    ),
                  );
                  return;
                }
                if (next.text != confirmation.text) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('كلمتا المرور غير متطابقتين.'),
                    ),
                  );
                  return;
                }
                Navigator.pop(context, (current.text, next.text));
              },
              child: const Text('غيّر كلمة المرور'),
            ),
          ],
        ),
      ),
    );
    current.dispose();
    next.dispose();
    confirmation.dispose();
    if (values == null) return;

    await _run('password', () async {
      final result = await ref
          .read(majarraApiClientProvider)
          .changePassword(currentPassword: values.$1, newPassword: values.$2);
      final data = result['data'];
      final accessToken = data is Map ? data['access_token'] : null;
      if (accessToken is! String || accessToken.isEmpty) {
        throw StateError('Password response is missing the renewed session');
      }
      await ref.read(authStorageProvider).updateAccessToken(accessToken);
      ref.read(authGuardProvider).revokeParentAccess();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('تم تغيير كلمة المرور وإغلاق الجلسات الأخرى.'),
        ),
      );
      context.go('/parent-pin?from=/account');
    });
  }

  Future<void> _exportData() async {
    await _run('export', () async {
      final raw = await ref.read(majarraApiClientProvider).exportAccountData();
      final decoded = jsonDecode(raw);
      final pretty = const JsonEncoder.withIndent('  ').convert(decoded);
      final bytes = Uint8List.fromList(utf8.encode(pretty));
      final date = DateTime.now().toIso8601String().substring(0, 10);
      await Share.shareXFiles([
        XFile.fromData(
          bytes,
          mimeType: 'application/json',
          name: 'majarra-data-export-$date.json',
        ),
      ], subject: 'تصدير بيانات حساب مجرة');
      _showMessage('تم تجهيز ملف التصدير للمشاركة أو الحفظ.');
    });
  }

  Future<void> _deleteChild(Map<String, Object?> child) async {
    final childId = child['id']?.toString() ?? '';
    final nickname = child['nickname']?.toString() ?? 'ملف الطفل';
    if (childId.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('حذف ملف $nickname؟'),
        content: const Text(
          'سيُحذف الملف والتقدم والمفضلة والمحاولات والرسومات السحابية المرتبطة به. لا يمكن التراجع عن هذا الطلب.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('احذف الملف'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    await _run('child-$childId', () async {
      final api = ref.read(majarraApiClientProvider);
      final storage = ref.read(authStorageProvider);
      final existingRequestId = await storage.getPendingChildDeletionRequestId(
        childId,
      );
      final deletionRequestId =
          existingRequestId ?? api.createChildDeletionRequestId();
      if (existingRequestId == null) {
        await storage.savePendingChildDeletion(
          childId: childId,
          requestId: deletionRequestId,
        );
      }

      Map<String, dynamic> result;
      try {
        result = await api.deleteChildAccountData(
          childId: childId,
          idempotencyKey: deletionRequestId,
        );
      } on ChildDeletionOutcomeUnknown {
        await ref.read(authControllerProvider).clearChildData(childId);
        ref.invalidate(accountChildrenProvider);
        _showMessage(
          'تعذر تأكيد حالة الطلب الآن. مُسحت بيانات الطفل المحلية وسيُعاد استخدام الطلب نفسه بأمان عند المحاولة.',
        );
        return;
      } catch (_) {
        try {
          await storage.clearPendingChildDeletion(childId);
        } catch (_) {}
        rethrow;
      }

      final data = result['data'];
      final acceptedRequestId = data is Map
          ? data['request_id']?.toString()
          : null;
      await ref.read(authControllerProvider).clearChildData(childId);
      ref.invalidate(accountChildrenProvider);
      if (acceptedRequestId == deletionRequestId) {
        await storage.clearPendingChildDeletion(childId);
        _showMessage('تم قبول طلب الحذف وسيُستكمل بأمان في الخلفية.');
      } else {
        // Preserve the recovery key for a malformed successful response.
        _showMessage(
          'تم مسح بيانات الطفل المحلية، ويجري التحقق من حالة طلب الحذف.',
        );
      }
    });
  }

  Set<String> _knownAccountChildIds() => <String>{
    if (ref.read(childProvider).activeChildId case final id? when id.isNotEmpty)
      id,
    for (final child
        in ref.read(accountChildrenProvider).valueOrNull ??
            const <Map<String, Object?>>[])
      if (child['id']?.toString() case final id? when id.isNotEmpty) id,
  };

  Future<void> _completeAcceptedAccountDeletion(
    AccountDeletionReceipt receipt,
  ) async {
    await ref
        .read(authControllerProvider)
        .completeAccountDeletion(
          parentId: receipt.parentId,
          childIds: _knownAccountChildIds(),
        );
    if (mounted) context.go('/deletion-status');
  }

  Future<void> _resumeAccountDeletion(AccountDeletionReceipt receipt) async {
    final storage = ref.read(authStorageProvider);
    final activeParentId = await storage.getParentId();
    if (activeParentId != null && activeParentId != receipt.parentId) {
      if (mounted) context.go('/deletion-status');
      return;
    }

    Map<String, dynamic> response;
    try {
      response = await ref
          .read(majarraApiClientProvider)
          .getAccountDeletionStatus(
            parentId: receipt.parentId,
            requestId: receipt.requestId,
            receiptSecret: receipt.secret,
          );
    } on MajarraApiException catch (error) {
      if (error.statusCode != 404) rethrow;
      final cleared = await storage.clearDeletionReceiptIfMatches(receipt);
      if (!cleared) {
        throw StateError('Deletion receipt changed while resolving status');
      }
      _showMessage(
        'لم يجد الخادم طلب الحذف السابق، لذلك لم يُقبل. اضغط حذف الحساب مرة أخرى لبدء طلب جديد.',
      );
      return;
    }

    final data = response['data'];
    final requestId = data is Map ? data['request_id']?.toString() : null;
    final scope = data is Map ? data['scope']?.toString() : null;
    final status = data is Map ? data['status']?.toString() : null;
    if (requestId != receipt.requestId ||
        scope != 'account' ||
        status == null ||
        status.isEmpty) {
      throw StateError('Deletion status does not match the saved receipt');
    }

    await _completeAcceptedAccountDeletion(receipt);
  }

  Future<void> _deleteAccount() async {
    await _run('account-delete', () async {
      final api = ref.read(majarraApiClientProvider);
      final storage = ref.read(authStorageProvider);
      await storage.runDeletionReceiptWorkflow(() async {
        final existingReceipt = await storage.getDeletionReceipt();
        if (existingReceipt != null) {
          await _resumeAccountDeletion(existingReceipt);
          return;
        }
        if (!mounted) return;

        final password = TextEditingController();
        final phrase = TextEditingController();
        var canDelete = false;
        String? currentPassword;
        try {
          currentPassword = await showDialog<String>(
            context: context,
            barrierDismissible: false,
            builder: (context) => StatefulBuilder(
              builder: (context, setDialogState) => AlertDialog(
                title: const Text('حذف حساب الأسرة نهائيًا'),
                content: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'سيبدأ حذف الحساب وملفات الأطفال والتقدم والرسومات والجلسات. لا يمكن التراجع بعد قبول الطلب.',
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        decoration: const InputDecoration(
                          labelText: 'كلمة المرور الحالية',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: phrase,
                        autocorrect: false,
                        decoration: const InputDecoration(
                          labelText: 'اكتب «حذف» للتأكيد',
                        ),
                        onChanged: (value) => setDialogState(
                          () => canDelete = value.trim() == 'حذف',
                        ),
                      ),
                    ],
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('إلغاء'),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.danger,
                    ),
                    onPressed: canDelete && password.text.isNotEmpty
                        ? () => Navigator.pop(context, password.text)
                        : null,
                    child: const Text('ابدأ الحذف النهائي'),
                  ),
                ],
              ),
            ),
          );
        } finally {
          password.dispose();
          phrase.dispose();
        }
        if (currentPassword == null || currentPassword.isEmpty) return;

        final parentId = await storage.getParentId();
        if (parentId == null || parentId.isEmpty) {
          throw StateError('Account identity is unavailable');
        }
        final knownChildIds = _knownAccountChildIds();
        final capability = api.createAccountDeletionCapability();
        final candidateReceipt = AccountDeletionReceipt(
          parentId: parentId,
          requestId: capability.requestId,
          secret: capability.secret,
        );
        final retainedReceipt = await storage.saveDeletionReceiptIfAbsent(
          candidateReceipt,
        );
        if (!retainedReceipt.sameCapability(candidateReceipt)) {
          await _resumeAccountDeletion(retainedReceipt);
          return;
        }

        Future<void> enterDeletionRecovery() async {
          await ref
              .read(authControllerProvider)
              .completeAccountDeletion(
                parentId: candidateReceipt.parentId,
                childIds: knownChildIds,
              );
          if (mounted) context.go('/deletion-status');
        }

        Map<String, dynamic> result;
        try {
          result = await api.deleteAccount(
            currentPassword: currentPassword,
            capability: capability,
          );
        } on AccountDeletionOutcomeUnknown {
          // The DELETE may have committed before the connection was lost. Keep
          // the pre-saved receipt and use it to resolve the public status.
          await enterDeletionRecovery();
          return;
        } catch (_) {
          // An explicit HTTP rejection is pre-acceptance and can clear only the
          // exact capability generated by this caller.
          await storage.clearDeletionReceiptIfMatches(candidateReceipt);
          rethrow;
        }
        final data = result['data'];
        final acceptedRequestId = data is Map
            ? data['request_id']?.toString()
            : null;
        if (acceptedRequestId != capability.requestId) {
          // A successful HTTP response with an unusable body is still ambiguous:
          // the server may already have revoked the session and queued deletion.
          await enterDeletionRecovery();
          return;
        }
        await enterDeletionRecovery();
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final profile = ref.watch(accountProfileProvider);
    final children = ref.watch(accountChildrenProvider);
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
                l10n.accountDataTitle,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_message != null) ...[
                          Semantics(
                            liveRegion: true,
                            child: _Notice(
                              message: _message!,
                              error: _messageIsError,
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        profile.when(
                          loading: () => const _AccountLoading(),
                          error: (_, __) => _AccountLoadError(
                            onRetry: () =>
                                ref.invalidate(accountProfileProvider),
                          ),
                          data: (value) => _ProfileCard(
                            profile: value,
                            busy: _busy,
                            onEdit: () => _editDisplayName(value),
                            onChangePassword: _changePassword,
                            onExport: _exportData,
                          ),
                        ),
                        const SizedBox(height: 18),
                        _ChildrenCard(
                          children: children,
                          busyAction: _busyAction,
                          onRetry: () =>
                              ref.invalidate(accountChildrenProvider),
                          onDelete: _deleteChild,
                        ),
                        const SizedBox(height: 18),
                        const _StoredDrawingsControl(),
                        const SizedBox(height: 18),
                        _DangerZone(
                          busy: _busyAction == 'account-delete',
                          enabled: !_busy,
                          onDelete: _deleteAccount,
                        ),
                      ],
                    ),
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

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.profile,
    required this.busy,
    required this.onEdit,
    required this.onChangePassword,
    required this.onExport,
  });

  final AccountProfile profile;
  final bool busy;
  final VoidCallback onEdit;
  final VoidCallback onChangePassword;
  final VoidCallback onExport;

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Center(
          child: CircleAvatar(
            radius: 44,
            backgroundColor: AppColors.indigoSurface,
            child: Icon(
              Icons.family_restroom_rounded,
              color: Colors.white,
              size: 38,
            ),
          ),
        ),
        const SizedBox(height: 18),
        _AccountValue(
          label: 'اسم عرض الأسرة',
          value: profile.displayName ?? 'لم يُحدّد اسم عرض',
          icon: Icons.badge_outlined,
        ),
        const SizedBox(height: 10),
        _AccountValue(
          label: 'البريد الإلكتروني',
          value: profile.email,
          icon: profile.emailVerified
              ? Icons.mark_email_read_outlined
              : Icons.mark_email_unread_outlined,
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            OutlinedButton.icon(
              onPressed: busy ? null : onEdit,
              icon: const Icon(Icons.edit_outlined),
              label: const Text('تعديل الاسم'),
            ),
            OutlinedButton.icon(
              onPressed: busy ? null : onChangePassword,
              icon: const Icon(Icons.password_rounded),
              label: const Text('تغيير كلمة المرور'),
            ),
            FilledButton.icon(
              onPressed: busy ? null : onExport,
              icon: const Icon(Icons.download_outlined),
              label: const Text('تصدير بياناتي'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          'تغيير البريد يحتاج مسار تحقق جديدًا قبل نقله، وربط الهاتف غير متاح دون مزود تحقق برسائل SMS. لن يعرض التطبيق نجاحًا وهميًا لهذين الإجرائين.',
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.78),
            fontSize: 12,
            height: 1.55,
          ),
        ),
      ],
    ),
  );
}

class _ChildrenCard extends StatelessWidget {
  const _ChildrenCard({
    required this.children,
    required this.busyAction,
    required this.onRetry,
    required this.onDelete,
  });

  final AsyncValue<List<Map<String, Object?>>> children;
  final String? busyAction;
  final VoidCallback onRetry;
  final Future<void> Function(Map<String, Object?> child) onDelete;

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'ملفات الأطفال',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 10),
        children.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (_, __) => OutlinedButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('تعذّر التحميل — أعد المحاولة'),
          ),
          data: (items) => items.isEmpty
              ? const Text(
                  'لا توجد ملفات أطفال نشطة.',
                  style: TextStyle(color: AppColors.mutedText),
                )
              : Column(
                  children: [
                    for (final child in items)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(
                          Icons.face_outlined,
                          color: AppColors.electricCyan,
                        ),
                        title: Text(
                          child['nickname']?.toString() ?? 'طفل',
                          style: const TextStyle(color: Colors.white),
                        ),
                        subtitle: Text(
                          child['age_track']?.toString() ?? '',
                          style: const TextStyle(color: AppColors.mutedText),
                        ),
                        trailing: IconButton(
                          tooltip: 'حذف ملف الطفل',
                          onPressed: busyAction == null
                              ? () => onDelete(child)
                              : null,
                          icon: busyAction == 'child-${child['id']}'
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(
                                  Icons.delete_outline_rounded,
                                  color: AppColors.danger,
                                ),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    ),
  );
}

class _DangerZone extends StatelessWidget {
  const _DangerZone({
    required this.busy,
    required this.enabled,
    required this.onDelete,
  });

  final bool busy;
  final bool enabled;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.danger.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.danger.withValues(alpha: 0.35)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'منطقة خطرة',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 6),
        const Text(
          'حذف الحساب نهائي، ويتطلب إثبات الوالد وكلمة المرور الحالية.',
          style: TextStyle(color: AppColors.mutedText, height: 1.5),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
          onPressed: enabled ? onDelete : null,
          icon: busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.delete_forever_outlined),
          label: const Text('حذف حساب الأسرة'),
        ),
      ],
    ),
  );
}

class _StoredDrawingsControl extends ConsumerStatefulWidget {
  const _StoredDrawingsControl();

  @override
  ConsumerState<_StoredDrawingsControl> createState() =>
      _StoredDrawingsControlState();
}

class _StoredDrawingsControlState
    extends ConsumerState<_StoredDrawingsControl> {
  bool _busy = false;
  String? _message;

  Future<void> _purge() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف رسومات الأطفال المحفوظة؟'),
        content: const Text(
          'سيُحذف كل ما حُفظ في مساحة أسرتك، وتُسحب الموافقة على الحفظ.\n\n'
          'الرسومات الموجودة على هذا الجهاز لا تتأثّر.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('احذف'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!ref.read(authGuardProvider).hasParentAccess) {
      if (mounted) context.go('/parent-pin?from=/account');
      return;
    }

    setState(() {
      _busy = true;
      _message = null;
    });
    final api = ref.read(majarraApiClientProvider);
    try {
      final result = await api.purgeCreations();
      final deleted = result['data'] is Map
          ? (result['data'] as Map)['objects_deleted']
          : null;
      await api.setConsent(
        consentType: kCreationsConsentType,
        version: kCreationsConsentVersion,
        revoke: true,
      );
      if (!mounted) return;
      setState(() => _message = 'تم الحذف. عناصر مُزالة: ${deleted ?? 0}.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _message = 'لم نتمكّن من الحذف. حاول لاحقًا.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Card(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'رسومات الأطفال المحفوظة',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 6),
        Text(
          'ما يُحفظ يبقى خاصًّا بأسرتك: لا يُنشر ولا يظهر في فهرس المحتوى.',
          style: TextStyle(
            color: AppColors.mutedText.withValues(alpha: 0.80),
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: _busy ? null : _purge,
          icon: _busy
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.delete_sweep_outlined),
          label: const Text('احذف كل الرسومات المحفوظة'),
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Semantics(
            liveRegion: true,
            child: Text(
              _message!,
              style: const TextStyle(color: AppColors.mutedText),
            ),
          ),
        ],
      ],
    ),
  );
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.indigoSurface,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
    ),
    child: child,
  );
}

class _Notice extends StatelessWidget {
  const _Notice({required this.message, required this.error});

  final String message;
  final bool error;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: (error ? AppColors.danger : AppColors.electricCyan).withValues(
        alpha: 0.10,
      ),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Text(
      message,
      style: const TextStyle(color: Colors.white, height: 1.5),
    ),
  );
}

class _AccountLoading extends StatelessWidget {
  const _AccountLoading();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 52),
    child: Center(child: CircularProgressIndicator(color: AppColors.starGold)),
  );
}

class _AccountLoadError extends StatelessWidget {
  const _AccountLoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          const Icon(
            Icons.cloud_off_outlined,
            color: AppColors.mutedText,
            size: 44,
          ),
          const SizedBox(height: 12),
          const Text(
            'تعذّر تحميل بيانات الحساب',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('إعادة المحاولة'),
          ),
        ],
      ),
    ),
  );
}

class _AccountValue extends StatelessWidget {
  const _AccountValue({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    decoration: BoxDecoration(
      color: const Color(0xFF111A3A).withValues(alpha: 0.72),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Row(
      children: [
        Icon(icon, color: Colors.white, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.70),
                  fontSize: 11,
                ),
              ),
              SelectableText(
                value,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
