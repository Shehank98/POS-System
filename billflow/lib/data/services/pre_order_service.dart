import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/pre_order_model.dart';

class PreOrderService {
  final Dio _dio;
  PreOrderService(this._dio);

  Future<List<PreOrderModel>> listOrders({String? status}) async {
    try {
      final params = status != null ? {'status': status} : null;
      final res = await _dio.get('/pre-orders', queryParameters: params);
      final orders = (res.data['orders'] as List)
          .cast<Map<String, dynamic>>()
          .map(PreOrderModel.fromJson)
          .toList();
      return orders;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> updateStatus(int id, String status) async {
    try {
      await _dio.put('/pre-orders/$id/status', data: {'status': status});
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> markAsPaid(int id) async {
    try {
      await _dio.put('/pre-orders/$id/pay');
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final preOrderServiceProvider = Provider<PreOrderService>(
    (ref) => PreOrderService(ref.watch(dioProvider)));
