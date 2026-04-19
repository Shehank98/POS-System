import '../../core/utils/json_parse.dart';

class TransactionItem {
  final int id;
  final int transactionId;
  final int? productId;
  final double quantity;
  final double unitPrice;
  final double discount;
  final double subtotal;
  final String? productName;

  const TransactionItem({
    required this.id,
    required this.transactionId,
    this.productId,
    required this.quantity,
    required this.unitPrice,
    required this.discount,
    required this.subtotal,
    this.productName,
  });

  factory TransactionItem.fromJson(Map<String, dynamic> json) {
    return TransactionItem(
      id: toInt(json['id']),
      transactionId: toInt(json['transaction_id']),
      productId: json['product_id'] != null ? toInt(json['product_id']) : null,
      quantity: toDouble(json['quantity']),
      unitPrice: toDouble(json['unit_price']),
      discount: toDouble(json['discount']),
      subtotal: toDouble(json['subtotal']),
      productName: json['product_name'] as String? ?? json['name'] as String?,
    );
  }
}

class TransactionModel {
  final int id;
  final String transactionNumber;
  final double totalAmount;
  final double taxAmount;
  final double discountAmount;
  final String paymentMethod;
  final String status;
  final DateTime transactionDate;
  final String? cashier;
  final List<TransactionItem>? items;

  const TransactionModel({
    required this.id,
    required this.transactionNumber,
    required this.totalAmount,
    required this.taxAmount,
    required this.discountAmount,
    required this.paymentMethod,
    required this.status,
    required this.transactionDate,
    this.cashier,
    this.items,
  });

  bool get isCompleted => status == 'completed';
  bool get isVoided => status == 'void';
  bool get isRefunded => status == 'refunded';

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      id: toInt(json['id']),
      transactionNumber: json['transaction_number'] as String? ?? '#${json['id']}',
      totalAmount: toDouble(json['total_amount']),
      taxAmount: toDouble(json['tax_amount']),
      discountAmount: toDouble(json['discount_amount']),
      paymentMethod: json['payment_method'] as String? ?? 'cash',
      status: json['status'] as String? ?? 'completed',
      transactionDate: DateTime.parse(json['transaction_date'] as String),
      cashier: json['cashier'] as String? ?? json['username'] as String?,
      items: (json['items'] as List<dynamic>?)
          ?.map((e) => TransactionItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class TransactionSummary {
  final int totalTransactions;
  final double totalRevenue;
  final double totalTax;
  final double totalDiscounts;
  final int voidedTransactions;
  final int refundTransactions;
  final double totalRefunds;
  final double netRevenue;
  final int cashCount;
  final int cardCount;
  final int mobileCount;

  const TransactionSummary({
    required this.totalTransactions,
    required this.totalRevenue,
    required this.totalTax,
    required this.totalDiscounts,
    required this.voidedTransactions,
    required this.refundTransactions,
    required this.totalRefunds,
    required this.netRevenue,
    required this.cashCount,
    required this.cardCount,
    required this.mobileCount,
  });

  factory TransactionSummary.fromJson(Map<String, dynamic> json) {
    return TransactionSummary(
      totalTransactions: toInt(json['total_transactions']),
      totalRevenue: toDouble(json['total_revenue']),
      totalTax: toDouble(json['total_tax']),
      totalDiscounts: toDouble(json['total_discounts']),
      voidedTransactions: toInt(json['voided_transactions']),
      refundTransactions: toInt(json['refund_transactions']),
      totalRefunds: toDouble(json['total_refunds']),
      netRevenue: toDouble(json['net_revenue']),
      cashCount: toInt(json['cash_count']),
      cardCount: toInt(json['card_count']),
      mobileCount: toInt(json['mobile_count']),
    );
  }
}
