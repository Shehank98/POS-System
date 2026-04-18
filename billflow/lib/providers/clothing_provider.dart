import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/clothing_model.dart';
import '../data/services/clothing_service.dart';

final clothingSearchProvider = StateProvider<String>((ref) => '');
final clothingCategoryProvider = StateProvider<String?>((ref) => null);

final clothingProductsProvider =
    FutureProvider.autoDispose<List<ClothingProduct>>((ref) async {
  final search = ref.watch(clothingSearchProvider);
  final category = ref.watch(clothingCategoryProvider);
  final result = await ref.watch(clothingServiceProvider).listProducts(
        search: search.isEmpty ? null : search,
        category: category,
      );
  return result.products;
});

final clothingVariantsProvider =
    FutureProvider.autoDispose.family<List<ClothingVariant>, int>(
        (ref, productId) =>
            ref.watch(clothingServiceProvider).listVariants(productId));
