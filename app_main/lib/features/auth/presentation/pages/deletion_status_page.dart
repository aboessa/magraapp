import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/failures/app_failure.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../application/auth_controller.dart';
import '../../data/auth_storage.dart';

class DeletionStatusPage extends ConsumerStatefulWidget {
  const DeletionStatusPage({super.key});

  @override
  ConsumerState<DeletionStatusPage> createState() => _DeletionStatusPageState();
}

class _DeletionStatusPageState extends ConsumerState<DeletionStatusPage> {
  bool _loading = true;
  bool _localCleanupPending = false;
  bool _activeParentMismatch = false;
  AccountDeletionReceipt? _receipt;
  String? _status;
  String? _error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _completeLocalCleanup() async {
    final receipt = _receipt;
    if (receipt == null) {
      _localCleanupPending = false;
      _error = 'لا يوجد إيصال حذف صالح لإكمال المسح المحلي.';
      if (mounted) setState(() {});
      return;
    }

    final activeParentId = await ref.read(authStorageProvider).getParentId();
    if (activeParentId != null && activeParentId != receipt.parentId) {
      _activeParentMismatch = true;
      _localCleanupPending = false;
      _error =
          'طلب الحذف يخص حسابًا سابقًا. لن تُمسح بيانات الحساب المفتوح حاليًا.';
      if (mounted) setState(() {});
      return;
    }

    try {
      await ref
          .read(authControllerProvider)
          .completeAccountDeletion(parentId: receipt.parentId);
      _localCleanupPending = false;
      _activeParentMismatch = false;
      _error = null;
    } catch (_) {
      _localCleanupPending = true;
      _error =
          'تم تأكيد طلب الحذف، لكن تعذّر مسح بيانات الحساب من هذا الجهاز. أعد محاولة المسح المحلي.';
    }
    if (mounted) setState(() {});
  }

  Future<void> _refresh() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    final storage = ref.read(authStorageProvider);
    try {
      await storage.runDeletionReceiptWorkflow(() async {
        AccountDeletionReceipt? checkedReceipt;
        try {
          final receipt = await storage.getDeletionReceipt();
          checkedReceipt = receipt;
          _receipt = receipt;
          if (receipt == null) {
            _status = null;
            _localCleanupPending = false;
            _activeParentMismatch = false;
            return;
          }
          final response = await ref
              .read(majarraApiClientProvider)
              .getAccountDeletionStatus(
                parentId: receipt.parentId,
                requestId: receipt.requestId,
                receiptSecret: receipt.secret,
              );
          final data = response['data'];
          final requestId = data is Map ? data['request_id']?.toString() : null;
          final scope = data is Map ? data['scope']?.toString() : null;
          final status = data is Map ? data['status']?.toString() : null;
          if (requestId != receipt.requestId ||
              scope != 'account' ||
              status == null ||
              status.isEmpty) {
            throw StateError(
              'Deletion status does not match the saved receipt',
            );
          }
          _status = status;

          final activeParentId = await storage.getParentId();
          _activeParentMismatch =
              activeParentId != null && activeParentId != receipt.parentId;
          if (_activeParentMismatch) {
            _localCleanupPending = false;
            _error =
                'طلب الحذف يخص حسابًا سابقًا. لن تُمسح بيانات الحساب المفتوح حاليًا.';
            if (mounted) setState(() {});
            return;
          }

          _localCleanupPending = true;
          if (mounted) setState(() {});
          await _completeLocalCleanup();
        } on MajarraApiException catch (error) {
          if (error.statusCode == 404 && checkedReceipt != null) {
            try {
              final cleared = await storage.clearDeletionReceiptIfMatches(
                checkedReceipt,
              );
              if (!cleared) {
                throw StateError(
                  'Deletion receipt changed while resolving status',
                );
              }
              _receipt = null;
              _status = null;
              _localCleanupPending = false;
              _activeParentMismatch = false;
              _error =
                  'لم يجد الخادم طلب الحذف السابق، لذلك لم يُقبل. أزيل إيصال الاسترداد المحلي.';
            } catch (clearError) {
              _error = AppFailure.fromException(clearError).message;
            }
          } else {
            _error = AppFailure.fromException(error).message;
          }
          if (mounted) setState(() {});
        } catch (error) {
          _error = AppFailure.fromException(error).message;
          if (mounted) setState(() {});
        }
      });
    } catch (error) {
      _error = AppFailure.fromException(error).message;
      if (mounted) setState(() {});
    } finally {
      _loading = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _retryLocalCleanup() async {
    if (_loading || !_localCleanupPending) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref
          .read(authStorageProvider)
          .runDeletionReceiptWorkflow(_completeLocalCleanup);
    } finally {
      _loading = false;
      if (mounted) setState(() {});
    }
  }

