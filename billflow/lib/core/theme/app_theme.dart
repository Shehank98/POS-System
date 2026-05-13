import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;

    final colorScheme = ColorScheme(
      brightness: brightness,
      primary: AppColors.ink,
      onPrimary: Colors.white,
      primaryContainer: AppColors.brandSoft,
      onPrimaryContainer: AppColors.brand,
      secondary: AppColors.brand,
      onSecondary: Colors.white,
      secondaryContainer: AppColors.brandSoft,
      onSecondaryContainer: AppColors.brand,
      error: AppColors.danger,
      onError: Colors.white,
      surface: isDark ? AppColors.cardDark : AppColors.surface,
      onSurface: isDark ? Colors.white : AppColors.ink,
      surfaceContainerHighest:
          isDark ? AppColors.cardDark2 : AppColors.soft,
      onSurfaceVariant: isDark ? AppColors.ink3 : AppColors.ink2,
      outline: AppColors.hairline,
      outlineVariant: AppColors.hairline,
    );

    // Typography using Manrope (UI) + JetBrains Mono (numbers/codes)
    final textTheme = TextTheme(
      displayLarge: GoogleFonts.manrope(
          fontSize: 34, fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
          color: isDark ? Colors.white : AppColors.ink),
      displayMedium: GoogleFonts.manrope(
          fontSize: 28, fontWeight: FontWeight.w700,
          letterSpacing: -0.4,
          color: isDark ? Colors.white : AppColors.ink),
      displaySmall: GoogleFonts.manrope(
          fontSize: 24, fontWeight: FontWeight.w600,
          letterSpacing: -0.3,
          color: isDark ? Colors.white : AppColors.ink),
      headlineLarge: GoogleFonts.manrope(
          fontSize: 22, fontWeight: FontWeight.w700,
          letterSpacing: -0.25,
          color: isDark ? Colors.white : AppColors.ink),
      headlineMedium: GoogleFonts.manrope(
          fontSize: 20, fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
          color: isDark ? Colors.white : AppColors.ink),
      headlineSmall: GoogleFonts.manrope(
          fontSize: 18, fontWeight: FontWeight.w600,
          letterSpacing: -0.15,
          color: isDark ? Colors.white : AppColors.ink),
      titleLarge: GoogleFonts.manrope(
          fontSize: 16, fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
          color: isDark ? Colors.white : AppColors.ink),
      titleMedium: GoogleFonts.manrope(
          fontSize: 14, fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : AppColors.ink),
      titleSmall: GoogleFonts.manrope(
          fontSize: 13, fontWeight: FontWeight.w500,
          color: isDark ? AppColors.ink3 : AppColors.ink2),
      bodyLarge: GoogleFonts.manrope(
          fontSize: 15, fontWeight: FontWeight.w400,
          color: isDark ? Colors.white : AppColors.ink),
      bodyMedium: GoogleFonts.manrope(
          fontSize: 13, fontWeight: FontWeight.w400,
          color: isDark ? AppColors.ink3 : AppColors.ink2),
      bodySmall: GoogleFonts.manrope(
          fontSize: 12, fontWeight: FontWeight.w400,
          color: isDark ? AppColors.ink3 : AppColors.ink3),
      labelLarge: GoogleFonts.manrope(
          fontSize: 13, fontWeight: FontWeight.w600,
          letterSpacing: 0.1),
      labelMedium: GoogleFonts.manrope(
          fontSize: 11, fontWeight: FontWeight.w600,
          letterSpacing: 0.12),
      labelSmall: GoogleFonts.manrope(
          fontSize: 10, fontWeight: FontWeight.w600,
          letterSpacing: 0.12, textBaseline: TextBaseline.alphabetic),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: brightness,
      textTheme: textTheme,

      scaffoldBackgroundColor: isDark ? AppColors.surfaceDark : AppColors.bg,

      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? AppColors.cardDark : AppColors.bg,
        foregroundColor: isDark ? Colors.white : AppColors.ink,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: Colors.transparent,
        centerTitle: false,
        systemOverlayStyle: isDark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
        titleTextStyle: GoogleFonts.manrope(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: isDark ? Colors.white : AppColors.ink,
          letterSpacing: -0.2,
        ),
        iconTheme: IconThemeData(
          color: isDark ? Colors.white : AppColors.ink,
        ),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: isDark ? AppColors.cardDark : AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: isDark ? Colors.transparent : AppColors.hairline,
            width: 1,
          ),
        ),
        margin: EdgeInsets.zero,
        shadowColor: Colors.transparent,
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? AppColors.cardDark2.withValues(alpha: 0.6)
            : AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.hairline, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.hairline, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.ink, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.danger, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.danger, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: GoogleFonts.manrope(
          fontSize: 13,
          color: isDark ? AppColors.ink3 : AppColors.ink2,
        ),
        hintStyle: GoogleFonts.manrope(fontSize: 13, color: AppColors.ink3),
        prefixIconColor: isDark ? AppColors.ink3 : AppColors.ink3,
        suffixIconColor: isDark ? AppColors.ink3 : AppColors.ink3,
        isDense: true,
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.ink,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.manrope(
              fontSize: 14, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink,
          minimumSize: const Size(double.infinity, 50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          side: BorderSide(color: AppColors.hairline, width: 1),
          textStyle: GoogleFonts.manrope(
              fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.ink,
          textStyle: GoogleFonts.manrope(
              fontSize: 13, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark
            ? AppColors.cardDark.withValues(alpha: 0.95)
            : AppColors.surface.withValues(alpha: 0.95),
        indicatorColor: Colors.transparent,
        height: 64,
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: AppColors.ink, size: 22);
          }
          return IconThemeData(
              color: isDark ? AppColors.ink3 : AppColors.ink3, size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.manrope(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
                letterSpacing: 0.01);
          }
          return GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: isDark ? AppColors.ink3 : AppColors.ink3);
        }),
        elevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
      ),

      chipTheme: ChipThemeData(
        backgroundColor: isDark ? AppColors.cardDark2 : AppColors.soft,
        selectedColor: AppColors.ink,
        labelStyle: GoogleFonts.manrope(fontSize: 13, fontWeight: FontWeight.w500),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(999),
            side: BorderSide.none),
      ),

      dividerTheme: DividerThemeData(
        color: isDark ? AppColors.cardDark2 : AppColors.hairline,
        thickness: 1,
        space: 1,
      ),

      listTileTheme: ListTileThemeData(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        titleTextStyle: GoogleFonts.manrope(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : AppColors.ink),
        subtitleTextStyle: GoogleFonts.manrope(
            fontSize: 12,
            color: isDark ? AppColors.ink3 : AppColors.ink2),
      ),

      tabBarTheme: TabBarThemeData(
        labelStyle: GoogleFonts.manrope(
            fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle: GoogleFonts.manrope(
            fontSize: 13, fontWeight: FontWeight.w500),
        labelColor: AppColors.ink,
        unselectedLabelColor:
            isDark ? AppColors.ink3 : AppColors.ink3,
        indicatorSize: TabBarIndicatorSize.label,
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: AppColors.ink, width: 2),
          borderRadius: BorderRadius.all(Radius.circular(2)),
        ),
        dividerColor: AppColors.hairline,
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentTextStyle:
            GoogleFonts.manrope(fontSize: 13, fontWeight: FontWeight.w500),
        backgroundColor: isDark ? AppColors.cardDark2 : AppColors.ink,
      ),

      dialogTheme: DialogThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: isDark ? AppColors.cardDark : AppColors.surface,
        titleTextStyle: GoogleFonts.manrope(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : AppColors.ink),
        contentTextStyle: GoogleFonts.manrope(
            fontSize: 13,
            color: isDark ? AppColors.ink3 : AppColors.ink2),
      ),

      bottomSheetTheme: const BottomSheetThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        showDragHandle: true,
      ),
    );
  }
}
