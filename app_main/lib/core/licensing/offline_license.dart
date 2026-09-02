import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// ENC-005 — الترخيص الموقَّع كما يقرؤه التطبيق.
///
/// ## ما كان
///
/// لا ترخيص إطلاقًا. مدة الثلاثين يومًا ثابتة في `download_manager.dart`،
/// وتاريخ الانتهاء يُحسب على الجهاز، ويُخزَّن في `shared_preferences` كنصّ JSON،
/// ويُقارن بـ`DateTime.now()`. أي أن الجهاز هو السلطة على صلاحيته الخاصة:
///
///   * تأخير ساعة الجهاز يمدّد الصلاحية بلا حدّ.
///   * تحرير `expires_at` في ملف XML/plist عادي يجعل الترخيص أبديًّا.
///   * استعادة نسخة أقدم من الميتاداتا تُعيد ترخيصًا انتهى.
///
/// ## الآن
///
/// الخادم يوقّع الترخيص بـEd25519 (`ENC-001`)، والتطبيق يتحقّق منه بمفتاح عام
/// قبل كل تشغيل. تحرير أي حقل — والانتهاء أوّلها — يُفشل التوقيع، فلا يُشغَّل
/// المحتوى.
///
/// ## المفاتيح العامة تأتي من البناء لا من المصدر
///
/// [OfflineLicenseVerifier.fromEnvironment] يقرأ
/// `--dart-define=OFFLINE_LICENSE_PUBLIC_KEYS=kid:base64,kid2:base64`. سببان:
///
///   1. **مفتاح مكتوب في المصدر يُشحن كما هو.** بناء إنتاج يحمل مفتاح تطوير —
///      نصفه الخاص في ملف على جهاز مطوّر — يعني أن من يملك ذلك الملف يكتب
///      تراخيص مقبولة في الإنتاج.
///   2. **التدوير يحتاج مفتاحين معًا.** الخريطة تقبل عدّة مفاتيح بمعرّفاتها،
///      فالتراخيص القائمة تبقى قابلة للتحقّق حتى تنتهي مدتها بينما يُوقَّع
///      الجديد بالمفتاح الجديد.
///
/// وغياب المفاتيح **يُفشل** التحقّق ولا يتجاوزه: ترخيص غير متحقَّق منه لا قيمة
/// له، وقبوله لغياب الإعداد يُعيد الحالة التي كان الجهاز فيها سلطةً على نفسه.

/// سبب رفض ترخيص. أنواع مسمّاة لا نصّ حرّ: كل سبب هنا يستدعي إجراءً مختلفًا في
/// الواجهة (تحديث تطبيق، إعادة تنزيل، اتصال بالشبكة).
enum LicenseRejection {
  /// لا مفاتيح عامة في هذا البناء (`--dart-define` ناقص).
  notConfigured,

  /// الشكل غير صالح: ليس `payload.signature` أو ليس JSON.
  malformed,

  /// معرّف مفتاح لا نعرفه — الأرجح تطبيق أقدم من تدوير المفتاح.
  unknownKey,

  /// التوقيع لا يطابق. تحرير أي حقل يقع هنا.
  badSignature,

  /// الترخيص لمحتوى أو طفل أو جهاز أو عهد مصادقة آخر.
  contextMismatch,

  /// انتهت مدته وفق أفضل وقت موثوق متاح.
  expired,

  /// الترخيص صالح لكن مضى على آخر تأكيد خادمي أكثر من النافذة المسموحة
  /// (`ENC-010`). إجراؤه اتصال واحد، لا إعادة تنزيل ولا تحديث.
  staleVerification,
}

class LicenseException implements Exception {
  const LicenseException(this.rejection);

  final LicenseRejection rejection;

