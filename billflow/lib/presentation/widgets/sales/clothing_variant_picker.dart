import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/clothing_model.dart';
import '../../../providers/clothing_provider.dart';

// Shows a bottom sheet with size×color grid for a clothing product.
// Calls [onVariantSelected] with the chosen variant.
void showClothingVariantPicker({
  required BuildContext context,
  required ClothingProduct product,
  required void Function(ClothingVariant variant) onVariantSelected,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => ProviderScope(
      child: _VariantPickerSheet(
        product: product,
        onVariantSelected: onVariantSelected,
      ),
    ),
  );
}

class _VariantPickerSheet extends ConsumerStatefulWidget {
  final ClothingProduct product;
  final void Function(ClothingVariant) onVariantSelected;

  const _VariantPickerSheet({
    required this.product,
    required this.onVariantSelected,
  });

  @override
  ConsumerState<_VariantPickerSheet> createState() =>
      _VariantPickerSheetState();
}

class _VariantPickerSheetState extends ConsumerState<_VariantPickerSheet> {
  String? _selectedSize;
  String? _selectedColor;

  List<String> get _sizes => widget.product.availableSizes;
  List<String> get _colors => widget.product.availableColors;

  ClothingVariant? get _matchedVariant {
    if (_selectedSize == null || _selectedColor == null) return null;
    try {
      return widget.product.variants.firstWhere(
        (v) => v.size == _selectedSize && v.color == _selectedColor,
      );
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final variantsAsync =
        ref.watch(clothingVariantsProvider(widget.product.id));
    final cs = Theme.of(context).colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.5,
      maxChildSize: 0.92,
      builder: (context, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: variantsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text(e.toString())),
          data: (variants) {
            // Merge fresh variants into the product for accurate stock
            final product = ClothingProduct(
              id: widget.product.id,
              name: widget.product.name,
              category: widget.product.category,
              basePrice: widget.product.basePrice,
              isActive: widget.product.isActive,
              isClearance: widget.product.isClearance,
              taxRate: widget.product.taxRate,
              variants: variants.isNotEmpty ? variants : widget.product.variants,
            );
            final sizes = product.availableSizes;
            final colors = product.availableColors;

            return Column(
              children: [
                // Drag handle
                Container(
                  margin: const EdgeInsets.only(top: 10, bottom: 4),
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: cs.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),

                // Header
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(product.name,
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 17)),
                            if (product.category != null)
                              Text(product.category!,
                                  style: TextStyle(
                                      fontSize: 13,
                                      color: cs.onSurfaceVariant)),
                          ],
                        ),
                      ),
                      Text(
                        'Rs. ${formatNumber(product.basePrice)}',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: cs.primary),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),

                Expanded(
                  child: ListView(
                    controller: scrollCtrl,
                    padding: const EdgeInsets.all(16),
                    children: [
                      // Size selection
                      Text('Select Size',
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                              color: cs.onSurfaceVariant)),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: sizes.map((size) {
                          final selected = _selectedSize == size;
                          // Check if any variant with this size has stock
                          final hasStock = product.variants.any((v) =>
                              v.size == size && v.stockQuantity > 0 && v.isActive);
                          return GestureDetector(
                            onTap: hasStock
                                ? () => setState(() {
                                      _selectedSize = size;
                                      _selectedColor = null;
                                    })
                                : null,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 18, vertical: 10),
                              decoration: BoxDecoration(
                                color: !hasStock
                                    ? cs.surfaceContainerLowest
                                    : selected
                                        ? cs.primary
                                        : cs.surfaceContainerLow,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: selected
                                      ? cs.primary
                                      : cs.outlineVariant,
                                ),
                              ),
                              child: Text(
                                size,
                                style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: !hasStock
                                      ? Colors.grey
                                      : selected
                                          ? Colors.white
                                          : cs.onSurface,
                                  decoration: !hasStock
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),

                      if (_selectedSize != null) ...[
                        const SizedBox(height: 20),
                        Text('Select Color',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: cs.onSurfaceVariant)),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: colors.map((color) {
                            final selected = _selectedColor == color;
                            final variant = product.variants
                                .where((v) =>
                                    v.size == _selectedSize &&
                                    v.color == color &&
                                    v.isActive)
                                .firstOrNull;
                            final hasStock =
                                (variant?.stockQuantity ?? 0) > 0;
                            return GestureDetector(
                              onTap: hasStock
                                  ? () =>
                                      setState(() => _selectedColor = color)
                                  : null,
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                                decoration: BoxDecoration(
                                  color: !hasStock
                                      ? cs.surfaceContainerLowest
                                      : selected
                                          ? cs.primaryContainer
                                          : cs.surfaceContainerLow,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: selected
                                        ? cs.primary
                                        : cs.outlineVariant,
                                    width: selected ? 2 : 1,
                                  ),
                                ),
                                child: Column(
                                  children: [
                                    Text(
                                      color,
                                      style: TextStyle(
                                        fontWeight: FontWeight.w600,
                                        color: !hasStock
                                            ? Colors.grey
                                            : selected
                                                ? cs.onPrimaryContainer
                                                : cs.onSurface,
                                        decoration: !hasStock
                                            ? TextDecoration.lineThrough
                                            : null,
                                      ),
                                    ),
                                    if (variant != null && hasStock)
                                      Text(
                                        '${variant.stockQuantity} left',
                                        style: TextStyle(
                                            fontSize: 10,
                                            color: variant.isLowStock
                                                ? Colors.orange
                                                : cs.onSurfaceVariant),
                                      ),
                                  ],
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],

                      // Selected variant summary
                      if (_matchedVariant != null) ...[
                        const SizedBox(height: 20),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: cs.primaryContainer.withOpacity(0.3),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                                color: cs.primary.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.check_circle_outline,
                                  color: AppColors.success),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${_matchedVariant!.size} / ${_matchedVariant!.color}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14),
                                    ),
                                    Text(
                                      'SKU: ${_matchedVariant!.sku}  •  ${_matchedVariant!.stockQuantity} in stock',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: cs.onSurfaceVariant),
                                    ),
                                  ],
                                ),
                              ),
                              Text(
                                'Rs. ${formatNumber(_matchedVariant!.effectivePrice)}',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                    color: cs.primary),
                              ),
                            ],
                          ),
                        ),
                      ],

                      const SizedBox(height: 80), // space for FAB
                    ],
                  ),
                ),

                // Add to Cart button
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      16,
                      8,
                      16,
                      MediaQuery.of(context).viewInsets.bottom + 16),
                  child: FilledButton.icon(
                    onPressed: _matchedVariant == null ||
                            _matchedVariant!.isOutOfStock
                        ? null
                        : () {
                            widget.onVariantSelected(_matchedVariant!);
                            Navigator.pop(context);
                          },
                    icon: const Icon(Icons.add_shopping_cart),
                    label: Text(
                      _matchedVariant == null
                          ? 'Select size and color'
                          : _matchedVariant!.isOutOfStock
                              ? 'Out of Stock'
                              : 'Add to Cart — Rs. ${formatNumber(_matchedVariant!.effectivePrice)}',
                      style: const TextStyle(
                          fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.accent,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 52),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
