import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/layout/app_layout.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../application/home_providers.dart';
import '../../domain/content_models.dart';
import '../../../games/application/game_providers.dart';
import '../widgets/content_cards.dart';
import '../widgets/content_rail.dart';

class PlayPage extends ConsumerWidget {
  const PlayPage({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final catalogAsync = ref.watch(homeCatalogProvider);
    final gamesAsync = ref.watch(gameCatalogProvider);
    return catalogAsync.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, s) => Scaffold(body: Center(child: Text('تعذّر التحميل'))),
      data: (catalog) {
        final padding = context.horizontalPagePadding;
        final games = gamesAsync.valueOrNull ?? catalog.experiences.where((e) => e.isServerBacked).toList();
        final byPlanet = <String, List<ExperienceItem>>{};
        for (final g in games) { final pid = g.planetId ?? 'other'; byPlanet.putIfAbsent(pid, () => []).add(g); }
        return Scaffold(
          backgroundColor: AppColors.deepSpace,
          appBar: AppBar(title: const Text('العب'), backgroundColor: AppColors.deepSpace, foregroundColor: Colors.white),
          body: CinematicBackground(
            child: CustomScrollView(slivers: [
              if (games.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<ExperienceItem>(title: 'ألعاب مميزة', items: games.take(6).toList(), height: 266, horizontalPadding: padding, itemBuilder: (c, item, i) => ExperienceCard(item: item, isTelevision: false, onPressed: () => context.push('/game/${item.id}')))),
                ),
              for (final planet in catalog.planets)
                if ((byPlanet[planet.id]?.isNotEmpty ?? false))
                  SliverToBoxAdapter(
                    child: Padding(padding: const EdgeInsets.only(top: 22), child: ContentRail<ExperienceItem>(title: planet.name, subtitle: planet.description, items: byPlanet[planet.id]!.take(6).toList(), height: 266, horizontalPadding: padding, itemBuilder: (c, item, i) => ExperienceCard(item: item, isTelevision: false, onPressed: () => context.push('/game/${item.id}')))),
                  ),
              SliverToBoxAdapter(
                child: Padding(padding: EdgeInsets.all(padding), child: FilledButton.icon(onPressed: () => context.push('/studio'), icon: const Icon(Icons.brush_rounded), label: const Text('استوديو الإبداع'))),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 80)),
            ]),
          ),
        );
      },
    );
  }
}
