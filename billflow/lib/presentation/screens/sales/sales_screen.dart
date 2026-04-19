import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/product_provider.dart';
import '../../widgets/products/category_filter_bar.dart';
import '../../widgets/products/product_card.dart';
import '../../widgets/sales/cart_item_tile.dart';
import '../../widgets/sales/scanner_overlay.dart';

class SalesScreen extends ConsumerStatefulWidget {
  const SalesScreen({super.key});

  @override
  ConsumerState<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends ConsumerState<SalesScreen> {
  final _searchCtrl = TextEditingController();
  final _discountCtrl = TextEditingController();
  bool _cartExpanded = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    _discountCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final productsAsync = ref.watch(productsProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Sale'),
        actions: [
          if (cart.itemCount > 0)
            TextButton.icon(
              onPressed: () {
                ref.read(cartProvider.notifier).clearCart();
                _discountCtrl.clear();
              },
              icon: const Icon(Icons.clear_all, size: 18),
              label: const Text('Clear'),
            ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SearchBar(
              controller: _searchCtrl,
              hintText: 'Search products...',
              leading: const Icon(Icons.search),
              trailing: [
                IconButton(
                  icon: const Icon(Icons.qr_code_scanner),
                  onPressed: () {
                    Navigator.of(context).push(MaterialPageRoute(
                      fullscreenDialog: true,
                      builder: (_) => const ScannerOverlay(),
                    ));
                  },
                ),
              ],
              onChanged: (v) => ref
                  .read(productSearchQueryProvider.notifier)
                  .state = v,
            ),
          ),
          const CategoryFilterBar(),
          const SizedBox(height: 8),

          // Products grid
          Expanded(
            flex: _cartExpanded ? 1 : 3,
            child: productsAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text(e.toString())),
              data: (products) => products.isEmpty
                  ? const Center(child: Text('No products found'))
                  : GridView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        childAspectRatio: 0.9,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                      ),
                      itemCount: products.length,
                      itemBuilder: (ctx, i) {
                        final p = products[i];
                        return ProductCard(
                          product: p,
                          onTap: p.isOutOfStock
                              ? null
                              : () {
                                  ref
                                      .read(cartProvider.notifier)
                                      .addProduct(p);
                                  ScaffoldMessenger.of(context)
                                      .showSnackBar(SnackBar(
                                    content: Text('${p.name} added'),
                                    duration:
                                        const Duration(milliseconds: 800),
                                    behavior: SnackBarBehavior.floating,
                                  ));
                                },
                        );
                      },
                    ),
            ),
          ),

          // Cart panel
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            constraints: BoxConstraints(
              maxHeight: _cartExpanded ? 400 : 200,
            ),
            decoration: BoxDecoration(
              color: cs.surface,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(20)),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 10,
                    offset: const Offset(0, -2)),
              ],
            ),
            child: Column(
              children: [
                // Handle
                GestureDetector(
                  onTap: () =>
                      setState(() => _cartExpanded = !_cartExpanded),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: Column(children: [
                      Container(
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: cs.outlineVariant,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.shopping_cart_outlined,
                              size: 16, color: cs.primary),
                          const SizedBox(width: 6),
                          Text(
                            '${cart.itemCount} item${cart.itemCount != 1 ? 's' : ''} in cart',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: cs.primary),
                          ),
                        ],
                      ),
                    ]),
                  ),
                ),

                if (cart.isEmpty)
                  Expanded(
                    child: Center(
                      child: Text('Cart is empty',
                          style: TextStyle(color: cs.onSurfaceVariant)),
                    ),
                  )
                else ...[
                  // Cart items
                  if (_cartExpanded)
                    Expanded(
                      child: ListView(
                        children: cart.items
                            .map((i) => CartItemTile(item: i))
                            .toList(),
                      ),
                    ),

                  // Totals + charge button
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                    child: Column(
                      children: [
                        Row(children: [
                          Expanded(
                            child: TextField(
                              controller: _discountCtrl,
                              decoration: const InputDecoration(
                                labelText: 'Order Discount',
                                prefixText: 'Rs. ',
                                isDense: true,
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                              ),
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                      decimal: true),
                              onChanged: (v) {
                                final d = double.tryParse(v) ?? 0.0;
                                ref
                                    .read(cartProvider.notifier)
                                    .setOrderDiscount(d);
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('Tax: ${formatCurrency(cart.taxAmount)}',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: cs.onSurfaceVariant)),
                              Text(
                                  'Total: ${formatCurrency(cart.total)}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16)),
                            ],
                          ),
                        ]),
                        const SizedBox(height: 10),
                        FilledButton.icon(
                          onPressed: (cart.isEmpty ||
                                  user?.readOnly == true)
                              ? null
                              : () => context.push('/payment'),
                          icon: const Icon(Icons.payments_outlined),
                          label: Text(
                            user?.readOnly == true
                                ? 'Read Only Mode'
                                : 'Charge — ${formatCurrency(cart.total)}',
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.accent,
                            foregroundColor: Colors.white,
                            minimumSize:
                                const Size(double.infinity, 52),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
