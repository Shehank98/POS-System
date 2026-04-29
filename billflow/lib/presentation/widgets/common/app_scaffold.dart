import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../data/services/biometric_service.dart';
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

class AppScaffold extends ConsumerStatefulWidget {
  final Widget child;
  const AppScaffold({super.key, required this.child});

  @override
  ConsumerState<AppScaffold> createState() => _AppScaffoldState();
}

class _AppScaffoldState extends ConsumerState<AppScaffold> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkBiometricPrompt());
  }

  Future<void> _checkBiometricPrompt() async {
    if (!mounted) return;
    final storage = ref.read(secureStorageProvider);

    final alreadyPrompted = await storage.readBiometricPrompted();
    if (alreadyPrompted) return;

    final alreadyEnabled = await storage.readBiometricEnabled();
    if (alreadyEnabled) return;

    final auth = LocalAuthentication();
    final deviceSupported = await auth.isDeviceSupported();
    if (!deviceSupported) return;

    final available = await ref.read(biometricServiceProvider).isAvailable();
    if (!available) return;
    if (!mounted) return;

    await storage.saveBiometricPrompted();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _BiometricEnrollDialog(
        onEnable: () async {
          Navigator.pop(ctx);
          final ok = await ref.read(biometricServiceProvider).authenticate();
          if (!mounted) return;
          if (ok) {
            await storage.saveBiometricEnabled(true);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Fingerprint login enabled — active on next app open'),
                backgroundColor: Colors.green,
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Fingerprint verification failed. You can enable it later in Settings.'),
              ),
            );
          }
        },
        onSkip: () => Navigator.pop(ctx),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    final unread = ref.watch(unreadNotificationCountProvider);
    final isCarService = ref.watch(isCarServiceShopProvider);

    // Subscription lock: fully expired → only billing allowed
    final isLocked = (user?.readOnly ?? false) && !(user?.inGracePeriod ?? false);
    if (isLocked) {
      return Scaffold(
        body: widget.child,
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
          child: widget.child, user: user, unread: unread);
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
      body: widget.child,
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

// ── Biometric enroll dialog ───────────────────────────────────────────────────
class _BiometricEnrollDialog extends StatelessWidget {
  final VoidCallback onEnable;
  final VoidCallback onSkip;
  const _BiometricEnrollDialog({required this.onEnable, required this.onSkip});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      contentPadding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 72, height: 72,
          decoration: BoxDecoration(
            color: cs.primaryContainer,
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.fingerprint,
              size: 40, color: cs.onPrimaryContainer),
        ),
        const SizedBox(height: 16),
        Text('Enable Fingerprint Login?',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold),
            textAlign: TextAlign.center),
        const SizedBox(height: 8),
        Text(
          'Log in faster next time using your fingerprint instead of your password.',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: cs.onSurfaceVariant),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
      ]),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      actions: [
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onEnable,
            icon: const Icon(Icons.fingerprint, size: 18),
            label: const Text('Enable Fingerprint'),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: TextButton(
            onPressed: onSkip,
            child: const Text('Not Now'),
          ),
        ),
      ],
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
