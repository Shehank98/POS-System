import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/clothing_model.dart';
import '../../../data/models/product_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/clothing_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/product_provider.dart';
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
    final user = ref.watch(authProvider).valueOrNull;
    final isClothing = shopType == 'clothing';
    final isCarwash = shopType == 'car_wash';

    // Carwash shops don't use product-based POS - redirect to carwash screen
    if (isCarwash) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.go('/carwash');
      });
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Custom header ────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 16, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Sale · ${user?.shopName ?? ''}',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: AppColors.ink3,
                            letterSpacing: 0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'What\'s the order?',
                          style: GoogleFonts.manrope(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                            height: 1.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Scan button
                  GestureDetector(
                    onTap: _openScanner,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.hairline),
                        boxShadow: [AppColors.cardShadowSm],
                      ),
                      child: const Icon(
                        Icons.qr_code_scanner_rounded,
                        size: 18,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // ── Search bar ───────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _DesignSearchBar(
                ctrl: _searchCtrl,
                hintText: isClothing ? 'Find clothing…' : 'Find products…',
                onChanged: isClothing
                    ? (v) =>
                        ref.read(clothingSearchProvider.notifier).state = v
                    : (v) =>
                        ref.read(productSearchQueryProvider.notifier).state =
                            v,
              ),
            ),

            const SizedBox(height: 10),

            // ── Category chips (retail only) ─────────────────────────────
            if (!isClothing) const _DesignCategoryBar(),

            const SizedBox(height: 8),

            // ── Product grid ─────────────────────────────────────────────
            Expanded(
              child: isClothing
                  ? _ClothingPosBody(searchCtrl: _searchCtrl)
                  : const _RetailPosBody(),
            ),
          ],
        ),
      ),

      // ── Floating cart pill ───────────────────────────────────────────
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: cart.isEmpty
          ? null
          : _FloatingCartPill(
              cart: cart,
              onTap: _openCart,
            ),
    );
  }
}

// ── Floating cart pill ────────────────────────────────────────────────────────
class _FloatingCartPill extends StatelessWidget {
  final CartState cart;
  final VoidCallback onTap;

