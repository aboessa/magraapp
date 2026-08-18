/// Versioned editable creation document.
///
/// A drawing is two things: a replayable document (vectors + fills) and a
/// rendered PNG for quick gallery display. Legacy saves stored only the PNG and
/// are kept readable as `flattened/legacy`.
///
/// The document is what enables `متابعة الرسم` — a child returns and continues
/// where they left off, with strokes and per-region fills intact. Flattening
/// into a PNG alone would lose history, force approximating eraser as paint,
/// and make undo impossible after reload.
library;

import 'dart:convert';

import 'package:flutter/material.dart';

import '../engine/free_draw_surface.dart' show DrawBrush, FreeStroke;
import '../engine/trace_geometry.dart' show NormalizedPoint;

/// Current document version. Bumped when the JSON shape changes; readers keep
/// support for older versions so a child who updates mid-gallery does not lose
/// anything.
const kCreationDocVersion = 2;

String? _truncateString(Object? value, int maxLength) {
  if (value is! String) return null;
  return value.length <= maxLength ? value : value.substring(0, maxLength);
}

/// One region fill chosen by the child.
class CreationFill {
  const CreationFill({required this.regionId, required this.hex});

  factory CreationFill.fromJson(Map<String, dynamic> json) => CreationFill(
    regionId: json['region_id'] as String? ?? json['id'] as String? ?? '',
    hex: json['hex'] as String? ?? json['color'] as String? ?? '#FFFFFF',
  );

  final String regionId;
  final String hex;

  Map<String, dynamic> toJson() => {'region_id': regionId, 'hex': hex};
}

/// A stroke stored in document space (0..1 normalised, like trace_geometry).
///
/// Kept as normalised points so the same document restores correctly on a phone
/// and a tablet. Width is stored in logical dp at a reference canvas width of
/// 1024 so it scales with the target canvas on export/replay.
class DocStroke {
  const DocStroke({
    required this.points,
    required this.colorHex,
    required this.width,
    required this.isEraser,
    this.brush = DrawBrush.pencil,
    this.opacity = 1,
  });

  factory DocStroke.fromFreeStroke(FreeStroke stroke, double canvasSize) =>
      DocStroke.fromFreeStrokeDimensions(stroke, canvasSize, canvasSize);

  factory DocStroke.fromFreeStrokeDimensions(
    FreeStroke stroke,
    double canvasWidth,
    double canvasHeight,
  ) {
    final w = canvasWidth <= 0 ? 1024.0 : canvasWidth;
    final h = canvasHeight <= 0 ? 1024.0 : canvasHeight;
    final referenceExtent = w < h ? w : h;
    return DocStroke(
      points: stroke.points
          .map((p) => NormalizedPoint(p.dx / w, p.dy / h))
          .toList(growable: false),
      colorHex:
          '#${stroke.color.toARGB32().toRadixString(16).padLeft(8, '0').substring(2).toUpperCase()}',
      width: stroke.width * 1024 / referenceExtent,
      isEraser: stroke.isEraser,
      brush: stroke.brush,
      opacity: stroke.opacity,
    );
  }

  factory DocStroke.fromJson(Map<String, dynamic> json) => DocStroke(
    points: (json['points'] as List<dynamic>? ?? const [])
        .map((e) => NormalizedPoint.fromJson((e as List).cast<dynamic>()))
        .toList(growable: false),
    colorHex:
        json['color_hex'] as String? ?? json['color'] as String? ?? '#000000',
    width: (json['width'] as num?)?.toDouble() ?? 16,
    isEraser: json['is_eraser'] == true || json['isEraser'] == true,
    brush: DrawBrush.values.firstWhere(
      (value) => value.name == json['brush'],
      orElse: () => DrawBrush.pencil,
    ),
    opacity: ((json['opacity'] as num?)?.toDouble() ?? 1).clamp(0.1, 1),
  );

  final List<NormalizedPoint> points;
  final String colorHex;
  final double width;
  final bool isEraser;
  final DrawBrush brush;
  final double opacity;

  Color get color {
    final v = int.tryParse(colorHex.replaceFirst('#', ''), radix: 16);
    if (v == null) return Colors.black;
    return Color(0xFF000000 | v);
  }

