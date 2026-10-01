/// Chrome and helpers shared by every non-trace engine.
///
/// The kit owns only presentation: authored content, scoring and progression stay
/// in the pack and session controller. It applies one Majarra palette while age
/// tracks vary spacing, radius and density.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../app/theme/app_colors.dart';
import 'game_art.dart';
import 'game_services.dart';
import 'game_session_controller.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// Reads a list of objects out of authored level JSON.
List<Map<String, dynamic>> mapList(Object? value) {
  if (value is! List) return const [];
  return value
      .map((entry) => entry is Map ? Map<String, dynamic>.from(entry) : null)
      .whereType<Map<String, dynamic>>()
      .toList(growable: false);
}

/// A string field, or empty when absent or of the wrong type.
String str(Map<String, dynamic> map, String key) {
  final value = map[key];
  return value is String ? value : '';
}

/// An integer field with a fallback.
int intOr(Map<String, dynamic> map, String key, int fallback) {
  final value = map[key];
  return value is num ? value.toInt() : fallback;
}

/// A double field with a fallback.
double doubleOr(Map<String, dynamic> map, String key, double fallback) {
  final value = map[key];
  return value is num ? value.toDouble() : fallback;
}

/// A list of strings, preserving nulls as null so a "missing slot" survives.
List<String?> nullableStrings(Object? value) {
  if (value is! List) return [];
  return value
      .map((entry) => entry is String ? entry : null)
      .toList(growable: false);
}

/// A list of integers, preserving nulls.
List<int?> nullableInts(Object? value) {
  if (value is! List) return [];
  return value
      .map((entry) => entry is num ? entry.toInt() : null)
      .toList(growable: false);
}

/// A deterministic shuffle seeded from the level, so a rebuild does not reshuffle
/// the board under a child's finger.
List<T> seededShuffle<T>(List<T> items, int seed) {
  if (items.isEmpty) return [];
  if (items.length == 1) return List<T>.of(items);
  final copy = List<T>.of(items);
  copy.shuffle(math.Random(seed));
  return copy;
}

final _arabicIndicDigits = [
  AppLocalizationsAr().gamesgameboardkitSeed01,
  AppLocalizationsAr().gamesgameboardkitSeed02,
  AppLocalizationsAr().gamesgameboardkitSeed03,
  AppLocalizationsAr().gamesgameboardkitSeed04,
  '٤',
  '٥',
  '٦',
  '٧',
  '٨',
  '٩',
];

/// Renders [value] in the numeral system the pack asks for.
String formatNumeral(int value, String system, {String languageCode = 'ar'}) {
  final useArabicIndic = switch (system) {
    'arabic_indic' => true,
    'western' => false,
    _ => languageCode == 'ar',
  };
  final western = value.toString();
  if (!useArabicIndic) return western;
  return western.split('').map((ch) {
    final digit = int.tryParse(ch);
    return digit == null ? ch : _arabicIndicDigits[digit];
  }).join();
}

/// Age-aware layout values. Brand colours remain identical for every track.
@immutable
class GameBoardVisualSpec {
  const GameBoardVisualSpec({
    required this.track,
    required this.surfaceRadius,
    required this.spacing,
    required this.boardPadding,
    required this.visualDensity,
    required this.maxContentWidth,
  });

  factory GameBoardVisualSpec.forAgeTrack(AgeTrack track) => switch (track) {
    AgeTrack.preschool => const GameBoardVisualSpec(
      track: AgeTrack.preschool,
      surfaceRadius: 28,
      spacing: 20,
      boardPadding: 20,
      visualDensity: VisualDensity.comfortable,
      maxContentWidth: 760,
    ),
    AgeTrack.kids => const GameBoardVisualSpec(
      track: AgeTrack.kids,
      surfaceRadius: 20,
      spacing: 16,
      boardPadding: 16,
      visualDensity: VisualDensity.standard,
      maxContentWidth: 900,
    ),
    AgeTrack.junior => const GameBoardVisualSpec(
      track: AgeTrack.junior,
      surfaceRadius: 14,
      spacing: 12,
      boardPadding: 12,
      visualDensity: VisualDensity.compact,
      maxContentWidth: 1040,
    ),
  };

