import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/network/pinned_certificates.dart';
import 'package:majarra/core/network/secure_http_client.dart';

/// SEC-105 — تثبيت الشهادات.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// لم يكن في `lib/` أي `SecurityContext` ولا `HttpClient` مخصص: كل اتصال يثق
/// بمخزن شهادات الجهاز. على جهاز فيه جذر مزروع — أداة تحليل، وكيل مؤسسي — تُقرأ
/// كل الطلبات، ولا يظهر خطأ لأن الشهادة **صالحة** في نظر النظام.
///
/// ما لا يمكن لهذه الاختبارات إثباته: أن اعتراضًا حقيقيًّا يفشل. ذلك يحتاج
/// اتصالًا فعليًّا عبر وكيل بجذر مزروع، وهو فحص يدوي مُوثَّق في §15 من الأودت.
/// ما تثبّته هنا هو كل ما يمكن التحقّق منه بلا شبكة: أن الحزمة صحيحة ومطابقة
/// للبصمات المسجَّلة، وأن BoringSSL يقبلها، وأن الثقة **لا** تشمل مخزن النظام،
/// وأن الفشل مغلق ومترجَم إلى خطأ مفهوم.

/// يفصل حزمة PEM إلى شهاداتها.
List<String> _pemBlocks(String bundle) {
  final matches = RegExp(
    r'-----BEGIN CERTIFICATE-----([A-Za-z0-9+/=\s]+?)-----END CERTIFICATE-----',
  ).allMatches(bundle);
  return matches.map((match) => match.group(1)!.replaceAll(RegExp(r'\s'), '')).toList();
}

