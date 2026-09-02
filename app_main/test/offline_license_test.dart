import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/licensing/license_guard.dart';
import 'package:majarra/core/licensing/offline_license.dart';

import 'support/fake_secure_storage.dart';

/// ENC-005 — تحقّق العميل من الترخيص الموقَّع.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// لم يكن هناك ترخيص إطلاقًا. المدّة ثابتة في الكود، وتاريخ الانتهاء يُحسب على
/// الجهاز، ويُخزَّن في `shared_preferences` (ملف XML/plist عادي)، ويُقارن
/// بـ`DateTime.now()`. فثلاث طرق لتمديد الصلاحية بلا مقابل: تأخير الساعة، وتحرير
/// الملف، واستعادة نسخة أقدم منه.
///
/// الاختبارات توقّع تراخيص حقيقية بمفتاح Ed25519 مولَّد في الاختبار، وتتحقّق
/// بالمسار نفسه الذي يستعمله التطبيق — لا محاكاة للتوقيع.

late SimpleKeyPair keyPair;
late String publicKeyBase64;
const keyId = 'majarra-offline-test';

Map<String, Object?> claims({
  int? issuedAtSeconds,
  int? expiresAtSeconds,
  String childId = 'child-1',
  String deviceId = 'device-1',
  String entityId = 'ep-1',
  int epoch = 1,
}) => {
  'typ': 'offline_license',
  'lic': 'lic-1',
  'sub': 'parent-1',
  'cid': childId,
  'did': deviceId,
  'epoch': epoch,
  'entity_type': 'episode',
  'entity_id': entityId,
  'ver': 1,
  'rights': 'offline_playback',
  'plan': 'family',
  'assets': [{'id': 'asset-1', 'sha256': 'aa', 'bytes': 10}],
  'iat': issuedAtSeconds ?? DateTime.now().millisecondsSinceEpoch ~/ 1000,
  'exp': expiresAtSeconds
      ?? DateTime.now().add(const Duration(days: 30)).millisecondsSinceEpoch ~/ 1000,
  'kid': keyId,
};

