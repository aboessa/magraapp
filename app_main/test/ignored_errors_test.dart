import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/core/diagnostics/ignored_errors.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/core/failures/secure_storage_failure.dart';
import 'package:majarra/features/auth/data/auth_storage.dart';
import 'package:majarra/features/auth/data/parent_pin_store.dart';

import 'support/fake_secure_storage.dart';

/// `APP-106` — الإهمال مسموح، والإهمال الصامت ممنوع.
void main() {
  setUp(resetIgnoredErrors);

  group('قناة التسجيل', () {
    test('الخطأ المُهمَل يُسجَّل ويُعَدّ بموضعه', () {
      reportIgnoredError('area.one', Exception('first'));
      reportIgnoredError('area.one', Exception('second'));
      reportIgnoredError('area.two', Exception('third'));

      expect(ignoredErrorCounts['area.one'], 2);
      expect(ignoredErrorCounts['area.two'], 1);
      expect(ignoredErrors.first.area, 'area.two', reason: 'الأحدث أوّلًا');
      expect(ignoredErrors.length, 3);
    });

    test('السجلّ محدود فلا يتسرّب في مسار طويل العمر', () {
      // مسار بثّ يُهمل خطأً لكل قفزة مشاهدة: سجلّ بلا حدّ يعني نموًّا بلا حدّ.
      for (var index = 0; index < 100; index++) {
        reportIgnoredError('stream.close', Exception('$index'));
      }
      expect(ignoredErrors.length, 30);
      // والعدّاد لا يُقصّ: هو ما يقول «مئة مرة» لا «ثلاثون».
      expect(ignoredErrorCounts['stream.close'], 100);
    });

    test('السجلّ غير قابل للتعديل من خارجه', () {
      reportIgnoredError('area', Exception('x'));
      expect(() => ignoredErrors.clear(), throwsUnsupportedError);
      expect(() => ignoredErrorCounts.clear(), throwsUnsupportedError);
    });
  });

  group('مخزن التوكنات', () {
    test('فشل الكتابة يُرفَع بنوعه لا يُكتَم', () async {
      // كان مكتومًا، ومعناه أن الجلسة لا تنجو من إغلاق التطبيق: دخول ناجح ظاهرًا
      // ثم خروج بلا سبب معلَن عند الإقلاع التالي.
      final storage = AuthStorage(storage: FakeSecureStorage(failWrites: true));
      await expectLater(
        storage.save(
          accessToken: 'access',
          refreshToken: 'refresh',
          parentId: 'parent-1',
        ),
        throwsA(isA<SecureStorageUnavailableException>()),
      );
    });

    test('فشل القراءة يُسجَّل ويُعلَن، ولا يُقرأ «لا جلسة»', () async {
      final storage = AuthStorage(storage: FakeSecureStorage(failReads: true));
      expect(await storage.getAccessToken(), isNull);
      expect(storage.keystoreUnavailable, isTrue);
      expect(ignoredErrorCounts['auth_storage.read'], greaterThan(0));
    });

    test('مخزن سليم لا يُعلن عطلًا', () async {
      final storage = AuthStorage(storage: FakeSecureStorage());
      await storage.save(
        accessToken: 'access',
        refreshToken: 'refresh',
        parentId: 'parent-1',
      );
      expect(await storage.getAccessToken(), 'access');
      expect(storage.keystoreUnavailable, isFalse);
      expect(ignoredErrors, isEmpty);
    });
  });

  group('مخزن رمز وليّ الأمر', () {
    test('فشل كتابة الرمز يُرفَع', () async {
      // رمز يظنّ وليّ الأمر أنه سُجِّل ولم يُسجَّل، أو قفلٌ بعد محاولات خاطئة لا
      // يُطبَّق — أي إبطال حاجز أمني بصمت.
      final store = ParentPinStore(storage: FakeSecureStorage(failWrites: true));
      await expectLater(
        store.setPin('4271', ownerId: 'parent-1'),
        throwsA(isA<SecureStorageUnavailableException>()),
      );
    });

    test('فشل القراءة يُعلَن بدل أن يُقرأ «لا رمز»', () async {
      final store = ParentPinStore(storage: FakeSecureStorage(failReads: true));
      expect(await store.hasPin(), isFalse);
      expect(store.keystoreUnavailable, isTrue);
      expect(ignoredErrorCounts['parent_pin_store.read'], greaterThan(0));
    });
  });

  group('رفّ الكتب', () {
    MajarraApiClient clientReturning(int status, String body) => MajarraApiClient(
      MockClient((_) async => http.Response(
        body,
        status,
        headers: {'content-type': 'application/json'},
      )),
    );

    test('فشل الجلب يُرفَع ولا يُقرأ «لا كتب»', () async {
      // معيار القبول الثاني. الكتمان لم يحمِ الشاشة بل حوّل انقطاعًا مؤقّتًا في
      // الخادم إلى **حذف دائم** لمكتبة الأسرة من الكاش: المستودع يعدّ الردّ
      // الفارغ الناجح حقيقةً فيخزّنه ويعلن المجموعة متاحة.
      await expectLater(
        clientReturning(503, '{"success":false}').fetchBookRows(),
        throwsA(isA<MajarraApiException>()),
      );
    });

    test('مكتبة فارغة فعلًا تبقى فارغة بلا خطأ', () async {
      // التفريق يعمل في الاتجاهين: «صفر كتاب» جوابٌ صحيح لا عطل.
      expect(
        await clientReturning(200, '{"success":true,"data":[]}').fetchBookRows(),
        isEmpty,
      );
    });
  });

  group('الحرس', () {
    /// المسارات المحروسة.
    ///
    /// معيار القبول يشترط `core/` و`features/*/data/`. وأُضيفت `application/`
    /// لأنها موضع العطل الذي فتح هذا البند: منطق التنزيل والتشغيل يعيش هناك.
    ///
    /// و`presentation/` **خارج الحرس اليوم** بقرار: تسعٌ وأربعون كتلة فيها
    /// (ثلاثة عشر في `playback_page.dart` وحده)، وتحويلها دفعةً واحدة تغييرٌ
    /// واسع في ملفّات آلهة بلا اختبار (`APP-101`) — أي مقايضة عطلٍ صامت بعطلٍ
    /// صريح. تُحوَّل مع تفكيك تلك الملفّات.
    const guarded = ['lib/core', 'lib/features'];

    test('لا كتلة إهمال صامتة في core وطبقات data', () {
      // معيار القبول الأول. الكتلة الفارغة تمامًا ممنوعة؛ والمسموح إمّا التقاط
      // يمرّ بـ`reportIgnoredError` أو كتلة تحمل **تعليقًا** يشرح لماذا الإهمال
      // صحيح هنا. أي: الإهمال يحتاج تبريرًا مكتوبًا.
      final offenders = <String>[];
      for (final root in guarded) {
        final directory = Directory(root);
        if (!directory.existsSync()) continue;
        for (final entity in directory.listSync(recursive: true)) {
          if (entity is! File || !entity.path.endsWith('.dart')) continue;
          final normalized = entity.path.replaceAll(r'\', '/');
          final inScope = normalized.startsWith('lib/core/') ||
              normalized.contains('/data/') ||
              normalized.contains('/application/');
          if (!inScope) continue;

          final source = entity.readAsStringSync();
          // الكتلة مُخالِفة إن كان جوفها **فارغًا تمامًا**. والتعليق جوفٌ: هو
          // التبرير المكتوب الذي يطلبه المعيار.
          final matches = RegExp(r'catch\s*\(_\)\s*\{([^}]*)\}').allMatches(source);
          for (final match in matches) {
            if (match.group(1)!.trim().isNotEmpty) continue;
            final before = source.substring(0, match.start).split('\n');
            // ذِكرٌ للنمط داخل توثيق (هذا الملف يشرحه في تعليقه) ليس كتلة كود.
            if (before.last.trimLeft().startsWith('//')) continue;
            offenders.add('$normalized:${before.length}');
          }
        }
      }
      expect(
        offenders,
        isEmpty,
        reason: 'كتل إهمال صامتة: ${offenders.join(', ')}',
      );
    });
  });
}
