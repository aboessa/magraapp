import 'package:flutter/material.dart';

import '../../../../core/env/app_environment.dart';
import '../../../../core/widgets/cinematic_image.dart';

/// A selectable child avatar – identity from Majarra's own cartoon characters.
///
/// No photo upload allowed (privacy). Each child picks a character from the
/// content universe. The id is what is persisted on family_projection; the
/// visuals are presentation-only so future artwork can replace icons with
/// illustrated portraits without migration.
///
/// ## R2-first: artwork lives on the CDN, not in the APK
///
/// `assetPath` is the OFFLINE fallback only (one file stays bundled:
/// `luna-full.png`, the `byId(null)` default every child without a saved
/// avatar sees). Every other avatar loads from
/// `{AppConfig.assetBaseUrl}/public/avatars/<sub>/<id>.webp` through
/// [RemoteImageCache]: downloaded once, read from disk forever after.
///
/// The R2 keys were uploaded by `tools/upload_avatars_r2.mjs` (PNG → WebP q85:
/// 25.5MB → 0.9MB for the 24 used files). `avatarUrl` is derived from
/// `assetPath` by construction — never stored — so renaming one renames both.
@immutable
class ChildAvatar {
  const ChildAvatar({
    required this.id,
    required this.label,
    required this.assetPath,
    required this.colors,
    this.seriesId,
    this.isPlanet = false,
  });

  final String id;
  final String label;
  final String assetPath; // offline fallback only; network source is derived
  final List<Color> colors;
  final String? seriesId;
  final bool isPlanet;

  /// CDN source for this avatar, or null when the fallback has no R2 twin.
  ///
  /// Derived by replacing the bundled prefix with the CDN origin. The bundled
  /// fallback is already WebP (`luna-full.webp`, 65KB — was 1.6MB PNG), and
  /// the R2 twin shares its name, so no extension surgery is needed. Not
  /// `const`: string surgery cannot run at compile time, and the call sites
  /// (one `Image` per avatar cell) are not `const` either.
  String? get avatarUrl {
    const prefix = 'assets/avatars/';
    if (!assetPath.startsWith(prefix)) return null;
    final rest = assetPath.substring(prefix.length); // characters/luna-full.webp
    if (!rest.endsWith('.webp')) return null;
    // ignore: do_not_use_environment
    return '${AppConfig.assetBaseUrl}/public/avatars/$rest';
  }

