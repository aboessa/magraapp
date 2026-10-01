/// الفنّ الملوّن لعناصر الألعاب: صورة حقيقية لكل بطاقة/سلّة/قطعة/حدث بدل المعرّف نصًّا.
///
/// ## لماذا خريطة منفصلة عن `kDrawingAssetMap`
///
/// حِزم Wave 1–3 تُشير إلى `asset-color-*`، وهي في `kDrawingAssetMap` رسومات
/// **خطوط للتلوين** (أبيض وأسود) يحتاجها `trace_color` ولوحة التلوين كما هي.
/// لكن في لعبة مطابقة أو فرز أو ترتيب، الطفل يحتاج الصورة **الملوّنة** ليميّز.
/// فالخريطة هنا تُفضَّل داخل محركات اللعب فقط، ولا تمسّ التلوين.
///
/// ترتيب التحليل: فنّ ملوّن ← أي فنّ مربوط (حتى خطوط التلوين) ← اسم عربي
/// واضح ← أيقونة محايدة. لا يظهر المعرّف الخام (`asset-...`) للطفل أبدًا.
library;

import 'package:flutter/material.dart';

import '../data/drawing_asset_map.dart';
import '../presentation/widgets/drawing_asset.dart';

/// مشتقّات WebP بعرض 512 من الفنّ المراجَع في `games/wave/*` و`wave4/`.
const _a = 'assets/images/games/art';
const _wave = 'assets/images/games/wave';

/// الأدوار البصرية التي لا يحملها عقد pack v1 كحقول مستقلة.
///
/// تبقى الأدوار دقيقة عمدًا: خلفية المختبر ليست جهاز التجربة، وخلفية خط
/// الزمن ليست خلفية عامة. هذا يمنع أصلًا صحيحًا من الظهور في سياق خاطئ.
enum GameArtRole {
  background,
  board,
  cardBack,
  event,
  lab,
  apparatus,
  map,
  stage,
  timeline,
  sequencePanel,
}

/// مفتاح داخلي ثابت يربط لعبة canonical بدور بصري موجود فعليًا.
String _roleKey(String gameId, GameArtRole role) => '$gameId:${role.name}';

/// الأدوار الموجودة فقط؛ لا يشير أي مدخل إلى source أو أصل غير مُراجع.
///
/// الخريطة عامة كي يستطيع اختبار سلامة الحزمة التأكد أن كل ملف مسجل موجود.
final Map<String, String> kGameRoleArtMap = Map.unmodifiable({
  _roleKey('game-match-nature-3', GameArtRole.board):
      '$_wave/wave2-match-2/board-background.webp',
  _roleKey('game-wave2-match-2', GameArtRole.board):
      '$_wave/wave2-match-2/board-background.webp',
  _roleKey('game-wave1-picture-match', GameArtRole.board):
      '$_wave/wave1-picture-match/board-background.webp',
  _roleKey('game-wave1-memory-animals', GameArtRole.board):
      '$_wave/wave1-memory-animals/board-background.webp',
  _roleKey('game-wave1-memory-animals', GameArtRole.cardBack):
      '$_wave/wave1-memory-animals/card-back.webp',
  _roleKey('game-wave2-memory-2', GameArtRole.board):
      '$_wave/wave2-memory-2/board-background.webp',
  _roleKey('game-wave2-memory-2', GameArtRole.cardBack):
      '$_wave/wave2-memory-2/card-back.webp',
  _roleKey('game-wave2-rhythm', GameArtRole.stage):
      '$_wave/wave2-rhythm/stage-background.webp',
  _roleKey('game-wave1-sim-lab', GameArtRole.lab):
      '$_wave/wave1-sim-lab/lab-background.webp',
  _roleKey('game-wave3-sim-saturating', GameArtRole.lab):
      '$_wave/wave3-sim-saturating/lab-background.webp',
  _roleKey('game-wave2-timeline', GameArtRole.timeline):
      '$_wave/wave2-timeline/timeline-background.webp',
  _roleKey('game-timeline-egypt-3', GameArtRole.timeline):
      '$_wave/wave2-timeline/timeline-background.webp',
  _roleKey('game-wave3-timeline-detail', GameArtRole.map):
      '$_wave/wave3-timeline-detail/map-timeline-background.webp',
  _roleKey('game-timeline-egypt-3', GameArtRole.map):
      '$_wave/wave3-timeline-detail/map-timeline-background.webp',
});

