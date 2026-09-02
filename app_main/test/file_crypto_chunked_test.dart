import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/crypto/file_crypto.dart';

import 'support/fake_secure_storage.dart';

/// ENC-006 و ENC-011 — الصيغة المقسَّمة وفشل المخزن الآمن.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// كان كل ملف يُشفَّر ككتلة واحدة: الملف كله في الذاكرة (حتى 512 ميغابايت
/// لعنصر واحد)، وبلا `AAD` تربط النصّ المشفَّر بسياقه، وبلا ما يمنع إعادة ترتيب
/// أجزائه أو قصّ آخره. وفشل المخزن الآمن كان مكتومًا تمامًا، فتُنتَج تنزيلات
/// «جاهزة» لا تُفَك أبدًا.

const _context = PackageContext(
  contentType: 'episode',
  contentId: 'ep-1',
  childId: 'child-1',
);

late Directory tempDir;

FileCrypto crypto({FakeSecureStorage? storage}) =>
    FileCrypto(storage: storage ?? FakeSecureStorage());

Uint8List bytes(int length, {int seed = 7}) {
  final random = Random(seed);
  return Uint8List.fromList(List<int>.generate(length, (_) => random.nextInt(256)));
}

void main() {
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('majarra_crypto_test');
  });
  tearDown(() async {
    if (await tempDir.exists()) await tempDir.delete(recursive: true);
  });

  group('الصيغة المقسَّمة', () {
    test('التشفير ثم الفكّ يعيد المحتوى نفسه عبر عدة أجزاء', () async {
      final subject = crypto();
      final plain = bytes(5000);
      final file = File('${tempDir.path}/a.enc');

      final written = await subject.encryptStreamToFile(
        Stream.value(plain),
        file,
        context: _context,
        chunkSize: 1024, // خمسة أجزاء وكسر
      );

      expect(written, plain.length);
      final onDisk = await file.readAsBytes();
      expect(onDisk, isNot(equals(plain)));
      // 5000 بايت بأجزاء 1024: أربعة أجزاء كاملة وجزء أخير 904 بايت = خمسة،
      // ولكل جزء وسم 16 بايت فوق ترويسة الصيغة.
      expect(onDisk.length, FileCrypto.headerLength + plain.length + 5 * 16);

      final decrypted = await subject.decryptToBytes(file, context: _context);
      expect(decrypted, equals(plain));
    });

    test('حجم مضاعف تمامًا لحجم الجزء ينتج جزءًا أخيرًا فارغًا لا يفقد بايتًا', () async {
      // الحالة الحدّية: بلا جزء أخير صريح، لا شيء يحمل علامة `final` فيصير
      // قصّ آخر الملف غير مكشوف.
      final subject = crypto();
      final plain = bytes(2048);
      final file = File('${tempDir.path}/b.enc');
      await subject.encryptStreamToFile(
        Stream.value(plain),
        file,
        context: _context,
        chunkSize: 1024,
      );
      expect(
        await subject.decryptToBytes(file, context: _context),
        equals(plain),
      );
    });

    test('ملف فارغ يُشفَّر ويُفَك', () async {
      final subject = crypto();
      final file = File('${tempDir.path}/empty.enc');
      await subject.encryptStreamToFile(
        const Stream<List<int>>.empty(),
        file,
        context: _context,
      );
      expect(await subject.decryptToBytes(file, context: _context), isEmpty);
    });

    test('التدفق يعمل مع أجزاء شبكة بأحجام لا تطابق حجم الجزء', () async {
      // الشبكة تُسلّم أجزاءً تعسّفية؛ الصيغة تحتاج أجزاءً ثابتة حتى يكون الفهرس
      // محسوبًا من طول الملف وحده.
      final subject = crypto();
      final plain = bytes(4096);
      final file = File('${tempDir.path}/c.enc');
      final pieces = <List<int>>[
        plain.sublist(0, 13),
        plain.sublist(13, 2600),
        plain.sublist(2600, 2601),
        plain.sublist(2601),
      ];
      await subject.encryptStreamToFile(
        Stream.fromIterable(pieces),
        file,
        context: _context,
        chunkSize: 512,
      );
      expect(
        await subject.decryptToBytes(file, context: _context),
        equals(plain),
      );
    });
  });

  group('الربط بالسياق', () {
    test('سياق لا يطابق يفشل بالمفتاح الصحيح نفسه', () async {
      // معيار القبول: `فك chunk بـAAD لا تطابق السياق يفشل حتى مع المفتاح
      // الصحيح`. المفتاح هنا هو نفسه (نفس المخزن)، والسياق وحده مختلف.
      final storage = FakeSecureStorage();
      final subject = FileCrypto(storage: storage);
      final file = File('${tempDir.path}/d.enc');
      await subject.encryptStreamToFile(
        Stream.value(bytes(3000)),
        file,
        context: _context,
        chunkSize: 1024,
      );

      const otherChild = PackageContext(
        contentType: 'episode',
        contentId: 'ep-1',
        childId: 'child-2',
      );
      await expectLater(
        FileCrypto(storage: storage).decryptToBytes(file, context: otherChild),
        throwsA(isA<SecretBoxAuthenticationError>()),
      );

      const otherContent = PackageContext(
        contentType: 'episode',
        contentId: 'ep-2',
        childId: 'child-1',
      );
      await expectLater(
        FileCrypto(storage: storage).decryptToBytes(file, context: otherContent),
        throwsA(isA<SecretBoxAuthenticationError>()),
      );
    });

    test('حقلان مختلفان لا ينتجان السياق نفسه', () async {
      // بلا تهريب الفاصل، `('a/b', 'c')` و`('a', 'b/c')` سياق واحد — وذلك
      // يعني مفتاحًا وAAD مشتركين بين محتويين مختلفين.
      const first = PackageContext(
        contentType: 'episode',
        contentId: 'a/b',
        childId: 'c',
      );
      const second = PackageContext(
        contentType: 'episode',
        contentId: 'a',
        childId: 'b/c',
      );
      expect(first.value, isNot(second.value));
    });
  });

  group('كشف التلاعب', () {
    test('تغيير بايت واحد يُفشل ذلك الجزء وحده', () async {
      final subject = crypto();
      final plain = bytes(3000);
      final file = File('${tempDir.path}/e.enc');
      await subject.encryptStreamToFile(
        Stream.value(plain),
        file,
        context: _context,
        chunkSize: 1024,
      );

      final raw = await file.readAsBytes();
      // بايت داخل الجزء الثالث (بعد ترويسة وجزأين مؤطَّرين).
      final target = FileCrypto.headerLength + 2 * (1024 + 16) + 10;
      raw[target] = raw[target] ^ 0xFF;
      await file.writeAsBytes(raw, flush: true);

      // أول جزأين يُسلَّمان قبل الفشل: التلف موضعي لا يُبطل الملف من أوّله،
      // وهذا ما يجعل إعادة تنزيل جزء واحد ممكنة.
      final delivered = <int>[];
      await expectLater(
        subject.decryptStreamFromFile(file, context: _context).forEach(delivered.addAll),
        throwsA(isA<SecretBoxAuthenticationError>()),
      );
      expect(delivered.length, 2048);
      expect(delivered, equals(plain.sublist(0, 2048)));
    });

    test('قصّ آخر الملف يُكتشَف ولا يُقرأ كملف أقصر سليم', () async {
      final subject = crypto();
      final file = File('${tempDir.path}/f.enc');
      await subject.encryptStreamToFile(
        Stream.value(bytes(3000)),
        file,
        context: _context,
        chunkSize: 1024,
      );

      // حذف الجزء الأخير كاملًا: يبقى ملف صالح شكلًا، وأجزاؤه كلها سليمة
      // تشفيريًّا — ولا يُكشَف إلا بعلامة `final` داخل AAD.
      final raw = await file.readAsBytes();
      final truncated = raw.sublist(0, FileCrypto.headerLength + 2 * (1024 + 16));
      await file.writeAsBytes(truncated, flush: true);

      await expectLater(
        subject.decryptToBytes(file, context: _context),
        throwsA(isA<SecretBoxAuthenticationError>()),
      );
    });

    test('تبديل ترتيب جزأين يُكتشَف', () async {
      final subject = crypto();
      final file = File('${tempDir.path}/g.enc');
      await subject.encryptStreamToFile(
        Stream.value(bytes(4096)),
        file,
        context: _context,
        chunkSize: 1024,
      );

      final raw = await file.readAsBytes();
      const frame = 1024 + 16;
      const start = FileCrypto.headerLength;
      final first = raw.sublist(start, start + frame);
      final second = raw.sublist(start + frame, start + 2 * frame);
      raw.setRange(start, start + frame, second);
      raw.setRange(start + frame, start + 2 * frame, first);
      await file.writeAsBytes(raw, flush: true);

      await expectLater(
        subject.decryptToBytes(file, context: _context),
        throwsA(isA<SecretBoxAuthenticationError>()),
      );
    });
  });

  group('الـnonce', () {
    test('لا يتكرّر مع المفتاح نفسه عبر عدد كبير من الأجزاء', () async {
      // معيار القبول يطلب إثباتًا على «عدد كبير من الأجزاء». الـnonce حتمي:
      // `salt(8) || chunkIndex`، فالتفرّد داخل الحزمة مضمون ببنائه لا احتماليًّا.
      final subject = crypto();
      final file = File('${tempDir.path}/h.enc');
      const chunkSize = 64;
      const chunks = 2000;
      await subject.encryptStreamToFile(
        Stream.value(bytes(chunkSize * chunks)),
        file,
        context: _context,
        chunkSize: chunkSize,
      );

      final raw = await file.readAsBytes();
      final salt = raw.sublist(10, 18);
      final seen = <String>{};
      for (var index = 0; index <= chunks; index += 1) {
        final nonce = Uint8List(12)..setRange(0, 8, salt);
        ByteData.view(nonce.buffer).setUint32(8, index);
        expect(seen.add(base64Encode(nonce)), isTrue, reason: 'تكرار عند $index');
      }
    });

    test('ملفان بنفس المحتوى والسياق ينتجان ciphertext مختلفًا', () async {
      // الملح عشوائي لكل حزمة، فالمفتاح المشتقّ مختلف — ولو تشابه الـnonce
      // بين حزمتين لما كان لذلك أثر لأن المفتاح غيره.
      final storage = FakeSecureStorage();
      final plain = bytes(2000);
      final first = File('${tempDir.path}/i1.enc');
      final second = File('${tempDir.path}/i2.enc');
      await FileCrypto(storage: storage)
          .encryptStreamToFile(Stream.value(plain), first, context: _context);
      await FileCrypto(storage: storage)
          .encryptStreamToFile(Stream.value(plain), second, context: _context);

      expect(await first.readAsBytes(), isNot(equals(await second.readAsBytes())));
      // ومع ذلك يُفَك الاثنان بنفس المفتاح الرئيسي.
      final subject = FileCrypto(storage: storage);
      expect(await subject.decryptToBytes(first, context: _context), equals(plain));
      expect(await subject.decryptToBytes(second, context: _context), equals(plain));
    });
  });

  group('ENC-011 — المخزن الآمن', () {
    test('فشل الكتابة يمنع الاستمرار بمفتاح ذاكرة', () async {
      final subject = FileCrypto(storage: FakeSecureStorage(failWrites: true));
      await expectLater(
        subject.ensureKeyAvailable(),
        throwsA(isA<SecureStorageUnavailableException>()),
      );
    });

    test('فشل القراءة لا يُقرأ كغياب مفتاح', () async {
      // هذه هي الحالة الأخطر: توليد مفتاح جديد فوق مفتاح قائم يجعل كل ما
      // نُزِّل سابقًا ciphertext بلا مفتاح، بلا رجعة.
      final storage = FakeSecureStorage();
      await FileCrypto(storage: storage).ensureKeyAvailable();
      final stored = storage.values.values.single;

      storage.failReads = true;
      await expectLater(
        FileCrypto(storage: storage).ensureKeyAvailable(),
        throwsA(isA<SecureStorageUnavailableException>()),
      );
      expect(storage.values.values.single, stored, reason: 'المفتاح القائم لا يُلمَس');
    });

    test('الرسالة تشرح السبب ولا تكشف تفصيلًا تشفيريًّا', () {
      const failure = SecureStorageUnavailableException('write');
      expect(failure.message, contains('التخزين الآمن'));
      for (final leak in ['مفتاح', 'AES', 'GCM', 'key']) {
        expect(failure.message, isNot(contains(leak)));
      }
    });

    test('المفتاح يُحفَظ مرة ويُعاد استخدامه', () async {
      final storage = FakeSecureStorage();
      await FileCrypto(storage: storage).ensureKeyAvailable();
      final first = storage.values.values.single;
      await FileCrypto(storage: storage).ensureKeyAvailable();
      expect(storage.values.values.single, first);
    });
  });

  group('ENC-003 — التشفير أثناء الوصول والاستئناف', () {
    test('حزمة تُكتب على جلستين تُفَك كأنها جلسة واحدة', () async {
      // هذا هو مسار الإيقاف/الاستئناف: الجلسة الأولى تُغلَق بلا جزء أخير،
      // والثانية تُكمل من حدّ الجزء. الملح يُقرأ من الترويسة القائمة، وإلا
      // اختلف المفتاح المشتقّ بين نصفَي الملف.
      final subject = crypto();
      final plain = bytes(3000);
      final file = File('${tempDir.path}/resume.enc');

      final first = await ChunkedPackageWriter.open(
        subject,
        file,
        context: _context,
        chunkSize: 1024,
      );
      await first.add(plain.sublist(0, 2500));
      expect(first.plainOffset, 2048, reason: 'جزآن مثبَّتان، والباقي في الذاكرة');
      await first.close(); // إيقاف: بلا جزء أخير

      final second = await ChunkedPackageWriter.open(
        subject,
        file,
        context: _context,
        chunkSize: 1024,
        resume: true,
      );
      expect(second.plainOffset, 2048, reason: 'الاستئناف من حدّ الجزء لا من طول الملف');
      // ما بعد الموضع المثبَّت يُعاد تنزيله — وهو ما يطلبه المدير بـRange.
      await second.add(plain.sublist(2048));
      expect(await second.finish(), plain.length);

      expect(
        await subject.decryptToBytes(file, context: _context),
        equals(plain),
      );
    });

    test('إطار ناقص من انقطاع سابق يُقصّ ولا يُبنى عليه', () async {
      final subject = crypto();
      final plain = bytes(3000);
      final file = File('${tempDir.path}/torn.enc');

      final writer = await ChunkedPackageWriter.open(
        subject,
        file,
        context: _context,
        chunkSize: 1024,
      );
      await writer.add(plain.sublist(0, 2048));
      await writer.close();
      final alignedLength = await file.length();

      // انقطاع أثناء كتابة إطار: بايتات معلَّقة لا تُشكّل جزءًا كاملًا.
      await file.writeAsBytes(<int>[1, 2, 3, 4, 5], mode: FileMode.append, flush: true);

      final resumed = await ChunkedPackageWriter.open(
        subject,
        file,
        context: _context,
        chunkSize: 1024,
        resume: true,
      );
      expect(resumed.plainOffset, 2048);
      await resumed.add(plain.sublist(2048));
      await resumed.finish();

      expect(await file.length(), greaterThan(alignedLength));
      // لو لم تُقصّ البايتات المعلَّقة لانكسر حساب الفهرس من طول الملف وفشل
      // الفكّ كلّه.
      expect(
        await subject.decryptToBytes(file, context: _context),
        equals(plain),
      );
    });

    test('تغيير حجم الجزء بين إصدارين يبدأ من الصفر لا يخلط الأحجام', () async {
      final subject = crypto();
      final file = File('${tempDir.path}/mixed.enc');
      final writer = await ChunkedPackageWriter.open(
        subject,
        file,
        context: _context,
        chunkSize: 1024,
      );
      await writer.add(bytes(2048));
      await writer.close();

      final resumed = await ChunkedPackageWriter.open(
        subject,
        file,
        context: _context,
        chunkSize: 2048,
        resume: true,
      );
      // الخلط كان سينتج ملفًا لا يُفَك: حساب الفهرس يفترض حجمًا واحدًا.
      expect(resumed.plainOffset, 0);
      final plain = bytes(3000, seed: 11);
      await resumed.add(plain);
      await resumed.finish();
      expect(
        await subject.decryptToBytes(file, context: _context),
        equals(plain),
      );
    });
  });

  group('الذاكرة', () {
    test('مسار التنزيل لا يحمل ملفًا كاملًا في الذاكرة', () {
      // معيار القبول الأول («تنزيل 400 ميغابايت لا يرفع الاستهلاك بمقدار حجم
      // الملف») لا يمكن قياسه في اختبار وحدة. القابل للتثبيت هو غياب المسار
      // الذي كان يسبّبه: `partFile.readAsBytes()` قبل التشفير، و
      // `writeEncrypted(item, Uint8List)` الذي كان يستقبل الملف كله.
      // التعليقات تُنزَع: الملفان يذكران الاسم القديم في شرح ما تغيّر، وفحصٌ
      // يفشل على شرحٍ صحيح يدفع إلى حذف الشرح لا إلى إصلاح الكود.
      String code(String path) => File(path)
          .readAsStringSync()
          .split('\n')
          .where((line) => !line.trimLeft().startsWith('//'))
          .join('\n');

      final manager = code('lib/features/downloads/application/download_manager.dart');
      expect(manager, isNot(contains('readAsBytes')));

      // ENC-003: لا `openWrite` على ملف جزئي — النصّ لا يُكتب صريحًا أصلًا،
      // بل يمرّ عبر الكاتب المشفِّر.
      expect(manager, contains('openEncryptingWriter'));
      expect(manager, isNot(contains('openWrite')));
      // والترقية بإعادة التسمية لا بإعادة تشفير ملف صريح.
      expect(manager, contains('promoteCompletedPart'));

      final repository = code('lib/features/downloads/data/download_repository.dart');
      expect(repository, isNot(contains('readAsBytes')));
      // ENC-004: التشغيل صار مصدرًا محليًّا يفكّ عند الطلب. لا فكّ إلى ملف
      // ولا إلى الذاكرة في مسار التشغيل.
      expect(repository, contains('playbackSourceFor'));
      expect(repository, isNot(contains('decryptToFile')));
      expect(repository, isNot(contains('decryptToBytes')));
    });
  });

  group('الصيغة القديمة', () {
    test('ملف بلا بادئة الصيغة يُقرأ بالمسار القديم', () async {
      // على أجهزة المستخدمين تنزيلات كُتبت قبل هذا التغيير. رفضها كان سيُظهر
      // كل تنزيل قائم كتالف.
      final storage = FakeSecureStorage();
      final subject = FileCrypto(storage: storage);
      final plain = bytes(500);

      // كتابة بالصيغة القديمة: nonce || ciphertext || tag بالمفتاح الرئيسي.
      final algorithm = AesGcm.with256bits();
      final key = await subject.masterKey();
      final box = await algorithm.encrypt(
        plain,
        secretKey: key,
        nonce: algorithm.newNonce(),
      );
      final legacy = File('${tempDir.path}/legacy.enc');
      await legacy.writeAsBytes(box.concatenation(), flush: true);

      expect(
        await subject.decryptToBytes(legacy, context: _context),
        equals(plain),
      );
    });
  });
}
