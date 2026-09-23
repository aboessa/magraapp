import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../core/diagnostics/ignored_errors.dart';
import '../../../core/failures/secure_storage_failure.dart';
import 'pin_kdf.dart';

/// Outcome of a parent PIN verification attempt.
enum ParentPinResult {
  /// The PIN matched the stored verifier.
  success,

  /// The PIN did not match. [ParentPinVerification.attemptsRemaining] tells the
  /// caller how many tries are left before a lockout begins.
  wrongPin,

  /// Too many consecutive failures. Retry after
  /// [ParentPinVerification.lockedUntil].
  lockedOut,

  /// No PIN has been enrolled on this device yet.
  notEnrolled,
}

class ParentPinVerification {
  const ParentPinVerification(
    this.result, {
    this.attemptsRemaining = 0,
    this.lockedUntil,
  });

  final ParentPinResult result;
  final int attemptsRemaining;
  final DateTime? lockedUntil;

  bool get isSuccess => result == ParentPinResult.success;
}

/// Local-only parent PIN gate.
///
/// ## Why this exists and what it is *not*
///
/// The product documentation (`التصاريح والادوار والمستخدمين .md`) requires the
/// parent gate to be verified **server side**, and the Majarra API has no PIN
/// endpoint and no PIN column today — verified against every route in
/// `dashboard/api/src`. Until that exists, this class provides the strongest
/// behaviour achievable on the client alone:
///
/// * The PIN is never stored. Only a PBKDF2-HMAC-SHA256 verifier and a random
///   per-device salt are persisted, inside `flutter_secure_storage`
///   (Keychain / EncryptedSharedPreferences).
/// * Comparison is constant time, so a wrong PIN leaks no timing information.
/// * Consecutive failures are rate limited with a lockout, which is the only
///   meaningful brake on guessing a 4–6 digit secret.
///
/// ## Honest limitation — do not treat this as a security boundary
///
/// A 4–6 digit PIN has at most 10^6 possibilities. Anyone who can read this
/// device's secure storage can brute force the verifier offline regardless of
/// iteration count. This gate stops a **child** wandering into the parent area.
/// It does not stop an attacker, and it must not gate entitlements, billing,
/// content permissions, or any decision with a server-side consequence.
///
/// ## Server boundary
///
/// This verifier is only a convenience for child-facing locks. Parental API
/// actions use a separate, signed `parent_proof` issued after the server verifies
/// the PIN. That proof is bound to the family session, auth epoch, PIN version,
/// purpose and expiry; destructive-purpose JTIs are consumed once by
/// `FamilyState`. Flutter keeps it in memory only and clears it on background,
/// logout, refresh failure and PIN change.
class ParentPinStore {
  ParentPinStore({FlutterSecureStorage? storage})
    : _store = storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
            iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
          );

  /// قراءة تُعيد `null` عند الفشل وتسجّله (`APP-106`).
  ///
  /// `null` هنا يعني «لا رمز مُسجَّل»، وهو ما يفتح مسار **تسجيل رمز جديد**. فشل
  /// قراءة مكتوم كان يُقرَأ كذلك: أسرة لها رمز تُدعى إلى إنشاء واحد جديد، وهو
  /// أسوأ من رفض واضح. التسجيل يجعل الحالة مرئية، وعدّاد `keystoreUnavailable`
  /// يمنع تفسيرها خطأً.
  Future<String?> _safeRead(String key) async {
    try {
      return await _store.read(key: key);
    } catch (error, stack) {
      _readFailed = true;
      reportIgnoredError('parent_pin_store.read', error, stack);
      return null;
    }
  }

  /// كتابة **ترفع** عند الفشل.
  ///
  /// كتابة الرمز أو عدّاد الإخفاقات أو وقت القفل: فشلها مكتومًا يعني رمزًا يظنّ
  /// وليّ الأمر أنه سُجِّل ولم يُسجَّل، أو قفلًا بعد محاولات خاطئة لا يُطبَّق —
  /// أي إبطال حاجز أمني بصمت.
  Future<void> _safeWrite(String key, String value) async {
    try {
      await _store.write(key: key, value: value);
    } catch (error) {
      throw SecureStorageUnavailableException('parent_pin_store.write', error);
    }
  }

  Future<void> _safeDelete(String key) async {
    try {
      await _store.delete(key: key);
    } catch (error) {
      reportIgnoredError('parent_pin_store.delete', error);
    }
  }

  bool _readFailed = false;

  /// هل فشلت قراءة من المخزن الآمن في هذه الجلسة؟
  bool get keystoreUnavailable => _readFailed;

  static const _ownerKey = 'majarra_parent_pin_owner';
  static const _saltKey = 'majarra_parent_pin_salt';
  static const _verifierKey = 'majarra_parent_pin_verifier';
  static const _failuresKey = 'majarra_parent_pin_failures';
  static const _lockedUntilKey = 'majarra_parent_pin_locked_until';
  static const _biometricKey = 'majarra_parent_biometric_enabled';

  static const minPinLength = PinKdf.minPinLength;
  static const maxPinLength = PinKdf.maxPinLength;
  static const maxAttemptsBeforeLockout = 5;
  static const lockoutDuration = Duration(minutes: 15);

  final FlutterSecureStorage _store;

  /// Returns an Arabic description of why [pin] is unacceptable, or null when
  /// the PIN satisfies policy.
  static String? validatePin(String pin) => PinKdf.validatePin(pin);

  Future<bool> hasPin({String? ownerId}) async {
    final verifier = await _safeRead(_verifierKey);
    final salt = await _safeRead(_saltKey);
    final owner = await _safeRead(_ownerKey);
    final ownerMatches =
        ownerId == null ||
        ownerId.isEmpty ||
        (owner != null && owner == ownerId);
    return ownerMatches &&
        verifier != null &&
        verifier.isNotEmpty &&
        salt != null &&
        salt.isNotEmpty;
  }

  /// Enrols [pin]. Throws [ArgumentError] when the PIN fails policy so callers
  /// cannot silently persist a weak value.
  Future<void> setPin(String pin, {String? ownerId}) async {
    final problem = validatePin(pin);
    if (problem != null) throw ArgumentError(problem);

    final salt = PinKdf.randomSalt();
    // ‏`Async` لا `deriveVerifier`: النسخة التزامنية حلقة Dart خالصة بمئة ألف
    // تكرارة تحجز خيط الواجهة — قِسنا 2.75 ثانية تجمّدًا على الويب بعد إدخال
    // الرمز. والمُخرَج متطابق بايتًا ببايت (مُثبَت في `pin_kdf_test.dart`)،
    // فلا يُبطل هذا التبديل أي مُتحقِّق مخزون على جهازٍ سُجِّل قبله.
    final verifier = await PinKdf.deriveVerifierAsync(pin, salt);

    if (ownerId != null && ownerId.isNotEmpty) {
      await _safeWrite(_ownerKey, ownerId);
    }
    await _safeWrite(_saltKey, PinKdf.toHex(salt));
    await _safeWrite(_verifierKey, PinKdf.toHex(verifier));
    await _safeDelete(_failuresKey);
    await _safeDelete(_lockedUntilKey);
  }

  Future<ParentPinVerification> verify(String pin, {String? ownerId}) async {
    if (ownerId != null && ownerId.isNotEmpty) {
      final owner = await _safeRead(_ownerKey);
      if (owner != ownerId) {
        return const ParentPinVerification(ParentPinResult.notEnrolled);
      }
    }
    final lockedUntil = await _lockedUntil();
    if (lockedUntil != null) {
      return ParentPinVerification(
        ParentPinResult.lockedOut,
        lockedUntil: lockedUntil,
      );
    }

    final saltHex = await _safeRead(_saltKey);
    final verifierHex = await _safeRead(_verifierKey);
    if (saltHex == null || verifierHex == null) {
      return const ParentPinVerification(ParentPinResult.notEnrolled);
    }

    final expected = PinKdf.fromHex(verifierHex);
    // كذلك هنا: هذه الدالة تُستدعى من قفل المشغّل (`playback_page.dart`)، أي
    // من خيط الواجهة مباشرةً. النسخة التزامنية كانت تُجمّد الصورة أثناء
    // التحقّق.
    final actual = await PinKdf.deriveVerifierAsync(pin, PinKdf.fromHex(saltHex));

    if (PinKdf.constantTimeEquals(expected, actual)) {
      await _safeDelete(_failuresKey);
      await _safeDelete(_lockedUntilKey);
      return const ParentPinVerification(ParentPinResult.success);
    }

    final failures =
        (int.tryParse(await _safeRead(_failuresKey) ?? '') ?? 0) + 1;
    if (failures >= maxAttemptsBeforeLockout) {
      final until = DateTime.now().add(lockoutDuration);
      await _safeWrite(_lockedUntilKey, until.millisecondsSinceEpoch.toString());
      await _safeDelete(_failuresKey);
      return ParentPinVerification(
        ParentPinResult.lockedOut,
        lockedUntil: until,
      );
    }

    await _safeWrite(_failuresKey, failures.toString());
    return ParentPinVerification(
      ParentPinResult.wrongPin,
      attemptsRemaining: maxAttemptsBeforeLockout - failures,
    );
  }

  /// Whether the parent opted in to unlocking the local gate with biometrics.
  ///
  /// Opt-in is only offered after a successful PIN verification, so enabling
  /// this can never bypass the initial proof that the parent knows the PIN.
  Future<bool> isBiometricEnabled() async {
    return (await _safeRead(_biometricKey)) == 'true';
  }

  Future<void> setBiometricEnabled(bool enabled) async {
    if (enabled) {
      await _safeWrite(_biometricKey, 'true');
    } else {
      await _safeDelete(_biometricKey);
    }
  }

  /// Removes the enrolled PIN. Must be called on sign-out so a PIN from one
  /// account can never unlock another account's parent area.
  Future<void> clear() async {
    await _safeDelete(_ownerKey);
    await _safeDelete(_saltKey);
    await _safeDelete(_verifierKey);
    await _safeDelete(_failuresKey);
    await _safeDelete(_lockedUntilKey);
    await _safeDelete(_biometricKey);
  }

  Future<DateTime?> _lockedUntil() async {
    final raw = await _safeRead(_lockedUntilKey);
    if (raw == null) return null;
    final millis = int.tryParse(raw);
    if (millis == null) {
      await _safeDelete(_lockedUntilKey);
      return null;
    }
    final until = DateTime.fromMillisecondsSinceEpoch(millis);
    if (until.isAfter(DateTime.now())) return until;
    await _safeDelete(_lockedUntilKey);
    return null;
  }
}

/// Injectable so sign-out teardown can be exercised without a Keychain.
final parentPinStoreProvider = Provider<ParentPinStore>(
  (ref) => ParentPinStore(),
);
