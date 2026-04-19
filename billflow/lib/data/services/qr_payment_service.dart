import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';

class QrPaymentSession {
  final String reference;
  final String qrData;
  final String qrReference;
  final DateTime expiresAt;
  final double amount;

  QrPaymentSession({
    required this.reference,
    required this.qrData,
    required this.qrReference,
    required this.expiresAt,
    required this.amount,
  });

  factory QrPaymentSession.fromJson(Map<String, dynamic> json) {
    return QrPaymentSession(
      reference: json['reference'] as String,
      qrData: json['qr_data'] as String,
      qrReference: json['qr_reference'] as String? ?? '',
      expiresAt: DateTime.parse(json['expires_at'] as String),
      amount: (json['amount'] as num).toDouble(),
    );
  }
}

class QrPaymentStatus {
  final int paymentStatus;
  final double amount;

  QrPaymentStatus({required this.paymentStatus, required this.amount});

  factory QrPaymentStatus.fromJson(Map<String, dynamic> json) {
    return QrPaymentStatus(
      paymentStatus: json['payment_status'] as int,
      amount: (json['amount'] as num).toDouble(),
    );
  }
}

class QrPaymentService {
  final Dio _dio;
  QrPaymentService(this._dio);

  Future<QrPaymentSession> generateQR({
    required double amount,
    int? preOrderId,
  }) async {
    try {
      final body = <String, dynamic>{'amount': amount};
      if (preOrderId != null) {
        body['session_type'] = 'preorder';
        body['pre_order_id'] = preOrderId;
      }
      final res = await _dio.post(ApiConstants.qrGenerate, data: body);
      return QrPaymentSession.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<QrPaymentStatus> checkStatus(String reference) async {
    try {
      final res = await _dio.get(ApiConstants.qrStatus(reference));
      return QrPaymentStatus.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final qrPaymentServiceProvider = Provider<QrPaymentService>(
    (ref) => QrPaymentService(ref.watch(dioProvider)));
