/// Draw Like This — ارسم مثلي catalogue 30 activities.
/// Categories: Animals, Space, Nature, Vehicles, Home, Patterns
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/creative_catalogue_provider.dart';
import '../../data/local_creation_store.dart';
import '../widgets/drawing_asset.dart';
import 'reference_drawing_page.dart';

class ReferenceCataloguePage extends StatefulWidget {
  const ReferenceCataloguePage({
    required this.childId,
    required this.creationStore,
    this.onSaved,
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  @override
  State<ReferenceCataloguePage> createState() => _ReferenceCataloguePageState();
}

class _ReferenceCataloguePageState extends State<ReferenceCataloguePage> {
  String _filterCategory = 'الكل';
  String _filterAge = 'الكل';
  final _categories = [
    'الكل',
    'حيوانات',
    'فضاء',
    'طبيعة',
    'مركبات',
    'بيت',
    'زخارف',
  ];
  final _ages = ['الكل', '4-5', '6-7', '8-9'];
  @override
  Widget build(BuildContext context) {
    return Consumer(
      builder: (context, ref, _) {
        final catalogAsync = ref.watch(referenceCatalogueProvider);
        return catalogAsync.when(
          loading: () => Scaffold(appBar: AppBar(title: const Text('ارسم مثلي')), body: const Center(child: CircularProgressIndicator())),
          error: (e, _) => _buildGrid(context, _activities),
          data: (list) {
            // Map provider items to ReferenceActivity (with bg fallback)
            final activities = list.isEmpty
                ? _activities
                : list.map((e) => _fromProvider(e)).toList(growable: false);
            return _buildGrid(context, activities);
          },
        );
      },
    );
  }

  ReferenceActivity _fromProvider(dynamic e) {
    // e is CreativeReferenceActivity
    final bg = _bgForCategory(e.category as String);
    return ReferenceActivity(
      id: e.id as String,
      titleAr: e.titleAr as String,
      titleEn: e.titleEn as String,
      category: e.category as String,
      ageLabel: e.ageLabel as String,
      difficulty: e.difficulty as String,
      referenceAssetId: e.referenceAssetId as String,
      thumbnailAssetId: e.thumbnailAssetId as String,
      bg: bg,
    );
  }

  Color _bgForCategory(String c) => switch (c) {
    'حيوانات' => const Color(0xFF0B1220),
    'فضاء' => const Color(0xFF1A0B2E),
    'طبيعة' => const Color(0xFF14532D),
    'مركبات' => const Color(0xFF1D4ED8),
    'بيت' => const Color(0xFF7C3AED),
    'زخارف' => const Color(0xFF7C2D12),
    _ => const Color(0xFF0F172A),
  };

  Widget _buildGrid(BuildContext context, List<ReferenceActivity> activities) {
    // ignore: unused_element — filtered is used below
    final filtered = activities
        .where((activity) {
          if (_filterCategory != 'الكل' &&
              activity.category != _filterCategory) {
            return false;
          }
          if (_filterAge != 'الكل' && activity.ageLabel != _filterAge) {
            return false;
          }
          return true;
        })
        .toList(growable: false);
    return Scaffold(
      appBar: AppBar(title: const Text('ارسم مثلي')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: Semantics(
              container: true,
              label: 'تصفية حسب الفئة',
              child: Wrap(
                spacing: 8,
                children: [
                  for (final category in _categories)
                    ChoiceChip(
                      label: Text(category),
                      selected: _filterCategory == category,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => _filterCategory = category);
                        }
                      },
                    ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Semantics(
              container: true,
              label: 'تصفية حسب العمر',
              child: Wrap(
                spacing: 8,
                children: [
                  for (final age in _ages)
                    ChoiceChip(
                      label: Text(age),
                      selected: _filterAge == age,
                      onSelected: (selected) {
                        if (selected) {
                          setState(() => _filterAge = age);
                        }
                      },
                    ),
                ],
              ),
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.filter_alt_off_outlined, size: 48),
                          const SizedBox(height: 8),
                          const Text('لا توجد أنشطة بهذه الفلاتر'),
                          const SizedBox(height: 12),
                          FilledButton.tonalIcon(
                            onPressed: () => setState(() {
                              _filterCategory = 'الكل';
                              _filterAge = 'الكل';
                            }),
                            icon: const Icon(Icons.restart_alt),
                            label: const Text('مسح الفلاتر'),
                          ),
                        ],
                      ),
                    ),
                  )
                : GridView.builder(
                    padding: const EdgeInsets.all(12),
                    gridDelegate:
                        const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 180,
                          childAspectRatio: 0.85,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) {
                      final act = filtered[i];
                      return Semantics(
                        button: true,
                        label:
                            '${act.titleAr}، ${act.category}، ${act.ageLabel}، ${act.difficulty}',
                        child: Card(
                          clipBehavior: Clip.antiAlias,
                          child: InkWell(
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute<void>(
                                builder: (_) => ReferenceDrawingPage(
                                  childId: widget.childId,
                                  activity: act,
                                  creationStore: widget.creationStore,
                                  onSaved: widget.onSaved,
                                ),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: Container(
                                    color: act.bg,
                                    child: Padding(
                                      padding: const EdgeInsets.all(12),
                                      child: ExcludeSemantics(
                                        child: DrawingAsset(
                                          assetIdOrPath: act.thumbnailAssetId,
                                          fit: BoxFit.contain,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(6),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        act.titleAr,
                                        style: Theme.of(
                                          context,
                                        ).textTheme.titleSmall,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        '${act.category} • ${act.ageLabel} • ${act.difficulty}',
                                        style: Theme.of(
                                          context,
                                        ).textTheme.labelSmall,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class ReferenceActivity {
  const ReferenceActivity({
    required this.id,
    required this.titleAr,
    required this.titleEn,
    required this.category,
    required this.ageLabel,
    required this.difficulty,
    required this.referenceAssetId,
    required this.thumbnailAssetId,
    this.supportsGhost = true,
    this.supportsSteps = false,
    this.bg = const Color(0xFF0F172A),
  });
  final String id;
  final String titleAr;
  final String titleEn;
  final String category;
  final String ageLabel;
  final String difficulty;
  final String referenceAssetId;
  final String thumbnailAssetId;
  final bool supportsGhost;
  final bool supportsSteps;
  final Color bg;
}

const _activities = [
  // Animals 8
  ReferenceActivity(
    id: 'ref-cat',
    titleAr: 'قطة',
    titleEn: 'Cat',
    category: 'حيوانات',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-cat',
    thumbnailAssetId: 'asset-color-cat',
    bg: Color(0xFF0B1220),
  ),
  ReferenceActivity(
    id: 'ref-lion',
    titleAr: 'أسد',
    titleEn: 'Lion',
    category: 'حيوانات',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-lion',
    thumbnailAssetId: 'asset-color-lion',
    bg: Color(0xFF92400E),
  ),
  ReferenceActivity(
    id: 'ref-turtle',
    titleAr: 'سلحفاة',
    titleEn: 'Turtle',
    category: 'حيوانات',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-turtle',
    thumbnailAssetId: 'asset-color-turtle',
    bg: Color(0xFF14532D),
  ),
  ReferenceActivity(
    id: 'ref-butterfly',
    titleAr: 'فراشة',
    titleEn: 'Butterfly',
    category: 'حيوانات',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-butterfly',
    thumbnailAssetId: 'asset-color-butterfly',
    bg: Color(0xFF831843),
  ),
  ReferenceActivity(
    id: 'ref-rabbit',
    titleAr: 'أرنب',
    titleEn: 'Rabbit',
    category: 'حيوانات',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-rabbit',
    thumbnailAssetId: 'asset-color-rabbit',
    bg: Color(0xFF6B7280),
  ),
  ReferenceActivity(
    id: 'ref-elephant',
    titleAr: 'فيل',
    titleEn: 'Elephant',
    category: 'حيوانات',
    ageLabel: '8-9',
    difficulty: 'مفصل',
    referenceAssetId: 'asset-color-elephant',
    thumbnailAssetId: 'asset-color-elephant',
    bg: Color(0xFF475569),
  ),
  ReferenceActivity(
    id: 'ref-owl',
    titleAr: 'بومة',
    titleEn: 'Owl',
    category: 'حيوانات',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-owl',
    thumbnailAssetId: 'asset-color-owl',
    bg: Color(0xFF7C3AED),
  ),
  ReferenceActivity(
    id: 'ref-horse',
    titleAr: 'حصان',
    titleEn: 'Horse',
    category: 'حيوانات',
    ageLabel: '8-9',
    difficulty: 'مفصل',
    referenceAssetId: 'asset-color-horse',
    thumbnailAssetId: 'asset-color-horse',
    bg: Color(0xFF92400E),
  ),
  // Space 5
  ReferenceActivity(
    id: 'ref-rocket',
    titleAr: 'صاروخ',
    titleEn: 'Rocket',
    category: 'فضاء',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-rocket',
    thumbnailAssetId: 'asset-color-rocket',
    bg: Color(0xFF1A0B2E),
  ),
  ReferenceActivity(
    id: 'ref-planet',
    titleAr: 'كوكب',
    titleEn: 'Planet',
    category: 'فضاء',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-planet',
    thumbnailAssetId: 'asset-color-planet',
    bg: Color(0xFF0F172A),
  ),
  ReferenceActivity(
    id: 'ref-moon',
    titleAr: 'قمر',
    titleEn: 'Moon',
    category: 'فضاء',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-moon',
    thumbnailAssetId: 'asset-color-moon',
    bg: Color(0xFF334155),
  ),
  ReferenceActivity(
    id: 'ref-astronaut',
    titleAr: 'رائد فضاء',
    titleEn: 'Astronaut',
    category: 'فضاء',
    ageLabel: '8-9',
    difficulty: 'مفصل',
    referenceAssetId: 'asset-color-astronaut',
    thumbnailAssetId: 'asset-color-astronaut',
    bg: Color(0xFFE5E7EB),
  ),
  ReferenceActivity(
    id: 'ref-telescope',
    titleAr: 'تلسكوب',
    titleEn: 'Telescope',
    category: 'فضاء',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-telescope',
    thumbnailAssetId: 'asset-color-telescope',
    bg: Color(0xFF1E3A8A),
  ),
  // Nature 5
  ReferenceActivity(
    id: 'ref-tree',
    titleAr: 'شجرة',
    titleEn: 'Tree',
    category: 'طبيعة',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-tree',
    thumbnailAssetId: 'asset-color-tree',
    bg: Color(0xFF14532D),
  ),
  ReferenceActivity(
    id: 'ref-flower',
    titleAr: 'زهرة',
    titleEn: 'Flower',
    category: 'طبيعة',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-flower',
    thumbnailAssetId: 'asset-color-flower',
    bg: Color(0xFF831843),
  ),
  ReferenceActivity(
    id: 'ref-sea',
    titleAr: 'بحر',
    titleEn: 'Sea',
    category: 'طبيعة',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-sea',
    thumbnailAssetId: 'asset-color-sea',
    bg: Color(0xFF0891B2),
  ),
  ReferenceActivity(
    id: 'ref-mountain',
    titleAr: 'جبل',
    titleEn: 'Mountain',
    category: 'طبيعة',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-mountain',
    thumbnailAssetId: 'asset-color-mountain',
    bg: Color(0xFF78716C),
  ),
  ReferenceActivity(
    id: 'ref-rainbow',
    titleAr: 'قوس قزح',
    titleEn: 'Rainbow',
    category: 'طبيعة',
    ageLabel: '8-9',
    difficulty: 'مفصل',
    referenceAssetId: 'asset-color-rainbow',
    thumbnailAssetId: 'asset-color-rainbow',
    bg: Color(0xFFEC4899),
  ),
  // Vehicles 4
  ReferenceActivity(
    id: 'ref-car',
    titleAr: 'سيارة',
    titleEn: 'Car',
    category: 'مركبات',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-car',
    thumbnailAssetId: 'asset-color-car',
    bg: Color(0xFFDC2626),
  ),
  ReferenceActivity(
    id: 'ref-train',
    titleAr: 'قطار',
    titleEn: 'Train',
    category: 'مركبات',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-train',
    thumbnailAssetId: 'asset-color-train',
    bg: Color(0xFF1D4ED8),
  ),
  ReferenceActivity(
    id: 'ref-airplane',
    titleAr: 'طائرة',
    titleEn: 'Airplane',
    category: 'مركبات',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-airplane',
    thumbnailAssetId: 'asset-color-airplane',
    bg: Color(0xFF0284C7),
  ),
  ReferenceActivity(
    id: 'ref-boat',
    titleAr: 'قارب',
    titleEn: 'Boat',
    category: 'مركبات',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-boat',
    thumbnailAssetId: 'asset-color-boat',
    bg: Color(0xFF0369A1),
  ),
  // Home 4
  ReferenceActivity(
    id: 'ref-apple',
    titleAr: 'تفاحة',
    titleEn: 'Apple',
    category: 'بيت',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-apple',
    thumbnailAssetId: 'asset-color-apple',
    bg: Color(0xFFDC2626),
  ),
  ReferenceActivity(
    id: 'ref-book',
    titleAr: 'كتاب',
    titleEn: 'Book',
    category: 'بيت',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-book',
    thumbnailAssetId: 'asset-color-book',
    bg: Color(0xFF7C3AED),
  ),
  ReferenceActivity(
    id: 'ref-house2',
    titleAr: 'منزل',
    titleEn: 'House',
    category: 'بيت',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-house',
    thumbnailAssetId: 'asset-color-house',
    bg: Color(0xFF1E3A8A),
  ),
  ReferenceActivity(
    id: 'ref-lamp',
    titleAr: 'مصباح',
    titleEn: 'Lamp',
    category: 'بيت',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-lamp',
    thumbnailAssetId: 'asset-color-lamp',
    bg: Color(0xFFF59E0B),
  ),
  // Patterns 4
  ReferenceActivity(
    id: 'ref-mosque',
    titleAr: 'مسجد مبسط',
    titleEn: 'Mosque',
    category: 'زخارف',
    ageLabel: '8-9',
    difficulty: 'مفصل',
    referenceAssetId: 'asset-color-mosque',
    thumbnailAssetId: 'asset-color-mosque',
    bg: Color(0xFF0F766E),
  ),
  ReferenceActivity(
    id: 'ref-lantern',
    titleAr: 'فانوس',
    titleEn: 'Lantern',
    category: 'زخارف',
    ageLabel: '6-7',
    difficulty: 'متوسط',
    referenceAssetId: 'asset-color-lantern',
    thumbnailAssetId: 'asset-color-lantern',
    bg: Color(0xFFB45309),
  ),
  ReferenceActivity(
    id: 'ref-crescent',
    titleAr: 'هلال ونجمة',
    titleEn: 'Crescent',
    category: 'زخارف',
    ageLabel: '4-5',
    difficulty: 'سهل',
    referenceAssetId: 'asset-color-crescent',
    thumbnailAssetId: 'asset-color-crescent',
    bg: Color(0xFF312E81),
  ),
  ReferenceActivity(
    id: 'ref-arabesque',
    titleAr: 'زخرفة',
    titleEn: 'Arabesque',
    category: 'زخارف',
    ageLabel: '8-9',
    difficulty: 'مفصل',
    referenceAssetId: 'asset-color-arabesque',
    thumbnailAssetId: 'asset-color-arabesque',
    bg: Color(0xFF7C2D12),
  ),
];
