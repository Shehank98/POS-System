import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get light => _build(Brightness.light);
  static ThemeData get dark => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;

    final colorScheme = ColorScheme.fromSeed(
      seedColor: AppColors.navy,
      brightness: brightness,
      primary: AppColors.navy,
      secondary: AppColors.agentGreen,
      surface: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      error: AppColors.danger,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      brightness: brightness,
    );

    final bodyText = GoogleFonts.interTextTheme(base.textTheme).copyWith(
      displayLarge: GoogleFonts.poppins(
          fontSize: 32, fontWeight: FontWeight.w700,
          color: isDark ? Colors.white : AppColors.textPrimary),
      displayMedium: GoogleFonts.poppins(
          fontSize: 26, fontWeight: FontWeight.w700,
          color: isDark ? Colors.white : AppColors.textPrimary),
      displaySmall: GoogleFonts.poppins(
          fontSize: 22, fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : AppColors.textPrimary),
      headlineLarge: GoogleFonts.poppins(
          fontSize: 20, fontWeight: FontWeight.w700,
          color: isDark ? Colors.white : AppColors.textPrimary),
      headlineMedium: GoogleFonts.poppins(
          fontSize: 18, fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : AppColors.textPrimary),
      headlineSmall: GoogleFonts.poppins(
          fontSize: 16, fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : AppColors.textPrimary),
      titleLarge: GoogleFonts.poppins(
          fontSize: 15, fontWeight: FontWeight.w600,
          color: isDark ? Colors.white : AppColors.textPrimary),
      titleMedium: GoogleFonts.inter(
          fontSize: 14, fontWeight: FontWeight.w500,
          color: isDark ? Colors.white : AppColors.textPrimary),
      titleSmall: GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w500,
          color: isDark ? const Color(0xFFCBD5E1) : AppColors.textSecondary),
      bodyLarge: GoogleFonts.inter(
          fontSize: 15, fontWeight: FontWeight.w400,
          color: isDark ? Colors.white : AppColors.textPrimary),
      bodyMedium: GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w400,
          color: isDark ? const Color(0xFFCBD5E1) : AppColors.textSecondary),
      bodySmall: GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.w400,
          color: isDark ? const Color(0xFF94A3B8) : AppColors.textMuted),
      labelLarge: GoogleFonts.inter(
          fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.2),
      labelMedium: GoogleFonts.inter(
          fontSize: 11, fontWeight: FontWeight.w500, letterSpacing: 0.3),
      labelSmall: GoogleFonts.inter(
          fontSize: 10, fontWeight: FontWeight.w500, letterSpacing: 0.4),
    );

    return base.copyWith(
      textTheme: bodyText,

      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        foregroundColor: isDark ? Colors.white : AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 1,
        shadowColor: AppColors.border,
        centerTitle: false,
        titleTextStyle: GoogleFonts.poppins(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: isDark ? Colors.white : AppColors.textPrimary,
        ),
        iconTheme: IconThemeData(
          color: isDark ? Colors.white : AppColors.textPrimary,
        ),
      ),

      cardTheme: CardThemeData(
        elevation: 0,
        color: isDark ? AppColors.cardDark : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: isDark
              ? BorderSide.none
              : const BorderSide(color: AppColors.border, width: 0.8),
        ),
        margin: EdgeInsets.zero,
        shadowColor: Colors.transparent,
      ),

      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? AppColors.cardDark2.withValues(alpha: 0.6)
            : AppColors.surfaceLight,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.navy, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        labelStyle: GoogleFonts.inter(
          fontSize: 13,
          color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
        ),
        hintStyle: GoogleFonts.inter(fontSize: 13, color: AppColors.textMuted),
        prefixIconColor:
            isDark ? const Color(0xFF94A3B8) : AppColors.textMuted,
        suffixIconColor:
            isDark ? const Color(0xFF94A3B8) : AppColors.textMuted,
        isDense: true,
      ),

      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.navy,
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 50),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle:
              GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),

      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.navy,
          minimumSize: const Size(double.infinity, 50),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          side: const BorderSide(color: AppColors.border, width: 1.2),
          textStyle:
              GoogleFonts.inter(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),

      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.navy,
          textStyle:
              GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),

      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        indicatorColor: AppColors.navy.withValues(alpha: 0.12),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppColors.navy, size: 22);
          }
          return IconThemeData(
              color: isDark ? const Color(0xFF94A3B8) : AppColors.textMuted,
              size: 22);
        }),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.navy);
          }
          return GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w400,
              color:
                  isDark ? const Color(0xFF94A3B8) : AppColors.textMuted);
        }),
        elevation: 4,
        shadowColor: AppColors.border,
      ),

      chipTheme: ChipThemeData(
        backgroundColor:
            isDark ? AppColors.cardDark2 : AppColors.surfaceLight,
        selectedColor: AppColors.navy.withValues(alpha: 0.12),
        labelStyle:
            GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500),
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AppColors.border, width: 0.8)),
      ),

      dividerTheme: DividerThemeData(
        color: isDark ? AppColors.cardDark2 : AppColors.border,
        thickness: 1,
        space: 1,
      ),

      listTileTheme: ListTileThemeData(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        titleTextStyle: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            color: isDark ? Colors.white : AppColors.textPrimary),
        subtitleTextStyle: GoogleFonts.inter(
            fontSize: 12,
            color: isDark
                ? const Color(0xFF94A3B8)
                : AppColors.textSecondary),
      ),

      tabBarTheme: TabBarThemeData(
        labelStyle:
            GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w600),
        unselectedLabelStyle:
            GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w400),
        labelColor: AppColors.navy,
        unselectedLabelColor:
            isDark ? const Color(0xFF94A3B8) : AppColors.textMuted,
        indicatorSize: TabBarIndicatorSize.label,
        indicator: const UnderlineTabIndicator(
          borderSide: BorderSide(color: AppColors.navy, width: 2.5),
          borderRadius: BorderRadius.all(Radius.circular(2)),
        ),
      ),

      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        contentTextStyle:
            GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w500),
        backgroundColor:
            isDark ? AppColors.cardDark2 : AppColors.textPrimary,
      ),

      dialogTheme: DialogThemeData(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: isDark ? AppColors.cardDark : Colors.white,
        titleTextStyle: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : AppColors.textPrimary),
        contentTextStyle: GoogleFonts.inter(
            fontSize: 13,
            color: isDark
                ? const Color(0xFFCBD5E1)
                : AppColors.textSecondary),
      ),

      bottomSheetTheme: const BottomSheetThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        showDragHandle: true,
      ),

      scaffoldBackgroundColor:
          isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
    );
  }
}
