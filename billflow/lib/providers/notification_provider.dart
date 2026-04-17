import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/notification_model.dart';
import '../data/services/notification_service.dart';

class NotificationNotifier
    extends AsyncNotifier<List<AppNotification>> {
  @override
  Future<List<AppNotification>> build() async {
    final result =
        await ref.read(notificationServiceProvider).getAll();
    return result.notifications;
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final result =
          await ref.read(notificationServiceProvider).getAll();
      return result.notifications;
    });
  }

  Future<void> markRead(int id) async {
    await ref.read(notificationServiceProvider).markRead(id);
    state = AsyncData(state.valueOrNull
            ?.map((n) => n.id == id ? n.copyWith(isRead: true) : n)
            .toList() ??
        []);
  }

  Future<void> markAllRead() async {
    await ref.read(notificationServiceProvider).markAllRead();
    state = AsyncData(state.valueOrNull
            ?.map((n) => n.copyWith(isRead: true))
            .toList() ??
        []);
  }
}

final notificationsProvider =
    AsyncNotifierProvider<NotificationNotifier, List<AppNotification>>(
        NotificationNotifier.new);

final unreadNotificationCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(notificationsProvider);
  return notifications.valueOrNull?.where((n) => !n.isRead).length ?? 0;
});
