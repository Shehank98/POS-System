import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../data/services/report_service.dart';
import '../../../providers/report_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';
import '../../widgets/common/stat_card.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  Future<void> _pickDate(
      BuildContext context, WidgetRef ref, bool isStart) async {
    final initial = isStart
        ? ref.read(reportStartDateProvider)
        : ref.read(reportEndDateProvider);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    if (isStart) {
      ref.read(reportStartDateProvider.notifier).state = picked;
    } else {
      ref.read(reportEndDateProvider.notifier).state = picked;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final start = ref.watch(reportStartDateProvider);
    final end = ref.watch(reportEndDateProvider);
    final summaryAsync = ref.watch(salesSummaryProvider);
    final cs = Theme.of(context).colorScheme;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Reports'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Overview'),
              Tab(text: 'Tax'),
            ],
          ),
        ),
        body: Column(
          children: [
            // Date range picker
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickDate(context, ref, true),
                      icon: const Icon(Icons.calendar_today, size: 15),
                      label: Text(formatDate(start),
                          style: const TextStyle(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 42)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text('→',
                        style: TextStyle(color: cs.onSurfaceVariant)),
                  ),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickDate(context, ref, false),
                      icon: const Icon(Icons.calendar_today, size: 15),
                      label: Text(formatDate(end),
                          style: const TextStyle(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 42)),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 4),

            Expanded(
              child: TabBarView(
                children: [
                  // ── Overview tab ──────────────────────────────────────
                  summaryAsync.when(
                    loading: () => const LoadingOverlay(),
                    error: (e, _) => ErrorView(
                        message: e.toString(),
                        onRetry: () => ref.invalidate(salesSummaryProvider)),
                    data: (summary) => SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Key metrics 2×2 grid
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            childAspectRatio: 1.3,
                            crossAxisSpacing: 10,
                            mainAxisSpacing: 10,
                            children: [
                              StatCard(
                                label: 'Transactions',
                                value: '${summary.totalTransactions}',
                                icon: Icons.receipt_long_outlined,
                              ),
                              StatCard(
                                label: 'Revenue',
                                value: formatCurrency(summary.totalRevenue),
                                icon: Icons.attach_money,
                                iconColor: Colors.green,
                              ),
                              StatCard(
                                label: 'Net Revenue',
                                value: formatCurrency(summary.netRevenue),
                                icon: Icons.trending_up,
                                iconColor: Colors.blue,
                              ),
                              StatCard(
                                label: 'Tax Collected',
                                value: formatCurrency(summary.totalTax),
                                icon: Icons.account_balance_outlined,
                                iconColor: Colors.purple,
                              ),
                            ],
                          ),

                          const SizedBox(height: 12),

                          // Supplementary row: discounts / refunds / voided
                          Row(children: [
                            Expanded(
                              child: _MetricTile(
                                label: 'Discounts',
                                value: formatCurrency(summary.totalDiscounts),
                                icon: Icons.discount_outlined,
                                color: Colors.orange,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _MetricTile(
                                label: 'Refunds',
                                value: formatCurrency(summary.totalRefunds),
                                icon: Icons.undo_outlined,
                                color: Colors.red,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: _MetricTile(
                                label: 'Voided',
                                value: '${summary.voidedTransactions}',
                                icon: Icons.cancel_outlined,
                                color: Colors.grey,
                              ),
                            ),
                          ]),

                          const SizedBox(height: 12),

                          // Payment method breakdown (compact, no chart)
                          Card(
                            margin: EdgeInsets.zero,
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(children: [
                                    Icon(Icons.payments_outlined,
                                        size: 17, color: cs.primary),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Payment Methods',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall
                                          ?.copyWith(
                                              fontWeight: FontWeight.bold),
                                    ),
                                  ]),
                                  const SizedBox(height: 14),
                                  _PaymentBreakdown(summary: summary),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 14),

                          // Export
                          OutlinedButton.icon(
                            onPressed: () async {
                              final svc = ref.read(reportServiceProvider);
                              final url = await svc.buildSalesExportUrl(
                                  toApiDate(start), toApiDate(end));
                              if (await canLaunchUrl(url)) {
                                await launchUrl(url,
                                    mode: LaunchMode.externalApplication);
                              }
                            },
                            icon: const Icon(Icons.download_outlined, size: 16),
                            label: const Text('Export to Excel'),
                            style: OutlinedButton.styleFrom(
                                minimumSize: const Size(double.infinity, 44)),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // ── Tax tab ───────────────────────────────────────────
                  Consumer(builder: (ctx, r, _) {
                    final taxAsync = r.watch(taxReportProvider);
                    return taxAsync.when(
                      loading: () => const LoadingOverlay(),
                      error: (e, _) => ErrorView(message: e.toString()),
                      data: (report) => SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Card(
                              child: Padding(
                                padding: const EdgeInsets.all(16),
                                child: Column(children: [
                                  _TaxRow('Total Tax',
                                      formatCurrency(report.totalTax),
                                      bold: true),
                                  const Divider(height: 20),
                                  _TaxRow('Total Revenue',
                                      formatCurrency(report.totalRevenue)),
                                  const SizedBox(height: 4),
                                  _TaxRow(
                                    'Net (excl. tax)',
                                    formatCurrency(report.totalRevenue -
                                        report.totalTax),
                                  ),
                                ]),
                              ),
                            ),
                            const SizedBox(height: 16),
                            if (report.byDay.isNotEmpty) ...[
                              Text('Daily Breakdown',
                                  style: Theme.of(ctx)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(
                                          fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              Card(
                                child: Column(
                                  children: report.byDay
                                      .asMap()
                                      .entries
                                      .map((entry) {
                                    final d = entry.value;
                                    final isLast =
                                        entry.key == report.byDay.length - 1;
                                    return Column(children: [
                                      ListTile(
                                        dense: true,
                                        title: Text(d.date,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w500)),
                                        subtitle: Text(
                                            '${d.transactions} transactions'),
                                        trailing: Text(
                                            formatCurrency(d.taxCollected),
                                            style: const TextStyle(
                                                fontWeight: FontWeight.bold)),
                                      ),
                                      if (!isLast)
                                        const Divider(
                                            height: 1, indent: 16),
                                    ]);
                                  }).toList(),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Payment breakdown (compact bar rows) ─────────────────────────────────────

class _PaymentBreakdown extends StatelessWidget {
  final TransactionSummary summary;
  const _PaymentBreakdown({required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = summary.cashCount + summary.cardCount + summary.mobileCount;
    if (total == 0) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Center(child: Text('No transactions in selected range')),
      );
    }
    return Column(children: [
      _PayRow('Cash', summary.cashCount, Colors.blue[600]!, total),
      const SizedBox(height: 10),
      _PayRow('Card', summary.cardCount, Colors.orange[600]!, total),
      const SizedBox(height: 10),
      _PayRow('Mobile / QR', summary.mobileCount, Colors.green[600]!, total),
    ]);
  }
}

class _PayRow extends StatelessWidget {
  final String label;
  final int count;
  final Color color;
  final int total;
  const _PayRow(this.label, this.count, this.color, this.total);

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? count / total : 0.0;
    final cs = Theme.of(context).colorScheme;
    return Row(children: [
      Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      ),
      const SizedBox(width: 8),
      SizedBox(
        width: 76,
        child: Text(label, style: const TextStyle(fontSize: 13)),
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
      const SizedBox(width: 10),
      SizedBox(
        width: 58,
        child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('$count txn',
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
          Text('${(pct * 100).toStringAsFixed(0)}%',
              style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)),
        ]),
      ),
    ]);
  }
}

// ── Small metric tile ─────────────────────────────────────────────────────────

class _MetricTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  const _MetricTile(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 6),
        Text(value,
            style: TextStyle(
                fontWeight: FontWeight.bold, fontSize: 13, color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        Text(label,
            style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant)),
      ]),
    );
  }
}

// ── Tax row ───────────────────────────────────────────────────────────────────

class _TaxRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _TaxRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(children: [
        Text(label,
            style: TextStyle(
                fontWeight: bold ? FontWeight.bold : FontWeight.normal,
                fontSize: bold ? 14 : 13)),
        const Spacer(),
        Text(value,
            style: TextStyle(
                fontWeight: bold ? FontWeight.bold : FontWeight.normal,
                fontSize: bold ? 14 : 13)),
      ]),
    );
  }
}
