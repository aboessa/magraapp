import 'package:flutter/material.dart';

abstract final class AppColors {
  static const midnight = Color(0xFF0B1026);
  static const deepSpace = Color(0xFF06091A);
  static const abyss = Color(0xFF050817);
  static const indigoSurface = Color(0xFF161F45);
  static const elevatedSurface = Color(0xFF1D2855);
  static const cardSurface = Color(0xFF101835);
  static const royalBlue = Color(0xFF2856D8);
  static const cosmicPurple = Color(0xFF6A3DF2);
  static const electricCyan = Color(0xFF00D6F5);
  static const starGold = Color(0xFFFFD34D);
  static const starlight = Color(0xFFF2F6FF);
  static const mutedText = Color(0xFFA9B4D0);
  static const dimText = Color(0xFF7E8BB0);
  static const danger = Color(0xFFFF6B7A);
  static const success = Color(0xFF5BE7A9);

  // Cinematic background gradient: deep, rich, premium
  static const cinematicBackground = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0xFF0B1026), Color(0xFF06091A), Color(0xFF050817)],
    stops: [0, 0.58, 1],
  );

  // Scrim gradients - exact spec from plan doc
  static const heroGradient = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x0606091A), Color(0x3D06091A), Color(0xF506091A)],
    stops: [0, 0.44, 1],
  );

  static const heroScrimMobile = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [
      Color(0x0606091A),
      Color(0x3D06091A),
      Color(0xF406091A),
    ],
    stops: [0, 0.44, 1],
  );

  static const heroScrimSide = LinearGradient(
    begin: AlignmentDirectional.centerStart,
    end: AlignmentDirectional.centerEnd,
    colors: [
      Color(0xF506091A),
      Color(0xAD06091A),
      Color(0x1406091A),
    ],
    stops: [0, 0.4, 0.76],
  );

  // Brandenburg - more cinematic
  static const brandGradient = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [electricCyan, royalBlue, cosmicPurple],
  );

  static const portalGradient = RadialGradient(
    center: Alignment(0.15, -0.25),
    radius: 1.2,
    colors: [
      Color(0xFF8B6CFF),
      Color(0xFF6A3DF2),
      Color(0xFF2856D8),
      Color(0xFF101835),
    ],
    stops: [0, 0.28, 0.62, 1],
  );

  // Premium card shadow
  static List<BoxShadow> get premiumCardShadow => [
        BoxShadow(
          color: const Color(0xFF000000).withValues(alpha: 0.42),
          blurRadius: 28,
          offset: const Offset(0, 16),
        ),
        BoxShadow(
          color: const Color(0xFFF2F6FF).withValues(alpha: 0.05),
          blurRadius: 0,
          spreadRadius: 1,
        ),
      ];

  static List<BoxShadow> get heroShadow => [
        BoxShadow(
          color: const Color(0xFF000000).withValues(alpha: 0.58),
          blurRadius: 42,
          offset: const Offset(0, 22),
        ),
        BoxShadow(
          color: cosmicPurple.withValues(alpha: 0.14),
          blurRadius: 36,
        ),
      ];
}
