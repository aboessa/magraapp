/// Creative catalogue provider — CMS/API canonical, offline fallback.
///
/// Priority:
/// 1. API (`/api/v1/creative/coloring` + `/api/v1/reference-activities`) if reachable
/// 2. Bundled JSON (`assets/data/coloring_templates.json`, `reference_activities.json`)
/// 3. Dart literals (legacy fallback, never primary)
///
/// Local cache is via SharedPreferences JSON snapshot so the studio works offline
/// after first fetch.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/diagnostics/ignored_errors.dart';
import '../../../core/env/app_environment.dart';
import '../../../core/network/secure_http_client.dart';
import '../data/creative_catalogue.dart';

const _cacheKeyColoring = 'majarra.creative.coloring';
const _cacheKeyReference = 'majarra.creative.reference';
const _cacheKeyComplete = 'majarra.creative.complete';
const _cacheKeyDots = 'majarra.creative.dots';
const _cacheKeyTrace = 'majarra.creative.trace';
const _cacheKeyLetters = 'majarra.creative.letters';
const _cacheKeyNumbers = 'majarra.creative.numbers';

/// عدد مرّات اللجوء إلى الاحتياطي المكتوب في الكود. الإنتاج السليم يبقى صفرًا.
///
/// **العدّاد هو المرصد**، لا الطبع. كان هنا `print(...)` **بلا شرط**، أي طبعٌ في
/// مسار إنتاج أُسكِت بـ`// ignore: avoid_print` — وهو عين ما رصده `DEBT-102`.
/// والتعليق القديم كان يقول «Observe via AnalyticsService» وهو **وعدٌ لم
/// يُنفَّذ**: لا شيء يرسل هذا إلى التحليلات. فصار النصّ يقول ما هو صحيح.
///
/// ورفعُه إلى التحليلات يحتاج حقن الخدمة في دالّة عامّة بلا سياق، وهو تغييرٌ
/// أوسع من هذه الدفعة؛ والعدّاد قابل للقراءة من اختبارٍ أو شاشة تشخيص الآن.
int fallbackActivations = 0;

void reportFallback(String section) {
  fallbackActivations++;
  if (kDebugMode) {
    debugPrint(
      '[creative-catalogue] FALLBACK used for $section (count $fallbackActivations)',
    );
  }
}

Future<List<ColoringTemplate>> _loadBundledColoring() async {
  try {
    final raw = await rootBundle.loadString('assets/data/coloring_templates.json');
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => ColoringTemplate.fromJson(e as Map<String, dynamic>)).toList();
  } catch (_) {
    return const [];
  }
}

Future<List<CreativeReferenceActivity>> _loadBundledReference() async {
  try {
    final raw = await rootBundle.loadString('assets/data/reference_activities.json');
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => CreativeReferenceActivity.fromJson(e as Map<String, dynamic>)).toList();
  } catch (_) {
    return const [];
  }
}

final coloringCatalogueProvider = FutureProvider<List<ColoringTemplate>>((ref) async {
  // 1. Try API (if base URL available via gameProviders or env, skip for now — bundled is canonical offline)
  // For now, bundled JSON is the CMS export. API will replace this when creative endpoints ship.
  // Cache check
  try {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(_cacheKeyColoring);
    if (cached != null) {
      final list = jsonDecode(cached) as List<dynamic>;
      final parsed = list.map((e) => ColoringTemplate.fromJson(e as Map<String, dynamic>)).toList();
      if (parsed.isNotEmpty) return parsed;
    }
  } catch (error) {
    reportIgnoredError('creative_catalogue.cache_read', error);
  }
  final bundled = await _loadBundledColoring();
  if (bundled.isNotEmpty) {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKeyColoring, jsonEncode(bundled.map((e) => e.toJson()).toList()));
    } catch (_) {
      // كتابة الكاش تحسين لا شرط: الكاتالوج المبندل جاهز في الحزمة، وفشل الحفظ
      // يعني إعادة قراءته من الأصول في الإقلاع التالي — لا فقدان شيء.
    }
    return bundled;
  }
  reportFallback('coloring');
  return const [];
});

