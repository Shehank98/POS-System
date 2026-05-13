import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Design system tokens (from BillFlow Mobile Redesign) ──────────────────
  // Background: warm cream
  static const Color bg = Color(0xFFF9F7F3);
  // Surface: pure white cards
  static const Color surface = Color(0xFFFFFFFF);
  // Ink: near-black with blue tint (primary text)
  static const Color ink = Color(0xFF1D2B3A);
  // Ink-2: medium gray (secondary text)
  static const Color ink2 = Color(0xFF5B6B7D);
  // Ink-3: muted (hint/placeholder text)
  static const Color ink3 = Color(0xFF8E9BAA);
  // Hairline: warm-tinted border
  static const Color hairline = Color(0xFFE3DFD6);
  // Soft: subtle surface tint
  static const Color soft = Color(0xFFF0EDE6);
  // Brand: forest green
  static const Color brand = Color(0xFF1A6E4A);
  // Brand-soft: very light green tint
  static const Color brandSoft = Color(0xFFE5F2EC);
  // Warn: amber
  static const Color warn = Color(0xFFD4830A);
  // Danger: red
  static const Color danger = Color(0xFFC83C3C);

  // ── Legacy aliases (backward compat) ──────────────────────────────────────
  static const Color primary = ink;
  static const Color primaryLight = ink2;
  static const Color primaryDark = Color(0xFF0F1D29);

  static const Color navy = ink;
  static const Color navyLight = ink2;
  static const Color navyDark = Color(0xFF0F1D29);
  static const Color navyMid = Color(0xFF253545);

  static const Color agentGreen = brand;
  static const Color agentGreenDark = Color(0xFF145A3C);
  static const Color agentGreenBg = brandSoft;

  static const Color accent = Color(0xFF3B82F6);
  static const Color accentLight = Color(0xFFEFF6FF);

  static const Color statusActive = brand;
  static const Color statusTrial = warn;
  static const Color statusExpired = danger;
  static const Color statusSuspended = ink3;

  static const Color dangerLight = Color(0xFFFBE8E8);
  static const Color warning = warn;
  static const Color warningLight = Color(0xFFFDF3E0);
  static const Color success = brand;
  static const Color successLight = brandSoft;

  static const Color textPrimary = ink;
  static const Color textSecondary = ink2;
  static const Color textMuted = ink3;

  static const Color surfaceLight = soft;
  static const Color surfaceCard = surface;
  static const Color border = hairline;
  static const Color cardLight = surface;

  static const Color surfaceDark = Color(0xFF0F1D29);
  static const Color cardDark = Color(0xFF1A2A38);
  static const Color cardDark2 = Color(0xFF253545);

  static const Color lowStock = warn;
  static const Color outOfStock = danger;
  static const Color inStock = brand;

  // ── Shadows ───────────────────────────────────────────────────────────────
  static BoxShadow get cardShadow => BoxShadow(
        color: ink.withValues(alpha: 0.05),
        blurRadius: 12,
        offset: const Offset(0, 4),
      );

  static BoxShadow get cardShadowSm => BoxShadow(
        color: ink.withValues(alpha: 0.04),
        blurRadius: 6,
        offset: const Offset(0, 2),
      );

  static BoxShadow get buttonShadow => BoxShadow(
        color: ink.withValues(alpha: 0.25),
        blurRadius: 20,
        offset: const Offset(0, 8),
      );

  static BoxShadow get greenButtonShadow => BoxShadow(
        color: brand.withValues(alpha: 0.28),
        blurRadius: 16,
        offset: const Offset(0, 6),
      );
}
