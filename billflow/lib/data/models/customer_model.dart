import '../../core/utils/json_parse.dart';

class TopCustomer {
  final String phone;
  final String? name;
  final int orderCount;
  final double totalSpent;
  final String? lastOrderDate;
  final int loyaltyPoints;

  const TopCustomer({
    required this.phone,
    this.name,
    required this.orderCount,
    required this.totalSpent,
    this.lastOrderDate,
    required this.loyaltyPoints,
  });

  factory TopCustomer.fromJson(Map<String, dynamic> j) => TopCustomer(
        phone: j['customer_phone'] as String? ?? j['phone'] as String? ?? '',
        name: j['customer_name'] as String? ?? j['name'] as String?,
        orderCount: toInt(j['total_orders'] ?? j['order_count']),
        totalSpent: toDouble(j['total_spent']),
        lastOrderDate: j['last_order_date'] as String?,
        loyaltyPoints: toInt(j['loyalty_points']),
      );
}

class CancellationTracking {
  final int totalCancellations;
  final bool cooldownActive;
  final String? cooldownUntil;

  const CancellationTracking({
    required this.totalCancellations,
    required this.cooldownActive,
    this.cooldownUntil,
  });

  factory CancellationTracking.fromJson(Map<String, dynamic> j) =>
      CancellationTracking(
        totalCancellations: toInt(j['total_cancellations']),
        cooldownActive: j['cooldown_active'] as bool? ?? false,
        cooldownUntil: j['cooldown_until'] as String?,
      );
}

class TopItem {
  final String itemName;
  final double totalQty;
  final int orderCount;

  const TopItem({
    required this.itemName,
    required this.totalQty,
    required this.orderCount,
  });

  factory TopItem.fromJson(Map<String, dynamic> j) => TopItem(
        itemName: j['item_name'] as String? ?? '',
        totalQty: toDouble(j['total_qty']),
        orderCount: toInt(j['order_count']),
      );
}

class RecentOrder {
  final String tokenNumber;
  final String status;
  final double totalAmount;
  final String createdAt;

  const RecentOrder({
    required this.tokenNumber,
    required this.status,
    required this.totalAmount,
    required this.createdAt,
  });

  factory RecentOrder.fromJson(Map<String, dynamic> j) => RecentOrder(
        tokenNumber: j['token_number'] as String? ?? '',
        status: j['status'] as String? ?? '',
        totalAmount: toDouble(j['total_amount']),
        createdAt: j['created_at'] as String? ?? '',
      );
}

class CustomerInsights {
  final String phone;
  final String? name;
  final int totalOrders;
  final double totalSpent;
  final double avgOrderValue;
  final String? lastOrderDate;
  final int loyaltyPoints;
  final List<TopItem> topItems;
  final List<RecentOrder> recentOrders;
  final CancellationTracking? cancellationTracking;

  const CustomerInsights({
    required this.phone,
    this.name,
    required this.totalOrders,
    required this.totalSpent,
    required this.avgOrderValue,
    this.lastOrderDate,
    required this.loyaltyPoints,
    required this.topItems,
    required this.recentOrders,
    this.cancellationTracking,
  });

  factory CustomerInsights.fromJson(Map<String, dynamic> j) {
    final totalOrders = toInt(j['total_orders']);
    final totalSpent  = toDouble(j['total_spent']);
    return CustomerInsights(
      phone:         j['customer_phone'] as String? ?? j['phone'] as String? ?? '',
      name:          () { final n = j['customer_name'] as String? ?? j['name'] as String?; return (n == null || n.isEmpty) ? null : n; }(),
      totalOrders:   totalOrders,
      totalSpent:    totalSpent,
      avgOrderValue: totalOrders > 0 ? totalSpent / totalOrders : 0.0,
      lastOrderDate: j['last_order_date'] as String?,
      loyaltyPoints: toInt(j['loyalty_points']),
      topItems: (j['top_items'] as List<dynamic>?)
              ?.map((e) => TopItem.fromJson(e as Map<String, dynamic>))
              .toList() ?? [],
      recentOrders: (j['recent_orders'] as List<dynamic>?)
              ?.map((e) => RecentOrder.fromJson(e as Map<String, dynamic>))
              .toList() ?? [],
      cancellationTracking: j['cancellation_tracking'] != null
          ? CancellationTracking.fromJson(j['cancellation_tracking'] as Map<String, dynamic>)
          : null,
    );
  }
}