  Gradient get gradient => LinearGradient(
        colors: colors,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
}

abstract final class ChildAvatars {
  // All avatars are real character images – not generic icons.
  // Images generated from character sheets in majarra_images/assets/images/characters/
  static const all = <ChildAvatar>[
    // ── Luna – أبجد (preschool language)
    ChildAvatar(
      id: 'luna',
      label: 'لونا',
      assetPath: 'assets/avatars/characters/luna-full.webp',
      colors: [Color(0xFFFFC94A), Color(0xFFE67E22)],
      seriesId: 'series-preschool-luna-words',
    ),
    ChildAvatar(id: 'luna-happy', label: 'لونا سعيدة', assetPath: 'assets/avatars/characters/luna-happy.webp', colors: [Color(0xFFFFC94A), Color(0xFFE67E22)]),
    ChildAvatar(id: 'luna-excited', label: 'لونا متحمسة', assetPath: 'assets/avatars/characters/luna-excited.webp', colors: [Color(0xFFFFC94A), Color(0xFFE67E22)]),

    // ── Nouma – أرقام (kids)
    ChildAvatar(id: 'nouma', label: 'نوما', assetPath: 'assets/avatars/characters/nouma-full.webp', colors: [Color(0xFF4ECDC4), Color(0xFF2A7DE1)]),
    ChildAvatar(id: 'nouma-happy', label: 'نوما سعيدة', assetPath: 'assets/avatars/characters/nouma-happy.webp', colors: [Color(0xFF4ECDC4), Color(0xFF2A7DE1)]),
    ChildAvatar(id: 'nouma-thinking', label: 'نوما تفكر', assetPath: 'assets/avatars/characters/nouma-thinking.webp', colors: [Color(0xFF4ECDC4), Color(0xFF2A7DE1)]),

    // ── Zaina & Yaseen – العالم حولنا / المستكشفون
    ChildAvatar(id: 'zaina', label: 'زينة', assetPath: 'assets/avatars/characters/zaina-full.webp', colors: [Color(0xFF9B59B6), Color(0xFF8E44AD)]),
    ChildAvatar(id: 'zaina-front', label: 'زينة', assetPath: 'assets/avatars/characters/zaina-front.webp', colors: [Color(0xFF9B59B6), Color(0xFF8E44AD)]),
    ChildAvatar(id: 'zaina-jump', label: 'زينة تقفز', assetPath: 'assets/avatars/characters/zaina-jump.webp', colors: [Color(0xFF9B59B6), Color(0xFF8E44AD)]),

    ChildAvatar(id: 'yaseen', label: 'ياسين', assetPath: 'assets/avatars/characters/yaseen-full.webp', colors: [Color(0xFF3498DB), Color(0xFF2980B9)]),
    ChildAvatar(id: 'yaseen-front', label: 'ياسين', assetPath: 'assets/avatars/characters/yaseen-front.webp', colors: [Color(0xFF3498DB), Color(0xFF2980B9)]),
    ChildAvatar(id: 'yaseen-highfive', label: 'ياسين يحتفل', assetPath: 'assets/avatars/characters/yaseen-highfive.webp', colors: [Color(0xFF3498DB), Color(0xFF2980B9)]),

    // ── Addaad robot – أرقام / الجمع
    ChildAvatar(id: 'addaad', label: 'عدّاد', assetPath: 'assets/avatars/characters/addaad-happy.webp', colors: [Color(0xFF2C3E50), Color(0xFF1ABC9C)]),
    ChildAvatar(id: 'addaad-learning', label: 'عدّاد يتعلم', assetPath: 'assets/avatars/characters/addaad-learning.webp', colors: [Color(0xFF2C3E50), Color(0xFF1ABC9C)]),
    ChildAvatar(id: 'addaad-celebrating', label: 'عدّاد يحتفل', assetPath: 'assets/avatars/characters/addaad-celebrating.webp', colors: [Color(0xFF2C3E50), Color(0xFF1ABC9C)]),

    // ── Robo junior – مهارات / برمجة
    ChildAvatar(id: 'robo', label: 'روبو', assetPath: 'assets/avatars/characters/robo-analytical.webp', colors: [Color(0xFF2C3E50), Color(0xFF3498DB)]),
    ChildAvatar(id: 'robo-success', label: 'روبو نجح', assetPath: 'assets/avatars/characters/robo-success.webp', colors: [Color(0xFF2C3E50), Color(0xFF3498DB)]),

    // ── Salma – علوم / جرّب في البيت
    ChildAvatar(id: 'salma', label: 'سلمى', assetPath: 'assets/avatars/characters/salma-full.webp', colors: [Color(0xFF1E3A5F), Color(0xFF00BFFF)]),

    // ── Planets – also usable as avatars
    ChildAvatar(id: 'abjad', label: 'كوكب أبجد', assetPath: 'assets/avatars/planets/abjad.webp', colors: [Color(0xFFFF6B6B), Color(0xFFFF8E8E)], isPlanet: true),
    ChildAvatar(id: 'arqam', label: 'كوكب أرقام', assetPath: 'assets/avatars/planets/arqam.webp', colors: [Color(0xFF4ECDC4), Color(0xFF2A9D8F)], isPlanet: true),
    ChildAvatar(id: 'oloom', label: 'كوكب علوم', assetPath: 'assets/avatars/planets/oloom.webp', colors: [Color(0xFF45B7D1), Color(0xFF6A82FB)], isPlanet: true),
    ChildAvatar(id: 'qiyam', label: 'كوكب قيم', assetPath: 'assets/avatars/planets/qiyam.webp', colors: [Color(0xFF96CEB4), Color(0xFF2FBF8F)], isPlanet: true),
    ChildAvatar(id: 'qisas', label: 'كوكب قصص', assetPath: 'assets/avatars/planets/qisas.webp', colors: [Color(0xFFFECA57), Color(0xFFFF9F45)], isPlanet: true),
    ChildAvatar(id: 'maharat', label: 'كوكب مهارات', assetPath: 'assets/avatars/planets/maharat.webp', colors: [Color(0xFFA29BFE), Color(0xFF6C5CE7)], isPlanet: true),

    // ── Legacy gen id mapping – keep stable
    ChildAvatar(id: 'orbit', label: 'مدار', assetPath: 'assets/avatars/characters/luna-full.webp', colors: [Color(0xFF00D6F5), Color(0xFF3A7BFF)]),
    ChildAvatar(id: 'comet', label: 'مذنّب', assetPath: 'assets/avatars/characters/yaseen-front.webp', colors: [Color(0xFFFF8A3D), Color(0xFFFF3D77)]),
    ChildAvatar(id: 'nova', label: 'نجم', assetPath: 'assets/avatars/characters/nouma-happy.webp', colors: [Color(0xFFFFC93D), Color(0xFFFF7A3D)]),
  ];