  /// رسالة للعرض. لا تذكر توقيعًا ولا مفتاحًا: ما يفيد وليّ الأمر هو الإجراء.
  String get message {
    switch (rejection) {
      case LicenseRejection.notConfigured:
      case LicenseRejection.unknownKey:
        return 'هذه النسخة من التطبيق لا تستطيع التحقّق من صلاحية المحتوى المحفوظ. حدّث التطبيق.';
      case LicenseRejection.malformed:
      case LicenseRejection.badSignature:
      case LicenseRejection.contextMismatch:
        return 'المحتوى المحفوظ غير صالح على هذا الجهاز. أعد تنزيله.';
      case LicenseRejection.expired:
        return 'انتهت صلاحية هذا المحتوى المحفوظ. اتصل بالإنترنت لتجديدها.';
      case LicenseRejection.staleVerification:
        return 'اتصل بالإنترنت مرة واحدة لتأكيد المحتوى المحفوظ، ثم تابع دون إنترنت.';
    }
  }

  @override
  String toString() => 'LicenseException(${rejection.name})';
}

/// حقول الترخيص. أسماؤها كما يُصدرها الخادم (`lib/offlineLicense.ts`).
class OfflineLicenseClaims {
  const OfflineLicenseClaims({
    required this.licenseId,
    required this.parentId,
    required this.childId,
    required this.deviceId,
    required this.authEpoch,
    required this.entityType,
    required this.entityId,
    required this.contentVersion,
    required this.rights,
    required this.plan,
    required this.assets,
    required this.issuedAtMs,
    required this.expiresAtMs,
    required this.keyId,
  });

  final String licenseId;
  final String parentId;
  final String childId;
  final String deviceId;
  final int authEpoch;
  final String entityType;
  final String entityId;
  final int contentVersion;
  final String rights;
  final String plan;
  final List<OfflineLicenseAsset> assets;
  final int issuedAtMs;
  final int expiresAtMs;
  final String keyId;

  static OfflineLicenseClaims? tryParse(Map<String, Object?> json) {
    final lic = json['lic'];
    final sub = json['sub'];
    final cid = json['cid'];
    final did = json['did'];
    final epoch = json['epoch'];
    final entityType = json['entity_type'];
    final entityId = json['entity_id'];
    final version = json['ver'];
    final iat = json['iat'];
    final exp = json['exp'];
    final kid = json['kid'];
    if (json['typ'] != 'offline_license'
        || lic is! String || sub is! String || cid is! String || did is! String
        || epoch is! int || entityType is! String || entityId is! String
        || version is! int || iat is! int || exp is! int || kid is! String) {
      return null;
    }
    final rawAssets = json['assets'];
    final assets = <OfflineLicenseAsset>[];
    if (rawAssets is List) {
      for (final entry in rawAssets) {
        if (entry is Map) {
          final id = entry['id'];
          if (id is String) {
            assets.add(OfflineLicenseAsset(
              id: id,
              sha256: entry['sha256'] is String ? entry['sha256'] as String : null,
              bytes: entry['bytes'] is int ? entry['bytes'] as int : null,
            ));
          }
        }
      }
    }
    return OfflineLicenseClaims(
      licenseId: lic,
      parentId: sub,
      childId: cid,
      deviceId: did,
      authEpoch: epoch,
      entityType: entityType,
      entityId: entityId,
      contentVersion: version,
      rights: json['rights'] is String ? json['rights'] as String : 'offline_playback',
      plan: json['plan'] is String ? json['plan'] as String : 'family',
      assets: assets,
      // الخادم يُصدرها بالثواني كبقية توكناته؛ التطبيق يعمل بالمللي ثانية.
      issuedAtMs: iat * 1000,
      expiresAtMs: exp * 1000,
      keyId: kid,
    );
  }
}

class OfflineLicenseAsset {
  const OfflineLicenseAsset({required this.id, this.sha256, this.bytes});

  final String id;

  /// بصمة المصدر كما يعرفها الخادم (`ENC-007`). `null` تعني «لم تُحسب»، وهي
  /// مختلفة عن «لا تطابق»: الأولى تُقبل والثانية تُرفض.
  final String? sha256;
  final int? bytes;
}

/// يتحقّق من تراخيص موقَّعة بمفاتيح عامة مُمرَّرة وقت البناء.
class OfflineLicenseVerifier {
  OfflineLicenseVerifier(this.publicKeysByKeyId);

