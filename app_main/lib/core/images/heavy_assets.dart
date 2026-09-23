/// مرجع الأصول الثقيلة بعد ترحيلها إلى R2: bundled-path ‏← CDN WebP.
///
/// ## لماذا ملفّ لا خريطة مبعثرة
///
/// 135 ملفًّا raster (‏49.8MB ‏← 5.5MB بتحويل WebP q82) رُفعت مفاتيحُها بصيغة
/// `public/catalog/assets/images/<rel>.webp` بسكربت `tools/upload_heavy_r2.mjs`.
/// ومواضع الاستعمال 16 ملفًّا كانت تكتب المسار المبندل حرفيًّا. فبدل 135 تعديلًا
/// مبعثرًا: دالّة واحدة تشتقّ الرابط من المسار، وكلّ موضع يستدعيها.
///
/// ## القاعدة
///
/// * raster (‏png/jpg‏) له توأم WebP على R2: يُشتقّ الرابط.
/// * غيره (‏svg/webp‏ مبندل، أو مسار خارج النطاق المُرحَّل): يُعاد كما هو —
///   الـSVG المتجهي (~60KB لـ111 ملفًّا) بقي مبندلًا عمدًا.
/// * لا نطاق حرفيًّا هنا: الأصل `AppConfig.assetBaseUrl` وحده.
library;

import '../env/app_environment.dart';

/// بادئات المجلّدات التي رُحِّلت raster-ملفّاتُها إلى R2.
///
/// `studio/` ليست هنا عمدًا: البطاقات chrome مبندل بلا توأم، واللافتات الستّ
/// لها بوابة اسمها الخاص (`heavyStudioBannerUrl`). بادئةٌ جارفة كانت ستعِد
/// بروابط لبطاقات لم تُرفَع — نفس فجوة `books/` قبل إصلاحها.
const _migratedPrefixes = [
  'assets/images/draw_like_me/',
  'assets/images/landing/',
  'assets/images/coloring/v2/',
  'assets/images/books/',
  'assets/images/connect_dots/',
  'assets/images/games/wave/',
  // فنّ الكتالوج (كواكب، مسلسلات، ألعاب، حلقات، استكشاف، موسمي): WebP مبندلة
  // أصلًا ورُفع توأمها المُعاد ترميزه (q82) بنفس المفتاح
  // (`tools/upload_catalog_r2.mjs`). تُشتقّ لها روابط لكنّ المبندل يبقى بديل
  // عدم الاتصال — الكتالوج المحزوم يَعِد بها دون شبكة.
  'assets/images/planets/',
  'assets/images/series/',
  'assets/images/games/',
  'assets/images/episodes/',
  'assets/images/explore/',
  'assets/images/seasonal/',
];

/// رابط CDN لـPNG لافتة استوديو، أو `null` لغير اللافتات.
///
/// اللافتات الستّ وحدها لها توأم مرفوع (`upload_studio_banners_r2.mjs`).
/// البطاقات (`card-*.webp`) والأيقونات chrome صغير مبندل — اشتقاق رابط لها
/// كان يعِد بما لم يُرفَع (نفس فجوة `books/` قبل إصلاحها). فالبوابة هنا
/// بالاسم لا بالبادئة.
///
/// والمدخلات PNG مبندلة سابقة — ليست مسارات تُرسَم: هي مفاتيح اشتقاق فقط.
/// لا تُرسم PNG مباشرةً في أيّ مكان؛ `assetPath` دائمًا الـwebp المبندل.
String? heavyStudioBannerUrl(String bundledPath) {
  const banners = {
    'assets/images/studio/coloring-banner.png',
    'assets/images/studio/connect-dots-banner.png',
    'assets/images/studio/draw-like-me-banner.png',
    'assets/images/studio/studio-main-banner.png',
    'assets/images/studio/homebgaart.png',
  };
  if (!banners.contains(bundledPath)) return null;
  final dot = bundledPath.lastIndexOf('.');
  final withoutExt = bundledPath.substring('assets/'.length, dot);
  // ignore: do_not_use_environment
  return '${AppConfig.assetBaseUrl}/public/catalog/assets/$withoutExt.webp';
}

/// رابط CDN للتوأم WebP، أو `null` حين لا توأم (SVG، خارج النطاق، فارغ).
///
/// التحويل هو نفسه ما طبّقه `upload_heavy_r2.mjs`: نفس المسار النسبي تحت
/// `public/catalog/`، والامتداد ‏`.webp` بدل الأصلي. يشمل `.webp` مصدرًا:
/// كتب `books/` مبندلة WebP أصلًا ورُفع توأمها المُعاد ترميزه (q82) بنفس
/// المفتاح. ليست خريطةً محفوظة لأنّ القاعدة منتظمة — وملفٌّ جديد يُرفَع
/// بالسكربت يعمل بلا تعديل هنا.
String? heavyCdnUrl(String bundledPath) {
  if (bundledPath.isEmpty) return null;
  final lower = bundledPath.toLowerCase();
  final isConvertible =
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp');
  if (!isConvertible) return null;
  if (!_migratedPrefixes.any(bundledPath.startsWith)) return null;
  final dot = bundledPath.lastIndexOf('.');
  // المسار كاملًا بعد `assets/` — بما فيه `images/` — لأنّ مفاتيح R2 تحفظ
  // البنية (`public/catalog/assets/images/...`) كما رفعها السكربت.
  final withoutExt = bundledPath.substring('assets/'.length, dot);
  // ignore: do_not_use_environment
  return '${AppConfig.assetBaseUrl}/public/catalog/assets/$withoutExt.webp';
}
