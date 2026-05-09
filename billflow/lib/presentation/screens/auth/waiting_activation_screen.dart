import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';

class WaitingActivationScreen extends ConsumerStatefulWidget {
  const WaitingActivationScreen({super.key});

  @override
  ConsumerState<WaitingActivationScreen> createState() =>
      _WaitingActivationScreenState();
}

class _WaitingActivationScreenState
    extends ConsumerState<WaitingActivationScreen>
    with TickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final AnimationController _ring1Ctrl;
  late final AnimationController _ring2Ctrl;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);

    _ring1Ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    _ring2Ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _ring1Ctrl.dispose();
    _ring2Ctrl.dispose();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    setState(() => _refreshing = true);
    try {
      ref.invalidate(authProvider);
      await Future.delayed(const Duration(milliseconds: 800));
      final user = ref.read(authProvider).valueOrNull;
      if (user != null && !user.isPendingPayment && mounted) {
        context.go(user.isCarServiceShop ? '/carwash' : '/dashboard');
      }
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.navy, AppColors.navyMid, Color(0xFF3B6CB7)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            stops: [0.0, 0.5, 1.0],
          ),
        ),
        child: Stack(children: [
          // Decorative circle top-right
          Positioned(
            top: -size.width * 0.25,
            right: -size.width * 0.15,
            child: Container(
              width: size.width * 0.6,
              height: size.width * 0.6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.05),
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: size.height - 80),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(height: 48),

                    // Pulsing rings + icon
                    _PulsingRings(
                      ring1Ctrl: _ring1Ctrl,
                      ring2Ctrl: _ring2Ctrl,
                      pulseCtrl: _pulseCtrl,
                    ).animate().fadeIn(duration: 500.ms).scale(
                        begin: const Offset(0.8, 0.8),
                        end: const Offset(1, 1),
                        duration: 500.ms),

                    const SizedBox(height: 32),

                    // Shop name
                    Text(
                      user?.shopName ?? 'Your Shop',
                      style: GoogleFonts.poppins(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.1,
                      ),
                      textAlign: TextAlign.center,
                    ).animate().fadeIn(delay: 100.ms, duration: 400.ms),

                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.statusTrial.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color:
                                AppColors.statusTrial.withValues(alpha: 0.4)),
                      ),
                      child: Text(
                        'Pending Activation',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFFCD34D),
                        ),
                      ),
                    ).animate().fadeIn(delay: 150.ms, duration: 400.ms),

                    const SizedBox(height: 28),

                    // Glass card with steps
                    ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                        child: Container(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                                color: Colors.white.withValues(alpha: 0.2)),
                          ),
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Activation Steps',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 16),
                              _ActivationStep(
                                step: 1,
                                label: 'Agent collects payment',
                                description: 'Your sales agent collects the subscription fee',
                                done: true,
                              ),
                              _ActivationStep(
                                step: 2,
                                label: 'Agent submits to admin',
                                description: 'Payment submitted for verification',
                                done: false,
                                active: true,
                              ),
                              _ActivationStep(
                                step: 3,
                                label: 'Admin verifies & activates',
                                description: 'Account unlocked to start selling',
                                done: false,
                                isLast: true,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ).animate().fadeIn(delay: 200.ms, duration: 500.ms).slideY(
                        begin: 0.06, end: 0, duration: 500.ms),

                    const SizedBox(height: 28),

                    // CTA button
                    _RefreshButton(
                      refreshing: _refreshing,
                      onPressed: _checkStatus,
                    ).animate().fadeIn(delay: 300.ms, duration: 400.ms),

                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () async {
                        await ref.read(authProvider.notifier).logout();
                        if (context.mounted) context.go('/login');
                      },
                      child: Text(
                        'Sign Out',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: Colors.white.withValues(alpha: 0.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Pulsing rings ─────────────────────────────────────────────────────────────
class _PulsingRings extends StatelessWidget {
  final AnimationController ring1Ctrl;
  final AnimationController ring2Ctrl;
  final AnimationController pulseCtrl;

  const _PulsingRings({
    required this.ring1Ctrl,
    required this.ring2Ctrl,
    required this.pulseCtrl,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      height: 140,
      child: Stack(alignment: Alignment.center, children: [
        // Outer ring
        AnimatedBuilder(
          animation: ring1Ctrl,
          builder: (_, __) => Opacity(
            opacity: (1 - ring1Ctrl.value).clamp(0.0, 1.0),
            child: Container(
              width: 120 + ring1Ctrl.value * 20,
              height: 120 + ring1Ctrl.value * 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white
                      .withValues(alpha: 0.2 * (1 - ring1Ctrl.value)),
                  width: 2,
                ),
              ),
            ),
          ),
        ),
        // Mid ring
        AnimatedBuilder(
          animation: ring2Ctrl,
          builder: (_, __) => Opacity(
            opacity: (1 - ring2Ctrl.value).clamp(0.0, 1.0),
            child: Container(
              width: 90 + ring2Ctrl.value * 20,
              height: 90 + ring2Ctrl.value * 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white
                      .withValues(alpha: 0.25 * (1 - ring2Ctrl.value)),
                  width: 1.5,
                ),
              ),
            ),
          ),
        ),
        // Core circle
        AnimatedBuilder(
          animation: pulseCtrl,
          builder: (_, __) => Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white
                  .withValues(alpha: 0.12 + 0.06 * pulseCtrl.value),
              border: Border.all(
                color: Colors.white
                    .withValues(alpha: 0.3 + 0.15 * pulseCtrl.value),
                width: 1.5,
              ),
            ),
            child: const Icon(
              Icons.hourglass_top_rounded,
              color: Colors.white,
              size: 34,
            ),
          ),
        ),
      ]),
    );
  }
}

