import 'package:flutter/material.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/product_model.dart';

// Compact product card optimised for one-hand POS use.
// 3-column grid, minimal height, tap anywhere to add to cart.
class PosProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback? onTap;

  const PosProductCard({super.key, required this.product, this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final outOfStock = product.isOutOfStock;
    final lowStock = product.isLowStock;

    final Color borderColor = outOfStock
        ? Colors.grey.shade300
        : lowStock
            ? Colors.orange.shade300
            : cs.outlineVariant;

    return GestureDetector(
      onTap: outOfStock ? null : onTap,
      child: AnimatedOpacity(
        opacity: outOfStock ? 0.45 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          decoration: BoxDecoration(
            color: outOfStock ? Colors.grey.shade50 : cs.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: borderColor),
            boxShadow: outOfStock
                ? null
                : [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 4,
                      offset: const Offset(0, 1),
                    ),
                  ],
          ),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // Name — up to 2 lines
              Text(
                product.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: outOfStock ? Colors.grey : cs.onSurface,
                  height: 1.3,
                ),
              ),
              const SizedBox(height: 4),
              // Price
              Text(
                formatCurrency(product.price),
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: outOfStock ? Colors.grey : cs.primary,
                ),
              ),
              const SizedBox(height: 4),
              // Stock indicator row
              Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: outOfStock
                          ? Colors.red
                          : lowStock
                              ? Colors.orange
                              : Colors.green,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      outOfStock
                          ? 'Out'
                          : lowStock
                              ? '${_stockLabel(product)} left'
                              : _stockLabel(product),
                      style: TextStyle(
                        fontSize: 10,
                        color: outOfStock
                            ? Colors.red
                            : lowStock
                                ? Colors.orange.shade800
                                : Colors.grey.shade600,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _stockLabel(ProductModel p) {
    if (!p.hasInventory) return 'In stock';
    final unit = p.unitType == 'kg' ? ' kg' : '';
    return '${formatNumber(p.stockQuantity)}$unit';
  }
}