void main() {
  group('حزمة الجذور المثبَّتة', () {
    test('كل شهادة تطابق بصمتها المسجَّلة، بالعدد والترتيب', () {
      // الغرض: منع تعديل الحزمة بلا مراجعة. استبدال شهادة بأخرى — أو إضافة
      // جذر «مؤقّت» لتشخيص مشكلة — يجعل التثبيت بلا معنى، وهذا ما يمنعه.
      final blocks = _pemBlocks(pinnedRootsPem);
      expect(blocks, hasLength(pinnedRootFingerprints.length));

      for (var index = 0; index < blocks.length; index += 1) {
        final der = base64.decode(blocks[index]);
        final fingerprint = sha256.convert(der).toString();
        expect(
          fingerprint,
          pinnedRootFingerprints[index],
          reason: 'الشهادة رقم $index لا تطابق البصمة المسجَّلة لها',
        );
      }
    });

    test('BoringSSL يقبل الحزمة كما هي', () {
      // فحص حقيقي لا شكلي: `setTrustedCertificatesBytes` يفشل على PEM غير صالح
      // أو شهادة تالفة. بلا هذا الاختبار قد تُشحَن حزمة تُرمى وقت التشغيل،
      // فينكسر كل اتصال في أول إطلاق.
      expect(buildPinnedSecurityContext, returnsNormally);
    });

    test('الحزمة لا تحوي مفتاحًا خاصًّا', () {
      // زلّة نسخ واحدة من مخرجات openssl تكفي.
      expect(pinnedRootsPem, isNot(contains('PRIVATE KEY')));
    });

    test('فرض التثبيت ينتهي قبل انتهاء أقرب جذر مثبَّت', () {
      // لو تجاوز تاريخ الفرض عمر الجذور لصار التثبيت ساريًا على جذر منتهٍ:
      // فشل مؤكَّد لكل نسخة منشورة، وهو أسوأ نتيجة ممكنة للبند.
      expect(pinningEnforcedUntil.isBefore(earliestPinnedRootExpiry), isTrue);
    });
  });

  group('نافذة الفرض', () {
    test('يُفرض قبل التاريخ ويسقط بعده', () {
      expect(
        isPinningEnforced(pinningEnforcedUntil.subtract(const Duration(days: 1))),
        isTrue,
      );
      // السقوط مقصود: بناء متقادم يعود إلى ثقة النظام بدل أن يبقى معطَّلًا
      // إلى الأبد، لأن قناة إصلاح التثبيت هي نفس القناة التي يعطّلها.
      expect(
        isPinningEnforced(pinningEnforcedUntil.add(const Duration(days: 1))),
        isFalse,
      );
    });

    test('الحساب بتوقيت UTC لا بتوقيت الجهاز', () {
      // ساعة جهاز مضبوطة على منطقة أخرى لا يجوز أن تُقدّم أو تؤجّل الفرض.
      final justBefore = pinningEnforcedUntil.subtract(const Duration(hours: 1));
      expect(isPinningEnforced(justBefore.toLocal()), isTrue);
    });
  });

  group('أين يُثبَّت', () {
    test('يُثبَّت على كل https، حتى في بناء التطوير', () {
      expect(shouldPin(Uri.parse('https://api.majarra.app')), isTrue);
      expect(shouldPin(Uri.parse('https://cdn.majarra.app')), isTrue);
    });

    test('لا يُثبَّت على loopback بلا TLS', () {
      // عامل محلي على http لا سلسلة شهادات له. استثناؤه هو ما يجعل التثبيت
      // قابلًا للتشغيل في التطوير بدل أن يُطفأ كليًّا.
      expect(shouldPin(Uri.parse('http://127.0.0.1:8787')), isFalse);
      expect(shouldPin(Uri.parse('http://10.0.2.2:8787')), isFalse);
    });
  });

  group('العميل', () {
    test('العميل المثبَّت يُغلَّف ليترجم فشل التحقّق', () {
      final client = createAppHttpClient(
        baseUrl: 'https://api.majarra.app',
        now: pinningEnforcedUntil.subtract(const Duration(days: 1)),
      );
      addTearDown(client.close);
      // النوع الملفوف هو ما يحوّل استثناء BoringSSL الخام إلى خطأ مفهوم؛
      // `IOClient` مجرّدًا كان سيمرّره كما هو.
      expect(client.runtimeType.toString(), '_TlsAwareClient');
    });

    test('بعد انتهاء الفرض يعود عميلًا عاديًا', () {
      final client = createAppHttpClient(
        baseUrl: 'https://api.majarra.app',
        now: pinningEnforcedUntil.add(const Duration(days: 1)),
      );
      addTearDown(client.close);
      expect(client.runtimeType.toString(), isNot('_TlsAwareClient'));
    });

    test('رسالة فشل التحقّق تصلح للعرض ولا تحوي مصطلحًا تقنيًّا', () {
      const failure = TlsVerificationException('api.majarra.app', 'CERTIFICATE_VERIFY_FAILED');
      expect(failure.message, contains('api.majarra.app'));
      expect(failure.message, isNot(contains('CERTIFICATE_VERIFY_FAILED')));
      // النوع مستقل عن انقطاع الشبكة: إعادة المحاولة الصامتة على اتصال
      // معترَض هي بالضبط ما يجب ألّا يحدث.
      expect(failure, isNot(isA<SocketException>()));
      // والتفصيل التقني يبقى متاحًا للسجل لا للعرض.
      expect(failure.toString(), contains('CERTIFICATE_VERIFY_FAILED'));
    });
  });

  group('الثقة لا تشمل مخزن النظام', () {
    // هاتان الخاصيتان لا تُلاحظان من الخارج بلا اتصال شبكي حقيقي عبر وكيل
    // اعتراض، وكل منهما يُبطِل البند بكلمة واحدة: `withTrustedRoots: true`
    // يعيد الثقة بالجذور المزروعة، و`return true` في `badCertificateCallback`
    // يقبل أي شهادة. فحص المصدر هنا حرس على انحدار صامت، لا بديل عن الفحص
    // اليدوي المُوثَّق في §15.
    final source = File('lib/core/network/secure_http_client.dart').readAsStringSync();

    test('السياق يُبنى بلا جذور النظام', () {
      expect(source, contains('SecurityContext(withTrustedRoots: false)'));
      expect(source, isNot(contains('withTrustedRoots: true')));
    });

    test('الفشل مغلق: لا مسار يقبل شهادة غير متحقَّق منها', () {
      final callbackIndex = source.indexOf('badCertificateCallback =');
      expect(callbackIndex, greaterThan(0));
      final body = source.substring(callbackIndex, callbackIndex + 400);
      expect(body, contains('return false;'));
      expect(body, isNot(contains('return true;')));
    });
  });
}
