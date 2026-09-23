/// Shared helpers — R2 remote → asset fallback، PNG transparent guard.
library;
import 'package:flutter/material.dart';

import '../../../../../core/env/app_environment.dart';
import '../../../../../core/images/heavy_assets.dart';
import '../../../../../core/images/remote_image_cache.dart';
import '../../../../../core/widgets/decode_cap.dart';
import '../../studio/studio_app_bar.dart';

/// `APP-103`: تعريفٌ ثالث للنطاق كان هنا. صار اسمًا واحدًا لمصدرٍ واحد.
const kR2Base = AppConfig.assetBaseUrl;

/// البديل الافتراضي: توأم R2 لـ`bird.png` (كان المسار المبندل نفسه).
///
/// `smartImage` يمرّر أيّ `http` عبر `RemoteImageCache`، فالبديل نفسه يُقرأ من
/// القرص بعد أوّل تحميل. والسقوط للمسار المبندل عند غياب التوأم.
String get _defaultBirdFallback =>
    heavyCdnUrl('assets/images/coloring/v2/bird.png') ??
    'assets/images/coloring/v2/bird.png';

/// بديل `bird.png` كنصّ جاهز للمواضع التي لا تستورد `heavy_assets.dart`.
String get birdFallbackCdnUrl => _defaultBirdFallback;

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
///
/// وفرع الشبكة يمرّ عبر `RemoteImageCache` (قرص بعد أوّل تحميل) لا
/// `Image.network` العاري: العاري يعيد التنزيل في كلّ جلسة ويتجاوز العميل
/// المثبَّت (`SEC-105`). على الويب لا قرص — يُرسَم عبر عنصر DOM مباشرة.
Widget smartImage(String? remoteOrAsset,
    {double w = 80, double h = 80, BoxFit fit = BoxFit.contain, String? fallbackAsset}) {
  final String fb = fallbackAsset ?? _defaultBirdFallback;
  return Builder(
    builder: (context) {
      final cap = decodeCapFor(context, w);
      if (remoteOrAsset == null) {
        return _SmartCachedImage(
          url: fb,
          bundledFallback: fb,
          w: w,
          h: h,
          fit: fit,
          cacheWidth: cap,
        );
      }
      if (remoteOrAsset.startsWith('http')) {
        return _SmartCachedImage(
          url: remoteOrAsset,
          bundledFallback: fb,
          w: w,
          h: h,
          fit: fit,
          cacheWidth: cap,
        );
      }
      return Image.asset(remoteOrAsset,
          width: w, height: h, fit: fit, cacheWidth: cap, errorBuilder: (_, __, ___) => _fallbackIcon(w, h));
    },
  );
}

/// صورة `smartImage` الشبكية: ملفّ مخزّن ← شبكة ← بديل مبندل ← أيقونة.
///
/// مستخرجة ويدجت لأنّ `Builder` أعلاه متزامن والبحث في القرص غير متزامن.
class _SmartCachedImage extends StatefulWidget {
  const _SmartCachedImage({
    required this.url,
    required this.bundledFallback,
    required this.w,
    required this.h,
    required this.fit,
    required this.cacheWidth,
  });

  final String url;
  final String bundledFallback;
  final double w;
  final double h;
  final BoxFit fit;
  final int? cacheWidth;

  @override
  State<_SmartCachedImage> createState() => _SmartCachedImageState();
}

class _SmartCachedImageState extends State<_SmartCachedImage> {
  String? _cachedPath;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _lookup();
  }

  @override
  void didUpdateWidget(_SmartCachedImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _cachedPath = null;
      _done = false;
      _lookup();
    }
  }

  Future<void> _lookup() async {
    if (!RemoteImageCache.isCacheableUrl(widget.url)) {
      if (mounted) setState(() => _done = true);
      return;
    }
    final hit = await RemoteImageCache().fetch(widget.url);
    if (!mounted) return;
    setState(() {
      _cachedPath = hit?.file.path;
      _done = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final fallback = widget.bundledFallback.startsWith('http')
        ? Image.network(
            widget.bundledFallback,
            width: widget.w,
            height: widget.h,
            fit: widget.fit,
            cacheWidth: widget.cacheWidth,
            errorBuilder: (_, __, ___) =>
                _fallbackIcon(widget.w, widget.h),
          )
        : Image.asset(
            widget.bundledFallback,
            width: widget.w,
            height: widget.h,
            fit: widget.fit,
            cacheWidth: widget.cacheWidth,
            errorBuilder: (_, __, ___) =>
                _fallbackIcon(widget.w, widget.h),
          );
    final path = _cachedPath;
    if (path != null) {
      return Image.asset(
        path,
        width: widget.w,
        height: widget.h,
        fit: widget.fit,
        cacheWidth: widget.cacheWidth,
        errorBuilder: (_, __, ___) => fallback,
      );
    }
    if (!_done) {
      return Image.network(
        widget.url,
        width: widget.w,
        height: widget.h,
        fit: widget.fit,
        cacheWidth: widget.cacheWidth,
        errorBuilder: (_, __, ___) => fallback,
      );
    }
    return fallback;
  }
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
