import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/product_model.dart';

class ProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback? onTap;
  final bool showAddButton;

  const ProductCard({
    super.key,
    required this.product,
    this.onTap,
    this.showAddButton = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Color stockColor;
    String stockLabel;
    final unit = product.unitType == 'kg' ? ' kg' : '';
    if (product.isOutOfStock) {
      stockColor = AppColors.outOfStock;
      stockLabel = 'Out of stock';
    } else if (product.isLowStock) {
      stockColor = AppColors.lowStock;
      stockLabel = 'Low: ${formatNumber(product.stockQuantity)}$unit';
    } else {
      stockColor = AppColors.inStock;
      stockLabel = product.hasInventory
          ? '${formatNumber(product.stockQuantity)}$unit'
          : 'Available';
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: cs.primaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.inventory_2_outlined,
                        color: cs.onPrimaryContainer, size: 22),
                  ),
                  const Spacer(),
                  if (product.category != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: cs.secondaryContainer,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        product.category!,
                        style: TextStyle(
                            fontSize: 10,
                            color: cs.onSecondaryContainer),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                product.name,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Text(
                formatCurrency(product.price),
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                    color: cs.primary),
              ),
              const Spacer(),
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: stockColor,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    stockLabel,
                    style: TextStyle(fontSize: 11, color: stockColor),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
