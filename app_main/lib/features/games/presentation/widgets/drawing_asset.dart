/// Canonical drawing asset renderer.
///
/// Single place that knows how to render every drawing asset id/path.
/// Supports SVG (flutter_svg), raster, and network variants and never
/// silently swallows a missing production asset without diagnostics.
///
/// DO NOT scatter `SvgPicture.asset` / `Image.asset` for drawing assets
/// elsewhere — use this widget.
library;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../../../core/images/remote_image_cache.dart';
import '../../../../core/widgets/decode_cap.dart';

import '../../data/drawing_asset_map.dart';

class DrawingAsset extends StatelessWidget {
  const DrawingAsset({
    required this.assetIdOrPath,
    this.fit = BoxFit.contain,
    this.width,
    this.height,
    this.opacity = 1.0,
    this.semanticsLabel,
    this.placeholderIcon = Icons.image_outlined,
    this.fallbackIsShrink = false,
    super.key,
  });

  final String assetIdOrPath;
  final BoxFit fit;
  final double? width;
  final double? height;
  final double opacity;
  final String? semanticsLabel;
  final IconData placeholderIcon;
  final bool fallbackIsShrink;

  @visibleForTesting
  static RemoteImageCache? testCache;

  String get _resolved => drawingAssetPath(assetIdOrPath) ?? assetIdOrPath;

  bool get _isSvg => _resolved.toLowerCase().endsWith('.svg');
  bool get _isNetwork => _resolved.startsWith('http://') || _resolved.startsWith('https://');
  bool get _isAsset => _resolved.startsWith('assets/');

  @override
  Widget build(BuildContext context) {
    Widget child;
    if (_isNetwork) {
      // فرع الشبكة وحده يمرّ عبر التخزين المحلّي: بعد أوّل تحميل تُقرأ الصورة
      // من القرص. فرع الأصل المبندل أدناه لا يُمَسّ — لا شبكة فيه أصلًا.
      child = _RemoteDrawingImage(
        url: _resolved,
        fit: fit,
        width: width,
        height: height,
        semanticsLabel: semanticsLabel,
        placeholderIcon: placeholderIcon,
        fallbackIsShrink: fallbackIsShrink,
        assetIdOrPath: assetIdOrPath,
      );
    } else if (_isAsset) {
      if (_isSvg) {
        child = SvgPicture.asset(
          _resolved,
          fit: fit,
          width: width,
          height: height,
          semanticsLabel: semanticsLabel,
          placeholderBuilder: (ctx) => _placeholder(ctx, loading: true),
        );
      } else {
        child = Image.asset(
          _resolved,
          fit: fit,
          width: width,
          height: height,
          // شبكات التلوين و«ارسم مثلي» أصولها 1024×1024 (4 ميغابايت مفكوكة
          // للواحدة، و200 لخمسين) وتُعرض مصغَّرات (`PERF-102`).
          cacheWidth: decodeCapFor(context, width),
          errorBuilder: (_, Object error, StackTrace? st) {
            _logFailure(error);
            return _placeholder(context);
          },
        );
      }
    } else if (drawingAssetPath(assetIdOrPath) != null) {
      // assetId mapped but resolved path not asset-prefixed (should not happen
      // but kept for safety).
      final mapped = drawingAssetPath(assetIdOrPath)!;
      final isSvgMapped = mapped.toLowerCase().endsWith('.svg');
      if (isSvgMapped) {
        child = SvgPicture.asset(
          mapped,
          fit: fit,
          width: width,
          height: height,
          semanticsLabel: semanticsLabel,
          placeholderBuilder: (ctx) => _placeholder(ctx, loading: true),
        );
      } else {
        child = Image.asset(
          mapped,
          fit: fit,
          width: width,
          height: height,
          errorBuilder: (_, Object error, StackTrace? st) {
            _logFailure(error);
            return _placeholder(context);
          },
        );
      }
    } else {
      _logFailure('Unresolvable drawing asset: $assetIdOrPath -> $_resolved');
      child = _placeholder(context);
    }

    // Wrap with opacity if needed (templates use 0.9)
    if (opacity < 1.0) {
      child = Opacity(opacity: opacity, child: child);
    }

    // SvgPicture handles its own error via pictureProvider error, but
    // we also wrap to catch synchronous failures.
    // For SVG, use an errorBuilder via Future? SvgPicture has no errorBuilder,
    // so we wrap with a builder that catches via placeholderBuilder already.
    // Add a semantic wrapper if label provided.
    if (semanticsLabel != null) {
      child = Semantics(
        label: semanticsLabel,
        image: true,
        child: ExcludeSemantics(child: child),
      );
    }

    // Handle fallback sizing - Positioned.fill callers will constrain.
    return child;
  }

