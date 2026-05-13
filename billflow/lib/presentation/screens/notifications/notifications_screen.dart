import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/notification_model.dart';
import '../../../providers/notification_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifAsync = ref.watch(notificationsProvider);
    final unreadCount = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                unreadCount > 0 ? '$unreadCount unread' : 'Up to date',
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: unreadCount > 0 ? AppColors.brand : AppColors.ink3,
                  letterSpacing: 0.4,
                ),
              ),
              Text(
                'Notifications',
                style: GoogleFonts.manrope(
                  fontSize: 24,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                  height: 1.1,
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () =>
                ref.read(notificationsProvider.notifier).markAllRead(),
            child: Text(
              'Mark all read',
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: AppColors.ink2,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.brand,
        backgroundColor: AppColors.surface,
        onRefresh: () => ref.read(notificationsProvider.notifier).refresh(),
        child: notifAsync.when(
          loading: () => const LoadingOverlay(),
          error: (e, _) => ErrorView(message: e.toString()),
          data: (notifications) => notifications.isEmpty
              ? _EmptyState()
              : _NotificationList(
                  notifications: notifications,
                  onTap: (n) {
                    ref
                        .read(notificationsProvider.notifier)
                        .markRead(n.id);
                    _showDetailSheet(context, n);
                  },
                ),
        ),
      ),
    );
  }

  void _showDetailSheet(BuildContext context, AppNotification n) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Sheet handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.hairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: AppColors.soft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    _iconForType(n.type),
                    size: 18,
                    color: _colorForType(n.type),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    n.title,
                    style: GoogleFonts.manrope(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              n.message,
              style: GoogleFonts.manrope(
                fontSize: 14,
                color: AppColors.ink2,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              relativeTime(n.createdAt),
              style: GoogleFonts.jetBrainsMono(
                fontSize: 11,
                color: AppColors.ink3,
              ),
            ),
          ],
        ),
      ),
    );
  }

  static IconData _iconForType(String type) {
    if (type == 'low_stock') return Icons.inventory_2_outlined;
    if (type == 'subscription_expiring' || type == 'subscription_expired') {
      return Icons.card_membership_outlined;
    }
    return Icons.notifications_outlined;
  }

  static Color _colorForType(String type) {
    if (type == 'low_stock') return AppColors.warn;
    if (type == 'subscription_expiring' || type == 'subscription_expired') {
      return AppColors.danger;
    }
    return AppColors.brand;
  }
}

// ── Notification list ─────────────────────────────────────────────────────────

class _NotificationList extends StatelessWidget {
  final List<AppNotification> notifications;
  final void Function(AppNotification) onTap;

  const _NotificationList({
    required this.notifications,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            border: Border.all(color: AppColors.hairline),
            borderRadius: BorderRadius.circular(16),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (int i = 0; i < notifications.length; i++) ...[
                if (i > 0)
                  const Divider(
                    height: 1,
                    thickness: 1,
                    color: AppColors.hairline,
                    indent: 62,
                  ),
                _NotificationRow(
                  notification: notifications[i],
                  isFirst: i == 0,
                  isLast: i == notifications.length - 1,
                  onTap: () => onTap(notifications[i]),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _NotificationRow extends StatelessWidget {
  final AppNotification notification;
  final bool isFirst;
  final bool isLast;
  final VoidCallback onTap;

  const _NotificationRow({
    required this.notification,
    required this.isFirst,
    required this.isLast,
    required this.onTap,
  });

  IconData get _icon {
    if (notification.isLowStock) return Icons.inventory_2_outlined;
    if (notification.isSubscription) return Icons.card_membership_outlined;
    return Icons.notifications_outlined;
  }

  Color get _accentColor {
    if (notification.isLowStock) return AppColors.warn;
    if (notification.isSubscription) return AppColors.danger;
    return AppColors.brand;
  }

  @override
  Widget build(BuildContext context) {
    BorderRadius borderRadius = BorderRadius.zero;
    if (isFirst && isLast) {
      borderRadius = BorderRadius.circular(16);
    } else if (isFirst) {
      borderRadius =
          const BorderRadius.vertical(top: Radius.circular(16));
    } else if (isLast) {
      borderRadius =
          const BorderRadius.vertical(bottom: Radius.circular(16));
    }

    return InkWell(
      onTap: onTap,
      borderRadius: borderRadius,
      child: Container(
        color: notification.isRead
            ? Colors.transparent
            : AppColors.brandSoft.withValues(alpha: 0.25),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Icon tile
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(_icon, size: 18, color: _accentColor),
            ),
            const SizedBox(width: 12),
            // Text content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          style: GoogleFonts.manrope(
                            fontSize: 13,
                            fontWeight: notification.isRead
                                ? FontWeight.w500
                                : FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        relativeTime(notification.createdAt),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 10,
                          color: AppColors.ink3,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    notification.message,
                    style: GoogleFonts.manrope(
                      fontSize: 12,
                      color: AppColors.ink2,
                      height: 1.4,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            // Unread dot
            if (!notification.isRead) ...[
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Container(
                  width: 7,
                  height: 7,
                  decoration: const BoxDecoration(
                    color: AppColors.brand,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(18),
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.notifications_off_outlined,
              size: 32,
              color: AppColors.ink3,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'No notifications',
            style: GoogleFonts.manrope(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'You\'re all caught up',
            style: GoogleFonts.manrope(
              fontSize: 13,
              color: AppColors.ink3,
            ),
          ),
        ],
      ),
    );
  }
}
