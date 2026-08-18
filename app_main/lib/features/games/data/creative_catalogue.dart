/// Canonical Creative Activity Contract
///
/// CMS/API is the authority. Flutter loads via repository → local cache → UI.
/// Dart literals remain only as offline fallback until server is canonical.
///
/// Types here mirror `reference_activities` table and coloring template contract.
library;

import 'package:flutter/material.dart' show Color;

import '../engine/coloring_regions.dart' show ColorRegion;
import '../engine/trace_geometry.dart' show NormalizedPoint;

/// One coloring template — canonical CMS shape.
class ColoringTemplate {
  const ColoringTemplate({
    required this.id,
    required this.label,
    required this.assetId,
    required this.regions,
    required this.palette,
    this.bgHex,
  });

  factory ColoringTemplate.fromJson(Map<String, dynamic> json) {
    final regionsRaw = json['regions'] as List<dynamic>? ?? const [];
    final regions = regionsRaw.map((e) {
      final m = e as Map<String, dynamic>;
      final poly = (m['polygon'] as List<dynamic>? ?? const [])
          .map((p) {
            final arr = p as List<dynamic>;
            return NormalizedPoint((arr[0] as num).toDouble(), (arr[1] as num).toDouble());
          })
          .toList();
      return ColorRegion(id: m['id'] as String, polygon: poly);
    }).toList();
    return ColoringTemplate(
      id: json['id'] as String,
      label: json['label'] as String,
      assetId: json['assetId'] as String,
      regions: regions,
      palette: (json['palette'] as List<dynamic>? ?? const []).whereType<String>().toList(),
      bgHex: json['bg'] as String?,
    );
  }

  final String id;
  final String label;
  final String assetId;
  final List<ColorRegion> regions;
  final List<String> palette;
  final String? bgHex;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'assetId': assetId,
    'regions': regions.map((r) => {'id': r.id, 'polygon': r.polygon.map((p) => [p.x, p.y]).toList()}).toList(),
    'palette': palette,
    if (bgHex != null) 'bg': bgHex,
  };
}

class ReferenceStep {
  const ReferenceStep({required this.activityId, required this.order, required this.instructionAr});
  factory ReferenceStep.fromJson(Map<String, dynamic> json) => ReferenceStep(
    activityId: json['activityId'] as String? ?? json['activity_id'] as String? ?? '',
    order: (json['order'] as num?)?.toInt() ?? 0,
    instructionAr: json['instructionAr'] as String? ?? json['instruction_ar'] as String? ?? '',
  );
  final String activityId;
  final int order;
  final String instructionAr;
  Map<String, dynamic> toJson() => {'activityId': activityId, 'order': order, 'instructionAr': instructionAr};
}

/// Generic studio item — covers trace / letters / numbers / dots / complete / copy / prompt.
class StudioCatalogItem {
  const StudioCatalogItem({
    required this.id,
    required this.label,
    this.assetId,
    this.bgHex,
    this.mode,
    this.palette = const [],
    this.strokePaths = const [],
    this.dots = const [],
    this.regions = const [],
    this.icon,
  });

  factory StudioCatalogItem.fromJson(Map<String, dynamic> json) {
    final sp = (json['strokePaths'] as List<dynamic>? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final dots = (json['dots'] as List<dynamic>? ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    final regsRaw = json['regions'] as List<dynamic>? ?? const [];
    final regs = regsRaw.map((e) {
      final m = e as Map<String, dynamic>;
      final poly = (m['polygon'] as List<dynamic>? ?? const [])
          .map((p) {
            final arr = p as List<dynamic>;
            return NormalizedPoint((arr[0] as num).toDouble(), (arr[1] as num).toDouble());
          })
          .toList();
      return ColorRegion(id: m['id'] as String, polygon: poly);
    }).toList();
    return StudioCatalogItem(
      id: json['id'] as String,
      label: json['label'] as String? ?? '',
      assetId: json['assetId'] as String?,
      bgHex: json['bg'] as String?,
      mode: json['mode'] as String?,
      palette: (json['palette'] as List<dynamic>? ?? const []).whereType<String>().toList(),
      strokePaths: sp,
      dots: dots,
      regions: regs,
      icon: json['icon'] as String?,
    );
  }

  final String id;
  final String label;
  final String? assetId;
  final String? bgHex;
  final String? mode;
  final List<String> palette;
  final List<Map<String, dynamic>> strokePaths;
  final List<Map<String, dynamic>> dots;
  final List<ColorRegion> regions;
  final String? icon;

  Color get bgColor {
    final h = bgHex;
    if (h == null || h.isEmpty) return const Color(0xFF0F172A);
    final v = int.tryParse(h, radix: 16);
    if (v == null) return const Color(0xFF0F172A);
    return Color(0xFF000000 | v);
  }
}

/// Reference activity (ارسم مثلي) — canonical.
class CreativeReferenceActivity {
  const CreativeReferenceActivity({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.category,
    required this.ageLabel,
    required this.difficulty,
    required this.referenceAssetId,
    required this.thumbnailAssetId,
  });

  factory CreativeReferenceActivity.fromJson(Map<String, dynamic> json) => CreativeReferenceActivity(
    id: json['id'] as String,
    titleAr: json['titleAr'] as String? ?? json['title_ar'] as String? ?? '',
    titleEn: json['titleEn'] as String? ?? '',
    category: json['category'] as String? ?? '',
    ageLabel: json['ageLabel'] as String? ?? json['age_label'] as String? ?? '',
    difficulty: json['difficulty'] as String? ?? '',
    referenceAssetId: json['referenceAssetId'] as String? ?? json['reference_asset_id'] as String? ?? '',
    thumbnailAssetId: json['thumbnailAssetId'] as String? ?? json['thumbnail_asset_id'] as String? ?? '',
  );

  final String id;
  final String titleAr;
  final String titleEn;
  final String category;
  final String ageLabel;
  final String difficulty;
  final String referenceAssetId;
  final String thumbnailAssetId;
}