/// معرّف أصل/مفتاح حدث ودوره ← ملف موجود يمكن إعادة استخدامه بأمان.
final Map<String, String> kGameAssetRoleArtMap = Map.unmodifiable({
  '${GameArtRole.event.name}:timeline.event.pyramids':
      '$_wave/wave2-timeline/event-pyramids.webp',
  '${GameArtRole.event.name}:asset-wave4-pyramid':
      '$_wave/wave2-timeline/event-pyramids.webp',
  '${GameArtRole.event.name}:timeline.event.library_alex':
      '$_wave/wave2-timeline/event-library.webp',
  '${GameArtRole.event.name}:asset-library':
      '$_wave/wave2-timeline/event-library.webp',
  '${GameArtRole.apparatus.name}:asset-heat-apparatus':
      '$_wave/wave1-sim-lab/heat-apparatus.png',
  '${GameArtRole.apparatus.name}:asset-beaker-water':
      '$_wave/wave3-sim-saturating/beaker-water.png',
});

/// يحل دورًا بصريًا حسب الأصل أولًا ثم اللعبة، أو يعيد `null` بأمان.
String? gameRoleArtPath({
  required GameArtRole role,
  String? gameId,
  String? assetId,
}) {
  if (assetId != null && assetId.isNotEmpty) {
    final byAsset = kGameAssetRoleArtMap['${role.name}:$assetId'];
    if (byAsset != null) return byAsset;
  }
  if (gameId == null || gameId.isEmpty) return null;
  return kGameRoleArtMap[_roleKey(gameId, role)];
}

/// فن زخرفي لا يضيف عقدة semantics ولا يُظهر مسار الأصل عند فشل التحميل.
class DecorativeGameArt extends StatelessWidget {
  const DecorativeGameArt({
    required this.role,
    this.gameId,
    this.assetId,
    this.fit = BoxFit.cover,
    this.fallback,
    super.key,
  });

  final GameArtRole role;
  final String? gameId;
  final String? assetId;
  final BoxFit fit;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final surface = Theme.of(context).colorScheme.surfaceContainerLow;
    Widget safeFallback() =>
        ColoredBox(color: surface, child: fallback ?? const SizedBox.expand());

    final path = gameRoleArtPath(role: role, gameId: gameId, assetId: assetId);
    if (path == null) return ExcludeSemantics(child: safeFallback());
    return ExcludeSemantics(
      child: Image.asset(
        path,
        fit: fit,
        errorBuilder: (context, error, stackTrace) => safeFallback(),
      ),
    );
  }
}

/// سطح لعبة بخلفية زخرفية وطبقة contrast من ألوان الـtheme.
class GameDecorativeSurface extends StatelessWidget {
  const GameDecorativeSurface({
    required this.role,
    required this.child,
    this.gameId,
    this.assetId,
    this.scrimOpacity = 0.72,
    this.borderRadius = const BorderRadius.all(Radius.circular(16)),
    super.key,
  });

  final GameArtRole role;
  final Widget child;
  final String? gameId;
  final String? assetId;
  final double scrimOpacity;
  final BorderRadius borderRadius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ClipRRect(
      borderRadius: borderRadius,
      child: Stack(
        fit: StackFit.expand,
        children: [
          DecorativeGameArt(role: role, gameId: gameId, assetId: assetId),
          ColoredBox(
            color: scheme.surface.withValues(
              alpha: scrimOpacity.clamp(0.0, 1.0),
            ),
          ),
          child,
        ],
      ),
    );
  }
}

