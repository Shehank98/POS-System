import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/cart_item_model.dart';
import '../data/models/clothing_model.dart';
import '../data/models/product_model.dart';

class CartState {
  final List<CartItem> items;
  final double orderDiscount;
  final String paymentMethod;
  final String? customerPhone;

  const CartState({
    this.items = const [],
    this.orderDiscount = 0.0,
    this.paymentMethod = 'cash',
    this.customerPhone,
  });

  double get subtotal =>
      items.fold(0.0, (sum, item) => sum + item.subtotal);
  double get taxAmount =>
      items.fold(0.0, (sum, item) => sum + item.taxAmount);
  double get total => subtotal + taxAmount - orderDiscount;
  // kg items count as 1 each; unit items count by integer quantity
  int get itemCount => items.fold(0, (s, i) =>
      s + (i.product.unitType == 'kg' ? 1 : i.quantity.toInt().clamp(1, 9999)));
  bool get isEmpty => items.isEmpty;

  CartState copyWith({
    List<CartItem>? items,
    double? orderDiscount,
    String? paymentMethod,
    String? customerPhone,
  }) {
    return CartState(
      items: items ?? this.items,
      orderDiscount: orderDiscount ?? this.orderDiscount,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      customerPhone: customerPhone ?? this.customerPhone,
    );
  }

  static CartState empty() => const CartState();
}

class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(CartState.empty());

  void addProduct(ProductModel product, {double qty = 1.0}) {
    final existing = state.items.indexWhere((i) => i.product.id == product.id);
    if (existing >= 0) {
      final updated = List<CartItem>.from(state.items);
      updated[existing] = updated[existing]
          .copyWith(quantity: updated[existing].quantity + qty);
      state = state.copyWith(items: updated);
    } else {
      state = state.copyWith(
          items: [...state.items, CartItem(product: product, quantity: qty)]);
    }
  }

  void removeItem(int productId) {
    state = state.copyWith(
        items: state.items.where((i) => i.product.id != productId).toList());
  }

  void updateQuantity(int productId, double qty) {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    state = state.copyWith(
        items: state.items
            .map((i) =>
                i.product.id == productId ? i.copyWith(quantity: qty) : i)
            .toList());
  }

  void updateItemDiscount(int productId, double discount) {
    state = state.copyWith(
        items: state.items
            .map((i) => i.product.id == productId
                ? i.copyWith(itemDiscount: discount)
                : i)
            .toList());
  }

  void setOrderDiscount(double discount) =>
      state = state.copyWith(orderDiscount: discount);

  void setPaymentMethod(String method) =>
      state = state.copyWith(paymentMethod: method);

  void setCustomerPhone(String? phone) =>
      state = state.copyWith(customerPhone: phone);

  // Add a clothing variant as a cart item.
  // Uses negative IDs (-variantId) to prevent collision with regular product IDs.
  void addClothingVariant(ClothingProduct clothingProduct, ClothingVariant variant) {
    final existing =
        state.items.indexWhere((i) => i.clothingVariantId == variant.id);
    if (existing >= 0) {
      final updated = List<CartItem>.from(state.items);
      updated[existing] =
          updated[existing].copyWith(quantity: updated[existing].quantity + 1);
      state = state.copyWith(items: updated);
    } else {
      final pseudo = ProductModel(
        id: -variant.id,
        shopId: 0,
        name:
            '${clothingProduct.name} · ${variant.size} / ${variant.color}',
        barcode: variant.barcode ?? variant.sku,
        price: variant.effectivePrice,
        costPrice: 0,
        stockQuantity: variant.stockQuantity.toDouble(),
        hasInventory: true,
        category: clothingProduct.category,
        taxRate: clothingProduct.taxRate ?? 0,
        unitType: 'unit',
      );
      state = state.copyWith(items: [
        ...state.items,
        CartItem(
            product: pseudo,
            quantity: 1,
            clothingVariantId: variant.id),
      ]);
    }
  }

  void clearCart() => state = CartState.empty();
}

final cartProvider =
    StateNotifierProvider<CartNotifier, CartState>((ref) => CartNotifier());