  final AgeTrack track;
  final double surfaceRadius;
  final double spacing;
  final double boardPadding;
  final VisualDensity visualDensity;
  final double maxContentWidth;

  Color get backgroundColor => AppColors.midnight;
  Color get surfaceColor => AppColors.indigoSurface;
  Color get accentColor => AppColors.starGold;
  Color get focusColor => AppColors.electricCyan;
  Color get foregroundColor => AppColors.starlight;

  Duration motionDuration({required bool reduceMotion}) => reduceMotion
      ? Duration.zero
      : Duration(milliseconds: track == AgeTrack.preschool ? 220 : 160);
}

/// Child-facing states supported by the shared shell.
enum GameStateKind {
  loading,
  empty,
  unavailable,
  error,
  correct,
  retry,
  levelComplete,
  gameComplete,
}

/// A semantic state surface using text, an icon and a bordered shape.
class GameStatePanel extends StatelessWidget {
  const GameStatePanel({
    required this.kind,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.compact = false,
    super.key,
  });

  final GameStateKind kind;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool compact;

  IconData get _icon => switch (kind) {
    GameStateKind.loading => Icons.hourglass_top_rounded,
    GameStateKind.empty => Icons.inbox_outlined,
    GameStateKind.unavailable => Icons.lock_outline_rounded,
    GameStateKind.error => Icons.cloud_off_outlined,
    GameStateKind.correct => Icons.check_circle_outline_rounded,
    GameStateKind.retry => Icons.refresh_rounded,
    GameStateKind.levelComplete => Icons.flag_outlined,
    GameStateKind.gameComplete => Icons.workspace_premium_outlined,
  };

  Color _accent(ColorScheme scheme) => switch (kind) {
    GameStateKind.correct ||
    GameStateKind.levelComplete ||
    GameStateKind.gameComplete => AppColors.success,
    GameStateKind.error => AppColors.danger,
    GameStateKind.loading ||
    GameStateKind.empty ||
    GameStateKind.unavailable ||
    GameStateKind.retry => scheme.primary,
  };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final accent = _accent(scheme);
    return Semantics(
      container: true,
      liveRegion: kind != GameStateKind.empty,
      label: '$title. $message',
      child: Container(
        constraints: const BoxConstraints(maxWidth: 520),
        padding: EdgeInsets.all(compact ? 12 : 24),
        decoration: BoxDecoration(
          color: scheme.surfaceContainer,
          borderRadius: BorderRadius.circular(compact ? 16 : 24),
          border: Border.all(color: accent, width: 2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ExcludeSemantics(
              child: Icon(_icon, color: accent, size: compact ? 28 : 52),
            ),
            SizedBox(height: compact ? 8 : 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style:
                  (compact
                          ? Theme.of(context).textTheme.titleMedium
                          : Theme.of(context).textTheme.titleLarge)
                      ?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (onAction != null && actionLabel != null) ...[
              SizedBox(height: compact ? 10 : 18),
              FilledButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(actionLabel!),
              ),
            ],
            if (kind == GameStateKind.loading) ...[
              const SizedBox(height: 14),
              const LinearProgressIndicator(),
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-screen host for loading, empty, unavailable and error states.
class GameStateScaffold extends StatelessWidget {
  const GameStateScaffold({required this.panel, super.key});

  final GameStatePanel panel;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      backgroundColor: AppColors.midnight,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: panel,
          ),
        ),
      ),
    );
  }
}

/// A shared minimum size for every child-facing Material action.
ButtonStyle gameActionStyle(double touchTarget) => ButtonStyle(
  minimumSize: WidgetStatePropertyAll(Size(touchTarget, touchTarget)),
  visualDensity: VisualDensity.standard,
);

/// Visible keyboard/D-pad focus that remains when motion is reduced.
class GameFocusFrame extends StatefulWidget {
  const GameFocusFrame({
    required this.child,
    required this.borderRadius,
    this.reduceMotion = false,
    super.key,
  });

