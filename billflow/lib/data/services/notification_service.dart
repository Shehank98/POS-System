import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../models/notification_model.dart';

class NotificationService {
  final Dio _dio;
  NotificationService(this._dio);

  Future<({List<AppNotification> notifications, int unreadCount})>
      getAll() async {
    try {
      final response = await _dio.get(ApiConstants.notifications);
      final data = response.data;
      final List<dynamic> raw =
          (data is Map ? data['notifications'] : data) as List<dynamic>? ?? [];
      final notifications = raw
          .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
          .toList();
      final unreadCount =
          (data is Map ? data['unread_count'] as int? : null) ??
              notifications.where((n) => !n.isRead).length;
      return (notifications: notifications, unreadCount: unreadCount);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> markRead(int id) async {
    try {
      await _dio.put(ApiConstants.notificationMarkRead(id));
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<void> markAllRead() async {
    try {
      await _dio.put(ApiConstants.notificationsReadAll);
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }
}

final notificationServiceProvider = Provider<NotificationService>(
    (ref) => NotificationService(ref.watch(dioProvider)));