// ── Activation step ───────────────────────────────────────────────────────────
class _ActivationStep extends StatelessWidget {
  final int step;
  final String label;
  final String description;
  final bool done;
  final bool active;
  final bool isLast;

  const _ActivationStep({
    required this.step,
    required this.label,
    required this.description,
    this.done = false,
    this.active = false,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = done
        ? AppColors.statusActive
        : active
            ? AppColors.statusTrial
            : Colors.white.withValues(alpha: 0.35);

    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Column(children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: done
                ? AppColors.statusActive
                : active
                    ? AppColors.statusTrial.withValues(alpha: 0.2)
                    : Colors.white.withValues(alpha: 0.08),
            border: done
                ? null
                : Border.all(color: color, width: 1.5),
          ),
          child: done
              ? const Icon(Icons.check_rounded, color: Colors.white, size: 16)
              : active
                  ? const Icon(Icons.sync_rounded,
                      color: Color(0xFFFCD34D), size: 15)
                  : Center(
                      child: Text(
                        '$step',
                        style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: Colors.white.withValues(alpha: 0.35)),
                      ),
                    ),
        ),
        if (!isLast)
          Container(
            width: 1.5,
            height: 36,
            color: Colors.white.withValues(alpha: 0.15),
            margin: const EdgeInsets.symmetric(vertical: 3),
          ),
      ]),
      const SizedBox(width: 14),
      Expanded(
        child: Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : 28),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: done || active
                    ? Colors.white
                    : Colors.white.withValues(alpha: 0.45),
              ),
            ),
            const SizedBox(height: 2),
            Text(
              description,
              style: GoogleFonts.inter(
                fontSize: 12,
                color: Colors.white.withValues(alpha: 0.4),
              ),
            ),
          ]),
        ),
      ),
    ]);
  }
}

// ── Refresh button ────────────────────────────────────────────────────────────
class _RefreshButton extends StatelessWidget {
  final bool refreshing;
  final VoidCallback onPressed;

  const _RefreshButton({required this.refreshing, required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.15),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: refreshing ? null : onPressed,
          borderRadius: BorderRadius.circular(14),
          child: Center(
            child: refreshing
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: AppColors.navy),
                  )
                : Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.refresh_rounded,
                        color: AppColors.navy, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Check Activation Status',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy,
                      ),
                    ),
                  ]),
          ),
        ),
      ),
    );
  }
}