  const _FloatingCartPill({required this.cart, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 20),
        height: 54,
        decoration: BoxDecoration(
          color: AppColors.ink,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              color: Color(0x66141E28),
              blurRadius: 30,
              offset: Offset(0, 10),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Row(
            children: [
              // Item count badge
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 36,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    '${cart.itemCount}',
                    style: GoogleFonts.manrope(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Center text
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${cart.itemCount} item${cart.itemCount == 1 ? '' : 's'} in cart',
                      style: GoogleFonts.manrope(
                        color: Colors.white.withValues(alpha: 0.75),
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      formatCurrency(cart.total),
                      style: GoogleFonts.jetBrainsMono(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),

              // Review arrow
              Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Center(
                  child: Text(
                    'Review →',
                    style: GoogleFonts.manrope(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Design-system search bar ──────────────────────────────────────────────────
class _DesignSearchBar extends StatelessWidget {
  final TextEditingController ctrl;
  final String hintText;
  final void Function(String)? onChanged;

  const _DesignSearchBar({
    required this.ctrl,
    this.hintText = 'Find products…',
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 42,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search_rounded, size: 18, color: AppColors.ink3),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: ctrl,
              decoration: InputDecoration(
                hintText: hintText,
                hintStyle: GoogleFonts.manrope(
                  fontSize: 13,
                  color: AppColors.ink3,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: AppColors.ink,
              ),
              onChanged: onChanged,
            ),
          ),
          Container(
            margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: AppColors.hairline),
            ),
            child: Text(
              '⌘K',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 10,
                color: AppColors.ink3,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Category filter chips (design-system styled) ──────────────────────────────
class _DesignCategoryBar extends ConsumerWidget {
  const _DesignCategoryBar();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(productCategoryFilterProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return categoriesAsync.when(
      data: (categories) {
        if (categories.isEmpty) return const SizedBox.shrink();
        final all = ['All', ...categories];
        return SizedBox(
          height: 32,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: all.length,
            separatorBuilder: (_, __) => const SizedBox(width: 6),
            itemBuilder: (context, i) {
              final cat = all[i];
              final isAll = cat == 'All';
              final isSelected =
                  isAll ? selected == null : selected == cat;
              return GestureDetector(
                onTap: () => ref
                    .read(productCategoryFilterProvider.notifier)
                    .state = isAll ? null : cat,
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.ink : Colors.transparent,
                    borderRadius: BorderRadius.circular(100),
                    border: isSelected
                        ? null
                        : Border.all(color: AppColors.hairline),
                  ),
                  child: Text(
                    cat,
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: isSelected ? Colors.white : AppColors.ink2,
                    ),
                  ),
                ),
              );
            },
          ),
        );
      },
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
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
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      title: Text(
        product.name,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        style: GoogleFonts.manrope(
            fontWeight: FontWeight.w600, color: AppColors.ink),
      ),
      content: Form(
        key: formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Enter weight',
              style: GoogleFonts.manrope(
                  color: AppColors.ink2, fontSize: 13),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: kgCtrl,
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    autofocus: true,
                    decoration: InputDecoration(
                      labelText: 'KG',
                      suffixText: 'kg',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      isDense: true,
                    ),
                    validator: (v) {
                      if ((v == null || v.isEmpty) && gramCtrl.text.isEmpty) {
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
                    decoration: InputDecoration(
                      labelText: 'Grams',
                      suffixText: 'g',
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(10)),
                      isDense: true,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Price: ${formatCurrency(product.price)} / kg',
              style: GoogleFonts.manrope(fontSize: 12, color: AppColors.ink3),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx),
          child: Text('Cancel',
              style: GoogleFonts.manrope(color: AppColors.ink2)),
        ),
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
          style: FilledButton.styleFrom(backgroundColor: AppColors.brand),
          child: Text('Add', style: GoogleFonts.manrope(fontWeight: FontWeight.w600)),
        ),
      ],
    ),
  );

  kgCtrl.dispose();
  gramCtrl.dispose();
}

// ── Retail / Grocery product grid ─────────────────────────────────────────────
class _RetailPosBody extends ConsumerWidget {
  const _RetailPosBody();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);

    return productsAsync.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.brand)),
      error: (e, _) => _ErrorView(
          error: e.toString(),
          onRetry: () => ref.invalidate(productsProvider)),
      data: (products) => products.isEmpty
          ? const _EmptyState(
              icon: Icons.inventory_2_outlined, label: 'No products found')
          : GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 2, 16, 90),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.88,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: products.length,
              itemBuilder: (ctx, i) {
                final p = products[i];
                return _DesignProductCard(
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
                              style: GoogleFonts.manrope(fontSize: 13)),
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
    );
  }
}

// ── Clothing product grid ─────────────────────────────────────────────────────
class _ClothingPosBody extends ConsumerWidget {
  final TextEditingController searchCtrl;

  const _ClothingPosBody({required this.searchCtrl});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(clothingProductsProvider);

    return productsAsync.when(
      loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.brand)),
      error: (e, _) => _ErrorView(
          error: e.toString(),
          onRetry: () => ref.invalidate(clothingProductsProvider)),
      data: (products) => products.isEmpty
          ? const _EmptyState(
              icon: Icons.checkroom_outlined, label: 'No products found')
          : GridView.builder(
              padding: const EdgeInsets.fromLTRB(16, 2, 16, 90),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 0.88,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: products.length,
              itemBuilder: (ctx, i) {
                final p = products[i];
                final pseudo = _clothingToDisplay(p);
                return _DesignProductCard(
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
                              style: GoogleFonts.manrope(fontSize: 13)),
                          duration: const Duration(milliseconds: 700),
                          behavior: SnackBarBehavior.floating,
                          margin: const EdgeInsets.fromLTRB(10, 0, 10, 72),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 10),
                        ));
                    },
                  ),
                );
              },
            ),
    );
  }
}

