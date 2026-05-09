import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/clothing_model.dart';
import '../../../data/models/product_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/clothing_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/product_provider.dart';
import '../../widgets/products/category_filter_bar.dart';
import '../../widgets/products/pos_product_card.dart';
import '../../widgets/sales/cart_item_tile.dart';
import '../../widgets/sales/clothing_variant_picker.dart';
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
    final shopType = ref.watch(shopTypeProvider);
    final isClothing = shopType == 'clothing';
    final isCarwash = shopType == 'car_wash';

    // Carwash shops don't use product-based POS - redirect to carwash screen
    if (isCarwash) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/carwash');
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
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
      body: isClothing
          ? _ClothingPosBody(
              searchCtrl: _searchCtrl,
              onScannerTap: _openScanner,
            )
          : _RetailPosBody(
              searchCtrl: _searchCtrl,
              onScannerTap: _openScanner,
            ),
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
                      color: AppColors.accent.withValues(alpha: 0.35),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      margin: const EdgeInsets.all(8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
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
                        color: Colors.white.withValues(alpha: 0.25),
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

// ── KG weight input dialog ────────────────────────────────────────────────────
Future<void> _showKgInputDialog(
    BuildContext context, WidgetRef ref, ProductModel product) async {
  final kgCtrl = TextEditingController();
  final gramCtrl = TextEditingController();
  final formKey = GlobalKey<FormState>();

  await showDialog<void>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(product.name, maxLines: 2, overflow: TextOverflow.ellipsis),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Enter weight',
                style: TextStyle(
                    color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                    fontSize: 13)),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: kgCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    autofocus: true,
                    decoration: const InputDecoration(
                      labelText: 'KG',
                      suffixText: 'kg',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                    validator: (v) {
                      if ((v == null || v.isEmpty) &&
                          (gramCtrl.text.isEmpty)) {
                        return 'Enter weight';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextFormField(
                    controller: gramCtrl,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Grams',
                      suffixText: 'g',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Price: ${formatCurrency(product.price)} / kg',
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            if (!formKey.currentState!.validate()) return;
            final kg = double.tryParse(kgCtrl.text) ?? 0.0;
            final grams = double.tryParse(gramCtrl.text) ?? 0.0;
            final totalKg = kg + (grams / 1000.0);
            if (totalKg <= 0) return;
            ref.read(cartProvider.notifier).addProduct(product, qty: totalKg);
            Navigator.pop(ctx);
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(SnackBar(
                content: Text(
                    '${product.name} ${totalKg.toStringAsFixed(3)} kg added'),
                duration: const Duration(milliseconds: 800),
                behavior: SnackBarBehavior.floating,
                margin: const EdgeInsets.fromLTRB(10, 0, 10, 72),
              ));
          },
          child: const Text('Add'),
        ),
      ],
    ),
  );

  kgCtrl.dispose();
  gramCtrl.dispose();
}

// ── Retail / Grocery product grid ─────────────────────────────────────────────
class _RetailPosBody extends ConsumerWidget {
  final TextEditingController searchCtrl;
  final VoidCallback onScannerTap;