  /// `kid` → المفتاح العام. تُقبل صيغتان: SPKI بترميز base64 كما يطبعه
  /// `tools/ops/offline-license-public-key.mjs`، أو 32 بايتًا خامًّا.
  final Map<String, String> publicKeysByKeyId;

  static const _rawKeys = String.fromEnvironment('OFFLINE_LICENSE_PUBLIC_KEYS');

  /// يبني المتحقّق من `--dart-define`. خريطة فارغة تعني «غير مُهيَّأ»، ورفضًا.
  factory OfflineLicenseVerifier.fromEnvironment() {
    final keys = <String, String>{};
    for (final entry in _rawKeys.split(',')) {
      final trimmed = entry.trim();
      if (trimmed.isEmpty) continue;
      final separator = trimmed.indexOf(':');
      if (separator <= 0) continue;
      keys[trimmed.substring(0, separator).trim()] = trimmed.substring(separator + 1).trim();
    }
    return OfflineLicenseVerifier(keys);
  }

  bool get isConfigured => publicKeysByKeyId.isNotEmpty;

  final Ed25519 _algorithm = Ed25519();

  /// يتحقّق من [token] ويعيد حقوله.
  ///
  /// يرفع [LicenseException] لا يعيد `null`: كل سبب رفض يستدعي إجراءً مختلفًا،
  /// و`null` واحدة كانت ستُجبر المتصل على عرض رسالة واحدة لكل الأسباب.
  Future<OfflineLicenseClaims> verify(String token) async {
    if (!isConfigured) throw const LicenseException(LicenseRejection.notConfigured);

    final parts = token.split('.');
    if (parts.length != 2) throw const LicenseException(LicenseRejection.malformed);

    final Uint8List payload;
    final Uint8List signature;
    try {
      payload = _decodeBase64Url(parts[0]);
      signature = _decodeBase64Url(parts[1]);
    } catch (_) {
      throw const LicenseException(LicenseRejection.malformed);
    }

    Map<String, Object?> json;
    try {
      final decoded = jsonDecode(utf8.decode(payload));
      if (decoded is! Map) throw const FormatException('not an object');
      json = Map<String, Object?>.from(decoded);
    } catch (_) {
      throw const LicenseException(LicenseRejection.malformed);
    }

    final claims = OfflineLicenseClaims.tryParse(json);
    if (claims == null) throw const LicenseException(LicenseRejection.malformed);

    final encodedKey = publicKeysByKeyId[claims.keyId];
    // معرّف مفتاح مجهول ليس فشل توقيع: تطبيق أقدم من التدوير، وإجراؤه تحديث لا
    // إعادة تنزيل.
    if (encodedKey == null) throw const LicenseException(LicenseRejection.unknownKey);

    final Uint8List keyBytes;
    try {
      keyBytes = _rawPublicKey(encodedKey);
    } catch (_) {
      throw const LicenseException(LicenseRejection.notConfigured);
    }

    final valid = await _algorithm.verify(
      payload,
      signature: Signature(
        signature,
        publicKey: SimplePublicKey(keyBytes, type: KeyPairType.ed25519),
      ),
    );
    if (!valid) throw const LicenseException(LicenseRejection.badSignature);
    return claims;
  }

  /// يستخرج 32 بايت المفتاح من SPKI أو يقبلها خامًّا.
  ///
  /// SPKI لمفتاح Ed25519 طوله 44 بايتًا: ترويسة 12 بايتًا ثم المفتاح. قبول
  /// الصيغتين يعني أن مخرج أداة العمليات يُلصَق كما هو بلا تحويل يدوي —
  /// والتحويل اليدوي هو ما يُنتج مفتاحًا مقطوعًا يفشل التحقّق بلا سبب ظاهر.
  static Uint8List _rawPublicKey(String encoded) {
    final bytes = base64Decode(encoded.trim());
    if (bytes.length == 32) return Uint8List.fromList(bytes);
    if (bytes.length == 44) return Uint8List.fromList(bytes.sublist(12));
    throw const FormatException('Unexpected public key length');
  }

  static Uint8List _decodeBase64Url(String value) {
    final normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    final padded = normalized.padRight((normalized.length + 3) & ~3, '=');
    return Uint8List.fromList(base64Decode(padded));
  }
}
