/// 1) رئيسية تتبّع اختيار خطوط/أشكال/أرقام/حروف Levels Cards احترافية + عمر/صعوبة
/// + Task 2 تتبّع board نفسه حرف/رقم كبير اتجاه البداية/النهاية stroke order
library;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../studio_tracing/trace_home_v2.dart' as v2impl;
import '../studio_tracing/trace_board_v2.dart' show TraceBoardV2Page, TraceLevelSpec;
import '../../../application/creative_catalogue_provider.dart';
import '../../../engine/trace_geometry.dart' show NormalizedPoint, TraceStroke;
import 'image_slot.dart';
import 'success_and_save.dart';

// re-export ready-to-use
class TraceHomeWrapper extends ConsumerWidget {
  const TraceHomeWrapper({required this.childId, this.remoteSpecs, this.onOpenMyBoards, super.key});
  final String childId;
  final List<v2impl.TraceCategorySpec>? remoteSpecs;
  final VoidCallback? onOpenMyBoards;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // T5.1 + T5.3 — R2-first: trace/letters/numbers from API, fallback to bundled hardcoded.
    final traceAsync = ref.watch(traceCatalogueProvider);
    final lettersAsync = ref.watch(letterCatalogueProvider);
    final numbersAsync = ref.watch(numberCatalogueProvider);

    List<v2impl.TraceCategorySpec>? specs;
    if (remoteSpecs != null && remoteSpecs!.isNotEmpty) {
      specs = remoteSpecs;
    } else if (traceAsync is AsyncData && lettersAsync is AsyncData && numbersAsync is AsyncData) {
      final trace = traceAsync.value ?? const [];
      final letters = lettersAsync.value ?? const [];
      final numbers = numbersAsync.value ?? const [];
      // Override counts and thumbs from remote if any data exists
      if (trace.isNotEmpty || letters.isNotEmpty || numbers.isNotEmpty) {
        specs = v2impl.kTraceCategoriesV2.map((cat) {
          if (cat.id == 'letters_ar' && letters.isNotEmpty) {
            final first = letters.first;
            return v2impl.TraceCategorySpec(
              id: cat.id, label: cat.label, labelEn: cat.labelEn, icon: cat.icon,
              gradientStart: cat.gradientStart, gradientEnd: cat.gradientEnd,
              count: letters.length, progress: 0,
              assetPath: cat.assetPath,
              remoteThumbUrl: first.thumbnailAssetId ?? first.assetId,
              remoteUrl: first.assetId,
            );
          }
          if (cat.id == 'numbers' && numbers.isNotEmpty) {
            final first = numbers.first;
            return v2impl.TraceCategorySpec(
              id: cat.id, label: cat.label, labelEn: cat.labelEn, icon: cat.icon,
              gradientStart: cat.gradientStart, gradientEnd: cat.gradientEnd,
              count: numbers.length, progress: 0,
              assetPath: cat.assetPath,
              remoteThumbUrl: first.thumbnailAssetId ?? first.assetId,
              remoteUrl: first.assetId,
            );
          }
          if ((cat.id == 'shapes' || cat.id == 'lines_straight' || cat.id == 'lines_curvy' || cat.id == 'maze' || cat.id == 'waves') && trace.isNotEmpty) {
            final first = trace.first;
            return v2impl.TraceCategorySpec(
              id: cat.id, label: cat.label, labelEn: cat.labelEn, icon: cat.icon,
              gradientStart: cat.gradientStart, gradientEnd: cat.gradientEnd,
              count: trace.length, progress: 0,
              assetPath: cat.assetPath,
              remoteThumbUrl: first.thumbnailAssetId ?? first.assetId,
              remoteUrl: first.assetId,
            );
          }
          return cat;
        }).toList();
      }
    }

    return v2impl.TraceHomeV2Page(
      childId: childId,
      // `assets/images/studio/v2/trace-hero.png` **لا يُبندل بقرار مكتوب** في
      // `pubspec.yaml` وغير موجود على القرص، فكان الهيرو يسقط دائمًا إلى
      // `coloring/v2/bird.png` — عصفورُ التلوين في رأس شاشة التتبّع. صار الأصل
      // المُبندَل هو المُمرَّر (`PERF-101`).
      heroAsset: 'assets/images/studio/hero-start-drawing.webp',
      fallbackHeroAsset: 'assets/images/coloring/v2/bird.png',
      specs: specs,
      onOpenCategory: (cat) {
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => TraceLevelEntryPage(childId: childId, cat: cat)));
      },
      onOpenMyBoards: onOpenMyBoards,
    );
  }
}

