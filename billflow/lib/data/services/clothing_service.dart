import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/clothing_model.dart';

class ClothingService {
  final Dio _dio;
  ClothingService(this._dio);

  Future<ClothingListResult> listProducts({
    String? search,
    String? category,
  }) async {
    try {
      final res = await _dio.get(ApiConstants.clothingProducts,
          queryParameters: {
            if (search != null && search.isNotEmpty) 'search': search,
            if (category != null) 'category': category,
          });
      final data = res.data;
      if (data is Map) {
        return ClothingListResult.fromJson(data as Map<String, dynamic>);
      }
      // If API returns a plain list
      final list = data as List<dynamic>;
      return ClothingListResult(
        products: list
            .map((e) => ClothingProduct.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: list.length,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<ClothingVariant>> listVariants(int productId) async {
    try {
      final res =
          await _dio.get(ApiConstants.clothingVariants(productId));
      final data = res.data;
      final list = (data is Map ? data['variants'] : data) as List<dynamic>?
          ?? [];
      return list
          .map((e) => ClothingVariant.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<ClothingExchangeLookup> lookupTransaction({
    String? txnNumber,
    String? phone,
  }) async {
    try {
      final res = await _dio.get(ApiConstants.clothingExchangeLookup,
          queryParameters: {
            if (txnNumber != null) 'txn_number': txnNumber,
            if (phone != null) 'phone': phone,
          });
      return ClothingExchangeLookup.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final clothingServiceProvider = Provider<ClothingService>(
    (ref) => ClothingService(ref.watch(dioProvider)));
