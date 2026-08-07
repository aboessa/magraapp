import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';

abstract final class AppTheme {
  /// Bundled brand typeface. Declared in pubspec.yaml under `fonts:` with
  /// static weights 400/500/600/700 and licensed under the SIL OFL 1.1
  /// (assets/fonts/OFL.txt).
  ///
  /// This replaces a runtime download of the same family via `google_fonts`.
  /// The family is applied to the text theme only — deliberately not to
  /// `ThemeData.fontFamily` — so that rendering matches the previous
  /// `GoogleFonts.readexProTextTheme(...)` behaviour exactly.
  ///
  /// KNOWN GAP, unchanged by this refactor: many widgets construct a raw
  /// `TextStyle(...)` with no family, so those fall back to the platform
  /// default (Roboto) rather than Readex Pro. Making the brand font apply
  /// app-wide is a typography task, not a font-bundling task, because it
  /// changes the appearance of dozens of screens.
  static const fontFamily = 'Readex Pro';

  static ThemeData get dark {
    final baseScheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.royalBlue,
          brightness: Brightness.dark,
          surface: AppColors.midnight,
        ).copyWith(
          primary: AppColors.electricCyan,
          secondary: AppColors.cosmicPurple,
          tertiary: AppColors.starGold,
          error: AppColors.danger,
          onPrimary: AppColors.deepSpace,
          onSecondary: AppColors.starlight,
          onSurface: AppColors.starlight,
          surface: AppColors.midnight,
        );

    final baseText = Typography.material2021(platform: TargetPlatform.android)
        .white
        .apply(
          fontFamily: fontFamily,
          bodyColor: AppColors.starlight,
          displayColor: AppColors.starlight,
        );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: baseScheme,
      scaffoldBackgroundColor: AppColors.deepSpace,
      canvasColor: AppColors.deepSpace,
      splashFactory: InkSparkle.splashFactory,
      visualDensity: VisualDensity.standard,
      textTheme: baseText.copyWith(
        displayLarge: baseText.displayLarge?.copyWith(
          fontSize: 56,
          height: 1.12,
          fontWeight: FontWeight.w700,
          letterSpacing: -1.2,
        ),
        displayMedium: baseText.displayMedium?.copyWith(
          fontSize: 42,
          height: 1.18,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.8,
        ),
        headlineLarge: baseText.headlineLarge?.copyWith(
          fontSize: 30,
          height: 1.25,
          fontWeight: FontWeight.w700,
        ),
        headlineMedium: baseText.headlineMedium?.copyWith(
          fontSize: 24,
          height: 1.3,
          fontWeight: FontWeight.w700,
        ),
        titleLarge: baseText.titleLarge?.copyWith(
          fontSize: 20,
          height: 1.35,
          fontWeight: FontWeight.w700,
        ),
        bodyLarge: baseText.bodyLarge?.copyWith(
          fontSize: 17,
          height: 1.65,
          color: AppColors.starlight,
        ),
        bodyMedium: baseText.bodyMedium?.copyWith(
          fontSize: 15,
          height: 1.6,
          color: AppColors.mutedText,
        ),
        labelLarge: baseText.labelLarge?.copyWith(
          fontSize: 15,
          height: 1.25,
          fontWeight: FontWeight.w700,
        ),
      ),
      dividerColor: AppColors.starlight.withValues(alpha: 0.08),
      focusColor: AppColors.electricCyan,
      hoverColor: AppColors.starlight.withValues(alpha: 0.06),
      navigationBarTheme: NavigationBarThemeData(
        height: 72,
        backgroundColor: AppColors.midnight.withValues(alpha: 0.97),
        indicatorColor: AppColors.royalBlue.withValues(alpha: 0.32),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? AppColors.electricCyan
                : AppColors.mutedText,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(WidgetState.selected)
                ? AppColors.starlight
                : AppColors.mutedText,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          foregroundColor: AppColors.deepSpace,
          backgroundColor: AppColors.electricCyan,
          minimumSize: const Size(48, 50),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.starlight,
          minimumSize: const Size(48, 50),
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
          side: BorderSide(color: AppColors.starlight.withValues(alpha: 0.28)),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.starlight,
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: Brightness.light,
          systemNavigationBarColor: AppColors.deepSpace,
          systemNavigationBarIconBrightness: Brightness.light,
        ),
      ),
    );
  }
}
