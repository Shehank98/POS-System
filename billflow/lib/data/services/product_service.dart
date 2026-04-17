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
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null) 'category': category,
        if (lowStock == true) 'low_stock': 'true',
      };
      final response = await _dio.get(ApiConstants.products,
          queryParameters: params);
      final data = response.data;
      final List<dynamic> raw = data is List ? data : (data['products'] as List<dynamic>? ?? []);
      final products = raw
          .map((e) => ProductModel.fromJson(e as Map<String, dynamic>))
          .toList();
      final total = (data is Map ? data['total'] as int? : null) ?? products.length;
      return (products: products, total: total);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
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