  Future<void> _finish() async {
    final receipt = _receipt;
    if (_loading ||
        _localCleanupPending ||
        _status != 'completed' ||
        receipt == null) {
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final storage = ref.read(authStorageProvider);
    try {
      var returnToCurrentAccount = false;
      await storage.runDeletionReceiptWorkflow(() async {
        final activeParentId = await storage.getParentId();
        returnToCurrentAccount =
            activeParentId != null && activeParentId != receipt.parentId;
        final cleared = await storage.clearDeletionReceiptIfMatches(receipt);
        if (!cleared) {
          throw StateError('Deletion receipt changed before completion');
        }
        _receipt = null;
      });
      if (mounted) context.go(returnToCurrentAccount ? '/' : '/login');
    } catch (error) {
      _error = AppFailure.fromException(error).message;
    } finally {
      _loading = false;
      if (mounted) setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final completed = _status == 'completed';
    final cleanupPending = _localCleanupPending;
    final foreignAccount = _activeParentMismatch;
    return PopScope(
      canPop: !_loading && !cleanupPending,
      child: Scaffold(
        backgroundColor: AppColors.deepSpace,
        body: CinematicBackground(
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Icon(
                        cleanupPending
                            ? Icons.warning_amber_rounded
                            : foreignAccount
                            ? Icons.shield_outlined
                            : completed
                            ? Icons.check_circle_outline_rounded
                            : Icons.hourglass_top_rounded,
                        size: 58,
                        color: cleanupPending
                            ? AppColors.danger
                            : foreignAccount
                            ? AppColors.electricCyan
                            : completed
                            ? Colors.greenAccent
                            : AppColors.starGold,
                      ),
                      const SizedBox(height: 18),
                      Text(
                        cleanupPending
                            ? 'يلزم إكمال المسح المحلي'
                            : foreignAccount
                            ? 'طلب حذف لحساب سابق'
                            : completed
                            ? 'اكتمل حذف الحساب'
                            : _status == null
                            ? 'لا يوجد طلب حذف محفوظ'
                            : 'طلب الحذف قيد التنفيذ',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        cleanupPending
                            ? 'قُبل طلب الحذف، لكن بيانات الحساب على هذا الجهاز لم تُمسح بالكامل بعد.'
                            : foreignAccount
                            ? 'يمكن متابعة حالة الطلب القديم دون لمس بيانات الحساب المفتوح حاليًا.'
                            : completed
                            ? 'أزيلت بيانات الحساب من الأنظمة التي تديرها مجرة.'
                            : _status == null
                            ? 'يمكنك العودة إلى تسجيل الدخول.'
                            : 'يُستكمل حذف الملفات والبيانات بأمان في الخلفية. يمكنك التحقق مجددًا.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: AppColors.mutedText,
                          height: 1.6,
                        ),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 16),
                        Semantics(
                          liveRegion: true,
                          child: Text(
                            _error!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppColors.danger),
                          ),
                        ),
                      ],
                      const SizedBox(height: 24),
                      if (_loading)
                        const Center(child: CircularProgressIndicator())
                      else if (cleanupPending)
                        FilledButton.icon(
                          onPressed: _retryLocalCleanup,
                          icon: const Icon(Icons.cleaning_services_rounded),
                          label: const Text('أعد محاولة المسح المحلي'),
                        )
                      else if (completed)
                        FilledButton(
                          onPressed: _finish,
                          child: Text(
                            foreignAccount
                                ? 'إغلاق الحالة والعودة'
                                : 'العودة لتسجيل الدخول',
                          ),
                        )
                      else ...[
                        FilledButton.icon(
                          onPressed: _refresh,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('تحقق مجددًا'),
                        ),
                        TextButton(
                          onPressed: () =>
                              context.go(foreignAccount ? '/' : '/login'),
                          child: Text(
                            foreignAccount
                                ? 'العودة للحساب الحالي'
                                : 'العودة الآن',
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
