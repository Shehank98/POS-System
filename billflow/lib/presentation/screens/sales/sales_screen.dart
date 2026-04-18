import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/product_provider.dart';
import '../../widgets/products/category_filter_bar.dart';
import '../../widgets/products/pos_product_card.dart';
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

  @override
  void dispose() {
    _searchCtrl.dispose();
    _discountCtrl.dispose();
    super.dispose();
  }

  void _openCart() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CartSheet(discountCtrl: _discountCtrl),
    );
  }

  void _openScanner() {
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => const ScannerOverlay(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final productsAsync = ref.watch(productsProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      // ── AppBar: title + clear ─────────────────────────────────
      appBar: AppBar(
        title: const Text('POS'),
        centerTitle: false,
        titleTextStyle: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        actions: [
          if (cart.itemCount > 0)
            TextButton.icon(
              onPressed: () {
                ref.read(cartProvider.notifier).clearCart();
                _discountCtrl.clear();
              },
              icon: const Icon(Icons.clear_all, size: 16, color: Colors.white70),
              label: const Text('Clear',
                  style: TextStyle(color: Colors.white70, fontSize: 13)),
            ),
        ],
      ),

      body: Column(
        children: [
          // ── Search + Scan row ───────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
            child: Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 40,
                    child: TextField(
                      controller: _searchCtrl,
                      decoration: InputDecoration(
                        hintText: 'Search products…',
                        hintStyle: const TextStyle(fontSize: 13),
                        prefixIcon: const Icon(Icons.search, size: 18),
                        contentPadding:
                            const EdgeInsets.symmetric(vertical: 0),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10),
                          borderSide:
                              BorderSide(color: cs.outlineVariant),
                        ),
                        filled: true,
                        fillColor: cs.surfaceContainerLowest,
                      ),
                      style: const TextStyle(fontSize: 13),
                      onChanged: (v) => ref
                          .read(productSearchQueryProvider.notifier)
                          .state = v,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                // Barcode scanner button
                SizedBox(
                  height: 40,
                  width: 40,
                  child: FilledButton.tonal(
                    onPressed: _openScanner,
                    style: FilledButton.styleFrom(
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Icon(Icons.qr_code_scanner, size: 20),
                  ),
                ),
              ],
            ),
          ),

          // ── Category filter bar ─────────────────────────────────
          const CategoryFilterBar(),

          // ── Product grid (3 columns, compact) ──────────────────
          Expanded(
            child: productsAsync.when(
              loading: () =>
                  const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.wifi_off_outlined,
                        size: 40, color: Colors.grey),
                    const SizedBox(height: 8),
                    Text(e.toString(),
                        style: const TextStyle(color: Colors.grey),
                        textAlign: TextAlign.center),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () =>
                          ref.invalidate(productsProvider),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
              data: (products) => products.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.inventory_2_outlined,
                              size: 40, color: cs.onSurfaceVariant),
                          const SizedBox(height: 8),
                          Text('No products found',
                              style:
                                  TextStyle(color: cs.onSurfaceVariant)),
                        ],
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(10, 6, 10, 6),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 3,
                        childAspectRatio: 0.82,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                      ),
                      itemCount: products.length,
                      itemBuilder: (ctx, i) {
                        final p = products[i];
                        return PosProductCard(
                          product: p,
                          onTap: () {
                            ref
                                .read(cartProvider.notifier)
                                .addProduct(p);
                            // Haptic-like micro-snack feedback
                            ScaffoldMessenger.of(context)
                              ..hideCurrentSnackBar()
                              ..showSnackBar(SnackBar(
                                content: Text(
                                    '${p.name} added',
                                    style: const TextStyle(fontSize: 13)),
                                duration:
                                    const Duration(milliseconds: 600),
                                behavior: SnackBarBehavior.floating,
                                margin: const EdgeInsets.fromLTRB(
                                    10, 0, 10, 72),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                              ));
                          },
                        );
                      },
                    ),
            ),
          ),
        ],
      ),

      // ── Persistent checkout FAB ─────────────────────────────────
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: cart.isEmpty
          ? null
          : GestureDetector(
              onTap: _openCart,
              child: Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                height: 52,
                decoration: BoxDecoration(
                  color: AppColors.accent,
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.accent.withOpacity(0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Item count badge
                    Container(
                      margin: const EdgeInsets.all(8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${cart.itemCount}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14),
                      ),
                    ),
                    const Expanded(
                      child: Text(
                        'View Cart',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                    ),
                    Container(
                      margin: const EdgeInsets.all(8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.25),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        formatCurrency(cart.total),
                        style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

// ── Cart bottom sheet ─────────────────────────────────────────────────────────
class _CartSheet extends ConsumerWidget {
  final TextEditingController discountCtrl;

  const _CartSheet({required this.discountCtrl});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(cartProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final cs = Theme.of(context).colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (context, scrollCtrl) {
        return Container(
          decoration: BoxDecoration(
            color: cs.surface,
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(20)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.12),
                blurRadius: 16,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.shopping_cart, color: cs.primary, size: 20),
                    const SizedBox(width: 8),
                    Text('Cart',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: cs.onSurface)),
                    const Spacer(),
                    if (!cart.isEmpty)
                      TextButton(
                        onPressed: () {
                          ref.read(cartProvider.notifier).clearCart();
                          discountCtrl.clear();
                          Navigator.pop(context);
                        },
                        child: const Text('Clear all',
                            style: TextStyle(color: Colors.red)),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),

              // Cart items
              Expanded(
                child: cart.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shopping_cart_outlined,
                                size: 48, color: cs.onSurfaceVariant),
                            const SizedBox(height: 8),
                            Text('Cart is empty',
                                style: TextStyle(
                                    color: cs.onSurfaceVariant,
                                    fontSize: 15)),
                          ],
                        ),
                      )
                    : ListView(
                        controller: scrollCtrl,
                        children: cart.items
                            .map((i) => CartItemTile(item: i))
                            .toList(),
                      ),
              ),

              if (!cart.isEmpty) ...[
                const Divider(height: 1),
                // Discount + totals + charge
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      16,
                      12,
                      16,
                      MediaQuery.of(context).viewInsets.bottom + 16),
                  child: Column(
                    children: [
                      // Discount field + totals
                      Row(
                        children: [
                          Expanded(
                            child: SizedBox(
                              height: 42,
                              child: TextField(
                                controller: discountCtrl,
                                decoration: const InputDecoration(
                                  labelText: 'Discount',
                                  prefixText: 'Rs. ',
                                  isDense: true,
                                  contentPadding: EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 10),
                                  border: OutlineInputBorder(),
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
                          ),
                          const SizedBox(width: 16),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                  'Tax: ${formatCurrency(cart.taxAmount)}',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: cs.onSurfaceVariant)),
                              Text(
                                'Total: ${formatCurrency(cart.total)}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 17),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Charge button
                      FilledButton.icon(
                        onPressed: (user?.readOnly == true)
                            ? null
                            : () {
                                Navigator.pop(context);
                                context.push('/payment');
                              },
                        icon: const Icon(Icons.payments_outlined),
                        label: Text(
                          user?.readOnly == true
                              ? 'Read Only Mode'
                              : 'Charge — ${formatCurrency(cart.total)}',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15),
                        ),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.accent,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(double.infinity, 52),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