  static const _fallback = ChildAvatar(
    id: 'luna',
    label: 'لونا',
    assetPath: 'assets/avatars/characters/luna-full.webp',
    colors: [Color(0xFFFFC94A), Color(0xFFE67E22)],
  );

  static ChildAvatar byId(String? id) {
    if (id == null || id.isEmpty) return _fallback;
    for (final avatar in all) {
      if (avatar.id == id) return avatar;
    }
    const legacy = {
      'avatar-girl-1': 'luna',
      'avatar-boy-1': 'yaseen',
      'avatar-girl-2': 'zaina',
      'avatar-boy-2': 'yaseen',
      'bear': 'luna',
      'luna': 'luna',
      'zaina': 'zaina',
      'yaseen': 'yaseen',
      'nouma': 'nouma',
      'robo': 'robo',
      'salma': 'salma',
      'addaad': 'addaad',
    };
    final mapped = legacy[id];
    if (mapped != null) return byId(mapped);
    return _fallback;
  }

  // For picker sections
  static List<ChildAvatar> get characters => all.where((a) => !a.isPlanet).toList();
  static List<ChildAvatar> get planets => all.where((a) => a.isPlanet).toList();
}

/// PREMIUM AVATAR VIEW
/// Designed for true 1:1 portrait avatars (70% face) – but also handles
/// legacy full-body crops from character sheets by auto-focusing on the face region.
/// Shows a solid premium background + correctly framed face.
class ChildAvatarView extends StatelessWidget {
  const ChildAvatarView({
    required this.avatarId,
    this.size = 56,
    this.selected = false,
    this.showBorder = true,
    this.showShadow = true,
    super.key,
  });

  final String avatarId;
  final double size;
  final bool selected;
  final bool showBorder;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    final avatar = ChildAvatars.byId(avatarId);
    // Per-character alignment hints – where the FACE is in the legacy crops.
    // New 1:1 avatars are centered already (0,0), legacy full-body need offset.
    final align = _avatarAlignment[avatar.id] ?? Alignment.center;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [
            avatar.colors.first.withValues(alpha: 0.95),
            avatar.colors.last,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: showBorder
            ? selected
                ? Border.all(color: Colors.white, width: 3)
                : Border.all(color: Colors.white.withValues(alpha: 0.18), width: 1.2)
            : null,
        boxShadow: showShadow
            ? [
                BoxShadow(
                  color: avatar.colors.last.withValues(alpha: selected ? 0.50 : 0.28),
                  blurRadius: selected ? 24 : 14,
                  offset: const Offset(0, 7),
                ),
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.32),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: ClipOval(
        child: Stack(
          children: [
            // Premium solid interior background – ensures white edges never show
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    avatar.colors.first.withValues(alpha: 0.22),
                    avatar.colors.first.withValues(alpha: 0.08),
                    const Color(0xFF0B1026).withValues(alpha: 0.92),
                  ],
                  center: Alignment.center,
                  radius: 1.15,
                ),
              ),
            ),
            // Actual portrait – R2 first, bundled fallback offline.
            //
            // `CinematicImage` owns the source order (cached file ← network ←
            // bundled `assetPath`) and the `ResizeImage` decode cap the
            // `decode_cap_test.dart` asserts. A bespoke `Image.network` here
            // would reintroduce the per-session re-download the cache exists
            // to prevent — and on web it would bypass the DOM-element CORS
            // workaround `CinematicImage` already carries.
            Positioned.fill(
              child: CinematicImage(
                assetPath: avatar.assetPath,
                networkUrl: avatar.avatarUrl,
                semanticLabel: avatar.label,
                fit: BoxFit.cover,
                alignment: align,
                decodeWidth: size,
              ),
            ),
            // Subtle inner vignette to make edge clean and premium
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Colors.transparent,
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.18),
                    ],
                    stops: const [0.0, 0.82, 1.0],
                    center: Alignment.center,
                    radius: 1.0,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// With v3 fixed avatars, faces are already centered – use center for all.
