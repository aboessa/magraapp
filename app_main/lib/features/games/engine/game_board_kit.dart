/// Chrome and helpers shared by every non-trace engine.
///
/// Extracted from `wave_one_engines.dart` when Wave 2 arrived. The alternative
/// was a second copy of the prompt header, the mandatory repeat-instruction
/// control and the level-JSON readers, which is precisely the "twelve different
/// behaviours" outcome `docs/games/08-implementation-plan.md` warns about for the
/// encouragement and accessibility layers.
///
/// Nothing here decides pedagogy. It decides layout, and it enforces the two
/// contract items that are structural rather than per-engine: the repeat button
/// exists in every engine, and no interactive target is smaller than the pack's
/// minimum.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'game_services.dart';
import 'game_session_controller.dart';

/// Reads a list of objects out of authored level JSON.
///
/// Tolerant of `Map<dynamic, dynamic>`, which is what a Dart-built fixture or a
/// CMS preview produces, and which a direct cast to `Map<String, dynamic>`
/// throws on.
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
  if (value is! List) return const [];
  return value.map((entry) => entry is String ? entry : null).toList(growable: false);
}

/// A list of integers, preserving nulls.
List<int?> nullableInts(Object? value) {
  if (value is! List) return const [];
  return value
      .map((entry) => entry is num ? entry.toInt() : null)
      .toList(growable: false);
}

/// A deterministic shuffle seeded from the level, so a rebuild does not reshuffle
/// the board under a child's finger.
List<T> seededShuffle<T>(List<T> items, int seed) {
  final copy = List<T>.of(items);
  copy.shuffle(math.Random(seed));
  return copy;
}

const _arabicIndicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/// Renders [value] in the numeral system the pack asks for.
///
/// `count_quantity`'s contract is explicit that `numeral_system` is presentation
/// only and the stored value is always the number. This function is therefore the
/// only place a numeral becomes text, and it never returns something that could
/// be stored back as data.
///
/// `auto` follows the interface language, because a child reading an Arabic
/// interface is being taught Arabic-Indic digits.
String formatNumeral(int value, String system, {String languageCode = 'ar'}) {
  final useArabicIndic = switch (system) {
    'arabic_indic' => true,
    'western' => false,
    _ => languageCode == 'ar',
  };
  final western = value.toString();
  if (!useArabicIndic) return western;
  return western
      .split('')
      .map((ch) {
        final digit = int.tryParse(ch);
        return digit == null ? ch : _arabicIndicDigits[digit];
      })
      .join();
}

/// Chrome shared by the board engines: the prompt, an optional footer, and the
/// mandatory repeat-instruction control.
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
    return Column(
      children: [
        if (prompt != null && prompt!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Semantics(
              liveRegion: true,
              child: Text(
                prompt!,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ),
        if (header != null) header!,
        Expanded(child: Padding(padding: const EdgeInsets.all(16), child: child)),
        if (footer != null) footer!,
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: OutlinedButton.icon(
            // Mandatory in every pack per the data contract.
            key: const Key('repeat_instruction_button'),
            onPressed: controller.repeatInstruction,
            icon: const Icon(Icons.volume_up_outlined),
            label: const Text('أعد التعليمة'),
            style: ButtonStyle(
              minimumSize: WidgetStatePropertyAll(Size(target, target)),
            ),
          ),
        ),
      ],
    );
  }
}

/// A choice button sized to the pack's touch target.
///
/// [patternIndex] adds a non-colour distinguishing mark. `logic_pattern` makes
/// that mandatory for colour blindness, and applying it to every choice surface
/// means no engine can regress into colour-only signalling.
class ChoiceTile extends StatelessWidget {
  const ChoiceTile({
    required this.label,
    required this.selected,
    required this.onPressed,
    required this.touchTarget,
    this.semanticsLabel,
    this.eliminated = false,
    this.patternIndex,
    super.key,
  });

  final String label;
  final bool selected;
  final VoidCallback? onPressed;
  final double touchTarget;
  final String? semanticsLabel;

  /// Ruled out by the help ladder. Shown but not tappable, so the board does not
  /// reflow under the child's hand.
  final bool eliminated;

  final int? patternIndex;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      selected: selected,
      enabled: !eliminated && onPressed != null,
      label: semanticsLabel ?? label,
      child: Opacity(
        opacity: eliminated ? 0.35 : 1,
        child: InkWell(
          onTap: eliminated ? null : onPressed,
          child: Container(
            constraints: BoxConstraints(minWidth: touchTarget, minHeight: touchTarget),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: selected ? scheme.primaryContainer : scheme.surfaceContainerHighest,
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
                Text(
                  label,
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
///
/// `logic_pattern`'s acceptance criteria forbid colour-only differentiation at
/// every level. Until real artwork ships, this is what carries the distinction,
/// and it stays afterwards as the redundant channel.
IconData nonColourGlyph(int index) {
  const glyphs = [
    Icons.circle_outlined,
    Icons.square_outlined,
    Icons.change_history_outlined,
    Icons.star_outline,
    Icons.hexagon_outlined,
    Icons.favorite_outline,
  ];
  return glyphs[index.abs() % glyphs.length];
}