  void _logFailure(Object error) {
    // Always log — grey box without diagnostics is forbidden.
    debugPrint('[DrawingAsset] FAILED id="$assetIdOrPath" resolved="$_resolved" error=$error');
  }

  Widget _placeholder(BuildContext context, {bool loading = false}) {
    if (fallbackIsShrink) return const SizedBox.shrink();
    if (loading) {
      return const Center(
        child: SizedBox.square(
          dimension: 24,
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }
    // Child-facing safe fallback — never bare grey without icon+diagnostic.
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Center(child: Icon(placeholderIcon, size: 32)),
    );
  }
}

/// Helper for cases where the caller needs a Positioned.fill wrapper
/// (like trace_color_engine's _AssetLayer). Exposes same resolution but
/// lets caller control layout.
class PositionedDrawingAsset extends StatelessWidget {
  const PositionedDrawingAsset({
    required this.assetIdOrPath,
    required this.fit,
    this.opacity = 1.0,
    this.background = false,
    super.key,
  });

  final String assetIdOrPath;
  final BoxFit fit;
  final double opacity;
  final bool background;

  @override
  Widget build(BuildContext context) {
    // background assets are opaque; template assets use opacity.
    final effectiveOpacity = background ? 1.0 : opacity;
    return Positioned.fill(
      child: DrawingAsset(
        assetIdOrPath: assetIdOrPath,
        fit: fit,
        opacity: effectiveOpacity,
        fallbackIsShrink: !background,
        placeholderIcon: Icons.image_outlined,
      ),
    );
  }
}

/// صورة رسمٍ شبكية عبر التخزين المحلّي: تُقرأ من القرص بعد أوّل تحميل.
///
/// فرع الشبكة وحده يمرّ هنا — فرع الأصل المبندل في `DrawingAsset` لا شبكة فيه.
/// ترتيب المصادر: ملفّ مخزّن محلّيًّا ← شبكة مباشرة مؤقتًا ← بديل أيقونة.
///
/// يُبقَى `Image.network`/`SvgPicture.network` مسارَ التحميل الأوّل لسببٍ واحد:
/// على الويب يُرسَم عبر عنصر DOM فيتجاوز غياب بيانات CORS في R2، و`Image.file`
/// لا وجود له هناك أصلًا. بعد نجاح الجلب يُستبدَل بملفّ محلّي في البناء التالي
/// على المنصّات ذات نظام ملفّات.
class _RemoteDrawingImage extends StatefulWidget {
  const _RemoteDrawingImage({
    required this.url,
    required this.fit,
    required this.width,
    required this.height,
    required this.semanticsLabel,
    required this.placeholderIcon,
    required this.fallbackIsShrink,
    required this.assetIdOrPath,
  });

  final String url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final String? semanticsLabel;
  final IconData placeholderIcon;
  final bool fallbackIsShrink;
  final String assetIdOrPath;

  @override
  State<_RemoteDrawingImage> createState() => _RemoteDrawingImageState();
}

class _RemoteDrawingImageState extends State<_RemoteDrawingImage> {
  String? _cachedPath;
  bool _lookupDone = false;

  bool get _isSvg => widget.url.toLowerCase().endsWith('.svg');

