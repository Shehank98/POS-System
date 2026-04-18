import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/notification_provider.dart';

// ── Nav item descriptor ───────────────────────────────────────────────────────
class _NavItem {
  final String route;
  final IconData icon;
  final IconData selectedIcon;
  final String label;

  const _NavItem({
    required this.route,
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
}

// ── App scaffold with feature-gated bottom nav ────────────────────────────────
// Mirrors the web Layout.jsx navigation structure:
//   Always visible : Dashboard · POS · Products · Transactions
//   Feature-gated  : Reports (reports_enabled)
//
// Subscription-locked accounts (readOnly && !inGracePeriod) can only
// access Billing — the full nav is hidden.
class AppScaffold extends ConsumerWidget {
  final Widget child;
  const AppScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationCountProvider);
    final reportsOn = ref.watch(reportsEnabledProvider);

    // Subscription lock: fully expired → only billing allowed
    final isLocked = (user?.readOnly ?? false) && !(user?.inGracePeriod ?? false);
    if (isLocked) {
      return Scaffold(
        body: child,
        bottomNavigationBar: NavigationBar(
          selectedIndex: 0,
          onDestinationSelected: (_) => context.go('/billing'),
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

    // Build nav items — base 4 always present, Reports appended when enabled
    final items = <_NavItem>[
      const _NavItem(
        route: '/dashboard',
        icon: Icons.home_outlined,
        selectedIcon: Icons.home,
        label: 'Home',
      ),
      const _NavItem(
        route: '/sales',
        icon: Icons.point_of_sale_outlined,
        selectedIcon: Icons.point_of_sale,
        label: 'POS',
      ),
      const _NavItem(
        route: '/transactions',
        icon: Icons.receipt_long_outlined,
        selectedIcon: Icons.receipt_long,
        label: 'Sales',
      ),
      const _NavItem(
        route: '/products',
        icon: Icons.inventory_2_outlined,
        selectedIcon: Icons.inventory_2,
        label: 'Products',
      ),
      if (reportsOn)
        const _NavItem(
          route: '/reports',
          icon: Icons.bar_chart_outlined,
          selectedIcon: Icons.bar_chart,
          label: 'Reports',
        ),
    ];

    final routes = items.map((e) => e.route).toList();
    final location = GoRouterState.of(context).matchedLocation;
    final idx = routes.indexWhere((r) => location.startsWith(r));
    final selectedIndex = idx < 0 ? 0 : idx;

    return Scaffold(
      body: child,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Grace-period warning banner — taps to /billing
          if (user?.inGracePeriod ?? false)
            _GracePeriodBanner(graceDays: user!.graceDaysRemaining),
          NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: (i) => context.go(routes[i]),
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: items.map((item) {
              // Notification badge on Reports when there are unread alerts
              if (item.route == '/reports' && unread > 0) {
                return NavigationDestination(
                  icon: Badge(
                    isLabelVisible: unread > 0,
                    label: Text('$unread'),
                    child: Icon(item.icon),
                  ),
                  selectedIcon: Icon(item.selectedIcon),
                  label: item.label,
                );
              }
              return NavigationDestination(
                icon: Icon(item.icon),
                selectedIcon: Icon(item.selectedIcon),
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
  const _GracePeriodBanner({required this.graceDays});

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
