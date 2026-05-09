import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ── Legacy primary (kept for backward compat) ─────────────────────────
  static const Color primary = Color(0xFF1E3A5F);
  static const Color primaryLight = Color(0xFF2D5282);
  static const Color primaryDark = Color(0xFF0F2847);

  // ── Refined navy system ───────────────────────────────────────────────
  static const Color navy = Color(0xFF1E3A5F);
  static const Color navyLight = Color(0xFF2D5282);
  static const Color navyDark = Color(0xFF0F2847);
  static const Color navyMid = Color(0xFF254471);

  // ── Agent green ───────────────────────────────────────────────────────
  static const Color agentGreen = Color(0xFF059669);
  static const Color agentGreenDark = Color(0xFF047857);
  static const Color agentGreenBg = Color(0xFFECFDF5);

  // ── Accent / action ───────────────────────────────────────────────────
  static const Color accent = Color(0xFF3B82F6);
  static const Color accentLight = Color(0xFFEFF6FF);

  // ── Status ────────────────────────────────────────────────────────────
  static const Color statusActive = Color(0xFF10B981);
  static const Color statusTrial = Color(0xFFF59E0B);
  static const Color statusExpired = Color(0xFFEF4444);
  static const Color statusSuspended = Color(0xFF6B7280);

  static const Color danger = Color(0xFFEF4444);
  static const Color dangerLight = Color(0xFFFEE2E2);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color success = Color(0xFF10B981);
  static const Color successLight = Color(0xFFD1FAE5);

  // ── Text ──────────────────────────────────────────────────────────────
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textMuted = Color(0xFF94A3B8);

  // ── Surfaces (light) ──────────────────────────────────────────────────
  static const Color surfaceLight = Color(0xFFF1F5F9);
  static const Color surfaceCard = Color(0xFFFFFFFF);
  static const Color border = Color(0xFFE2E8F0);
  static const Color cardLight = Color(0xFFFFFFFF);

  // ── Surfaces (dark) ───────────────────────────────────────────────────
  static const Color surfaceDark = Color(0xFF0F172A);
  static const Color cardDark = Color(0xFF1E293B);
  static const Color cardDark2 = Color(0xFF334155);

  // ── Inventory ─────────────────────────────────────────────────────────
  static const Color lowStock = Color(0xFFF59E0B);
  static const Color outOfStock = Color(0xFFEF4444);
  static const Color inStock = Color(0xFF10B981);

  // ── Helpers ───────────────────────────────────────────────────────────
  static BoxShadow get cardShadow => BoxShadow(
        color: const Color(0xFF0F172A).withValues(alpha: 0.06),
        blurRadius: 12,
        offset: const Offset(0, 4),
      );

  static BoxShadow get cardShadowSm => BoxShadow(
        color: const Color(0xFF0F172A).withValues(alpha: 0.04),
        blurRadius: 6,
        offset: const Offset(0, 2),
      );

  static BoxShadow get buttonShadow => BoxShadow(
        color: navy.withValues(alpha: 0.28),
        blurRadius: 16,
        offset: const Offset(0, 6),
      );

  static BoxShadow get greenButtonShadow => BoxShadow(
        color: agentGreen.withValues(alpha: 0.28),
        blurRadius: 16,
        offset: const Offset(0, 6),
      );
}