// Builds a ProductModel shell from a ClothingProduct for the _DesignProductCard display.
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

// ── Design-system product card ────────────────────────────────────────────────
class _DesignProductCard extends StatelessWidget {
  final ProductModel product;
  final VoidCallback? onTap;

  const _DesignProductCard({required this.product, this.onTap});

  @override
  Widget build(BuildContext context) {
    final outOfStock = product.isOutOfStock;
    final lowStock = product.isLowStock;

    return GestureDetector(
      onTap: outOfStock ? null : onTap,
      child: AnimatedOpacity(
        opacity: outOfStock ? 0.42 : 1.0,
        duration: const Duration(milliseconds: 150),
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.hairline),
            boxShadow: outOfStock ? null : [AppColors.cardShadowSm],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Product image placeholder (striped)
              Expanded(
                child: ClipRRect(
                  borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(13)),
                  child: _StripedPlaceholder(
                    isDimmed: outOfStock,
                  ),
                ),
              ),

              // Info section
              Padding(
                padding:
                    const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Product name
                    Text(
                      product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: GoogleFonts.manrope(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: outOfStock ? AppColors.ink3 : AppColors.ink,
                        height: 1.3,
                      ),
                    ),
                    const SizedBox(height: 4),

                    // Price + badge row
                    Row(
                      children: [
                        Text(
                          formatCurrency(product.price),
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: outOfStock ? AppColors.ink3 : AppColors.ink,
                          ),
                        ),
                        const Spacer(),
                        if (outOfStock)
                          _StockBadge(label: 'OUT', color: AppColors.danger)
                        else if (lowStock)
                          _StockBadge(
                            label:
                                '${_stockCount(product)} LEFT',
                            color: AppColors.warn,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _stockCount(ProductModel p) {
    if (!p.hasInventory) return '';
    final qty = p.stockQuantity;
    if (qty == qty.roundToDouble()) {
      return qty.toInt().toString();
    }
    return qty.toStringAsFixed(1);
  }
}

// ── Striped no-image placeholder ──────────────────────────────────────────────
class _StripedPlaceholder extends StatelessWidget {
  final bool isDimmed;

  const _StripedPlaceholder({this.isDimmed = false});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _StripePainter(isDimmed: isDimmed),
      child: Container(color: Colors.transparent),
    );
  }
}

class _StripePainter extends CustomPainter {
  final bool isDimmed;

  const _StripePainter({required this.isDimmed});

  @override
  void paint(Canvas canvas, Size size) {
    final bgColor = isDimmed ? AppColors.soft : AppColors.soft;
    final stripeColor = isDimmed
        ? AppColors.hairline.withValues(alpha: 0.4)
        : AppColors.hairline.withValues(alpha: 0.7);

    // Background
    canvas.drawRect(Rect.fromLTWH(0, 0, size.width, size.height),
        Paint()..color = bgColor);

    // Diagonal stripes
    final paint = Paint()
      ..color = stripeColor
      ..strokeWidth = 1.0;

    const stripeGap = 12.0;
    final total = size.width + size.height;
    for (double offset = 0; offset < total; offset += stripeGap) {
      canvas.drawLine(
        Offset(offset, 0),
        Offset(0, offset),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_StripePainter oldDelegate) =>
      oldDelegate.isDimmed != isDimmed;
}

// ── Stock badge ───────────────────────────────────────────────────────────────
class _StockBadge extends StatelessWidget {
  final String label;
  final Color color;

  const _StockBadge({required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        label,
        style: GoogleFonts.jetBrainsMono(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

// ── Error / empty views ───────────────────────────────────────────────────────
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
          const Icon(Icons.wifi_off_outlined, size: 40, color: AppColors.ink3),
          const SizedBox(height: 8),
          Text(
            error,
            style: GoogleFonts.manrope(color: AppColors.ink3),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: onRetry,
            child: Text('Retry',
                style: GoogleFonts.manrope(
                    color: AppColors.brand, fontWeight: FontWeight.w600)),
          ),
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
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 40, color: AppColors.ink3),
          const SizedBox(height: 8),
          Text(label,
              style: GoogleFonts.manrope(
                  color: AppColors.ink3, fontSize: 14)),
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

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      builder: (context, scrollCtrl) {
        return Container(
          decoration: const BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            boxShadow: [
              BoxShadow(
                color: Color(0x1F1D2B3A),
                blurRadius: 24,
                offset: Offset(0, -6),
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
                  color: AppColors.hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 16, 8),
                child: Row(
                  children: [
                    Text(
                      'Cart',
                      style: GoogleFonts.manrope(
                        fontWeight: FontWeight.w700,
                        fontSize: 17,
                        color: AppColors.ink,
                      ),
                    ),
                    const Spacer(),
                    if (!cart.isEmpty)
                      GestureDetector(
                        onTap: () {
                          ref.read(cartProvider.notifier).clearCart();
                          discountCtrl.clear();
                          Navigator.pop(context);
                        },
                        child: Text(
                          'Clear all',
                          style: GoogleFonts.manrope(
                            color: AppColors.danger,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),

              Divider(height: 1, color: AppColors.hairline),

              // Cart items
              Expanded(
                child: cart.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.shopping_cart_outlined,
                                size: 48, color: AppColors.ink3),
                            const SizedBox(height: 8),
                            Text(
                              'Cart is empty',
                              style: GoogleFonts.manrope(
                                  color: AppColors.ink3, fontSize: 15),
                            ),
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

              // Footer
              if (!cart.isEmpty) ...[
                Divider(height: 1, color: AppColors.hairline),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                      16, 14, 16, MediaQuery.of(context).viewInsets.bottom + 16),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          // Discount input
                          Expanded(
                            child: SizedBox(
                              height: 44,
                              child: TextField(
                                controller: discountCtrl,
                                decoration: InputDecoration(
                                  labelText: 'Discount',
                                  labelStyle: GoogleFonts.manrope(
                                      fontSize: 12, color: AppColors.ink2),
                                  prefixText: 'Rs. ',
                                  prefixStyle: GoogleFonts.jetBrainsMono(
                                      fontSize: 13, color: AppColors.ink2),
                                  isDense: true,
                                  contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 12),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                        color: AppColors.hairline),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(10),
                                    borderSide: const BorderSide(
                                        color: AppColors.hairline),
                                  ),
                                  filled: true,
                                  fillColor: AppColors.soft,
                                ),
                                style: GoogleFonts.jetBrainsMono(
                                    fontSize: 13, color: AppColors.ink),
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

                          // Totals
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                'Tax: ${formatCurrency(cart.taxAmount)}',
                                style: GoogleFonts.manrope(
                                  fontSize: 12,
                                  color: AppColors.ink3,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                formatCurrency(cart.total),
                                style: GoogleFonts.jetBrainsMono(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 18,
                                  color: AppColors.ink,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Charge button
                      GestureDetector(
                        onTap: (user?.readOnly == true)
                            ? null
                            : () {
                                Navigator.pop(context);
                                context.push('/payment');
                              },
                        child: AnimatedOpacity(
                          opacity: user?.readOnly == true ? 0.5 : 1.0,
                          duration: const Duration(milliseconds: 150),
                          child: Container(
                            width: double.infinity,
                            height: 52,
                            decoration: BoxDecoration(
                              color: AppColors.brand,
                              borderRadius: BorderRadius.circular(14),
                              boxShadow: [AppColors.greenButtonShadow],
                            ),
                            child: Center(
                              child: Text(
                                user?.readOnly == true
                                    ? 'Read Only Mode'
                                    : 'Charge · ${formatCurrency(cart.total)}',
                                style: GoogleFonts.manrope(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 15,
                                ),
                              ),
                            ),
                          ),
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
