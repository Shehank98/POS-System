import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/admin_auth_provider.dart';
import 'admin_dashboard_screen.dart';
import 'admin_shops_screen.dart';
import 'admin_payments_screen.dart';
import 'admin_agents_screen.dart';

class AdminHomeScreen extends ConsumerStatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  ConsumerState<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends ConsumerState<AdminHomeScreen> {
  int _tab = 0;

  static const _tabs = [
    (icon: Icons.dashboard_outlined, activeIcon: Icons.dashboard, label: 'Dashboard'),
    (icon: Icons.store_outlined, activeIcon: Icons.store, label: 'Shops'),
    (icon: Icons.payments_outlined, activeIcon: Icons.payments, label: 'Payments'),
    (icon: Icons.badge_outlined, activeIcon: Icons.badge, label: 'Agents'),
  ];

  static const _screens = [
    AdminDashboardScreen(),
    AdminShopsScreen(),
    AdminPaymentsScreen(),
    AdminAgentsScreen(),
  ];

  static const _titles = ['Admin Dashboard', 'Shops', 'Payments', 'Agents'];

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final admin = ref.watch(adminAuthProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_tab]),
        backgroundColor: const Color(0xFF1A237E),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert),
            onPressed: () => _showMoreSheet(context),
          ),
        ],
      ),
      body: IndexedStack(index: _tab, children: _screens),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: _tabs
            .map((t) => NavigationDestination(
                  icon: Icon(t.icon),
                  selectedIcon: Icon(t.activeIcon),
                  label: t.label,
                ))
            .toList(),
      )
          .animate()
          .fadeIn(duration: 400.ms)
          .slideY(begin: 0.2, end: 0, duration: 400.ms),
    );
  }

  void _showMoreSheet(BuildContext context) {
    final admin = ref.read(adminAuthProvider).valueOrNull;
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: CircleAvatar(
              backgroundColor:
                  Theme.of(context).colorScheme.primaryContainer,
              child: Text(
                (admin?.email ?? 'A')[0].toUpperCase(),
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onPrimaryContainer,
                    fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(admin?.email ?? 'Admin',
                style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: const Text('Super Admin'),
          )
              .animate()
              .fadeIn(duration: 200.ms),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out',
                style: TextStyle(color: Colors.red)),
            onTap: () async {
              Navigator.pop(ctx);
              await ref.read(adminAuthProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          )
              .animate()
              .fadeIn(delay: 50.ms, duration: 200.ms),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }
}
