import 'dart:convert';
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/core/diagnostics/ignored_errors.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/parent/application/child_controls_controller.dart';

/// `APP-102` — كتابة ضابطٍ رقابي لا تفشل صامتة.
///
/// ## العطل الذي تمنعه هذه الاختبارات
///
/// ستّ كتابات لضوابط وليّ الأمر (وقت الشاشة، نافذة النوم، تغيير السرعة، التشغيل
/// التلقائي) كانت مكتوبة داخل `onChanged`/`onPressed` في شجرة العناصر، **خمسٌ
/// بلا أي `catch`** والسادسة بـ`try/finally` بلا `catch`.
///
/// وأثره على وليّ الأمر: يضبط وقت الشاشة، يفشل الطلب، **ولا يُخبَره أحد**. تُعيد
/// الشاشة رسم القيمة القديمة بلا كلمة، فيخرج وهو يظنّ الحدّ ساريًا والطفل يشاهد
/// بلا حدّ. وهذا ضابط أمان لا تفضيل عرض.

/// عميل يسجّل ما طُلب، ويُجيب بما يُطلَب منه.
class _Recorder {
  final List<({String method, String path, Map<String, Object?> body})> seen = [];
  int status = 200;
  Object? throws;

  /// طلبات الكتابة وحدها. القراءات المصاحبة (إعادة جلب الإعدادات بعد الإبطال)
  /// ليست موضوع هذه الاختبارات، وتضمينها كان يجعلها تفشل لسببٍ لا تقيسه.
  List<({String method, String path, Map<String, Object?> body})> get writes =>
      seen.where((entry) => entry.method == 'PUT').toList();

  MajarraApiClient client() => MajarraApiClient(
    MockClient((request) async {
      if (throws != null) throw throws!;
      seen.add((
        method: request.method,
        path: request.url.path,
        body: request.body.isEmpty
            ? const {}
            : (jsonDecode(request.body) as Map).cast<String, Object?>(),
      ));
      return http.Response.bytes(
        utf8.encode(jsonEncode({'success': status == 200, 'data': const {}})),
        status,
      );
    }),
    getAccessToken: () async => 'token',
  );
}

