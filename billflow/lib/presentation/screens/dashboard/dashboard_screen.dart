import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.primary.withValues(alpha: 0.12),
              child: Text(
                (user?.username ?? 'U')[0].toUpperCase(),
                style: const TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              user?.username ?? '',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              user?.role?.toUpperCase() ?? '',
              style: TextStyle(fontSize: 13, color: Colors.grey[600]),
            ),
            const SizedBox(height: 4),
            Text(
              user?.shopName ?? '',
              style: TextStyle(fontSize: 13, color: Colors.grey[500]),
            ),
            const SizedBox(height: 24),
            const Divider(),
            const SizedBox(height: 8),
            ListTile(
              leading: const Icon(Icons.notifications_outlined),
              title: const Text('Notifications'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(context);
                context.push('/notifications');
              },
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  Navigator.pop(context);
                  ref.read(authProvider.notifier).logout();
                },
                icon: const Icon(Icons.logout, color: AppColors.danger),
                label: const Text('Sign Out',
                    style: TextStyle(color: AppColors.danger)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.danger),
                  minimumSize: const Size(double.infinity, 48),
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
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardTodayProvider);
          ref.invalidate(dashboardWeekProvider);
          ref.invalidate(lowStockProvider);
        },
        child: CustomScrollView(
          slivers: [
            // Header
            SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryLight],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 16, 24),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                user?.shopName ?? 'BillFlow',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Good ${_greeting()}, ${user?.username ?? ''}',
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),
                        // Notification bell
                        Stack(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.notifications_outlined,
                                  color: Colors.white),
                              onPressed: () => context.push('/notifications'),
                            ),
                            if (unread > 0)
                              Positioned(
                                right: 8,
                                top: 8,
                                child: Container(
                                  width: 16,
                                  height: 16,
                                  decoration: const BoxDecoration(
                                    color: AppColors.danger,
                                    shape: BoxShape.circle,
                                  ),
                                  child: Center(
                                    child: Text(
                                      unread > 9 ? '9+' : '$unread',
                                      style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        // Profile avatar
                        GestureDetector(
                          onTap: () => _showProfileSheet(context, ref, user),
                          child: CircleAvatar(
                            radius: 18,
                            backgroundColor: Colors.white.withValues(alpha: 0.2),
                            child: Text(
                              (user?.username ?? 'U')[0].toUpperCase(),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Read-only warning
            if (user?.readOnly == true)
              SliverToBoxAdapter(
                child: Container(
                  color: AppColors.warning.withValues(alpha: 0.12),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  child: Row(children: [
                    const Icon(Icons.warning_amber,
                        color: AppColors.warning, size: 20),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Account expired - Read Only Mode',
                        style: TextStyle(
                            color: AppColors.warning,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ]),
                ),
              ),

            // Stats cards
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
              sliver: todayAsync.when(
                loading: () => const SliverToBoxAdapter(
                    child: ShimmerGrid(itemCount: 4, itemHeight: 70)),
                error: (e, _) => SliverToBoxAdapter(
                    child: ErrorView(
                        message: e.toString(),
                        onRetry: () =>
                            ref.invalidate(dashboardTodayProvider))),
                data: (today) => SliverGrid(
                  delegate: SliverChildListDelegate([
                    _StatCard(
                      label: "Today's Revenue",
                      value: formatCurrency(today.summary.totalSales),
                      icon: Icons.attach_money,
                      color: const Color(0xFF2E7D32),
                      bg: const Color(0xFFE8F5E9),
                    ),
                    _StatCard(
                      label: 'Transactions',
                      value: '${today.summary.transactionCount}',
                      icon: Icons.receipt_long_outlined,
                      color: AppColors.primary,
                      bg: const Color(0xFFE8EAF6),
                    ),
                    _StatCard(
                      label: 'Items Sold',
                      value: formatNumber(today.itemsSold),
                      icon: Icons.shopping_bag_outlined,
                      color: const Color(0xFF6A1B9A),
                      bg: const Color(0xFFF3E5F5),
                    ),
                    _StatCard(
                      label: 'Net Sales',
                      value: formatCurrency(today.summary.netSales),
                      icon: Icons.trending_up,
                      color: const Color(0xFFE65100),
                      bg: const Color(0xFFFFF3E0),
                    ),
                  ]),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.4,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                ),
              ),
            ),

            // Quick actions
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Quick Actions',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.point_of_sale,
                          label: 'Billing',
                          color: AppColors.accent,
                          onTap: () => context.go('/sales'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.inbox_outlined,
                          label: 'Pre Orders',
                          color: const Color(0xFF1565C0),
                          onTap: () => context.push('/pre-orders'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _QuickAction(
                          icon: Icons.settings_outlined,
                          label: 'Settings',
                          color: const Color(0xFF6A1B9A),
                          onTap: () => context.push('/settings'),
                        ),
                      ),
                    ]),
                  ],
                ),
              ),
            ),

            // Sales Trend card
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                child: todayAsync.whenData((today) =>
                  _SalesTrendCard(today: today)
                ).valueOrNull ?? const SizedBox.shrink(),
              ),
            ),

            // Payment methods card
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: todayAsync.whenData((today) =>
                  _PaymentMethodsCard(summary: today.summary)
                ).valueOrNull ?? const SizedBox.shrink(),
              ),
            ),

            // Top products
            SliverToBoxAdapter(
              child: todayAsync.whenData((today) {
                if (today.topProducts.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(children: [
                            const Icon(Icons.emoji_events_outlined,
                                size: 18, color: Color(0xFFF57F17)),
                            const SizedBox(width: 8),
                            Text('Top Products Today',
                                style: Theme.of(context)
                                    .textTheme
                                    .titleMedium
                                    ?.copyWith(fontWeight: FontWeight.bold)),
                          ]),
                          const SizedBox(height: 12),
                          ...today.topProducts.asMap().entries.map((e) {
                            final p = e.value;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                radius: 16,
                                backgroundColor:
                                    AppColors.primary.withValues(alpha: 0.1),
                                child: Text('${e.key + 1}',
                                    style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.primary)),
                              ),
                              title: Text(p.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 14)),
                              subtitle: Text('Qty: ${formatNumber(p.qtySold)}',
                                  style: const TextStyle(fontSize: 12)),
                              trailing: Text(formatCurrency(p.revenue),
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: cs.primary)),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),
                );
              }).valueOrNull ??
                  const SizedBox.shrink(),
            ),

            // Low stock alert
            Consumer(builder: (ctx, r, _) {
              final lowAsync = r.watch(lowStockProvider);
              return SliverToBoxAdapter(
                child: lowAsync.whenData((items) {
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                    child: Card(
                      color: AppColors.warning.withValues(alpha: 0.07),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                        side: BorderSide(
                            color: AppColors.warning.withValues(alpha: 0.3)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              const Icon(Icons.warning_amber,
                                  color: AppColors.warning, size: 18),
                              const SizedBox(width: 8),
                              Text('Low Stock (${items.length} items)',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.warning)),
                            ]),
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 8,
                              runSpacing: 6,
                              children: items
                                  .take(6)
                                  .map((p) => Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(
                                          color: AppColors.warning
                                              .withValues(alpha: 0.12),
                                          borderRadius:
                                              BorderRadius.circular(20),
                                          border: Border.all(
                                              color: AppColors.warning
                                                  .withValues(alpha: 0.4)),
                                        ),
                                        child: Text(
                                          '${p.name}: ${formatNumber(p.stockQuantity)}',
                                          style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w500),
                                        ),
                                      ))
                                  .toList(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).valueOrNull ??
                    const SizedBox.shrink(),
              );
            }),

            const SliverToBoxAdapter(child: SizedBox(height: 16)),
          ],
        ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  }
}

