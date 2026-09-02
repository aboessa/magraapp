/// R2-first remote loader for all Creative Studio sections
/// لا يوجد assets في APK (باستثناء placeholder bird.png للـ offline).
/// كل الرسمات تحمل من R2/THUMBS_BUCKET عبر CDN: https://cdn.majarra.app/public/studio/{category}/{id}.png
/// - uses transparent PNG (remove-background) للكانفاس الأبيض
/// - Cached per childId for offline fallback
/// - Supports all categories: coloring, trace, letters, numbers, connect_dots,
///   complete, copy_pattern, free_draw templates, prompt_draw, draw_like_me

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/env/app_environment.dart';
import '../../../core/network/secure_http_client.dart';
import '../presentation/pages/coloring/coloring_home_v2.dart';

/// صف واحد من جدول creative_drawings عبر public API
@immutable
class RemoteDrawing {
  const RemoteDrawing({
    required this.id,
    required this.category,
    this.subCategory,
    required this.titleAr,
    this.titleEn,
    this.ageMin = 3,
    this.ageMax = 12,
    this.difficulty = 'سهل',
    required this.urls,
    this.palette,
    this.geometry,
    this.extra,
    this.isFeatured = false,
    this.isNew = false,
    this.sortOrder = 0,
    this.status = 'ready',
    this.assetId,
  });

  final String id;
  final String category;
  final String? subCategory;
  final String titleAr;
  final String? titleEn;
  final int ageMin;
  final int ageMax;
  final String difficulty;
  final RemoteDrawingUrls urls;
  final List<String>? palette;
  final Map<String, dynamic>? geometry;
  final Map<String, dynamic>? extra;
  final bool isFeatured;
  final bool isNew;
  final int sortOrder;
  final String status;
  final String? assetId;

  String get label => titleAr.isNotEmpty ? titleAr : (titleEn ?? id);

  /// أفضل URL للعرض على كانفاس أبيض: transparent PNG (بعد remove-background)
  /// إن وُجد، وإلا main. نفس المنطق اللي في publicCreativeStudio.ts rowToPublic best
  String get bestImageUrl {
    final candidates = [urls.best, urls.transparent, urls.main, urls.thumb];
    for (final c in candidates) {
      if (c != null && c.trim().isNotEmpty) return c.trim();
    }
    return '';
  }

  String get thumbUrl {
    if (urls.thumb != null && urls.thumb!.trim().isNotEmpty) return urls.thumb!;
    return bestImageUrl;
  }

  // فولباك 5 صور فقط كما طلب العميل
  static const _kFallback5 = [
    'assets/images/coloring/v2/bird.png',
    'assets/images/coloring/v2/cat.png',
    'assets/images/coloring/v2/fish.png',
    'assets/images/coloring/v2/vehicles.png',
    'assets/images/coloring/v2/flowers.png',
  ];

  String _fallbackPngPathForId() {
    final lower = id.toLowerCase();
    if (lower.contains('bird')) return 'assets/images/coloring/v2/bird.png';
    if (lower.contains('cat')) return 'assets/images/coloring/v2/cat.png';
    if (lower.contains('fish')) return 'assets/images/coloring/v2/fish.png';
    if (lower.contains('vehicle') || lower.contains('car')) return 'assets/images/coloring/v2/vehicles.png';
    if (lower.contains('flower')) return 'assets/images/coloring/v2/flowers.png';
    final idx = id.hashCode.abs() % _kFallback5.length;
    return _kFallback5[idx];
  }

  FeaturedColoringSpec toFeaturedV2() => FeaturedColoringSpec(
        id: id,
        label: label,
        isNew: isNew || isFeatured,
        assetPath: _fallbackPngPathForId(),
        remoteUrl: bestImageUrl.isEmpty ? null : bestImageUrl,
        thumbUrl: thumbUrl.isEmpty ? null : thumbUrl,
        ageMin: ageMin,
        ageMax: ageMax,
        difficulty: difficulty,
      );

  ColoringCategorySpec toCategoryV2() => ColoringCategorySpec(
        id: subCategory ?? category,
        label: label,
        icon: categoryIcon(category, subCategory),
        gradientStart: paletteColor(0),
        gradientEnd: paletteColor(1),
        count: 12,
        assetPath: _fallbackPngPathForId(),
        remoteThumbUrl: thumbUrl.isEmpty ? null : thumbUrl,
        remoteUrl: bestImageUrl.isEmpty ? null : bestImageUrl,
      );

