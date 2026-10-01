import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/env/app_environment.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/home_providers.dart';
import '../../data/local_catalog.dart';
import '../../domain/content_models.dart';
import '../../../games/application/game_providers.dart';
import '../../../games/application/play_catalog.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

class PlayPage extends ConsumerWidget {
  const PlayPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    final gamesAsync = ref.watch(gameCatalogProvider);
    return catalogAsync.when(
      loading: () => Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, s) => Scaffold(
        body: Center(child: Text(AppLocalizationsAr().homeplaypageBuild01)),
      ),
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        // `APP-103`: الخادم هو المصدر، والحزمة بديلُ انقطاعٍ **مُعلَن**.
        //
        // كان هنا دمجٌ بلا شرط: ألعاب الخادم، ثم `LocalCatalog.experiences`
        // مباشرةً، ثم `catalog.experiences`. فيرى الطفل ألعابًا من الحزمة والشبكة
        // سليمة تمامًا — وردّ `fetchGames(childId:)` هو ما يطبّق حالة النشر
        // والمسار العمري والاستحقاق، والعنصر المبندل لا يحمل حالةً ولا عمرًا.
        //
        // حالة الطلب جزء من قرار المصدر: AsyncData([]) ردّ حاكم، بينما الخطأ
        // وحده يسمح بمسار الانقطاع، والتحميل لا يعرض كتالوجًا أقدم مؤقتًا.
        final serverState = gamesAsync.hasValue
            ? PlayServerState.completed
            : gamesAsync.hasError
            ? PlayServerState.error
            : PlayServerState.loading;
        final resolved = resolvePlayableGames(
          serverState: serverState,
          server: gamesAsync.valueOrNull ?? const <ExperienceItem>[],
          catalog: catalog.experiences,
          // `APP-202`: لا ألعاب محزومة في الإنتاج؛ فشل الخادم يُعرض كانقطاع.
          bundled: AppConfig.isProduction
              ? const <ExperienceItem>[]
              : LocalCatalog.experiences,
          catalogIsBundled: catalog.usesBundledCatalog,
          allowBundledFallback:
              catalog.usesBundledCatalog ||
              serverState == PlayServerState.error,
        );
        final games = resolved.games;

        // `APP-103`: حُذف «البديل المطلق» — ثلاث ألعاب مكتوبة في الكود تُضاف حين
        // يخلو كل شيء. المصدر الرابع لا يزيد يقينًا: يزيد احتمال أن يُعرَض على
        // الطفل ما لا يعرفه الخادم. وخلوُّ الشاشة حالةٌ لها عرضها أدناه.

        final byPlanet = <String, List<ExperienceItem>>{};
        for (final g in games) {
          final pid = g.planetId ?? 'other';
          byPlanet.putIfAbsent(pid, () => []).add(g);
        }

        // Group by engine for better discovery when many games
        final byEngine = <String, List<ExperienceItem>>{};
        for (final g in games) {
          final engine = _engineFromId(g.id);
          byEngine.putIfAbsent(engine, () => []).add(g);
        }

        if (serverState == PlayServerState.loading) {
          return Scaffold(
            backgroundColor: AppColors.deepSpace,
            appBar: AppBar(
              title: Text(AppLocalizationsAr().homeplaypageText01),
              backgroundColor: AppColors.deepSpace,
              foregroundColor: Colors.white,
            ),
            body: const CinematicBackground(
              child: Center(child: CircularProgressIndicator()),
            ),
          );
        }

