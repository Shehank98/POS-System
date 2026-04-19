import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../data/models/transaction_model.dart';

class PaymentPieChart extends StatelessWidget {
  final TransactionSummary summary;

  const PaymentPieChart({super.key, required this.summary});

  @override
  Widget build(BuildContext context) {
    final total = (summary.cashCount + summary.cardCount + summary.mobileCount).toDouble();
    if (total == 0) {
      return const SizedBox(
          height: 160,
          child: Center(child: Text('No data available')));
    }

    final sections = <PieChartSectionData>[];
    if (summary.cashCount > 0) {
      sections.add(PieChartSectionData(
        value: summary.cashCount.toDouble(),
        title: '${((summary.cashCount / total) * 100).toStringAsFixed(0)}%',
        color: Colors.blue[600]!,
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (summary.mobileCount > 0) {
      sections.add(PieChartSectionData(
        value: summary.mobileCount.toDouble(),
        title: '${((summary.mobileCount / total) * 100).toStringAsFixed(0)}%',
        color: Colors.green[600]!,
        radius: 60,
        titleStyle: const TextStyle(
            fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
      ));
    }
    if (summary.cardCount > 0) {
      sections.add(PieChartSectionData(
        value: summary.cardCount.toDouble(),
        title: '${((summary.cardCount / total) * 100).toStringAsFixed(0)}%',
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
            if (summary.cashCount > 0)
              _Legend('Cash', Colors.blue[600]!, '${summary.cashCount} txn'),
            if (summary.mobileCount > 0)
              _Legend('Mobile/QR', Colors.green[600]!, '${summary.mobileCount} txn'),
            if (summary.cardCount > 0)
              _Legend('Card', Colors.orange[600]!, '${summary.cardCount} txn'),
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