final referenceCatalogueProvider = FutureProvider<List<CreativeReferenceActivity>>((ref) async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(_cacheKeyReference);
    if (cached != null) {
      final list = jsonDecode(cached) as List<dynamic>;
      final parsed = list.map((e) => CreativeReferenceActivity.fromJson(e as Map<String, dynamic>)).toList();
      if (parsed.isNotEmpty) return parsed;
    }
  } catch (error) {
    reportIgnoredError('creative_catalogue.cache_read', error);
  }
  final bundled = await _loadBundledReference();
  if (bundled.isNotEmpty) {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKeyReference, jsonEncode(bundled.map((e) => {
        'id': e.id,
        'titleAr': e.titleAr,
        'titleEn': e.titleEn,
        'category': e.category,
        'ageLabel': e.ageLabel,
        'difficulty': e.difficulty,
        'referenceAssetId': e.referenceAssetId,
        'thumbnailAssetId': e.thumbnailAssetId,
      }).toList()));
    } catch (_) {
      // كما أعلاه: حفظ الكاش تحسين، والمصدر المبندل يبقى متاحًا.
    }
    return bundled;
  }
  reportFallback('reference');
  return const [];
});

final referenceStepsProvider = FutureProvider<List<ReferenceStep>>((ref) async {
  try {
    final raw = await rootBundle.loadString('assets/data/reference_steps.json');
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => ReferenceStep.fromJson(e as Map<String, dynamic>)).toList();
  } catch (_) {
    return const [];
  }
});

Future<List<StudioCatalogItem>> _loadBundled(String file) async {
  try {
    final raw = await rootBundle.loadString(file);
    final list = jsonDecode(raw) as List<dynamic>;
    return list.map((e) => StudioCatalogItem.fromJson(e as Map<String, dynamic>)).toList();
  } catch (_) {
    return const [];
  }
}

final traceCatalogueProvider = FutureProvider<List<StudioCatalogItem>>(
  (ref) => _loadTraceCategory('trace', _cacheKeyTrace, 'assets/data/trace_items.json'),
);
final letterCatalogueProvider = FutureProvider<List<StudioCatalogItem>>(
  (ref) => _loadTraceCategory('letters', _cacheKeyLetters, 'assets/data/letter_items.json'),
);
final numberCatalogueProvider = FutureProvider<List<StudioCatalogItem>>(
  (ref) => _loadTraceCategory('numbers', _cacheKeyNumbers, 'assets/data/number_items.json'),
);
final dotsCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) async {
  try {
    final remote = await fetchDotsFromApi(AppConfig.baseUrl);
    if (remote.isNotEmpty) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _cacheKeyDots,
        jsonEncode(remote.map(_studioItemToJson).toList()),
      );
      return remote;
    }
  } catch (_) {
    // Keep the last valid catalogue usable when the public API is unavailable.
  }
  try {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(_cacheKeyDots);
    if (cached != null) {
      final list = jsonDecode(cached) as List<dynamic>;
      final parsed = list
          .map((item) => StudioCatalogItem.fromJson(item as Map<String, dynamic>))
          .toList();
      if (parsed.isNotEmpty) return parsed;
    }
  } catch (error) {
    // كاش تالف أو بصيغة قديمة. المسار يمضي إلى الكاتالوج المبندل أدناه، وهو
    // السلوك الصحيح: طفل ينتظر شاشة رسم لا يُعرَض عليه خطأ تقني. ويُسجَّل لأن
    // تكراره يعني كاشًا يُكتب ولا يُقرأ أبدًا — أي عمل ضائع في كل إقلاع.
    reportIgnoredError('creative_catalogue.cache_read', error);
  }
  return _loadBundled('assets/data/dots_items.json');
});
final completeCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) async {
  try {
    final remote = await fetchCompleteFromApi(AppConfig.baseUrl);
    if (remote.isNotEmpty) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _cacheKeyComplete,
        jsonEncode(remote.map(_studioItemToJson).toList()),
      );
      return remote;
    }
  } catch (_) {
    // Use the last valid catalogue while offline or during a service outage.
  }
  try {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(_cacheKeyComplete);
    if (cached != null) {
      final list = jsonDecode(cached) as List<dynamic>;
      final parsed = list
          .map((item) => StudioCatalogItem.fromJson(item as Map<String, dynamic>))
          .toList();
      if (parsed.isNotEmpty) return parsed;
    }
  } catch (error) {
    // كاش تالف أو بصيغة قديمة. المسار يمضي إلى الكاتالوج المبندل أدناه، وهو
    // السلوك الصحيح: طفل ينتظر شاشة رسم لا يُعرَض عليه خطأ تقني. ويُسجَّل لأن
    // تكراره يعني كاشًا يُكتب ولا يُقرأ أبدًا — أي عمل ضائع في كل إقلاع.
    reportIgnoredError('creative_catalogue.cache_read', error);
  }
  return _loadBundled('assets/data/complete_items.json');
});
final copyCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/copy_items.json'));
final promptCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/prompt_items.json'));