        if (games.isEmpty) {
          return Scaffold(
            backgroundColor: AppColors.deepSpace,
            appBar: AppBar(
              title: const Text('العب'),
              backgroundColor: AppColors.deepSpace,
              foregroundColor: Colors.white,
            ),
            body: CinematicBackground(
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.all(padding),
                      child: Column(
                        children: [
                          const SizedBox(height: 60),
                          const Icon(
                            Icons.extension_off_rounded,
                            color: Colors.white38,
                            size: 64,
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'لا توجد ألعاب مناسبة لك الآن. جرّب التحديث بعد قليل.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 24),
                          OutlinedButton.icon(
                            key: const Key('play_empty_retry'),
                            onPressed: () =>
                                ref.invalidate(gameCatalogProvider),
                            icon: const Icon(Icons.refresh_rounded),
                            label: const Text('تحديث الألعاب'),
                          ),
                          const SizedBox(height: 12),
                          FilledButton.icon(
                            onPressed: () => context.push('/studio'),
                            icon: const Icon(Icons.brush_rounded),
                            label: const Text('استوديو الإبداع'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        }

        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(
            title: Text(
              'العب • ${games.length} لعبة',
              style: const TextStyle(color: Colors.white),
            ),
            backgroundColor: AppColors.deepSpace,
            foregroundColor: Colors.white,
          ),
          body: CinematicBackground(
            child: CustomScrollView(
              slivers: [
                // `APP-103`: استخدام الحزمة المبندلة **يُقال**، كما تقوله الرئيسية.
                // هذه الشاشة كانت تعرضها بلا أي إشارة، فيقرأها الطفل ووليّ أمره
                // كأنها ما نشره الخادم.
                if (resolved.usesBundled)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(padding, 14, padding, 0),
                      child: _OfflineLibraryNotice(
                        onRefresh: () {
                          ref.invalidate(gameCatalogProvider);
                          ref.invalidate(homeCatalogProvider);
                        },
                      ),
                    ),
                  ),
                // Featured
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(top: 22),
                    child: ContentRail<ExperienceItem>(
                      title: 'ألعاب مميزة • ${games.length}',
                      items: games.take(8).toList(),
                      height: 266,
                      horizontalPadding: padding,
                      itemBuilder: (c, item, i) => ExperienceCard(
                        item: item,
                        isTelevision: false,
                        onPressed: () => context.push('/game/${item.id}'),
                      ),
                    ),
                  ),
                ),
                // By engine (so 12 engines all discoverable)
                for (final entry in byEngine.entries)
                  if (entry.value.length >= 2)
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 22),
                        child: ContentRail<ExperienceItem>(
                          title: _engineLabel(entry.key),
                          subtitle: '${entry.value.length} ألعاب',
                          items: entry.value,
                          height: 266,
                          horizontalPadding: padding,
                          itemBuilder: (c, item, i) => ExperienceCard(
                            item: item,
                            isTelevision: false,
                            onPressed: () => context.push('/game/${item.id}'),
                          ),
                        ),
                      ),
                    ),
                // By planet (legacy)
                for (final planet in catalog.planets)
                  if ((byPlanet[planet.id]?.isNotEmpty ?? false))
                    SliverToBoxAdapter(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 22),
                        child: ContentRail<ExperienceItem>(
                          title: planet.name,
                          subtitle: planet.description,
                          items: byPlanet[planet.id]!,
                          height: 266,
                          horizontalPadding: padding,
                          itemBuilder: (c, item, i) => ExperienceCard(
                            item: item,
                            isTelevision: false,
                            onPressed: () => context.push('/game/${item.id}'),
                          ),
                        ),
                      ),
                    ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(padding),
                    child: FilledButton.icon(
                      onPressed: () => context.push('/studio'),
                      icon: const Icon(Icons.brush_rounded),
                      label: const Text('استوديو الإبداع'),
                    ),
                  ),
                ),
                const SliverToBoxAdapter(child: SizedBox(height: 80)),
              ],
            ),
          ),
        );
      },
    );
  }
}

String _engineFromId(String id) {
  if (id.contains('memory')) return 'memory_flip';
  if (id.contains('match') || id.contains('picture')) return 'match_pairs';
  if (id.contains('sort') || id.contains('color-sort')) return 'sort_bins';
  if (id.contains('sequence')) return 'sequence_order';
  if (id.contains('count')) return 'count_quantity';
  if (id.contains('logic')) return 'logic_pattern';
  if (id.contains('word') ||
      id.contains('letter') ||
      id.contains('tracing-word')) {
    return 'word_build';
  }
  if (id.contains('rhythm')) return 'rhythm_tap';
  if (id.contains('block') || id.contains('maze')) return 'block_code';
  if (id.contains('sim') || id.contains('plant') || id.contains('lab')) {
    return 'sim_lab';
  }
  if (id.contains('timeline') ||
      id.contains('egypt') ||
      id.contains('civilization')) {
    return 'timeline_map';
  }
  if (id.contains('shape') ||
      id.contains('number') ||
      id.contains('letter') ||
      id.contains('trace')) {
    return 'trace_color';
  }
  return 'other';
}

String _engineLabel(String engineId) {
  final labels = {
    'match_pairs': 'المطابقة',
    'trace_color': 'التتبّع والتلوين',
    'sort_bins': 'التصنيف',
    'memory_flip': 'الذاكرة',
    'count_quantity': 'العدّ والكميات',
    'sequence_order': 'التسلسل',
    'word_build': 'بناء الكلمات',
    'rhythm_tap': 'الإيقاع',
    'logic_pattern': 'الأنماط والمنطق',
    'block_code': 'البرمجة',
    'sim_lab': 'المختبر',
    'timeline_map': 'الزمن والخريطة',
    'other': 'ألعاب أخرى',
  };
  return labels[engineId] ?? engineId;
}

/// إشعار «هذه المكتبة المحلية لا المنشورة» على شاشة «العب» (`APP-103`).
///
/// نصُّه ونبرته من `_FallbackNotice` في الرئيسية عن قصد: نفس الحالة تُقال بنفس
/// الكلمات في كل شاشة، وإلا قرأ وليّ الأمر رسالتين مختلفتين لسببٍ واحد.
///
/// و`liveRegion` كي يُنطَق للقارئ الصوتي عند ظهوره: الإشعار الذي لا يُنطَق غائبٌ
/// عمّن يحتاجه أكثر.
class _OfflineLibraryNotice extends StatelessWidget {
  const _OfflineLibraryNotice({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.indigoSurface.withValues(alpha: 0.76),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: AppColors.electricCyan.withValues(alpha: 0.18),
          ),
        ),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(14, 7, 8, 7),
          child: Row(
            children: [
              const Icon(
                Icons.cloud_off_outlined,
                color: AppColors.electricCyan,
                size: 20,
              ),
              const SizedBox(width: 9),
              const Expanded(
                child: Text(
                  'نعرض المكتبة المحلية الآمنة حتى يصبح المحتوى المنشور متاحًا.',
                  style: TextStyle(color: AppColors.starlight),
                ),
              ),
              IconButton(
                tooltip: 'تحديث المحتوى',
                onPressed: onRefresh,
                icon: const Icon(Icons.refresh_rounded, color: Colors.white70),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