  const _RetailPosBody(
      {required this.searchCtrl, required this.onScannerTap});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);
    final cs = Theme.of(context).colorScheme;

    return Column(
      children: [
        _SearchBar(ctrl: searchCtrl, onScannerTap: onScannerTap),
        const CategoryFilterBar(),
        Expanded(
          child: productsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrorView(
                error: e.toString(),
                onRetry: () => ref.invalidate(productsProvider)),
            data: (products) => products.isEmpty
                ? _EmptyState(
                    icon: Icons.inventory_2_outlined, label: 'No products found')
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
                        onTap: () async {
                          if (p.unitType == 'kg') {
                            await _showKgInputDialog(context, ref, p);
                          } else {
                            ref.read(cartProvider.notifier).addProduct(p);
                            ScaffoldMessenger.of(context)
                              ..hideCurrentSnackBar()
                              ..showSnackBar(SnackBar(
                                content: Text('${p.name} added',
                                    style: const TextStyle(fontSize: 13)),
                                duration: const Duration(milliseconds: 600),
                                behavior: SnackBarBehavior.floating,
                                margin: const EdgeInsets.fromLTRB(10, 0, 10, 72),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                              ));
                          }
                        },
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

// ── Clothing product grid ─────────────────────────────────────────────────────
// Tapping a product opens the variant picker instead of directly adding to cart.
class _ClothingPosBody extends ConsumerStatefulWidget {
  final TextEditingController searchCtrl;
  final VoidCallback onScannerTap;

  const _ClothingPosBody(
      {required this.searchCtrl, required this.onScannerTap});

  @override
  ConsumerState<_ClothingPosBody> createState() => _ClothingPosBodyState();
}

class _ClothingPosBodyState extends ConsumerState<_ClothingPosBody> {
  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(clothingProductsProvider);
    final cs = Theme.of(context).colorScheme;

    return Column(
      children: [
        _SearchBar(
          ctrl: widget.searchCtrl,
          onScannerTap: widget.onScannerTap,
          hintText: 'Search clothing…',
          onChanged: (v) =>
              ref.read(clothingSearchProvider.notifier).state = v,
        ),
        Expanded(
          child: productsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => _ErrorView(
                error: e.toString(),
                onRetry: () => ref.invalidate(clothingProductsProvider)),
            data: (products) => products.isEmpty
                ? _EmptyState(
                    icon: Icons.checkroom_outlined, label: 'No products found')
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
                      // Convert ClothingProduct to a display-only ProductModel
                      final pseudo = _clothingToDisplay(p);
                      return PosProductCard(
                        product: pseudo,
                        onTap: () => showClothingVariantPicker(
                          context: context,
                          product: p,
                          onVariantSelected: (variant) {
                            ref
                                .read(cartProvider.notifier)
                                .addClothingVariant(p, variant);
                            ScaffoldMessenger.of(context)
                              ..hideCurrentSnackBar()
                              ..showSnackBar(SnackBar(
                                content: Text(
                                    '${p.name} (${variant.size}/${variant.color}) added',
                                    style: const TextStyle(fontSize: 13)),
                                duration:
                                    const Duration(milliseconds: 700),
                                behavior: SnackBarBehavior.floating,
                                margin: const EdgeInsets.fromLTRB(
                                    10, 0, 10, 72),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 10),
                              ));
                          },
                        ),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

// Builds a ProductModel shell from a ClothingProduct for the PosProductCard display.
ProductModel _clothingToDisplay(ClothingProduct p) => ProductModel(
      id: p.id,
      shopId: 0,
      name: p.name,
      price: p.basePrice,
      costPrice: 0,
      stockQuantity: p.totalStock.toDouble(),
      hasInventory: true,
      category: p.category,
      taxRate: p.taxRate ?? 0,
      unitType: 'unit',
    );

// ── Shared widgets ────────────────────────────────────────────────────────────
class _SearchBar extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onScannerTap;
  final String hintText;
  final void Function(String)? onChanged;

  const _SearchBar({
    required this.ctrl,
    required this.onScannerTap,
    this.hintText = 'Search products…',
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 8, 10, 4),
      child: Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 40,
              child: TextField(
                controller: ctrl,
                decoration: InputDecoration(
                  hintText: hintText,
                  hintStyle: const TextStyle(fontSize: 13),
                  prefixIcon: const Icon(Icons.search, size: 18),
                  contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: cs.outlineVariant),
                  ),
                  filled: true,
                  fillColor: cs.surfaceContainerLowest,
                ),
                style: const TextStyle(fontSize: 13),
                onChanged: onChanged,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 40,
            width: 40,
            child: FilledButton.tonal(
              onPressed: onScannerTap,
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
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;

  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off_outlined, size: 40, color: Colors.grey),
          const SizedBox(height: 8),
          Text(error,
              style: const TextStyle(color: Colors.grey),
              textAlign: TextAlign.center),
          const SizedBox(height: 12),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final IconData icon;
  final String label;

  const _EmptyState({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: cs.onSurfaceVariant),
          const SizedBox(height: 8),
          Text(label, style: TextStyle(color: cs.onSurfaceVariant)),
        ],
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
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 16,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: Column(
            children: [
              Container(
                margin: const EdgeInsets.only(top: 10, bottom: 4),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: cs.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
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
                                    color: cs.onSurfaceVariant, fontSize: 15)),
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
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      16,
                      12,
                      16,
                      MediaQuery.of(context).viewInsets.bottom + 16),
                  child: Column(
                    children: [
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
                              : 'Charge - ${formatCurrency(cart.total)}',
                          style: const TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 15),
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
