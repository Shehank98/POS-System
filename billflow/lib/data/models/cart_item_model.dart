import 'product_model.dart';

class CartItem {
  final ProductModel product;
  final double quantity;
  final double itemDiscount;

  const CartItem({
    required this.product,
    required this.quantity,
    this.itemDiscount = 0.0,
  });

  double get subtotalBeforeDiscount => product.price * quantity;
  double get subtotal => subtotalBeforeDiscount - itemDiscount;
  double get taxAmount => subtotal * (product.taxRate / 100);

  CartItem copyWith({double? quantity, double? itemDiscount}) {
    return CartItem(
      product: product,
      quantity: quantity ?? this.quantity,
      itemDiscount: itemDiscount ?? this.itemDiscount,
    );
  }

  Map<String, dynamic> toApiJson() => {
        'product_id': product.id,
        'quantity': quantity,
        'unit_price': product.price,
        'discount': itemDiscount,
      };
}
