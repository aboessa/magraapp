/// Creative Studio — polished home discovering every production creative experience.
/// Sections: Continue Drawing, ارسم بحرية, لوّن, تتبّع, الحروف, الأرقام, صل النقاط, أكمل الرسمة, انسخ النمط, ارسم من الفكرة
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/creation_document.dart';
import '../../data/local_creation_store.dart';
import '../widgets/drawing_asset.dart';
import '../../application/creative_catalogue_provider.dart';
import '../../data/creative_catalogue.dart';
import '../../engine/coloring_regions.dart' show ColorRegion;
import '../../engine/free_draw_surface.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_services.dart';
import '../../engine/game_session_controller.dart';
import '../../engine/trace_color_engine.dart' show TraceColorSurface;
import '../../engine/trace_geometry.dart' show NormalizedPoint;
import 'my_boards_page.dart';
import 'reference_catalogue_page.dart';

class CreativeStudioPage extends StatefulWidget {
  const CreativeStudioPage({
    required this.childId,
    required this.creationStore,
    this.initialDocument,
    this.initialCreation,
    this.onSaved,
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final CreationDocument? initialDocument;
  final LocalCreation? initialCreation;
  final VoidCallback? onSaved;

  @override
  State<CreativeStudioPage> createState() => _CreativeStudioPageState();
}

class _CreativeStudioPageState extends State<CreativeStudioPage> {
  List<LocalCreation> _creations = const [];
  bool _loadingCreations = true;
  Object? _creationError;

  @override
  void initState() {
    super.initState();
    unawaited(_loadCreations());
  }

  Future<void> _loadCreations() async {
    if (mounted) {
      setState(() {
        _loadingCreations = true;
        _creationError = null;
      });
    }
    try {
      final list = await widget.creationStore.list(widget.childId);
      if (!mounted) return;
      setState(() {
        _creations = list;
        _loadingCreations = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _creationError = error;
        _loadingCreations = false;
      });
    }
  }

  void _handleSaved() {
    widget.onSaved?.call();
    unawaited(_loadCreations());
  }

  @override
  Widget build(BuildContext context) {
    final initialDocument = widget.initialDocument;
    if (initialDocument != null) {
      return _FreeDrawHost(
        childId: widget.childId,
        creationStore: widget.creationStore,
        gameId: widget.initialCreation?.gameId ?? 'studio-free',
        drawingMode:
            widget.initialCreation?.drawingMode ?? initialDocument.mode,
        initialDocument: initialDocument,
        continueCreation: widget.initialCreation,
        onSaved: widget.onSaved,
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('الاستوديو الإبداعي')),
      body: RefreshIndicator(
        onRefresh: _loadCreations,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildContinueSection(context),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => MyBoardsPage(
                            childId: widget.childId,
                            creationStore: widget.creationStore,
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.dashboard_customize_outlined),
                      label: const Text('لوحاتي'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.tonalIcon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => ReferenceCataloguePage(
                            childId: widget.childId,
                            creationStore: widget.creationStore,
                            onSaved: _handleSaved,
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.content_copy),
                      label: const Text('ارسم مثلي'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _buildStartSection(context),
              const SizedBox(height: 20),
              _CatalogColoringSection(
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
              ),
              _CatalogGenericSection(
                title: 'تتبّع',
                subtitle: 'تتبّع الخطوط والأشكال',
                provider: traceCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.trace,
              ),
              _CatalogGenericSection(
                title: 'الحروف',
                subtitle: 'تتبّع الحروف العربية',
                provider: letterCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.trace,
              ),
              _CatalogGenericSection(
                title: 'الأرقام',
                subtitle: 'تتبّع الأرقام ١-١٠',
                provider: numberCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.number,
              ),
              _CatalogGenericSection(
                title: 'صل النقاط',
                subtitle: 'صل بالترتيب',
                provider: dotsCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.dots,
              ),
              _CatalogGenericSection(
                title: 'أكمل الرسمة',
                subtitle: 'أكمل الجزء الناقص',
                provider: completeCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.complete,
              ),
              _CatalogGenericSection(
                title: 'انسخ النمط',
                subtitle: 'انسخ التسلسل',
                provider: copyCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.copy,
              ),
              _CatalogGenericSection(
                title: 'ارسم من الفكرة',
                subtitle: 'ارسم ما تتخيله',
                provider: promptCatalogueProvider,
                childId: widget.childId,
                creationStore: widget.creationStore,
                onSaved: _handleSaved,
                kind: _CatalogKind.prompt,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildContinueSection(BuildContext context) {
    if (_loadingCreations) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: CircularProgressIndicator(),
        ),
      );
    }
    if (_creationError != null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const Icon(Icons.cloud_off_outlined, size: 44),
              const SizedBox(height: 8),
              Text(
                'تعذر تحميل رسوماتك',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              const Text(
                'رسوماتك ما زالت محفوظة على هذا الجهاز. حاول فتحها مرة أخرى.',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: _loadCreations,
                icon: const Icon(Icons.refresh),
                label: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
      );
    }

    final editable = _creations
        .where((creation) => creation.isEditable)
        .take(6)
        .toList();
    if (editable.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              const Icon(Icons.brush_outlined, size: 48),
              const SizedBox(height: 8),
              Text(
                'ابدأ أول رسمة لك',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              const Text(
                'ارسم بحرية أو اختر قالب تلوين للبدء',
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: () => _openFreeDraw(context),
                icon: const Icon(Icons.brush),
                label: const Text('ارسم الآن'),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              'متابعة الرسم',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const Spacer(),
            TextButton.icon(
              onPressed: _loadCreations,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('تحديث'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 140,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: editable.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final creation = editable[index];
              final raw = creation.documentJson;
              final document = raw == null
                  ? null
                  : CreationDocument.tryParse(raw);
              return SizedBox(
                width: 120,
                child: Card(
                  clipBehavior: Clip.antiAlias,
                  margin: EdgeInsets.zero,
                  child: Semantics(
                    button: true,
                    label: 'متابعة ${creation.displayTitle}',
                    child: InkWell(
                      onTap: document == null
                          ? null
                          : () => _openContinue(context, creation, document),
                      child: Column(
                        children: [
                          Expanded(
                            child: ExcludeSemantics(
                              child: Image.memory(
                                creation.bytes,
                                fit: BoxFit.cover,
                                width: 120,
                                errorBuilder: (_, __, ___) => const Center(
                                  child: Icon(Icons.broken_image_outlined),
                                ),
                              ),
                            ),
                          ),
                          ColoredBox(
                            color: Theme.of(
                              context,
                            ).colorScheme.surfaceContainerHighest,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 5,
                              ),
                              child: Center(
                                child: Text(
                                  document?.mode ?? creation.drawingMode,
                                  style: Theme.of(context).textTheme.labelSmall,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildStartSection(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer,
      child: InkWell(
        onTap: () => _openFreeDraw(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ابدأ الرسم',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    const Text('لوحة بيضاء فارغة — ارسم ما تحب'),
                  ],
                ),
              ),
              Container(
                width: 90,
                height: 90,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(8),
                  child: DrawingAsset(
                    assetIdOrPath: 'asset-free-cover',
                    fit: BoxFit.contain,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_ios, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  // ignore: unused_element — retained as canonical fallback builder (offline safety)
  Widget _buildSection(
    BuildContext context, {
    required String title,
    required String subtitle,
    required List<_StudioItem> items,
    required void Function(BuildContext, _StudioItem) onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 160,
            childAspectRatio: 0.95,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: items.length,
          itemBuilder: (ctx, i) {
            final it = items[i];
            return Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => onTap(context, it),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Container(
                        color: it.bg,
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: it.previewAssetId != null
                              ? DrawingAsset(
                                  assetIdOrPath: it.previewAssetId!,
                                  fit: BoxFit.contain,
                                )
                              : Icon(it.icon, size: 36, color: Colors.white),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      child: Text(
                        it.label,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 6),
      ],
    );
  }

  void _openFreeDraw(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: widget.childId,
          creationStore: widget.creationStore,
          gameId: 'studio-free',
          drawingMode: 'free_draw',
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  void _openContinue(
    BuildContext context,
    LocalCreation creation,
    CreationDocument document,
  ) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: widget.childId,
          creationStore: widget.creationStore,
          gameId: creation.gameId,
          drawingMode: creation.drawingMode,
          initialDocument: document,
          continueCreation: creation,
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  // ignore: unused_element — retained as canonical fallback path (offline safety)
  void _openColoring(BuildContext context, _StudioItem item) {
    final regions = item.regions ?? [];
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-color-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-color-bird'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'coloring',
          'scoring': 'none',
          'prompt_key': 'game.color.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': true,
            'palette':
                item.palette ?? ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2'],
            'regions': regions.map((r) => r.toJson()).toList(),
            'template_asset': item.assetId,
          },
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-color-${item.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () =>
          'studio-color-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(item.label)),
          body: ColoringActivityHost(
            controller: ctrl,
            creationStore: widget.creationStore,
            onSaved: _handleSaved,
          ),
        ),
      ),
    );
  }

  // ignore: unused_element
  void _openTrace(BuildContext context, _StudioItem item) {
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
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': item.mode ?? 'shape',
          'scoring': 'geometric',
          'prompt_key': 'game.trace.${item.id}.prompt',
          'completion': {'rule': 'all_strokes_complete'},
          'stroke_paths':
              item.strokePaths ??
              [
                {
                  'id': 's1',
                  'order': 1,
                  'points': [
                    [0.2, 0.5],
                    [0.8, 0.5],
                  ],
                },
              ],
          'tolerance_dp': 24,
          'coverage_required': 0.8,
          'background_asset': item.assetId,
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-trace-${item.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: widget.creationStore,
          drawingMode: 'trace',
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  // ignore: unused_element
  void _openDots(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-dots-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-dots-star'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'connect_dots',
          'scoring': 'sequence',
          'prompt_key': 'game.dots.${item.id}.prompt',
          'completion': {'rule': 'all_dots_connected'},
          'dots':
              item.dots ??
              [
                {
                  'id': 'd1',
                  'order': 1,
                  'at': [0.2, 0.2],
                },
                {
                  'id': 'd2',
                  'order': 2,
                  'at': [0.8, 0.2],
                },
              ],
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-dots-${item.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: widget.creationStore,
          drawingMode: 'connect_dots',
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  // ignore: unused_element
  void _openComplete(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-complete-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-complete-half-sun'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'complete_drawing',
          'scoring': 'none',
          'prompt_key': 'game.complete.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'background_asset': item.assetId,
          'coloring': {
            'enabled': false,
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE'],
          },
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-complete-${item.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: widget.creationStore,
          drawingMode: 'complete_drawing',
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  // ignore: unused_element
  void _openCopy(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-copy-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-copy-pattern'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'copy_pattern',
          'scoring': 'none',
          'prompt_key': 'game.copy.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'background_asset': item.assetId,
          'stroke_paths': [
            {
              'id': 's1',
              'order': 1,
              'points': [
                [0.2, 0.5],
                [0.8, 0.5],
              ],
            },
          ],
          'tolerance_dp': 28,
          'coverage_required': 0.7,
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-copy-${item.id}',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: widget.creationStore,
          drawingMode: 'copy_pattern',
          onSaved: _handleSaved,
        ),
      ),
    );
  }

  // ignore: unused_element
  void _openPrompt(BuildContext context, _StudioItem item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: widget.childId,
          creationStore: widget.creationStore,
          gameId: 'studio-prompt-${item.id}',
          drawingMode: 'prompt_drawing',
          promptOverride: item.label,
          onSaved: _handleSaved,
        ),
      ),
    );
  }
}

/// Coloring section driven by CMS/bundled JSON, not Dart literals.
/// Falls back to `_coloringItems` only if the provider is empty (offline first launch safety).
class _CatalogColoringSection extends ConsumerWidget {
  const _CatalogColoringSection({
    required this.childId,
    required this.creationStore,
    required this.onSaved,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final VoidCallback? onSaved;

  Color _bgOf(ColoringTemplate t) {
    final h = t.bgHex;
    if (h == null || h.isEmpty) return const Color(0xFF0F172A);
    final v = int.tryParse(h, radix: 16);
    if (v == null) return const Color(0xFF0F172A);
    return Color(0xFF000000 | v);
  }

  void _openTemplate(BuildContext context, ColoringTemplate tpl) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-color-${tpl.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [tpl.assetId],
        'audio': <String>[],
      },
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'coloring',
          'scoring': 'none',
          'prompt_key': 'game.color.${tpl.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': true,
            'palette': tpl.palette,
            'regions': tpl.regions.map((r) => r.toJson()).toList(),
            'template_asset': tpl.assetId,
          },
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-color-${tpl.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () =>
          'studio-color-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(tpl.label)),
          body: ColoringActivityHost(
            controller: ctrl,
            creationStore: creationStore,
            onSaved: onSaved,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(coloringCatalogueProvider);
    return async.when(
      loading: () => const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (e, _) => _fallbackSection(context),
      data: (list) {
        if (list.isEmpty) return _fallbackSection(context);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('لوّن', style: Theme.of(context).textTheme.titleMedium),
            Text(
              'اختر صورة ولوّن كل جزء',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 160,
                childAspectRatio: 0.95,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: list.length,
              itemBuilder: (ctx, i) {
                final tpl = list[i];
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => _openTemplate(context, tpl),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: Container(
                            color: _bgOf(tpl),
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: DrawingAsset(
                                assetIdOrPath: tpl.assetId,
                                fit: BoxFit.contain,
                              ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          child: Text(
                            tpl.label,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelMedium,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 6),
          ],
        );
      },
    );
  }

  Widget _fallbackSection(BuildContext context) {
    // Safety: show literal catalogue if provider empty (never primary)
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('لوّن', style: Theme.of(context).textTheme.titleMedium),
        Text(
          'اختر صورة ولوّن كل جزء',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 160,
            childAspectRatio: 0.95,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: _coloringItems.length,
          itemBuilder: (ctx, i) {
            final it = _coloringItems[i];
            return Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () {
                  final regions = it.regions ?? [];
                  final pack = GamePack.fromJson({
                    'pack_version': 1,
                    'engine_id': 'trace_color',
                    'pack_id': 'studio-color-${it.id}',
                    'localization': 'language_neutral',
                    'supports_dpad': false,
                    'progression': {
                      'levels_to_finish': 1,
                      'advance_on': 'manual',
                    },
                    'accessibility': {
                      'simplified_motor': {
                        'tolerance_dp': 40,
                        'coverage_required': 0.6,
                      },
                      'sequential_tap_alternative': true,
                      'min_touch_target_dp': 48,
                    },
                    'assets': {
                      'images': [it.assetId ?? 'asset-color-bird'],
                      'audio': [],
                    },
                    'voice_manifest': <String, Object?>{},
                    'levels': [
                      {
                        'level': 1,
                        'mode': 'coloring',
                        'scoring': 'none',
                        'prompt_key': 'game.color.${it.id}.prompt',
                        'completion': {'rule': 'child_taps_done'},
                        'coloring': {
                          'enabled': true,
                          'palette':
                              it.palette ??
                              ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2'],
                          'regions': regions.map((r) => r.toJson()).toList(),
                          'template_asset': it.assetId,
                        },
                      },
                    ],
                  });
                  final ctrl = GameSessionController(
                    pack: pack,
                    gameId: 'studio-color-${it.id}',
                    childId: childId,
                    ageTrack: AgeTrack.kids,
                    audio: SilentGameAudioService(),
                    reporter: _NoopReporter(),
                    eventIdFactory: () =>
                        'studio-color-${DateTime.now().microsecondsSinceEpoch}',
                  );
                  Navigator.of(ctx).push(
                    MaterialPageRoute<void>(
                      builder: (_) => Scaffold(
                        appBar: AppBar(title: Text(it.label)),
                        body: ColoringActivityHost(
                          controller: ctrl,
                          creationStore: creationStore,
                          onSaved: onSaved,
                        ),
                      ),
                    ),
                  );
                },
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Container(
                        color: it.bg,
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: it.previewAssetId != null
                              ? DrawingAsset(
                                  assetIdOrPath: it.previewAssetId!,
                                  fit: BoxFit.contain,
                                )
                              : Icon(it.icon, size: 36, color: Colors.white),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      child: Text(
                        it.label,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 6),
      ],
    );
  }
}

enum _CatalogKind { trace, letter, number, dots, complete, copy, prompt }

class _CatalogGenericSection extends ConsumerWidget {
  const _CatalogGenericSection({
    required this.title,
    required this.subtitle,
    required this.provider,
    required this.childId,
    required this.creationStore,
    required this.kind,
    this.onSaved,
  });

  final String title;
  final String subtitle;
  final FutureProvider<List<StudioCatalogItem>> provider;
  final String childId;
  final LocalCreationStore creationStore;
  final _CatalogKind kind;
  final VoidCallback? onSaved;

  IconData _iconForPrompt(String id) => switch (id) {
    'home' => Icons.home_outlined,
    'planet' => Icons.public,
    'sky' => Icons.cloud_outlined,
    'qisas' => Icons.menu_book_outlined,
    'oloom' => Icons.biotech_outlined,
    'alam' => Icons.map_outlined,
    _ => Icons.brush_outlined,
  };

  List<_StudioItem> _fallbackForKind() => switch (kind) {
    _CatalogKind.trace => _traceItems,
    _CatalogKind.letter => _letterItems,
    _CatalogKind.number => _numberItems,
    _CatalogKind.dots => _dotsItems,
    _CatalogKind.complete => _completeItems,
    _CatalogKind.copy => _copyItems,
    _CatalogKind.prompt => _promptItems,
  };

  void _openCatalogItem(BuildContext context, StudioCatalogItem item) =>
      _openStudioItem(
        context,
        _StudioItem(
          id: item.id,
          label: item.label,
          assetId: item.assetId,
          thumbnailAssetId: item.thumbnailAssetId,
          bg: item.bgColor,
          icon: item.icon == 'prompt'
              ? _iconForPrompt(item.id)
              : Icons.brush_outlined,
          mode: item.mode,
          strokePaths: item.strokePaths.isEmpty ? null : item.strokePaths,
          dots: item.dots.isEmpty ? null : item.dots,
          regions: item.regions.isEmpty ? null : item.regions,
          palette: item.palette.isEmpty ? null : item.palette,
        ),
      );

  void _openStudioItem(BuildContext context, _StudioItem item) {
    switch (kind) {
      case _CatalogKind.trace:
      case _CatalogKind.letter:
      case _CatalogKind.number:
        _doOpenTrace(context, item);
        break;
      case _CatalogKind.dots:
        _doOpenDots(context, item);
        break;
      case _CatalogKind.complete:
        _doOpenComplete(context, item);
        break;
      case _CatalogKind.copy:
        _doOpenCopy(context, item);
        break;
      case _CatalogKind.prompt:
        _doOpenPrompt(context, item);
        break;
    }
  }

  void _doOpenTrace(BuildContext context, _StudioItem item) {
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
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': item.mode ?? 'shape',
          'scoring': 'geometric',
          'prompt_key': 'game.trace.${item.id}.prompt',
          'completion': {'rule': 'all_strokes_complete'},
          'stroke_paths':
              item.strokePaths ??
              [
                {
                  'id': 's1',
                  'order': 1,
                  'points': [
                    [0.2, 0.5],
                    [0.8, 0.5],
                  ],
                },
              ],
          'tolerance_dp': 24,
          'coverage_required': 0.8,
          'background_asset': item.assetId,
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-trace-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'trace',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenDots(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-dots-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-dots-star'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'connect_dots',
          'scoring': 'sequence',
          'prompt_key': 'game.dots.${item.id}.prompt',
          'completion': {'rule': 'all_dots_connected'},
          'dots':
              item.dots ??
              [
                {
                  'id': 'd1',
                  'order': 1,
                  'at': [0.2, 0.2],
                },
                {
                  'id': 'd2',
                  'order': 2,
                  'at': [0.8, 0.2],
                },
              ],
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-dots-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'connect_dots',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenComplete(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-complete-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-complete-half-sun'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'complete_drawing',
          'scoring': 'none',
          'prompt_key': 'game.complete.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'background_asset': item.assetId,
          'coloring': {
            'enabled': false,
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE'],
          },
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-complete-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'complete_drawing',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenCopy(BuildContext context, _StudioItem item) {
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'studio-copy-${item.id}',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {
        'images': [item.assetId ?? 'asset-copy-pattern'],
        'audio': [],
      },
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'copy_pattern',
          'scoring': 'none',
          'prompt_key': 'game.copy.${item.id}.prompt',
          'completion': {'rule': 'child_taps_done'},
          'background_asset': item.assetId,
          'stroke_paths': [
            {
              'id': 's1',
              'order': 1,
              'points': [
                [0.2, 0.5],
                [0.8, 0.5],
              ],
            },
          ],
          'tolerance_dp': 28,
          'coverage_required': 0.7,
        },
      ],
    });
    final ctrl = GameSessionController(
      pack: pack,
      gameId: 'studio-copy-${item.id}',
      childId: childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
    );
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TraceActivityHost(
          title: item.label,
          controller: ctrl,
          creationStore: creationStore,
          drawingMode: 'copy_pattern',
          onSaved: onSaved,
        ),
      ),
    );
  }

  void _doOpenPrompt(BuildContext context, _StudioItem item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _FreeDrawHost(
          childId: childId,
          creationStore: creationStore,
          gameId: 'studio-prompt-${item.id}',
          drawingMode: 'prompt_drawing',
          promptOverride: item.label,
          onSaved: onSaved,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);
    return async.when(
      loading: () => const Card(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: CircularProgressIndicator()),
        ),
      ),
      error: (e, _) => _fallback(context),
      data: (list) {
        if (list.isEmpty) return _fallback(context);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 8),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 160,
                childAspectRatio: 0.95,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: list.length,
              itemBuilder: (ctx, i) {
                final it = list[i];
                return Card(
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: () => _openCatalogItem(context, it),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: Container(
                            color: it.bgColor,
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: it.previewAssetId != null
                                  ? DrawingAsset(
                                      assetIdOrPath: it.previewAssetId!,
                                      fit: BoxFit.contain,
                                    )
                                  : Icon(
                                      _iconForPrompt(it.id),
                                      size: 36,
                                      color: Colors.white,
                                    ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 6,
                          ),
                          child: Text(
                            it.label,
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.labelMedium,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
            const SizedBox(height: 6),
          ],
        );
      },
    );
  }

  Widget _fallback(BuildContext context) {
    final items = _fallbackForKind();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        Text(
          subtitle,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 8),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 160,
            childAspectRatio: 0.95,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: items.length,
          itemBuilder: (ctx, i) {
            final it = items[i];
            return Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => _openStudioItem(context, it),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(
                      child: Container(
                        color: it.bg,
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: it.previewAssetId != null
                              ? DrawingAsset(
                                  assetIdOrPath: it.previewAssetId!,
                                  fit: BoxFit.contain,
                                )
                              : Icon(it.icon, size: 36, color: Colors.white),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 6,
                      ),
                      child: Text(
                        it.label,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 6),
      ],
    );
  }
}

class _StudioItem {
  const _StudioItem({
    required this.id,
    required this.label,
    this.assetId,
    this.thumbnailAssetId,
    this.bg = const Color(0xFF0F172A),
    this.icon = Icons.brush_outlined,
    this.mode,
    this.strokePaths,
    this.regions,
    this.dots,
    this.palette,
    this.promptKey,
  });
  final String id;
  final String label;
  final String? assetId;
  final String? thumbnailAssetId;
  final Color bg;
  final IconData icon;
  final String? mode;
  final List<Map<String, dynamic>>? strokePaths;
  final List<ColorRegion>? regions;
  final List<Map<String, dynamic>>? dots;
  final List<String>? palette;
  final String? promptKey;

  String? get previewAssetId => thumbnailAssetId ?? assetId;
}

final _coloringItems = [
  _StudioItem(
    id: 'bird',
    label: 'عصفور',
    assetId: 'asset-color-bird',
    bg: Color(0xFF0B2E13),
    regions: [
      ColorRegion(
        id: 'bird.body',
        polygon: [
          NormalizedPoint(0.2, 0.3),
          NormalizedPoint(0.8, 0.3),
          NormalizedPoint(0.8, 0.7),
          NormalizedPoint(0.2, 0.7),
        ],
      ),
      ColorRegion(
        id: 'bird.wing',
        polygon: [
          NormalizedPoint(0.45, 0.35),
          NormalizedPoint(0.65, 0.45),
          NormalizedPoint(0.45, 0.65),
        ],
      ),
      ColorRegion(
        id: 'bird.beak',
        polygon: [
          NormalizedPoint(0.8, 0.45),
          NormalizedPoint(0.9, 0.5),
          NormalizedPoint(0.8, 0.55),
        ],
      ),
    ],
    palette: ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2'],
  ),
  _StudioItem(
    id: 'cat',
    label: 'قطة',
    assetId: 'asset-color-cat',
    bg: Color(0xFF0B1220),
    regions: [
      ColorRegion(
        id: 'cat.body',
        polygon: [
          NormalizedPoint(0.18, 0.4),
          NormalizedPoint(0.82, 0.4),
          NormalizedPoint(0.82, 0.6),
          NormalizedPoint(0.18, 0.6),
        ],
      ),
      ColorRegion(
        id: 'cat.head',
        polygon: [
          NormalizedPoint(0.38, 0.22),
          NormalizedPoint(0.62, 0.22),
          NormalizedPoint(0.62, 0.35),
          NormalizedPoint(0.38, 0.35),
        ],
      ),
      ColorRegion(
        id: 'cat.tail',
        polygon: [
          NormalizedPoint(0.75, 0.45),
          NormalizedPoint(0.88, 0.45),
          NormalizedPoint(0.88, 0.55),
          NormalizedPoint(0.75, 0.55),
        ],
      ),
    ],
    palette: ['#F59E0B', '#6B7280', '#FECACA'],
  ),
  _StudioItem(
    id: 'lion',
    label: 'أسد',
    assetId: 'asset-color-lion',
    bg: Color(0xFF92400E),
    regions: [
      ColorRegion(
        id: 'lion.face',
        polygon: [
          NormalizedPoint(0.34, 0.34),
          NormalizedPoint(0.66, 0.34),
          NormalizedPoint(0.66, 0.52),
          NormalizedPoint(0.34, 0.52),
        ],
      ),
      ColorRegion(
        id: 'lion.mane',
        polygon: [
          NormalizedPoint(0.27, 0.27),
          NormalizedPoint(0.73, 0.27),
          NormalizedPoint(0.73, 0.52),
          NormalizedPoint(0.27, 0.52),
        ],
      ),
      ColorRegion(
        id: 'lion.body',
        polygon: [
          NormalizedPoint(0.38, 0.62),
          NormalizedPoint(0.62, 0.62),
          NormalizedPoint(0.62, 0.75),
          NormalizedPoint(0.38, 0.75),
        ],
      ),
    ],
    palette: ['#F59E0B', '#92400E', '#FEF3C7'],
  ),
  _StudioItem(
    id: 'turtle',
    label: 'سلحفاة',
    assetId: 'asset-color-turtle',
    bg: Color(0xFF14532D),
    regions: [
      ColorRegion(
        id: 'turtle.shell',
        polygon: [
          NormalizedPoint(0.27, 0.35),
          NormalizedPoint(0.73, 0.35),
          NormalizedPoint(0.73, 0.55),
          NormalizedPoint(0.27, 0.55),
        ],
      ),
      ColorRegion(
        id: 'turtle.head',
        polygon: [
          NormalizedPoint(0.42, 0.22),
          NormalizedPoint(0.58, 0.22),
          NormalizedPoint(0.58, 0.32),
          NormalizedPoint(0.42, 0.32),
        ],
      ),
    ],
    palette: ['#22C55E', '#14532D', '#FEF3C7'],
  ),
  _StudioItem(
    id: 'butterfly',
    label: 'فراشة',
    assetId: 'asset-color-butterfly',
    bg: Color(0xFF831843),
    regions: [
      ColorRegion(
        id: 'butterfly.body',
        polygon: [
          NormalizedPoint(0.47, 0.32),
          NormalizedPoint(0.53, 0.32),
          NormalizedPoint(0.53, 0.6),
          NormalizedPoint(0.47, 0.6),
        ],
      ),
      ColorRegion(
        id: 'butterfly.wing_top_left',
        polygon: [
          NormalizedPoint(0.18, 0.28),
          NormalizedPoint(0.46, 0.28),
          NormalizedPoint(0.46, 0.42),
          NormalizedPoint(0.18, 0.42),
        ],
      ),
      ColorRegion(
        id: 'butterfly.wing_top_right',
        polygon: [
          NormalizedPoint(0.54, 0.28),
          NormalizedPoint(0.82, 0.28),
          NormalizedPoint(0.82, 0.42),
          NormalizedPoint(0.54, 0.42),
        ],
      ),
    ],
    palette: ['#EC4899', '#F59E0B', '#22C55E'],
  ),
  _StudioItem(
    id: 'chicken',
    label: 'دجاجة',
    assetId: 'asset-color-chicken',
    bg: Color(0xFFF59E0B),
    regions: [
      ColorRegion(
        id: 'chicken.body',
        polygon: [
          NormalizedPoint(0.34, 0.42),
          NormalizedPoint(0.66, 0.42),
          NormalizedPoint(0.66, 0.62),
          NormalizedPoint(0.34, 0.62),
        ],
      ),
      ColorRegion(
        id: 'chicken.head',
        polygon: [
          NormalizedPoint(0.4, 0.26),
          NormalizedPoint(0.6, 0.26),
          NormalizedPoint(0.6, 0.38),
          NormalizedPoint(0.4, 0.38),
        ],
      ),
    ],
    palette: ['#F59E0B', '#FEF3C7', '#EF4444'],
  ),
  _StudioItem(
    id: 'rabbit',
    label: 'أرنب',
    assetId: 'asset-color-rabbit',
    bg: Color(0xFF6B7280),
    regions: [
      ColorRegion(
        id: 'rabbit.body',
        polygon: [
          NormalizedPoint(0.36, 0.45),
          NormalizedPoint(0.64, 0.45),
          NormalizedPoint(0.64, 0.65),
          NormalizedPoint(0.36, 0.65),
        ],
      ),
      ColorRegion(
        id: 'rabbit.head',
        polygon: [
          NormalizedPoint(0.4, 0.32),
          NormalizedPoint(0.6, 0.32),
          NormalizedPoint(0.6, 0.42),
          NormalizedPoint(0.4, 0.42),
        ],
      ),
    ],
    palette: ['#E5E7EB', '#6B7280', '#FECACA'],
  ),
  _StudioItem(
    id: 'elephant',
    label: 'فيل',
    assetId: 'asset-color-elephant',
    bg: Color(0xFF475569),
    regions: [
      ColorRegion(
        id: 'elephant.body',
        polygon: [
          NormalizedPoint(0.28, 0.42),
          NormalizedPoint(0.72, 0.42),
          NormalizedPoint(0.72, 0.62),
          NormalizedPoint(0.28, 0.62),
        ],
      ),
      ColorRegion(
        id: 'elephant.head',
        polygon: [
          NormalizedPoint(0.37, 0.28),
          NormalizedPoint(0.63, 0.28),
          NormalizedPoint(0.63, 0.42),
          NormalizedPoint(0.37, 0.42),
        ],
      ),
    ],
    palette: ['#94A3B8', '#475569', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'whale',
    label: 'حوت',
    assetId: 'asset-color-whale',
    bg: Color(0xFF0E7490),
    regions: [
      ColorRegion(
        id: 'whale.body',
        polygon: [
          NormalizedPoint(0.22, 0.32),
          NormalizedPoint(0.78, 0.32),
          NormalizedPoint(0.78, 0.48),
          NormalizedPoint(0.22, 0.48),
        ],
      ),
      ColorRegion(
        id: 'whale.tail',
        polygon: [
          NormalizedPoint(0.78, 0.4),
          NormalizedPoint(0.87, 0.4),
          NormalizedPoint(0.87, 0.52),
          NormalizedPoint(0.78, 0.52),
        ],
      ),
    ],
    palette: ['#0891B2', '#0E7490', '#E0F2FE'],
  ),
  _StudioItem(
    id: 'owl',
    label: 'بومة',
    assetId: 'asset-color-owl',
    bg: Color(0xFF7C3AED),
    regions: [
      ColorRegion(
        id: 'owl.body',
        polygon: [
          NormalizedPoint(0.32, 0.32),
          NormalizedPoint(0.68, 0.32),
          NormalizedPoint(0.68, 0.62),
          NormalizedPoint(0.32, 0.62),
        ],
      ),
      ColorRegion(
        id: 'owl.eyes',
        polygon: [
          NormalizedPoint(0.37, 0.38),
          NormalizedPoint(0.63, 0.38),
          NormalizedPoint(0.63, 0.48),
          NormalizedPoint(0.37, 0.48),
        ],
      ),
    ],
    palette: ['#7C3AED', '#F59E0B', '#E9D5FF'],
  ),
  _StudioItem(
    id: 'horse',
    label: 'حصان',
    assetId: 'asset-color-horse',
    bg: Color(0xFF92400E),
    regions: [
      ColorRegion(
        id: 'horse.body',
        polygon: [
          NormalizedPoint(0.28, 0.45),
          NormalizedPoint(0.72, 0.45),
          NormalizedPoint(0.72, 0.65),
          NormalizedPoint(0.28, 0.65),
        ],
      ),
      ColorRegion(
        id: 'horse.head',
        polygon: [
          NormalizedPoint(0.48, 0.26),
          NormalizedPoint(0.62, 0.26),
          NormalizedPoint(0.62, 0.38),
          NormalizedPoint(0.48, 0.38),
        ],
      ),
    ],
    palette: ['#92400E', '#F59E0B', '#FEF3C7'],
  ),
  _StudioItem(
    id: 'house',
    label: 'منزل',
    assetId: 'asset-color-house',
    bg: Color(0xFF1E3A8A),
    regions: [
      ColorRegion(
        id: 'house.wall',
        polygon: [
          NormalizedPoint(0.2, 0.5),
          NormalizedPoint(0.8, 0.5),
          NormalizedPoint(0.8, 0.85),
          NormalizedPoint(0.2, 0.85),
        ],
      ),
      ColorRegion(
        id: 'house.roof',
        polygon: [
          NormalizedPoint(0.15, 0.5),
          NormalizedPoint(0.5, 0.2),
          NormalizedPoint(0.85, 0.5),
        ],
      ),
      ColorRegion(
        id: 'house.door',
        polygon: [
          NormalizedPoint(0.42, 0.65),
          NormalizedPoint(0.58, 0.65),
          NormalizedPoint(0.58, 0.85),
          NormalizedPoint(0.42, 0.85),
        ],
      ),
    ],
    palette: ['#FF9F1C', '#2ECC71', '#3498DB'],
  ),
  _StudioItem(
    id: 'rocket',
    label: 'صاروخ',
    assetId: 'asset-color-rocket',
    bg: Color(0xFF1A0B2E),
    regions: [
      ColorRegion(
        id: 'rocket.body',
        polygon: [
          NormalizedPoint(0.33, 0.15),
          NormalizedPoint(0.66, 0.15),
          NormalizedPoint(0.6, 0.85),
          NormalizedPoint(0.4, 0.85),
        ],
      ),
      ColorRegion(
        id: 'rocket.window',
        polygon: [
          NormalizedPoint(0.42, 0.45),
          NormalizedPoint(0.58, 0.45),
          NormalizedPoint(0.58, 0.55),
          NormalizedPoint(0.42, 0.55),
        ],
      ),
    ],
    palette: ['#E74C3C', '#3498DB', '#F1C40F'],
  ),
  _StudioItem(
    id: 'planet',
    label: 'كوكب',
    assetId: 'asset-color-planet',
    bg: Color(0xFF0F172A),
    regions: [
      ColorRegion(
        id: 'planet.body',
        polygon: [
          NormalizedPoint(0.22, 0.28),
          NormalizedPoint(0.78, 0.28),
          NormalizedPoint(0.78, 0.72),
          NormalizedPoint(0.22, 0.72),
        ],
      ),
    ],
    palette: ['#6A3DF2', '#00D6F5', '#FFD34D'],
  ),
  _StudioItem(
    id: 'flower',
    label: 'زهرة',
    assetId: 'asset-color-flower',
    bg: Color(0xFF831843),
    regions: [
      ColorRegion(
        id: 'flower.center',
        polygon: [
          NormalizedPoint(0.43, 0.43),
          NormalizedPoint(0.57, 0.43),
          NormalizedPoint(0.57, 0.57),
          NormalizedPoint(0.43, 0.57),
        ],
      ),
      ColorRegion(
        id: 'flower.petals',
        polygon: [
          NormalizedPoint(0.3, 0.3),
          NormalizedPoint(0.7, 0.3),
          NormalizedPoint(0.7, 0.45),
          NormalizedPoint(0.3, 0.45),
        ],
      ),
    ],
    palette: ['#FF6FAE', '#FFD34D', '#22C55E'],
  ),
  _StudioItem(
    id: 'fish',
    label: 'سمكة',
    assetId: 'asset-color-fish',
    bg: Color(0xFF0E7490),
    regions: [
      ColorRegion(
        id: 'fish.body',
        polygon: [
          NormalizedPoint(0.18, 0.35),
          NormalizedPoint(0.82, 0.35),
          NormalizedPoint(0.82, 0.65),
          NormalizedPoint(0.18, 0.65),
        ],
      ),
    ],
    palette: ['#06B6D4', '#F59E0B', '#EF4444'],
  ),
  _StudioItem(
    id: 'tree',
    label: 'شجرة',
    assetId: 'asset-color-tree',
    bg: Color(0xFF14532D),
    regions: [
      ColorRegion(
        id: 'tree.leaves',
        polygon: [
          NormalizedPoint(0.27, 0.2),
          NormalizedPoint(0.73, 0.2),
          NormalizedPoint(0.73, 0.5),
          NormalizedPoint(0.27, 0.5),
        ],
      ),
      ColorRegion(
        id: 'tree.trunk',
        polygon: [
          NormalizedPoint(0.45, 0.5),
          NormalizedPoint(0.55, 0.5),
          NormalizedPoint(0.55, 0.8),
          NormalizedPoint(0.45, 0.8),
        ],
      ),
    ],
    palette: ['#22C55E', '#92400E', '#86EFAC'],
  ),
  _StudioItem(
    id: 'moon',
    label: 'قمر',
    assetId: 'asset-color-moon',
    bg: Color(0xFF334155),
    regions: [
      ColorRegion(
        id: 'moon.body',
        polygon: [
          NormalizedPoint(0.27, 0.27),
          NormalizedPoint(0.73, 0.27),
          NormalizedPoint(0.73, 0.73),
          NormalizedPoint(0.27, 0.73),
        ],
      ),
    ],
    palette: ['#E5E7EB', '#94A3B8', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'stars',
    label: 'نجوم',
    assetId: 'asset-color-stars',
    bg: Color(0xFF0F172A),
    regions: [
      ColorRegion(
        id: 'stars.big',
        polygon: [
          NormalizedPoint(0.28, 0.26),
          NormalizedPoint(0.38, 0.26),
          NormalizedPoint(0.38, 0.32),
          NormalizedPoint(0.28, 0.32),
        ],
      ),
      ColorRegion(
        id: 'stars.small',
        polygon: [
          NormalizedPoint(0.55, 0.62),
          NormalizedPoint(0.62, 0.62),
          NormalizedPoint(0.62, 0.68),
          NormalizedPoint(0.55, 0.68),
        ],
      ),
    ],
    palette: ['#F59E0B', '#FEF3C7', '#1E1B4B'],
  ),
  _StudioItem(
    id: 'astronaut',
    label: 'رائد فضاء',
    assetId: 'asset-color-astronaut',
    bg: Color(0xFFE5E7EB),
    regions: [
      ColorRegion(
        id: 'astronaut.helmet',
        polygon: [
          NormalizedPoint(0.38, 0.22),
          NormalizedPoint(0.62, 0.22),
          NormalizedPoint(0.62, 0.38),
          NormalizedPoint(0.38, 0.38),
        ],
      ),
      ColorRegion(
        id: 'astronaut.suit',
        polygon: [
          NormalizedPoint(0.38, 0.48),
          NormalizedPoint(0.62, 0.48),
          NormalizedPoint(0.62, 0.68),
          NormalizedPoint(0.38, 0.68),
        ],
      ),
    ],
    palette: ['#E5E7EB', '#0F172A', '#60A5FA'],
  ),
  _StudioItem(
    id: 'telescope',
    label: 'تلسكوب',
    assetId: 'asset-color-telescope',
    bg: Color(0xFF1E3A8A),
    regions: [
      ColorRegion(
        id: 'telescope.tube',
        polygon: [
          NormalizedPoint(0.2, 0.42),
          NormalizedPoint(0.7, 0.42),
          NormalizedPoint(0.7, 0.52),
          NormalizedPoint(0.2, 0.52),
        ],
      ),
    ],
    palette: ['#1E3A8A', '#94A3B8', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'sea',
    label: 'بحر',
    assetId: 'asset-color-sea',
    bg: Color(0xFF0891B2),
    regions: [
      ColorRegion(
        id: 'sea.water',
        polygon: [
          NormalizedPoint(0.13, 0.55),
          NormalizedPoint(0.87, 0.55),
          NormalizedPoint(0.87, 0.86),
          NormalizedPoint(0.13, 0.86),
        ],
      ),
      ColorRegion(
        id: 'sea.boat',
        polygon: [
          NormalizedPoint(0.5, 0.42),
          NormalizedPoint(0.68, 0.42),
          NormalizedPoint(0.68, 0.52),
          NormalizedPoint(0.5, 0.52),
        ],
      ),
    ],
    palette: ['#0891B2', '#06B6D4', '#F59E0B'],
  ),
  _StudioItem(
    id: 'mountain',
    label: 'جبل',
    assetId: 'asset-color-mountain',
    bg: Color(0xFF78716C),
    regions: [
      ColorRegion(
        id: 'mountain.left',
        polygon: [
          NormalizedPoint(0.13, 0.33),
          NormalizedPoint(0.35, 0.33),
          NormalizedPoint(0.35, 0.8),
          NormalizedPoint(0.13, 0.8),
        ],
      ),
      ColorRegion(
        id: 'mountain.right',
        polygon: [
          NormalizedPoint(0.55, 0.3),
          NormalizedPoint(0.87, 0.3),
          NormalizedPoint(0.87, 0.8),
          NormalizedPoint(0.55, 0.8),
        ],
      ),
    ],
    palette: ['#78716C', '#A8A29E', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'rainbow',
    label: 'قوس قزح',
    assetId: 'asset-color-rainbow',
    bg: Color(0xFFEC4899),
    regions: [
      ColorRegion(
        id: 'rainbow.outer',
        polygon: [
          NormalizedPoint(0.2, 0.5),
          NormalizedPoint(0.8, 0.5),
          NormalizedPoint(0.8, 0.8),
          NormalizedPoint(0.2, 0.8),
        ],
      ),
      ColorRegion(
        id: 'rainbow.inner',
        polygon: [
          NormalizedPoint(0.3, 0.6),
          NormalizedPoint(0.7, 0.6),
          NormalizedPoint(0.7, 0.8),
          NormalizedPoint(0.3, 0.8),
        ],
      ),
    ],
    palette: ['#EC4899', '#F59E0B', '#22C55E'],
  ),
  _StudioItem(
    id: 'forest',
    label: 'غابة',
    assetId: 'asset-color-forest',
    bg: Color(0xFF166534),
    regions: [
      ColorRegion(
        id: 'forest.tree1',
        polygon: [
          NormalizedPoint(0.13, 0.3),
          NormalizedPoint(0.33, 0.3),
          NormalizedPoint(0.33, 0.8),
          NormalizedPoint(0.13, 0.8),
        ],
      ),
      ColorRegion(
        id: 'forest.tree2',
        polygon: [
          NormalizedPoint(0.36, 0.25),
          NormalizedPoint(0.58, 0.25),
          NormalizedPoint(0.58, 0.8),
          NormalizedPoint(0.36, 0.8),
        ],
      ),
    ],
    palette: ['#166534', '#22C55E', '#92400E'],
  ),
  _StudioItem(
    id: 'car',
    label: 'سيارة',
    assetId: 'asset-color-car',
    bg: Color(0xFFDC2626),
    regions: [
      ColorRegion(
        id: 'car.body',
        polygon: [
          NormalizedPoint(0.23, 0.5),
          NormalizedPoint(0.77, 0.5),
          NormalizedPoint(0.77, 0.65),
          NormalizedPoint(0.23, 0.65),
        ],
      ),
      ColorRegion(
        id: 'car.wheel_left',
        polygon: [
          NormalizedPoint(0.28, 0.62),
          NormalizedPoint(0.38, 0.62),
          NormalizedPoint(0.38, 0.73),
          NormalizedPoint(0.28, 0.73),
        ],
      ),
    ],
    palette: ['#DC2626', '#0F172A', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'train',
    label: 'قطار',
    assetId: 'asset-color-train',
    bg: Color(0xFF1D4ED8),
    regions: [
      ColorRegion(
        id: 'train.body',
        polygon: [
          NormalizedPoint(0.16, 0.5),
          NormalizedPoint(0.83, 0.5),
          NormalizedPoint(0.83, 0.65),
          NormalizedPoint(0.16, 0.65),
        ],
      ),
    ],
    palette: ['#1D4ED8', '#F59E0B', '#E5E7EB'],
  ),
  _StudioItem(
    id: 'airplane',
    label: 'طائرة',
    assetId: 'asset-color-airplane',
    bg: Color(0xFF0284C7),
    regions: [
      ColorRegion(
        id: 'airplane.body',
        polygon: [
          NormalizedPoint(0.2, 0.45),
          NormalizedPoint(0.77, 0.45),
          NormalizedPoint(0.77, 0.55),
          NormalizedPoint(0.2, 0.55),
        ],
      ),
    ],
    palette: ['#0284C7', '#E5E7EB', '#F59E0B'],
  ),
  _StudioItem(
    id: 'boat',
    label: 'قارب',
    assetId: 'asset-color-boat',
    bg: Color(0xFF0369A1),
    regions: [
      ColorRegion(
        id: 'boat.hull',
        polygon: [
          NormalizedPoint(0.2, 0.63),
          NormalizedPoint(0.8, 0.63),
          NormalizedPoint(0.8, 0.73),
          NormalizedPoint(0.2, 0.73),
        ],
      ),
    ],
    palette: ['#0369A1', '#E5E7EB', '#F59E0B'],
  ),
  _StudioItem(
    id: 'bicycle',
    label: 'دراجة',
    assetId: 'asset-color-bicycle',
    bg: Color(0xFF374151),
    regions: [
      ColorRegion(
        id: 'bicycle.wheel_left',
        polygon: [
          NormalizedPoint(0.24, 0.57),
          NormalizedPoint(0.42, 0.57),
          NormalizedPoint(0.42, 0.76),
          NormalizedPoint(0.24, 0.76),
        ],
      ),
    ],
    palette: ['#374151', '#6B7280', '#F59E0B'],
  ),
  _StudioItem(
    id: 'apple',
    label: 'تفاحة',
    assetId: 'asset-color-apple',
    bg: Color(0xFFDC2626),
    regions: [
      ColorRegion(
        id: 'apple.body',
        polygon: [
          NormalizedPoint(0.32, 0.38),
          NormalizedPoint(0.68, 0.38),
          NormalizedPoint(0.68, 0.75),
          NormalizedPoint(0.32, 0.75),
        ],
      ),
    ],
    palette: ['#DC2626', '#22C55E', '#92400E'],
  ),
  _StudioItem(
    id: 'book',
    label: 'كتاب',
    assetId: 'asset-color-book',
    bg: Color(0xFF7C3AED),
    regions: [
      ColorRegion(
        id: 'book.left',
        polygon: [
          NormalizedPoint(0.26, 0.3),
          NormalizedPoint(0.5, 0.3),
          NormalizedPoint(0.5, 0.7),
          NormalizedPoint(0.26, 0.7),
        ],
      ),
      ColorRegion(
        id: 'book.right',
        polygon: [
          NormalizedPoint(0.5, 0.3),
          NormalizedPoint(0.73, 0.3),
          NormalizedPoint(0.73, 0.7),
          NormalizedPoint(0.5, 0.7),
        ],
      ),
    ],
    palette: ['#7C3AED', '#E9D5FF', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'bag',
    label: 'حقيبة',
    assetId: 'asset-color-bag',
    bg: Color(0xFF1E40AF),
    regions: [
      ColorRegion(
        id: 'bag.body',
        polygon: [
          NormalizedPoint(0.3, 0.4),
          NormalizedPoint(0.7, 0.4),
          NormalizedPoint(0.7, 0.73),
          NormalizedPoint(0.3, 0.73),
        ],
      ),
    ],
    palette: ['#1E40AF', '#60A5FA', '#E5E7EB'],
  ),
  _StudioItem(
    id: 'lamp',
    label: 'مصباح',
    assetId: 'asset-color-lamp',
    bg: Color(0xFFF59E0B),
    regions: [
      ColorRegion(
        id: 'lamp.shade',
        polygon: [
          NormalizedPoint(0.36, 0.33),
          NormalizedPoint(0.63, 0.33),
          NormalizedPoint(0.63, 0.53),
          NormalizedPoint(0.36, 0.53),
        ],
      ),
    ],
    palette: ['#F59E0B', '#FEF3C7', '#92400E'],
  ),
  _StudioItem(
    id: 'mosque',
    label: 'مسجد',
    assetId: 'asset-color-mosque',
    bg: Color(0xFF0F766E),
    regions: [
      ColorRegion(
        id: 'mosque.dome',
        polygon: [
          NormalizedPoint(0.33, 0.35),
          NormalizedPoint(0.67, 0.35),
          NormalizedPoint(0.67, 0.5),
          NormalizedPoint(0.33, 0.5),
        ],
      ),
      ColorRegion(
        id: 'mosque.wall',
        polygon: [
          NormalizedPoint(0.33, 0.5),
          NormalizedPoint(0.67, 0.5),
          NormalizedPoint(0.67, 0.63),
          NormalizedPoint(0.33, 0.63),
        ],
      ),
    ],
    palette: ['#0F766E', '#14B8A6', '#FEF3C7'],
  ),
  _StudioItem(
    id: 'lantern',
    label: 'فانوس',
    assetId: 'asset-color-lantern',
    bg: Color(0xFFB45309),
    regions: [
      ColorRegion(
        id: 'lantern.body',
        polygon: [
          NormalizedPoint(0.41, 0.33),
          NormalizedPoint(0.59, 0.33),
          NormalizedPoint(0.59, 0.6),
          NormalizedPoint(0.41, 0.6),
        ],
      ),
    ],
    palette: ['#B45309', '#F59E0B', '#FEF3C7'],
  ),
  _StudioItem(
    id: 'crescent',
    label: 'هلال',
    assetId: 'asset-color-crescent',
    bg: Color(0xFF312E81),
    regions: [
      ColorRegion(
        id: 'crescent.moon',
        polygon: [
          NormalizedPoint(0.36, 0.3),
          NormalizedPoint(0.65, 0.3),
          NormalizedPoint(0.65, 0.7),
          NormalizedPoint(0.36, 0.7),
        ],
      ),
    ],
    palette: ['#312E81', '#F59E0B', '#E5E7EB'],
  ),
  _StudioItem(
    id: 'arabesque',
    label: 'زخرفة',
    assetId: 'asset-color-arabesque',
    bg: Color(0xFF7C2D12),
    regions: [
      ColorRegion(
        id: 'arabesque.outer',
        polygon: [
          NormalizedPoint(0.23, 0.23),
          NormalizedPoint(0.77, 0.23),
          NormalizedPoint(0.77, 0.77),
          NormalizedPoint(0.23, 0.77),
        ],
      ),
    ],
    palette: ['#7C2D12', '#F59E0B', '#FEF3C7'],
  ),
  _StudioItem(
    id: 'shapes-comp',
    label: 'أشكال',
    assetId: 'asset-color-shapes-comp',
    bg: Color(0xFF334155),
    regions: [
      ColorRegion(
        id: 'comp.circle',
        polygon: [
          NormalizedPoint(0.21, 0.37),
          NormalizedPoint(0.39, 0.37),
          NormalizedPoint(0.39, 0.56),
          NormalizedPoint(0.21, 0.56),
        ],
      ),
    ],
    palette: ['#334155', '#94A3B8', '#F1F5F9'],
  ),
  _StudioItem(
    id: 'stars-planets',
    label: 'نجوم وكواكب',
    assetId: 'asset-color-stars-planets',
    bg: Color(0xFF1E1B4B),
    regions: [
      ColorRegion(
        id: 'stars.planet1',
        polygon: [
          NormalizedPoint(0.26, 0.26),
          NormalizedPoint(0.4, 0.26),
          NormalizedPoint(0.4, 0.4),
          NormalizedPoint(0.26, 0.4),
        ],
      ),
    ],
    palette: ['#1E1B4B', '#F59E0B', '#6A3DF2'],
  ),
];
final _traceItems = [
  _StudioItem(
    id: 'line-h',
    label: 'خط أفقي',
    assetId: 'asset-line-h',
    bg: Color(0xFF334155),
    mode: 'line',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.15, 0.5],
          [0.85, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'line-v',
    label: 'خط عمودي',
    assetId: 'asset-line-v',
    bg: Color(0xFF334155),
    mode: 'line',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.15],
          [0.5, 0.85],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'diagonal',
    label: 'مائل',
    assetId: 'asset-trace-diagonal',
    bg: Color(0xFF334155),
    mode: 'line',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.8],
          [0.8, 0.2],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'zigzag',
    label: 'متعرج',
    assetId: 'asset-zigzag',
    bg: Color(0xFF475569),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.15, 0.5],
          [0.3, 0.3],
          [0.45, 0.7],
          [0.6, 0.3],
          [0.85, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'wave',
    label: 'موجة',
    assetId: 'asset-wave',
    bg: Color(0xFF475569),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.15, 0.5],
          [0.3, 0.3],
          [0.5, 0.5],
          [0.7, 0.7],
          [0.85, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'spiral',
    label: 'حلزون',
    assetId: 'asset-spiral',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.5],
          [0.6, 0.5],
          [0.6, 0.6],
          [0.4, 0.6],
          [0.4, 0.4],
          [0.65, 0.4],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'loop',
    label: 'حلقة',
    assetId: 'asset-trace-loop',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.33],
          [0.63, 0.33],
          [0.63, 0.66],
          [0.36, 0.66],
          [0.36, 0.33],
          [0.5, 0.33],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'arch',
    label: 'قوس',
    assetId: 'asset-trace-arch',
    bg: Color(0xFF475569),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.66],
          [0.35, 0.3],
          [0.65, 0.3],
          [0.8, 0.66],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 's-curve',
    label: 'حرف S',
    assetId: 'asset-trace-s-curve',
    bg: Color(0xFF475569),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.66],
          [0.33, 0.33],
          [0.66, 0.8],
          [0.8, 0.33],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'road',
    label: 'طريق',
    assetId: 'asset-trace-road',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.5],
          [0.33, 0.5],
          [0.43, 0.33],
          [0.56, 0.5],
          [0.73, 0.66],
          [0.8, 0.5],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'maze',
    label: 'متاهة',
    assetId: 'asset-trace-maze',
    bg: Color(0xFF1E293B),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.8, 0.4],
          [0.33, 0.4],
          [0.33, 0.6],
          [0.8, 0.6],
          [0.8, 0.8],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'mountain-path',
    label: 'مسار جبلي',
    assetId: 'asset-trace-mountain-path',
    bg: Color(0xFF334155),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.8],
          [0.33, 0.33],
          [0.5, 0.58],
          [0.66, 0.3],
          [0.8, 0.8],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'rocket-trail',
    label: 'ذيل صاروخ',
    assetId: 'asset-trace-rocket-trail',
    bg: Color(0xFF1E1B4B),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.8],
          [0.46, 0.6],
          [0.53, 0.43],
          [0.5, 0.2],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'bee',
    label: 'مسار نحلة',
    assetId: 'asset-trace-bee',
    bg: Color(0xFFF59E0B),
    mode: 'path',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.5],
          [0.33, 0.33],
          [0.5, 0.66],
          [0.66, 0.33],
          [0.77, 0.4],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'fish-path',
    label: 'سباحة سمكة',
    assetId: 'asset-trace-fish-path',
    bg: Color(0xFF0891B2),
    mode: 'curve',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.2, 0.5],
          [0.33, 0.36],
          [0.56, 0.3],
          [0.8, 0.5],
        ],
      },
    ],
  ),
];
final _letterItems = [
  _StudioItem(
    id: 'alif',
    label: 'ا',
    assetId: 'asset-glyph-alif',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.5, 0.22],
          [0.5, 0.74],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'baa',
    label: 'ب',
    assetId: 'asset-glyph-baa',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.3, 0.55],
          [0.7, 0.55],
        ],
      },
      {
        'id': 's2',
        'order': 2,
        'type': 'dot',
        'points': [
          [0.5, 0.65],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'lam',
    label: 'ل',
    assetId: 'asset-glyph-lam',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.55, 0.2],
          [0.55, 0.6],
          [0.4, 0.75],
        ],
      },
    ],
  ),
  _StudioItem(
    id: 'noon',
    label: 'ن',
    assetId: 'asset-glyph-noon',
    bg: Color(0xFF312E81),
    mode: 'letter',
    strokePaths: [
      {
        'id': 's1',
        'order': 1,
        'points': [
          [0.3, 0.5],
          [0.7, 0.5],
        ],
      },
      {
        'id': 's2',
        'order': 2,
        'type': 'dot',
        'points': [
          [0.5, 0.35],
        ],
      },
    ],
  ),
];
final _numberItems = [
  for (var n = 1; n <= 10; n++)
    _StudioItem(
      id: '$n',
      label: '$n',
      assetId: 'asset-number-$n',
      bg: Color(0xFF0F172A),
      mode: 'number',
      strokePaths: [
        {
          'id': 's1',
          'order': 1,
          'points': [
            [0.5, 0.2],
            [0.5, 0.8],
          ],
        },
      ],
    ),
];
final _dotsItems = [
  _StudioItem(
    id: 'star',
    label: 'نجمة',
    assetId: 'asset-dots-star',
    bg: Color(0xFF4C1D95),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.13],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.63, 0.36],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.86, 0.38],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.68, 0.53],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.73, 0.76],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.5, 0.63],
      },
      {
        'id': 'd7',
        'order': 7,
        'at': [0.26, 0.76],
      },
      {
        'id': 'd8',
        'order': 8,
        'at': [0.31, 0.53],
      },
      {
        'id': 'd9',
        'order': 9,
        'at': [0.13, 0.38],
      },
      {
        'id': 'd10',
        'order': 10,
        'at': [0.36, 0.36],
      },
    ],
  ),
  _StudioItem(
    id: 'house',
    label: 'بيت',
    assetId: 'asset-dots-house',
    bg: Color(0xFF7C2D12),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.5],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.8, 0.5],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.5, 0.2],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.2, 0.86],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.8, 0.86],
      },
    ],
  ),
  _StudioItem(
    id: 'fish',
    label: 'سمكة',
    assetId: 'asset-dots-fish',
    bg: Color(0xFF0E7490),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.5],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.33, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.56, 0.3],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.86, 0.5],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.56, 0.7],
      },
    ],
  ),
  _StudioItem(
    id: 'rocket',
    label: 'صاروخ',
    assetId: 'asset-dots-rocket',
    bg: Color(0xFF1E1B4B),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.13],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.43, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.33, 0.86],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.66, 0.86],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.56, 0.33],
      },
    ],
  ),
  _StudioItem(
    id: 'flower',
    label: 'زهرة',
    assetId: 'asset-dots-flower',
    bg: Color(0xFF831843),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.2],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.63, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.63, 0.5],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.5, 0.63],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.36, 0.5],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.36, 0.33],
      },
    ],
  ),
  _StudioItem(
    id: 'cat2',
    label: 'قطة',
    assetId: 'asset-dots-cat2',
    bg: Color(0xFF0B1220),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.33, 0.5],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.46, 0.36],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.58, 0.4],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.53, 0.6],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.33, 0.6],
      },
    ],
  ),
  _StudioItem(
    id: 'butterfly2',
    label: 'فراشة',
    assetId: 'asset-dots-butterfly2',
    bg: Color(0xFF831843),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.33],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.6, 0.4],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.6, 0.53],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.5, 0.6],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.4, 0.53],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.4, 0.4],
      },
    ],
  ),
  _StudioItem(
    id: 'tree2',
    label: 'شجرة',
    assetId: 'asset-dots-tree2',
    bg: Color(0xFF14532D),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.25],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.58, 0.41],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.53, 0.58],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.46, 0.58],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.41, 0.41],
      },
    ],
  ),
  _StudioItem(
    id: 'car2',
    label: 'سيارة',
    assetId: 'asset-dots-car2',
    bg: Color(0xFFDC2626),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.6],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.3, 0.5],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.7, 0.5],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.8, 0.6],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.66, 0.7],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.26, 0.7],
      },
    ],
  ),
  _StudioItem(
    id: 'moon2',
    label: 'قمر',
    assetId: 'asset-dots-moon2',
    bg: Color(0xFF334155),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.5, 0.33],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.6, 0.36],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.66, 0.46],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.63, 0.58],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.5, 0.63],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.36, 0.58],
      },
      {
        'id': 'd7',
        'order': 7,
        'at': [0.33, 0.46],
      },
      {
        'id': 'd8',
        'order': 8,
        'at': [0.4, 0.36],
      },
    ],
  ),
  _StudioItem(
    id: 'dino',
    label: 'ديناصور',
    assetId: 'asset-dots-dino',
    bg: Color(0xFF14532D),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.3, 0.63],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.33, 0.5],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.46, 0.4],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.6, 0.43],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.7, 0.56],
      },
      {
        'id': 'd6',
        'order': 6,
        'at': [0.63, 0.66],
      },
      {
        'id': 'd7',
        'order': 7,
        'at': [0.5, 0.63],
      },
    ],
  ),
  _StudioItem(
    id: 'boat2',
    label: 'قارب',
    assetId: 'asset-dots-boat2',
    bg: Color(0xFF0369A1),
    dots: [
      {
        'id': 'd1',
        'order': 1,
        'at': [0.2, 0.63],
      },
      {
        'id': 'd2',
        'order': 2,
        'at': [0.5, 0.33],
      },
      {
        'id': 'd3',
        'order': 3,
        'at': [0.8, 0.63],
      },
      {
        'id': 'd4',
        'order': 4,
        'at': [0.66, 0.73],
      },
      {
        'id': 'd5',
        'order': 5,
        'at': [0.33, 0.73],
      },
    ],
  ),
];
final _completeItems = [
  _StudioItem(
    id: 'half-sun',
    label: 'نصف شمس',
    assetId: 'asset-complete-half-sun',
    bg: Color(0xFF92400E),
  ),
  _StudioItem(
    id: 'house',
    label: 'بيت ناقص',
    assetId: 'asset-complete-house',
    bg: Color(0xFF1E3A8A),
  ),
  _StudioItem(
    id: 'rocket',
    label: 'صاروخ ناقص',
    assetId: 'asset-complete-rocket',
    bg: Color(0xFF312E81),
  ),
  _StudioItem(
    id: 'butterfly',
    label: 'فراشة ناقصة',
    assetId: 'asset-complete-butterfly',
    bg: Color(0xFF831843),
  ),
  _StudioItem(
    id: 'fish2',
    label: 'سمكة ناقصة',
    assetId: 'asset-complete-fish2',
    bg: Color(0xFF0891B2),
  ),
  _StudioItem(
    id: 'tree2',
    label: 'شجرة ناقصة',
    assetId: 'asset-complete-tree2',
    bg: Color(0xFF14532D),
  ),
  _StudioItem(
    id: 'car',
    label: 'سيارة ناقصة',
    assetId: 'asset-complete-car',
    bg: Color(0xFFDC2626),
  ),
  _StudioItem(
    id: 'flower2',
    label: 'زهرة ناقصة',
    assetId: 'asset-complete-flower2',
    bg: Color(0xFF831843),
  ),
  _StudioItem(
    id: 'face',
    label: 'وجه ناقص',
    assetId: 'asset-complete-face',
    bg: Color(0xFFF59E0B),
  ),
  _StudioItem(
    id: 'castle',
    label: 'قلعة ناقصة',
    assetId: 'asset-complete-castle',
    bg: Color(0xFF78716C),
  ),
  _StudioItem(
    id: 'boat2',
    label: 'قارب ناقص',
    assetId: 'asset-complete-boat2',
    bg: Color(0xFF0369A1),
  ),
  _StudioItem(
    id: 'robot',
    label: 'روبوت ناقص',
    assetId: 'asset-complete-robot',
    bg: Color(0xFF334155),
  ),
];
final _copyItems = [
  _StudioItem(
    id: 'sequence',
    label: 'تسلسل',
    assetId: 'asset-copy-pattern',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'abc',
    label: 'ABC',
    assetId: 'asset-copy-abc',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'size',
    label: 'أحجام',
    assetId: 'asset-copy-size',
    bg: Color(0xFF475569),
  ),
  _StudioItem(
    id: 'direction',
    label: 'اتجاه',
    assetId: 'asset-copy-direction',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'motif',
    label: 'زخرف',
    assetId: 'asset-copy-motif',
    bg: Color(0xFF475569),
  ),
  _StudioItem(
    id: 'symmetry',
    label: 'تناظر',
    assetId: 'asset-copy-symmetry',
    bg: Color(0xFF334155),
  ),
  _StudioItem(
    id: 'line',
    label: 'خطوط',
    assetId: 'asset-copy-line',
    bg: Color(0xFF475569),
  ),
  _StudioItem(
    id: 'mixed',
    label: 'مختلط',
    assetId: 'asset-copy-mixed',
    bg: Color(0xFF334155),
  ),
];
final _promptItems = [
  _StudioItem(
    id: 'home',
    label: 'بيتي المفضل',
    thumbnailAssetId: 'asset-prompt-home',
    bg: Color(0xFF831843),
    icon: Icons.home_outlined,
    promptKey: 'game.prompt.home.prompt',
  ),
  _StudioItem(
    id: 'planet',
    label: 'كوكب جديد',
    thumbnailAssetId: 'asset-prompt-planet',
    bg: Color(0xFF312E81),
    icon: Icons.public,
    promptKey: 'game.prompt.planet.prompt',
  ),
  _StudioItem(
    id: 'sky',
    label: 'في السماء',
    thumbnailAssetId: 'asset-prompt-sky',
    bg: Color(0xFF0C4A6E),
    icon: Icons.cloud_outlined,
    promptKey: 'game.prompt.sky.prompt',
  ),
  _StudioItem(
    id: 'qisas',
    label: 'نهاية القصة',
    thumbnailAssetId: 'asset-prompt-qisas',
    bg: Color(0xFF422006),
    icon: Icons.menu_book_outlined,
    promptKey: 'game.qisas.draw_ending.prompt',
  ),
  _StudioItem(
    id: 'oloom',
    label: 'ما لاحظت',
    thumbnailAssetId: 'asset-prompt-oloom',
    bg: Color(0xFF14532D),
    icon: Icons.biotech_outlined,
    promptKey: 'game.oloom.observe.prompt',
  ),
  _StudioItem(
    id: 'alam',
    label: 'خريطة غرفتي',
    thumbnailAssetId: 'asset-prompt-alam',
    bg: Color(0xFF1E1B4B),
    icon: Icons.map_outlined,
    promptKey: 'game.alam.map.prompt',
  ),
];

