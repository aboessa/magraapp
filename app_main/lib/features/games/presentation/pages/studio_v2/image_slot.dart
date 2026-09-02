/// Shared helpers — R2 remote → asset fallback، PNG transparent guard.
library;
import 'package:flutter/material.dart';

import '../../../../../core/env/app_environment.dart';
import '../../../../../core/widgets/decode_cap.dart';
import '../../studio/studio_app_bar.dart';

/// `APP-103`: تعريفٌ ثالث للنطاق كان هنا. صار اسمًا واحدًا لمصدرٍ واحد.
const kR2Base = AppConfig.assetBaseUrl;

Widget _fallbackIcon(double w, double h) => Container(
      width: w,
      height: h,
      decoration: BoxDecoration(color: const Color(0xFF1A1840), borderRadius: BorderRadius.circular(12)),
      child: const Icon(Icons.palette_rounded, color: Colors.white24, size: 28),
    );

/// `PERF-102`: `w`/`h` تخطيطٌ لا فكّ ترميز. و`Builder` هنا ليس تزيينًا: الدالّة
/// بلا `BuildContext`، وسقفُ الفكّ يحتاج `devicePixelRatio` الحقيقي — وتغليفُها
/// أرخص من تمرير سياقٍ إلى كل منادٍ. وحين يكون الحوض `infinity` (خلفية ممتدّة)
/// يعود السقف `null`، وهو الجواب الصحيح لا رقمٌ مُخترَع.
Widget smartImage(String? remoteOrAsset,
    {double w = 80, double h = 80, BoxFit fit = BoxFit.contain, String? fallbackAsset}) {
  final String fb = fallbackAsset ?? 'assets/images/coloring/v2/bird.png';
  return Builder(
    builder: (context) {
      final cap = decodeCapFor(context, w);
      if (remoteOrAsset == null) {
        return Image.asset(fb,
            width: w,
            height: h,
            fit: fit,
            cacheWidth: cap,
            errorBuilder: (_, __, ___) => _fallbackIcon(w, h));
      }
      if (remoteOrAsset.startsWith('http')) {
        return Image.network(remoteOrAsset,
            width: w, height: h, fit: fit, cacheWidth: cap, errorBuilder: (_, __, ___) => Image.asset(fb, width: w, height: h, fit: fit, cacheWidth: cap, errorBuilder: (_, __, ___) => _fallbackIcon(w, h)));
      }
      return Image.asset(remoteOrAsset,
          width: w, height: h, fit: fit, cacheWidth: cap, errorBuilder: (_, __, ___) => _fallbackIcon(w, h));
    },
  );
}

const kDeep = Color(0xFF0C1030);
const kPurple = Color(0xFF6A3DF2);
const kGold = Color(0xFFFFD34D);
const kCyan = Color(0xFF6EE7FF);
const kGreen = Color(0xFF2EAC5A);

Widget goldPill(String text, {IconData icon = Icons.star_rounded}) => Container(
  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
  decoration: BoxDecoration(color: kDeep.withValues(alpha: 0.75), borderRadius: BorderRadius.circular(999), border: Border.all(color: Colors.white10)),
  child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 12, color: kGold), const SizedBox(width: 4), Text(text, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))]),
);

/// Kept as a function so the six `studio_v2` call sites do not have to change,
/// but the bar itself is now [StudioAppBar] — this used to be a fourth
/// independent copy of the studio bar, and it was the copy that hardcoded the
/// back arrow to point the wrong way under LTR.
PreferredSizeWidget deepAppBar(
  BuildContext ctx,
  String title, {
  List<Widget>? actions,
  IconData glyph = Icons.brush_rounded,
}) => StudioAppBar(
  title: title,
  glyph: glyph,
  actions: actions ?? const <Widget>[],
);