/// نفس ترميز الخادم: base64url بلا حشو.
String encodeUrlSafe(List<int> value) =>
    base64Encode(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');

Future<String> sign(Map<String, Object?> payload) async {
  final bytes = utf8.encode(jsonEncode(payload));
  final signature = await Ed25519().sign(bytes, keyPair: keyPair);
  return '${encodeUrlSafe(bytes)}.${encodeUrlSafe(signature.bytes)}';
}

OfflineLicenseVerifier verifier() =>
    OfflineLicenseVerifier({keyId: publicKeyBase64});

void main() {
  setUpAll(() async {
    keyPair = await Ed25519().newKeyPair();
    final publicKey = await keyPair.extractPublicKey();
    publicKeyBase64 = base64Encode(publicKey.bytes);
  });

  group('التحقّق من التوقيع', () {
    test('ترخيص صحيح يُقبل وتُقرأ حقوله', () async {
      final token = await sign(claims());
      final parsed = await verifier().verify(token);
      assert(parsed.licenseId == 'lic-1');
      expect(parsed.childId, 'child-1');
      expect(parsed.deviceId, 'device-1');
      expect(parsed.keyId, keyId);
      expect(parsed.assets.single.sha256, 'aa');
      // الثواني من الخادم تُقرأ بالمللي ثانية في التطبيق.
      expect(parsed.expiresAtMs % 1000, 0);
    });

    test('تحرير حقل واحد يُفشل التوقيع — وهذا كل ما يحمي من تمديد المدة', () async {
      final token = await sign(claims());
      final parts = token.split('.');
      final payload = jsonDecode(utf8.decode(
        base64Decode(parts[0].padRight((parts[0].length + 3) & ~3, '=')
            .replaceAll('-', '+').replaceAll('_', '/')),
      )) as Map<String, Object?>;
      // تمديد الانتهاء ستين يومًا: بلا توقيع كان هذا كل ما يحتاجه من يريد ترخيصًا أبديًّا.
      payload['exp'] = (payload['exp']! as int) + 60 * 86400;
      final forged = '${encodeUrlSafe(utf8.encode(jsonEncode(payload)))}.${parts[1]}';

      await expectLater(
        verifier().verify(forged),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.badSignature,
        )),
      );
    });

    test('مفتاح آخر يُفشل التحقّق', () async {
      final token = await sign(claims());
      final other = await Ed25519().newKeyPair();
      final otherPublic = await other.extractPublicKey();
      final foreign = OfflineLicenseVerifier({keyId: base64Encode(otherPublic.bytes)});
      await expectLater(
        foreign.verify(token),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.badSignature,
        )),
      );
    });

    test('معرّف مفتاح مجهول يُميَّز عن فشل توقيع', () async {
      // إجراؤه تحديث تطبيق لا إعادة تنزيل، فالتمييز ليس تجميليًّا.
      final token = await sign(claims());
      final rotated = OfflineLicenseVerifier({'other-kid': publicKeyBase64});
      await expectLater(
        rotated.verify(token),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.unknownKey,
        )),
      );
    });

    test('بلا مفاتيح يُرفض ولا يُتجاوَز التحقّق', () async {
      // القبول لغياب الإعداد يُعيد الجهاز سلطةً على صلاحيته الخاصة.
      final token = await sign(claims());
      await expectLater(
        OfflineLicenseVerifier(const {}).verify(token),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.notConfigured,
        )),
      );
    });

    test('شكل غير صالح يُرفض بلا استثناء غير متوقَّع', () async {
      for (final bad in ['', 'no-dot', 'a.b.c', 'not-base64!.@@@']) {
        await expectLater(verifier().verify(bad), throwsA(isA<LicenseException>()));
      }
    });

    test('SPKI كامل يُقبل كما يطبعه سكربت العمليات', () async {
      // ترويسة 12 بايتًا ثم 32 بايت المفتاح. قبول الصيغتين يمنع مفتاحًا مقطوعًا
      // بتحويل يدوي.
      final publicKey = await keyPair.extractPublicKey();
      final spki = Uint8List.fromList([
        0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
        ...publicKey.bytes,
      ]);
      final withSpki = OfflineLicenseVerifier({keyId: base64Encode(spki)});
      final token = await sign(claims());
      expect((await withSpki.verify(token)).licenseId, 'lic-1');
    });
  });

  group('الوقت الموثوق', () {
    LicenseGuard guard({DateTime Function()? clock, FakeSecureStorage? storage}) => LicenseGuard(
      storage: storage ?? FakeSecureStorage(),
      verifier: verifier(),
      clock: clock ?? DateTime.now,
    );

    test('تأخير ساعة الجهاز لا يُعيد الزمن إلى الوراء', () async {
      // معيار القبول: «تأخير ساعة الجهاز 60 يومًا لا يُعيد تشغيل محتوى انتهى».
      final subject = guard(clock: () => DateTime(2026, 1, 1));
      await subject.recordTrustedTime(DateTime(2026, 3, 1));
      // الجهاز يقول يناير والعلامة الموثوقة تقول مارس: يُؤخَذ بالأكبر.
      expect(subject.trustedNow().isAfter(DateTime(2026, 2, 28)), isTrue);
    });

    test('تقديم الساعة يُعجّل الانتهاء ولا يُؤخّره', () async {
      // الاتجاه الآخر غير مضرّ: من يقدّم ساعته يخسر صلاحيته أسرع.
      final subject = guard(clock: () => DateTime(2027, 1, 1));
      await subject.recordTrustedTime(DateTime(2026, 3, 1));
      expect(subject.trustedNow().year, 2027);
    });

    test('العلامة الموثوقة تُرفَع إلى الأمام فقط', () async {
      final storage = FakeSecureStorage();
      final subject = guard(clock: () => DateTime(2026, 1, 1), storage: storage);
      await subject.recordTrustedTime(DateTime(2026, 6, 1));
      // ردّ قديم وصل متأخّرًا لا يجوز أن يُرخي ما ثبت.
      await subject.recordTrustedTime(DateTime(2026, 2, 1));
      expect(subject.trustedNow().isAfter(DateTime(2026, 5, 30)), isTrue);
    });

    test('العلامة تصمد بعد إعادة تشغيل التطبيق', () async {
      final storage = FakeSecureStorage();
      final first = guard(clock: () => DateTime(2026, 1, 1), storage: storage);
      await first.recordTrustedTime(DateTime(2026, 6, 1));

      final second = guard(clock: () => DateTime(2026, 1, 1), storage: storage);
      await second.restoreTrustedTime();
      expect(second.trustedNow().isAfter(DateTime(2026, 5, 30)), isTrue);
    });
  });

  group('البوابة', () {
    Future<LicenseGuard> guardWith(String token, {
      FakeSecureStorage? storage,
      DateTime Function()? clock,
    }) async {
      final subject = LicenseGuard(
        storage: storage ?? FakeSecureStorage(),
        verifier: verifier(),
        clock: clock ?? DateTime.now,
      );
      await subject.store('dl-1', token);
      return subject;
    }

    test('ترخيص صالح يسمح بالتشغيل', () async {
      final subject = await guardWith(await sign(claims()));
      final authorized = await subject.authorize(
        'dl-1',
        expectedEntityType: 'episode',
        expectedEntityId: 'ep-1',
        expectedChildId: 'child-1',
        expectedDeviceId: 'device-1',
        expectedAuthEpoch: 1,
      );
      expect(authorized.licenseId, 'lic-1');
    });

    test('ترخيص طفل آخر أو جهاز آخر يُرفض', () async {
      final subject = await guardWith(await sign(claims()));
      for (final mismatch in [
        () => subject.authorize('dl-1', expectedEntityType: 'episode',
            expectedEntityId: 'ep-1', expectedChildId: 'child-2'),
        () => subject.authorize('dl-1', expectedEntityType: 'episode',
            expectedEntityId: 'ep-1', expectedDeviceId: 'device-2'),
        () => subject.authorize('dl-1', expectedEntityType: 'episode',
            expectedEntityId: 'ep-other'),
      ]) {
        await expectLater(
          mismatch(),
          throwsA(isA<LicenseException>().having(
            (error) => error.rejection, 'rejection', LicenseRejection.contextMismatch,
          )),
        );
      }
    });

    test('عهد مصادقة أقدم يُرفض — إبطال الجهاز يصل إلى الملف', () async {
      // ENC-010: أي إبطال جهاز يرفع العهد في الأسرة، فيصير كل ترخيص أقدم مرفوضًا
      // بلا حاجة إلى قائمة إبطال على الجهاز.
      final subject = await guardWith(await sign(claims(epoch: 1)));
      await expectLater(
        subject.authorize('dl-1', expectedEntityType: 'episode',
            expectedEntityId: 'ep-1', expectedAuthEpoch: 2),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.contextMismatch,
        )),
      );
    });

    test('ترخيص منتهٍ يُرفض حتى لو تأخّرت ساعة الجهاز', () async {
      final issued = DateTime(2026, 1, 1);
      final expired = claims(
        issuedAtSeconds: issued.millisecondsSinceEpoch ~/ 1000,
        expiresAtSeconds: issued.add(const Duration(days: 30)).millisecondsSinceEpoch ~/ 1000,
      );
      final storage = FakeSecureStorage();
      final subject = LicenseGuard(
        storage: storage,
        verifier: verifier(),
        // الجهاز يقول إن الزمن ما زال قبل الانتهاء…
        clock: () => DateTime(2026, 1, 5),
      );
      await subject.store('dl-1', await sign(expired));
      // …ولكن علامة موثوقة لاحقة تقول غير ذلك.
      await subject.recordTrustedTime(DateTime(2026, 3, 1));
      await expectLater(
        subject.authorize('dl-1', expectedEntityType: 'episode', expectedEntityId: 'ep-1'),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.expired,
        )),
      );
    });

    test('استعادة حالة أقدم تُرفض', () async {
      // معيار القبول: «استعادة نسخة أقدم من حالة الترخيص تُرفض».
      final storage = FakeSecureStorage();
      final subject = LicenseGuard(storage: storage, verifier: verifier());
      final token = await sign(claims());
      await subject.store('dl-1', token);
      final snapshot = storage.values['majarra_offline_license_dl-1']!;

      // كتابة تالية ترفع العدّاد…
      await subject.store('dl-2', token);
      // …ثم يُستعاد الملف القديم لعنصر الأول.
      storage.values['majarra_offline_license_dl-1'] = snapshot;

      await expectLater(
        subject.authorize('dl-1', expectedEntityType: 'episode', expectedEntityId: 'ep-1'),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.contextMismatch,
        )),
      );
    });

    test('مضيّ نافذة إعادة التحقّق يوقف التشغيل ولو كان الترخيص صالحًا', () async {
      // ENC-010: جهاز مسروق كان يواصل التشغيل ثلاثين يومًا كاملة بلا اتصال
      // واحد. النافذة سبعة أيام داخل مدّة الترخيص، فهي تشدّد ولا تُرخي.
      final issued = DateTime(2026, 1, 1);
      final storage = FakeSecureStorage();
      final subject = LicenseGuard(
        storage: storage,
        verifier: verifier(),
        clock: () => issued.add(const Duration(days: 10)),
      );
      await subject.store('dl-1', await sign(claims(
        issuedAtSeconds: issued.millisecondsSinceEpoch ~/ 1000,
        expiresAtSeconds: issued.add(const Duration(days: 30)).millisecondsSinceEpoch ~/ 1000,
      )));

      await expectLater(
        subject.authorize('dl-1', expectedEntityType: 'episode', expectedEntityId: 'ep-1'),
        throwsA(isA<LicenseException>().having(
          (error) => error.rejection, 'rejection', LicenseRejection.staleVerification,
        )),
      );

      // واتصال واحد يُصفّر النافذة — إجراؤه ليس إعادة تنزيل ولا تحديثًا.
      await subject.recordVerification(issued.add(const Duration(days: 9)));
      expect(
        (await subject.authorize('dl-1',
            expectedEntityType: 'episode', expectedEntityId: 'ep-1')).licenseId,
        'lic-1',
      );
    });

    test('نسيان الترخيص محليًّا يمنع التشغيل ولا يلمس الملف', () async {
      // المصالحة تُنسي ترخيصًا أُبطل خادميًّا. الحذف ليس عقوبة: إبطال خطأ
      // يُصحَّح بترخيص جديد، وحذف المحتوى يُهدر بيانات الأسرة.
      final subject = await guardWith(await sign(claims()));
      expect(await subject.licenceIdFor('dl-1'), 'lic-1');
      await subject.revokeLocally('dl-1');
      expect(await subject.licenceIdFor('dl-1'), isNull);
      await expectLater(
        subject.authorize('dl-1', expectedEntityType: 'episode', expectedEntityId: 'ep-1'),
        throwsA(isA<LicenseException>()),
      );
    });

    test('غياب الترخيص يمنع التشغيل', () async {
      final subject = LicenseGuard(storage: FakeSecureStorage(), verifier: verifier());
      await expectLater(
        subject.authorize('unknown', expectedEntityType: 'episode', expectedEntityId: 'ep-1'),
        throwsA(isA<LicenseException>()),
      );
    });

    test('نسيان الترخيص يمنع التشغيل بعده', () async {
      final subject = await guardWith(await sign(claims()));
      await subject.forget('dl-1');
      await expectLater(
        subject.authorize('dl-1', expectedEntityType: 'episode', expectedEntityId: 'ep-1'),
        throwsA(isA<LicenseException>()),
      );
    });

    test('الرسائل تشرح الإجراء ولا تذكر توقيعًا ولا مفتاحًا', () {
      for (final rejection in LicenseRejection.values) {
        final message = LicenseException(rejection).message;
        expect(message.isNotEmpty, isTrue);
        for (final leak in ['توقيع', 'مفتاح', 'Ed25519', 'signature']) {
          expect(message.contains(leak), isFalse, reason: '${rejection.name}: $message');
        }
      }
    });
  });
}
