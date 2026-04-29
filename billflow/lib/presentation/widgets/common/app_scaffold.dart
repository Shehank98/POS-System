import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/notification_provider.dart';

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

// Max nav items before collapsing extras into "More"
const _kMaxNavItems = 5;

class AppScaffold extends ConsumerWidget {
  final Widget child;
  const AppScaffold({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationCountProvider);
    final isCarService = ref.watch(isCarServiceShopProvider);

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

    // ── Car Service navigation ─────────────────────────────────────
    if (isCarService) {
      return _CarServiceScaffold(
          child: child, user: user, unread: unread);
    }

    // ── Standard retail navigation ─────────────────────────────────
    final customersOn = ref.watch(customersEnabledProvider);
    final analyticsOn = ref.watch(analyticsEnabledProvider);

    final allItems = <_NavItem>[
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
      if (customersOn)
        const _NavItem(
          route: '/customers',
          icon: Icons.people_outline,
          selectedIcon: Icons.people,
          label: 'Customers',
        ),
      if (analyticsOn)
        const _NavItem(
          route: '/analytics',
          icon: Icons.insights_outlined,
          selectedIcon: Icons.insights,
          label: 'Analytics',
        ),
      if (user?.isManagerOrAbove == true)
        const _NavItem(
          route: '/audit-log',
          icon: Icons.history_outlined,
          selectedIcon: Icons.history,
          label: 'Audit Log',
        ),
      const _NavItem(
        route: '/reports',
        icon: Icons.bar_chart_outlined,
        selectedIcon: Icons.bar_chart,
        label: 'Reports',
      ),
      const _NavItem(
        route: '/settings',
        icon: Icons.settings_outlined,
        selectedIcon: Icons.settings,
        label: 'Settings',
      ),
    ];

    final bool hasOverflow = allItems.length >= _kMaxNavItems;
    final visibleItems = hasOverflow
        ? allItems.sublist(0, _kMaxNavItems - 1)
        : allItems;
    final overflowItems = hasOverflow
        ? allItems.sublist(_kMaxNavItems - 1)
        : <_NavItem>[];

    final location = GoRouterState.of(context).matchedLocation;
    final visibleRoutes = visibleItems.map((e) => e.route).toList();

    final isOverflowActive = overflowItems.any((e) => location.startsWith(e.route));
    final visibleIdx = visibleRoutes.indexWhere((r) => location.startsWith(r));
    final selectedIndex = isOverflowActive
        ? visibleItems.length
        : (visibleIdx < 0 ? 0 : visibleIdx);

    void openMoreSheet() {
      showModalBottomSheet(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        builder: (_) => _MoreSheet(
          items: overflowItems,
          currentLocation: location,
          unread: unread,
          onTap: (route) {
            Navigator.pop(context);
            context.go(route);
          },
        ),
      );
    }

    final navDestinations = <NavigationDestination>[
      ...visibleItems.map((item) => NavigationDestination(
            icon: Icon(item.icon),
            selectedIcon: Icon(item.selectedIcon),
            label: item.label,
          )),
      if (hasOverflow)
        NavigationDestination(
          icon: Badge(
            isLabelVisible: unread > 0 &&
                overflowItems.any((e) => e.route == '/reports'),
            label: Text('$unread'),
            child: const Icon(Icons.more_horiz_outlined),
          ),
          selectedIcon: const Icon(Icons.more_horiz),
          label: 'More',
        ),
    ];

    return Scaffold(
      body: child,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (user?.inGracePeriod ?? false)
            _GracePeriodBanner(graceDays: user!.graceDaysRemaining),
          NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: (i) {
              if (hasOverflow && i == visibleItems.length) {
                openMoreSheet();
              } else {
                context.go(visibleRoutes[i]);
              }
            },
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: navDestinations,
          ),
        ],
      ),
    );
  }
}

// ── Car Service Scaffold ──────────────────────────────────────────────────────
class _CarServiceScaffold extends ConsumerWidget {
  final Widget child;
  final dynamic user;
  final int unread;

