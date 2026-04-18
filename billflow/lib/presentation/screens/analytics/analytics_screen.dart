import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
      appBar: AppBar(
        title: const Text('Analytics'),
        centerTitle: false,
        titleTextStyle: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(analyticsProvider),
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Column(
        children: [
          // Date range presets
          _DatePresets(current: range),
          Expanded(
            child: analyticsAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off_outlined,
                        size: 40, color: Colors.grey),
                    const SizedBox(height: 8),
                    Text(e.toString(),
                        style: const TextStyle(color: Colors.grey),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => ref.invalidate(analyticsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (result) => _AnalyticsBody(result: result),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Date range presets ────────────────────────────────────────────────────────
class _DatePresets extends ConsumerWidget {
  final AnalyticsRange current;
  const _DatePresets({required this.current});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final presets = _buildPresets();
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: presets.map((p) {
          final selected = p.label == current.label;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: GestureDetector(
              onTap: () {
                ref.read(analyticsRangeProvider.notifier).state = p;
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                decoration: BoxDecoration(
                  color: selected
                      ? AppColors.primary
                      : Theme.of(context).colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: selected
                        ? AppColors.primary
                        : Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
                child: Text(
                  p.label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: selected
                        ? Colors.white
                        : Theme.of(context).colorScheme.onSurface,
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
          label: 'Last 7 Days'),
      AnalyticsRange(
          from: fmt(thisMonthStart), to: fmt(today), label: 'This Month'),
      AnalyticsRange(
          from: fmt(lastMonthStart),
          to: fmt(lastMonthEnd),
          label: 'Last Month'),
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
    final cs = Theme.of(context).colorScheme;
    final totalPayments = s.cashSales + s.cardSales + s.mobileSales;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Summary cards
        _SectionHeader('Revenue Summary'),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                label: 'Total Sales',
                value: formatCurrency(s.totalSales),
                icon: Icons.trending_up,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _MetricCard(
                label: 'Net Sales',
                value: formatCurrency(s.netSales),
                icon: Icons.account_balance_wallet_outlined,
                color: AppColors.success,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                label: 'Transactions',
                value: '${s.transactionCount}',
                icon: Icons.receipt_long_outlined,
                color: Colors.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _MetricCard(
                label: 'Tax Collected',
                value: formatCurrency(s.totalTax),
                icon: Icons.percent_rounded,
                color: Colors.orange,
              ),
            ),
          ],
        ),
        if (s.totalDiscounts > 0) ...[
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _MetricCard(
                  label: 'Discounts',
                  value: formatCurrency(s.totalDiscounts),
                  icon: Icons.discount_outlined,
                  color: Colors.purple,
                ),
              ),
              if (s.totalRefunds > 0) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: _MetricCard(
                    label: 'Refunds',
                    value: formatCurrency(s.totalRefunds),
                    icon: Icons.undo_rounded,
                    color: Colors.red,
                  ),
                ),
              ] else
                const Expanded(child: SizedBox()),
            ],
          ),
        ],

        const SizedBox(height: 24),

        // Payment method breakdown
        if (totalPayments > 0) ...[
          _SectionHeader('Payment Methods'),
          const SizedBox(height: 10),
          _PaymentBreakdown(
            cash: s.cashSales,
            card: s.cardSales,
            mobile: s.mobileSales,
            total: totalPayments,
          ),
          const SizedBox(height: 24),
        ],

        // Top products
        if (result.topProducts.isNotEmpty) ...[
          _SectionHeader('Top Products'),
          const SizedBox(height: 10),
          ...result.topProducts.take(10).toList().asMap().entries.map(
                (e) => _TopProductRow(
                  rank: e.key + 1,
                  product: e.value,
                  maxRevenue: result.topProducts.first.revenue,
                ),
              ),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontWeight: FontWeight.bold,
        fontSize: 13,
        color: Theme.of(context).colorScheme.onSurfaceVariant,
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 16)),
          Text(label,
              style:
                  TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
        ],
      ),
    );
  }
}

class _PaymentBreakdown extends StatelessWidget {
  final double cash;
  final double card;
  final double mobile;
  final double total;

  const _PaymentBreakdown({
    required this.cash,
    required this.card,
    required this.mobile,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        children: [
          _PayRow(
              label: 'Cash',
              amount: cash,
              total: total,
              color: Colors.green,
              icon: Icons.money),
          const SizedBox(height: 8),
          _PayRow(
              label: 'Card',
              amount: card,
              total: total,
              color: Colors.blue,
              icon: Icons.credit_card_outlined),
          const SizedBox(height: 8),
          _PayRow(
              label: 'Mobile',
              amount: mobile,
              total: total,
              color: Colors.purple,
              icon: Icons.phone_android_outlined),
        ],
      ),
    );
  }
}

class _PayRow extends StatelessWidget {
  final String label;
  final double amount;
  final double total;
  final Color color;
  final IconData icon;

  const _PayRow({
    required this.label,
    required this.amount,
    required this.total,
    required this.color,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? (amount / total) : 0.0;
    return Row(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(width: 8),
        SizedBox(
          width: 50,
          child: Text(label,
              style: const TextStyle(fontSize: 13)),
        ),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: pct,
              backgroundColor: color.withOpacity(0.1),
              valueColor: AlwaysStoppedAnimation(color),
              minHeight: 8,
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          formatCurrency(amount),
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        ),
        const SizedBox(width: 4),
        SizedBox(
          width: 36,
          child: Text(
            '${(pct * 100).toStringAsFixed(0)}%',
            textAlign: TextAlign.right,
            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
          ),
        ),
      ],
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
    final cs = Theme.of(context).colorScheme;
    final pct = maxRevenue > 0 ? (product.revenue / maxRevenue) : 0.0;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          // Rank
          SizedBox(
            width: 24,
            child: Text(
              '$rank',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: rank <= 3 ? AppColors.primary : cs.onSurfaceVariant,
              ),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: const TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 3),
                ClipRRect(
                  borderRadius: BorderRadius.circular(3),
                  child: LinearProgressIndicator(
                    value: pct,
                    backgroundColor:
                        AppColors.primary.withOpacity(0.08),
                    valueColor:
                        AlwaysStoppedAnimation(AppColors.primary),
                    minHeight: 4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                formatCurrency(product.revenue),
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 13),
              ),
              Text(
                '${formatNumber(product.qtySold)} sold',
                style:
                    TextStyle(fontSize: 10, color: cs.onSurfaceVariant),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
