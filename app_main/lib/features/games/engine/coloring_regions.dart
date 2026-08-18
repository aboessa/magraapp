/// Multi-region coloring: artwork → ids → fills → outlines → strokes.
///
/// Replaces the previous "whole canvas is one rectangle" implementation. Real
/// children's line art is a set of closed regions (bird.body, bird.wing) each
/// with stable ids. A tap fills only the region hit, using the currently
/// selected palette colour.
///
/// Hit-testing is point-in-polygon on normalised 0..1 geometry, so the same
/// pack works on phone and tablet. For assets where vector data is unavailable
/// the fallback is the first region (single-rectangle), preserving the previous
/// contract honestly rather than inventing fake regions.
library;

import 'package:flutter/material.dart';

import 'trace_geometry.dart';

/// One colourable region.
class ColorRegion {
  const ColorRegion({
    required this.id,
    required this.polygon,
    this.pathData,
    this.label,
  });

  factory ColorRegion.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String? ?? '';
    // Support both legacy string ids (already handled elsewhere) and new objects.
    final polyRaw = json['polygon'] ?? json['points'] ?? json['outline'];
    List<NormalizedPoint> poly = const [];
    if (polyRaw is List<dynamic>) {
      poly = polyRaw
          .whereType<List<dynamic>>()
          .map(NormalizedPoint.fromJson)
          .toList(growable: false);
    }
    return ColorRegion(
      id: id,
      polygon: poly,
      pathData: json['path'] as String? ?? json['pathData'] as String?,
      label: json['label'] as String?,
    );
  }

  final String id;
  final List<NormalizedPoint> polygon;
  final String? pathData;
  final String? label;

  bool get hasGeometry =>
      polygon.length >= 3 || (pathData != null && pathData!.isNotEmpty);

  /// Point-in-polygon via winding number, in normalised space (0..1).
  bool contains(NormalizedPoint point) {
    if (polygon.length < 3) return false;
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      final xi = polygon[i].x, yi = polygon[i].y;
      final xj = polygon[j].x, yj = polygon[j].y;
      final intersect =
          ((yi > point.y) != (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /// Convenience: test a local pixel [Offset] on a [canvasSize] square.
  bool containsOffset(Offset local, double canvasSize) {
    if (canvasSize <= 0) return false;
    return contains(
      NormalizedPoint(local.dx / canvasSize, local.dy / canvasSize),
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'polygon': polygon.map((p) => [p.x, p.y]).toList(),
    if (pathData != null) 'path': pathData,
    if (label != null) 'label': label,
  };
}

/// Parses a raw coloring.regions list that may contain strings (legacy ids) or
/// objects (new geometry). Strings become ids with empty geometry.
List<ColorRegion> parseColorRegions(Object? raw) {
  if (raw is! List) return const [];
  final out = <ColorRegion>[];
  for (final entry in raw) {
    if (entry is String && entry.isNotEmpty) {
      out.add(ColorRegion(id: entry, polygon: const []));
    } else if (entry is Map) {
      final m = entry is Map<String, dynamic>
          ? entry
          : Map<String, dynamic>.from(entry);
      final r = ColorRegion.fromJson(m);
      if (r.id.isNotEmpty) out.add(r);
    }
  }
  return out;
}

/// Hits the topmost authored region at [local] on a [canvasSize] square.
/// Regions are tested last-to-first so later (higher) regions occlude earlier
/// ones (like SVG paint order). Geometry-free legacy ids are deliberately not
/// guessed: a tap outside authored geometry must never colour an unrelated area.
String? hitRegionAt({
  required Offset local,
  required double canvasSize,
  required List<ColorRegion> regions,
}) {
  if (regions.isEmpty || canvasSize <= 0) return null;
  for (var i = regions.length - 1; i >= 0; i--) {
    if (regions[i].containsOffset(local, canvasSize)) return regions[i].id;
  }
  return null;
}

/// Builds paths for fills in logical pixel space for a painter of [size].
///
/// Polygons are converted to a closed Path scaled by [size]. Straights only;
/// curves would be expressed as pathData in future packs and parsed separately.
List<(String id, Path path)> regionPaths(List<ColorRegion> regions, Size size) {
  final out = <(String, Path)>[];
  for (final r in regions) {
    if (r.polygon.length < 3) continue;
    final path = Path();
    final first = Offset(
      r.polygon.first.x * size.width,
      r.polygon.first.y * size.height,
    );
    path.moveTo(first.dx, first.dy);
    for (var i = 1; i < r.polygon.length; i++) {
      path.lineTo(r.polygon[i].x * size.width, r.polygon[i].y * size.height);
    }
    path.close();
    out.add((r.id, path));
  }
  return out;
}

/// Parses a hex like "#FF9F1C" -> Color. Grey fallback for bad data.
Color parseHex(String hex) {
  final v = int.tryParse(hex.replaceFirst('#', ''), radix: 16);
  if (v == null) return Colors.grey;
  return Color(0xFF000000 | v);
}

/// Winding helpers for precomputed masks would live here; for now polygons are
/// cheap (<20 points, <12 regions) and evaluated per tap without caching.
double polygonArea(List<NormalizedPoint> poly) {
  if (poly.length < 3) return 0;
  var s = 0.0;
  for (var i = 0; i < poly.length; i++) {
    final a = poly[i];
    final b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s.abs() / 2;
}
