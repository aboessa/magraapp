import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../failures/secure_storage_failure.dart';

/// `SecureStorageUnavailableException` كان معرَّفًا هنا وانتقل إلى
/// `core/failures/` حين احتاجه مخزن التوكنات (`APP-106`). يُصدَّر من موضعه
/// الأصلي حتى لا يتغيّر استيراد قائم.
export '../failures/secure_storage_failure.dart' show SecureStorageUnavailableException;

/// AES-256-GCM encryption for downloaded media at rest (§3, §32).
///
/// ## Why encrypt downloads
///
/// A downloaded episode or story is licensed content. Writing it to disk as a
/// plain `.mp4`/`.m4a` would let any file browser copy it out of the app
/// sandbox and share it freely. This layer encrypts every downloaded file with
/// AES-256-GCM under a key the app holds, so a file lifted off the device is
/// ciphertext. This is confidentiality-at-rest, NOT DRM: a determined user with
/// the running app can still reach the plaintext, and the honest claim is
/// "encrypted local storage", not "copy protection".
///
/// The primitive is the platform/BoringSSL-backed [AesGcm] from the
/// `cryptography` package — no hand-rolled crypto.
///
/// ## ENC-006 — ما تغيّر، ولماذا الشكل الجديد
///
/// كان الملف يُشفَّر **ككتلة واحدة**: `encryptBytesToFile(Uint8List, File)`
/// يأخذ الملف كاملًا في الذاكرة، و`decryptFile` يقرؤه كاملًا. وحدّ العنصر
/// الواحد 512 ميغابايت، أي نصف جيجابايت في ذاكرة جهاز طفل — وثلاث علل أخرى
/// أخطر من الذاكرة:
///
///   1. **لا AAD**: نصّ مشفَّر صالح من سياق آخر (محتوى آخر، ملف طفل آخر) يُفَك
///      بنجاح، والرفض يعتمد على منطق التطبيق لا على التشفير.
///   2. **لا ربط ترتيب**: لا شيء يمنع إعادة ترتيب أجزاء أو قصّ آخر الملف.
///   3. **التلف يعني إعادة الملف كله**: لا وحدة أصغر من الملف.
///
/// الصيغة الآن مقسَّمة إلى chunks على نمط STREAM المعروف:
///
/// ```text
/// الترويسة (18 بايت):
///   0..3   'MJR1'
///   4      version = 1
///   5      flags   = 0
///   6..9   chunkSize (uint32 BE) — حجم النصّ الصريح لكل chunk
///   10..17 packageSalt (8 بايت عشوائية لكل ملف)
/// ثم لكل chunk: ciphertext || tag(16)
/// ```
///
/// * **المفتاح لكل حزمة**: `HKDF-SHA256(master, salt, info=context)`. فملفان
///   مختلفان لا يتشاركان مفتاحًا، فلا خطر إعادة استخدام nonce بينهما.
/// * **الـnonce حتمي لا عشوائي**: `salt(8) || chunkIndex(uint32 BE)`. الخطة
///   تشترط تفرّدًا حتميًا لا «عشوائيًا»: العشوائي 96-بت يصطدم احتماليًّا بعد
///   عدد كبير من الأجزاء تحت المفتاح نفسه، والحتمي لا يصطدم أبدًا داخل الحزمة
///   لأن العدّاد لا يتكرّر، وبين الحزمات المفتاح مختلف أصلًا.
/// * **AAD تربط كل chunk بسياقه وموضعه**: `context` و`chunkIndex` وعلامة
///   `final`. فَكّ chunk بسياق لا يطابق يفشل تشفيريًّا حتى بالمفتاح الصحيح،
///   وقصّ آخر الملف يفشل لأن آخر chunk المتبقّي ليس `final`، وتبديل ترتيب
///   الأجزاء يفشل لأن الفهرس داخل AAD.
///
/// طول النصّ الصريح **لا يُخزَّن** في الترويسة: يُحسب من طول الملف وعدد
/// الأجزاء. ما لا يُخزَّن لا يُزوَّر، وترويسة تحمل طولًا غير موثَّق كانت ستحتاج
/// حماية إضافية بلا فائدة.
///
/// ## ما لم يُنفَّذ بعد
///
/// AAD في الخطة تشمل `deviceId` و`licenseId` (تشفير المحتوي.md:8). لا وجود
/// لأيّهما في التطبيق اليوم: منظومة الترخيص غير موجودة (`ENC-001`) والمفتاح
/// مفتاح تطبيق لا CEK مغلَّف للجهاز (`ENC-002`). [PackageContext] مبنيّ ليقبلهما
/// بحقلين إضافيين حين يوجدان، والصيغة تحمل `version` لتمييز الأجيال.
class FileCrypto {
  FileCrypto({FlutterSecureStorage? storage})
      : _storage = storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
            iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
          );

  static const _masterKeyStorageKey = 'majarra_download_master_key_v1';
  static const _nonceLength = 12; // 96-bit GCM nonce.
  static const _tagLength = 16;

  /// طول ترويسة الصيغة المقسَّمة.
  static const headerLength = 18;

  /// بادئة الصيغة. غيابها يعني ملفًا بالصيغة القديمة (كتلة واحدة).
  static const _magic = <int>[0x4D, 0x4A, 0x52, 0x31]; // 'MJR1'
  static const _formatVersion = 1;

  /// حجم الـchunk الافتراضي: ميغابايت واحد.
  ///
  /// الخطة تسمح بـ1–8 ميغابايت بحسب النوع. الحدّ الأدنى هو الاختيار الافتراضي
  /// لأن السقف الحقيقي هنا هو ذاكرة جهاز طفل رخيص، وكلفة الأجزاء الأصغر 16
  /// بايت لكل جزء — أي 8 كيلوبايت لملف 512 ميغابايت.
  static const defaultChunkSize = 1024 * 1024;

  final FlutterSecureStorage _storage;
  final AesGcm _algorithm = AesGcm.with256bits();
  SecretKey? _cachedKey;

  /// المفتاح الرئيسي، يُنشأ عند أول استخدام ويُحفظ في مخزن المنصّة
  /// (Keychain / EncryptedSharedPreferences).
  ///
  /// ## ENC-011 — لماذا لا `try/catch` صامت هنا
  ///
  /// كانت القراءة تبتلع كل خطأ وتُعيد `null`، والكتابة تبتلع كل خطأ ثم
  /// **تُكمل بمفتاح في الذاكرة**. أثر ذلك حالتان صامتتان، كلتاهما تُنتج تنزيلات
  /// «جاهزة» لا تُفَك أبدًا:
  ///
  ///   * **فشل قراءة** يُقرأ كـ«لا مفتاح» فيُولَّد مفتاح جديد ويُكتب فوق
  ///     القديم — فكل ما نُزِّل سابقًا يصير ciphertext بلا مفتاح، **بلا رجعة**.
  ///   * **فشل كتابة** يعني تشفير الملفات بمفتاح يزول مع إنهاء العملية.
  ///
  /// الآن كل خطأ في المخزن يُرفَع كـ[SecureStorageUnavailableException]،
  /// و«غياب المفتاح» (قراءة ناجحة تُعيد `null`) هو الحالة الوحيدة التي تُولّد
  /// مفتاحًا. والتوليد لا يُعتمد إلا بعد كتابة ناجحة.
  Future<SecretKey> masterKey() async {
    final cached = _cachedKey;
    if (cached != null) return cached;

    final String? existing;
    try {
      existing = await _storage.read(key: _masterKeyStorageKey);
    } catch (error) {
      // لا نُولّد مفتاحًا هنا: القراءة الفاشلة لا تعني الغياب، وتوليدُ مفتاح
      // فوق مفتاح قائم يفقد كل التنزيلات السابقة نهائيًّا.
      throw SecureStorageUnavailableException('read', error);
    }

    if (existing != null && existing.isNotEmpty) {
      return _cachedKey = SecretKey(base64Decode(existing));
    }

    final generated = await _algorithm.newSecretKey();
    final raw = await generated.extractBytes();
    try {
      await _storage.write(key: _masterKeyStorageKey, value: base64Encode(raw));
    } catch (error) {
      throw SecureStorageUnavailableException('write', error);
    }
    return _cachedKey = SecretKey(raw);
  }

  /// يتحقّق أن المخزن الآمن يعمل قبل بدء أي تنزيل.
  ///
  /// نقطة الفحص المبكّر: بلا هذا يبدأ التنزيل ويستهلك بيانات الأسرة ثم يفشل
  /// عند الكتابة، أو أسوأ — ينجح ظاهريًّا بمفتاح ذاكرة.
  Future<void> ensureKeyAvailable() async {
    await masterKey();
  }

  /// المفتاح المشتقّ لهذه الحزمة وحدها.
  Future<SecretKey> _packageKey(Uint8List salt, PackageContext context) async {
    final hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);
    return hkdf.deriveKey(
      secretKey: await masterKey(),
      nonce: salt,
      info: utf8.encode(context.value),
    );
  }

  Uint8List _nonceFor(Uint8List salt, int chunkIndex) {
    final nonce = Uint8List(_nonceLength)..setRange(0, salt.length, salt);
    ByteData.view(nonce.buffer).setUint32(salt.length, chunkIndex);
    return nonce;
  }

  List<int> _aadFor(PackageContext context, int chunkIndex, bool isFinal, int chunkSize) =>
      utf8.encode('mjr1|${context.value}|$chunkIndex|${isFinal ? 'final' : 'part'}|$chunkSize');

  Uint8List _header(int chunkSize, Uint8List salt) {
    final header = Uint8List(headerLength);
    header.setRange(0, 4, _magic);
    header[4] = _formatVersion;
    header[5] = 0; // flags
    ByteData.view(header.buffer).setUint32(6, chunkSize);
    header.setRange(10, 18, salt);
    return header;
  }

  /// يشفّر [source] تدفقيًّا إلى [target] ويُعيد طول النصّ الصريح.
  ///
  /// الذاكرة المستهلكة حجم chunk واحد لا حجم الملف: هذا هو معيار القبول الأول
  /// في `ENC-006`.
  Future<int> encryptStreamToFile(
    Stream<List<int>> source,
    File target, {
    required PackageContext context,
    int chunkSize = defaultChunkSize,
  }) async {
    final writer = await ChunkedPackageWriter.open(
      this,
      target,
      context: context,
      chunkSize: chunkSize,
    );
    try {
      await for (final piece in source) {
        await writer.add(piece);
      }
      return await writer.finish();
    } catch (_) {
      await writer.close();
      rethrow;
    }
  }

  /// يفكّ ملفًا بالصيغة المقسَّمة تدفقيًّا.
  ///
  /// يرفع [SecretBoxAuthenticationError] لأي تلف أو تلاعب — بما في ذلك سياق
  /// لا يطابق، أو ترتيب مُبدَّل، أو قصّ لآخر الملف.
  Stream<Uint8List> decryptStreamFromFile(
    File source, {
    required PackageContext context,
  }) async* {
    final length = await source.length();
    final handle = await source.open();
    try {
      final header = await handle.read(headerLength);
      if (!_hasMagic(header)) {
        // صيغة قديمة (كتلة واحدة) من تنزيل سابق لهذا التغيير. تُقرأ ولا تُكتب.
        await handle.close();
        yield await _decryptLegacyFile(source);
        return;
      }
      if (header[4] != _formatVersion) {
        throw FormatException('Unsupported package version ${header[4]}');
      }
      final chunkSize = ByteData.view(
        Uint8List.fromList(header).buffer,
      ).getUint32(6);
      if (chunkSize <= 0) throw const FormatException('Invalid chunk size');
      final salt = Uint8List.fromList(header.sublist(10, 18));
      final key = await _packageKey(salt, context);

      final layout = _layoutFor(length, chunkSize);

      for (var index = 0; index < layout.totalChunks; index += 1) {
        final isFinal = index == layout.totalChunks - 1;
        final frame = isFinal && layout.remainder != 0 ? layout.remainder : layout.framed;
        final bytes = await handle.read(frame);
        if (bytes.length != frame) throw const FormatException('Truncated package');
        final box = SecretBox(
          Uint8List.sublistView(
            Uint8List.fromList(bytes),
            0,
            bytes.length - _tagLength,
          ),
          nonce: _nonceFor(salt, index),
          mac: Mac(bytes.sublist(bytes.length - _tagLength)),
        );
        final clear = await _algorithm.decrypt(
          box,
          secretKey: key,
          aad: _aadFor(context, index, isFinal, chunkSize),
        );
        yield Uint8List.fromList(clear);
      }
    } finally {
      try {
        await handle.close();
      } catch (_) {
        // أُغلق مسبقًا في مسار الصيغة القديمة.
      }
    }
  }

  /// تقسيم الحزمة كما هو مقروء من الملف نفسه.
  ///
  /// حسابٌ واحد يستعمله الفكّ الكامل والفكّ الجزئي: نسختان من هذه الحسبة تعني
  /// أن يقرأ أحدهما جزءًا بفهرس والآخر بفهرس آخر، فيفشل التحقّق بلا سبب ظاهر.
  static _PackageLayout _layoutFor(int fileLength, int chunkSize) {
    final framed = chunkSize + _tagLength;
    final body = fileLength - headerLength;
    if (body < _tagLength) throw const FormatException('Truncated package');
    final fullChunks = body ~/ framed;
    final remainder = body % framed;
    if (remainder != 0 && remainder < _tagLength) {
      throw const FormatException('Truncated package');
    }
    return _PackageLayout(
      chunkSize: chunkSize,
      framed: framed,
      totalChunks: remainder == 0 ? fullChunks : fullChunks + 1,
      remainder: remainder,
      plainLength: fullChunks * chunkSize + (remainder == 0 ? 0 : remainder - _tagLength),
    );
  }

  /// طول النصّ الصريح لحزمة على القرص، بلا فكّ أي بايت.
  ///
  /// يحتاجه الخادم المحلي ليجيب على `Range` و`Content-Length` قبل أن يقرأ
  /// المحتوى: مشغّل الفيديو يسأل عن الطول أولًا، وإجابة خاطئة تعني شريط تقدّم
  /// كاذبًا وقفزًا لا يصل.
  Future<int> plainLengthOf(File source) async {
    final length = await source.length();
    final handle = await source.open();
    try {
      final header = await handle.read(headerLength);
      if (!_hasMagic(header)) {
        // صيغة قديمة: nonce + وسم فوق النصّ الصريح.
        return length - _nonceLength - _tagLength;
      }
      final chunkSize = ByteData.view(
        Uint8List.fromList(header).buffer,
      ).getUint32(6);
      return _layoutFor(length, chunkSize).plainLength;
    } finally {
      await handle.close();
    }
  }

  /// يفكّ نطاقًا من الحزمة: `[start, end)` بالنصّ الصريح.
  ///
  /// ## لماذا هذا ممكن أصلًا
  ///
  /// لأن الصيغة مقسَّمة (`ENC-006`): كل جزء مستقلّ بمفتاحه وnonce وAAD، ففهرس
  /// الجزء يُحسب من الموضع مباشرة ولا حاجة لقراءة ما قبله. بلا التقسيم كان
  /// القفز في منتصف حلقة يعني فكّ الملف من أوّله.
  ///
  /// يُقرأ ويُفَك جزء واحد في كل لحظة، فالذاكنة محدودة بحجم الجزء لا بالنطاق.
  Stream<Uint8List> decryptRange(
    File source, {
    required PackageContext context,
    required int start,
    required int end,
  }) async* {
    if (start < 0 || end < start) {
      throw RangeError('Invalid range $start-$end');
    }
    if (start == end) return;

    final length = await source.length();
    final handle = await source.open();
    var closed = false;
    try {
      final header = await handle.read(headerLength);
      if (!_hasMagic(header)) {
        // الصيغة القديمة كتلة واحدة: لا فكّ جزئي فيها. تُفَك كاملة ثم تُقتَطع،
        // وهي حالة تنزيلات ما قبل `ENC-006` وحدها.
        await handle.close();
        closed = true;
        final clear = await _decryptLegacyFile(source);
        final upper = end > clear.length ? clear.length : end;
        if (start < upper) yield Uint8List.sublistView(clear, start, upper);
        return;
      }
      if (header[4] != _formatVersion) {
        throw FormatException('Unsupported package version ${header[4]}');
      }
      final chunkSize = ByteData.view(
        Uint8List.fromList(header).buffer,
      ).getUint32(6);
      if (chunkSize <= 0) throw const FormatException('Invalid chunk size');
      final salt = Uint8List.fromList(header.sublist(10, 18));
      final key = await _packageKey(salt, context);
      final layout = _layoutFor(length, chunkSize);
      final upper = end > layout.plainLength ? layout.plainLength : end;

      var index = start ~/ chunkSize;
      while (index < layout.totalChunks) {
        final chunkStart = index * chunkSize;
        if (chunkStart >= upper) break;
        final isFinal = index == layout.totalChunks - 1;
        final frame = isFinal && layout.remainder != 0 ? layout.remainder : layout.framed;
        await handle.setPosition(headerLength + index * layout.framed);
        final bytes = await handle.read(frame);
        if (bytes.length != frame) throw const FormatException('Truncated package');
        final raw = Uint8List.fromList(bytes);
        final box = SecretBox(
          Uint8List.sublistView(raw, 0, raw.length - _tagLength),
          nonce: _nonceFor(salt, index),
          mac: Mac(raw.sublist(raw.length - _tagLength)),
        );
        final clear = Uint8List.fromList(
          await _algorithm.decrypt(
            box,
            secretKey: key,
            aad: _aadFor(context, index, isFinal, chunkSize),
          ),
        );
        final from = chunkStart >= start ? 0 : start - chunkStart;
        final to = chunkStart + clear.length <= upper ? clear.length : upper - chunkStart;
        if (to > from) yield Uint8List.sublistView(clear, from, to);
        index += 1;
      }
    } finally {
      if (!closed) {
        try {
          await handle.close();
        } catch (_) {
          // أُغلق في مسار الصيغة القديمة.
        }
      }
    }
  }

  /// يفكّ [source] إلى [target] بذاكرة محدودة بحجم chunk واحد.
  Future<void> decryptToFile(
    File source,
    File target, {
    required PackageContext context,
  }) async {
    await target.parent.create(recursive: true);
    final sink = target.openWrite();
    try {
      await for (final chunk in decryptStreamFromFile(source, context: context)) {
        sink.add(chunk);
      }
      await sink.flush();
    } finally {
      await sink.close();
    }
  }

  /// يفكّ ملفًا صغيرًا إلى الذاكرة. للاستخدام مع الملفات الصغيرة وحدها.
  Future<Uint8List> decryptToBytes(
    File source, {
    required PackageContext context,
  }) async {
    final builder = BytesBuilder(copy: false);
    await for (final chunk in decryptStreamFromFile(source, context: context)) {
      builder.add(chunk);
    }
    return builder.takeBytes();
  }

  bool _hasMagic(List<int> header) {
    if (header.length < headerLength) return false;
    for (var i = 0; i < _magic.length; i += 1) {
      if (header[i] != _magic[i]) return false;
    }
    return true;
  }

  /// قارئ الصيغة القديمة: `nonce || ciphertext || tag` بلا AAD ولا أجزاء.
  ///
  /// يبقى للقراءة وحدها حتى تنقضي التنزيلات التي كُتبت قبل `ENC-006`. لا مسار
  /// كتابة يستخدمه، ولا يجوز أن يُستخدم لملف جديد: بلا AAD لا شيء يربط الملف
  /// بسياقه.
  Future<Uint8List> _decryptLegacyFile(File source) async {
    final key = await masterKey();
    final bytes = await source.readAsBytes();
    final box = SecretBox.fromConcatenation(
      bytes,
      nonceLength: _nonceLength,
      macLength: _tagLength,
    );
    final clear = await _algorithm.decrypt(box, secretKey: key);
    return Uint8List.fromList(clear);
  }

  Uint8List _randomSalt() {
    final nonce = _algorithm.newNonce(); // 12 بايت عشوائية من مصدر المنصّة
    return Uint8List.fromList(nonce.sublist(0, 8));
  }

  /// Drops the in-memory key cache. Called on sign-out; the stored key itself is
  /// removed by [wipeMasterKey].
  void forgetCachedKey() => _cachedKey = null;

  /// Removes the master key so no previously-downloaded ciphertext can ever be
  /// decrypted again. Called when downloads are purged on sign-out.
  Future<void> wipeMasterKey() async {
    _cachedKey = null;
    await _storage.delete(key: _masterKeyStorageKey);
  }
}