/// Keeping map for legacy safety but all default to center now.
const Map<String, Alignment> _avatarAlignment = {
  'luna': Alignment.center,
  'luna-happy': Alignment.center,
  'luna-excited': Alignment.center,
  'luna-smile': Alignment.center,
  'luna-curious': Alignment.center,
  'luna-point': Alignment.center,
  'luna-calm': Alignment.center,
  'nouma': Alignment.center,
  'nouma-happy': Alignment.center,
  'nouma-thinking': Alignment.center,
  'nouma-smile': Alignment.center,
  'nouma-like': Alignment.center,
  'nouma-angry': Alignment.center,
  'nouma-surprised': Alignment.center,
  'zaina': Alignment.center,
  'zaina-front': Alignment.center,
  'zaina-full': Alignment.center,
  'zaina-jump': Alignment.center,
  'zaina-side': Alignment.center,
  'zaina-magnify': Alignment.center,
  'zaina-map': Alignment.center,
  'yaseen': Alignment.center,
  'yaseen-front': Alignment.center,
  'yaseen-full': Alignment.center,
  'yaseen-highfive': Alignment.center,
  'yaseen-magnify': Alignment.center,
  'yaseen-map': Alignment.center,
  'yaseen-surprised': Alignment.center,
  'salma': Alignment.center,
  'addaad': Alignment.center,
  'addaad-happy': Alignment.center,
  'addaad-learning': Alignment.center,
  'addaad-celebrating': Alignment.center,
  'addaad-thinking': Alignment.center,
  'addaad-confused': Alignment.center,
  'addaad-help': Alignment.center,
  'robo': Alignment.center,
  'robo-analytical': Alignment.center,
  'robo-success': Alignment.center,
  'robo-curious': Alignment.center,
  'robo-debugging': Alignment.center,
  'robo-explaining': Alignment.center,
  'robo-warning': Alignment.center,
  'abjad': Alignment.center,
  'arqam': Alignment.center,
  'oloom': Alignment.center,
  'qiyam': Alignment.center,
  'qisas': Alignment.center,
  'maharat': Alignment.center,
};

class ChildAvatarPicker extends StatelessWidget {
  const ChildAvatarPicker({
    required this.selectedId,
    required this.onSelected,
    this.enabled = true,
    super.key,
  });

  final String selectedId;
  final ValueChanged<String> onSelected;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final chars = ChildAvatars.characters;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: const Color(0xFFFFD54F).withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFFFD54F).withValues(alpha: 0.18))),
          child: const Row(
            children: [
              Icon(Icons.auto_awesome_rounded, size: 14, color: Color(0xFFFFD54F)),
              SizedBox(width: 6),
              Text('شخصيات مجرة الحقيقية', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
              SizedBox(width: 6),
              Expanded(child: Text('لونا، ياسين، زينة، نوما، سلمى، عدّاد، روبو', style: TextStyle(color: Colors.white60, fontSize: 9), overflow: TextOverflow.ellipsis)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        // Use GridView-like Wrap centered, with proper RTL and spacing
        Wrap(
          alignment: WrapAlignment.start,
          spacing: 10,
          runSpacing: 14,
          children: [
            for (final avatar in chars)
              SizedBox(
                width: 78,
                child: _AvatarCell(avatar: avatar, selected: avatar.id == selectedId, enabled: enabled, onTap: () => onSelected(avatar.id)),
              ),
          ],
        ),
      ],
    );
  }
}

class _AvatarCell extends StatelessWidget {
  const _AvatarCell({required this.avatar, required this.selected, required this.enabled, required this.onTap});
  final ChildAvatar avatar;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: avatar.label,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(20),
        child: SizedBox(
          width: 72,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  ChildAvatarView(avatarId: avatar.id, size: 62, selected: selected),
                  if (selected)
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        width: 20, height: 20,
                        decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: const Color(0xFF0B1026), width: 2)),
                        child: const Icon(Icons.check_rounded, size: 12, color: Color(0xFF0B1026)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                avatar.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: selected ? Colors.white : Colors.white.withValues(alpha: 0.64),
                  fontSize: 10.5,
                  fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
