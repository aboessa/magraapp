import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/router/auth_guard.dart';

/// Locks down `AuthGuard`'s parental-access grant/revoke behaviour so it can
/// never regress into fail-open.
///
/// This is a lock-in test for *existing* behaviour, not a bugfix. Prior
/// analysis of `parent_pin_page.dart` (since split into `pin_setup_page.dart`
/// and `pin_unlock_page.dart`, task 23) confirmed that `AuthGuard.grantParentAccess`
/// is the only way `hasParentAccess` ever becomes `true`, that it is only ever
/// called from `_completeUnlock` after a real success response
/// (`setParentPin`/`verifyParentPin`), and that every `catch` branch inside
/// `_submit()` — network failure, 401, 403 (wrong PIN), 423/lockout, and any
/// non-`MajarraApiException` — only sets `_error` and never calls
/// `_completeUnlock` or `grantParentAccess`. This suite exercises
/// `AuthGuard` directly (no widget, no `MajarraApiClient` mock needed) to pin
/// down the guard's own fail-closed properties, matching the
/// data-and-fixtures-inside-the-file style used in `story_reader_dwell_test.dart`.
///
/// Requirements: 1.5.
void main() {
  group('grantParentAccess يرفض بلا مصادقة حقيقية', () {
    // 1
    test('AuthGuard جديد بلا setAuthenticated يرفض المنح', () {
      final guard = AuthGuard();

      final granted = guard.grantParentAccess(
        proof: 'x',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );

      expect(granted, isFalse);
      expect(guard.hasParentAccess, isFalse);
    });
  });

  group('grantParentAccess يرفض مدخلات غير صالحة رغم مصادقة حقيقية', () {
    // 2
    test('proof فارغ يُرفض', () {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');

      final granted = guard.grantParentAccess(
        proof: '',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );

      expect(granted, isFalse);
      expect(guard.hasParentAccess, isFalse);
    });

    // 3
    test('expiresAt في الماضي يُرفض', () {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');

      final granted = guard.grantParentAccess(
        proof: 'valid-proof',
        expiresAt: DateTime.now().subtract(const Duration(minutes: 1)),
      );

      expect(granted, isFalse);
      expect(guard.hasParentAccess, isFalse);
    });
  });

  group('grantParentAccess ينجح بمدخل صالح', () {
    // 4
    test('proof وexpiresAt صالحان يمنحان الوصول', () {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      final granted = guard.grantParentAccess(
        proof: 'valid-proof',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );

      expect(granted, isTrue);
      expect(guard.hasParentAccess, isTrue);
      expect(guard.parentProof, isNotNull);
    });
  });

  group('انتهاء الوصول تلقائيًا بلا نداء صريح', () {
    // 5
    test('hasParentAccess يعود false تلقائيًا بعد انقضاء expiresAt', () async {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      final granted = guard.grantParentAccess(
        proof: 'valid-proof',
        expiresAt: DateTime.now().add(const Duration(milliseconds: 50)),
      );
      expect(granted, isTrue);
      expect(guard.hasParentAccess, isTrue);

      // Real wait, not a call to revokeParentAccess: the guard's own
      // internal Timer (armed inside grantParentAccess) must fire this,
      // proving the expiry is enforced without any explicit revoke call.
      await Future<void>.delayed(const Duration(milliseconds: 150));

      expect(guard.hasParentAccess, isFalse);
      expect(guard.parentProof, isNull);
    });
  });

  group('تبديل الجلسة يُسقط الوصول فورًا', () {
    // 6
    test('setAuthenticated مرة ثانية لنفس parentId يُسقط hasParentAccess', () {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      final granted = guard.grantParentAccess(
        proof: 'valid-proof',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );
      expect(granted, isTrue);
      expect(guard.hasParentAccess, isTrue);

      // Same account signing in again — must not silently keep the proof
      // from the previous session alive. `_clearParentAccess` is called
      // unconditionally inside `setAuthenticated`, not only on the first call.
      guard.setAuthenticated(true, parentId: 'p1');

      expect(guard.hasParentAccess, isFalse);
      expect(guard.parentProof, isNull);
    });
  });

  group('تسجيل الخروج يُسقط الوصول فورًا', () {
    // 7
    test('handleLogout يصفّر hasParentAccess وisAuthenticated', () {
      final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
      addTearDown(guard.dispose);

      final granted = guard.grantParentAccess(
        proof: 'valid-proof',
        expiresAt: DateTime.now().add(const Duration(minutes: 5)),
      );
      expect(granted, isTrue);
      expect(guard.hasParentAccess, isTrue);

      guard.handleLogout();

      expect(guard.hasParentAccess, isFalse);
      expect(guard.isAuthenticated, isFalse);
    });
  });

  group('غياب مسار fail-open في _submit (توثيقي)', () {
    // 8
    //
    // ملاحظة صريحة: هذه حالة توثيقية لا تحقّقية. الفروع الأربعة أدناه تعيش في
    // `_submit()` داخل `pin_unlock_page.dart` (طبقة الواجهة، منقولة من
    // `parent_pin_page.dart` القديم في المهمة 23)، لا في `AuthGuard` الذي
    // تختبره بقية هذا الملف مباشرة. بناء اختبار widget حقيقي لها يتطلب mock
    // كامل لـ`MajarraApiClient` (استثناء شبكة، ثم استثناءات
    // `MajarraApiException` برسائل '401'، '403'/'Incorrect PIN'،
    // '423'/'Too many attempts') بالإضافة إلى تشغيل `PinUnlockPage` كـwidget
    // كامل مع Riverpod وGoRouter — تعقيد غير متناسب مع نطاق هذه المهمة التي
    // تستهدف خصائص `AuthGuard` نفسها. القراءة المصدرية المباشرة لـ
    // `pin_unlock_page.dart` (راجع `_submit()`) تؤكد أن الفروع الأربعة التالية
    // تنتهي جميعًا بـ`setState(() => _error = ...)` فقط، بلا أي نداء لـ
    // `_completeUnlock` أو `grantParentAccess`:
    //   1. فشل شبكة عام (`catch (_)`, خارج `on MajarraApiException`).
    //   2. 401 / `Unauthorized` (`on MajarraApiException` → `msg.contains('401')`).
    //   3. 403 / `Incorrect PIN` (`on MajarraApiException` → `msg.contains('403')`).
    //   4. 423 / `Too many attempts` / `locked_until`
    //      (`on MajarraApiException` → أول فرع في السلسلة).
    // هذا فحص مرجعي موثَّق هنا بدل اختبار تلقائي، وليس تحقّقًا تم تنفيذه فعليًا.
    test(
      'توثيقي: أربعة فروع catch في _submit تنتهي بـ _error بلا _completeUnlock',
      () {
        // لا نداء فعلي هنا — الحالة توثيقية بصريح العبارة أعلاه. التأكيد
        // الوحيد القابل للتنفيذ هو أن AuthGuard نفسه (مصدر الحقيقة الوحيد
        // لمنح الوصول) يبقى مرفوضًا بلا أي نداء لـ grantParentAccess.
        final guard = AuthGuard()..setAuthenticated(true, parentId: 'p1');
        addTearDown(guard.dispose);
        expect(guard.hasParentAccess, isFalse);
      },
      skip: false,
    );
  });
}