/// تقسيم حزمة على القرص، محسوبًا من طولها وحجم أجزائها.
class _PackageLayout {
  const _PackageLayout({
    required this.chunkSize,
    required this.framed,
    required this.totalChunks,
    required this.remainder,
    required this.plainLength,
  });

  final int chunkSize;
  final int framed;
  final int totalChunks;
  final int remainder;
  final int plainLength;
}

/// كاتب حزمة مقسَّمة، يُشفِّر أثناء الوصول ويستأنف من حدود الأجزاء.
///
/// ## العلّة التي يغلقها هذا الصف — ENC-003
///
/// كان التنزيل يكتب الملف **مكشوفًا كاملًا** في `<id>.part` ثم يشفّره في خطوة
/// ثانية. الترتيب المحرَّم صراحةً في الخطة (§8): بين انتهاء التنزيل وانتهاء
/// التشفير يبقى ملفٌ صريح كامل على القرص، وإن تعطّل التطبيق أو أُغلق أو نفدت
/// المساحة في تلك اللحظة بقي هناك إلى الأبد. وحجم النافذة يساوي زمن تشفير
/// نصف جيجابايت.
///
/// الآن لا يوجد نصّ صريح على القرص في أي لحظة: كل chunk يُشفَّر في الذاكرة
/// ويُكتب مشفَّرًا، والملف الجزئي هو **نفسه** الحزمة النهائية ناقصةَ أجزائها
/// الأخيرة.
///
/// ## الاستئناف
///
/// الحدود هي حدود الأجزاء: الملف الجزئي يُقصّ إلى آخر إطار كامل
/// (`chunkSize + 16`)، ويُطلَب من الخادم `Range` من ذلك الموضع بالنصّ الصريح.
/// الملح يُقرأ من ترويسة الملف القائم لا يُولَّد من جديد، وإلا اختلف المفتاح
/// المشتقّ بين نصف الملف ونصفه الآخر.
///
/// **ما يُفقَد عند الإيقاف:** ما دون الجزء الواحد من بايتات مجمَّعة في الذاكرة
/// (أقل من ميغابايت). البديل — كتابة جزء ناقص ثم إكماله — يعني إطارًا لا يطابق
/// حجمه الصيغة، فينكسر حساب الفهرس من طول الملف، وهو أساس فكّ التشفير كلّه.
class ChunkedPackageWriter {
  ChunkedPackageWriter._(
    this._crypto,
    this._handle,
    this._key,
    this._salt,
    this._context,
    this.chunkSize,
    this._chunkIndex,
    this._plainOffset,
  );

