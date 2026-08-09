/// Dart model of `games.content_pack`, mirroring
/// `docs/games/schemas/trace_color.v1.schema.json`.
///
/// Parsing is deliberately tolerant of *missing* optional fields and strict
/// about the shape of what is present: the server validates packs before
/// publish, so the client's job is to read a valid pack, not to re-litigate it.
/// Anything genuinely unusable surfaces as [GamePackParseException] rather than a
/// half-built object that fails later inside a paint call.
library;

import 'trace_geometry.dart';

class GamePackParseException implements Exception {
  GamePackParseException(this.message);
  final String message;
  @override
  String toString() => 'GamePackParseException: $message';
}

/// Coerces a decoded JSON value into a string-keyed map.
///
/// `jsonDecode` always produces `Map<String, dynamic>`, but a map built in Dart
/// code — a test fixture, a CMS preview, a cached literal — can be
/// `Map<dynamic, dynamic>`, which is *not* a subtype and fails a direct cast.
/// Returning null for anything that is not a map keeps every call site a
/// null-check rather than a try/catch.
Map<String, dynamic>? _asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) {
    return <String, dynamic>{
      for (final entry in value.entries) entry.key.toString(): entry.value,
    };
  }
  return null;
}

/// Coerces into a list of string-keyed maps, skipping entries that are not maps.
List<Map<String, dynamic>> _asMapList(Object? value) {
  if (value is! List) return const [];
  return value.map(_asMap).whereType<Map<String, dynamic>>().toList(growable: false);
}

/// Drawing modes the engine understands.
///
/// The first five are the original v1 trace sub-modes; the rest were added when
/// the engine gained non-trace drawing. `unknown` exists so a pack authored for
/// a newer engine degrades to a clear message instead of crashing.
enum DrawingMode {
  line,
  curve,
  shape,
  number,
  letter,
  path,
  connectDots,
  coloring,
  freeDraw,
  copyPattern,
  completeDrawing,
  drawFromPrompt,
  unknown;

  static DrawingMode fromJson(String? value) {
    switch (value) {
      case 'line': return DrawingMode.line;
      case 'curve': return DrawingMode.curve;
      case 'shape': return DrawingMode.shape;
      case 'number': return DrawingMode.number;
      case 'letter': return DrawingMode.letter;
      case 'path': return DrawingMode.path;
      case 'connect_dots': return DrawingMode.connectDots;
      case 'coloring': return DrawingMode.coloring;
      case 'free_draw': return DrawingMode.freeDraw;
      case 'copy_pattern': return DrawingMode.copyPattern;
      case 'complete_drawing': return DrawingMode.completeDrawing;
      case 'draw_from_prompt': return DrawingMode.drawFromPrompt;
      default: return DrawingMode.unknown;
    }
  }

  /// Whether the mode traces authored geometry.
  bool get isTrace => const {
        DrawingMode.line, DrawingMode.curve, DrawingMode.shape,
        DrawingMode.number, DrawingMode.letter, DrawingMode.path,
        DrawingMode.copyPattern,
      }.contains(this);

  /// Whether the mode produces an artefact the child may keep.
  bool get isCreation => const {
        DrawingMode.coloring, DrawingMode.freeDraw, DrawingMode.drawFromPrompt,
        DrawingMode.completeDrawing, DrawingMode.copyPattern,
      }.contains(this);
}

/// How a level is scored, as declared by the pack.
///
/// Read from data rather than inferred from the mode, because the server
/// validates the pairing and the client must not be a second, disagreeing
/// authority on whether a child's drawing gets a mark.
enum ScoringMode {
  geometric,
  geometricOrdered,
  sequence,
  discrete,
  none;

  static ScoringMode fromJson(String? value) {
    switch (value) {
      case 'geometric': return ScoringMode.geometric;
      case 'geometric_ordered': return ScoringMode.geometricOrdered;
      case 'sequence': return ScoringMode.sequence;
      case 'discrete': return ScoringMode.discrete;
      default: return ScoringMode.none;
    }
  }

  /// True when the level contributes to `score` / `max_score` at all.
  bool get isScored => this != ScoringMode.none;

  /// True when stroke order is part of the measurement.
  bool get enforcesOrder => this == ScoringMode.geometricOrdered;
}

enum CompletionRule {
  allStrokesComplete,
  allDotsConnected,
  childTapsDone;

