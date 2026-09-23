import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/auth/data/pin_kdf.dart';

void main() {
  test('PBKDF2 test vectors from RFC 8018', () {
    // c=1 dkLen=32 P=password S=salt
    final dk1 = PinKdf.pbkdf2Sha256(password: 'password'.codeUnits, salt: 'salt'.codeUnits, iterations: 1, keyLengthBytes: 32);
    expect(PinKdf.toHex(dk1), '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
    // c=2
    final dk2 = PinKdf.pbkdf2Sha256(password: 'password'.codeUnits, salt: 'salt'.codeUnits, iterations: 2, keyLengthBytes: 32);
    expect(PinKdf.toHex(dk2), 'ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43');
    // c=4096
    final dk3 = PinKdf.pbkdf2Sha256(password: 'password'.codeUnits, salt: 'salt'.codeUnits, iterations: 4096, keyLengthBytes: 32);
    expect(PinKdf.toHex(dk3), 'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a');
  });

  test('PIN policy', () {
    expect(PinKdf.validatePin('123'), isNotNull); // too short
    expect(PinKdf.validatePin('1111'), isNotNull); // repeated
    expect(PinKdf.validatePin('1234'), isNotNull); // sequential
    expect(PinKdf.validatePin('1223'), isNull); // ok
    expect(PinKdf.validatePin('12a4'), isNotNull); // non-digit
  });

  test('constantTimeEquals', () {
    expect(PinKdf.constantTimeEquals([1, 2, 3], [1, 2, 3]), isTrue);
    expect(PinKdf.constantTimeEquals([1, 2, 3], [1, 2, 4]), isFalse);
    expect(PinKdf.constantTimeEquals([1, 2], [1, 2, 3]), isFalse);
  });

  // المسار غير المتزامن أُدخل لأن التنفيذ الخالص يحجز خيط الواجهة ثوانٍ.
  // وشرط قبوله الوحيد أن يكون **مكافئًا بايتًا ببايت**: أي فرق يعني أن كل
  // جهاز سُجِّل بالتنفيذ القديم يصير رمزه غير صالح فجأة. فالتكافؤ يُثبَت هنا
  // ولا يُفترَض.
  test('deriveVerifierAsync يُطابق deriveVerifier بايتًا ببايت', () async {
    // ملح ثابت لا عشوائي: نقارن تنفيذين، لا نختبر العشوائية.
    final salt = List<int>.generate(PinKdf.saltLengthBytes, (i) => i * 7 % 256);
    for (final pin in ['1223', '90210', '478215']) {
      final sync = PinKdf.deriveVerifier(pin, salt);
      final async = await PinKdf.deriveVerifierAsync(pin, salt);
      expect(
        PinKdf.toHex(async),
        PinKdf.toHex(sync),
        reason: 'اختلاف المُخرَج للرمز $pin يُبطل المُتحقِّقات المخزونة',
      );
      expect(async, hasLength(PinKdf.keyLengthBytes));
    }
  });

  test('deriveVerifierAsync يختلف باختلاف الملح', () async {
    final a = await PinKdf.deriveVerifierAsync('1223', List.filled(16, 1));
    final b = await PinKdf.deriveVerifierAsync('1223', List.filled(16, 2));
    expect(PinKdf.constantTimeEquals(a, b), isFalse);
  });
}