  /// المالك، ومنه تُقرأ قواعد الـnonce وAAD.
  ///
  /// لا نسخة ثانية منهما هنا: قاعدة توثيق منسوخة تنحرف، وانحرافها يعني ملفًا
  /// يُكتب بقاعدة ويُقرأ بأخرى — أي حزمة لا تُفَك، أو أسوأ: حزمة تُفَك بسياق
  /// خطأ.
  final FileCrypto _crypto;

  final RandomAccessFile _handle;
  final SecretKey _key;
  final Uint8List _salt;
  final PackageContext _context;
  final int chunkSize;

  final BytesBuilder _buffer = BytesBuilder(copy: false);

  int _chunkIndex;
  int _plainOffset;
  bool _closed = false;

  /// عدد بايتات النصّ الصريح المُثبَّتة على القرص (أجزاء كاملة فقط).
  int get plainOffset => _plainOffset;

  /// يفتح [target] للكتابة، مستأنفًا إن أمكن.
  ///
  /// [resume] بلا ملف قائم، أو بترويسة لا تطابق، أو بحجم أجزاء مختلف = بداية
  /// جديدة. الأخير مهم: تغيير `chunkSize` بين إصدارين لا يجوز أن يُنتج ملفًا
  /// بأجزاء مختلطة الأحجام.
  static Future<ChunkedPackageWriter> open(
    FileCrypto crypto,
    File target, {
    required PackageContext context,
    int chunkSize = FileCrypto.defaultChunkSize,
    bool resume = false,
  }) async {
    if (chunkSize <= 0) throw ArgumentError.value(chunkSize, 'chunkSize');
    await target.parent.create(recursive: true);

    if (resume && await target.exists()) {
      final length = await target.length();
      if (length >= FileCrypto.headerLength) {
        // `append` تفتح للقراءة والكتابة معًا، والكتابة تذهب إلى نهاية الملف
        // دائمًا — وهو المطلوب بعد القصّ إلى حدّ الإطار.
        final handle = await target.open(mode: FileMode.append);
        try {
          await handle.setPosition(0);
          final header = await handle.read(FileCrypto.headerLength);
          final matches = crypto._hasMagic(header) &&
              header[4] == FileCrypto._formatVersion &&
              ByteData.view(Uint8List.fromList(header).buffer).getUint32(6) == chunkSize;
          if (matches) {
            final framed = chunkSize + FileCrypto._tagLength;
            final body = length - FileCrypto.headerLength;
            final complete = body ~/ framed;
            final aligned = FileCrypto.headerLength + complete * framed;
            // إطار ناقص من انقطاع سابق يُقصّ: إكماله مستحيل لأن حالة GCM
            // الوسطى لا تُخزَّن، وتركه يُفشل حساب الفهرس عند الفك.
            if (aligned != length) await handle.truncate(aligned);
            await handle.setPosition(aligned);
            final salt = Uint8List.fromList(header.sublist(10, 18));
            return ChunkedPackageWriter._(
              crypto,
              handle,
              await crypto._packageKey(salt, context),
              salt,
              context,
              chunkSize,
              complete,
              complete * chunkSize,
            );
          }
        } catch (_) {
          // ترويسة تالفة أو ملف غير مقروء: نبدأ من الصفر بدل أن نبني على مجهول.
        }
        await handle.close();
      }
    }

    final salt = crypto._randomSalt();
    final handle = await target.open(mode: FileMode.write); // يقصّ أي بقايا
    await handle.writeFrom(crypto._header(chunkSize, salt));
    return ChunkedPackageWriter._(
      crypto,
      handle,
      await crypto._packageKey(salt, context),
      salt,
      context,
      chunkSize,
      0,
      0,
    );
  }

