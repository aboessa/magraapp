/// Colouring pages catalogue.
///
/// Reads `assets/data/coloring_pages.json` and nothing else. No API tier and no
/// SharedPreferences cache, unlike `creative_catalogue_provider.dart`: this is a
/// hand-edited list of bundled pictures that ships with the binary, so a cache
/// would only add a staleness bug and a network tier would have nothing to fetch.
library;

import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/coloring_page.dart';

const coloringPagesAssetPath = 'assets/data/coloring_pages.json';

final coloringPagesProvider = FutureProvider<List<ColoringPage>>((ref) async {
  try {
    final raw = await rootBundle.loadString(coloringPagesAssetPath);
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .whereType<Map<String, dynamic>>()
        .map(ColoringPage.fromJson)
        // A half-written entry is dropped rather than shown as a tile that opens
        // onto a missing picture.
        .where((page) => page.isValid)
        .toList(growable: false);
  } catch (_) {
    return const [];
  }
});
