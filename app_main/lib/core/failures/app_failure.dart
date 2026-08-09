/// Central error taxonomy for the app (H5).
///
/// The worker returns raw HTTP bodies or SQL errors, but the user must never
/// see them — see AUDIT_FLUTTER_APP.md T18. This class maps every
/// [MajarraApiException] into one of a handful of Arabic, safe-for-display
/// messages and a semantic kind the UI can switch on (retry, login, upgrade…).
///
/// Usage:
///   try { await api.login(...); }
///   on MajarraApiException catch (e) {
///     final f = AppFailure.fromException(e);
///     ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(f.message)));
///     if (f.needsLogin) context.go('/login');
///   }

enum FailureKind { network, timeout, unauthorized, forbidden, notFound, conflict, rateLimited, server, unknown }

class AppFailure {
  const AppFailure(this.kind, this.message, {this.needsLogin = false, this.needsUpgrade = false});

  final FailureKind kind;
  final String message;
  final bool needsLogin;
  final bool needsUpgrade;

  static AppFailure fromException(Object error) {
    final raw = error.toString();
    // MajarraApiException wraps as "MajarraApiException: HTTP 401: {...}"
    // or "MajarraApiException: Network request failed" etc.
    if (raw.contains('Network request failed') || raw.contains('SocketException') || raw.contains('ClientException')) {
      return const AppFailure(FailureKind.network, 'تعذّر الاتصال. تحقّق من الإنترنت وحاول مجددًا');
    }
    if (raw.contains('Request timed out') || raw.contains('TimeoutException')) {
      return const AppFailure(FailureKind.timeout, 'انتهت مهلة الطلب. حاول مجددًا');
    }
    if (raw.contains('HTTP 401') || raw.contains('Unauthorized')) {
      return const AppFailure(FailureKind.unauthorized, 'انتهت الجلسة. سجّل الدخول مجددًا', needsLogin: true);
    }
    if (raw.contains('HTTP 403')) {
      // The worker uses 403 for both “needs subscription” and “device limit”.
      if (raw.contains('subscription') || raw.contains('entitlement') || raw.contains('plan')) {
        return const AppFailure(FailureKind.forbidden, 'هذا المحتوى يتطلب اشتراكًا', needsUpgrade: true);
      }
      if (raw.contains('device limit') || raw.contains('Device is revoked')) {
        return const AppFailure(FailureKind.forbidden, 'تم بلوغ حد الأجهزة لهذا الحساب');
      }
      return const AppFailure(FailureKind.forbidden, 'ليس لديك صلاحية لهذا الإجراء');
    }
    if (raw.contains('HTTP 404')) {
      return const AppFailure(FailureKind.notFound, 'المحتوى غير موجود');
    }
    if (raw.contains('HTTP 409')) {
      return const AppFailure(FailureKind.conflict, 'تعارض في البيانات. حدّث الصفحة وحاول مجددًا');
    }
    if (raw.contains('HTTP 429')) {
      return const AppFailure(FailureKind.rateLimited, 'محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا');
    }
    if (raw.contains('HTTP 5') || raw.contains('Internal server error') || raw.contains('Family service unavailable')) {
      return const AppFailure(FailureKind.server, 'خطأ في الخادم. سنعمل على إصلاحه — حاول لاحقًا');
    }
    if (raw.contains('Response is not valid JSON') || raw.contains('Response envelope is invalid') || raw.contains('Invalid envelope')) {
      return const AppFailure(FailureKind.server, 'استجابة غير متوقعة من الخادم');
    }
    // Fallback — never leak the raw body.
    return const AppFailure(FailureKind.unknown, 'حدث خطأ غير متوقع. حاول مجددًا');
  }

  static AppFailure network() => const AppFailure(FailureKind.network, 'تعذّر الاتصال. تحقّق من الإنترنت وحاول مجددًا');
  static AppFailure timeout() => const AppFailure(FailureKind.timeout, 'انتهت مهلة الطلب. حاول مجددًا');
}
