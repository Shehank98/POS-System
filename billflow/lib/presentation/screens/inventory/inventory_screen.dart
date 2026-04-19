import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/product_model.dart';
import '../../../providers/product_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';

enum _StockFilter { all, low, out }

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  _StockFilter _filter = _StockFilter.all;

  List<ProductModel> _applyFilter(List<ProductModel> products) {
    return products.where((p) {
      if (!p.hasInventory) return _filter == _StockFilter.all;
      switch (_filter) {
        case _StockFilter.low:
          return p.isLowStock;
        case _StockFilter.out:
          return p.isOutOfStock;
        case _StockFilter.all:
          return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(productsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Inventory')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _FilterChip(
                    'All', _filter == _StockFilter.all,
                    () => setState(() => _filter = _StockFilter.all)),
                  const SizedBox(width: 8),
                  _FilterChip(
                    'Low Stock', _filter == _StockFilter.low,
                    () => setState(() => _filter = _StockFilter.low),
                    color: AppColors.lowStock),
                  const SizedBox(width: 8),
                  _FilterChip(
                    'Out of Stock', _filter == _StockFilter.out,
                    () => setState(() => _filter = _StockFilter.out),
                    color: AppColors.outOfStock),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(productsProvider.notifier).refresh(),
              child: productsAsync.when(
                loading: () => const LoadingOverlay(),
                error: (e, _) => ErrorView(
                    message: e.toString(),
                    onRetry: () =>
                        ref.read(productsProvider.notifier).refresh()),
                data: (all) {
                  final products = _applyFilter(all);
                  if (products.isEmpty) {
                    return const Center(
                        child: Text('No products in this category'));
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: products.length,
                    itemBuilder: (ctx, i) =>
                        _InventoryTile(product: products[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  final Color? color;

  const _FilterChip(this.label, this.selected, this.onTap, {this.color});

  @override
  Widget build(BuildContext context) {
    final c = color ?? Theme.of(context).colorScheme.primary;
    return FilterChip(
      label: Text(label),
      selected: selected,
      selectedColor: c.withOpacity(0.15),
      checkmarkColor: c,
      onSelected: (_) => onTap(),
    );
  }
}

class _InventoryTile extends StatelessWidget {
  final ProductModel product;
  const _InventoryTile({required this.product});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Color barColor;
    double barValue;
    String stockText;

    if (!product.hasInventory) {
      barColor = Colors.grey;
      barValue = 1.0;
      stockText = 'No tracking';
    } else if (product.isOutOfStock) {
      barColor = AppColors.outOfStock;
      barValue = 0.0;
      stockText = 'Out of stock';
    } else if (product.isLowStock) {
      barColor = AppColors.lowStock;
      barValue = (product.stockQuantity / 100).clamp(0.0, 1.0);
      stockText = '${formatNumber(product.stockQuantity)} ${product.unitType}';
    } else {
      barColor = AppColors.inStock;
      barValue = (product.stockQuantity / 100).clamp(0.0, 1.0);
      stockText = '${formatNumber(product.stockQuantity)} ${product.unitType}';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(product.name,
                      style: const TextStyle(
                          fontWeight: FontWeight.w600, fontSize: 14)),
                ),
                if (product.category != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: cs.secondaryContainer,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(product.category!,
                        style: TextStyle(
                            fontSize: 10, color: cs.onSecondaryContainer)),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: barValue,
                      backgroundColor: barColor.withOpacity(0.12),
                      valueColor: AlwaysStoppedAnimation(barColor),
                      minHeight: 8,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Text(stockText,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: barColor)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
