import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/dashboard_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/dashboard_provider.dart';
import '../../../providers/notification_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/shimmer_card.dart';
import '../../widgets/common/shimmer_list.dart';

enum _TrendPeriod { today, week, month }

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  void _showProfileSheet(BuildContext context, WidgetRef ref, dynamic user) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // drag handle
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.hairline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            // avatar
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.brandSoft,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.hairline),
              ),
              child: Center(
                child: Text(
                  (user?.username ?? 'U')[0].toUpperCase(),
                  style: GoogleFonts.manrope(
                    fontSize: 26,
                    fontWeight: FontWeight.w700,
                    color: AppColors.brand,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              user?.username ?? '',
              style: GoogleFonts.manrope(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              user?.role?.toUpperCase() ?? '',
              style: GoogleFonts.manrope(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.brand,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              user?.shopName ?? '',
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: AppColors.ink3,
              ),
            ),
            const SizedBox(height: 24),
            Divider(color: AppColors.hairline, height: 1),
            const SizedBox(height: 8),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.soft,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.notifications_outlined,
                    size: 18, color: AppColors.ink2),
              ),
              title: Text('Notifications',
                  style: GoogleFonts.manrope(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink)),
              trailing: const Icon(Icons.chevron_right,
                  size: 18, color: AppColors.ink3),
              onTap: () {
                Navigator.pop(context);
                context.push('/notifications');
              },
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ref.read(authProvider.notifier).logout();
                },
                icon: const Icon(Icons.logout, color: AppColors.danger, size: 18),
                label: Text('Sign Out',
                    style: GoogleFonts.manrope(
                        color: AppColors.danger,
                        fontWeight: FontWeight.w600,
                        fontSize: 14)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.danger),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final todayAsync = ref.watch(dashboardTodayProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    final now = DateTime.now();
    final dayLabel =
        '${DateFormat('EEE').format(now)} · ${DateFormat('MMM d').format(now)}'.toUpperCase();

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: RefreshIndicator(
        color: AppColors.brand,
        backgroundColor: AppColors.surface,
        onRefresh: () async {
          ref.invalidate(dashboardTodayProvider);
          ref.invalidate(dashboardWeekProvider);
          ref.invalidate(lowStockProvider);
        },
        child: CustomScrollView(
          slivers: [
            // ── Header ─────────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 16, 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Eyebrow
                            Text(
                              dayLabel,
                              style: GoogleFonts.manrope(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink3,
                                letterSpacing: 0.12 * 10.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            // "Today" title
                            Text(
                              'Today',
                              style: GoogleFonts.manrope(
                                fontSize: 24,
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink,
                                letterSpacing: -0.02 * 24,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Notification bell
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          GestureDetector(
                            onTap: () => context.push('/notifications'),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                color: AppColors.surface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.hairline),
                              ),
                              child: const Icon(Icons.notifications_outlined,
                                  size: 20, color: AppColors.ink2),
                            ),
                          ),
                          if (unread > 0)
                            Positioned(
                              right: -3,
                              top: -3,
                              child: Container(
                                width: 17,
                                height: 17,
                                decoration: const BoxDecoration(
                                  color: AppColors.danger,
                                  shape: BoxShape.circle,
                                ),
                                child: Center(
                                  child: Text(
                                    unread > 9 ? '9+' : '$unread',
                                    style: GoogleFonts.manrope(
                                        color: Colors.white,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(width: 8),
                      // "Open" pill + avatar
                      _OpenPill(),
                      const SizedBox(width: 10),
                      // Profile avatar
                      GestureDetector(
                        onTap: () =>
                            _showProfileSheet(context, ref, user),
                        child: Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            color: AppColors.brandSoft,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.hairline),
                          ),
                          child: Center(
                            child: Text(
                              (user?.username ?? 'U')[0].toUpperCase(),
                              style: GoogleFonts.manrope(
                                color: AppColors.brand,
                                fontWeight: FontWeight.w700,
                                fontSize: 15,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // ── Read-only warning ───────────────────────────────────────────
            if (user?.readOnly == true)
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppColors.warn.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
                    border:
                        Border.all(color: AppColors.warn.withValues(alpha: 0.3)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.warning_amber,
                        color: AppColors.warn, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Account expired — Read Only Mode',
                        style: GoogleFonts.manrope(
                            color: AppColors.warn,
                            fontWeight: FontWeight.w600,
                            fontSize: 13),
                      ),
                    ),
                  ]),
                ),
              ),

            // ── Hero metric + sparkline ─────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: todayAsync.when(
                  loading: () => const ShimmerCard(height: 180),
                  error: (e, _) => ErrorView(
                      message: e.toString(),
                      onRetry: () => ref.invalidate(dashboardTodayProvider)),
                  data: (today) => _HeroMetricCard(today: today),
                ),
              ),
            ),

            // ── Stats grid 2-col ────────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              sliver: todayAsync.when(
                loading: () => const SliverToBoxAdapter(
                    child: ShimmerGrid(itemCount: 2, itemHeight: 88)),
                error: (_, __) => const SliverToBoxAdapter(child: SizedBox()),
                data: (today) => SliverGrid(
                  delegate: SliverChildListDelegate([
                    _StatCard2(
                      label: 'Orders',
                      value: '${today.summary.transactionCount}',
                      delta: null,
                    ),
                    _StatCard2(
                      label: 'Avg Ticket',
                      value: today.summary.transactionCount > 0
                          ? formatCurrency(today.summary.netSales /
                              today.summary.transactionCount)
                          : 'Rs. 0',
                      delta: null,
                    ),
                  ]),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 2.2,
                    crossAxisSpacing: 10,
                    mainAxisSpacing: 10,
                  ),
                ),
              ),
            ),

            // ── Payment method mini-bars ────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: todayAsync
                        .whenData((today) =>
                            _PaymentMethodsRow(summary: today.summary))
                        .valueOrNull ??
                    const SizedBox.shrink(),
              ),
            ),

            // ── Quick actions ───────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Row(children: [
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.point_of_sale_outlined,
                      label: 'Billing',
                      onTap: () => context.go('/sales'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.inbox_outlined,
                      label: 'Pre Orders',
                      onTap: () => context.push('/pre-orders'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _QuickAction(
                      icon: Icons.settings_outlined,
                      label: 'Settings',
                      onTap: () => context.push('/settings'),
                    ),
                  ),
                ]),
              ),
            ),

            // ── Sales trend card ────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: todayAsync
                        .whenData((today) => _SalesTrendCard(today: today))
                        .valueOrNull ??
                    const SizedBox.shrink(),
              ),
            ),

            // ── Top sellers ─────────────────────────────────────────────────
            SliverToBoxAdapter(
              child: todayAsync.whenData((today) {
                if (today.topProducts.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: _TopSellersCard(products: today.topProducts),
                );
              }).valueOrNull ??
                  const SizedBox.shrink(),
            ),

            // ── Low stock alert ─────────────────────────────────────────────
            Consumer(builder: (ctx, r, _) {
              final lowAsync = r.watch(lowStockProvider);
              return SliverToBoxAdapter(
                child: lowAsync.whenData((items) {
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    child: _LowStockCard(items: items),
                  );
                }).valueOrNull ??
                    const SizedBox.shrink(),
              );
            }),

            const SliverToBoxAdapter(child: SizedBox(height: 24)),
          ],
        ),
      ),
    );
  }
}

