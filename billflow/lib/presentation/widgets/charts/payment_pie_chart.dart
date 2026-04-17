import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/transaction_model.dart';

class PaymentPieChart extends StatelessWidget {
  final TransactionSummary summary;

  const PaymentPieChart({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = summary.totalRevenue;
    if (total == 0) {
      return const SizedBox(
          height: 160,
          child: Center(child: Text('No data available')));
    }

    final sections = <PieChartSectionData>[];
    if (summary.cashSales > 0) {
      sections.add(PieChartSectionData(
        value: summary.cashSales,
        title: '${((summary.cashSales / total) * 100).toStringAsFixed(0)}%',
        color: Colors.blue[600]!,
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (summary.mobileSales > 0) {
      sections.add(PieChartSectionData(
        value: summary.mobileSales,
        title: '${((summary.mobileSales / total) * 100).toStringAsFixed(0)}%',
        color: Colors.green[600]!,
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (summary.cardSales > 0) {
      sections.add(PieChartSectionData(
        value: summary.cardSales,
        title: '${((summary.cardSales / total) * 100).toStringAsFixed(0)}%',
        color: Colors.orange[600]!,
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }

    return Column(
      children: [
        SizedBox(
          height: 160,
          child: PieChart(PieChartData(sections: sections, centerSpaceRadius: 40)),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 16,
          children: [
            if (summary.cashSales > 0)
              _Legend('Cash', Colors.blue[600]!, formatCurrency(summary.cashSales)),
            if (summary.mobileSales > 0)
              _Legend('Mobile/QR', Colors.green[600]!, formatCurrency(summary.mobileSales)),
            if (summary.cardSales > 0)
              _Legend('Card', Colors.orange[600]!, formatCurrency(summary.cardSales)),
          ],
        ),
      ],
    );
  }
}

class _Legend extends StatelessWidget {
  final String label;
  final Color color;
  final String value;
  const _Legend(this.label, this.color, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 10, height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 4),
      Text('$label: $value',
          style: const TextStyle(fontSize: 12)),
    ]);
  }
}