class _FreeDrawHost extends StatefulWidget {
  const _FreeDrawHost({
    required this.childId,
    required this.creationStore,
    required this.gameId,
    required this.drawingMode,
    this.initialDocument,
    this.continueCreation,
    this.promptOverride,
    this.onSaved,
  });

  final String childId;
  final LocalCreationStore creationStore;
  final String gameId;
  final String drawingMode;
  final CreationDocument? initialDocument;
  final LocalCreation? continueCreation;
  final String? promptOverride;
  final VoidCallback? onSaved;

  @override
  State<_FreeDrawHost> createState() => _FreeDrawHostState();
}

class _FreeDrawHostState extends State<_FreeDrawHost> {
  late final GameSessionController _ctrl;
  late final GamePack _pack;
  final GlobalKey _key = GlobalKey();
  List<FreeStroke> _strokes = const [];
  String? _message;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': widget.gameId,
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {'images': <String>[], 'audio': <String>[]},
      'voice_manifest': <String, Object?>{},
      'levels': [
        {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.free_draw.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': false,
            'palette': ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2'],
          },
        },
      ],
    });
    _ctrl = GameSessionController(
      pack: _pack,
      gameId: widget.gameId,
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'studio-${DateTime.now().microsecondsSinceEpoch}',
      initialCreationJson: widget.initialDocument?.toJsonString(),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.promptOverride ?? 'ارسم بحرية')),
      body: Column(
        children: [
          Expanded(
            child: FreeDrawSurface(
              controller: _ctrl,
              initialDocument: widget.initialDocument,
              canvasRepaintBoundaryKey: _key,
              onStrokesChanged: (strokes) => _strokes = List.of(strokes),
            ),
          ),
          if (_message != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_message!),
              ),
            ),
          SafeArea(
            minimum: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_alt),
                label: Text(
                  _saving
                      ? 'جارٍ الحفظ…'
                      : widget.continueCreation != null
                      ? 'تحديث الرسم'
                      : 'احفظ رسمتي',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final boundary = _key.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز الرسم للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });
    final canvasWidth = boundary.size.width <= 0 ? 512.0 : boundary.size.width;
    final canvasHeight = boundary.size.height <= 0
        ? canvasWidth
        : boundary.size.height;
    final document = CreationDocument.fromStrokes(
      mode: widget.drawingMode,
      canvasSize: canvasWidth,
      canvasHeight: canvasHeight,
      strokes: _strokes,
      fills: const {},
      palette: _pack.levels.first.coloring?.palette ?? const [],
      prompt:
          widget.promptOverride ??
          widget.initialDocument?.prompt ??
          'الاستوديو',
      packId: widget.gameId,
    );

    try {
      final result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.childId,
        gameId: widget.gameId,
        drawingMode: widget.drawingMode,
        documentJson: document.toJsonString(),
        documentVersion: document.version,
        existingCreation: widget.continueCreation,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت في رسوماتي'
            : 'تعذر الحفظ. رسمتك ما زالت أمامك.';
      });
      if (result.isSuccess) widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. رسمتك ما زالت أمامك.';
      });
    }
  }
}