// Single-item resolvers for deep links — cache/bundled first, not network-required.
final coloringCatalogueAsync = FutureProvider.family<ColoringTemplate?, String>((ref, id) async {
  final list = await ref.watch(coloringCatalogueProvider.future);
  try {
    return list.firstWhere((e) => e.id == id);
  } catch (_) {
    return null;
  }
});

final referenceActivityAsync = FutureProvider.family<CreativeReferenceActivity?, String>((ref, id) async {
  final list = await ref.watch(referenceCatalogueProvider.future);
  try {
    return list.firstWhere((e) => e.id == id || e.id == 'ref-$id');
  } catch (_) {
    return null;
  }
});

final traceItemAsync = FutureProvider.family<StudioCatalogItem?, String>((ref, id) async {
  final trace = await ref.watch(traceCatalogueProvider.future);
  try {
    return trace.firstWhere((e) => e.id == id);
  } catch (_) {
    // `firstWhere` بلا `orElse` ترفع `StateError` حين لا تجد — وهذه ليست حالة
    // خطأ بل «ليس في هذا الكاتالوج»، فيُجرَّب التالي. تُركت كما هي لأن تحويلها
    // إلى `firstWhereOrNull` يمسّ ثلاثة مسارات بحث في نداء واحد.
  }
  final letters = await ref.watch(letterCatalogueProvider.future);
  try {
    return letters.firstWhere((e) => e.id == id);
  } catch (_) {
    // نفس المنطق: «ليس هنا» لا «خطأ».
  }
  final numbers = await ref.watch(numberCatalogueProvider.future);
  try {
    return numbers.firstWhere((e) => e.id == id);
  } catch (_) {
    // نفس المنطق: «ليس هنا» لا «خطأ».
  }
  return null;
});

// Public API fetchers — to be wired when backend endpoints are live.
// Kept as separate functions so the provider can be swapped without UI changes.
Future<List<ColoringTemplate>> fetchColoringFromApi(String baseUrl, {http.Client? client}) async {
  final httpClient = client ?? createAppHttpClient();
  final res = await httpClient.get(Uri.parse('$baseUrl/api/v1/creative/coloring'));
  if (res.statusCode != 200) throw Exception('coloring api ${res.statusCode}');
  final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>;
  return data.map((e) => ColoringTemplate.fromJson(e as Map<String, dynamic>)).toList();
}

// بلا مستدعٍ فعلي حاليًا (مثل fetchColoringFromApi أعلاه): referenceCatalogueProvider
// يستخدم استراتيجية تخزين مؤقت (SharedPreferences) → محتوى مُجمَّع محليًا فقط،
// بلا لمس الشبكة. ربط هذه الدالة بمصدر شبكي حقيقي قرار منتج مؤجَّل خارج نطاق
// هذا الـspec.
Future<List<CreativeReferenceActivity>> fetchReferenceFromApi(String baseUrl, {http.Client? client}) async {
  final httpClient = client ?? createAppHttpClient();
  http.Response res;
  try {
    res = await httpClient.get(Uri.parse('$baseUrl/api/v1/creative/reference-activities'));
  } catch (e) {
    throw Exception('reference api network error: $e');
  }
  if (res.statusCode != 200) throw Exception('reference api ${res.statusCode}');
  final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>;
  return data.map((e) => CreativeReferenceActivity.fromJson(e as Map<String, dynamic>)).toList();
}

