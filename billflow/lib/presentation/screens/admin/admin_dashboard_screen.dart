import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';
import '../../widgets/common/design_system.dart';

final _adminDashboardProvider = FutureProvider.autoDispose<AdminDashboardStats>((ref) {
  return ref.read(adminServiceProvider).getDashboard();
});

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_adminDashboardProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return RefreshIndicator(
      onRefresh: () => ref.refresh(_adminDashboardProvider.future),
      child: CustomScrollView(
        slivers: [
          // Header greeting card
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.navy, AppColors.navyMid],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [AppColors.buttonShadow],
                ),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(
                        'Admin Dashboard',
                        style: GoogleFonts.poppins(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Overview of your BillFlow platform',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.72),
                        ),
                      ),
                    ]),
                  ),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.bar_chart_rounded,
                        color: Colors.white, size: 24),
                  ),
                ]),
              ),
            ),
          ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.05, end: 0),

          // Stat cards
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: Text(
                'Overview',
                style: GoogleFonts.poppins(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white70 : AppColors.textSecondary,
                ),
              ),
            ),
          ),

          async.when(
            loading: () => const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: ShimmerGrid(itemCount: 6, itemHeight: 110),
                )),
            error: (e, _) => SliverToBoxAdapter(
              child: DSEmptyState(
                icon: Icons.error_outline_rounded,
                heading: 'Failed to load stats',
                subtext: e.toString(),
              ),
            ),
            data: (stats) => SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: SliverGrid(
                delegate: SliverChildListDelegate([
                  _DashStatCard(
                    label: 'Total Shops',
                    value: '${stats.totalShops}',
                    icon: Icons.store_rounded,
                    color: AppColors.navy,
                    delay: 0,
                  ),
                  _DashStatCard(
                    label: 'Active',
                    value: '${stats.activeShops}',
                    icon: Icons.check_circle_rounded,
                    color: AppColors.statusActive,
                    delay: 60,
                  ),
                  _DashStatCard(
                    label: 'Trial',
                    value: '${stats.trialShops}',
                    icon: Icons.hourglass_top_rounded,
                    color: AppColors.statusTrial,
                    delay: 120,
                  ),
                  _DashStatCard(
                    label: 'Expired',
                    value: '${stats.expiredShops}',
                    icon: Icons.cancel_rounded,
                    color: AppColors.statusExpired,
                    delay: 180,
                  ),
                  _DashStatCard(
                    label: 'Revenue',
                    value: 'Rs ${NumberFormat('#,##0').format(stats.totalRevenue)}',
                    icon: Icons.payments_rounded,
                    color: const Color(0xFF0D9488),
                    delay: 240,
                  ),
                  _DashStatCard(
                    label: 'Pending',
                    value: '${stats.pendingPayments}',
                    icon: Icons.pending_actions_rounded,
                    color: AppColors.danger,
                    delay: 300,
                  ),
                ]),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.55,
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _DashStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final int delay;

  const _DashStatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isDark
            ? null
            : Border.all(color: AppColors.border, width: 0.8),
        boxShadow: isDark ? [] : [AppColors.cardShadow],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, color: color, size: 17),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              value,
              style: GoogleFonts.poppins(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : AppColors.textPrimary,
                height: 1,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 11,
                color: isDark ? const Color(0xFF94A3B8) : AppColors.textMuted,
              ),
            ),
          ]),
        ],
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: delay), duration: 400.ms)
        .slideY(
            begin: 0.12,
            end: 0,
            delay: Duration(milliseconds: delay),
            duration: 400.ms,
            curve: Curves.easeOut);
  }
}
