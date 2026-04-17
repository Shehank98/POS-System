class ProductModel {
  final int id;
  final int shopId;
  final String name;
  final String? barcode;
  final double price;
  final double costPrice;
  final double stockQuantity;
  final bool hasInventory;
  final String? category;
  final double taxRate;
  final String unitType;
  final DateTime? createdAt;

  const ProductModel({
    required this.id,
    required this.shopId,
    required this.name,
    this.barcode,
    required this.price,
    required this.costPrice,
    required this.stockQuantity,
    required this.hasInventory,
    this.category,
    required this.taxRate,
    required this.unitType,
    this.createdAt,
  });

  bool get isLowStock => hasInventory && stockQuantity <= 10 && stockQuantity > 0;
  bool get isOutOfStock => hasInventory && stockQuantity <= 0;

  factory ProductModel.fromJson(Map<String, dynamic> json) {
    return ProductModel(
      id: json['id'] as int,
      shopId: json['shop_id'] as int? ?? 0,
      name: json['name'] as String,
      barcode: json['barcode'] as String?,
      price: (json['price'] as num).toDouble(),
      costPrice: (json['cost_price'] as num?)?.toDouble() ?? 0.0,
      stockQuantity: (json['stock_quantity'] as num?)?.toDouble() ?? 0.0,
      hasInventory: json['has_inventory'] as bool? ?? false,
      category: json['category'] as String?,
      taxRate: (json['tax_rate'] as num?)?.toDouble() ?? 0.0,
      unitType: json['unit_type'] as String? ?? 'unit',
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'shop_id': shopId,
        'name': name,
        'barcode': barcode,
        'price': price,
        'cost_price': costPrice,
        'stock_quantity': stockQuantity,
        'has_inventory': hasInventory,
        'category': category,
        'tax_rate': taxRate,
        'unit_type': unitType,
      };

  ProductModel copyWith({
    int? id,
    int? shopId,
    String? name,
    String? barcode,
    double? price,
    double? costPrice,
    double? stockQuantity,
    bool? hasInventory,
    String? category,
    double? taxRate,
    String? unitType,
  }) {
    return ProductModel(
      id: id ?? this.id,
      shopId: shopId ?? this.shopId,
      name: name ?? this.name,
      barcode: barcode ?? this.barcode,
      price: price ?? this.price,
      costPrice: costPrice ?? this.costPrice,
      stockQuantity: stockQuantity ?? this.stockQuantity,
      hasInventory: hasInventory ?? this.hasInventory,
      category: category ?? this.category,
      taxRate: taxRate ?? this.taxRate,
      unitType: unitType ?? this.unitType,
      createdAt: createdAt,
    );
  }
}
