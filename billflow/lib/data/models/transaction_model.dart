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
      id: json['id'] as int,
      transactionId: json['transaction_id'] as int,
      productId: json['product_id'] as int?,
      quantity: (json['quantity'] as num).toDouble(),
      unitPrice: (json['unit_price'] as num).toDouble(),
      discount: (json['discount'] as num?)?.toDouble() ?? 0.0,
      subtotal: (json['subtotal'] as num).toDouble(),
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
      id: json['id'] as int,
      transactionNumber: json['transaction_number'] as String? ?? '#${json['id']}',
      totalAmount: (json['total_amount'] as num).toDouble(),
      taxAmount: (json['tax_amount'] as num?)?.toDouble() ?? 0.0,
      discountAmount: (json['discount_amount'] as num?)?.toDouble() ?? 0.0,
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
      totalTransactions: int.tryParse(json['total_transactions']?.toString() ?? '0') ?? 0,
      totalRevenue: (json['total_revenue'] as num?)?.toDouble() ?? 0.0,
      totalTax: (json['total_tax'] as num?)?.toDouble() ?? 0.0,
      totalDiscounts: (json['total_discounts'] as num?)?.toDouble() ?? 0.0,
      voidedTransactions: int.tryParse(json['voided_transactions']?.toString() ?? '0') ?? 0,
      refundTransactions: int.tryParse(json['refund_transactions']?.toString() ?? '0') ?? 0,
      totalRefunds: (json['total_refunds'] as num?)?.toDouble() ?? 0.0,
      netRevenue: (json['net_revenue'] as num?)?.toDouble() ?? 0.0,
      cashCount: int.tryParse(json['cash_count']?.toString() ?? '0') ?? 0,
      cardCount: int.tryParse(json['card_count']?.toString() ?? '0') ?? 0,
      mobileCount: int.tryParse(json['mobile_count']?.toString() ?? '0') ?? 0,
    );
  }
}
