import 'package:flutter/material.dart';

abstract final class LifeGuardColors {
  static const background = Color(0xFFF7F9F3);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceMuted = Color(0xFFF1F5F0);
  static const ink = Color(0xFF101827);
  static const muted = Color(0xFF64748B);
  static const border = Color(0xFFE2E8E2);
  static const lime = Color(0xFFD4F54C);
  static const limeSoft = Color(0xFFF1FBCB);
  static const emerald = Color(0xFF078B61);
  static const emeraldSoft = Color(0xFFE7F7EF);
  static const rose = Color(0xFFE43D5B);
  static const roseSoft = Color(0xFFFFEEF1);
  static const amber = Color(0xFFBD7200);
  static const amberSoft = Color(0xFFFFF5DC);
  static const blue = Color(0xFF2563EB);
}

ThemeData buildLifeGuardTheme() {
  final colorScheme =
      ColorScheme.fromSeed(
        seedColor: LifeGuardColors.emerald,
        brightness: Brightness.light,
        surface: LifeGuardColors.surface,
      ).copyWith(
        primary: LifeGuardColors.ink,
        secondary: LifeGuardColors.lime,
        error: LifeGuardColors.rose,
        outline: LifeGuardColors.border,
      );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: LifeGuardColors.background,
    fontFamily: 'sans-serif',
    textTheme: const TextTheme(
      headlineSmall: TextStyle(
        color: LifeGuardColors.ink,
        fontWeight: FontWeight.w800,
      ),
      titleLarge: TextStyle(
        color: LifeGuardColors.ink,
        fontWeight: FontWeight.w800,
      ),
      titleMedium: TextStyle(
        color: LifeGuardColors.ink,
        fontWeight: FontWeight.w700,
      ),
      bodyLarge: TextStyle(color: LifeGuardColors.ink),
      bodyMedium: TextStyle(color: LifeGuardColors.ink),
      bodySmall: TextStyle(color: LifeGuardColors.muted),
    ),
    dividerColor: LifeGuardColors.border,
    cardTheme: const CardThemeData(
      color: LifeGuardColors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        side: BorderSide(color: LifeGuardColors.border),
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      filled: true,
      fillColor: LifeGuardColors.surface,
      contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        borderSide: BorderSide(color: LifeGuardColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        borderSide: BorderSide(color: LifeGuardColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.all(Radius.circular(8)),
        borderSide: BorderSide(color: LifeGuardColors.emerald, width: 1.5),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: LifeGuardColors.lime,
        foregroundColor: LifeGuardColors.ink,
        elevation: 0,
        minimumSize: const Size(44, 46),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: LifeGuardColors.emerald,
    ),
  );
}
