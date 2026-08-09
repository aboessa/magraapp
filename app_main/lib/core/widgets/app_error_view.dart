import 'package:flutter/material.dart';

import '../failures/app_failure.dart';

/// A reusable, child-safe error surface (§26).
///
/// A children's app must never strand the child on a raw exception string or a
/// stack trace. This widget takes any caught [error], routes it through the
/// [AppFailure] taxonomy, and shows a calm Arabic message with exactly the
/// recovery action the failure calls for: retry for transient problems, sign-in
/// for an expired session, upgrade for an entitlement gate.
///
/// A parent-facing surface may pass [showDiagnosticDetail] to reveal the failure
/// kind, which is safe (it is a category, never the raw body) and helps a parent
/// describe a problem to support.
class AppErrorView extends StatelessWidget {
  const AppErrorView({
    required this.error,
    this.onRetry,
    this.onLogin,
    this.onUpgrade,
    this.compact = false,
    this.showDiagnosticDetail = false,
    super.key,
  });

  /// Convenience constructor when the caller already resolved a failure.
  const AppErrorView.failure({
    required AppFailure failure,
    VoidCallback? onRetry,
    VoidCallback? onLogin,
    VoidCallback? onUpgrade,
    bool compact = false,
    bool showDiagnosticDetail = false,
    Key? key,
  }) : this(
          error: failure,
          onRetry: onRetry,
          onLogin: onLogin,
          onUpgrade: onUpgrade,
          compact: compact,
          showDiagnosticDetail: showDiagnosticDetail,
          key: key,
        );

  final Object error;
  final VoidCallback? onRetry;
  final VoidCallback? onLogin;
  final VoidCallback? onUpgrade;

  /// A denser layout suitable for embedding inside a rail or card.
  final bool compact;

  /// Parent-facing builds may show the failure category.
  final bool showDiagnosticDetail;

  AppFailure get _failure =>
      error is AppFailure ? error as AppFailure : AppFailure.fromException(error);

  IconData get _icon {
    switch (_failure.kind) {
      case FailureKind.network:
      case FailureKind.timeout:
        return Icons.wifi_off_rounded;
      case FailureKind.unauthorized:
        return Icons.lock_outline_rounded;
      case FailureKind.forbidden:
        return _failure.needsUpgrade
            ? Icons.workspace_premium_outlined
            : Icons.block_flipped;
      case FailureKind.notFound:
        return Icons.search_off_rounded;
      case FailureKind.server:
        return Icons.cloud_off_rounded;
      case FailureKind.conflict:
      case FailureKind.rateLimited:
      case FailureKind.unknown:
        return Icons.error_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final failure = _failure;
    final theme = Theme.of(context);
    final actions = <Widget>[];

    if (failure.needsLogin && onLogin != null) {
      actions.add(
        FilledButton.icon(
          onPressed: onLogin,
          icon: const Icon(Icons.login_rounded),
          label: const Text('تسجيل الدخول'),
        ),
      );
    } else if (failure.needsUpgrade && onUpgrade != null) {
      actions.add(
        FilledButton.icon(
          onPressed: onUpgrade,
          icon: const Icon(Icons.workspace_premium_outlined),
          label: const Text('عرض الاشتراك'),
        ),
      );
    }

    if (onRetry != null) {
      final retryButton = actions.isEmpty
          ? FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('إعادة المحاولة'),
            )
          : OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('إعادة المحاولة'),
            );
      actions.add(retryButton);
    }

    final content = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(_icon, size: compact ? 36 : 52, color: theme.colorScheme.secondary),
        SizedBox(height: compact ? 10 : 16),
        Text(
          failure.message,
          style: compact ? theme.textTheme.bodyLarge : theme.textTheme.titleLarge,
          textAlign: TextAlign.center,
        ),
        if (showDiagnosticDetail) ...[
          const SizedBox(height: 6),
          Text(
            'رمز: ${failure.kind.name}',
            style: theme.textTheme.bodySmall,
            textAlign: TextAlign.center,
          ),
        ],
        if (actions.isNotEmpty) ...[
          SizedBox(height: compact ? 12 : 20),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: actions,
          ),
        ],
      ],
    );

    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? 16 : 28),
        child: content,
      ),
    );
  }
}

/// A slim inline banner announcing degraded/offline mode without blocking the
/// content beneath it. Used when cached or downloaded content is usable but the
/// user should know it is not live.
class OfflineNotice extends StatelessWidget {
  const OfflineNotice({
    this.message = 'أنت في وضع بلا اتصال — نعرض المحتوى المحفوظ',
    this.onRetry,
    super.key,
  });

  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.35),
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 8, 8, 8),
        child: Row(
          children: [
            const Icon(Icons.cloud_off_rounded, size: 18),
            const SizedBox(width: 10),
            Expanded(
              child: Text(message, style: theme.textTheme.bodyMedium),
            ),
            if (onRetry != null)
              TextButton(
                onPressed: onRetry,
                child: const Text('تحديث'),
              ),
          ],
        ),
      ),
    );
  }
}