class ColoringActivityHost extends StatefulWidget {
  const ColoringActivityHost({
    required this.controller,
    required this.creationStore,
    this.disposeController = true,
    this.onSaved,
  });

  final GameSessionController controller;
  final LocalCreationStore creationStore;
  final bool disposeController;
  final VoidCallback? onSaved;

  @override
  State<ColoringActivityHost> createState() => ColoringActivityHostState();
}

class ColoringActivityHostState extends State<ColoringActivityHost> {
  final GlobalKey _key = GlobalKey();
  String? _message;
  bool _saving = false;

  @override
  void dispose() {
    if (widget.disposeController) widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Expanded(
          child: TraceColorSurface(
            controller: widget.controller,
            canvasRepaintBoundaryKey: _key,
          ),
        ),
        if (_message != null)
          Semantics(
            liveRegion: true,
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Text(_message!),
            ),
          ),
        SafeArea(
          minimum: const EdgeInsets.all(12),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_alt),
              label: Text(_saving ? 'جارٍ الحفظ…' : 'احفظ رسمتي'),
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _save() async {
    final boundary = _key.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز الرسم للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });
    final document = CreationDocument(
      version: kCreationDocVersion,
      mode: 'coloring',
      fills: widget.controller.regionColors.entries
          .map((entry) => CreationFill(regionId: entry.key, hex: entry.value))
          .toList(growable: false),
      palette: widget.controller.level.coloring?.palette ?? const [],
      templateAsset: widget.controller.level.coloring?.templateAsset,
      packId: widget.controller.pack.packId,
      levelIndex: widget.controller.levelIndex,
      createdAt: DateTime.now(),
      creationType: CreationType.coloring,
    );

    try {
      final result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.controller.childId,
        gameId: widget.controller.gameId,
        drawingMode: 'coloring',
        documentJson: document.toJsonString(),
        documentVersion: document.version,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت في رسوماتي'
            : 'تعذر الحفظ. حاول مرة أخرى.';
      });
      if (result.isSuccess) widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. حاول مرة أخرى.';
      });
    }
  }
}

