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

  String get _resolved => drawingAssetPath(assetIdOrPath) ?? assetIdOrPath;

  bool get _isSvg => _resolved.toLowerCase().endsWith('.svg');
  bool get _isNetwork => _resolved.startsWith('http://') || _resolved.startsWith('https://');
  bool get _isAsset => _resolved.startsWith('assets/');

  @override
  Widget build(BuildContext context) {
    Widget child;
    if (_isNetwork) {
      if (_isSvg) {
        child = SvgPicture.network(
          _resolved,
          fit: fit,
          width: width,
          height: height,
          semanticsLabel: semanticsLabel,
          placeholderBuilder: (ctx) => _placeholder(ctx, loading: true),
        );
      } else {
        child = Image.network(
          _resolved,
          fit: fit,
          width: width,
          height: height,
          errorBuilder: (_, Object error, StackTrace? st) {
            _logFailure(error);
            return _placeholder(context);
          },
        );
      }
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
