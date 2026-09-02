import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/security/device_integrity.dart';

/// `SEC-107` — الرصد يُبلّغ ولا يحجب، والغياب ليس خطرًا.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.majarra/device');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  void respond(Object? Function() handler) {
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'deviceIntegrity');
      return handler();
    });
  }

  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  test('الإشارات الصحيحة وحدها تُرفَع', () async {
    respond(() => <String, Object?>{
      'root_binaries': true,
      'emulator': false,
      'debugger': true,
    });
    expect(await const DeviceIntegrityService().signals(), {'root_binaries', 'debugger'});
  });

  test('اسم إشارة لا يعرفه الخادم يُهمَل', () async {
    // القائمة مغلقة على الطرفين: ما ليس فيها يُهمَل هناك، فإرساله ضجيج.
    respond(() => <String, Object?>{'root_binaries': true, 'moon_phase': true});
    expect(await const DeviceIntegrityService().signals(), {'root_binaries'});
  });

  test('قيمة ليست true لا تُحسَب إشارة', () async {
    // `'true'` نصًّا أو `1` رقمًا ليست رصدًا. القبول الفضفاض كان سيصنع إيجابيات
    // خاطئة من طبقة أصلية أخطأت في نوع القيمة.
    respond(() => <String, Object?>{'root_binaries': 'true', 'hooking': 1});
    expect(await const DeviceIntegrityService().signals(), isEmpty);
  });

  test('منصّة بلا تنفيذ أصلي تُنتج لا شيء لا خطرًا', () async {
    respond(() => throw MissingPluginException('no implementation'));
    expect(await const DeviceIntegrityService().signals(), isEmpty);
    expect(await const DeviceIntegrityService().reportForServer(), isNull);
  });

  test('خطأ في الطبقة الأصلية لا يُقرأ اشتباهًا', () async {
    respond(() => throw PlatformException(code: 'error'));
    expect(await const DeviceIntegrityService().signals(), isEmpty);
  });

  test('لا حقل يُرسَل حين لا شيء لتُرصد', () async {
    respond(() => <String, Object?>{'root_binaries': false, 'emulator': false});
    expect(await const DeviceIntegrityService().reportForServer(), isNull);
  });

  test('التقرير المُرسَل قيَمه true فقط', () async {
    respond(() => <String, Object?>{'jailbreak_paths': true, 'emulator': false});
    expect(await const DeviceIntegrityService().reportForServer(), {'jailbreak_paths': true});
  });

  group('الطبقة الأصلية', () {
    test('Android وiOS يعلنان نفس أسماء الإشارات التي يعرفها Dart', () {
      // انزلاق اسم واحد يجعل الإشارة تُرصد ولا تصل. والقائمة في ثلاثة ملفّات
      // بثلاث لغات، فلا مترجم يربطها — هذا الاختبار هو الرابط.
      final kotlin = File(
        'android/app/src/main/kotlin/com/majarra/majarra/MainActivity.kt',
      ).readAsStringSync();
      final swift = File('ios/Runner/AppDelegate.swift').readAsStringSync();

      expect(kotlin, contains('"deviceIntegrity" -> result.success(deviceIntegrity())'));
      expect(swift, contains('case "deviceIntegrity":'));

      for (final signal in const ['root_binaries', 'test_keys', 'emulator', 'debugger']) {
        expect(kotlin, contains('"$signal" to'), reason: 'Android يفوته $signal');
      }
      for (final signal in const ['jailbreak_paths', 'hooking', 'sandbox_escape', 'emulator']) {
        expect(swift, contains('"$signal":'), reason: 'iOS يفوته $signal');
      }
      for (final signal in DeviceIntegrityService.knownSignals) {
        expect(
          kotlin.contains('"$signal"') || swift.contains('"$signal"'),
          isTrue,
          reason: 'لا منصّة ترصد $signal',
        );
      }
    });
  });
}
