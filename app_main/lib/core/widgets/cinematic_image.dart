import 'dart:io';

import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';
import '../images/remote_image_cache.dart';
import 'decode_cap.dart';

/// صورة سينمائية هجينة: شبكة عبر تخزين محلّي، وبديل مبندل.
///
/// ترتيب المصادر: ملفّ مخزّن محلّيًّا ← شبكة ← بديل مبندل. `Image.network` وحده
/// يُخبّئ في الذاكرة فقط، فكلّ صورة أُخرجت من الـAPK كانت ستُعاد تنزيلها في
/// كلّ جلسة. هذا العارض يقرأ `RemoteImageCache` أوّلًا: بعد أوّل تحميل لا
/// يغادر أيّ بايت الجهاز.
///
/// يُبقَى `Image.network` مسارَ التحميل الأوّل (لا `Image.file` مباشرةً بعد
/// الجلب) لسببين: على الويب يُرسَم عبر عنصر DOM فيتجاوز غياب بيانات CORS في
/// R2، و`frameBuilder` يمنح الظهور التدريجي 260ms. بعد نجاح الجلب يُستبدَل
/// بملفّ محلّي في البناء التالي.
class CinematicImage extends StatefulWidget {
  const CinematicImage({
    required this.assetPath,
    required this.semanticLabel,
    this.networkUrl,
    this.fit = BoxFit.cover,
    this.alignment = Alignment.center,
    this.decodeWidth,
    super.key,
  });

  final String assetPath;
  final String semanticLabel;
  final String? networkUrl;
  final BoxFit fit;
  final AlignmentGeometry alignment;

  /// Logical width the image will occupy. When provided, decoding is capped at
  /// this width in device pixels so a 1080p poster is not decoded at full size
  /// for a 148px card. Leave null when the slot size is unknown.
  final double? decodeWidth;

  @visibleForTesting
  static RemoteImageCache? testCache;

  @override
  State<CinematicImage> createState() => _CinematicImageState();
}

class _CinematicImageState extends State<CinematicImage> {
  /// النسخة المحلّية إن وُجدت. `null` تعني «اعرض من الشبكة» لا «لا صورة».
  ///
  /// كان معها علَمٌ ثانٍ `_lookupDone` يفرّق «انتهى البحث» عن «لم يبدأ»، وكان
  /// هو مصدر العطل: انتهاءُ البحث بلا ملفّ كان يُنهي المحاولة كلّها. وبعد أن
  /// صارت الشبكة هي حالة الغياب، لم يبقَ للعلَم ما يقرّره فحُذف.
  File? _cachedFile;

  bool get _hasSafeNetworkUrl {
    final uri = Uri.tryParse(widget.networkUrl ?? '');
    return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _lookupCache();
  }

