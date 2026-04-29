double _d(dynamic v) => v == null ? 0.0 : double.tryParse(v.toString()) ?? 0.0;
int _i(dynamic v) => v == null ? 0 : int.tryParse(v.toString()) ?? 0;

class TaxReportDay {
  final String date;
  final double taxCollected;
  final double revenue;
  final int transactions;

  const TaxReportDay({
    required this.date,
    required this.taxCollected,
    required this.revenue,
    required this.transactions,
  });

  factory TaxReportDay.fromJson(Map<String, dynamic> json) => TaxReportDay(
        date:         json['date'] as String? ?? '',
        taxCollected: _d(json['tax_collected']),
        revenue:      _d(json['revenue']),
        transactions: _i(json['transactions']),
      );
}

class TaxReportByRate {
  final double taxRate;
  final double taxCollected;
  final double revenue;

  const TaxReportByRate({
    required this.taxRate,
    required this.taxCollected,
    required this.revenue,
  });

  factory TaxReportByRate.fromJson(Map<String, dynamic> json) => TaxReportByRate(
        taxRate:      _d(json['tax_rate']),
        taxCollected: _d(json['tax_collected']),
        revenue:      _d(json['revenue']),
      );
}

class TaxReport {
  final String startDate;
  final String endDate;
  final double totalTax;
  final double totalRevenue;
  final List<TaxReportDay> byDay;
  final List<TaxReportByRate> byRate;

  const TaxReport({
    required this.startDate,
    required this.endDate,
    required this.totalTax,
    required this.totalRevenue,
    required this.byDay,
    required this.byRate,
  });

  factory TaxReport.fromJson(Map<String, dynamic> json) {
    final period  = json['period']  as Map<String, dynamic>? ?? {};
    final summary = json['summary'] as Map<String, dynamic>? ?? {};
    return TaxReport(
      startDate:    period['start'] as String? ?? '',
      endDate:      period['end']   as String? ?? '',
      totalTax:     _d(summary['total_tax']),
      totalRevenue: _d(summary['total_revenue']),
      byDay: (json['by_day'] as List<dynamic>?)
              ?.map((e) => TaxReportDay.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      byRate: (json['by_rate'] as List<dynamic>?)
              ?.map((e) => TaxReportByRate.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}
