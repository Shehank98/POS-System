import 'package:dio/dio.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final bool isUnauthorized;
  final bool isForbidden;
  final bool isNetworkError;

  const ApiException({
    required this.message,
    this.statusCode,
    this.isUnauthorized = false,
    this.isForbidden = false,
    this.isNetworkError = false,
  });

  factory ApiException.fromDioException(DioException e) {
    final statusCode = e.response?.statusCode;
    String message = 'Something went wrong. Please try again.';

    if (e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return const ApiException(
        message: 'No internet connection. Check your network.',
        isNetworkError: true,
      );
    }

    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      message = data['error']?.toString() ?? data['message']?.toString() ?? message;
    }

    return ApiException(
      message: message,
      statusCode: statusCode,
      isUnauthorized: statusCode == 401,
      isForbidden: statusCode == 403,
    );
  }

  @override
  String toString() => message;
}