  final Widget child;
  final BorderRadius borderRadius;
  final bool reduceMotion;

  @override
  State<GameFocusFrame> createState() => _GameFocusFrameState();
}

class _GameFocusFrameState extends State<GameFocusFrame> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    return FocusableActionDetector(
      enabled: false,
      onShowFocusHighlight: (focused) => setState(() => _focused = focused),
      child: AnimatedContainer(
        duration: widget.reduceMotion
            ? Duration.zero
            : const Duration(milliseconds: 120),
        decoration: BoxDecoration(
          borderRadius: widget.borderRadius,
          border: Border.all(
            color: _focused ? AppColors.starlight : Colors.transparent,
            width: 2,
          ),
          boxShadow: _focused
              ? [
                  BoxShadow(
                    color: AppColors.electricCyan.withValues(alpha: 0.7),
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ]
              : null,
        ),
        child: widget.child,
      ),
    );
  }
}

/// Branded chrome shared by the board engines.
class BoardScaffold extends StatelessWidget {
  const BoardScaffold({
    required this.controller,
    required this.prompt,
    required this.child,
    this.footer,
    this.header,
    super.key,
  });

  final GameSessionController controller;
  final String? prompt;
  final Widget child;
  final Widget? footer;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(controller.pack.accessibility);
    final spec = GameBoardVisualSpec.forAgeTrack(controller.ageTrack);
    final reduceMotion =
        controller.settings.reduceMotion ||
        MediaQuery.maybeDisableAnimationsOf(context) == true;
    final progress = controller.levelCount <= 0
        ? 0.0
        : (controller.levelIndex + 1) / controller.levelCount;
    final levelLabel =
        'المستوى ${controller.levelIndex + 1} من ${controller.levelCount}';
    final effectivePrompt = safeChildFacingLabel(
      authoredText: prompt,
      arabicFallback: 'استمع إلى التعليمة وابدأ اللعب.',
    );

    final themed = Theme.of(context).copyWith(
      focusColor: spec.focusColor.withValues(alpha: 0.35),
      hoverColor: spec.focusColor.withValues(alpha: 0.12),
      visualDensity: spec.visualDensity,
    );

