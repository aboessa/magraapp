import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/core/failures/app_failure.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';

/// `APP-109` — مهلة لكل نوع عملية، وإعادة محاولة حيث لا بديل.
///
/// ## العلّة
///
/// `Duration(seconds: 8)` كانت المهلة الوحيدة في العميل، مطبَّقة على **ستّة عشر
/// موضعًا**: من جلب صفوف الكاتالوج إلى **تصدير بيانات الحساب كلّها** و**رفع رسمة
/// الطفل**. وثماني ثوانٍ صحيحة للأولى وخاطئة للأخيرتين — تُقطع عمليةٌ يعرف
/// المستخدم أنها تأخذ وقتًا، ويُقرأ القطع فشلًا.

Future<void> main() async {
  /// عميل يسجّل عدد المحاولات ويُجيب بما يُطلَب منه.
  ({MajarraApiClient client, List<Duration?> timeouts, int Function() calls})
  build({
    Object? throws,
    int throwTimes = 1 << 30,
    int status = 200,
    Object? body,
  }) {
    var calls = 0;
    final client = MajarraApiClient(
      MockClient((request) async {
        calls += 1;
        if (throws != null && calls <= throwTimes) throw throws;
        return http.Response.bytes(
          utf8.encode(jsonEncode({'success': true, 'data': body ?? const []})),
          status,
        );
      }),
      getAccessToken: () async => 'token',
      getParentProof: () => 'proof',
    );
    return (client: client, timeouts: <Duration?>[], calls: () => calls);
  }

  group('التراجع الأسّي مُعلَن ومقيس', () {
    test('يتضاعف مع كل محاولة، ويبدأ من ٤٠٠ مللي', () {
      // دالّة مُعلَنة لا أرقام متفرّقة: القيمة تُقرأ في مراجعة وتُقاس في اختبار.
      expect(MajarraApiClient.retryBackoff(1), const Duration(milliseconds: 400));
      expect(MajarraApiClient.retryBackoff(2), const Duration(milliseconds: 800));
      expect(MajarraApiClient.retryBackoff(3), const Duration(milliseconds: 1600));
    });
  });

  group('إعادة المحاولة على فشل النقل', () {
    test('قراءة بلا بديل تُعاد مرّة واحدة ثم تنجح', () async {
      // `fetchDevices` مُعلَنة بـ`attempts: 2`: فشلها يُنتج رسالة خطأ لوليّ أمر
      // يحاول سحب جهاز، ولا كاش يحمله.
      final harness = build(
        throws: const SocketException('offline'),
        throwTimes: 1,
      );
      final devices = await harness.client.fetchDevices();
      expect(devices, isEmpty);
      expect(harness.calls(), 2, reason: 'محاولة أولى فاشلة وثانية ناجحة');
    });

    test('الفشل المتكرّر يُرفَع بعد استنفاد المحاولات', () async {
      final harness = build(throws: const SocketException('offline'));
      await expectLater(harness.client.fetchDevices(), throwsA(isA<Object>()));
      expect(harness.calls(), 2, reason: 'محاولتان لا أكثر — لا حلقة');
    });

    test('مهلة الطلب تُعاد أيضًا، فهي فشل نقل لا رفض خادم', () async {
      final harness = build(throws: TimeoutException('slow'), throwTimes: 1);
      await harness.client.getGooglePlayBillingContext();
      expect(harness.calls(), 2);
    });
  });

  group('ما لا يُعاد', () {
    test('حالة HTTP لا تُعاد أبدًا — لا 4xx ولا 5xx', () async {
      // الطلب مرفوض، والتكرار يرفضه ثانيةً؛ وخادمٌ يترنّح تضاعف المحاولةُ حمله.
      final harness = build(status: 500);
      await expectLater(harness.client.fetchDevices(), throwsA(isA<Object>()));
      expect(harness.calls(), 1);
    });

    test('مسار الكاتالوج لا يُعاد: بديله أرخص من الانتظار', () async {
      // `ContentRepository` يقرأ الكاش ثم الحزمة عند الفشل. فإعادة محاولةٍ هنا
      // تُجلس الطفل أمام دوّارة سبع عشرة ثانية بدل رفٍّ محفوظ بعد ثمانٍ.
      final harness = build(throws: const SocketException('offline'));
      await expectLater(harness.client.fetchSeriesRows(), throwsA(isA<Object>()));
      expect(harness.calls(), 1);
    });

    test('الكتابة لا تُعاد', () async {
      // إعادة إرسال كتابةٍ قد تُنشئ طفلًا ثانيًا أو تخصم مرّتين؛ ومسارات الحذف
      // تحمل مفتاح تكرار لكنها **مدمِّرة** فلا تُعاد آليًّا بحال.
      final harness = build(throws: const SocketException('offline'));
      await expectLater(
        harness.client.updateChildSettings('child-1', {'daily_minutes': 30}),
        throwsA(isA<Object>()),
      );
      expect(harness.calls(), 1);
    });
  });

  group('الميزانيات مُصرَّحة في المصدر', () {
    final source = File(
      'lib/features/home/data/majarra_api_client.dart',
    ).readAsStringSync();

    test('مهلتان مُعلَنتان: التفاعلية والممتدّة', () {
      expect(source, contains('Duration _timeout = Duration(seconds: 8)'));
      expect(source, contains('Duration _extendedTimeout = Duration(seconds: 45)'));
    });

    test('التصدير والرفع يستخدمان الممتدّة', () {
      // الموضعان الثقيلان الوحيدان: تصدير الحساب، ورفع رسمة.
      expect(
        source.split('_extendedTimeout').length - 1,
        greaterThanOrEqualTo(3),
        reason: 'تعريفٌ واحد وموضعا استخدام على الأقل',
      );
    });

    test('لا مهلة بلا حدّ', () {
      // الحدّ الغائب يُنتج انتظارًا أبديًّا على شبكة تقبل الاتصال ولا تُجيب — وهو
      // ما كان في تحميل الترجمة قبل `APP-102`.
      final requests = RegExp(r'_client\.(get|post|put|delete)\(')
          .allMatches(source)
          .length;
      final timeouts = RegExp(r'\.timeout\(').allMatches(source).length;
      expect(
        timeouts,
        greaterThanOrEqualTo(requests),
        reason: 'كل طلب محدود بمهلة',
      );
    });
  });

  group('الرسالة تفرّق البطء عن الانقطاع', () {
    test('انقطاع الشبكة ومهلة الطلب رسالتان مختلفتان', () {
      // معيار القبول يطلب التفريق. `AppFailure` يملكه أصلًا، وهذا الاختبار يمنع
      // انهياره: لو وحّد أحدٌ الرسالتين، صار «الإنترنت مقطوع» جوابًا لشبكة بطيئة.
      final offline = AppFailure.fromException(
        const MajarraApiException('Network request failed'),
      );
      final slow = AppFailure.fromException(TimeoutException('slow'));
      expect(offline.kind, FailureKind.network);
      expect(slow.kind, FailureKind.timeout);
      expect(offline.message, isNot(slow.message));
      expect(slow.message, contains('مهلة'));
    });
  });
}
