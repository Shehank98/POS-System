import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/cart_item_model.dart';
import '../../../providers/cart_provider.dart';
import 'quantity_stepper.dart';

class CartItemTile extends ConsumerWidget {
  final CartItem item;

  const CartItemTile({super.key, required this.item});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;

    return Dismissible(
      key: ValueKey(item.product.id),
      direction: DismissDirection.endToStart,
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        color: cs.error,
        child: Icon(Icons.delete_outline, color: cs.onError),
      ),
      onDismissed: (_) =>
          ref.read(cartProvider.notifier).removeItem(item.product.id),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.product.name,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${formatCurrency(item.product.price)} each',
                    style: TextStyle(
                        fontSize: 12, color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            QuantityStepper(
              quantity: item.quantity,
              onChanged: (qty) => ref
                  .read(cartProvider.notifier)
                  .updateQuantity(item.product.id, qty),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 72,
              child: Text(
                formatCurrency(item.subtotal),
                textAlign: TextAlign.end,
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: cs.primary),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
