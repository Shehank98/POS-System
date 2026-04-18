import '../../core/utils/json_parse.dart';

class ClothingVariant {
  final int id;
  final int productId;
  final String size;
  final String color;
  final String sku;
  final String? barcode;
  final double? priceOverride;
  final double effectivePrice;
  final int stockQuantity;
  final bool isActive;

  const ClothingVariant({
    required this.id,
    required this.productId,
    required this.size,
    required this.color,
    required this.sku,
    this.barcode,
    this.priceOverride,
    required this.effectivePrice,
    required this.stockQuantity,
    required this.isActive,
  });

  bool get isOutOfStock => stockQuantity <= 0;
  bool get isLowStock => stockQuantity > 0 && stockQuantity <= 5;

  factory ClothingVariant.fromJson(Map<String, dynamic> j) => ClothingVariant(
        id: toInt(j['id']),
        productId: toInt(j['product_id']),
        size: j['size'] as String? ?? '',
        color: j['color'] as String? ?? '',
        sku: j['sku'] as String? ?? '',
        barcode: j['barcode'] as String?,
        priceOverride: j['price_override'] != null
            ? toDouble(j['price_override'])
            : null,
        effectivePrice: toDouble(j['effective_price'] ?? j['price_override'] ?? 0),
        stockQuantity: toInt(j['stock_quantity']),
        isActive: j['is_active'] as bool? ?? true,
      );
}

class ClothingProduct {
  final int id;
  final String name;
  final String? category;
  final double basePrice;
  final String? description;
  final bool isActive;
  final bool isClearance;
  final double? taxRate;
  final List<ClothingVariant> variants;

  const ClothingProduct({
    required this.id,
    required this.name,
    this.category,
    required this.basePrice,
    this.description,
    required this.isActive,
    required this.isClearance,
    this.taxRate,
    this.variants = const [],
  });

  int get totalStock =>
      variants.fold(0, (s, v) => s + v.stockQuantity);

  List<String> get availableSizes =>
      variants.map((v) => v.size).toSet().toList()..sort();

  List<String> get availableColors =>
      variants.map((v) => v.color).toSet().toList()..sort();

  factory ClothingProduct.fromJson(Map<String, dynamic> j) => ClothingProduct(
        id: toInt(j['id']),
        name: j['name'] as String? ?? '',
        category: j['category'] as String?,
        basePrice: toDouble(j['base_price']),
        description: j['description'] as String?,
        isActive: j['is_active'] as bool? ?? true,
        isClearance: j['is_clearance'] as bool? ?? false,
        taxRate: j['tax_rate'] != null ? toDouble(j['tax_rate']) : null,
        variants: (j['variants'] as List<dynamic>?)
                ?.map((e) => ClothingVariant.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class ClothingListResult {
  final List<ClothingProduct> products;
  final int total;

  const ClothingListResult({required this.products, required this.total});

  factory ClothingListResult.fromJson(Map<String, dynamic> j) =>
      ClothingListResult(
        products: (j['products'] as List<dynamic>?)
                ?.map((e) =>
                    ClothingProduct.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
        total: toInt(j['total']),
      );
}

class ClothingExchangeLookup {
  final int id;
  final String transactionNumber;
  final String transactionDate;
  final double totalAmount;
  final List<ExchangeItem> items;

  const ClothingExchangeLookup({
    required this.id,
    required this.transactionNumber,
    required this.transactionDate,
    required this.totalAmount,
    required this.items,
  });

  factory ClothingExchangeLookup.fromJson(Map<String, dynamic> j) =>
      ClothingExchangeLookup(
        id: toInt(j['id']),
        transactionNumber: j['transaction_number'] as String? ?? '',
        transactionDate: j['transaction_date'] as String? ?? '',
        totalAmount: toDouble(j['total_amount']),
        items: (j['items'] as List<dynamic>?)
                ?.map((e) => ExchangeItem.fromJson(e as Map<String, dynamic>))
                .toList() ??
            [],
      );
}

class ExchangeItem {
  final int id;
  final int clothingVariantId;
  final String productName;
  final String size;
  final String color;
  final String sku;
  final int quantity;
  final double unitPrice;

  const ExchangeItem({
    required this.id,
    required this.clothingVariantId,
    required this.productName,
    required this.size,
    required this.color,
    required this.sku,
    required this.quantity,
    required this.unitPrice,
  });

  factory ExchangeItem.fromJson(Map<String, dynamic> j) => ExchangeItem(
        id: toInt(j['id']),
        clothingVariantId: toInt(j['clothing_variant_id']),
        productName: j['product_name'] as String? ?? '',
        size: j['size'] as String? ?? '',
        color: j['color'] as String? ?? '',
        sku: j['sku'] as String? ?? '',
        quantity: toInt(j['quantity']),
        unitPrice: toDouble(j['unit_price']),
      );
}
