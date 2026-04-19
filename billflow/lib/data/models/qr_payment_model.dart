import '../../core/utils/json_parse.dart';

class QrPaymentSession {
  final String reference;
  final String qrData;
  final String? qrReference;
  final DateTime expiresAt;
  final double amount;

  const QrPaymentSession({
    required this.reference,
    required this.qrData,
    this.qrReference,
    required this.expiresAt,
    required this.amount,
  });

  factory QrPaymentSession.fromJson(Map<String, dynamic> json) =>
      QrPaymentSession(
        reference:   json['reference'] as String,
        qrData:      json['qr_data'] as String,
        qrReference: json['qr_reference'] as String?,
        expiresAt:   DateTime.parse(json['expires_at'] as String),
        amount:      toDouble(json['amount']),
      );
}

class QrPaymentStatus {
  final int paymentStatus;
  final double amount;
  final DateTime? expiresAt;

  const QrPaymentStatus({
    required this.paymentStatus,
    required this.amount,
    this.expiresAt,
  });

  factory QrPaymentStatus.fromJson(Map<String, dynamic> json) =>
      QrPaymentStatus(
        paymentStatus: toInt(json['payment_status']),
        amount:        toDouble(json['amount']),
        expiresAt: json['expires_at'] != null
            ? DateTime.tryParse(json['expires_at'] as String)
            : null,
      );
}
