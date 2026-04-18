import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/customer_model.dart';

class CustomerService {
  final Dio _dio;
  CustomerService(this._dio);

  Future<List<TopCustomer>> getTop({int limit = 20}) async {
    try {
      final res = await _dio.get(ApiConstants.customersTop,
          queryParameters: {'limit': limit});
      final list = (res.data as List<dynamic>?) ?? [];
      return list
          .map((e) => TopCustomer.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<CustomerInsights> getInsights(String phone) async {
    try {
      final res = await _dio.get(ApiConstants.customersInsights,
          queryParameters: {'phone': phone});
      return CustomerInsights.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final customerServiceProvider = Provider<CustomerService>(
    (ref) => CustomerService(ref.watch(dioProvider)));
