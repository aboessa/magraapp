import 'package:flutter/material.dart';

/// A selectable child avatar.
///
/// ## Why avatars are drawn, not photographed
///
/// The product deliberately does not let a child upload a photo (that would
/// create child-image storage and privacy obligations that need a separate
/// approval). Instead every child picks from a fixed set of friendly "cosmic"
/// identities. Each is a stable [id] — that is the only thing persisted on the
/// family record — paired with an icon and a gradient for display. The visuals
/// are presentation, so a future artwork drop can map the same ids to painted
/// portraits without a data migration.
@immutable
class ChildAvatar {
  const ChildAvatar({
    required this.id,
    required this.label,
    required this.icon,
    required this.colors,
  });

  /// The value stored server-side (`avatar_id`). Never change an existing id or
  /// every child using it would appear to lose their avatar.
  final String id;

  /// Arabic display label, shown under the avatar in the picker.
  final String label;

  final IconData icon;

  /// Two-stop gradient rendered behind the icon.
  final List<Color> colors;

  Gradient get gradient => LinearGradient(
        colors: colors,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );
}

/// The canonical avatar catalogue.
///
/// The first four ids (`orbit`, `comet`, `nova`, `luna`) match the keys the
/// create-profile form used before a picker existed, so profiles created then
/// keep their avatar.
abstract final class ChildAvatars {
  static const all = <ChildAvatar>[
    ChildAvatar(
      id: 'orbit',
      label: 'مدار',
      icon: Icons.public_rounded,
      colors: [Color(0xFF00D6F5), Color(0xFF3A7BFF)],
    ),
    ChildAvatar(
      id: 'comet',
      label: 'مذنّب',
      icon: Icons.auto_awesome_rounded,
      colors: [Color(0xFFFF8A3D), Color(0xFFFF3D77)],
    ),
    ChildAvatar(
      id: 'nova',
      label: 'نجم',
      icon: Icons.star_rounded,
      colors: [Color(0xFFFFC93D), Color(0xFFFF7A3D)],
    ),
    ChildAvatar(
      id: 'luna',
      label: 'قمر',
      icon: Icons.nightlight_round,
      colors: [Color(0xFF9B6BFF), Color(0xFF5B3DF2)],
    ),
    ChildAvatar(
      id: 'astro',
      label: 'رائد فضاء',
      icon: Icons.rocket_launch_rounded,
      colors: [Color(0xFF3DF2C4), Color(0xFF00A6B8)],
    ),
    ChildAvatar(
      id: 'robo',
      label: 'روبوت',
      icon: Icons.smart_toy_rounded,
      colors: [Color(0xFF6EE7B7), Color(0xFF3B82F6)],
    ),
    ChildAvatar(
      id: 'galaxy',
      label: 'مجرّة',
      icon: Icons.blur_on_rounded,
      colors: [Color(0xFFFF6FAE), Color(0xFF9B6BFF)],
    ),
    ChildAvatar(
      id: 'saturn',
      label: 'زحل',
      icon: Icons.brightness_7_rounded,
      colors: [Color(0xFFFFD36E), Color(0xFFFF9F45)],
    ),
  ];

  static const _fallback = ChildAvatar(
    id: 'orbit',
    label: 'مدار',
    icon: Icons.public_rounded,
    colors: [Color(0xFF00D6F5), Color(0xFF3A7BFF)],
  );

  /// Resolves an id to its avatar, falling back to the first one for an unknown
  /// id (e.g. a profile created by a future client with a newer avatar). The
  /// fallback is visible and consistent, never a broken image.
  static ChildAvatar byId(String? id) {
    if (id == null || id.isEmpty) return _fallback;
    for (final avatar in all) {
      if (avatar.id == id) return avatar;
    }
    return _fallback;
  }
}

/// Renders a single avatar as a circular gradient badge with its icon.
class ChildAvatarView extends StatelessWidget {
  const ChildAvatarView({
    required this.avatarId,
    this.size = 56,
    this.selected = false,
    super.key,
  });

  final String avatarId;
  final double size;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final avatar = ChildAvatars.byId(avatarId);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: avatar.gradient,
        border: selected
            ? Border.all(color: Colors.white, width: 3)
            : Border.all(color: Colors.white.withValues(alpha: 0.18)),
        boxShadow: [
          BoxShadow(
            color: avatar.colors.last.withValues(alpha: selected ? 0.5 : 0.25),
            blurRadius: selected ? 18 : 10,
          ),
        ],
      ),
      child: Icon(avatar.icon, color: Colors.white, size: size * 0.5),
    );
  }
}

/// A child-safe grid picker for choosing an avatar.
///
/// Stateless and controlled: it reports selection through [onSelected] and
/// highlights [selectedId], so the hosting form owns the value. Each cell is a
/// large touch target with a semantic label for screen readers.
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
    return Wrap(
      spacing: 14,
      runSpacing: 14,
      children: [
        for (final avatar in ChildAvatars.all)
          Semantics(
            button: true,
            selected: avatar.id == selectedId,
            label: avatar.label,
            child: InkWell(
              onTap: enabled ? () => onSelected(avatar.id) : null,
              borderRadius: BorderRadius.circular(40),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ChildAvatarView(
                    avatarId: avatar.id,
                    size: 60,
                    selected: avatar.id == selectedId,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    avatar.label,
                    style: TextStyle(
                      color: avatar.id == selectedId
                          ? Colors.white
                          : Colors.white.withValues(alpha: 0.6),
                      fontSize: 10.5,
                      fontWeight: avatar.id == selectedId
                          ? FontWeight.w700
                          : FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
