import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../data/services/report_service.dart';
import '../../../providers/report_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';

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

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'EXPORTS & Z-REPORTS',
                    style: GoogleFonts.manrope(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink3,
                      letterSpacing: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Reports',
                    style: GoogleFonts.manrope(
                      fontSize: 24,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            // ── Date range picker ────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  Expanded(
                    child: _DateButton(
                      date: start,
                      onTap: () => _pickDate(context, ref, true),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    child: Text(
                      '→',
                      style: GoogleFonts.manrope(
                        color: AppColors.ink3,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  Expanded(
                    child: _DateButton(
                      date: end,
                      onTap: () => _pickDate(context, ref, false),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 28),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Quick reports section ──────────────────────
                    _Eyebrow('QUICK'),
                    const SizedBox(height: 10),
                    _QuickReportsGrid(
                      onZReport: () async {
                        final svc = ref.read(reportServiceProvider);
                        final url = await svc.buildSalesExportUrl(
                            toApiDate(start), toApiDate(end));
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                      onSalesByItem: () async {
                        final svc = ref.read(reportServiceProvider);
                        final url = await svc.buildSalesExportUrl(
                            toApiDate(start), toApiDate(end));
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                      onDiscounts: () async {
                        final svc = ref.read(reportServiceProvider);
                        final url = await svc.buildSalesExportUrl(
                            toApiDate(start), toApiDate(end),
                            format: 'excel');
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                      onCashDrawer: () async {
                        final svc = ref.read(reportServiceProvider);
                        final url = await svc.buildInventoryExportUrl();
                        if (await canLaunchUrl(url)) {
                          await launchUrl(url,
                              mode: LaunchMode.externalApplication);
                        }
                      },
                    ),

                    const SizedBox(height: 32),

                    // ── Recent exports section ─────────────────────
                    _Eyebrow('RECENT'),
                    const SizedBox(height: 10),

                    summaryAsync.when(
                      loading: () => const _RecentExportsShimmer(),
                      error: (e, _) => ErrorView(
                        message: e.toString(),
                        onRetry: () => ref.invalidate(salesSummaryProvider),
                      ),
                      data: (summary) => _RecentExportsList(
                        summary: summary,
                        start: start,
                        end: end,
                        ref: ref,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Eyebrow label ─────────────────────────────────────────────────────────────

class _Eyebrow extends StatelessWidget {
  final String text;
  const _Eyebrow(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.manrope(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: AppColors.ink3,
        letterSpacing: 1.4,
      ),
    );
  }
}

// ── Date button ───────────────────────────────────────────────────────────────

class _DateButton extends StatelessWidget {
  final DateTime date;
  final VoidCallback onTap;
  const _DateButton({required this.date, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Row(
          children: [
            const Icon(Icons.calendar_today_outlined,
                size: 14, color: AppColors.ink3),
            const SizedBox(width: 8),
            Text(
              formatDate(date),
              style: GoogleFonts.manrope(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.ink,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Quick reports 2x2 grid ────────────────────────────────────────────────────

class _QuickReportsGrid extends StatelessWidget {
  final VoidCallback onZReport;
  final VoidCallback onSalesByItem;
  final VoidCallback onDiscounts;
  final VoidCallback onCashDrawer;

  const _QuickReportsGrid({
    required this.onZReport,
    required this.onSalesByItem,
    required this.onDiscounts,
    required this.onCashDrawer,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 1.45,
      children: [
        _ReportTile(
          icon: Icons.summarize_outlined,
          title: 'Z-Report',
          subtitle: 'Daily summary',
          onTap: onZReport,
        ),
        _ReportTile(
          icon: Icons.inventory_2_outlined,
          title: 'Sales by item',
          subtitle: 'Product breakdown',
          onTap: onSalesByItem,
        ),
        _ReportTile(
          icon: Icons.discount_outlined,
          title: 'Discounts',
          subtitle: 'Applied discounts',
          onTap: onDiscounts,
        ),
        _ReportTile(
          icon: Icons.point_of_sale_outlined,
          title: 'Cash drawer',
          subtitle: 'Inventory export',
          onTap: onCashDrawer,
        ),
      ],
    );
  }
}

class _ReportTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ReportTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: AppColors.ink2),
            ),
            const Spacer(),
            Text(
              title,
              style: GoogleFonts.manrope(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: GoogleFonts.manrope(
                fontSize: 11,
                color: AppColors.ink3,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Recent exports list ───────────────────────────────────────────────────────

class _RecentExportsList extends StatelessWidget {
  final TransactionSummary summary;
  final DateTime start;
  final DateTime end;
  final WidgetRef ref;

  const _RecentExportsList({
    required this.summary,
    required this.start,
    required this.end,
    required this.ref,
  });

  @override
  Widget build(BuildContext context) {
    final items = [
      _ExportItem(
        fileType: 'XLS',
        fileName: 'sales_${toApiDate(start)}_${toApiDate(end)}.xlsx',
        size: '${(summary.totalTransactions * 0.8).toStringAsFixed(1)} KB',
        onDownload: () async {
          final svc = ref.read(reportServiceProvider);
          final url = await svc.buildSalesExportUrl(
              toApiDate(start), toApiDate(end));
          if (await canLaunchUrl(url)) {
            await launchUrl(url, mode: LaunchMode.externalApplication);
          }
        },
      ),
      _ExportItem(
        fileType: 'CSV',
        fileName: 'inventory_export.csv',
        size: '12.4 KB',
        onDownload: () async {
          final svc = ref.read(reportServiceProvider);
          final url = await svc.buildInventoryExportUrl();
          if (await canLaunchUrl(url)) {
            await launchUrl(url, mode: LaunchMode.externalApplication);
          }
        },
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        children: items.asMap().entries.map((entry) {
          final isLast = entry.key == items.length - 1;
          return Column(
            children: [
              _ExportRow(item: entry.value),
              if (!isLast)
                const Divider(
                    height: 1, indent: 16, color: AppColors.hairline),
            ],
          );
        }).toList(),
      ),
    );
  }
}

class _ExportItem {
  final String fileType;
  final String fileName;
  final String size;
  final VoidCallback onDownload;

  const _ExportItem({
    required this.fileType,
    required this.fileName,
    required this.size,
    required this.onDownload,
  });
}

class _ExportRow extends StatelessWidget {
  final _ExportItem item;
  const _ExportRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          // File type badge — 32x32, soft bg, mono text
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text(
                item.fileType,
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 8,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink2,
                  letterSpacing: 0.4,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // File info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.fileName,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  item.size,
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 11,
                    color: AppColors.ink3,
                  ),
                ),
              ],
            ),
          ),
          // Download icon
          GestureDetector(
            onTap: item.onDownload,
            child: Padding(
              padding: const EdgeInsets.all(6),
              child: const Icon(
                Icons.download_outlined,
                size: 18,
                color: AppColors.ink3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Loading shimmer placeholder ───────────────────────────────────────────────

class _RecentExportsShimmer extends StatelessWidget {
  const _RecentExportsShimmer();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: const Center(
        child: SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: AppColors.brand,
          ),
        ),
      ),
    );
  }
}

// ── Payment breakdown (kept for data layer compatibility) ─────────────────────

class _PaymentBreakdown extends StatelessWidget {
  final TransactionSummary summary;
  const _PaymentBreakdown({required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = summary.cashCount + summary.cardCount + summary.mobileCount;
    if (total == 0) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: Text(
            'No transactions in selected range',
            style: GoogleFonts.manrope(color: AppColors.ink3, fontSize: 13),
          ),
        ),
      );
    }
    return Column(children: [
      _PayBar('Cash', summary.cashCount, total),
      const SizedBox(height: 10),
      _PayBar('Card', summary.cardCount, total),
      const SizedBox(height: 10),
      _PayBar('Mobile / QR', summary.mobileCount, total),
    ]);
  }
}

class _PayBar extends StatelessWidget {
  final String label;
  final int count;
  final int total;
  const _PayBar(this.label, this.count, this.total);

  @override
  Widget build(BuildContext context) {
    final pct = total > 0 ? count / total : 0.0;
    return Row(children: [
      SizedBox(
        width: 46,
        child: Text(
          label,
          style: GoogleFonts.manrope(fontSize: 12, color: AppColors.ink2),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 6,
            backgroundColor: AppColors.soft,
            valueColor: const AlwaysStoppedAnimation<Color>(AppColors.brand),
          ),
        ),
      ),
      const SizedBox(width: 10),
      SizedBox(
        width: 58,
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(
            '$count txn',
            style: GoogleFonts.jetBrainsMono(
                fontWeight: FontWeight.w600,
                fontSize: 11,
                color: AppColors.ink),
          ),
          Text(
            '${(pct * 100).toStringAsFixed(0)}%',
            style: GoogleFonts.manrope(fontSize: 10, color: AppColors.ink3),
          ),
        ]),
      ),
    ]);
  }
}
