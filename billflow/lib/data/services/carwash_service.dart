import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/carwash_model.dart';

class CarwashApiService {
  final Dio _dio;
  CarwashApiService(this._dio);

  Future<CarwashDashboard> getDashboard() async {
    try {
      final res = await _dio.get(ApiConstants.carwashDashboard);
      return CarwashDashboard.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<List<WashService>> listServices() async {
    try {
      final res = await _dio.get(ApiConstants.carwashServices);
      final data = res.data;
      final list = (data is Map ? (data['services'] ?? data['data']) : data)
              as List<dynamic>? ??
          [];
      return list
          .map((e) => WashService.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<CarwashJobListResult> listJobs({String? status}) async {
    try {
      final res = await _dio.get(
        ApiConstants.carwashJobs,
        queryParameters: {if (status != null) 'status': status},
      );
      final data = res.data;
      if (data is Map) {
        return CarwashJobListResult.fromJson(data as Map<String, dynamic>);
      }
      final list = data as List<dynamic>;
      return CarwashJobListResult(
        jobs: list
            .map((e) => CarwashJob.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: list.length,
      );
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<CarwashJob> getJob(int id) async {
    try {
      final res = await _dio.get(ApiConstants.carwashJobById(id));
      return CarwashJob.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<CarwashJob> createJob({
    required String vehicleNumber,
    String? vehicleType,
    String? customerName,
    String? customerPhone,
    String? notes,
    required List<Map<String, dynamic>> items,
  }) async {
    try {
      final res = await _dio.post(ApiConstants.carwashJobs, data: {
        'vehicle_number': vehicleNumber,
        if (vehicleType != null) 'vehicle_type': vehicleType,
        if (customerName != null) 'customer_name': customerName,
        if (customerPhone != null) 'customer_phone': customerPhone,
        if (notes != null) 'notes': notes,
        'items': items,
      });
      return CarwashJob.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<CarwashJob> updateJobStatus(int id, String status) async {
    try {
      final res = await _dio.patch(
        ApiConstants.carwashJobStatus(id),
        data: {'status': status},
      );
      return CarwashJob.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<CarwashJob> payJob(int id, String paymentMethod) async {
    try {
      final res = await _dio.post(
        ApiConstants.carwashJobPay(id),
        data: {'payment_method': paymentMethod},
      );
      return CarwashJob.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final carwashApiServiceProvider = Provider<CarwashApiService>(
    (ref) => CarwashApiService(ref.watch(dioProvider)));