  static IconData categoryIcon(String cat, String? sub) {
    final key = (sub ?? cat).toLowerCase();
    return switch (key) {
      'birds' || 'bird' => Icons.flutter_dash_rounded,
      'animals' => Icons.pets_rounded,
      'vehicles' => Icons.directions_car_rounded,
      'space' => Icons.rocket_launch_rounded,
      'flowers' => Icons.local_florist_rounded,
      'sea' => Icons.water_rounded,
      'fruits' => Icons.apple_rounded,
      'toys' => Icons.toys_rounded,
      'trace' => Icons.gesture_rounded,
      'letters' => Icons.text_fields_rounded,
      'numbers' => Icons.pin_rounded,
      'connect_dots' => Icons.timeline_rounded,
      'complete' => Icons.extension_rounded,
      'copy_pattern' => Icons.grid_view_rounded,
      _ => Icons.palette_rounded,
    };
  }

  Color paletteColor(int idx) {
    final pal = palette;
    if (pal == null || pal.isEmpty) return const Color(0xFF6A3DF2);
    try {
      final hex = pal[idx % pal.length].replaceFirst('#', '');
      final v = int.tryParse(hex, radix: 16) ?? 0x6A3DF2;
      return Color(0xFF000000 | v);
    } catch (_) {
      return const Color(0xFF6A3DF2);
    }
  }

  factory RemoteDrawing.fromJson(Map<String, dynamic> j) {
    final urls = RemoteDrawingUrls.fromJson((j['urls'] as Map?)?.cast<String, dynamic>() ?? {});
    // fallback flat urls for older shapes
    final flatMain = j['image_url'] as String? ?? j['url'] as String?;
    final flatThumb = j['thumb_url'] as String?;
    final mergedUrls = urls.main == null && flatMain != null
        ? RemoteDrawingUrls(main: flatMain, thumb: flatThumb, best: flatMain)
        : urls;
    return RemoteDrawing(
      id: (j['id'] as String?) ?? '',
      category: (j['category'] as String?) ?? 'coloring',
      subCategory: j['sub_category'] as String? ?? j['subCategory'] as String?,
      titleAr: (j['title_ar'] as String?) ?? (j['titleAr'] as String?) ?? '',
      titleEn: j['title_en'] as String? ?? j['titleEn'] as String?,
      ageMin: (j['age_min'] as num?)?.toInt() ?? 3,
      ageMax: (j['age_max'] as num?)?.toInt() ?? 12,
      difficulty: (j['difficulty'] as String?) ?? 'سهل',
      urls: mergedUrls,
      palette: (j['palette'] as List?)?.map((e) => e.toString()).toList(),
      geometry: (j['geometry'] as Map?)?.cast<String, dynamic>(),
      extra: (j['extra'] as Map?)?.cast<String, dynamic>(),
      isFeatured: (j['is_featured'] as bool? ?? j['isFeatured'] as bool?) ?? false,
      isNew: (j['is_new'] as bool? ?? j['isNew'] as bool?) ?? false,
      sortOrder: (j['sort_order'] as num?)?.toInt() ?? 0,
      status: (j['status'] as String?) ?? 'ready',
      assetId: (j['asset_id'] as String?) ?? (j['assetId'] as String?),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'category': category,
        'sub_category': subCategory,
        'title_ar': titleAr,
        'title_en': titleEn,
        'age_min': ageMin,
        'age_max': ageMax,
        'difficulty': difficulty,
        'urls': urls.toJson(),
        'palette': palette,
        'geometry': geometry,
        'extra': extra,
        'is_featured': isFeatured,
        'is_new': isNew,
        'sort_order': sortOrder,
        'status': status,
        'asset_id': assetId,
      };
}

@immutable
class RemoteDrawingUrls {
  const RemoteDrawingUrls({this.main, this.thumb, this.transparent, this.best});
  final String? main;
  final String? thumb;
  final String? transparent;
  final String? best;
  factory RemoteDrawingUrls.fromJson(Map<String, dynamic> j) => RemoteDrawingUrls(
        main: j['main'] as String?,
        thumb: j['thumb'] as String?,
        transparent: j['transparent'] as String?,
        best: j['best'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'main': main,
        'thumb': thumb,
        'transparent': transparent,
        'best': best,
      };
}

/// Persists the last non-empty remote catalogue for one child. The network is
/// still authoritative whenever available; this only makes previously loaded
/// R2 drawings usable while offline.
class CreativeRemoteDrawingCache {
  CreativeRemoteDrawingCache({
    Future<SharedPreferences> Function()? preferences,
  }) : _preferences = preferences ?? SharedPreferences.getInstance;

