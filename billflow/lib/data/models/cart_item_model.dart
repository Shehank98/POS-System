import 'product_model.dart';

class CartItem {
  final ProductModel product;
  final double quantity;
  final double itemDiscount;
  // Non-null when item is a clothing variant (uses clothing_variant_id in API payload)
  final int? clothingVariantId;

  const CartItem({
    required this.product,
    required this.quantity,
    this.itemDiscount = 0.0,
    this.clothingVariantId,
  });

  double get subtotalBeforeDiscount => product.price * quantity;
  double get subtotal => subtotalBeforeDiscount - itemDiscount;
  double get taxAmount => subtotal * (product.taxRate / 100);

  CartItem copyWith({double? quantity, double? itemDiscount}) {
    return CartItem(
      product: product,
      quantity: quantity ?? this.quantity,
      itemDiscount: itemDiscount ?? this.itemDiscount,
      clothingVariantId: clothingVariantId,
    );
  }

  Map<String, dynamic> toApiJson() {
    if (clothingVariantId != null) {
      return {
        'clothing_variant_id': clothingVariantId,
        'quantity': quantity,
        'unit_price': product.price,
        'discount': itemDiscount,
      };
    }
    return {
      'product_id': product.id,
      'quantity': quantity,
      'unit_price': product.price,
      'discount': itemDiscount,
    };
  }
}