  /// يضيف بايتات وصلت من الشبكة، ويكتب كل جزء يكتمل.
  Future<void> add(List<int> piece) async {
    if (_closed) throw StateError('Writer is closed');
    _buffer.add(piece);
    while (_buffer.length >= chunkSize) {
      final pending = _buffer.takeBytes();
      await _writeChunk(
        Uint8List.sublistView(pending, 0, chunkSize),
        isFinal: false,
      );
      if (pending.length > chunkSize) {
        _buffer.add(Uint8List.sublistView(pending, chunkSize));
      }
    }
  }

  /// يكتب الجزء الأخير ويُغلق. يُعيد طول النصّ الصريح كاملًا.
  Future<int> finish() async {
    if (_closed) throw StateError('Writer is closed');
    // الجزء الأخير يُكتب دائمًا — حتى فارغًا — لأن علامة `final` هي ما يجعل
    // قصّ آخر الحزمة مكشوفًا عند الفك.
    await _writeChunk(_buffer.takeBytes(), isFinal: true);
    await _handle.flush();
    await close();
    return _plainOffset;
  }

  /// يُغلق بلا جزء أخير: الملف يبقى حزمةً جزئية قابلة للاستئناف.
  Future<void> close() async {
    if (_closed) return;
    _closed = true;
    try {
      await _handle.close();
    } catch (_) {
      // إغلاق فاشل لا يجوز أن يحجب سبب الفشل الأصلي.
    }
  }

