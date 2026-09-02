import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'offline_license.dart';

/// ENC-005 — الوقت الموثوق وحالة الترخيص، والبوابة التي تقرّر «هل يُشغَّل هذا؟».
///
/// ## ثلاث علل، وكلها في أن الجهاز كان سلطة على نفسه
///
/// 1. **الساعة.** `isExpired()` كان يقارن بـ`DateTime.now()`. تأخير ساعة الجهاز
///    ستين يومًا يُعيد تشغيل محتوى انتهى.
/// 2. **الحالة.** الميتاداتا في `shared_preferences` — ملف XML/plist عادي —
///    فتحرير `expires_at` يجعل الترخيص أبديًّا.
/// 3. **التراجع.** استعادة نسخة أقدم من الملف تُعيد ترخيصًا مستهلَكًا.
///
/// ## الوقت الموثوق: أقصى ما هو معروف، لا ما يقوله الجهاز
///
/// الوقت المستعمل للانتهاء هو **الأكبر** بين:
///
///   * ساعة الجهاز الآن،
///   * وآخر وقت موثوق معروف (إصدار ترخيص، أو ترويسة خادم) مضافًا إليه ما مضى
///     على **ساعة أحادية الاتجاه** (`Stopwatch`) منذ تسجيله.
///
/// الأخذ بالأكبر هو المفتاح: تقديم الساعة لا يضرّ (يُعجّل الانتهاء)، وتأخيرها لا
/// ينفع لأن العلامة الموثوقة الأخيرة تبقى مرجعًا. والساعة الأحادية تُقاس منها
/// المدّة داخل جلسة التشغيل نفسها، فلا يُفيد تعديل ساعة النظام أثناءها.
///
/// **حدّ صريح:** بعد إعادة تشغيل التطبيق تزول الساعة الأحادية، فيعود المرجع إلى
/// آخر علامة موثوقة محفوظة. أي أن أقصى ما يكسبه من يؤخّر ساعته هو ألّا يتقدّم
/// الزمن عنده — لا أن يعود إلى الوراء. والإغلاق الكامل يحتاج تحققًا خادميًّا
/// دوريًّا، وهو ما تفعله إعادة التحقّق عند أول اتصال.
///
/// ## التراجع
///
/// كل كتابة ترفع عدّادًا محفوظًا في التخزين الآمن، وأي حالة تُحمَّل بعدّاد أقلّ
/// من أعلى ما رُئي تُرفَض. هذا يمنع استعادة نسخة أقدم من **ملف** الميتاداتا.
/// وهو **لا** يمنع استعادة نسخة كاملة من التخزين الآمن نفسه — ذلك غير قابل
/// للمنع على الجهاز، ويكشفه التحقّق الخادمي عند الاتصال. الحدّ مذكور هنا لا
/// مُدَّعى عكسه.
class LicenseGuard {
  LicenseGuard({
    FlutterSecureStorage? storage,
    OfflineLicenseVerifier? verifier,
    DateTime Function()? clock,
  }) : _storage = storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
            iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
          ),
       _verifier = verifier ?? OfflineLicenseVerifier.fromEnvironment(),
       _deviceClock = clock ?? DateTime.now;

  static const _licensePrefix = 'majarra_offline_license_';
  static const _trustedTimeKey = 'majarra_trusted_time_ms';
  static const _counterKey = 'majarra_license_state_counter';
  static const _verifiedAtKey = 'majarra_license_verified_at_ms';

  /// أقصى مدّة يُسمَح فيها بالتشغيل دون إعادة تحقّق خادمي (`ENC-010`).
  ///
  /// الخطة تطلب «إعادة تحقّق دورية إلزامية» ولا تحدّد قيمتها. سبعة أيام داخل
  /// مدّة الترخيص (ثلاثين يومًا)، فهي **تشدّد** ولا تُرخي: جهاز مسروق أو حساب
  /// أُلغي اشتراكه يتوقف بعد أسبوع بلا اتصال بدل شهر.
  ///
  /// والقيمة في موضع واحد لأنها موازنة منتج لا هندسة: أسرة في سفر طويل تفقد
  /// محتواها المحفوظ بعدها، وتقصيرها يزيد الأمان ويضرّ الاستخدام المشروع.
  static const maxOfflineGap = Duration(days: 7);

  final FlutterSecureStorage _storage;
  final OfflineLicenseVerifier _verifier;
  final DateTime Function() _deviceClock;

  /// علامة الوقت الموثوق الأخيرة وما مضى عليها بساعة أحادية الاتجاه.
  int? _anchorTrustedMs;
  final Stopwatch _sinceAnchor = Stopwatch();

  bool get isConfigured => _verifier.isConfigured;

  /// أفضل تقدير للوقت الحقيقي الآن.
  DateTime trustedNow() {
    final device = _deviceClock().millisecondsSinceEpoch;
    final anchor = _anchorTrustedMs;
    final fromAnchor = anchor == null ? null : anchor + _sinceAnchor.elapsedMilliseconds;
    final best = fromAnchor == null ? device : (device > fromAnchor ? device : fromAnchor);
    return DateTime.fromMillisecondsSinceEpoch(best);
  }

  /// يسجّل وقتًا موثوقًا من الخادم. يُرفَع فقط إلى الأمام.
  ///
  /// التراجع مرفوض: خادم يجيب بوقت أقدم (كاش، أو ردّ قديم وصل متأخّرًا) لا يجوز
  /// أن يُرخي ما ثبت.
  Future<void> recordTrustedTime(DateTime moment) async {
    final value = moment.millisecondsSinceEpoch;
    final stored = await _readInt(_trustedTimeKey) ?? 0;
    final highest = value > stored ? value : stored;
    if (highest > stored) await _write(_trustedTimeKey, highest.toString());
    if (_anchorTrustedMs == null || highest > _anchorTrustedMs!) {
      _anchorTrustedMs = highest;
      _sinceAnchor
        ..reset()
        ..start();
    }
  }

  /// يسجّل أن الخادم أكّد التراخيص الآن (`ENC-010`).
  ///
  /// يُستدعى بعد كل مصالحة ناجحة مع الخادم، وهو ما يُصفّر نافذة إعادة التحقّق.
  Future<void> recordVerification(DateTime moment) async {
    await recordTrustedTime(moment);
    final value = moment.millisecondsSinceEpoch;
    final stored = await _readInt(_verifiedAtKey) ?? 0;
    if (value > stored) await _write(_verifiedAtKey, value.toString());
  }

  /// آخر تأكيد خادمي معروف، أو `null` إن لم يحدث أي تأكيد بعد.
  Future<DateTime?> lastVerification() async {
    final stored = await _readInt(_verifiedAtKey);
    return stored == null ? null : DateTime.fromMillisecondsSinceEpoch(stored);
  }

  /// ينسى ترخيصًا أُبطل خادميًّا.
  ///
  /// لا يُحذف الملف: الحزمة المشفَّرة بلا ترخيص لا تُفَك، وحذفها يُهدر بيانات
  /// الأسرة إن كان الإبطال خطأً يُصحَّح بتنزيل ترخيص جديد.
  Future<void> revokeLocally(String downloadId) => forget(downloadId);

  /// يستعيد العلامة المحفوظة عند بدء التطبيق.
  Future<void> restoreTrustedTime() async {
    final stored = await _readInt(_trustedTimeKey);
    if (stored == null) return;
    _anchorTrustedMs = stored;
    _sinceAnchor
      ..reset()
      ..start();
  }

  /// يحفظ ترخيصًا لعنصر تنزيل. يرفع عدّاد الحالة.
  ///
  /// الترخيص يُخزَّن **كما وصل**: التوقيع على البايتات، فأي إعادة تركيب للحقول
  /// كانت ستُبطله. والتخزين الآمن لا `shared_preferences`: الأخير ملف عادي.
  Future<void> store(String downloadId, String token) async {
    final counter = (await _readInt(_counterKey) ?? 0) + 1;
    await _write('$_licensePrefix$downloadId', jsonEncode({'token': token, 'counter': counter}));
    await _write(_counterKey, counter.toString());
  }

  Future<void> forget(String downloadId) async {
    try {
      await _storage.delete(key: '$_licensePrefix$downloadId');
    } catch (_) {
      // غياب المفتاح ليس خطأً؛ وفشل المخزن يظهر في مسار التشغيل نفسه.
    }
  }

  /// معرّف الترخيص المحفوظ لعنصر، بلا تحقّق من التوقيع.
  ///
  /// للمصالحة مع الخادم وحدها: السؤال هناك «هل هذا الترخيص ما زال نشطًا؟»، وهو
  /// سؤال عن معرّف لا عن صلاحية. التحقّق الكامل يبقى في [authorize].
  Future<String?> licenceIdFor(String downloadId) async {
    final raw = await _read('$_licensePrefix$downloadId');
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      final token = decoded['token'];
      if (token is! String) return null;
      final payload = token.split('.').first;
      final normalized = payload.replaceAll('-', '+').replaceAll('_', '/');
      final json = jsonDecode(utf8.decode(
        base64Decode(normalized.padRight((normalized.length + 3) & ~3, '=')),
      ));
      final id = json is Map ? json['lic'] : null;
      return id is String ? id : null;
    } catch (_) {
      return null;
    }
  }

  /// القرار: هل يُشغَّل هذا العنصر المحفوظ الآن؟
  ///
  /// [expectedChildId] و[expectedDeviceId] و[expectedAuthEpoch] من الجلسة
  /// الحاضرة. مطابقتها هي ما يجعل نسخ ملف بين ملفَي طفل أو بين جهازين بلا قيمة،
  /// وما يجعل إبطال أي جهاز (الذي يرفع العهد) يُبطل ما على الأجهزة كلها.
  Future<OfflineLicenseClaims> authorize(
    String downloadId, {
    required String expectedEntityType,
    required String expectedEntityId,
    String? expectedChildId,
    String? expectedDeviceId,
    int? expectedAuthEpoch,
  }) async {
    final raw = await _read('$_licensePrefix$downloadId');
    if (raw == null || raw.isEmpty) {
      throw const LicenseException(LicenseRejection.malformed);
    }

    Map<String, Object?> stored;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) throw const FormatException('not an object');
      stored = Map<String, Object?>.from(decoded);
    } catch (_) {
      throw const LicenseException(LicenseRejection.malformed);
    }

    final token = stored['token'];
    final counter = stored['counter'];
    if (token is! String || counter is! int) {
      throw const LicenseException(LicenseRejection.malformed);
    }
    // تراجع الحالة: نسخة أقدم من الملف تحمل عدّادًا أقلّ.
    final highest = await _readInt(_counterKey) ?? 0;
    if (counter < highest) {
      throw const LicenseException(LicenseRejection.contextMismatch);
    }

    final claims = await _verifier.verify(token);

    if (claims.entityType != expectedEntityType || claims.entityId != expectedEntityId) {
      throw const LicenseException(LicenseRejection.contextMismatch);
    }
    if (expectedChildId != null && claims.childId != expectedChildId) {
      throw const LicenseException(LicenseRejection.contextMismatch);
    }
    if (expectedDeviceId != null && claims.deviceId != expectedDeviceId) {
      throw const LicenseException(LicenseRejection.contextMismatch);
    }
    if (expectedAuthEpoch != null && claims.authEpoch != expectedAuthEpoch) {
      // عهد أقدم = جهاز سُحب أو رمز وليّ أمر تغيّر بعد الإصدار.
      throw const LicenseException(LicenseRejection.contextMismatch);
    }

    // الإصدار نفسه علامة وقت موثوقة: الخادم وقّعه، فلا يمكن أن يكون الآن قبله.
    await recordTrustedTime(DateTime.fromMillisecondsSinceEpoch(claims.issuedAtMs));
    final now = trustedNow().millisecondsSinceEpoch;
    if (now >= claims.expiresAtMs) {
      throw const LicenseException(LicenseRejection.expired);
    }

    // ENC-010: إعادة تحقّق دورية إلزامية. بلا هذا كان جهاز مسروق يواصل تشغيل ما
    // نزّله ثلاثين يومًا كاملة بلا اتصال واحد، وسحبه من اللوحة بلا أثر عليه.
    // آخر تأكيد يُقاس من الإصدار حين لم يحدث تأكيد بعده: الإصدار نفسه اتصال.
    final verifiedAt = (await lastVerification())?.millisecondsSinceEpoch ?? claims.issuedAtMs;
    if (now - verifiedAt > maxOfflineGap.inMilliseconds) {
      throw const LicenseException(LicenseRejection.staleVerification);
    }
    return claims;
  }

  Future<String?> _read(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      // فشل المخزن يُقرأ «لا ترخيص»: الاتجاه الآمن هو المنع لا السماح.
      return null;
    }
  }

  Future<int?> _readInt(String key) async {
    final value = await _read(key);
    return value == null ? null : int.tryParse(value);
  }

  Future<void> _write(String key, String value) async {
    await _storage.write(key: key, value: value);
  }
}