  Map<String, dynamic> toJson() => {
    'points': points.map((p) => [p.x, p.y]).toList(),
    'color_hex': colorHex,
    'width': width,
    'is_eraser': isEraser,
    'brush': brush.name,
    'opacity': opacity,
  };

  /// Converts back to a [FreeStroke] for painting on a canvas of [canvasSize].
  FreeStroke toFreeStroke(double canvasSize) =>
      toFreeStrokeDimensions(canvasSize, canvasSize);

  FreeStroke toFreeStrokeDimensions(double canvasWidth, double canvasHeight) {
    final w = canvasWidth <= 0 ? 1024.0 : canvasWidth;
    final h = canvasHeight <= 0 ? 1024.0 : canvasHeight;
    final referenceExtent = w < h ? w : h;
    return FreeStroke(
      points: points
          .map((p) => Offset(p.x * w, p.y * h))
          .toList(growable: false),
      color: color,
      width: width * referenceExtent / 1024,
      isEraser: isEraser,
      brush: brush,
      opacity: opacity,
    );
  }
}

enum BoardOrientation { portrait, landscape, square }

enum CreationType {
  freeBoard,
  referenceCopy,
  coloring,
  trace,
  connectDots,
  completeDrawing,
  copyPattern,
  promptDrawing,
  storyResponse,
  observation,
}

/// The replayable document for one creation — also used for personal boards.
class CreationDocument {
  const CreationDocument({
    required this.version,
    required this.mode,
    this.canvasWidth = 1024,
    this.canvasHeight = 1024,
    this.backgroundAsset,
    this.templateAsset,
    this.palette = const [],
    this.strokes = const [],
    this.fills = const [],
    this.prompt,
    this.packId,
    this.levelIndex,
    this.createdAt,
    this.boardTitle,
    this.orientation = BoardOrientation.square,
    this.creationType = CreationType.freeBoard,
    this.referenceActivityId,
    this.referenceAssetId,
    this.referenceTitle,
  });