  Future<void> _writeChunk(Uint8List plain, {required bool isFinal}) async {
    final box = await _crypto._algorithm.encrypt(
      plain,
      secretKey: _key,
      nonce: _crypto._nonceFor(_salt, _chunkIndex),
      aad: _crypto._aadFor(_context, _chunkIndex, isFinal, chunkSize),
    );
    await _handle.writeFrom(box.cipherText);
    await _handle.writeFrom(box.mac.bytes);
    _plainOffset += plain.length;
    _chunkIndex += 1;
  }
}

/// سياق الحزمة الذي يُربَط تشفيريًّا بكل chunk.
///
/// الغرض أن نصًّا مشفَّرًا لا يُفَك إلا في سياقه: نسخ ملف من ملف طفل إلى آخر،
/// أو استخدامه لمحتوى آخر، يفشل بالمفتاح الصحيح نفسه.
///
/// [deviceId] و[licenseId] موجودان في الخطة (تشفير المحتوي.md:8) ولا وجود
/// لهما في التطبيق بعد (`ENC-001`, `ENC-002`)، فيُقبلان اختياريًّا ويدخلان
/// السياق حين يوجدان. **إضافتهما لاحقًا تُبطل فكّ الملفات المنزَّلة قبلها**،
/// وهو سلوك مقصود يستلزم إعادة تنزيل، ولذلك تحمل الصيغة `version`.
class PackageContext {
  const PackageContext({
    required this.contentType,
    required this.contentId,
    required this.childId,
    this.deviceId,
    this.licenseId,
  });

  final String contentType;
  final String contentId;
  final String childId;
  final String? deviceId;
  final String? licenseId;

  /// التمثيل النصّي الداخل في HKDF وفي AAD. الفواصل ثابتة وكل حقل يُهرَّب من
  /// الفاصل، فلا يمكن لقيمتين مختلفتين أن تُنتجا السياق نفسه.
  String get value => [
    'v1',
    _escape(contentType),
    _escape(contentId),
    _escape(childId),
    _escape(deviceId ?? '-'),
    _escape(licenseId ?? '-'),
  ].join('/');

  static String _escape(String value) => value.replaceAll('%', '%25').replaceAll('/', '%2F');
}


