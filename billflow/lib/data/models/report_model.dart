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

  factory TaxReportDay.fromJson(Map<String, dynamic> json) {
    return TaxReportDay(
      date: json['date'] as String? ?? '',
      taxCollected: (json['tax_collected'] as num?)?.toDouble() ?? 0.0,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
      transactions: int.tryParse(json['transactions']?.toString() ?? '0') ?? 0,
    );
  }
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

  factory TaxReportByRate.fromJson(Map<String, dynamic> json) {
    return TaxReportByRate(
      taxRate: (json['tax_rate'] as num?)?.toDouble() ?? 0.0,
      taxCollected: (json['tax_collected'] as num?)?.toDouble() ?? 0.0,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
    );
  }
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
    final period = json['period'] as Map<String, dynamic>? ?? {};
    final summary = json['summary'] as Map<String, dynamic>? ?? {};
    return TaxReport(
      startDate: period['start'] as String? ?? '',
      endDate: period['end'] as String? ?? '',
      totalTax: (summary['total_tax'] as num?)?.toDouble() ?? 0.0,
      totalRevenue: (summary['total_revenue'] as num?)?.toDouble() ?? 0.0,
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