  static const _keyPrefix = 'majarra.creative_remote_drawings.v1.';

  final Future<SharedPreferences> Function() _preferences;

  String _key(String childId) => '$_keyPrefix$childId';

  Future<List<RemoteDrawing>?> read(String childId) async {
    try {
      final raw = (await _preferences()).getString(_key(childId));
      if (raw == null || raw.isEmpty) return null;
      final decoded = jsonDecode(raw);
      if (decoded is! List) return null;
      return decoded
          .whereType<Map<dynamic, dynamic>>()
          .map((row) => RemoteDrawing.fromJson(row.cast<String, dynamic>()))
          .where((drawing) => drawing.id.isNotEmpty)
          .toList(growable: false);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(String childId, List<RemoteDrawing> drawings) async {
    if (drawings.isEmpty) return;
    try {
      await (await _preferences()).setString(
        _key(childId),
        jsonEncode(drawings.map((drawing) => drawing.toJson()).toList()),
      );
    } catch (_) {
      // Cache failures must never make the remote catalogue unavailable.
    }
  }
}

class CreativeRemoteAssetsService {
  // SEC-105: العميل المثبَّت هو الافتراضي في كل موضع، وإلا بقي مسار واحد
  // غير مثبَّت يكفي لقراءة ما يمرّ به.
  CreativeRemoteAssetsService({http.Client? httpClient})
    : _client = httpClient ?? createAppHttpClient();

  final http.Client _client;

  String _apiBase() => AppConfig.baseUrl;

  Future<List<RemoteDrawing>> fetchDrawings({
    String category = 'coloring',
    String? subCategory,
    String status = 'ready,published',
    String? q,
    int limit = 100,
    int offset = 0,
    bool featuredOnly = false,
  }) async {
    final base = _apiBase();
    final uri = Uri.parse('$base/api/v1/creative-studio/drawings').replace(queryParameters: {
      if (category != 'all') 'category': category,
      if (subCategory != null) 'sub_category': subCategory,
      'status': status,
      if (q != null && q.trim().isNotEmpty) 'q': q.trim(),
      if (featuredOnly) 'featured': '1',
      'limit': '$limit',
      'offset': '$offset',
    });
    try {
      final res = await _client.get(uri).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) {
        final decodedPreview = utf8.decode(res.bodyBytes);
        final preview = decodedPreview.length > 500 ? decodedPreview.substring(0, 500) : decodedPreview;
        debugPrint('[creative-remote] fetchDrawings ${res.statusCode} $preview');
        return [];
      }
      final j = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      final List<dynamic> list = (j['data'] as List?) ?? const <dynamic>[];
      return list.map((e) => RemoteDrawing.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      debugPrint('[creative-remote] fetchDrawings error $e');
      return [];
    }
  }

  Future<Map<String, dynamic>?> fetchHome() async {
    final base = _apiBase();
    final uri = Uri.parse('$base/api/v1/creative-studio/home');
    try {
      final res = await _client.get(uri).timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return null;
      final j = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
      return j['data'] as Map<String, dynamic>?;
    } catch (e) {
      debugPrint('[creative-remote] fetchHome error $e');
      return null;
    }
  }

  /// يحمل bytes لصورة من CDN URL كـ Uint8List (للـ board مع floodFill)
  Future<Uint8List?> fetchImageBytes(String url) async {
    if (url.isEmpty) return null;
    try {
      final res = await _client.get(Uri.parse(url)).timeout(const Duration(seconds: 20));
      if (res.statusCode >= 200 && res.statusCode < 300) return res.bodyBytes;
      debugPrint('[creative-remote] fetchImageBytes ${res.statusCode} $url');
      return null;
    } catch (e) {
      debugPrint('[creative-remote] fetchImageBytes $e $url');
      return null;
    }
  }
}

/// تعريف إضافي على Specs الحالية لدعم remoteUrl
extension FeaturedRemoteExt on FeaturedColoringSpec {
  static FeaturedColoringSpec fromRemote(RemoteDrawing r) => r.toFeaturedV2();
}