ProviderContainer _container(_Recorder recorder) {
  final container = ProviderContainer(
    overrides: [majarraApiClientProvider.overrideWithValue(recorder.client())],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  setUp(resetIgnoredErrors);

  group('أسماء الحقول على السلك', () {
    // اسم الحقل كان مكتوبًا بيدٍ في ستّة مواضع. ومفتاحٌ نصّي مكرَّر لا يخطئ مرّة
    // فيُكتشف: يخطئ في موضع واحد فتبقى الخمسة شاهدةً على أنه «يعمل».
    test('كل ضبط يُرسل مفتاحه المتوقَّع وقيمته', () async {
      final recorder = _Recorder();
      final container = _container(recorder);
      final controller = container.read(
        childControlsControllerProvider('child-1').notifier,
      );

      await controller.setDailyMinutes(45);
      await controller.setBedtimeStart('21:00');
      await controller.setBedtimeEnd('07:30');
      await controller.setAllowSpeedChange(true);
      await controller.setAutoplayOverride('off');

      expect(recorder.writes.map((write) => write.body), [
        {'daily_minutes': 45},
        {'bedtime_start': '21:00'},
        {'bedtime_end': '07:30'},
        {'allow_speed_change': true},
        {'autoplay_override': 'off'},
      ]);
      // ولمعرّف الطفل موضعه في المسار، لا في الجسم.
      expect(recorder.writes.first.path, contains('child-1'));
    });

    test('إلغاء الحدّ اليومي يُرسل `null` صريحة لا حقلًا محذوفًا', () async {
      // قرار المالك (`DECIDE-108`): الضوابط يفعّلها وليّ الأمر، فلا بدّ من طريق
      // لإطفائها. و`null` هو ما يقرؤه الخادم إطفاءً — وحقلٌ **محذوف** من الجسم
      // يعني «لا تغيّر هذا الحقل» في `PUT /child-settings/:id` (`'daily_minutes'
      // in body`)، أي أن الحدّ يبقى ساريًا بلا أن يعلم أحد.
      final recorder = _Recorder();
      final container = _container(recorder);
      await container
          .read(childControlsControllerProvider('child-1').notifier)
          .clearDailyLimit();

      expect(recorder.writes, hasLength(1));
      expect(recorder.writes.single.body, {'daily_minutes': null});
      expect(recorder.writes.single.body.containsKey('daily_minutes'), isTrue);
    });

    test('مسح نافذة النوم يُرسل الطرفين في طلب واحد', () async {
      // بطلبين تبقى نافذةٌ نصفها محدَّد إن فشل الثاني — حالةٌ لم يقصدها وليّ
      // الأمر ولا يراها.
      final recorder = _Recorder();
      final container = _container(recorder);
      await container
          .read(childControlsControllerProvider('child-1').notifier)
          .clearBedtime();

      expect(recorder.writes, hasLength(1));
      expect(recorder.writes.single.body, {'bedtime_start': '', 'bedtime_end': ''});
    });
  });

  group('الفشل ظاهر', () {
    test('فشل الشبكة يضع رسالة صالحة للعرض ولا يرفع', () async {
      // الرفع من مُعالِج حدث هو ما جعل العطل صامتًا: لا أحد يلتقطه.
      final recorder = _Recorder()..throws = const SocketException('offline');
      final container = _container(recorder);
      final controller = container.read(
        childControlsControllerProvider('child-1').notifier,
      );

      await expectLater(controller.setDailyMinutes(30), completes);

      final state = container.read(childControlsControllerProvider('child-1'));
      expect(state.saving, isFalse);
      expect(state.failure, isNotNull);
      // رسالة عربية من `AppFailure`، لا نصّ استثناء.
      expect(state.failure, isNot(contains('SocketException')));
      expect(state.failure, contains('الاتصال'));
    });

    test('الفشل يُسجَّل بموضعه، فيصير معدودًا', () async {
      final recorder = _Recorder()..throws = const SocketException('offline');
      final container = _container(recorder);
      await container
          .read(childControlsControllerProvider('child-1').notifier)
          .setAllowSpeedChange(false);

      expect(ignoredErrorCounts['child_controls.allow_speed_change'], 1);
    });

    test('رفض الخادم (غير 2xx) فشلٌ لا نجاح صامت', () async {
      final recorder = _Recorder()..status = 500;
      final container = _container(recorder);
      await container
          .read(childControlsControllerProvider('child-1').notifier)
          .setDailyMinutes(30);

      expect(
        container.read(childControlsControllerProvider('child-1')).failure,
        isNotNull,
      );
    });

    test('كتابة ناجحة بعد فاشلة تمسح الرسالة', () async {
      // رسالة فشلٍ باقية بعد نجاحٍ تجعل وليّ الأمر يشكّ في ضبطٍ حُفِظ فعلًا.
      final recorder = _Recorder()..throws = const SocketException('offline');
      final container = _container(recorder);
      final controller = container.read(
        childControlsControllerProvider('child-1').notifier,
      );
      await controller.setDailyMinutes(30);
      expect(container.read(childControlsControllerProvider('child-1')).failure, isNotNull);

      recorder.throws = null;
      await controller.setDailyMinutes(35);
      expect(container.read(childControlsControllerProvider('child-1')).failure, isNull);
    });

    test('الإقرار يُخفي الرسالة', () async {
      final recorder = _Recorder()..throws = const SocketException('offline');
      final container = _container(recorder);
      final controller = container.read(
        childControlsControllerProvider('child-1').notifier,
      );
      await controller.setDailyMinutes(30);
      controller.acknowledgeFailure();
      expect(container.read(childControlsControllerProvider('child-1')).failure, isNull);
    });

    test('علَم الحفظ يعود إلى false في الحالتين', () async {
      final recorder = _Recorder();
      final container = _container(recorder);
      final controller = container.read(
        childControlsControllerProvider('child-1').notifier,
      );
      await controller.setDailyMinutes(30);
      expect(container.read(childControlsControllerProvider('child-1')).saving, isFalse);

      recorder.throws = const SocketException('offline');
      await controller.setBedtimeStart('21:00');
      expect(container.read(childControlsControllerProvider('child-1')).saving, isFalse);
    });
  });

  group('كل طفل حالته', () {
    test('فشل ضبطِ طفلٍ لا يظهر على آخر', () async {
      // الحالة كانت في العنصر، والعنصر واحد لكل طفل — فالعائلة متعدّدة الأطفال
      // كانت تشترك في علَم حفظٍ واحد.
      final recorder = _Recorder()..throws = const SocketException('offline');
      final container = _container(recorder);
      await container
          .read(childControlsControllerProvider('child-1').notifier)
          .setDailyMinutes(30);

      expect(container.read(childControlsControllerProvider('child-1')).failure, isNotNull);
      expect(container.read(childControlsControllerProvider('child-2')).failure, isNull);
    });
  });
}