/// معرّف الحزمة ← صورة ملوّنة شفافة مُنتَجة ومراجَعة.
const kGameArtMap = <String, String>{
  // حيوانات
  'asset-color-cat': '$_a/animal-cat.webp',
  'asset-color-bird': '$_a/animal-bird.webp',
  'asset-color-fish': '$_a/animal-fish.webp',
  'asset-color-rabbit': '$_a/animal-rabbit.webp',
  'asset-color-lion': '$_a/animal-lion.webp',
  'asset-color-owl': '$_a/animal-owl.webp',
  'asset-color-turtle': '$_a/animal-turtle.webp',
  // أشياء
  'asset-color-apple': '$_a/red-apple.webp',
  'asset-color-rocket': '$_a/red-rocket.webp',
  'asset-color-boat': '$_a/blue-sailboat.webp',
  'asset-color-moon': '$_a/match-moon.webp',
  'asset-color-rainbow': '$_a/match-rainbow.webp',
  'asset-color-stars': '$_a/count-token-star.webp',
  'asset-color-house': '$_a/target-house.webp',
  'asset-color-tree': '$_a/tree.webp',
  'asset-color-flower': '$_a/flower.webp',
  'asset-color-car': '$_a/car.webp',
  // سِلال الفرز ولوحات الألعاب
  'asset-bin-red': '$_a/bin-red.webp',
  'asset-bin-blue': '$_a/bin-blue.webp',
  'asset-bin-circle': '$_a/bin-circle.webp',
  'asset-bin-star': '$_a/bin-star.webp',
  // قطع البرمجة والإيقاع
  'asset-robot-token': '$_a/robot-token.webp',
  'asset-goal-token': '$_a/goal-token.webp',
  'asset-obstacle-crate': '$_a/obstacle-crate.webp',
  'asset-drum-teal': '$_a/drum-teal.webp',
  'asset-drum-coral': '$_a/drum-coral.webp',
};

/// المسار المحلّي للفنّ الأنسب لمحركات اللعب، أو `null` إن لم يُنتَج شيء.
String? gameArtPath(String? assetId) {
  if (assetId == null || assetId.isEmpty) return null;
  return kGameArtMap[assetId] ?? drawingAssetPath(assetId);
}

const _arabicNames = <String, String>{
  'cat': 'قطة', 'bird': 'عصفور', 'fish': 'سمكة', 'fish-red': 'سمكة حمراء',
  'fish-blue': 'سمكة زرقاء', 'rabbit': 'أرنب', 'lion': 'أسد', 'owl': 'بومة',
  'turtle': 'سلحفاة', 'dog': 'كلب', 'horse': 'حصان', 'elephant': 'فيل',
  'whale': 'حوت', 'chicken': 'دجاجة', 'butterfly': 'فراشة', 'apple': 'تفاحة',
  'rocket': 'صاروخ', 'tree': 'شجرة', 'flower': 'وردة', 'sun': 'شمس',
  'moon': 'قمر', 'moon-star': 'هلال ونجمة', 'star': 'نجمة', 'stars': 'نجوم',
  'house': 'بيت', 'car': 'سيارة', 'ball': 'كرة', 'boat': 'مركب',
  'boat-old': 'مركب قديم', 'pyramid': 'هرم', 'library': 'مكتبة',
  'book': 'كتاب', 'mountain': 'جبل', 'sea': 'بحر', 'rainbow': 'قوس قزح',
  'train': 'قطار', 'airplane': 'طائرة', 'bicycle': 'دراجة', 'bag': 'حقيبة',
  'lamp': 'مصباح', 'mosque': 'مسجد', 'lantern': 'فانوس', 'crescent': 'هلال',
  'robot-goal': 'الهدف', 'salt-beaker': 'كوب ملح', 'planet': 'كوكب',
  'red': 'أحمر', 'blue': 'أزرق', 'green': 'أخضر', 'yellow': 'أصفر',
  'circle': 'دائرة', 'square': 'مربع', 'triangle': 'مثلث',
  // أحداث الخط الزمني (`timeline.event.*`)
  'pyramids': 'بناء الأهرام', 'library_alex': 'مكتبة الإسكندرية',
  'cairo_found': 'تأسيس القاهرة', 'suez_canal': 'حفر قناة السويس',
  'aswan_dam': 'بناء السد العالي',
};

