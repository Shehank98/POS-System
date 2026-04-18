import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/services/report_service.dart';
import '../../../providers/report_provider.dart';
import '../../widgets/charts/payment_pie_chart.dart';
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
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickDate(context, ref, true),
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: Text(formatDate(start),
                          style: const TextStyle(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 44)),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child:
                        Text('to', style: TextStyle(color: cs.onSurfaceVariant)),
                  ),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _pickDate(context, ref, false),
                      icon: const Icon(Icons.calendar_today, size: 16),
                      label: Text(formatDate(end),
                          style: const TextStyle(fontSize: 13)),
                      style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 44)),
                    ),
                  ),
                ],
              ),
            ),

            // Tabs
            Expanded(
              child: TabBarView(
                children: [
                  // Overview tab
                  summaryAsync.when(
                    loading: () => const LoadingOverlay(),
                    error: (e, _) => ErrorView(
                        message: e.toString(),
                        onRetry: () => ref.invalidate(salesSummaryProvider)),
                    data: (summary) => SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          GridView.count(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            crossAxisCount: 2,
                            childAspectRatio: 1.35,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
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
                          const SizedBox(height: 20),
                          Card(
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Payment Breakdown',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                              fontWeight: FontWeight.bold)),
                                  const SizedBox(height: 16),
                                  PaymentPieChart(summary: summary),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () async {
                                  final svc = ref.read(reportServiceProvider);
                                  final url = await svc.buildSalesExportUrl(
                                      toApiDate(start), toApiDate(end));
                                  if (await canLaunchUrl(url)) {
                                    await launchUrl(url,
                                        mode: LaunchMode.externalApplication);
                                  }
                                },
                                icon: const Icon(Icons.download_outlined,
                                    size: 16),
                                label: const Text('Export Excel'),
                                style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(0, 44)),
                              ),
                            ),
                          ]),
                        ],
                      ),
                    ),
                  ),

                  // Tax tab
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
                                  _TaxRow('Total Revenue',
                                      formatCurrency(report.totalRevenue)),
                                ]),
                              ),
                            ),
                            const SizedBox(height: 16),
                            if (report.byDay.isNotEmpty) ...[
                              Text('Daily Breakdown',
                                  style: Theme.of(ctx)
                                      .textTheme
                                      .titleSmall
                                      ?.copyWith(fontWeight: FontWeight.bold)),
                              const SizedBox(height: 8),
                              Card(
                                child: Column(
                                  children: report.byDay
                                      .map((d) => ListTile(
                                            dense: true,
                                            title: Text(d.date),
                                            subtitle: Text(
                                                '${d.transactions} transactions'),
                                            trailing: Text(
                                                formatCurrency(d.taxCollected),
                                                style: const TextStyle(
                                                    fontWeight:
                                                        FontWeight.bold)),
                                          ))
                                      .toList(),
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

class _TaxRow extends StatelessWidget {
  final String label;
  final String value;
  final bool bold;
  const _TaxRow(this.label, this.value, {this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Text(label,
            style: TextStyle(
                fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
        const Spacer(),
        Text(value,
            style: TextStyle(
                fontWeight: bold ? FontWeight.bold : FontWeight.normal)),
      ]),
    );
  }
}
