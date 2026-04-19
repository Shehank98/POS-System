import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/qr_payment_model.dart';

class QrPaymentService {
  final Dio _dio;
  QrPaymentService(this._dio);

  Future<QrPaymentSession> generateQR({
    required double amount,
    String sessionType = 'pos',
    int? preOrderId,
  }) async {
    try {
      final res = await _dio.post('/qr/generate', data: {
        'amount': amount,
        'session_type': sessionType,
        if (preOrderId != null) 'pre_order_id': preOrderId,
      });
      return QrPaymentSession.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<QrPaymentStatus> checkStatus(String reference) async {
    try {
      final res = await _dio.get('/qr/status/$reference');
      return QrPaymentStatus.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final qrPaymentServiceProvider = Provider<QrPaymentService>(
  (ref) => QrPaymentService(ref.watch(dioProvider)),
);
