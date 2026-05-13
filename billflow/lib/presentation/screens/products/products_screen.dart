import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/product_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/product_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/shimmer_list.dart';

class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final productsAsync = ref.watch(productsProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.bg,
      floatingActionButton: user?.isManagerOrAbove == true
          ? _AddFab(onPressed: () => context.push('/products/add'))
          : null,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Custom header ────────────────────────────────────────────────
          _ProductsHeader(
            topPadding: topPadding,
            productsAsync: productsAsync,
            isManager: user?.isManagerOrAbove == true,
            onAddPressed: () => context.push('/products/add'),
          ),

          // ── Search bar ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: _SearchBar(controller: _searchCtrl),
          ),

          // ── Category chips ───────────────────────────────────────────────
          const _CategoryChips(),
          const SizedBox(height: 12),

          // ── Product list ─────────────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              color: AppColors.brand,
              backgroundColor: AppColors.surface,
              onRefresh: () => ref.read(productsProvider.notifier).refresh(),
              child: productsAsync.when(
                loading: () =>
                    const ShimmerList(itemCount: 10, itemHeight: 72),
                error: (e, _) => ErrorView(
                  message: e.toString(),
                  onRetry: () =>
                      ref.read(productsProvider.notifier).refresh(),
                ),
                data: (products) => products.isEmpty
                    ? _EmptyProducts()
                    : _ProductList(
                        products: products,
                        canEdit: user?.isManagerOrAbove == true,
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ──────────────────────────────────────────────────────────────────

class _ProductsHeader extends StatelessWidget {
  final double topPadding;
  final AsyncValue<List<ProductModel>> productsAsync;
  final bool isManager;
  final VoidCallback onAddPressed;

  const _ProductsHeader({
    required this.topPadding,
    required this.productsAsync,
    required this.isManager,
    required this.onAddPressed,
  });

  @override
  Widget build(BuildContext context) {
    final products = productsAsync.valueOrNull ?? [];
    final categories =
        products.map((p) => p.category ?? 'Uncategorized').toSet();
    final itemCount = products.length;
    final catCount = categories.length;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, topPadding + 16, 20, 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$itemCount ${itemCount == 1 ? 'item' : 'items'} · $catCount ${catCount == 1 ? 'category' : 'categories'}',
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink3,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Catalog',
                  style: GoogleFonts.manrope(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                    height: 1.2,
                  ),
                ),
              ],
            ),
          ),
          if (isManager)
            GestureDetector(
              onTap: onAddPressed,
              child: Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.ink,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.add,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Search bar ───────────────────────────────────────────────────────────────

class _SearchBar extends ConsumerWidget {
  final TextEditingController controller;
  const _SearchBar({required this.controller});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search, color: AppColors.ink3, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              style: GoogleFonts.manrope(
                fontSize: 14,
                color: AppColors.ink,
              ),
              decoration: InputDecoration(
                hintText: 'Search products...',
                hintStyle: GoogleFonts.manrope(
                  fontSize: 14,
                  color: AppColors.ink3,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              onChanged: (v) =>
                  ref.read(productSearchQueryProvider.notifier).state = v,
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.qr_code_scanner, color: AppColors.ink3, size: 18),
          const SizedBox(width: 12),
        ],
      ),
    );
  }
}

// ── Category chips ───────────────────────────────────────────────────────────

class _CategoryChips extends ConsumerWidget {
  const _CategoryChips();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selected = ref.watch(productCategoryFilterProvider);
    final categoriesAsync = ref.watch(categoriesProvider);

    return categoriesAsync.when(
      data: (categories) {
        final all = ['All', ...categories];
        return SizedBox(
          height: 34,
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
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.ink : Colors.transparent,
                    borderRadius: BorderRadius.circular(20),
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

// ── Product list ─────────────────────────────────────────────────────────────

class _ProductList extends StatelessWidget {
  final List<ProductModel> products;
  final bool canEdit;

  const _ProductList({required this.products, required this.canEdit});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.hairline),
          ),
          clipBehavior: Clip.hardEdge,
          child: Column(
            children: List.generate(products.length, (i) {
              final p = products[i];
              final isLast = i == products.length - 1;
              return Column(
                children: [
                  _ProductRow(
                    product: p,
                    onTap: canEdit
                        ? () => context.push(
                              '/products/${p.id}/edit',
                              extra: p,
                            )
                        : null,
                  )
                      .animate()
                      .fadeIn(
                        delay: Duration(
                            milliseconds: (i * 30).clamp(0, 300)),
                        duration: 280.ms,
                      )
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        delay: Duration(
                            milliseconds: (i * 30).clamp(0, 300)),
                        duration: 280.ms,
                      ),
                  if (!isLast)
                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: AppColors.hairline,
                      indent: 16,
                      endIndent: 16,
                    ),
                ],
              );
            }),
          ),
        ),
      ],
    );
  }
}

