import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/cart_item_model.dart';
import '../models/transaction_model.dart';

class TransactionService {
  final Dio _dio;
  TransactionService(this._dio);

  Future<TransactionModel> createTransaction({
    required List<CartItem> items,
    required String paymentMethod,
    double discountAmount = 0,
    String? customerPhone,
  }) async {
    try {
      final body = {
        'items': items.map((i) => i.toApiJson()).toList(),
        'payment_method': paymentMethod,
        'discount_amount': discountAmount,
        if (customerPhone != null && customerPhone.isNotEmpty)
          'customer_phone': customerPhone,
      };
      final response = await _dio.post(ApiConstants.transactions, data: body);
      return TransactionModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<({List<TransactionModel> transactions, int total})> listTransactions({
    String? startDate,
    String? endDate,
    String? paymentMethod,
    String? status,
    int page = 1,
    int limit = 30,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
        if (paymentMethod != null) 'payment_method': paymentMethod,
        if (status != null) 'status': status,
      };
      final response = await _dio.get(ApiConstants.transactions,
          queryParameters: params);
      final data = response.data;
      final List<dynamic> raw =
          data is List ? data : (data['transactions'] as List<dynamic>? ?? []);
      final transactions = raw
          .map((e) => TransactionModel.fromJson(e as Map<String, dynamic>))
          .toList();
      final total =
          (data is Map ? data['total'] as int? : null) ?? transactions.length;
      return (transactions: transactions, total: total);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<TransactionModel> getTransaction(int id) async {
    try {
      final response = await _dio.get(ApiConstants.transactionById(id));
      return TransactionModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<TransactionModel> voidTransaction(int id) async {
    try {
      final response = await _dio.post(ApiConstants.voidTransaction(id));
      return TransactionModel.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<TransactionSummary> getSummary({
    String? startDate,
    String? endDate,
  }) async {
    try {
      final params = <String, dynamic>{
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      };
      final response = await _dio.get(ApiConstants.transactionSummary,
          queryParameters: params);
      return TransactionSummary.fromJson(
          response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final transactionServiceProvider = Provider<TransactionService>(
    (ref) => TransactionService(ref.watch(dioProvider)));
