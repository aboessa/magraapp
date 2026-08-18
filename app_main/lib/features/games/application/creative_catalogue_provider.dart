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

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../data/creative_catalogue.dart';

const _cacheKeyColoring = 'majarra.creative.coloring';
const _cacheKeyReference = 'majarra.creative.reference';

/// Count of fallback activations — normal prod should stay at 0.
/// Observe via AnalyticsService: log when Dart literal fallback is used.
int fallbackActivations = 0;
void reportFallback(String section) {
  fallbackActivations++;
  // ignore: avoid_print
  print('[creative-catalogue] FALLBACK used for $section (count $fallbackActivations)');
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
  } catch (_) {}
  final bundled = await _loadBundledColoring();
  if (bundled.isNotEmpty) {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_cacheKeyColoring, jsonEncode(bundled.map((e) => e.toJson()).toList()));
    } catch (_) {}
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
  } catch (_) {}
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
    } catch (_) {}
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

final traceCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/trace_items.json'));
final letterCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/letter_items.json'));
final numberCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/number_items.json'));
final dotsCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/dots_items.json'));
final completeCatalogueProvider = FutureProvider<List<StudioCatalogItem>>((ref) => _loadBundled('assets/data/complete_items.json'));
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
  } catch (_) {}
  final letters = await ref.watch(letterCatalogueProvider.future);
  try {
    return letters.firstWhere((e) => e.id == id);
  } catch (_) {}
  final numbers = await ref.watch(numberCatalogueProvider.future);
  try {
    return numbers.firstWhere((e) => e.id == id);
  } catch (_) {}
  return null;
});

// Public API fetchers — to be wired when backend endpoints are live.
// Kept as separate functions so the provider can be swapped without UI changes.
Future<List<ColoringTemplate>> fetchColoringFromApi(String baseUrl, {http.Client? client}) async {
  final httpClient = client ?? http.Client();
  final res = await httpClient.get(Uri.parse('$baseUrl/api/v1/creative/coloring'));
  if (res.statusCode != 200) throw Exception('coloring api ${res.statusCode}');
  final body = jsonDecode(res.body) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>;
  return data.map((e) => ColoringTemplate.fromJson(e as Map<String, dynamic>)).toList();
}

Future<List<CreativeReferenceActivity>> fetchReferenceFromApi(String baseUrl, {http.Client? client}) async {
  final httpClient = client ?? http.Client();
  final res = await httpClient.get(Uri.parse('$baseUrl/api/v1/reference-activities'));
  if (res.statusCode != 200) throw Exception('reference api ${res.statusCode}');
  final body = jsonDecode(res.body) as Map<String, dynamic>;
  final data = body['data'] as List<dynamic>;
  return data.map((e) => CreativeReferenceActivity.fromJson(e as Map<String, dynamic>)).toList();
}
