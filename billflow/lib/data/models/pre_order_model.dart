import '../../core/utils/json_parse.dart';

class PreOrderItem {
  final String name;
  final int qty;
  final double price;

  const PreOrderItem({
    required this.name,
    required this.qty,
    required this.price,
  });

  factory PreOrderItem.fromJson(Map<String, dynamic> json) => PreOrderItem(
        name: json['name'] as String? ?? '',
        qty: toInt(json['qty'] ?? json['quantity'] ?? 1),
        price: toDouble(json['price']),
      );
}

class PreOrderModel {
  final int id;
  final String tokenNumber;
  final String customerPhone;
  final String? customerName;
  final List<PreOrderItem> items;
  final double totalAmount;
  final String status;
  final String paymentStatus;
  final DateTime createdAt;

  const PreOrderModel({
    required this.id,
    required this.tokenNumber,
    required this.customerPhone,
    this.customerName,
    required this.items,
    required this.totalAmount,
    required this.status,
    required this.paymentStatus,
    required this.createdAt,
  });

  factory PreOrderModel.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    List<PreOrderItem> items = [];
    if (rawItems is List) {
      items = rawItems
          .whereType<Map<String, dynamic>>()
          .map(PreOrderItem.fromJson)
          .toList();
    }
    return PreOrderModel(
      id: toInt(json['id']),
      tokenNumber: json['token_number'] as String? ?? '',
      customerPhone: json['customer_phone'] as String? ?? '',
      customerName: json['customer_name'] as String?,
      items: items,
      totalAmount: toDouble(json['total_amount']),
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      paymentStatus:
          (json['payment_status'] as String? ?? 'pending').toLowerCase(),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}