// ── Sales Trend Card ─────────────────────────────────────────────────────────

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
    final cs = Theme.of(context).colorScheme;

    // Compute total revenue for summary line
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

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                const Icon(Icons.show_chart, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Sales Trend',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.bold),
                  ),
                ),
                // Period toggle buttons
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _PeriodBtn(
                      label: 'Today',
                      active: _period == _TrendPeriod.today,
                      onTap: () => setState(() => _period = _TrendPeriod.today),
                    ),
                    const SizedBox(width: 4),
                    _PeriodBtn(
                      label: '7 Days',
                      active: _period == _TrendPeriod.week,
                      onTap: () => setState(() => _period = _TrendPeriod.week),
                    ),
                    const SizedBox(width: 4),
                    _PeriodBtn(
                      label: '30 Days',
                      active: _period == _TrendPeriod.month,
                      onTap: () => setState(() => _period = _TrendPeriod.month),
                    ),
                  ],
                ),
              ],
            ),
            // Summary line
            if (periodTotal > 0) ...[
              const SizedBox(height: 6),
              Text(
                'Total: ${formatCurrency(periodTotal)}',
                style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
              ),
            ],
            const SizedBox(height: 12),
            // Chart area
            if (_period == _TrendPeriod.today)
              _buildTodayChart(cs)
            else if (_period == _TrendPeriod.week)
              weekAsync.when(
                loading: () => const ShimmerCard(height: 160),
                error: (_, __) => const SizedBox(
                    height: 60,
                    child: Center(child: Text('Unable to load'))),
                data: (week) {
                  if (week.isEmpty) {
                    return const SizedBox(
                        height: 160,
                        child: Center(child: Text('No data')));
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
                  return _buildLineChart(spots, labels, 1, cs);
                },
              )
            else
              monthAsync.when(
                loading: () => const ShimmerCard(height: 160),
                error: (_, __) => const SizedBox(
                    height: 60,
                    child: Center(child: Text('Unable to load'))),
                data: (month) {
                  if (month.isEmpty) {
                    return const SizedBox(
                        height: 160,
                        child: Center(child: Text('No data')));
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
                  return _buildLineChart(spots, labels, 7, cs);
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTodayChart(ColorScheme cs) {
    final hourly = widget.today.hourly;
    if (hourly.isEmpty) {
      return const SizedBox(
          height: 160, child: Center(child: Text('No data')));
    }
    final spots =
        hourly.map((h) => FlSpot(h.hour.toDouble(), h.sales)).toList();
    // Labels every 6 hours: 0h, 6h, 12h, 18h
    final labels = List.generate(24, (i) => '${i}h');
    return _buildLineChart(spots, labels, 6, cs);
  }

  Widget _buildLineChart(
      List<FlSpot> spots, List<String> labels, int labelInterval, ColorScheme cs) {
    final maxY = spots.isEmpty
        ? 0.0
        : spots.map((s) => s.y).reduce((a, b) => a > b ? a : b);
    final chartMaxY = maxY == 0 ? 100.0 : maxY * 1.25;

    return SizedBox(
      height: 160,
      child: LineChart(
        LineChartData(
          maxY: chartMaxY,
          minY: 0,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: chartMaxY / 4,
            getDrawingHorizontalLine: (value) => FlLine(
              color: cs.outlineVariant.withValues(alpha: 0.5),
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
                    style: const TextStyle(fontSize: 9),
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
                        const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 11),
                      ))
                  .toList(),
            ),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              curveSmoothness: 0.35,
              barWidth: 2.5,
              color: cs.primary,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: true,
                gradient: LinearGradient(
                  colors: [
                    cs.primary.withValues(alpha: 0.12),
                    cs.primary.withValues(alpha: 0.0),
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
    final cs = Theme.of(context).colorScheme;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? cs.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            color: active ? Colors.white : cs.onSurfaceVariant,
            fontWeight: active ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }
}

// ── Payment Methods Card ─────────────────────────────────────────────────────

class _PaymentMethodsCard extends StatelessWidget {
  final DashboardSummary summary;
  const _PaymentMethodsCard({required this.summary});

  @override
  Widget build(BuildContext context) {
    final total =
        summary.cashSales + summary.cardSales + summary.mobileSales;
    if (total == 0) return const SizedBox.shrink();

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.payments_outlined,
                  size: 18, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                'Payment Methods',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
            ]),
            const SizedBox(height: 12),
            _PayRow(
              label: 'Cash',
              amount: summary.cashSales,
              color: Colors.blue[600]!,
              total: total,
            ),
            const SizedBox(height: 8),
            _PayRow(
              label: 'Card',
              amount: summary.cardSales,
              color: Colors.orange[600]!,
              total: total,
            ),
            const SizedBox(height: 8),
            _PayRow(
              label: 'Mobile/QR',
              amount: summary.mobileSales,
              color: Colors.green[600]!,
              total: total,
            ),
          ],
        ),
      ),
    );
  }
}

class _PayRow extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  final double total;

  const _PayRow({
    required this.label,
    required this.amount,
    required this.color,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? amount / total : 0.0;
    final pctLabel =
        '${(pct * 100).toStringAsFixed(0)}%';
    final cs = Theme.of(context).colorScheme;

    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration:
              BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 8),
        SizedBox(
          width: 64,
          child: Text(label,
              style: const TextStyle(fontSize: 13)),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: cs.surfaceContainerHighest,
              valueColor: AlwaysStoppedAnimation<Color>(color),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              formatCurrency(amount),
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 12),
            ),
            Text(
              pctLabel,
              style: TextStyle(
                  fontSize: 10, color: cs.onSurfaceVariant),
            ),
          ],
        ),
      ],
    );
  }
}

// ── Reusable widgets ─────────────────────────────────────────────────────────

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final Color bg;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.bg,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Theme.of(context).shadowColor.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    )
        .animate()
        .fadeIn(duration: 350.ms)
        .slideY(begin: 0.1, end: 0, duration: 350.ms, curve: Curves.easeOut);
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
