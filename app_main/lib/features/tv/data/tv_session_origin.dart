import 'package:shared_preferences/shared_preferences.dart';

/// TV-005: how the session on this television was created.
///
/// A TV updated from an older build kept whatever session it had (a demo login,
/// an email login from before pairing existed), so it never showed the pairing
/// QR and opened straight into the family, where a stray press reached the
/// parent PIN screen. A television session is now valid only if this device
/// recorded how it was made; anything else is signed out once at start-up and
/// the TV shows its pairing code.
class TvSessionOrigin {
  static const _key = 'majarra_tv_session_origin';
  static const pairing = 'tv_pairing';
  static const email = 'tv_email';

  static Future<void> record(String origin) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, origin);
  }

  static Future<bool> isKnown() async {
    final prefs = await SharedPreferences.getInstance();
    final value = prefs.getString(_key);
    return value == pairing || value == email;
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
