import '../../core/utils/json_parse.dart';

class DashboardSummary {
  final int transactionCount;
  final double totalSales;
  final double totalTax;
  final double totalDiscounts;
  final double totalRefunds;
  final double netSales;
  final double cashSales;
  final double cardSales;
  final double mobileSales;

  const DashboardSummary({
    required this.transactionCount,
    required this.totalSales,
    required this.totalTax,
    required this.totalDiscounts,
    required this.totalRefunds,
    required this.netSales,
    required this.cashSales,
    required this.cardSales,
    required this.mobileSales,
  });

  factory DashboardSummary.fromJson(Map<String, dynamic> json) {
    return DashboardSummary(
      transactionCount: toInt(json['transaction_count']),
      totalSales: toDouble(json['total_sales']),
      totalTax: toDouble(json['total_tax']),
      totalDiscounts: toDouble(json['total_discounts']),
      totalRefunds: toDouble(json['total_refunds']),
      netSales: toDouble(json['net_sales']),
      cashSales: toDouble(json['cash_sales']),
      cardSales: toDouble(json['card_sales']),
      mobileSales: toDouble(json['mobile_sales']),
    );
  }

  factory DashboardSummary.empty() => const DashboardSummary(
        transactionCount: 0,
        totalSales: 0,
        totalTax: 0,
        totalDiscounts: 0,
        totalRefunds: 0,
        netSales: 0,
        cashSales: 0,
        cardSales: 0,
        mobileSales: 0,
      );
}

class TopProduct {
  final String name;
  final double qtySold;
  final double revenue;

  const TopProduct({
    required this.name,
    required this.qtySold,
    required this.revenue,
  });

  factory TopProduct.fromJson(Map<String, dynamic> json) {
    return TopProduct(
      name: json['name'] as String,
      qtySold: toDouble(json['qty_sold']),
      revenue: toDouble(json['revenue']),
    );
  }
}

class HourlyPoint {
  final int hour;
  final double sales;
  final int count;

  const HourlyPoint({
    required this.hour,
    required this.sales,
    required this.count,
  });

  factory HourlyPoint.fromJson(Map<String, dynamic> json) {
    return HourlyPoint(
      hour: toInt(json['hour']),
      sales: toDouble(json['sales']),
      count: toInt(json['count']),
    );
  }
}

class DailyPoint {
  final String day;
  final double sales;
  final int transactions;

  const DailyPoint({
    required this.day,
    required this.sales,
    required this.transactions,
  });

  factory DailyPoint.fromJson(Map<String, dynamic> json) {
    return DailyPoint(
      day: json['day'] as String? ?? json['date'] as String? ?? '',
      sales: toDouble(json['sales']),
      transactions: toInt(json['transactions']),
    );
  }
}

class DashboardToday {
  final DashboardSummary summary;
  final double itemsSold;
  final List<TopProduct> topProducts;
  final List<HourlyPoint> hourly;

  const DashboardToday({
    required this.summary,
    required this.itemsSold,
    required this.topProducts,
    required this.hourly,
  });

  factory DashboardToday.fromJson(Map<String, dynamic> json) {
    return DashboardToday(
      summary: DashboardSummary.fromJson(json['summary'] as Map<String, dynamic>),
      itemsSold: toDouble(json['items_sold']),
      topProducts: (json['top_products'] as List<dynamic>?)
              ?.map((e) => TopProduct.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      hourly: (json['hourly'] as List<dynamic>?)
              ?.map((e) => HourlyPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class AnalyticsResult {
  final DashboardSummary summary;
  final List<TopProduct> topProducts;
  final List<DailyPoint> daily;

  const AnalyticsResult({
    required this.summary,
    required this.topProducts,
    required this.daily,
  });

  factory AnalyticsResult.fromJson(Map<String, dynamic> json) =>
      AnalyticsResult(
        summary: json['summary'] != null
            ? DashboardSummary.fromJson(
                json['summary'] as Map<String, dynamic>)
            : DashboardSummary.empty(),
        topProducts: (json['top_products'] as List<dynamic>?)
                ?.map((e) => TopProduct.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        daily: (json['daily'] as List<dynamic>?)
                ?.map((e) => DailyPoint.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class LowStockProduct {
  final int id;
  final String name;
  final double stockQuantity;
  final String? category;
  final String unitType;

  const LowStockProduct({
    required this.id,
    required this.name,
    required this.stockQuantity,
    this.category,
    required this.unitType,
  });

  factory LowStockProduct.fromJson(Map<String, dynamic> json) {
    return LowStockProduct(
      id: toInt(json['id']),
      name: json['name'] as String,
      stockQuantity: toDouble(json['stock_quantity']),
      category: json['category'] as String?,
      unitType: json['unit_type'] as String? ?? 'unit',
    );
  }
}
