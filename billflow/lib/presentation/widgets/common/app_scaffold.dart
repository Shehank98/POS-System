import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../data/services/biometric_service.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/notification_provider.dart';

class _NavItem {
  final String route;
  final Widget icon;
  final Widget selectedIcon;
  final String label;

  const _NavItem({
    required this.route,
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });
}

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
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _checkBiometricPrompt());
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
              SnackBar(
                content: Text(
                  'Fingerprint login enabled',
                  style: GoogleFonts.manrope(
                      fontSize: 13, fontWeight: FontWeight.w500),
                ),
                backgroundColor: AppColors.brand,
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
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

    final isLocked =
        (user?.readOnly ?? false) && !(user?.inGracePeriod ?? false);
    if (isLocked) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: widget.child,
        bottomNavigationBar: _BillFlowNavBar(
          items: [
            _NavItem(
              route: '/billing',
              icon: const Icon(Icons.credit_card_outlined),
              selectedIcon: const Icon(Icons.credit_card),
              label: 'Billing',
            ),
          ],
          selectedIndex: 0,
          onTap: (_) => context.go('/billing'),
        ),
      );
    }

    if (isCarService) {
      return _CarServiceScaffold(
          child: widget.child, user: user, unread: unread);
    }

    final customersOn = ref.watch(customersEnabledProvider);
    final analyticsOn = ref.watch(analyticsEnabledProvider);

    // Primary 4 items always in bottom nav
    final primaryItems = <_NavItem>[
      _NavItem(
        route: '/sales',
        icon: const Icon(Icons.shopping_cart_outlined),
        selectedIcon: const Icon(Icons.shopping_cart),
        label: 'Sale',
      ),
      _NavItem(
        route: '/dashboard',
        icon: const Icon(Icons.bar_chart_outlined),
        selectedIcon: const Icon(Icons.bar_chart),
        label: 'Today',
      ),
      _NavItem(
        route: '/products',
        icon: const Icon(Icons.inventory_2_outlined),
        selectedIcon: const Icon(Icons.inventory_2),
        label: 'Catalog',
      ),
      _NavItem(
        route: '/transactions',
        icon: const Icon(Icons.receipt_long_outlined),
        selectedIcon: const Icon(Icons.receipt_long),
        label: 'Orders',
      ),
    ];

    // Overflow items in "More" sheet
    final overflowItems = <_NavItem>[
      const _NavItem(
        route: '/reports',
        icon: Icon(Icons.summarize_outlined),
        selectedIcon: Icon(Icons.summarize),
        label: 'Reports',
      ),
      if (customersOn)
        const _NavItem(
          route: '/customers',
          icon: Icon(Icons.people_outline),
          selectedIcon: Icon(Icons.people),
          label: 'Customers',
        ),
      if (analyticsOn)
        const _NavItem(
          route: '/analytics',
          icon: Icon(Icons.insights_outlined),
          selectedIcon: Icon(Icons.insights),
          label: 'Analytics',
        ),
      if (user?.isManagerOrAbove == true)
        const _NavItem(
          route: '/audit-log',
          icon: Icon(Icons.history_outlined),
          selectedIcon: Icon(Icons.history),
          label: 'Audit Log',
        ),
      const _NavItem(
        route: '/pre-orders',
        icon: Icon(Icons.pending_actions_outlined),
        selectedIcon: Icon(Icons.pending_actions),
        label: 'Pre-orders',
      ),
      const _NavItem(
        route: '/notifications',
        icon: Icon(Icons.notifications_outlined),
        selectedIcon: Icon(Icons.notifications),
        label: 'Notifications',
      ),
      const _NavItem(
        route: '/billing',
        icon: Icon(Icons.credit_card_outlined),
        selectedIcon: Icon(Icons.credit_card),
        label: 'Billing',
      ),
      const _NavItem(
        route: '/settings',
        icon: Icon(Icons.settings_outlined),
        selectedIcon: Icon(Icons.settings),
        label: 'Settings',
      ),
    ];

    final location = GoRouterState.of(context).matchedLocation;
    final primaryRoutes = primaryItems.map((e) => e.route).toList();
    final isOverflowActive = overflowItems.any((e) => location.startsWith(e.route));
    final primaryIdx =
        primaryRoutes.indexWhere((r) => location.startsWith(r));
    final selectedIndex = isOverflowActive
        ? primaryItems.length
        : (primaryIdx < 0 ? 0 : primaryIdx);

    void openMoreSheet() {
      HapticFeedback.lightImpact();
      showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
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

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: widget.child,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (user?.inGracePeriod ?? false)
            _GracePeriodBanner(graceDays: user!.graceDaysRemaining),
          _BillFlowNavBar(
            items: [
              ...primaryItems,
              _NavItem(
                route: '__more__',
                icon: unread > 0
                    ? Badge(
                        label: Text('$unread',
                            style: GoogleFonts.jetBrainsMono(fontSize: 9)),
                        child: const Icon(Icons.more_horiz_outlined),
                      )
                    : const Icon(Icons.more_horiz_outlined),
                selectedIcon: const Icon(Icons.more_horiz),
                label: 'More',
              ),
            ],
            selectedIndex: isOverflowActive ? primaryItems.length : selectedIndex,
            onTap: (i) {
              if (i == primaryItems.length) {
                openMoreSheet();
              } else {
                HapticFeedback.selectionClick();
                context.go(primaryRoutes[i]);
              }
            },
          ),
        ],
      ),
    );
  }
}