  @override
  void didUpdateWidget(CinematicImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.networkUrl != widget.networkUrl) {
      _cachedFile = null;
      _lookupCache();
    }
  }

  Future<void> _lookupCache() async {
    final url = widget.networkUrl;
    // رابطٌ غير قابل للتخزين (مضيف آخر، أو امتداد مجهول): لا شيء يُسأل عنه
    // القرص، وتبقى `_cachedFile` فارغة فيُرسَم من الشبكة. ولا `setState` هنا:
    // لا حالة تغيّرت.
    if (!_hasSafeNetworkUrl || !RemoteImageCache.isCacheableUrl(url!)) return;
    final file = await (CinematicImage.testCache ?? RemoteImageCache())
        .fetch(url)
        .then((hit) => hit?.file);
    if (!mounted || file == null) return;
    // `fetch` تُعيد الملفّ سواء قُرئ من القرص أو نُزّل الآن: في الحالين هو
    // نسخة محلّية صالحة للعرض بلا شبكة في المرّة التالية.
    setState(() => _cachedFile = file);
  }

  @override
  Widget build(BuildContext context) {
    // Decode at display size rather than source size. This is the single largest
    // memory win on rail-heavy screens where dozens of posters are alive at once.
    final ratio = MediaQuery.devicePixelRatioOf(context);
    final cacheWidth = widget.decodeWidth == null
        ? null
        : (widget.decodeWidth! * ratio).round();

    // Story artwork and game covers are CDN-only to keep APK small, so
    // `assetPath` is often empty and the brand mark is the last resort.
    //
    // كان هذا فرعًا ثلاثيًّا طرفاه الأخيران **متطابقان** (شعار مجرة في الحالتين)،
    // فيقرأ كأنه يفرّق بين حالتين وهو لا يفرّق.
    final fallbackAssetPath = widget.assetPath.startsWith('assets/')
        ? widget.assetPath
        : 'assets/brand/majarra-logo.png';

    final fallback = Image.asset(
      fallbackAssetPath,
      fit: widget.fit,
      alignment: widget.alignment,
      cacheWidth: cacheWidth,
      filterQuality: FilterQuality.medium,
      errorBuilder: (context, error, stackTrace) => const _ImageFallback(),
    );

    Widget networkChild;
    if (_cachedFile != null) {
      // `ResizeImage` هو ما يفحصه `decode_cap_test.dart`: `cacheWidth` غير
      // صفريّة تلفّ المزوّد فيه. مسار `Image.file` يُبقي السقف تحت سيطرتنا.
      networkChild = Image.file(
        _cachedFile!,
        fit: widget.fit,
        alignment: widget.alignment,
        cacheWidth: cacheWidth,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => fallback,
        frameBuilder: (context, child, frame, syncLoaded) {
          if (syncLoaded || MediaQuery.disableAnimationsOf(context)) {
            return child;
          }
          return AnimatedOpacity(
            opacity: frame == null ? 0 : 1,
            duration: const Duration(milliseconds: 260),
            child: child,
          );
        },
      );
    } else if (_hasSafeNetworkUrl) {
      // لا ملفّ محلّي ورابطٌ صالح: **شبكة**، لا بديلًا مبندلًا.
      //
      // الشرط `_hasSafeNetworkUrl` هنا لا في الترتيب النهائي وحده: هذا الفرع
      // يُبنى **مباشرةً** لا تأجيلًا، فـ`widget.networkUrl!` تُنفَّذ حتى لو كان
      // الحارس أدناه سيرمي الناتج. (‏`search_page_test.dart` أوقع هذا بالضبط.)
      //
      // ## العطل الذي كان هنا
      //
      // كان الفرع `else if (!_lookupDone)` — أي أن الشبكة تُجرَّب في نافذة
      // البحث عن الملفّ وحدها، ثم `else` يرسم البديل المبندل. فـ«بحثتُ ولم أجد
      // ملفًّا» كانت تُقرأ «لا صورة»، وهي في الحقيقة «لم أصل إلى القرص».
      //
      // وأثره كامل على الويب: `RemoteImageCache._root()` يستدعي
      // `getApplicationSupportDirectory()`، ولا نظام ملفّات في المتصفّح، فترمي
      // و`fetch` تلتقط وتُعيد `null` (`remote_image_cache.dart:196-200`). فكل
      // صورة CDN على الويب كانت تنتهي إلى `assets/brand/majarra-logo.png` —
      // الشعار نفسه مكرّرًا في كل كارت — بينما الأندرويد سليم لأن القرص يعمل.
      //
      // ويشمل الأثر حالةً ثانية على كل المنصّات: `fetch` تُعيد `null` أيضًا
      // لأيّ رابط خارج `AppConfig.assetHost` (‏`isCacheableUrl`)، فصورةٌ صالحة
      // على مضيف آخر كانت تُستبدَل بالشعار بلا محاولة.
      //
      // وترتيب المصادر المُعلَن في رأس هذا الملف وفي `remote_image_cache.dart`
      // هو «قرص ← شبكة ← بديل مبندل». والكود كان ينفّذ «قرص ← بديل». فهذا
      // ليس تغييرًا في السياسة، بل تنفيذٌ لها.
      //
      // والبديل المبندل يبقى موجودًا، لكن عبر `errorBuilder` أدناه: يُرسَم حين
      // **تفشل الشبكة فعلًا**، لا حين نعجز عن قراءة القرص.
      networkChild = Image.network(
        widget.networkUrl!,
        // The public CDN is intentionally anonymous. On web, render
        // through a DOM image so absent R2 CORS metadata cannot turn a
        // valid public image into an XHR statusCode 0 failure.
        webHtmlElementStrategy: WebHtmlElementStrategy.prefer,
        fit: widget.fit,
        alignment: widget.alignment,
        cacheWidth: cacheWidth,
        filterQuality: FilterQuality.medium,
        errorBuilder: (context, error, stackTrace) => fallback,
        frameBuilder: (context, child, frame, syncLoaded) {
          if (syncLoaded || MediaQuery.disableAnimationsOf(context)) {
            return child;
          }
          return AnimatedOpacity(
            opacity: frame == null ? 0 : 1,
            duration: const Duration(milliseconds: 260),
            child: child,
          );
        },
      );
    } else {
      // لا رابط صالح إطلاقًا: البديل المبندل هو الصواب — لا شيء يُجلَب.
      networkChild = fallback;
    }

    return Semantics(
      image: true,
      label: widget.semanticLabel,
      child: ExcludeSemantics(
        child: RepaintBoundary(child: networkChild),
      ),
    );
  }
}

/// Retained for non-planet artwork which includes an embedded title.
class CroppedCinematicImage extends StatelessWidget {
  const CroppedCinematicImage({
    required this.assetPath,
    required this.semanticLabel,
    this.networkUrl,
    this.visibleFraction = 0.58,
    this.borderRadius = BorderRadius.zero,
    super.key,
  });