  static CompletionRule fromJson(String? value) {
    switch (value) {
      case 'all_strokes_complete': return CompletionRule.allStrokesComplete;
      case 'all_dots_connected': return CompletionRule.allDotsConnected;
      default: return CompletionRule.childTapsDone;
    }
  }
}

class ConnectDot {
  const ConnectDot({required this.id, required this.order, required this.at});

  factory ConnectDot.fromJson(Map<String, dynamic> json) => ConnectDot(
        id: json['id'] as String? ?? '',
        order: (json['order'] as num?)?.toInt() ?? 1,
        at: NormalizedPoint.fromJson(json['at'] as List<dynamic>),
      );

  final String id;
  final int order;
  final NormalizedPoint at;
}

class ColoringConfig {
  const ColoringConfig({
    required this.enabled,
    required this.palette,
    this.regions = const [],
    this.templateAsset,
  });

  factory ColoringConfig.fromJson(Map<String, dynamic> json) => ColoringConfig(
        enabled: json['enabled'] == true,
        palette: (json['palette'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(growable: false),
        regions: (json['regions'] as List<dynamic>? ?? const [])
            .whereType<String>()
            .toList(growable: false),
        templateAsset: json['template_asset'] as String?,
      );

  final bool enabled;
  final List<String> palette;
  final List<String> regions;
  final String? templateAsset;
}

class SimplifiedMotorConfig {
  const SimplifiedMotorConfig({
    required this.toleranceDp,
    required this.coverageRequired,
  });

  factory SimplifiedMotorConfig.fromJson(Map<String, dynamic> json) =>
      SimplifiedMotorConfig(
        toleranceDp: (json['tolerance_dp'] as num?)?.toDouble() ?? 40,
        coverageRequired: (json['coverage_required'] as num?)?.toDouble() ?? 0.6,
      );

  final double toleranceDp;
  final double coverageRequired;
}

class PackAccessibility {
  const PackAccessibility({
    required this.simplifiedMotor,
    required this.sequentialTapAlternative,
    required this.reducedMotionSupported,
    required this.minTouchTargetDp,
  });

  factory PackAccessibility.fromJson(Map<String, dynamic>? json) {
    final data = json ?? const <String, dynamic>{};
    return PackAccessibility(
      simplifiedMotor: SimplifiedMotorConfig.fromJson(
        _asMap(data['simplified_motor']) ?? const <String, dynamic>{},
      ),
      // The schema pins this to true, so the fallback matches the contract
      // rather than silently disabling the alternative if a field goes missing.
      sequentialTapAlternative: data['sequential_tap_alternative'] != false,
      reducedMotionSupported: data['reduced_motion_supported'] != false,
      minTouchTargetDp: (data['min_touch_target_dp'] as num?)?.toDouble() ?? 48,
    );
  }

  final SimplifiedMotorConfig simplifiedMotor;
  final bool sequentialTapAlternative;
  final bool reducedMotionSupported;
  final double minTouchTargetDp;
}

class GameLevel {
  const GameLevel({
    required this.level,
    required this.mode,
    required this.scoring,
    required this.completion,
    required this.strokes,
    required this.dots,
    required this.toleranceDp,
    required this.coverageRequired,
    this.promptKey,
    this.prompt,
    this.glyph,
    this.language,
    this.letterForm,
    this.writingDirection,
    this.guideAudio,
    this.backgroundAsset,
    this.coloring,
  });

  factory GameLevel.fromJson(Map<String, dynamic> json) {
    final strokes = _asMapList(json['stroke_paths'])
        .map(TraceStroke.fromJson)
        .toList()
      // Drawing order is the pedagogy for Arabic letters: body before dots.
      // Sorting here means no rendering or input path can accidentally rely on
      // the order the JSON happened to be written in.
      ..sort((a, b) => a.order.compareTo(b.order));

    final dots = _asMapList(json['dots'])
        .map(ConnectDot.fromJson)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));

    return GameLevel(
      level: (json['level'] as num?)?.toInt() ?? 1,
      mode: DrawingMode.fromJson(json['mode'] as String?),
      scoring: ScoringMode.fromJson(json['scoring'] as String?),
      completion: CompletionRule.fromJson(
        _asMap(json['completion'])?['rule'] as String?,
      ),
      strokes: strokes,
      dots: dots,
      toleranceDp: (json['tolerance_dp'] as num?)?.toDouble() ?? 24,
      coverageRequired: (json['coverage_required'] as num?)?.toDouble() ?? 0.8,
      promptKey: json['prompt_key'] as String?,
      prompt: json['prompt'] as String?,
      glyph: json['glyph'] as String?,
      language: json['language'] as String?,
      letterForm: json['letter_form'] as String?,
      writingDirection: json['writing_direction'] as String?,
      guideAudio: json['guide_audio'] as String?,
      backgroundAsset: json['background_asset'] as String?,
      coloring: json['coloring'] == null
          ? null
          : ColoringConfig.fromJson(_asMap(json['coloring'])!),
    );
  }