  @override
  void initState() {
    super.initState();
    _lookupCache();
  }

  @override
  void didUpdateWidget(_RemoteDrawingImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _cachedPath = null;
      _lookupDone = false;
      _lookupCache();
    }
  }

  Future<void> _lookupCache() async {
    if (!RemoteImageCache.isCacheableUrl(widget.url)) {
      if (mounted) setState(() => _lookupDone = true);
      return;
    }
    final hit = await (DrawingAsset.testCache ?? RemoteImageCache())
        .fetch(widget.url);
    if (!mounted) return;
    setState(() {
      _cachedPath = hit?.file.path;
      _lookupDone = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final placeholder = _RemoteDrawingPlaceholder(
      placeholderIcon: widget.placeholderIcon,
      fallbackIsShrink: widget.fallbackIsShrink,
    );

    Widget netChild;
    if (_isSvg) {
      // `flutter_svg` يقرّر المعالج من الامتداد، والكاش يحفظ الامتداد الأصلي
      // ذيلًا للمفتاح لهذا السبب تحديدًا.
      netChild = SvgPicture.network(
        widget.url,
        fit: widget.fit,
        width: widget.width,
        height: widget.height,
        semanticsLabel: widget.semanticsLabel,
        placeholderBuilder: (ctx) => placeholder,
      );
    } else {
      netChild = Image.network(
        widget.url,
        fit: widget.fit,
        width: widget.width,
        height: widget.height,
        // شبكات التلوين أصولها كبيرة وتُعرض مصغَّرات (`PERF-102`): السقف على
        // `width` التخطيطية يبقي `ResizeImage` حول المزوّد كما يفحص
        // `decode_cap_test.dart`.
        cacheWidth: decodeCapFor(context, widget.width),
        errorBuilder: (_, Object error, StackTrace? st) {
          debugPrint(
            '[DrawingAsset] FAILED id="${widget.assetIdOrPath}" '
            'resolved="${widget.url}" error=$error',
          );
          return placeholder;
        },
      );
    }

    if (_cachedPath == null) {
      // البحث جارٍ أو لا ملفّ: شبكة مباشرة مؤقتًا بدل شاشة فارغة.
      if (!_lookupDone) return netChild;
      return placeholder;
    }
    // ملفّ محلّي صالح: لا شبكة في هذا البناء.
    if (_isSvg) {
      return SvgPicture.asset(
        _cachedPath!,
        fit: widget.fit,
        width: widget.width,
        height: widget.height,
        semanticsLabel: widget.semanticsLabel,
        placeholderBuilder: (ctx) => netChild,
      );
    }
    return Image.asset(
      _cachedPath!,
      fit: widget.fit,
      width: widget.width,
      height: widget.height,
      cacheWidth: decodeCapFor(context, widget.width),
      errorBuilder: (_, Object error, StackTrace? st) {
        debugPrint(
          '[DrawingAsset] FAILED id="${widget.assetIdOrPath}" '
          'resolved="$_cachedPath" error=$error',
        );
        return netChild;
      },
    );
  }
}

/// بديل `DrawingAsset` الشبكي: أيقونة موحّدة داخل حيّز، أو فراغ.
///
/// موحّد عمدًا مع `_placeholder` في `DrawingAsset`: بطاقة `memory_flip` التي
/// تُمرَّر معرّفًا غير مربوط يجب أن ترى الشيء نفسه أينما رُسمت. انظر ملاحظة
/// `flutter-app-notes.md` عن تخمين المطابقة الأعمى.
class _RemoteDrawingPlaceholder extends StatelessWidget {
  const _RemoteDrawingPlaceholder({
    required this.placeholderIcon,
    required this.fallbackIsShrink,
  });

  final IconData placeholderIcon;
  final bool fallbackIsShrink;

  @override
  Widget build(BuildContext context) {
    if (fallbackIsShrink) return const SizedBox.shrink();
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      child: Center(child: Icon(placeholderIcon, size: 32)),
    );
  }
}