/// Live R2-first wrapper for direct use where Riverpod is available.
class TraceHomeLiveWrapper extends ConsumerWidget {
  const TraceHomeLiveWrapper({required this.childId, this.onOpenMyBoards, super.key});
  final String childId;
  final VoidCallback? onOpenMyBoards;
  @override
  Widget build(BuildContext context, WidgetRef ref) => TraceHomeWrapper(childId: childId, onOpenMyBoards: onOpenMyBoards);
}

class TraceLevelEntryPage extends ConsumerWidget {
  const TraceLevelEntryPage({required this.childId, required this.cat, super.key});
  final String childId;
  final v2impl.TraceCategorySpec cat;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Try remote catalog for this category
    final isLetters = cat.id == 'letters_ar';
    final isNumbers = cat.id == 'numbers';

    final remoteItems = isLetters
        ? ref.watch(letterCatalogueProvider).valueOrNull
        : isNumbers
            ? ref.watch(numberCatalogueProvider).valueOrNull
            : ref.watch(traceCatalogueProvider).valueOrNull;

    final hasRemote = remoteItems != null && remoteItems.isNotEmpty;
    final count = hasRemote ? remoteItems.length : cat.count;

    return Scaffold(
      backgroundColor: kDeep,
      appBar: deepAppBar(context, cat.label),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Container(
            height: 140,
            decoration: BoxDecoration(gradient: LinearGradient(colors: [cat.gradientStart, cat.gradientEnd]), borderRadius: BorderRadius.circular(18)),
            child: Row(children: [
              const SizedBox(width: 16),
              Icon(cat.icon, size: 48, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(child: Text('${cat.label}\n$count نشاط • ${cat.progress} مكتمل${hasRemote ? " • R2" : ""}', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800))),
            ]),
          ),
          const SizedBox(height: 12),
          if (hasRemote)
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 2.2, crossAxisSpacing: 10, mainAxisSpacing: 10),
              itemCount: remoteItems.length,
              itemBuilder: (_, i) {
                final item = remoteItems[i];
                return InkWell(
                  onTap: () {
                    // Build TraceLevelSpec directly from remote strokePaths
                    final paths = item.strokePaths;
                    final pts = paths.isNotEmpty
                        ? (paths.first['points'] as List).map((p) => NormalizedPoint((p[0] as num).toDouble(), (p[1] as num).toDouble())).toList()
                        : [const NormalizedPoint(0.2, 0.5), const NormalizedPoint(0.8, 0.5)];
                    final spec = TraceLevelSpec(
                      id: item.id,
                      title: item.label,
                      symbol: isLetters ? item.label.characters.first : isNumbers ? '${i + 1}' : '—',
                      strokePaths: [TraceStroke(id: '${item.id}-s0', order: 1, points: pts)],
                      totalSteps: 1,
                      currentStep: 1,
                      hint: 'اتبع المسار من الأخضر إلى الأحمر',
                    );
                    Navigator.of(context).push(MaterialPageRoute(builder: (_) => TraceBoardV2Page(level: spec, onDone: () {
                      Navigator.of(context).push(MaterialPageRoute(builder: (_) => StudioSuccessPage(title: 'رائعة!', subtitle: 'أكملت ${item.label}', preview: Center(child: Text(spec.symbol, style: const TextStyle(fontSize: 96, fontWeight: FontWeight.w900, color: Color(0xFF0C1030)))), onContinue: () => Navigator.of(context).maybePop(), onNewActivity: () => Navigator.of(context).popUntil((r) => r.isFirst))));
                    })));
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white12)),
                    padding: const EdgeInsets.all(10),
                    child: Row(children: [
                      Container(width: 38, height: 38, decoration: BoxDecoration(color: const Color(0xFF1E2A6A), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.play_arrow_rounded, color: Colors.white)),
                      const SizedBox(width: 8),
                      Expanded(child: Text(item.label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12))),
                    ]),
                  ),
                );
              },
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, childAspectRatio: 2.2, crossAxisSpacing: 10, mainAxisSpacing: 10),
              itemCount: cat.count,
              itemBuilder: (_, i) => InkWell(
                onTap: () {
                  Navigator.of(context).push(MaterialPageRoute(builder: (_) => TraceBoardEntryPage(childId: childId, levelIndex: i, cat: cat)));
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white12)),
                  padding: const EdgeInsets.all(10),
                  child: Row(children: [
                    Container(width: 38, height: 38, decoration: BoxDecoration(color: i < cat.progress ? kGreen : const Color(0xFF1E2A6A), borderRadius: BorderRadius.circular(10)), child: Icon(i < cat.progress ? Icons.check_rounded : Icons.play_arrow_rounded, color: Colors.white)),
                    const SizedBox(width: 8),
                    Expanded(child: Text('المستوى ${i + 1}', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13))),
                  ]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class TraceBoardEntryPage extends StatelessWidget {
  const TraceBoardEntryPage({required this.childId, required this.levelIndex, required this.cat, super.key});
  final String childId;
  final int levelIndex;
  final v2impl.TraceCategorySpec cat;

  TraceLevelSpec _buildSpec() {
    List<NormalizedPoint> pts;
    switch (cat.id) {
      case 'lines_straight':
        pts = [const NormalizedPoint(0.2, 0.5), const NormalizedPoint(0.8, 0.5)];
        break;
      case 'lines_curvy':
        pts = [
          const NormalizedPoint(0.15, 0.35),
          const NormalizedPoint(0.35, 0.75),
          const NormalizedPoint(0.55, 0.30),
          const NormalizedPoint(0.80, 0.60),
        ];
        break;
      case 'shapes':
        pts = List.generate(16, (i) {
          final angle = (i / 16) * 6.28318;
          return NormalizedPoint(0.5 + 0.28 * (angle < 3.14 ? 1 : -1) * (i % 2 == 0 ? 1 : 0.7), 0.5 + 0.28 * (angle > 1.57 && angle < 4.71 ? 1 : -1) * 0.6).clamp01();
        });
        break;
      case 'numbers':
        pts = [const NormalizedPoint(0.2, 0.2), const NormalizedPoint(0.8, 0.2), const NormalizedPoint(0.8, 0.8)];
        break;
      case 'letters_ar':
        pts = [
          const NormalizedPoint(0.2, 0.4),
          const NormalizedPoint(0.4, 0.2),
          const NormalizedPoint(0.6, 0.4),
          const NormalizedPoint(0.4, 0.7),
        ];
        break;
      case 'maze':
        pts = [
          const NormalizedPoint(0.15, 0.15),
          const NormalizedPoint(0.85, 0.15),
          const NormalizedPoint(0.85, 0.85),
          const NormalizedPoint(0.15, 0.85),
        ];
        break;
      case 'waves':
        pts = List.generate(10, (i) => NormalizedPoint(0.1 + i * 0.08, 0.5 + (i % 2 == 0 ? -0.2 : 0.2)));
        break;
      default:
        pts = [const NormalizedPoint(0.2, 0.5), const NormalizedPoint(0.8, 0.5)];
    }
    final symbol = cat.id.contains('letters_ar')
        ? 'أ'
        : cat.id.contains('numbers')
            ? '${levelIndex + 1}'
            : cat.id.contains('shapes')
                ? 'م'
                : cat.id.contains('lines')
                    ? '—'
                    : cat.id.contains('maze')
                        ? '⧉'
                        : '〰';
    return TraceLevelSpec(
      id: '${cat.id}-$levelIndex',
      title: '${cat.label} ${levelIndex + 1}',
      symbol: symbol,
      strokePaths: [TraceStroke(id: '${cat.id}-$levelIndex-s0', order: 1, points: pts)],
      totalSteps: 4,
      currentStep: (levelIndex % 4) + 1,
      hint: 'اتبع المسار من النقطة الخضراء ١ إلى الحمراء ٢ • ${((levelIndex % 4) + 1)} من 4',
    );
  }

  @override
  Widget build(BuildContext context) {
    final spec = _buildSpec();
    return TraceBoardV2Page(
      level: spec,
      onDone: () {
        Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => StudioSuccessPage(
            title: 'رائعة!',
            subtitle: 'أكملت ${cat.label} ${levelIndex + 1}',
            preview: Center(
              child: Text(
                spec.symbol,
                style: const TextStyle(
                  fontSize: 96,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF0C1030),
                ),
              ),
            ),
            onContinue: () => Navigator.of(context).maybePop(),
            onNewActivity: () =>
                Navigator.of(context).popUntil((r) => r.isFirst),
          ),
        ));
      },
    );
  }
}

extension _NPClamp on NormalizedPoint {
  NormalizedPoint clamp01() => NormalizedPoint(x.clamp(0.05, 0.95), y.clamp(0.05, 0.95));
}
