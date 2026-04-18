import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/notification_provider.dart';

class _NavItem {
  final String route;
  final Icon icon;
  final Icon selectedIcon;
  final String label;

  const _NavItem({
    required this.route,
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
}

class AppScaffold extends ConsumerWidget {
  final Widget child;
  const AppScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationCountProvider);

    // Build the nav item list based on live feature flags
    final items = <_NavItem>[
      const _NavItem(
        route: '/dashboard',
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home),
        label: 'Home',
      ),
      if (user?.posEnabled ?? true)
        const _NavItem(
          route: '/sales',
          icon: Icon(Icons.point_of_sale_outlined),
          selectedIcon: Icon(Icons.point_of_sale),
          label: 'POS',
        ),
      const _NavItem(
        route: '/transactions',
        icon: Icon(Icons.receipt_long_outlined),
        selectedIcon: Icon(Icons.receipt_long),
        label: 'Sales',
      ),
      if (user?.productsEnabled ?? true)
        const _NavItem(
          route: '/products',
          icon: Icon(Icons.inventory_2_outlined),
          selectedIcon: Icon(Icons.inventory_2),
          label: 'Products',
        ),
      if (user?.reportsEnabled ?? true)
        const _NavItem(
          route: '/reports',
          icon: Icon(Icons.bar_chart_outlined),
          selectedIcon: Icon(Icons.bar_chart),
          label: 'Reports',
        ),
    ];

    final routes = items.map((e) => e.route).toList();
    final location = GoRouterState.of(context).matchedLocation;
    final idx = routes.indexWhere((r) => location.startsWith(r));
    final selectedIndex = idx < 0 ? 0 : idx;

    // Subscription locked: show only billing & settings, skip full nav
    final isLocked = (user?.readOnly ?? false) && !(user?.inGracePeriod ?? false);
    if (isLocked) {
      return Scaffold(
        body: child,
        bottomNavigationBar: NavigationBar(
          selectedIndex: 0,
          onDestinationSelected: (_) {},
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.credit_card_outlined),
              selectedIcon: Icon(Icons.credit_card),
              label: 'Billing',
            ),
          ],
        ),
      );
    }

    return Scaffold(
      body: child,
      // Grace period banner shown above nav bar
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (user?.inGracePeriod ?? false)
            _GracePeriodBanner(graceDays: user!.graceDaysRemaining, ref: ref),
          NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: (i) => context.go(routes[i]),
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: items.map((item) {
              // Notifications badge on reports item if notifications are in nav
              final isNotifRoute = item.route == '/reports' &&
                  unread > 0 &&
                  !(user?.notificationsEnabled ?? true);
              return NavigationDestination(
                icon: isNotifRoute
                    ? Badge(
                        isLabelVisible: unread > 0,
                        label: Text('$unread'),
                        child: item.icon,
                      )
                    : item.icon,
                selectedIcon: item.selectedIcon,
                label: item.label,
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _GracePeriodBanner extends StatelessWidget {
  final int graceDays;
  final WidgetRef ref;

  const _GracePeriodBanner({required this.graceDays, required this.ref});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/billing'),
      child: Container(
        width: double.infinity,
        color: Colors.orange,
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded,
                color: Colors.white, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Subscription expires in $graceDays day${graceDays == 1 ? '' : 's'} — Tap to renew',
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600),
              ),
            ),
            const Icon(Icons.chevron_right, color: Colors.white, size: 16),
          ],
        ),
      ),
    );
  }
}