// ── BillFlow bottom nav bar ───────────────────────────────────────────────────
class _BillFlowNavBar extends StatelessWidget {
  final List<_NavItem> items;
  final int selectedIndex;
  final void Function(int) onTap;

  const _BillFlowNavBar({
    required this.items,
    required this.selectedIndex,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark
        ? AppColors.cardDark.withValues(alpha: 0.96)
        : AppColors.surface.withValues(alpha: 0.96);

    return Container(
      decoration: BoxDecoration(
        color: bg,
        border: Border(
          top: BorderSide(color: AppColors.hairline, width: 1),
        ),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 58,
          child: Row(
            children: items.indexed.map((entry) {
              final (i, item) = entry;
              final isSelected = i == selectedIndex;
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onTap(i),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 150),
                        child: IconTheme(
                          key: ValueKey(isSelected),
                          data: IconThemeData(
                            color: isSelected
                                ? AppColors.ink
                                : AppColors.ink3,
                            size: 22,
                          ),
                          child: isSelected ? item.selectedIcon : item.icon,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        item.label,
                        style: GoogleFonts.manrope(
                          fontSize: 10,
                          fontWeight: isSelected
                              ? FontWeight.w600
                              : FontWeight.w500,
                          color: isSelected ? AppColors.ink : AppColors.ink3,
                          letterSpacing: 0.01,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ),
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

    List<_NavItem> visibleItems;
    List<_NavItem> overflowItems;

    if (isStaff) {
      visibleItems = [
        const _NavItem(
          route: '/carwash',
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Dashboard',
        ),
        const _NavItem(
          route: '/carwash/bookings',
          icon: Icon(Icons.calendar_today_outlined),
          selectedIcon: Icon(Icons.calendar_today),
          label: 'Bookings',
        ),
      ];
      overflowItems = [];
    } else {
      visibleItems = [
        const _NavItem(
          route: '/carwash',
          icon: Icon(Icons.dashboard_outlined),
          selectedIcon: Icon(Icons.dashboard),
          label: 'Dashboard',
        ),
        const _NavItem(
          route: '/carwash/bookings',
          icon: Icon(Icons.calendar_today_outlined),
          selectedIcon: Icon(Icons.calendar_today),
          label: 'Bookings',
        ),
        const _NavItem(
          route: '/carwash/services',
          icon: Icon(Icons.build_outlined),
          selectedIcon: Icon(Icons.build),
          label: 'Services',
        ),
      ];
      overflowItems = [
        if (productsEnabled)
          const _NavItem(
            route: '/products',
            icon: Icon(Icons.inventory_2_outlined),
            selectedIcon: Icon(Icons.inventory_2),
            label: 'Products',
          ),
        const _NavItem(
          route: '/billing',
          icon: Icon(Icons.credit_card_outlined),
          selectedIcon: Icon(Icons.credit_card),
          label: 'Billing',
        ),
        const _NavItem(
          route: '/settings',
          icon: Icon(Icons.settings_outlined),
          selectedIcon: Icon(Icons.settings),
          label: 'Settings',
        ),
      ];
    }

    final isOverflowActive =
        overflowItems.any((e) => location.startsWith(e.route));
    final visibleRoutes = visibleItems.map((e) => e.route).toList();

    int selectedIndex;
    if (isOverflowActive) {
      selectedIndex = visibleItems.length;
    } else {
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
        backgroundColor: Colors.transparent,
        isScrollControlled: true,
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

    final navItems = <_NavItem>[
      ...visibleItems,
      if (hasOverflow)
        const _NavItem(
          route: '__more__',
          icon: Icon(Icons.more_horiz_outlined),
          selectedIcon: Icon(Icons.more_horiz),
          label: 'More',
        ),
    ];

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: child,
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (user?.inGracePeriod ?? false)
            _GracePeriodBanner(graceDays: user!.graceDaysRemaining),
          _BillFlowNavBar(
            items: navItems,
            selectedIndex:
                isOverflowActive ? visibleItems.length : selectedIndex,
            onTap: (i) {
              if (hasOverflow && i == visibleItems.length) {
                openMoreSheet();
              } else {
                context.go(visibleRoutes[i]);
              }
            },
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark ? AppColors.cardDark : AppColors.surface;

    return Container(
      decoration: BoxDecoration(
        color: bg,
        borderRadius:
            const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.hairline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'MORE',
                  style: GoogleFonts.manrope(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.12,
                    color: AppColors.ink3,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            ...items.indexed.map((entry) {
              final (idx, item) = entry;
              final isActive = currentLocation.startsWith(item.route);
              final isNotif = item.route == '/notifications';
              return ListTile(
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 2),
                leading: Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color:
                        isActive ? AppColors.ink : AppColors.soft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: IconTheme(
                    data: IconThemeData(
                      color: isActive ? Colors.white : AppColors.ink2,
                      size: 18,
                    ),
                    child: isActive ? item.selectedIcon : item.icon,
                  ),
                ),
                title: Text(
                  item.label,
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    fontWeight:
                        isActive ? FontWeight.w600 : FontWeight.w500,
                    color: isActive ? AppColors.ink : AppColors.ink,
                  ),
                ),
                trailing: isNotif && unread > 0
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.danger,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          '$unread',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      )
                    : Icon(Icons.chevron_right,
                        color: AppColors.ink3, size: 16),
                onTap: () => onTap(item.route),
              )
                  .animate()
                  .fadeIn(
                      delay: Duration(milliseconds: idx * 30),
                      duration: 200.ms)
                  .slideX(
                      begin: 0.04,
                      end: 0,
                      delay: Duration(milliseconds: idx * 30),
                      duration: 200.ms);
            }),
            const SizedBox(height: 16),
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
  const _BiometricEnrollDialog(
      {required this.onEnable, required this.onSkip});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      contentPadding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            color: AppColors.brandSoft,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.fingerprint,
              size: 40, color: AppColors.brand),
        ),
        const SizedBox(height: 16),
        Text(
          'Enable Fingerprint Login?',
          style: GoogleFonts.manrope(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: AppColors.ink),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          'Log in faster using your fingerprint instead of your password.',
          style: GoogleFonts.manrope(
              fontSize: 13, color: AppColors.ink2),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 20),
      ]),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      actions: [
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: onEnable,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.ink,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            child: Text('Enable Fingerprint',
                style: GoogleFonts.manrope(fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: TextButton(
            onPressed: onSkip,
            child: Text('Not Now',
                style: GoogleFonts.manrope(color: AppColors.ink2)),
          ),
        ),
      ],
    );
  }
}

// ── Grace period banner ───────────────────────────────────────────────────────
class _GracePeriodBanner extends StatelessWidget {
  final int graceDays;
  const _GracePeriodBanner({required this.graceDays});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/billing'),
      child: Container(
        width: double.infinity,
        color: AppColors.warn,
        padding:
            const EdgeInsets.symmetric(vertical: 7, horizontal: 16),
        child: Row(children: [
          const Icon(Icons.warning_amber_rounded,
              color: Colors.white, size: 15),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Subscription expires in $graceDays day${graceDays == 1 ? '' : 's'} — tap to renew',
              style: GoogleFonts.manrope(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600),
            ),
          ),
          const Icon(Icons.chevron_right, color: Colors.white, size: 16),
        ]),
      ),
    );
  }
}
