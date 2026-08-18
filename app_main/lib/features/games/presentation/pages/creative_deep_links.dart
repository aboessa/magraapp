/// Deep-link pages — open creative content by canonical ID, no `extra` required.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../application/creation_cloud_service.dart'
    show localCreationStoreProvider;
import '../../application/creative_catalogue_provider.dart';
import '../../data/creative_catalogue.dart';
import '../../data/local_creation_store.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_services.dart';
import '../../engine/game_session_controller.dart';
import 'creative_studio_page.dart' show ColoringActivityHost, TraceActivityHost;
import 'reference_catalogue_page.dart' show ReferenceActivity;
import 'reference_drawing_page.dart';

class _DeepLinkScaffold extends StatelessWidget {
  const _DeepLinkScaffold({required this.title, required this.child});
  final String title;
  final Widget child;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(title)),
    body: child,
  );
}

/// /studio/coloring/:id
class ColoringDeepLinkPage extends ConsumerStatefulWidget {
  const ColoringDeepLinkPage({
    required this.childId,
    required this.template,
    super.key,
  });

  final String childId;
  final ColoringTemplate template;

  @override
  ConsumerState<ColoringDeepLinkPage> createState() =>
      _ColoringDeepLinkPageState();
}

class _ColoringDeepLinkPageState extends ConsumerState<ColoringDeepLinkPage> {
  late final GameSessionController _controller;

  @override
  void initState() {
    super.initState();
    final template = widget.template;
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-color-${template.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [template.assetId],
        'audio': <String>[],
      },
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'coloring',
          'scoring': 'none',
          'prompt_key': 'game.color.${template.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': true,
            'palette': template.palette,
            'regions': template.regions.map((r) => r.toJson()).toList(),
            'template_asset': template.assetId,
          },
        },
      ],
    });
    _controller = GameSessionController(
      pack: pack,
      gameId: 'studio-color-${template.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'deep-${DateTime.now().microsecondsSinceEpoch}',
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = ref.watch(localCreationStoreProvider);
    return Scaffold(
      appBar: AppBar(title: Text(widget.template.label)),
      body: ColoringActivityHost(
        controller: _controller,
        creationStore: store,
        disposeController: false,
      ),
    );
  }
}

/// Thin wrappers used by router — resolve via provider then delegate.
class ColoringDeepLinkResolver extends ConsumerWidget {
  const ColoringDeepLinkResolver({
    required this.childId,
    required this.templateId,
    super.key,
  });
  final String childId;
  final String templateId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coloringCatalogueAsync(templateId));
    return async.when(
      loading: () => _DeepLinkScaffold(
        title: 'تلوين — $templateId',
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => _DeepLinkScaffold(
        title: 'تلوين — $templateId',
        child: Center(child: Text('خطأ: $e')),
      ),
      data: (tpl) => tpl == null
          ? _DeepLinkScaffold(
              title: 'تلوين — $templateId',
              child: Center(child: Text('غير موجود: $templateId')),
            )
          : ColoringDeepLinkPage(childId: childId, template: tpl),
    );
  }
}

class ReferenceDeepLinkResolver extends ConsumerWidget {
  const ReferenceDeepLinkResolver({
    required this.childId,
    required this.activityId,
    super.key,
  });
  final String childId;
  final String activityId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(referenceActivityAsync(activityId));
    return async.when(
      loading: () => _DeepLinkScaffold(
        title: 'ارسم مثلي — $activityId',
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => _DeepLinkScaffold(
        title: 'ارسم مثلي — $activityId',
        child: Center(child: Text('خطأ: $e')),
      ),
      data: (act) {
        if (act == null) {
          return _DeepLinkScaffold(
            title: 'ارسم مثلي — $activityId',
            child: Center(child: Text('غير موجود: $activityId')),
          );
        }
        final store = ref.watch(localCreationStoreProvider);
        // Adapt CreativeReferenceActivity -> ReferenceActivity
        final adapted = ReferenceActivity(
          id: act.id,
          titleAr: act.titleAr,
          titleEn: act.titleEn,
          category: act.category,
          ageLabel: act.ageLabel,
          difficulty: act.difficulty,
          referenceAssetId: act.referenceAssetId,
          thumbnailAssetId: act.thumbnailAssetId,
        );
        return ReferenceDrawingPage(
          childId: childId,
          activity: adapted,
          creationStore: store,
        );
      },
    );
  }
}

class TraceDeepLinkResolver extends ConsumerWidget {
  const TraceDeepLinkResolver({
    required this.childId,
    required this.itemId,
    super.key,
  });
  final String childId;
  final String itemId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(traceItemAsync(itemId));
    return async.when(
      loading: () => _DeepLinkScaffold(
        title: 'تتبّع — $itemId',
        child: const Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => _DeepLinkScaffold(
        title: 'تتبّع — $itemId',
        child: Center(child: Text('خطأ: $e')),
      ),
      data: (item) {
        if (item == null) {
          return _DeepLinkScaffold(
            title: 'تتبّع — $itemId',
            child: Center(child: Text('غير موجود: $itemId')),
          );
        }
        final store = ref.watch(localCreationStoreProvider);
        return _TraceDeepLinkPage(
          key: ValueKey(item.id),
          childId: childId,
          item: item,
          creationStore: store,
        );
      },
    );
  }
}

class _TraceDeepLinkPage extends StatefulWidget {
  const _TraceDeepLinkPage({
    required this.childId,
    required this.item,
    required this.creationStore,
    super.key,
  });

  final String childId;
  final StudioCatalogItem item;
  final LocalCreationStore creationStore;

  @override
  State<_TraceDeepLinkPage> createState() => _TraceDeepLinkPageState();
}

class _TraceDeepLinkPageState extends State<_TraceDeepLinkPage> {
  late final GameSessionController _controller;

  @override
  void initState() {
    super.initState();
    final item = widget.item;
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-trace-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-shape-template-circle'],
        'audio': <String>[],
      },
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': item.mode ?? 'shape',
          'scoring': 'geometric',
          'prompt_key': 'game.trace.${item.id}.prompt',
          'completion': {'rule': 'all_strokes_complete'},
          'stroke_paths': item.strokePaths.isEmpty
              ? [
                  {
                    'id': 's1',
                    'order': 1,
                    'points': [
                      [0.2, 0.5],
                      [0.8, 0.5],
                    ],
                  },
                ]
              : item.strokePaths,
          'tolerance_dp': 24,
          'coverage_required': 0.8,
          'background_asset': item.assetId,
        },
      ],
    });
    _controller = GameSessionController(
      pack: pack,
      gameId: 'studio-trace-${item.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'deep-${DateTime.now().microsecondsSinceEpoch}',
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TraceActivityHost(
    title: widget.item.label,
    controller: _controller,
    creationStore: widget.creationStore,
    drawingMode: 'trace',
    disposeController: false,
  );
}

class _NoopReporter implements AttemptReporter {
  @override
  Future<void> report(GameAttempt attempt) async {}
}
