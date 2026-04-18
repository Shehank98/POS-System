import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/product_model.dart';

class ProductService {
  final Dio _dio;
  ProductService(this._dio);

  Future<({List<ProductModel> products, int total})> listProducts({
    String? search,
    String? category,
    bool? lowStock,
    int page = 1,
    int limit = 50,
    String shopType = 'retail',
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null) 'category': category,
        if (lowStock == true) 'low_stock': 'true',
      };

      final isClothing = shopType == 'clothing';
      final endpoint = isClothing
          ? ApiConstants.clothingProducts
          : ApiConstants.products;

      final response = await _dio.get(endpoint, queryParameters: params);
      final data = response.data;
      final List<dynamic> raw =
          data is List ? data : (data['products'] as List<dynamic>? ?? []);

      final products = raw.map((e) {
        final map = e as Map<String, dynamic>;
        if (isClothing) return _mapClothingProduct(map);
        return ProductModel.fromJson(map);
      }).toList();

      final total =
          (data is Map ? data['total'] as int? : null) ?? products.length;
      return (products: products, total: total);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  ProductModel _mapClothingProduct(Map<String, dynamic> m) {
    final totalStock = (m['total_stock'] as num?)?.toDouble() ?? 0;
    final variantCount = (m['variant_count'] as num?)?.toInt() ?? 0;
    return ProductModel(
      id: m['id'] as int,
      shopId: m['shop_id'] as int? ?? 0,
      name: m['name'] as String? ?? '',
      barcode: null,
      price: (m['base_price'] as num?)?.toDouble() ?? 0,
      costPrice: (m['cost_price'] as num?)?.toDouble() ?? 0,
      category: m['category'] as String?,
      taxRate: (m['tax_rate'] as num?)?.toDouble() ?? 0,
      hasInventory: variantCount > 0,
      stockQuantity: totalStock,
      unitType: 'unit',
    );
  }

  Future<ProductModel> getByBarcode(String barcode) async {
    try {
      final response = await _dio.get(ApiConstants.productByBarcode(barcode));
      return ProductModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<String>> getCategories() async {
    try {
      final response = await _dio.get(ApiConstants.productCategories);
      final data = response.data;
      if (data is List) {
        return data.map((e) {
          if (e is Map) return e['category']?.toString() ?? '';
          return e.toString();
        }).where((s) => s.isNotEmpty).toList();
      }
      return [];
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ProductModel> createProduct(Map<String, dynamic> data) async {
    try {
      final response = await _dio.post(ApiConstants.products, data: data);
      return ProductModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ProductModel> updateProduct(
      int id, Map<String, dynamic> data) async {
    try {
      final response =
          await _dio.put(ApiConstants.productById(id), data: data);
      return ProductModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> deleteProduct(int id) async {
    try {
      await _dio.delete(ApiConstants.productById(id));
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final productServiceProvider =
    Provider<ProductService>((ref) => ProductService(ref.watch(dioProvider)));