  const _CarServiceScaffold({
    required this.child,
    required this.user,
    required this.unread,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isStaff = user?.role == 'staff';
    final productsEnabled = ref.watch(carServiceProductsEnabledProvider);
    final location = GoRouterState.of(context).matchedLocation;

    // My Jobs tab — visible to all roles but shown in main nav for staff
    // For owners/managers it goes in More sheet; for staff it's a main tab
    final myJobsItem = const _NavItem(
      route: '/carwash',
      icon: Icons.work_outline,
      selectedIcon: Icons.work,
      label: 'My Jobs',
    );

    // Build visible nav based on role
    List<_NavItem> visibleItems;
    List<_NavItem> overflowItems;

    if (isStaff) {
      // Staff: Dashboard | My Jobs | Pre-Bookings | More
      visibleItems = [
        const _NavItem(
          route: '/carwash',
          icon: Icons.dashboard_outlined,
          selectedIcon: Icons.dashboard,
          label: 'Dashboard',
        ),
        myJobsItem,
        const _NavItem(
          route: '/carwash/bookings',
          icon: Icons.calendar_today_outlined,
          selectedIcon: Icons.calendar_today,
          label: 'Pre-Bookings',
        ),
      ];
      overflowItems = [];
    } else {
      // Owner/Manager: Dashboard | Pre-Bookings | Services | More
      visibleItems = [
        const _NavItem(
          route: '/carwash',
          icon: Icons.dashboard_outlined,
          selectedIcon: Icons.dashboard,
          label: 'Dashboard',
        ),
        const _NavItem(
          route: '/carwash/bookings',
          icon: Icons.calendar_today_outlined,
          selectedIcon: Icons.calendar_today,
          label: 'Pre-Bookings',
        ),
        const _NavItem(
          route: '/carwash/services',
          icon: Icons.build_outlined,
          selectedIcon: Icons.build,
          label: 'Services',
        ),
      ];
      overflowItems = [
        if (productsEnabled)
          const _NavItem(
            route: '/products',
            icon: Icons.inventory_2_outlined,
            selectedIcon: Icons.inventory_2,
            label: 'Products',
          ),
        const _NavItem(
          route: '/billing',
          icon: Icons.credit_card_outlined,
          selectedIcon: Icons.credit_card,
          label: 'Billing',
        ),
        const _NavItem(
          route: '/settings',
          icon: Icons.settings_outlined,
          selectedIcon: Icons.settings,
          label: 'Settings',
        ),
      ];
    }

    final isOverflowActive = overflowItems.any((e) => location.startsWith(e.route));
    final visibleRoutes = visibleItems.map((e) => e.route).toList();

    // Exact match for /carwash to avoid matching /carwash/bookings etc.
    int selectedIndex;
    if (isOverflowActive) {
      selectedIndex = visibleItems.length;
    } else {
      // Special: /carwash should only match if location IS /carwash exactly
      selectedIndex = 0;
      for (int i = 0; i < visibleItems.length; i++) {
        final route = visibleItems[i].route;
        if (route == '/carwash') {
          if (location == '/carwash') {
            selectedIndex = i;
            break;
          }
        } else if (location.startsWith(route)) {
          selectedIndex = i;
          break;
        }
      }
    }

    final hasOverflow = overflowItems.isNotEmpty;

    void openMoreSheet() {
      showModalBottomSheet(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        builder: (_) => _MoreSheet(
          items: overflowItems,
          currentLocation: location,
          unread: 0,
          onTap: (route) {
            Navigator.pop(context);
            context.go(route);
          },
        ),
      );
    }

    final navDestinations = <NavigationDestination>[
      ...visibleItems.map((item) => NavigationDestination(
            icon: Icon(item.icon),
            selectedIcon: Icon(item.selectedIcon),
            label: item.label,
          )),
      if (hasOverflow)
        const NavigationDestination(
          icon: Icon(Icons.more_horiz_outlined),
          selectedIcon: Icon(Icons.more_horiz),
          label: 'More',
        ),
    ];

    return Scaffold(
      body: child,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (user?.inGracePeriod ?? false)
            _GracePeriodBanner(graceDays: user!.graceDaysRemaining),
          NavigationBar(
            selectedIndex: selectedIndex,
            onDestinationSelected: (i) {
              if (hasOverflow && i == visibleItems.length) {
                openMoreSheet();
              } else {
                context.go(visibleRoutes[i]);
              }
            },
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: navDestinations,
          ),
        ],
      ),
    );
  }
}

// ── More bottom sheet ─────────────────────────────────────────────────────────
class _MoreSheet extends StatelessWidget {
  final List<_NavItem> items;
  final String currentLocation;
  final int unread;
  final void Function(String route) onTap;

  const _MoreSheet({
    required this.items,
    required this.currentLocation,
    required this.unread,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: cs.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ...items.indexed.map((entry) {
              final (idx, item) = entry;
              final isActive = currentLocation.startsWith(item.route);
              return ListTile(
                leading: Icon(
                  isActive ? item.selectedIcon : item.icon,
                  color: isActive ? cs.primary : cs.onSurfaceVariant,
                ),
                title: Text(
                  item.label,
                  style: TextStyle(
                    fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                    color: isActive ? cs.primary : null,
                  ),
                ),
                trailing: item.route == '/reports' && unread > 0
                    ? Badge(label: Text('$unread'))
                    : null,
                onTap: () => onTap(item.route),
              )
                  .animate()
                  .fadeIn(
                      delay: Duration(milliseconds: idx * 40),
                      duration: 250.ms)
                  .slideX(
                      begin: 0.05,
                      end: 0,
                      delay: Duration(milliseconds: idx * 40),
                      duration: 250.ms);
            }),
          ],
        ),
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
