import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/dashboard_model.dart';

class RevenueBarChart extends StatelessWidget {
  final List<DailyPoint> data;

  const RevenueBarChart({super.key, required this.data});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    if (data.isEmpty) {
      return const SizedBox(
          height: 160,
          child: Center(child: Text('No data available')));
    }

    final maxY = data.fold(0.0, (m, d) => d.sales > m ? d.sales : m);
    final bars = data.asMap().entries.map((e) {
      final isToday = e.key == data.length - 1;
      return BarChartGroupData(
        x: e.key,
        barRods: [
          BarChartRodData(
            toY: e.value.sales,
            color: isToday ? cs.primary : cs.primary.withOpacity(0.4),
            width: 20,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(6)),
          ),
        ],
      );
    }).toList();

    return SizedBox(
      height: 180,
      child: BarChart(
        BarChartData(
          maxY: maxY * 1.2,
          barGroups: bars,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (v) =>
                FlLine(color: cs.outlineVariant.withOpacity(0.5), strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= data.length) return const SizedBox.shrink();
                  final day = data[idx].day;
                  final label = day.length >= 3 ? day.substring(0, 3) : day;
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(label,
                        style: TextStyle(
                            fontSize: 10, color: cs.onSurfaceVariant)),
                  );
                },
              ),
            ),
          ),
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipItem: (group, _, rod, __) => BarTooltipItem(
                formatCurrency(rod.toY),
                TextStyle(
                    color: cs.onPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 12),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