    final instruction = Semantics(
      liveRegion: true,
      header: true,
      label: '$levelLabel. $effectivePrompt',
      value: '${(progress * 100).round()} بالمئة',
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(horizontal: spec.spacing, vertical: 10),
        decoration: BoxDecoration(
          color: spec.surfaceColor,
          borderRadius: BorderRadius.circular(spec.surfaceRadius),
          border: Border.all(color: spec.focusColor, width: 1.5),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final textScale = MediaQuery.textScalerOf(context).scale(1);

            Widget promptAndProgress() => Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  effectivePrompt,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: spec.foregroundColor,
                  ),
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: progress.clamp(0, 1),
                    minHeight: 8,
                    color: spec.accentColor,
                    backgroundColor: AppColors.elevatedSurface,
                  ),
                ),
              ],
            );

            Widget levelText() => Text(
              levelLabel,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: spec.foregroundColor,
                fontWeight: FontWeight.w700,
              ),
            );

            if (constraints.maxWidth >= 520 && textScale <= 1.3) {
              return Row(
                children: [
                  ExcludeSemantics(
                    child: Icon(
                      Icons.campaign_outlined,
                      color: spec.focusColor,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: promptAndProgress()),
                  const SizedBox(width: 10),
                  levelText(),
                ],
              );
            }

            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    ExcludeSemantics(
                      child: Icon(
                        Icons.campaign_outlined,
                        color: spec.focusColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: promptAndProgress()),
                  ],
                ),
                const SizedBox(height: 8),
                levelText(),
              ],
            );
          },
        ),
      ),
    );

    final repeat = GameFocusFrame(
      borderRadius: BorderRadius.circular(16),
      reduceMotion: reduceMotion,
      child: OutlinedButton.icon(
        key: const Key('repeat_instruction_button'),
        onPressed: controller.repeatInstruction,
        icon: const Icon(Icons.volume_up_outlined),
        label: const Text('أعد التعليمة'),
        style: gameActionStyle(target).copyWith(
          foregroundColor: const WidgetStatePropertyAll(AppColors.starlight),
          side: const WidgetStatePropertyAll(
            BorderSide(color: AppColors.electricCyan, width: 1.5),
          ),
        ),
      ),
    );

    return Theme(
      data: themed,
      child: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: AppColors.cinematicBackground,
        ),
        child: SafeArea(
          child: FocusTraversalGroup(
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: spec.maxContentWidth),
                child: Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: spec.spacing,
                    vertical: 8,
                  ),
                  child: Column(
                    children: [
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final textScale = MediaQuery.textScalerOf(
                            context,
                          ).scale(1);
                          if (constraints.maxWidth >= 600 && textScale <= 1.3) {
                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(child: instruction),
                                SizedBox(width: spec.spacing),
                                repeat,
                              ],
                            );
                          }
                          return Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              instruction,
                              SizedBox(height: spec.spacing),
                              repeat,
                            ],
                          );
                        },
                      ),
                      if (header != null) ...[
                        SizedBox(height: spec.spacing),
                        header!,
                      ],
                      SizedBox(height: spec.spacing),
                      Expanded(
                        child: AnimatedContainer(
                          duration: spec.motionDuration(
                            reduceMotion: reduceMotion,
                          ),
                          padding: EdgeInsets.all(spec.boardPadding),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(
                              spec.surfaceRadius,
                            ),
                            boxShadow: AppColors.premiumCardShadow,
                          ),
                          child: GameDecorativeSurface(
                            role: GameArtRole.board,
                            gameId: controller.gameId,
                            borderRadius: BorderRadius.circular(
                              spec.surfaceRadius,
                            ),
                            child: child,
                          ),
                        ),
                      ),
                      if (footer != null) ...[
                        SizedBox(height: spec.spacing),
                        footer!,
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A choice button sized to the pack's touch target.
class ChoiceTile extends StatelessWidget {
  const ChoiceTile({
    required this.label,
    required this.selected,
    required this.onPressed,
    required this.touchTarget,
    this.semanticsLabel,
    this.eliminated = false,
    this.patternIndex,
    this.art,
    super.key,
  });

  final String label;
  final bool selected;
  final VoidCallback? onPressed;
  final double touchTarget;
  final String? semanticsLabel;
  final bool eliminated;
  final int? patternIndex;
  final Widget? art;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final safeLabel = safeChildFacingLabel(
      authoredText: semanticsLabel ?? label,
      arabicFallback: 'اختيار',
    );
    final safeVisibleLabel = safeChildFacingLabel(
      authoredText: label,
      arabicFallback: safeLabel,
    );
    return Semantics(
      button: true,
      selected: selected,
      enabled: !eliminated && onPressed != null,
      label: safeLabel,
      child: Opacity(
        opacity: eliminated ? 0.35 : 1,
        child: InkWell(
          onTap: eliminated ? null : onPressed,
          child: Container(
            constraints: BoxConstraints(
              minWidth: touchTarget,
              minHeight: touchTarget,
            ),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: selected
                  ? scheme.primaryContainer
                  : scheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected ? scheme.primary : scheme.outlineVariant,
                width: selected ? 3 : 1,
              ),
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (patternIndex != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Icon(nonColourGlyph(patternIndex!), size: 20),
                  ),
                if (art != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: SizedBox.square(dimension: touchTarget, child: art),
                  ),
                if (label.isNotEmpty)
                  Text(
                    safeVisibleLabel,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A shape mark that distinguishes an item without relying on colour.
IconData nonColourGlyph(int index) {
  final glyphs = [
    Icons.circle_outlined,
    Icons.square_outlined,
    Icons.change_history_outlined,
    Icons.star_outline,
    Icons.hexagon_outlined,
    Icons.favorite_outline,
  ];
  return glyphs[index.abs() % glyphs.length];
}
