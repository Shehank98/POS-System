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
      transactionCount: int.tryParse(json['transaction_count']?.toString() ?? '0') ?? 0,
      totalSales: (json['total_sales'] as num?)?.toDouble() ?? 0.0,
      totalTax: (json['total_tax'] as num?)?.toDouble() ?? 0.0,
      totalDiscounts: (json['total_discounts'] as num?)?.toDouble() ?? 0.0,
      totalRefunds: (json['total_refunds'] as num?)?.toDouble() ?? 0.0,
      netSales: (json['net_sales'] as num?)?.toDouble() ?? 0.0,
      cashSales: (json['cash_sales'] as num?)?.toDouble() ?? 0.0,
      cardSales: (json['card_sales'] as num?)?.toDouble() ?? 0.0,
      mobileSales: (json['mobile_sales'] as num?)?.toDouble() ?? 0.0,
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
      qtySold: (json['qty_sold'] as num?)?.toDouble() ?? 0.0,
      revenue: (json['revenue'] as num?)?.toDouble() ?? 0.0,
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
      hour: (json['hour'] as num).toInt(),
      sales: (json['sales'] as num?)?.toDouble() ?? 0.0,
      count: int.tryParse(json['count']?.toString() ?? '0') ?? 0,
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
      sales: (json['sales'] as num?)?.toDouble() ?? 0.0,
      transactions: int.tryParse(json['transactions']?.toString() ?? '0') ?? 0,
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
      itemsSold: (json['items_sold'] as num?)?.toDouble() ?? 0.0,
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
      id: json['id'] as int,
      name: json['name'] as String,
      stockQuantity: (json['stock_quantity'] as num?)?.toDouble() ?? 0.0,
      category: json['category'] as String?,
      unitType: json['unit_type'] as String? ?? 'unit',
    );
  }
}
