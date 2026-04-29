import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/product_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/shimmer_list.dart';
import '../../widgets/products/category_filter_bar.dart';
import '../../widgets/products/product_card.dart';

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

    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      floatingActionButton: user?.isManagerOrAbove == true
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/products/add'),
              icon: const Icon(Icons.add),
              label: const Text('Add Product'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: SearchBar(
              controller: _searchCtrl,
              hintText: 'Search products...',
              leading: const Icon(Icons.search),
              onChanged: (v) =>
                  ref.read(productSearchQueryProvider.notifier).state = v,
            ),
          ),
          const CategoryFilterBar(),
          const SizedBox(height: 8),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  ref.read(productsProvider.notifier).refresh(),
              child: productsAsync.when(
                loading: () => const ShimmerGrid(
                    crossAxisCount: 2, itemCount: 8, itemHeight: 160),
                error: (e, _) => ErrorView(
                    message: e.toString(),
                    onRetry: () =>
                        ref.read(productsProvider.notifier).refresh()),
                data: (products) => products.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.inventory_2_outlined,
                                size: 64,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant),
                            const SizedBox(height: 16),
                            const Text('No products found'),
                          ],
                        ),
                      )
                    : GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          childAspectRatio: 0.85,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                        itemCount: products.length,
                        itemBuilder: (ctx, i) {
                          final p = products[i];
                          return ProductCard(
                            product: p,
                            onTap: user?.isManagerOrAbove == true
                                ? () => context.push(
                                    '/products/${p.id}/edit',
                                    extra: p)
                                : null,
                          )
                              .animate()
                              .fadeIn(
                                  delay: Duration(
                                      milliseconds: (i * 35).clamp(0, 350)),
                                  duration: 300.ms)
                              .scale(
                                  begin: const Offset(0.92, 0.92),
                                  end: const Offset(1, 1),
                                  delay: Duration(
                                      milliseconds: (i * 35).clamp(0, 350)),
                                  duration: 300.ms);
                        },
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