  final String assetPath;
  final String semanticLabel;
  final String? networkUrl;
  final double visibleFraction;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (!constraints.hasBoundedHeight || constraints.maxHeight <= 0) {
          return CinematicImage(
            assetPath: assetPath,
            networkUrl: networkUrl,
            semanticLabel: semanticLabel,
            fit: BoxFit.cover,
            alignment: Alignment.topCenter,
          );
        }

        final sourceHeight = constraints.maxHeight / visibleFraction;
        return SizedBox.expand(
          child: ClipRRect(
            borderRadius: borderRadius,
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned(
                  top: 0,
                  right: 0,
                  left: 0,
                  height: sourceHeight,
                  child: CinematicImage(
                    assetPath: assetPath,
                    networkUrl: networkUrl,
                    semanticLabel: semanticLabel,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                  ),
                ),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    height: constraints.maxHeight * 0.28,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Color(0xB006091A)],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Cinematic premium planet marker - Majarra original artwork treatment
/// - 3D sphere gradient, inner highlight, outer glow
/// - Bright orbit ellipse with dots
/// - Readable at 48/64px
class PlanetSymbol extends StatelessWidget {
  const PlanetSymbol({
    required this.planetId,
    required this.colorHex,
    required this.semanticLabel,
    required this.size,
    this.showOrbit = true,
    this.selected = false,
    this.imageAsset,
    this.networkUrl,
    super.key,
  });

  final String planetId;
  final String colorHex;
  final String semanticLabel;
  final double size;
  final bool showOrbit;
  final bool selected;
  final String? imageAsset;

  /// CDN twin of [imageAsset]: R2-first via disk cache, bundled instant paint.
  /// Null keeps the legacy bundled-only path (offline-safe by construction).
  final String? networkUrl;

  @override
  Widget build(BuildContext context) {
    final accent = _colorFromHex(colorHex);
    final hasImage = imageAsset != null && imageAsset!.isNotEmpty;
    final lightAccent = Color.lerp(accent, Colors.white, 0.42) ?? accent;

    // If we have a real planet artwork, show it with cinematic treatment
    if (hasImage) {
      return Semantics(
        image: true,
        label: semanticLabel,
        child: SizedBox.square(
          dimension: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (selected)
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.42),
                        blurRadius: size * 0.32,
                        spreadRadius: size * 0.04,
                      ),
                    ],
                  ),
                ),
              // Image with circular clip + border + shadow
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.30)
                        : Colors.white.withValues(alpha: 0.13),
                    width: selected ? 1.8 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.40),
                      blurRadius: size * 0.24,
                      offset: Offset(0, size * 0.08),
                    ),
                    BoxShadow(
                      color: accent.withValues(alpha: 0.22),
                      blurRadius: size * 0.18,
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: networkUrl == null
                    ? Image.asset(
                        imageAsset!,
                        width: size,
                        height: size,
                        // `width` تخطيطٌ لا فكّ ترميز: صور الكواكب 768×768 (2.25 MB
                        // مفكوكة) كانت تُفكّ بكاملها لدائرةٍ بعرض 58 (`PERF-102`).
                        cacheWidth: decodeCapFor(context, size),
                        fit: BoxFit.cover,
                        filterQuality: FilterQuality.high,
                        errorBuilder: (_, __, ___) =>
                            _fallbackSphere(accent, lightAccent, selected, size),
                      )
                    : CinematicImage(
                        assetPath: imageAsset!,
                        networkUrl: networkUrl,
                        semanticLabel: semanticLabel,
                        fit: BoxFit.cover,
                        decodeWidth: size,
                      ),
              ),
              if (showOrbit)
                Positioned.fill(
                  child: IgnorePointer(
                    child: CustomPaint(
                      painter: _PlanetOrbitPainter(
                        accent: accent,
                        selected: selected,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    final icon = _iconForPlanet(planetId);
    return Semantics(
      image: true,
      label: semanticLabel,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Outer glow - cinematic
              if (selected)
                Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.42),
                        blurRadius: size * 0.32,
                        spreadRadius: size * 0.04,
                      ),
                    ],
                  ),
                ),

              // Main sphere - 3D gradient like planet
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    center: const Alignment(-0.34, -0.42),
                    radius: 1.15,
                    colors: [
                      lightAccent,
                      accent,
                      accent.withValues(alpha: 0.78),
                      const Color(0xFF101735),
                      const Color(0xFF06091A),
                    ],
                    stops: const [0, 0.22, 0.42, 0.72, 1],
                  ),
                  border: Border.all(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.32)
                        : Colors.white.withValues(alpha: 0.14),
                    width: selected ? 1.6 : 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.38),
                      blurRadius: size * 0.22,
                      offset: Offset(0, size * 0.08),
                    ),
                    BoxShadow(
                      color: accent.withValues(alpha: 0.28),
                      blurRadius: size * 0.18,
                    ),
                  ],
                ),
              ),

              // Inner highlight - top left glass reflection
              Positioned(
                top: size * 0.10,
                left: size * 0.14,
                child: Container(
                  width: size * 0.28,
                  height: size * 0.28,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Colors.white.withValues(alpha: 0.42),
                        Colors.white.withValues(alpha: 0.0),
                      ],
                      stops: const [0, 1],
                    ),
                  ),
                ),
              ),

              // Orbit - bright cinematic planet orbit
              if (showOrbit)
                Positioned.fill(
                  child: CustomPaint(
                    painter: _PlanetOrbitPainter(
                      accent: accent,
                      selected: selected,
                    ),
                  ),
                ),

              // Center icon - with shadow
              Icon(
                icon,
                color: Colors.white,
                size: size * 0.46,
                shadows: [
                  Shadow(
                    color: Colors.black.withValues(alpha: 0.42),
                    blurRadius: 8,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static IconData _iconForPlanet(String id) {
    return switch (id) {
      'abjad' => Icons.translate_rounded,
      'arqam' => Icons.calculate_rounded,
      'oloom' => Icons.biotech_rounded,
      'qiyam' => Icons.volunteer_activism_rounded,
      'qisas' => Icons.menu_book_rounded,
      'ibdaa' => Icons.palette_rounded,
      'maharat' => Icons.extension_rounded,
      'tarikh' => Icons.account_balance_rounded,
      'iman' => Icons.favorite_rounded,
      _ => Icons.public_rounded,
    };
  }

  Widget _fallbackSphere(
    Color accent,
    Color lightAccent,
    bool selected,
    double size,
  ) {
    return Container(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: RadialGradient(
          center: const Alignment(-0.34, -0.42),
          radius: 1.15,
          colors: [
            lightAccent,
            accent,
            const Color(0xFF101735),
            const Color(0xFF06091A),
          ],
          stops: const [0, 0.22, 0.72, 1],
        ),
      ),
      child: Center(
        child: Icon(
          _iconForPlanet(planetId),
          color: Colors.white,
          size: size * 0.46,
        ),
      ),
    );
  }
}

class _PlanetOrbitPainter extends CustomPainter {
  const _PlanetOrbitPainter({required this.accent, required this.selected});

  final Color accent;
  final bool selected;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final shortSide = size.shortestSide;

    // Main orbit ellipse
    final orbitPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = selected ? 1.5 : 1.2
      ..color = Colors.white.withValues(alpha: selected ? 0.42 : 0.28)
      ..strokeCap = StrokeCap.round;

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(-0.38);
    canvas.scale(1, 0.52);
    canvas.drawCircle(Offset.zero, shortSide * 0.49, orbitPaint);
    canvas.restore();

    // Secondary faint orbit
    final secondOrbitPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 0.8
      ..color = accent.withValues(alpha: 0.32);

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(0.25);
    canvas.scale(1, 0.38);
    canvas.drawCircle(Offset.zero, shortSide * 0.58, secondOrbitPaint);
    canvas.restore();

    // Orbit dots - gold and accent
    final dotPaint = Paint()..style = PaintingStyle.fill;

    // Gold star dot
    dotPaint.color = AppColors.starGold;
    canvas.drawCircle(
      Offset(center.dx + shortSide * 0.38, center.dy - shortSide * 0.18),
      shortSide * 0.042,
      dotPaint,
    );

    // Accent dot
    dotPaint.color = accent.withValues(alpha: 0.92);
    canvas.drawCircle(
      Offset(center.dx - shortSide * 0.34, center.dy + shortSide * 0.22),
      shortSide * 0.032,
      dotPaint,
    );

    // Small white dot for depth
    dotPaint.color = Colors.white.withValues(alpha: 0.65);
    canvas.drawCircle(
      Offset(center.dx - shortSide * 0.18, center.dy - shortSide * 0.36),
      shortSide * 0.022,
      dotPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _PlanetOrbitPainter oldDelegate) {
    return oldDelegate.accent != accent || oldDelegate.selected != selected;
  }
}

Color _colorFromHex(String value) {
  final normalized = value.replaceFirst('#', '');
  return Color(int.parse(normalized, radix: 16) | 0xFF000000);
}

class _ImageFallback extends StatelessWidget {
  const _ImageFallback();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(gradient: AppColors.brandGradient),
      child: Center(
        child: Icon(
          Icons.auto_awesome_rounded,
          color: AppColors.starlight,
          size: 42,
        ),
      ),
    );
  }
}