/// Owns a trace-engine controller and offers an honest flattened save.
///
/// Trace/connect-dots/copy currently expose no serializable child path. Saving a
/// PNG keeps the child's visible result without falsely advertising it as an
/// editable document; free-draw and coloring continue to save real documents.
class TraceActivityHost extends StatefulWidget {
  const TraceActivityHost({
    required this.title,
    required this.controller,
    required this.creationStore,
    required this.drawingMode,
    this.disposeController = true,
    this.onSaved,
  });

  final String title;
  final GameSessionController controller;
  final LocalCreationStore creationStore;
  final String drawingMode;
  final bool disposeController;
  final VoidCallback? onSaved;

  @override
  State<TraceActivityHost> createState() => TraceActivityHostState();
}

class TraceActivityHostState extends State<TraceActivityHost> {
  final GlobalKey _captureKey = GlobalKey();
  String? _message;
  bool _saving = false;

  @override
  void dispose() {
    if (widget.disposeController) widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Column(
        children: [
          Expanded(
            child: TraceColorSurface(
              controller: widget.controller,
              canvasRepaintBoundaryKey: _captureKey,
            ),
          ),
          if (_message != null)
            Semantics(
              liveRegion: true,
              child: Padding(
                padding: const EdgeInsets.all(8),
                child: Text(_message!),
              ),
            ),
          SafeArea(
            minimum: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.save_alt),
                label: Text(_saving ? 'جارٍ الحفظ…' : 'احفظ النتيجة'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _save() async {
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      setState(() => _message = 'تعذر تجهيز النتيجة للحفظ. حاول مرة أخرى.');
      return;
    }

    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      final result = await widget.creationStore.saveFromBoundary(
        boundary: boundary,
        childId: widget.controller.childId,
        gameId: widget.controller.gameId,
        drawingMode: widget.drawingMode,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = result.isSuccess
            ? 'حُفظت النتيجة في رسوماتي'
            : 'تعذر الحفظ. حاول مرة أخرى.';
      });
      if (result.isSuccess) widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _message = 'تعذر الحفظ. حاول مرة أخرى.';
      });
    }
  }
}

class _NoopReporter implements AttemptReporter {
  @override
  Future<void> report(GameAttempt attempt) async {}
}
