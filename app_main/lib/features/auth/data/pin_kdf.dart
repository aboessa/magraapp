import 'dart:math';

import 'package:crypto/crypto.dart';

/// Pure key-derivation and PIN-policy helpers.
///
/// Deliberately free of any Flutter dependency so it can be exercised by a
/// plain Dart VM test against published PBKDF2 test vectors. Platform storage
/// lives in `ParentPinStore`.
abstract final class PinKdf {
  /// Matches the API's password hashing cost so the two stay comparable.
  static const iterations = 100000;
  static const keyLengthBytes = 32;
  static const saltLengthBytes = 16;

  static const minPinLength = 4;
  static const maxPinLength = 6;

  /// PBKDF2-HMAC-SHA256 (RFC 8018 §5.2).
  ///
  /// Verified against these published vectors (P="password", S="salt"), which
  /// should be promoted into a real unit test when the test suite is set up
  /// (AUDIT_FLUTTER_APP.md §9 H12):
  ///
  ///   c=1    dkLen=32 -> 120fb6cffcf8b32c43e7225256c4f837
  ///                      a86548c92ccc35480805987cb70be17b
  ///   c=2    dkLen=32 -> ae4d0c95af6b46d32d0adff928f06dd0
  ///                      2a303f8ef3c251dfd6e2d85a95474c43
  ///   c=4096 dkLen=32 -> c5e478d59288c841aa530db6845c4c8d
  ///                      962893a001ce4e11a4963873aa98134a
  ///   P="passwordPASSWORDpassword"
  ///   S="saltSALTsaltSALTsaltSALTsaltSALTsalt"
  ///   c=4096 dkLen=40 -> 348c89dbcbd32b2f32d814b8116e84cf2b17347e
  ///                      bc1800181c4e2a1fb8dd53e1c635518c7dac47e9
  static List<int> pbkdf2Sha256({
    required List<int> password,
    required List<int> salt,
    required int iterations,
    required int keyLengthBytes,
  }) {
    final hmac = Hmac(sha256, password);
    final output = <int>[];
    var blockIndex = 1;

    while (output.length < keyLengthBytes) {
      final seed = <int>[
        ...salt,
        (blockIndex >> 24) & 0xff,
        (blockIndex >> 16) & 0xff,
        (blockIndex >> 8) & 0xff,
        blockIndex & 0xff,
      ];

      var previous = hmac.convert(seed).bytes;
      final accumulator = List<int>.of(previous);

      for (var iteration = 1; iteration < iterations; iteration++) {
        previous = hmac.convert(previous).bytes;
        for (var i = 0; i < accumulator.length; i++) {
          accumulator[i] ^= previous[i];
        }
      }

      output.addAll(accumulator);
      blockIndex++;
    }

    return output.sublist(0, keyLengthBytes);
  }

  /// Derives the stored verifier for [pin] using [salt].
  static List<int> deriveVerifier(String pin, List<int> salt) {
    return pbkdf2Sha256(
      password: pin.codeUnits,
      salt: salt,
      iterations: iterations,
      keyLengthBytes: keyLengthBytes,
    );
  }

  static List<int> randomSalt() => randomBytes(saltLengthBytes);

  static List<int> randomBytes(int length) {
    final random = Random.secure();
    return List<int>.generate(length, (_) => random.nextInt(256));
  }

  /// Compares two byte lists without leaking length-of-match via timing.
  static bool constantTimeEquals(List<int> a, List<int> b) {
    if (a.length != b.length) return false;
    var difference = 0;
    for (var i = 0; i < a.length; i++) {
      difference |= a[i] ^ b[i];
    }
    return difference == 0;
  }

  static String toHex(List<int> bytes) {
    final buffer = StringBuffer();
    for (final byte in bytes) {
      buffer.write(byte.toRadixString(16).padLeft(2, '0'));
    }
    return buffer.toString();
  }

  static List<int> fromHex(String value) {
    final bytes = <int>[];
    for (var i = 0; i + 1 < value.length; i += 2) {
      bytes.add(int.parse(value.substring(i, i + 2), radix: 16));
    }
    return bytes;
  }

  /// Returns an Arabic description of why [pin] is unacceptable, or null when
  /// the PIN satisfies policy.
  static String? validatePin(String pin) {
    if (pin.length < minPinLength || pin.length > maxPinLength) {
      return 'الرمز من $minPinLength إلى $maxPinLength أرقام';
    }
    if (!RegExp(r'^\d+$').hasMatch(pin)) {
      return 'الرمز أرقام فقط';
    }
    if (RegExp(r'^(\d)\1*$').hasMatch(pin)) {
      return 'لا تستخدم رقمًا مكرّرًا';
    }
    if (_isSequential(pin)) {
      return 'لا تستخدم أرقامًا متتالية';
    }
    return null;
  }

  static bool _isSequential(String pin) {
    var ascending = true;
    var descending = true;
    for (var i = 1; i < pin.length; i++) {
      final delta = pin.codeUnitAt(i) - pin.codeUnitAt(i - 1);
      if (delta != 1) ascending = false;
      if (delta != -1) descending = false;
    }
    return ascending || descending;
  }
}
