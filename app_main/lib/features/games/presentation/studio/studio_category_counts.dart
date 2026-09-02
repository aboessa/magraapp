/// How many items sit behind each studio activity.
///
/// The home grid shows this on each card so a child (and a reviewer) can see at
/// a glance that "لوّن" has 45 pictures and "الحروف" has 4. It is a view-model,
/// not new data: every number is the length of a list one of the existing
/// catalogue providers already loads.
///
/// Counts are exposed as an [AsyncValue] map rather than one provider per card so
/// the grid resolves in a single rebuild instead of ten. A category missing from
/// the map means "not counted yet"; the card then hides its badge rather than
/// showing a zero it cannot back up.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/coloring_pages_provider.dart';
import '../../application/creative_catalogue_provider.dart';
import 'studio_categories.dart';

final studioCategoryCountsProvider =
    Provider<Map<StudioCategoryId, int>>((ref) {
  int lengthOf<T>(ProviderListenable<AsyncValue<List<T>>> provider) =>
      ref.watch(provider).value?.length ?? 0;

  // لوّن merges the two colouring sources the studio has always had: raster line
  // art with a compiled region map (`coloringPagesProvider`) and the older
  // primitive-shape polygon templates (`coloringCatalogueProvider`). They were
  // two separate sections with nearly the same name, which is exactly the kind of
  // duplication the redesign removes.
  final coloring =
      lengthOf(coloringPagesProvider) + lengthOf(coloringCatalogueProvider);

  final counts = <StudioCategoryId, int>{
    StudioCategoryId.coloring: coloring,
    StudioCategoryId.drawLikeMe: lengthOf(referenceCatalogueProvider),
    StudioCategoryId.complete: lengthOf(completeCatalogueProvider),
    StudioCategoryId.copyPattern: lengthOf(copyCatalogueProvider),
    StudioCategoryId.connectDots: lengthOf(dotsCatalogueProvider),
    StudioCategoryId.trace: lengthOf(traceCatalogueProvider),
    StudioCategoryId.letters: lengthOf(letterCatalogueProvider),
    StudioCategoryId.numbers: lengthOf(numberCatalogueProvider),
    StudioCategoryId.promptDraw: lengthOf(promptCatalogueProvider),
  };

  // ارسم بحرية has no catalogue — it is a blank canvas — so it is deliberately
  // absent and its card shows no badge.
  counts.removeWhere((_, value) => value == 0);
  return counts;
});