  factory CreationDocument.fromJson(Map<String, dynamic> json) {
    final v = (json['version'] as num?)?.toInt() ?? 0;
    if (v == 0) {
      return CreationDocument(
        version: 0,
        mode:
            json['drawing_mode'] as String? ??
            json['mode'] as String? ??
            'free_draw',
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'] as String)
            : null,
      );
    }
    // Future version: old app must not crash — treat as unreadable legacy (PNG still shows).
    if (v > kCreationDocVersion) {
      throw FormatException(
        'Unsupported document version $v > $kCreationDocVersion',
      );
    }
    // Sane bounds: prevent malformed JSON from allocating unbounded memory.
    const maxStrokes = 100;
    const maxFills = 32;
    const maxPalette = 12;
    const maxPointsPerStroke = 800;
    final canvasWidth = ((json['canvas_width'] as num?)?.toDouble() ?? 1024)
        .clamp(64, 4096)
        .toDouble();
    final canvasHeight = ((json['canvas_height'] as num?)?.toDouble() ?? 1024)
        .clamp(64, 4096)
        .toDouble();
    final legacyReferenceExtent = canvasWidth < canvasHeight
        ? canvasWidth
        : canvasHeight;
    String? bg = json['background_asset'] as String?;
    String? tpl = json['template_asset'] as String?;
    // Clamp palette
    var palette = (json['palette'] as List<dynamic>? ?? const [])
        .whereType<String>()
        .take(maxPalette)
        .toList(growable: false);
    var rawStrokes = (json['strokes'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .take(maxStrokes)
        .toList(growable: false);
    var rawFills = (json['fills'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .take(maxFills)
        .toList(growable: false);
    String? boardTitle = _truncateString(json['board_title'], 60);
    String orientRaw = (json['orientation'] as String?) ?? 'square';
    BoardOrientation orientation = switch (orientRaw) {
      'portrait' => BoardOrientation.portrait,
      'landscape' => BoardOrientation.landscape,
      _ => BoardOrientation.square,
    };
    String typeRaw = (json['creation_type'] as String?) ?? 'free_board';
    CreationType creationType = CreationType.values.firstWhere(
      (e) => e.name == typeRaw,
      orElse: () => CreationType.freeBoard,
    );
    return CreationDocument(
      version: v,
      mode: json['mode'] as String? ?? 'free_draw',
      canvasWidth: canvasWidth,
      canvasHeight: canvasHeight,
      backgroundAsset: bg != null && bg.length < 256 ? bg : null,
      templateAsset: tpl != null && tpl.length < 256 ? tpl : null,
      palette: palette,
      strokes: rawStrokes
          .map((m) {
            var pts = (m['points'] as List<dynamic>? ?? const []);
            if (pts.length > maxPointsPerStroke) {
              pts = pts.take(maxPointsPerStroke).toList();
            }
            final width = (m['width'] as num?)?.toDouble() ?? 16;
            return DocStroke.fromJson({
              ...m,
              'points': pts,
              // V1 stored logical pixels at the original canvas extent. V2
              // stores width at a canonical 1024px reference extent.
              if (v == 1) 'width': width * 1024 / legacyReferenceExtent,
            });
          })
          .toList(growable: false),
      fills: rawFills.map(CreationFill.fromJson).toList(growable: false),
      prompt: _truncateString(json['prompt'], 500),
      packId: _truncateString(json['pack_id'], 128),
      levelIndex: (json['level_index'] as num?)?.toInt(),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
      boardTitle: boardTitle,
      orientation: orientation,
      creationType: creationType,
      referenceActivityId: _truncateString(json['reference_activity_id'], 128),
      referenceAssetId: _truncateString(json['reference_asset_id'], 128),
      referenceTitle: _truncateString(json['reference_title'], 120),
    );
  }

  final int version;
  final String mode;
  final double canvasWidth;
  final double canvasHeight;
  final String? backgroundAsset;
  final String? templateAsset;
  final List<String> palette;
  final List<DocStroke> strokes;
  final List<CreationFill> fills;
  final String? prompt;
  final String? packId;
  final int? levelIndex;
  final DateTime? createdAt;
  final String? boardTitle;
  final BoardOrientation orientation;
  final CreationType creationType;
  final String? referenceActivityId;
  final String? referenceAssetId;
  final String? referenceTitle;

  bool get isLegacy => version == 0;

  Map<String, dynamic> toJson() => {
    'version': version,
    'mode': mode,
    'canvas_width': canvasWidth,
    'canvas_height': canvasHeight,
    if (backgroundAsset != null) 'background_asset': backgroundAsset,
    if (templateAsset != null) 'template_asset': templateAsset,
    'palette': palette,
    'strokes': strokes.map((s) => s.toJson()).toList(),
    'fills': fills.map((f) => f.toJson()).toList(),
    if (prompt != null) 'prompt': prompt,
    if (packId != null) 'pack_id': packId,
    if (levelIndex != null) 'level_index': levelIndex,
    if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    if (boardTitle != null) 'board_title': boardTitle,
    'orientation': orientation.name,
    'creation_type': creationType.name,
    if (referenceActivityId != null)
      'reference_activity_id': referenceActivityId,
    if (referenceAssetId != null) 'reference_asset_id': referenceAssetId,
    if (referenceTitle != null) 'reference_title': referenceTitle,
  };

  String toJsonString() => jsonEncode(toJson());

  static CreationDocument? tryParse(String raw) {
    try {
      final d = jsonDecode(raw);
      if (d is! Map<String, dynamic>) return null;
      return CreationDocument.fromJson(d);
    } catch (_) {
      return null;
    }
  }

  /// Helper to build a new versioned document from current free strokes + fills.
  static CreationDocument fromStrokes({
    required String mode,
    required double canvasSize,
    double? canvasHeight,
    required List<FreeStroke> strokes,
    required Map<String, String> fills,
    String? backgroundAsset,
    String? templateAsset,
    List<String> palette = const [],
    String? prompt,
    String? packId,
    int? levelIndex,
  }) {
    final height = canvasHeight ?? canvasSize;
    return CreationDocument(
      version: kCreationDocVersion,
      mode: mode,
      canvasWidth: canvasSize,
      canvasHeight: height,
      backgroundAsset: backgroundAsset,
      templateAsset: templateAsset,
      palette: palette,
      strokes: strokes
          .map((s) => DocStroke.fromFreeStrokeDimensions(s, canvasSize, height))
          .toList(growable: false),
      fills: fills.entries
          .map((e) => CreationFill(regionId: e.key, hex: e.value))
          .toList(growable: false),
      prompt: prompt,
      packId: packId,
      levelIndex: levelIndex,
      createdAt: DateTime.now(),
    );
  }
}
