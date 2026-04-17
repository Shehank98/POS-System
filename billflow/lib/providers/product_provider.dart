import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/product_model.dart';
import '../data/services/product_service.dart';

final productSearchQueryProvider = StateProvider<String>((ref) => '');
final productCategoryFilterProvider = StateProvider<String?>((ref) => null);

class ProductsNotifier extends AsyncNotifier<List<ProductModel>> {
  @override
  Future<List<ProductModel>> build() => _fetch();

  Future<List<ProductModel>> _fetch() async {
    final search = ref.watch(productSearchQueryProvider);
    final category = ref.watch(productCategoryFilterProvider);
    final result = await ref.read(productServiceProvider).listProducts(
          search: search.isEmpty ? null : search,
          category: category,
        );
    return result.products;
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetch);
  }

  Future<ProductModel> createProduct(Map<String, dynamic> data) async {
    final product =
        await ref.read(productServiceProvider).createProduct(data);
    state = AsyncData([product, ...state.valueOrNull ?? []]);
    return product;
  }

  Future<ProductModel> updateProduct(
      int id, Map<String, dynamic> data) async {
    final updated =
        await ref.read(productServiceProvider).updateProduct(id, data);
    state = AsyncData(state.valueOrNull
            ?.map((p) => p.id == id ? updated : p)
            .toList() ??
        []);
    return updated;
  }

  Future<void> deleteProduct(int id) async {
    await ref.read(productServiceProvider).deleteProduct(id);
    state = AsyncData(
        state.valueOrNull?.where((p) => p.id != id).toList() ?? []);
  }
}

final productsProvider =
    AsyncNotifierProvider<ProductsNotifier, List<ProductModel>>(
        ProductsNotifier.new);

final categoriesProvider = FutureProvider<List<String>>(
    (ref) => ref.watch(productServiceProvider).getCategories());