Future<List<StudioCatalogItem>> fetchCompleteFromApi(
  String baseUrl, {
  http.Client? client,
}) async {
  final httpClient = client ?? createAppHttpClient();
  final uri = Uri.parse('$baseUrl/api/v1/creative-studio/drawings').replace(
    queryParameters: const {
      'category': 'complete',
      'status': 'ready,published',
      'limit': '100',
    },
  );
  final res = await httpClient.get(uri);
  if (res.statusCode != 200) throw Exception('complete api ${res.statusCode}');
  final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>? ?? const [];
  return data
      .map((item) => _completeItemFromApi(item as Map<String, dynamic>))
      .whereType<StudioCatalogItem>()
      .toList();
}

StudioCatalogItem? _completeItemFromApi(Map<String, dynamic> row) {
  final urls = row['urls'] as Map<String, dynamic>? ?? const {};
  final extra = row['extra'] as Map<String, dynamic>? ?? const {};
  final challenge = urls['main'] as String? ?? row['image_url'] as String?;
  final thumbnail = urls['thumb'] as String? ?? row['thumb_url'] as String?;
  final reference = row['reference_full_url'] as String? ??
      extra['reference_full_url'] as String?;
  if (challenge == null || challenge.isEmpty ||
      thumbnail == null || thumbnail.isEmpty ||
      reference == null || reference.isEmpty) {
    return null;
  }
  return StudioCatalogItem(
    id: row['id'] as String? ?? '',
    label: row['title_ar'] as String? ?? '',
    assetId: challenge,
    thumbnailAssetId: thumbnail,
    referenceFullAssetId: reference,
    group: extra['group'] as String?,
    difficulty: row['difficulty'] as String?,
  );
}

Map<String, dynamic> _studioItemToJson(StudioCatalogItem item) => {
      'id': item.id,
      'label': item.label,
      'assetId': item.assetId,
      'thumbnailAssetId': item.thumbnailAssetId,
      'referenceFull': item.referenceFullAssetId,
      'group': item.group,
      'difficulty': item.difficulty,
      'bg': item.bgHex,
      'mode': item.mode,
      'strokePaths': item.strokePaths,
      'dots': item.dots,
    };

Future<List<StudioCatalogItem>> _loadTraceCategory(
  String category,
  String cacheKey,
  String bundledAsset,
) async {
  try {
    final remote = await fetchTraceCategoryFromApi(AppConfig.baseUrl, category);
    if (remote.isNotEmpty) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        cacheKey,
        jsonEncode(remote.map(_studioItemToJson).toList()),
      );
      return remote;
    }
  } catch (_) {
    // A prior valid snapshot remains usable during an API outage.
  }
  try {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(cacheKey);
    if (cached != null) {
      final list = jsonDecode(cached) as List<dynamic>;
      final parsed = list
          .map((item) => StudioCatalogItem.fromJson(item as Map<String, dynamic>))
          .where((item) => _validStrokePaths(item.strokePaths))
          .toList();
      if (parsed.isNotEmpty) return parsed;
    }
  } catch (error) {
    reportIgnoredError('creative_catalogue.cache_read', error);
  }
  return _loadBundled(bundledAsset);
}

Future<List<StudioCatalogItem>> fetchTraceCategoryFromApi(
  String baseUrl,
  String category, {
  http.Client? client,
}) async {
  if (!const {'trace', 'letters', 'numbers'}.contains(category)) {
    throw ArgumentError.value(category, 'category');
  }
  final httpClient = client ?? createAppHttpClient();
  final uri = Uri.parse('$baseUrl/api/v1/creative-studio/drawings').replace(
    queryParameters: {
      'category': category,
      'status': 'ready,published',
      'limit': '100',
    },
  );
  final res = await httpClient.get(uri);
  if (res.statusCode != 200) throw Exception('$category api ${res.statusCode}');
  final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>? ?? const [];
  return data
      .map((item) => _traceItemFromApi(item as Map<String, dynamic>))
      .whereType<StudioCatalogItem>()
      .toList();
}