  final int level;
  final DrawingMode mode;
  final ScoringMode scoring;
  final CompletionRule completion;
  final List<TraceStroke> strokes;
  final List<ConnectDot> dots;
  final double toleranceDp;
  final double coverageRequired;
  final String? promptKey;

  /// Resolved text for [promptKey], attached by the server for the chosen
  /// language. Null means the pack is not localised for this language yet.
  final String? prompt;
  final String? glyph;
  final String? language;
  final String? letterForm;
  final String? writingDirection;
  final String? guideAudio;
  final String? backgroundAsset;
  final ColoringConfig? coloring;

  /// `max_score` contribution. Colouring is excluded from scoring entirely, so an
  /// unscored level contributes nothing rather than contributing zero out of one.
  int get maxScore {
    if (!scoring.isScored) return 0;
    if (mode == DrawingMode.connectDots) return dots.isEmpty ? 0 : 1;
    return strokes.length;
  }

  bool get hasColoringStage => coloring?.enabled == true;

  /// True when the level is right-to-left *by its own data*.
  ///
  /// Never taken from the interface direction: the localization document is
  /// explicit that stroke direction comes from the letter, not the UI.
  bool get isRtl => writingDirection == 'rtl';
}

class GameProgression {
  const GameProgression({required this.levelsToFinish, required this.advanceOnLevelComplete});

  factory GameProgression.fromJson(Map<String, dynamic>? json) {
    final data = json ?? const <String, dynamic>{};
    return GameProgression(
      levelsToFinish: (data['levels_to_finish'] as num?)?.toInt() ?? 1,
      advanceOnLevelComplete: data['advance_on'] != 'manual',
    );
  }

  final int levelsToFinish;
  final bool advanceOnLevelComplete;
}

class GamePack {
  const GamePack({
    required this.packVersion,
    required this.engineId,
    required this.levels,
    required this.progression,
    required this.accessibility,
    required this.voiceManifest,
    this.packId,
    this.localization,
    this.supportsDpad = false,
  });

  factory GamePack.fromJson(Map<String, dynamic> json) {
    final rawLevels = json['levels'] as List<dynamic>?;
    if (rawLevels == null || rawLevels.isEmpty) {
      throw GamePackParseException('content_pack has no levels');
    }
    final levels = _asMapList(rawLevels)
        .map(GameLevel.fromJson)
        .toList()
      ..sort((a, b) => a.level.compareTo(b.level));
    if (levels.isEmpty) {
      throw GamePackParseException('content_pack levels are malformed');
    }

    return GamePack(
      packVersion: (json['pack_version'] as num?)?.toInt() ?? 1,
      engineId: json['engine_id'] as String? ?? '',
      packId: json['pack_id'] as String?,
      localization: json['localization'] as String?,
      supportsDpad: json['supports_dpad'] == true,
      levels: levels,
      progression: GameProgression.fromJson(_asMap(json['progression'])),
      accessibility: PackAccessibility.fromJson(_asMap(json['accessibility'])),
      voiceManifest: {
        for (final entry in (_asMap(json['voice_manifest']) ?? const <String, dynamic>{}).entries)
          if (entry.value is String) entry.key: entry.value as String,
      },
    );
  }

  final int packVersion;
  final String engineId;
  final String? packId;
  final String? localization;
  final bool supportsDpad;
  final List<GameLevel> levels;
  final GameProgression progression;
  final PackAccessibility accessibility;
  final Map<String, String> voiceManifest;

  /// Total achievable score across the pack, excluding unscored levels.
  int get maxScore => levels.fold(0, (sum, level) => sum + level.maxScore);

  /// True when any level produces something the child might want to keep.
  bool get producesCreations => levels.any((level) => level.mode.isCreation || level.hasColoringStage);
}
