import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/security/screen_capture_guard.dart';

/// ENC-014 — حماية العرض على منصّات Apple.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// `FLAG_SECURE` كان مطبَّقًا على Android وحده، ولا رصد لتسجيل الشاشة أو المرآة
/// على منصّات Apple كما تطلب §24 — ولا ملف iOS في الشجرة أصلًا.
///
/// ## ما لا تثبّته
///
/// أن تسجيل الشاشة على جهاز حقيقي يُرصَد. ذلك يحتاج جهازًا وتسجيلًا فعليًّا، وهو
/// معيار قبول صريح في البند («مُتحقَّق منه على جهاز حقيقي لكل منصّة، بدليل
/// مرفق») ويبقى مفتوحًا. المُثبَّت هنا: عقد القناة، والسلوك الآمن عند غيابها،
/// وأن كل منصّة تُعامَل بما تسمح به.

void main() {
  // القنوات المزيَّفة تحتاج ربطًا مُهيَّأً قبل أي `defaultBinaryMessenger`.
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.majarra/device');
  final calls = <MethodCall>[];

  setUp(() {
    calls.clear();
    debugDefaultTargetPlatformOverride = null;
  });

  tearDown(() {
    debugDefaultTargetPlatformOverride = null;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  void mock(Future<Object?>? Function(MethodCall call) handler) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) {
          calls.add(call);
          return handler(call);
        });
  }

  group('قدرات المنصّات', () {
    test('المنع علامة نافذة على Android وحده', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(ScreenCaptureGuard.supportsSecureWindow, isTrue);
      expect(ScreenCaptureGuard.supportsCaptureDetection, isFalse);

      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      // لا نافذة آمنة على iOS: ادّعاء غير ذلك يجعل طبقة أعلى تظنّ المحتوى
      // محميًّا وهو معروض.
      expect(ScreenCaptureGuard.supportsSecureWindow, isFalse);
      expect(ScreenCaptureGuard.supportsCaptureDetection, isTrue);
    });

    test('الحاسب واللينكس لا يدّعيان أيّهما', () {
      debugDefaultTargetPlatformOverride = TargetPlatform.linux;
      expect(ScreenCaptureGuard.supportsSecureWindow, isFalse);
      expect(ScreenCaptureGuard.supportsCaptureDetection, isFalse);
    });
  });

  group('علامة النافذة الآمنة', () {
    test('تُرسَل على Android بالقيمة المطلوبة', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      mock((_) async => null);

      await const ScreenCaptureGuard().enable();
      await const ScreenCaptureGuard().disable();

      expect(calls.map((call) => call.method), ['setSecureFlag', 'setSecureFlag']);
      expect(calls.first.arguments, {'enabled': true});
      expect(calls.last.arguments, {'enabled': false});
    });

    test('لا تُرسَل على iOS', () async {
      // إرسالها هناك يعني ردًّا بـ`notImplemented` في كل مرة، وضجيجًا في السجل
      // على مسار التشغيل الساخن.
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      mock((_) async => null);
      await const ScreenCaptureGuard().enable();
      expect(calls, isEmpty);
    });
  });

  group('الرصد', () {
    test('يقرأ الحالة من الطبقة الأصلية على iOS', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      mock((call) async => call.method == 'isCaptured' ? true : null);

      expect(await const ScreenCaptureGuard().isCaptured(), isTrue);
      expect(calls.single.method, 'isCaptured');
    });

    test('غياب القناة يُقرأ «غير مسجَّل» لا يمنع التشغيل', () async {
      // الرصد إجراء تخفيف. تحويل فشله إلى منع يعاقب طفلًا على عيب في بناء
      // المضيف: بناء أقدم لا يعرف الطريقة يصير جهازًا لا يشغّل شيئًا.
      debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
      mock((_) => throw MissingPluginException('no handler'));
      expect(await const ScreenCaptureGuard().isCaptured(), isFalse);

      mock((_) => throw PlatformException(code: 'boom'));
      expect(await const ScreenCaptureGuard().isCaptured(), isFalse);
    });

    test('على Android لا يُستدعى الرصد أصلًا', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      mock((_) async => true);
      expect(await const ScreenCaptureGuard().isCaptured(), isFalse);
      expect(calls, isEmpty);
    });

    test('تدفّق التغيّرات فارغ حيث لا رصد ممكن', () async {
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      expect(await const ScreenCaptureGuard().captureChanges().toList(), isEmpty);
    });
  });

  group('الطبقة الأصلية على iOS', () {
    // لا سبيل لتشغيل Swift من اختبار Dart، فالمُثبَّت هو عقد الطرفين: كل طريقة
    // تستدعيها طبقة Dart لها معالج، وأن `setSecureFlag` يردّ «غير منفَّذ» بدل
    // نجاح كاذب.
    final delegate = const LocalFileSystemSource().read('ios/Runner/AppDelegate.swift');

    test('القناتان مسجَّلتان بنفس أسماء Android', () {
      expect(delegate, contains('"com.majarra/device"'));
      expect(delegate, contains('"com.majarra/device/capture"'));
    });

    test('كل طريقة تستدعيها Dart لها معالج', () {
      for (final method in ['isTelevision', 'isCaptured', 'setSecureFlag']) {
        expect(delegate, contains('case "$method"'), reason: '$method بلا معالج');
      }
    });

    test('setSecureFlag يردّ «غير منفَّذ» لا نجاحًا كاذبًا', () {
      final index = delegate.indexOf('case "setSecureFlag"');
      expect(index, greaterThan(0));
      expect(
        delegate.substring(index, index + 220),
        contains('FlutterMethodNotImplemented'),
      );
    });

    test('الرصد يشمل المرآة السلكية لا التسجيل وحده', () {
      expect(delegate, contains('UIScreen.main.isCaptured'));
      expect(delegate, contains('UIScreen.screens.count > 1'));
    });

    test('الحالة الأولى تُرسَل عند الاشتراك', () {
      // الاشتراك قد يبدأ بعد أن صار التسجيل جاريًا؛ انتظار تغيّر تالٍ كان
      // سيترك المحتوى معروضًا بلا حدّ.
      final index = delegate.indexOf('func startObserving');
      expect(index, greaterThan(0));
      expect(delegate.substring(index), contains('sink(isCaptured())'));
    });

    test('المراقبون يُزالون عند إلغاء التدفّق', () {
      expect(delegate, contains('func stopObserving'));
      expect(delegate, contains('removeObserver'));
      expect(delegate, contains('func onCancel'));
    });
  });
}

/// قارئ ملفات بسيط، معزول حتى يبقى سبب الفشل واضحًا لو غاب الملف.
class LocalFileSystemSource {
  const LocalFileSystemSource();

  String read(String path) {
    final file = File(path);
    if (!file.existsSync()) {
      throw StateError('الملف غير موجود: $path — تحقّق من جذر تشغيل الاختبار');
    }
    return file.readAsStringSync();
  }
}
