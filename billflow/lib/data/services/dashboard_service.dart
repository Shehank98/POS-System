import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/dashboard_model.dart';

class DashboardService {
  final Dio _dio;
  DashboardService(this._dio);

  Future<DashboardToday> getToday() async {
    try {
      final response = await _dio.get(ApiConstants.dashboardToday);
      return DashboardToday.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<DailyPoint>> getWeek() async {
    try {
      final response = await _dio.get(ApiConstants.dashboardWeek);
      final data = response.data;
      final List<dynamic> daily =
          (data is Map ? data['daily'] : data) as List<dynamic>? ?? [];
      return daily
          .map((e) => DailyPoint.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<DailyPoint>> getMonth() async {
    try {
      final response = await _dio.get(ApiConstants.dashboardMonth);
      final data = response.data;
      final List<dynamic> daily =
          (data is Map ? data['daily'] : data) as List<dynamic>? ?? [];
      return daily
          .map((e) => DailyPoint.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<LowStockProduct>> getLowStock({int threshold = 10}) async {
    try {
      final response = await _dio.get(ApiConstants.dashboardLowStock,
          queryParameters: {'threshold': threshold});
      final data = response.data;
      final List<dynamic> products =
          (data is Map ? data['products'] : data) as List<dynamic>? ?? [];
      return products
          .map((e) => LowStockProduct.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final dashboardServiceProvider = Provider<DashboardService>(
    (ref) => DashboardService(ref.watch(dioProvider)));