StudioCatalogItem? _traceItemFromApi(Map<String, dynamic> row) {
  final urls = row['urls'] as Map<String, dynamic>? ?? const {};
  final image = urls['main'] as String? ?? row['image_url'] as String?;
  final geometry = row['geometry'] as Map<String, dynamic>? ?? const {};
  final rawPaths = geometry['strokePaths'] as List<dynamic>? ?? const [];
  final paths = rawPaths
      .whereType<Map<dynamic, dynamic>>()
      .map((path) => Map<String, dynamic>.from(path))
      .toList();
  if (image == null || image.isEmpty || !_validStrokePaths(paths)) return null;
  return StudioCatalogItem(
    id: row['id'] as String? ?? '',
    label: row['title_ar'] as String? ?? '',
    assetId: image,
    thumbnailAssetId: urls['thumb'] as String? ?? image,
    difficulty: row['difficulty'] as String?,
    mode: switch (row['category']) {
      'letters' => 'letter',
      'numbers' => 'number',
      _ => 'path',
    },
    strokePaths: paths,
  );
}

bool _validStrokePaths(List<Map<String, dynamic>> paths) {
  if (paths.isEmpty) return false;
  for (var index = 0; index < paths.length; index += 1) {
    final path = paths[index];
    final type = path['type'];
    final points = path['points'];
    if (path['id'] is! String || path['id'] == '' || path['order'] != index + 1 ||
        (type != 'stroke' && type != 'dot') || points is! List ||
        points.length < (type == 'dot' ? 1 : 2)) {
      return false;
    }
    for (final point in points) {
      if (point is! List || point.length != 2 || point[0] is! num || point[1] is! num ||
          (point[0] as num) < 0 || (point[0] as num) > 1 ||
          (point[1] as num) < 0 || (point[1] as num) > 1) {
        return false;
      }
    }
  }
  return true;
}

Future<List<StudioCatalogItem>> fetchDotsFromApi(
  String baseUrl, {
  http.Client? client,
}) async {
  final httpClient = client ?? createAppHttpClient();
  final uri = Uri.parse('$baseUrl/api/v1/creative-studio/drawings').replace(
    queryParameters: const {
      'category': 'connect_dots',
      'status': 'ready,published',
      'limit': '100',
    },
  );
  final res = await httpClient.get(uri);
  if (res.statusCode != 200) throw Exception('dots api ${res.statusCode}');
  final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>? ?? const [];
  return data
      .map((item) => _dotsItemFromApi(item as Map<String, dynamic>))
      .whereType<StudioCatalogItem>()
      .toList();
}

StudioCatalogItem? _dotsItemFromApi(Map<String, dynamic> row) {
  final urls = row['urls'] as Map<String, dynamic>? ?? const {};
  final image = urls['main'] as String? ?? row['image_url'] as String?;
  final geometry = row['geometry'] as Map<String, dynamic>? ?? const {};
  final rawDots = geometry['dots'] as List<dynamic>? ?? const [];
  final dots = rawDots.whereType<Map<dynamic, dynamic>>().map((dot) {
    final value = dot.cast<String, dynamic>();
    final at = value['at'] as List<dynamic>?;
    if (at == null || at.length != 2 ||
        at[0] is! num || at[1] is! num || value['order'] is! num) {
      return null;
    }
    final x = (at[0] as num).toDouble();
    final y = (at[1] as num).toDouble();
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return {'id': value['id']?.toString() ?? '', 'order': (value['order'] as num).toInt(), 'at': [x, y]};
  }).whereType<Map<String, dynamic>>().toList();
  if (image == null || image.isEmpty || dots.length < 2) return null;
  if (dots.asMap().entries.any((entry) => entry.value['id'] == '' || entry.value['order'] != entry.key + 1)) return null;
  return StudioCatalogItem(
    id: row['id'] as String? ?? '',
    label: row['title_ar'] as String? ?? '',
    assetId: image,
    thumbnailAssetId: urls['thumb'] as String? ?? image,
    difficulty: row['difficulty'] as String?,
    dots: dots,
  );
}
