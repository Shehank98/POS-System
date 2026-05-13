import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/dashboard_model.dart';
import '../../../providers/dashboard_provider.dart';

class AnalyticsScreen extends ConsumerWidget {
  const AnalyticsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final range = ref.watch(analyticsRangeProvider);
    final analyticsAsync = ref.watch(analyticsProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'REPORTING',
                          style: GoogleFonts.manrope(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink3,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Analytics',
                          style: GoogleFonts.manrope(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Refresh button
                  GestureDetector(
                    onTap: () => ref.invalidate(analyticsProvider),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: const Icon(
                        Icons.refresh_rounded,
                        size: 18,
                        color: AppColors.ink2,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // ── Period segmented control ─────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _PeriodControl(current: range),
            ),

            const SizedBox(height: 20),

            // ── Body ─────────────────────────────────────────────────
            Expanded(
              child: analyticsAsync.when(
                loading: () => const Center(
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.brand,
                    ),
                  ),
                ),
                error: (e, _) => Center(
                  child: Padding(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.wifi_off_outlined,
                            size: 36, color: AppColors.ink3),
                        const SizedBox(height: 12),
                        Text(
                          e.toString(),
                          style: GoogleFonts.manrope(
                              color: AppColors.ink3, fontSize: 13),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        GestureDetector(
                          onTap: () => ref.invalidate(analyticsProvider),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 10),
                            decoration: BoxDecoration(
                              color: AppColors.brand,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              'Retry',
                              style: GoogleFonts.manrope(
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                data: (result) => _AnalyticsBody(result: result),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Period segmented control ──────────────────────────────────────────────────

class _PeriodControl extends ConsumerWidget {
  final AnalyticsRange current;
  const _PeriodControl({required this.current});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final presets = _buildPresets();

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.soft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: presets.map((p) {
          final selected = p.label == current.label;
          return Expanded(
            child: GestureDetector(
              onTap: () {
                ref.read(analyticsRangeProvider.notifier).state = p;
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                curve: Curves.easeInOut,
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: selected ? AppColors.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                  boxShadow: selected
                      ? [
                          BoxShadow(
                            color: AppColors.ink.withValues(alpha: 0.06),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                child: Center(
                  child: Text(
                    p.label,
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      fontWeight:
                          selected ? FontWeight.w600 : FontWeight.w500,
                      color: selected ? AppColors.ink : AppColors.ink2,
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  List<AnalyticsRange> _buildPresets() {
    final now = DateTime.now().toUtc();
    final today = DateTime.utc(now.year, now.month, now.day);
    final fmt = (DateTime d) =>
        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

    final thisMonthStart = DateTime.utc(now.year, now.month, 1);
    final lastMonthStart = DateTime.utc(now.year, now.month - 1, 1);
    final lastMonthEnd = DateTime.utc(now.year, now.month, 0);

    return [
      AnalyticsRange(from: fmt(today), to: fmt(today), label: 'Today'),
      AnalyticsRange(
          from: fmt(today.subtract(const Duration(days: 6))),
          to: fmt(today),
          label: '7 Days'),
      AnalyticsRange(
          from: fmt(thisMonthStart), to: fmt(today), label: 'Month'),
      AnalyticsRange(
          from: fmt(lastMonthStart),
          to: fmt(lastMonthEnd),
          label: 'Last mo.'),
    ];
  }
}

// ── Analytics body ────────────────────────────────────────────────────────────

class _AnalyticsBody extends StatelessWidget {
  final AnalyticsResult result;
  const _AnalyticsBody({required this.result});

  @override
  Widget build(BuildContext context) {
    final s = result.summary;
    final totalPayments = s.cashSales + s.cardSales + s.mobileSales;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
      children: [
        // ── Two big stat cards ─────────────────────────────────────
        Row(
          children: [
            Expanded(
              child: _BigStatCard(
                label: 'TOTAL SALES',
                prefix: 'Rs',
                value: formatCurrency(s.totalSales),
                delta: '+${formatCurrency(s.netSales)} net',
                active: true,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _BigStatCard(
                label: 'NET SALES',
                prefix: 'Rs',
                value: formatCurrency(s.netSales),
                delta: '${s.transactionCount} txns',
                active: false,
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        // ── 4 small stats ──────────────────────────────────────────
        Row(
          children: [
            Expanded(
              child: _SmallStat(
                label: 'Txns',
                value: '${s.transactionCount}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SmallStat(
                label: 'Tax',
                value: formatCurrency(s.totalTax),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SmallStat(
                label: 'Disc',
                value: formatCurrency(s.totalDiscounts),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _SmallStat(
                label: 'Refund',
                value: formatCurrency(s.totalRefunds),
              ),
            ),
          ],
        ),

        const SizedBox(height: 20),

        // ── Payment breakdown ──────────────────────────────────────
        if (totalPayments > 0) ...[
          _PaymentBreakdownCard(
            cash: s.cashSales,
            card: s.cardSales,
            mobile: s.mobileSales,
            total: totalPayments,
          ),
          const SizedBox(height: 20),
        ],

        // ── 7-day bar chart ────────────────────────────────────────
        if (result.daily.isNotEmpty) ...[
          _BarChartCard(daily: result.daily),
          const SizedBox(height: 20),
        ],

        // ── Top products ───────────────────────────────────────────
        if (result.topProducts.isNotEmpty) ...[
          _TopProductsCard(products: result.topProducts),
        ],
      ],
    );
  }
}

// ── Big stat card ─────────────────────────────────────────────────────────────

class _BigStatCard extends StatelessWidget {
  final String label;
  final String prefix;
  final String value;
  final String delta;
  final bool active;

  const _BigStatCard({
    required this.label,
    required this.prefix,
    required this.value,
    required this.delta,
    required this.active,
  });

  @override
  Widget build(BuildContext context) {
    final bg = active ? AppColors.ink : AppColors.surface;
    final labelColor =
        active ? Colors.white.withValues(alpha: 0.55) : AppColors.ink3;
    final prefixColor =
        active ? Colors.white.withValues(alpha: 0.65) : AppColors.ink3;
    final valueColor = active ? Colors.white : AppColors.ink;
    final deltaColor = active ? Colors.white : AppColors.brand;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: active ? null : Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: labelColor,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                prefix,
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: prefixColor,
                ),
              ),
              const SizedBox(width: 3),
              Expanded(
                child: Text(
                  value,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: valueColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            delta,
            style: GoogleFonts.manrope(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: deltaColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Small stat tile ───────────────────────────────────────────────────────────

class _SmallStat extends StatelessWidget {
  final String label;
  final String value;

  const _SmallStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 10,
              color: AppColors.ink3,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ── Payment breakdown card ────────────────────────────────────────────────────

class _PaymentBreakdownCard extends StatelessWidget {
  final double cash;
  final double card;
  final double mobile;
  final double total;

  const _PaymentBreakdownCard({
    required this.cash,
    required this.card,
    required this.mobile,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'BY PAYMENT',
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.ink3,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 14),
          _PayBar(label: 'Cash', amount: cash, total: total),
          const SizedBox(height: 10),
          _PayBar(label: 'Card', amount: card, total: total),
          const SizedBox(height: 10),
          _PayBar(label: 'Mobile', amount: mobile, total: total),
        ],
      ),
    );
  }
}

class _PayBar extends StatelessWidget {
  final String label;
  final double amount;
  final double total;

  const _PayBar({
    required this.label,
    required this.amount,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (amount / total).clamp(0.0, 1.0) : 0.0;
    return Row(
      children: [
        // Fixed-width label
        SizedBox(
          width: 46,
          child: Text(
            label,
            style: GoogleFonts.manrope(
              fontSize: 12,
              color: AppColors.ink2,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
        const SizedBox(width: 8),
        // Progress bar
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: AppColors.soft,
              valueColor:
                  const AlwaysStoppedAnimation<Color>(AppColors.brand),
            ),
          ),
        ),
        const SizedBox(width: 10),
        // Value
        Text(
          formatCurrency(amount),
          style: GoogleFonts.jetBrainsMono(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(width: 6),
        // Percentage
        SizedBox(
          width: 34,
          child: Text(
            '${(pct * 100).toStringAsFixed(0)}%',
            textAlign: TextAlign.right,
            style: GoogleFonts.manrope(
              fontSize: 10,
              color: AppColors.ink3,
            ),
          ),
        ),
      ],
    );
  }
}

// ── 7-day bar chart card ──────────────────────────────────────────────────────

class _BarChartCard extends StatelessWidget {
  final List<DailyPoint> daily;
  const _BarChartCard({required this.daily});

  @override
  Widget build(BuildContext context) {
    // Take last 7 points (or fewer)
    final points = daily.length > 7
        ? daily.sublist(daily.length - 7)
        : daily;
    final maxSales =
        points.fold<double>(0, (m, p) => math.max(m, p.sales));
    // Day labels: derive short day name from date string or index
    const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '7-DAY TREND',
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.ink3,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 80,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: points.asMap().entries.map((entry) {
                final i = entry.key;
                final pt = entry.value;
                final frac =
                    maxSales > 0 ? (pt.sales / maxSales).clamp(0.0, 1.0) : 0.0;
                final isPeak = pt.sales == maxSales && maxSales > 0;

                // Derive day label from date string if possible
                String dayLabel;
                try {
                  final d = DateTime.parse(pt.day);
                  // weekday: 1=Mon, 7=Sun
                  dayLabel = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
                      [d.weekday - 1];
                } catch (_) {
                  dayLabel = i < dayLetters.length ? dayLetters[i] : '?';
                }

                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              Flexible(
                                child: FractionallySizedBox(
                                  heightFactor: frac == 0 ? 0.04 : frac,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      color: isPeak
                                          ? AppColors.brand
                                          : AppColors.soft,
                                      borderRadius:
                                          BorderRadius.circular(4),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          dayLabel,
                          style: GoogleFonts.manrope(
                            fontSize: 10,
                            color: isPeak
                                ? AppColors.brand
                                : AppColors.ink3,
                            fontWeight: isPeak
                                ? FontWeight.w700
                                : FontWeight.w400,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Top products card ─────────────────────────────────────────────────────────

class _TopProductsCard extends StatelessWidget {
  final List<TopProduct> products;
  const _TopProductsCard({required this.products});

  @override
  Widget build(BuildContext context) {
    final top = products.take(10).toList();
    final maxRevenue = top.isNotEmpty ? top.first.revenue : 1.0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TOP PRODUCTS',
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.ink3,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 14),
          ...top.asMap().entries.map((e) => _TopProductRow(
                rank: e.key + 1,
                product: e.value,
                maxRevenue: maxRevenue,
              )),
        ],
      ),
    );
  }
}

class _TopProductRow extends StatelessWidget {
  final int rank;
  final TopProduct product;
  final double maxRevenue;

  const _TopProductRow({
    required this.rank,
    required this.product,
    required this.maxRevenue,
  });

  @override
  Widget build(BuildContext context) {
    final pct = maxRevenue > 0 ? (product.revenue / maxRevenue) : 0.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 20,
            child: Text(
              '$rank',
              style: GoogleFonts.jetBrainsMono(
                fontWeight: FontWeight.w600,
                fontSize: 12,
                color: rank <= 3 ? AppColors.brand : AppColors.ink3,
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: pct,
                    backgroundColor: AppColors.soft,
                    valueColor:
                        const AlwaysStoppedAnimation<Color>(AppColors.brand),
                    minHeight: 4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatCurrency(product.revenue),
                style: GoogleFonts.jetBrainsMono(
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                  color: AppColors.ink,
                ),
              ),
              Text(
                '${formatNumber(product.qtySold)} sold',
                style: GoogleFonts.manrope(
                  fontSize: 10,
                  color: AppColors.ink3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