// ── Product row ──────────────────────────────────────────────────────────────

class _ProductRow extends StatelessWidget {
  final ProductModel product;
  final VoidCallback? onTap;

  const _ProductRow({required this.product, this.onTap});

  @override
  Widget build(BuildContext context) {
    final isOut = product.isOutOfStock;

    return Opacity(
      opacity: isOut ? 0.55 : 1.0,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          splashColor: AppColors.soft,
          highlightColor: AppColors.soft.withValues(alpha: 0.5),
          child: Padding(
            padding: const EdgeInsets.symmetric(
                horizontal: 16, vertical: 12),
            child: Row(
              children: [
                // ── Striped placeholder thumbnail ──────────────────────
                _ProductThumbnail(product: product),
                const SizedBox(width: 12),

                // ── Name + category ────────────────────────────────────
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        product.name,
                        style: GoogleFonts.manrope(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (product.category != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          product.category!,
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            color: AppColors.ink3,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // ── Price + stock badge ────────────────────────────────
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatCurrency(product.price),
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _StockBadge(product: product),
                  ],
                ),

                if (onTap != null) ...[
                  const SizedBox(width: 8),
                  const Icon(
                    Icons.chevron_right,
                    size: 16,
                    color: AppColors.ink3,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Product thumbnail ─────────────────────────────────────────────────────────

class _ProductThumbnail extends StatelessWidget {
  final ProductModel product;
  const _ProductThumbnail({required this.product});

  @override
  Widget build(BuildContext context) {
    // Derive a color from product name for the stripe accent
    final hue = (product.name.codeUnits.fold(0, (a, b) => a + b) % 6) * 60.0;
    final accentColor = HSLColor.fromAHSL(1, hue, 0.35, 0.55).toColor();

    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.soft,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: AppColors.hairline),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Stack(
          children: [
            // Diagonal stripes background
            CustomPaint(
              size: const Size(44, 44),
              painter: _StripePainter(
                stripeColor: accentColor.withValues(alpha: 0.18),
              ),
            ),
            // Category initial letter
            Center(
              child: Text(
                (product.category?.isNotEmpty == true
                        ? product.category![0]
                        : product.name[0])
                    .toUpperCase(),
                style: GoogleFonts.manrope(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: accentColor,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StripePainter extends CustomPainter {
  final Color stripeColor;
  const _StripePainter({required this.stripeColor});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = stripeColor
      ..strokeWidth = 6;
    const spacing = 10.0;
    for (double i = -size.height; i < size.width + size.height; i += spacing) {
      canvas.drawLine(
        Offset(i, 0),
        Offset(i + size.height, size.height),
        paint,
      );
    }
  }

  @override
  bool shouldRepaint(_StripePainter old) => old.stripeColor != stripeColor;
}

// ── Stock badge ───────────────────────────────────────────────────────────────

class _StockBadge extends StatelessWidget {
  final ProductModel product;
  const _StockBadge({required this.product});

  @override
  Widget build(BuildContext context) {
    if (!product.hasInventory) {
      return const SizedBox.shrink();
    }

    final Color color;
    final String label;

    if (product.isOutOfStock) {
      color = AppColors.danger;
      label = 'OUT';
    } else if (product.isLowStock) {
      color = AppColors.warn;
      label = '${product.stockQuantity.toInt()} STK';
    } else {
      color = AppColors.ink3;
      label = '${product.stockQuantity.toInt()} STK';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: GoogleFonts.jetBrainsMono(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

// ── Add FAB ───────────────────────────────────────────────────────────────────

class _AddFab extends StatelessWidget {
  final VoidCallback onPressed;
  const _AddFab({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton(
      onPressed: onPressed,
      backgroundColor: AppColors.ink,
      foregroundColor: Colors.white,
      elevation: 4,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Icon(Icons.add, size: 24),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyProducts extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.hairline),
            ),
            child: const Icon(
              Icons.inventory_2_outlined,
              size: 32,
              color: AppColors.ink3,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'No products found',
            style: GoogleFonts.manrope(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Add your first product to get started',
            style: GoogleFonts.manrope(
              fontSize: 13,
              color: AppColors.ink3,
            ),
          ),
        ],
      ),
    );
  }
}
