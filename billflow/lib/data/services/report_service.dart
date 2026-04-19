import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/secure_storage.dart';
import '../models/report_model.dart';
import '../models/transaction_model.dart';

class ReportService {
  final Dio _dio;
  final SecureStorage _storage;
  ReportService(this._dio, this._storage);

  Future<TransactionSummary> getSalesSummary({
    required String startDate,
    required String endDate,
  }) async {
    try {
      final response = await _dio.get(
        ApiConstants.transactionSummary,
        queryParameters: {'start_date': startDate, 'end_date': endDate},
      );
      return TransactionSummary.fromJson(
          response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<TaxReport> getTaxReport({
    required String startDate,
    required String endDate,
  }) async {
    try {
      final response = await _dio.get(
        ApiConstants.reportsTax,
        queryParameters: {'start_date': startDate, 'end_date': endDate},
      );
      return TaxReport.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<String?> _getToken() => _storage.readToken();

  Future<Uri> buildSalesExportUrl(String startDate, String endDate,
      {String format = 'excel'}) async {
    final token = await _getToken();
    return Uri.parse(
        '${ApiConstants.baseUrl}/reports/sales?start_date=$startDate&end_date=$endDate&format=$format&token=$token');
  }

  Future<Uri> buildInventoryExportUrl() async {
    final token = await _getToken();
    return Uri.parse(
        '${ApiConstants.baseUrl}/reports/inventory?token=$token');
  }
}

final reportServiceProvider = Provider<ReportService>((ref) => ReportService(
      ref.watch(dioProvider),
      ref.watch(secureStorageProvider),
    ));
