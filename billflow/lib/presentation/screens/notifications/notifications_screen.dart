import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../providers/notification_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';
import '../../widgets/notifications/notification_tile.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () =>
                ref.read(notificationsProvider.notifier).markAllRead(),
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(notificationsProvider.notifier).refresh(),
        child: notifAsync.when(
          loading: () => const LoadingOverlay(),
          error: (e, _) => ErrorView(message: e.toString()),
          data: (notifications) => notifications.isEmpty
              ? const Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_off_outlined, size: 64),
                      SizedBox(height: 16),
                      Text('No notifications'),
                    ],
                  ),
                )
              : ListView.separated(
                  itemCount: notifications.length,
                  separatorBuilder: (_, __) =>
                      const Divider(height: 1, indent: 16),
                  itemBuilder: (ctx, i) {
                    final n = notifications[i];
                    return NotificationTile(
                      notification: n,
                      onTap: () {
                        ref
                            .read(notificationsProvider.notifier)
                            .markRead(n.id);
                        showModalBottomSheet(
                          context: ctx,
                          shape: const RoundedRectangleBorder(
                              borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(20))),
                          builder: (_) => Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(n.title,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 18)),
                                const SizedBox(height: 12),
                                Text(n.message, style: const TextStyle(fontSize: 15)),
                                const SizedBox(height: 16),
                              ],
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
        ),
      ),
    );
  }
}