/// اسم عربي مفهوم للطفل من معرّف أصل أو مفتاح تسمية (`label.cat`, `bin.red`).
///
/// يُرجِع `null` إن لم يُعرَف، كي لا يُعرَض معرّف خام بدلًا منه.
String? arabicNameFor(String? idOrKey) {
  if (idOrKey == null || idOrKey.isEmpty) return null;
  var key = idOrKey;
  for (final prefix in [
    'asset-wave4-',
    'asset-color-',
    'asset-',
    'timeline.event.',
    'label.',
    'bin.',
    'pair.',
  ]) {
    if (key.startsWith(prefix)) {
      key = key.substring(prefix.length);
      break;
    }
  }
  return _arabicNames[key] ?? _arabicNames[key.split(RegExp(r'[-_.]')).first];
}

bool _isChildFacingText(String value) {
  final text = value.trim();
  if (text.isEmpty) return false;
  final lower = text.toLowerCase();
  if (lower.startsWith('asset-') ||
      lower.startsWith('assets/') ||
      lower.startsWith('label.') ||
      lower.startsWith('bin.') ||
      lower.startsWith('pair.') ||
      lower.startsWith('timeline.event.') ||
      lower.startsWith('vo.') ||
      lower.contains('/') ||
      lower.contains(r'\') ||
      // A single ASCII identifier is data, not display copy. This covers raw
      // enum values as well as snake_case and kebab-case ids such as `positive`,
      // `set_a`, and `internal-id`. Multi-word authored copy remains valid.
      RegExp(r'^[a-z][a-z0-9_-]*$').hasMatch(lower) ||
      RegExp(r'^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$').hasMatch(lower) ||
      RegExp(r'\.(png|jpe?g|webp|svg|json)$').hasMatch(lower)) {
    return false;
  }
  return true;
}

/// Resolves a label that is safe to put in front of a child.
///
/// [authoredText] is display copy only. Keys, ids, enum values, and paths belong
/// in [technicalId], where only an explicitly known Arabic name may escape.
/// Reviewed art names are resolved separately through [artId]. Callers provide a
/// concrete Arabic fallback suitable for the field's role.
String safeChildFacingLabel({
  String? authoredText,
  String? technicalId,
  String? artId,
  required String arabicFallback,
}) {
  final authored = authoredText?.trim();
  if (authored != null && _isChildFacingText(authored)) return authored;

  final knownTechnicalName = arabicNameFor(technicalId);
  if (knownTechnicalName != null) return knownTechnicalName;

  final knownArtName = arabicNameFor(artId);
  if (knownArtName != null) return knownArtName;

  final fallback = arabicFallback.trim();
  return _isChildFacingText(fallback) ? fallback : 'عنصر مصوّر';
}

/// صورة عنصر لعبة، بحجمٍ يحدّده الأب.
///
/// [label] نصٌّ يُعرض تحت الصورة (أو بدلها إن لم يوجد فنّ). اتركه `null` حين
/// يكون الاسم هو الجواب (مثل بطاقات الذاكرة).
class GameArt extends StatelessWidget {
  const GameArt({
    required this.assetId,
    this.label,
    this.showLabel = false,
    this.size,
    super.key,
  });

  final String? assetId;
  final String? label;
  final bool showLabel;
  final double? size;

  @override
  Widget build(BuildContext context) {
    final path = gameArtPath(assetId);
    final authoredLabel = label?.trim();
    final name = authoredLabel != null && _isChildFacingText(authoredLabel)
        ? authoredLabel
        : arabicNameFor(assetId);
    final textStyle = Theme.of(context).textTheme.labelLarge;

    Widget art;
    if (path != null) {
      art = DrawingAsset(
        assetIdOrPath: path,
        fit: BoxFit.contain,
        width: size,
        height: size,
        placeholderIcon: Icons.extension_outlined,
      );
    } else if (name != null) {
      // لا فنّ بعد: الاسم العربي واضحًا، لا معرّف تقني.
      return Center(
        child: Text(
          name,
          textAlign: TextAlign.center,
          style: textStyle,
          maxLines: 2,
        ),
      );
    } else {
      art = Icon(Icons.extension_outlined, size: (size ?? 40) * 0.6);
    }

    if (size != null) art = SizedBox.square(dimension: size, child: art);
    if (!showLabel || name == null) return art;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(child: art),
        const SizedBox(height: 4),
        Text(name, textAlign: TextAlign.center, style: textStyle, maxLines: 1),
      ],
    );
  }
}