// ── "Open" pill ───────────────────────────────────────────────────────────────

class _OpenPill extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.brandSoft,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.brand.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: const BoxDecoration(
              color: AppColors.brand,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            'Open',
            style: GoogleFonts.manrope(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.brand,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Hero metric card ──────────────────────────────────────────────────────────

class _HeroMetricCard extends StatelessWidget {
  final DashboardToday today;
  const _HeroMetricCard({required this.today});

  @override
  Widget build(BuildContext context) {
    final netSales = today.summary.netSales;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Eyebrow
          Text(
            'Net sales',
            style: GoogleFonts.manrope(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.ink3,
              letterSpacing: 0.1,
            ),
          ),
          const SizedBox(height: 6),
          // Large number
          Text(
            formatCurrency(netSales),
            style: GoogleFonts.jetBrainsMono(
              fontSize: 32,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 6),
          // Trend badge
          _TrendBadge(today: today),
          const SizedBox(height: 16),
          // Sparkline hourly bar chart
          if (today.hourly.isNotEmpty)
            _HourlySparkline(hourly: today.hourly),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 400.ms)
        .slideY(begin: 0.06, end: 0, duration: 400.ms, curve: Curves.easeOut);
  }
}

class _TrendBadge extends StatelessWidget {
  final DashboardToday today;
  const _TrendBadge({required this.today});

  @override
  Widget build(BuildContext context) {
    // Show items sold as a secondary indicator alongside the main metric
    final itemCount = today.itemsSold;
    final txnCount = today.summary.transactionCount;

    return Row(
      children: [
        const Icon(Icons.arrow_upward_rounded, size: 13, color: AppColors.brand),
        const SizedBox(width: 3),
        Text(
          '$txnCount orders · ${formatNumber(itemCount)} items sold',
          style: GoogleFonts.manrope(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: AppColors.brand,
          ),
        ),
      ],
    );
  }
}

class _HourlySparkline extends StatelessWidget {
  final List<HourlyPoint> hourly;
  const _HourlySparkline({required this.hourly});

  @override
  Widget build(BuildContext context) {
    final maxSales =
        hourly.map((h) => h.sales).reduce((a, b) => a > b ? a : b);
    if (maxSales == 0) return const SizedBox.shrink();

    final peakHour =
        hourly.firstWhere((h) => h.sales == maxSales, orElse: () => hourly.first);

    return SizedBox(
      height: 52,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: hourly.map((h) {
          final fraction = maxSales > 0 ? (h.sales / maxSales) : 0.0;
          final isPeak = h.hour == peakHour.hour;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 1.5),
              child: FractionallySizedBox(
                alignment: Alignment.bottomCenter,
                heightFactor: fraction.clamp(0.05, 1.0),
                child: Container(
                  decoration: BoxDecoration(
                    color: isPeak
                        ? AppColors.brand
                        : AppColors.brand.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── Stat card 2-col ───────────────────────────────────────────────────────────

class _StatCard2 extends StatelessWidget {
  final String label;
  final String value;
  final String? delta;

  const _StatCard2({
    required this.label,
    required this.value,
    this.delta,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 11.5,
              fontWeight: FontWeight.w500,
              color: AppColors.ink3,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (delta != null) ...[
            const SizedBox(height: 2),
            Text(
              delta!,
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: AppColors.brand,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 350.ms, delay: 100.ms)
        .slideY(begin: 0.08, end: 0, duration: 350.ms, curve: Curves.easeOut);
  }
}

// ── Payment method mini-bars (3-col) ──────────────────────────────────────────

class _PaymentMethodsRow extends StatelessWidget {
  final DashboardSummary summary;
  const _PaymentMethodsRow({required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = summary.cashSales + summary.cardSales + summary.mobileSales;
    if (total == 0) return const SizedBox.shrink();

    final methods = [
      _PayMethod('Cash', summary.cashSales),
      _PayMethod('Card', summary.cardSales),
      _PayMethod('Mobile', summary.mobileSales),
    ];

    // highest amount → gets ink bg (active style)
    final maxAmount = methods.map((m) => m.amount).reduce((a, b) => a > b ? a : b);

    return Row(
      children: methods.asMap().entries.map((entry) {
        final i = entry.key;
        final m = entry.value;
        final isActive = m.amount == maxAmount && maxAmount > 0;
        final pct = total > 0 ? (m.amount / total * 100).toStringAsFixed(0) : '0';

        return Expanded(
          child: Container(
            margin: EdgeInsets.only(left: i == 0 ? 0 : 8),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: isActive ? AppColors.ink : AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: isActive ? AppColors.ink : AppColors.hairline),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  m.label,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: isActive ? Colors.white70 : AppColors.ink3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$pct%',
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: isActive ? Colors.white : AppColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  formatCurrency(m.amount),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 10,
                    color: isActive
                        ? Colors.white.withValues(alpha: 0.6)
                        : AppColors.ink3,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _PayMethod {
  final String label;
  final double amount;
  const _PayMethod(this.label, this.amount);
}

// ── Quick actions ─────────────────────────────────────────────────────────────

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 18, color: AppColors.ink2),
            ),
            const SizedBox(height: 7),
            Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink2,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Sales Trend Card ──────────────────────────────────────────────────────────

class _SalesTrendCard extends ConsumerStatefulWidget {
  final DashboardToday today;
  const _SalesTrendCard({required this.today});

  @override
  ConsumerState<_SalesTrendCard> createState() => _SalesTrendCardState();
}

class _SalesTrendCardState extends ConsumerState<_SalesTrendCard> {
  _TrendPeriod _period = _TrendPeriod.week;

  @override
  Widget build(BuildContext context) {
    final weekAsync = ref.watch(dashboardWeekProvider);
    final monthAsync = ref.watch(dashboardMonthProvider);

    double periodTotal = 0;
    if (_period == _TrendPeriod.today) {
      periodTotal = widget.today.summary.totalSales;
    } else if (_period == _TrendPeriod.week) {
      if (weekAsync.hasValue) {
        periodTotal = weekAsync.value!.fold(0, (s, d) => s + d.sales);
      }
    } else {
      if (monthAsync.hasValue) {
        periodTotal = monthAsync.value!.fold(0, (s, d) => s + d.sales);
      }
    }

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Sales Trend',
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    if (periodTotal > 0)
                      Text(
                        formatCurrency(periodTotal),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 12,
                          color: AppColors.ink2,
                        ),
                      ),
                  ],
                ),
              ),
              // Period toggle
              Container(
                decoration: BoxDecoration(
                  color: AppColors.soft,
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.all(3),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _PeriodBtn(
                      label: 'Today',
                      active: _period == _TrendPeriod.today,
                      onTap: () => setState(() => _period = _TrendPeriod.today),
                    ),
                    _PeriodBtn(
                      label: '7D',
                      active: _period == _TrendPeriod.week,
                      onTap: () => setState(() => _period = _TrendPeriod.week),
                    ),
                    _PeriodBtn(
                      label: '30D',
                      active: _period == _TrendPeriod.month,
                      onTap: () =>
                          setState(() => _period = _TrendPeriod.month),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Chart
          if (_period == _TrendPeriod.today)
            _buildTodayChart()
          else if (_period == _TrendPeriod.week)
            weekAsync.when(
              loading: () => const ShimmerCard(height: 150),
              error: (_, __) => SizedBox(
                  height: 60,
                  child: Center(
                      child: Text('Unable to load',
                          style: GoogleFonts.manrope(
                              color: AppColors.ink3, fontSize: 13)))),
              data: (week) {
                if (week.isEmpty) {
                  return SizedBox(
                      height: 150,
                      child: Center(
                          child: Text('No data',
                              style: GoogleFonts.manrope(
                                  color: AppColors.ink3, fontSize: 13))));
                }
                final spots = week
                    .asMap()
                    .entries
                    .map((e) => FlSpot(e.key.toDouble(), e.value.sales))
                    .toList();
                final labels = week.map((d) {
                  final dt = DateTime.tryParse(d.day);
                  return dt != null ? DateFormat('EEE').format(dt) : d.day;
                }).toList();
                return _buildLineChart(spots, labels, 1);
              },
            )
          else
            monthAsync.when(
              loading: () => const ShimmerCard(height: 150),
              error: (_, __) => SizedBox(
                  height: 60,
                  child: Center(
                      child: Text('Unable to load',
                          style: GoogleFonts.manrope(
                              color: AppColors.ink3, fontSize: 13)))),
              data: (month) {
                if (month.isEmpty) {
                  return SizedBox(
                      height: 150,
                      child: Center(
                          child: Text('No data',
                              style: GoogleFonts.manrope(
                                  color: AppColors.ink3, fontSize: 13))));
                }
                final spots = month
                    .asMap()
                    .entries
                    .map((e) => FlSpot(e.key.toDouble(), e.value.sales))
                    .toList();
                final labels = month.map((d) {
                  final dt = DateTime.tryParse(d.day);
                  return dt != null ? DateFormat('d').format(dt) : d.day;
                }).toList();
                return _buildLineChart(spots, labels, 7);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildTodayChart() {
    final hourly = widget.today.hourly;
    if (hourly.isEmpty) {
      return SizedBox(
          height: 150,
          child: Center(
              child: Text('No data',
                  style:
                      GoogleFonts.manrope(color: AppColors.ink3, fontSize: 13))));
    }
    final spots =
        hourly.map((h) => FlSpot(h.hour.toDouble(), h.sales)).toList();
    final labels = List.generate(24, (i) => '${i}h');
    return _buildLineChart(spots, labels, 6);
  }

  Widget _buildLineChart(
      List<FlSpot> spots, List<String> labels, int labelInterval) {
    final maxY = spots.isEmpty
        ? 0.0
        : spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    final chartMaxY = maxY == 0 ? 100.0 : maxY * 1.25;

    return SizedBox(
      height: 150,
      child: LineChart(
        LineChartData(
          maxY: chartMaxY,
          minY: 0,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: chartMaxY / 4,
            getDrawingHorizontalLine: (value) => FlLine(
              color: AppColors.hairline,
              strokeWidth: 1,
            ),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 22,
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= labels.length) {
                    return const SizedBox.shrink();
                  }
                  if (idx % labelInterval != 0) {
                    return const SizedBox.shrink();
                  }
                  return Text(
                    labels[idx],
                    style: GoogleFonts.manrope(
                        fontSize: 9, color: AppColors.ink3),
                  );
                },
              ),
            ),
          ),
          lineTouchData: LineTouchData(
            touchTooltipData: LineTouchTooltipData(
              getTooltipItems: (touchedSpots) => touchedSpots
                  .map((s) => LineTooltipItem(
                        formatCurrency(s.y),
                        GoogleFonts.jetBrainsMono(
                            fontWeight: FontWeight.w600,
                            fontSize: 11,
                            color: Colors.white),
                      ))
                  .toList(),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              curveSmoothness: 0.35,
              barWidth: 2,
              color: AppColors.brand,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  colors: [
                    AppColors.brand.withValues(alpha: 0.10),
                    AppColors.brand.withValues(alpha: 0.0),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PeriodBtn extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;

  const _PeriodBtn({
    required this.label,
    required this.active,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? AppColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
          border: active ? Border.all(color: AppColors.hairline) : null,
        ),
        child: Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 11,
            color: active ? AppColors.ink : AppColors.ink3,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

// ── Top sellers card ──────────────────────────────────────────────────────────

class _TopSellersCard extends StatelessWidget {
  final List<TopProduct> products;
  const _TopSellersCard({required this.products});

  @override
  Widget build(BuildContext context) {
    final top3 = products.take(3).toList();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.emoji_events_outlined,
                size: 16, color: AppColors.warn),
            const SizedBox(width: 7),
            Text(
              'Top Sellers',
              style: GoogleFonts.manrope(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const Spacer(),
            Text(
              'Today',
              style: GoogleFonts.manrope(
                  fontSize: 11, color: AppColors.ink3, fontWeight: FontWeight.w500),
            ),
          ]),
          const SizedBox(height: 14),
          ...top3.asMap().entries.map((e) {
            final rank = e.key + 1;
            final p = e.value;
            final isFirst = rank == 1;

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  // Rank
                  Container(
                    width: 26,
                    height: 26,
                    decoration: BoxDecoration(
                      color: isFirst ? AppColors.brand : AppColors.soft,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Center(
                      child: Text(
                        '$rank',
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color:
                              isFirst ? Colors.white : AppColors.ink2,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  // Name
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p.name,
                          style: GoogleFonts.manrope(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          'Qty ${formatNumber(p.qtySold)}',
                          style: GoogleFonts.manrope(
                            fontSize: 11,
                            color: AppColors.ink3,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Revenue
                  Text(
                    formatCurrency(p.revenue),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ── Low stock card ────────────────────────────────────────────────────────────

class _LowStockCard extends StatelessWidget {
  final List<LowStockProduct> items;
  const _LowStockCard({required this.items});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warn.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.warn.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.warning_amber_rounded,
                color: AppColors.warn, size: 16),
            const SizedBox(width: 7),
            Text(
              'Low Stock — ${items.length} item${items.length != 1 ? 's' : ''}',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w700,
                color: AppColors.warn,
                fontSize: 13,
              ),
            ),
          ]),
          const SizedBox(height: 10),
          Wrap(
            spacing: 7,
            runSpacing: 6,
            children: items
                .take(6)
                .map((p) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: AppColors.warn.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                            color: AppColors.warn.withValues(alpha: 0.3)),
                      ),
                      child: Text(
                        '${p.name}: ${formatNumber(p.stockQuantity)}',
                        style: GoogleFonts.manrope(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppColors.warn,
                        ),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}
