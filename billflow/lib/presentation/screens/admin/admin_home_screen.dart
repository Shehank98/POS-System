import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/network/api_exception.dart';
import '../../../providers/admin_auth_provider.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/design_system.dart';
import 'admin_dashboard_screen.dart';
import 'admin_shops_screen.dart';
import 'admin_payments_screen.dart';
import 'admin_agents_screen.dart';
import 'admin_plans_screen.dart';
import 'admin_commissions_screen.dart';

class AdminHomeScreen extends ConsumerStatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  ConsumerState<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends ConsumerState<AdminHomeScreen> {
  int _tab = 0;

  static const _tabs = [
    (icon: Icons.dashboard_outlined,             activeIcon: Icons.dashboard,             label: 'Dashboard'),
    (icon: Icons.store_outlined,                 activeIcon: Icons.store,                 label: 'Shops'),
    (icon: Icons.payments_outlined,              activeIcon: Icons.payments,              label: 'Payments'),
    (icon: Icons.badge_outlined,                 activeIcon: Icons.badge,                 label: 'Agents'),
    (icon: Icons.workspace_premium_outlined,     activeIcon: Icons.workspace_premium,     label: 'Plans'),
    (icon: Icons.account_balance_wallet_outlined, activeIcon: Icons.account_balance_wallet, label: 'Commissions'),
  ];

  static const _screens = [
    AdminDashboardScreen(),
    AdminShopsScreen(),
    AdminPaymentsScreen(),
    AdminAgentsScreen(),
    AdminPlansScreen(),
    AdminCommissionsScreen(),
  ];

  static const _titles = ['Admin Dashboard', 'Shops', 'Payments', 'Agents', 'Plans', 'Commissions'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _titles[_tab],
          style: GoogleFonts.poppins(
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
        actions: [
          Consumer(builder: (_, ref, __) {
            final notifs = ref.watch(_adminNotificationsProvider).valueOrNull ?? [];
            final unread = notifs.where((n) => !n.isRead).length;
            return IconButton(
              icon: Badge(
                isLabelVisible: unread > 0,
                label: Text('$unread'),
                child: const Icon(Icons.notifications_outlined),
              ),
              onPressed: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                useSafeArea: true,
                backgroundColor: Colors.transparent,
                builder: (_) => const SizedBox(
                  height: 520,
                  child: _AdminNotificationsSheet(),
                ),
              ),
            );
          }),
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
            leading: DSAvatar(
              name: admin?.email ?? 'Admin',
              size: 40,
              backgroundColor: AppColors.navy,
            ),
            title: Text(admin?.email ?? 'Admin',
                style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 14)),
            subtitle: Text('Super Admin',
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.textMuted)),
          ).animate().fadeIn(duration: 200.ms),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.campaign_outlined,
                color: Color(0xFF1A237E)),
            title: const Text('Dispatch Push Notification'),
            subtitle: const Text('Send alert to shop owners'),
            onTap: () {
              Navigator.pop(ctx);
              _showDispatchSheet(context);
            },
          ).animate().fadeIn(delay: 30.ms, duration: 200.ms),
          ListTile(
            leading: const Icon(Icons.logout, color: Colors.red),
            title: const Text('Sign Out',
                style: TextStyle(color: Colors.red)),
            onTap: () async {
              Navigator.pop(ctx);
              await ref.read(adminAuthProvider.notifier).logout();
              if (context.mounted) context.go('/login');
            },
          ).animate().fadeIn(delay: 60.ms, duration: 200.ms),
          const SizedBox(height: 8),
        ]),
      ),
    );
  }

  void _showDispatchSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _DispatchNotificationSheet(
        onSend: (title, body, target) async {
          final svc = ref.read(adminServiceProvider);
          final result = await svc.dispatchNotification(
              title: title, body: body, target: target);
          return result;
        },
      ),
    );
  }
}

// ── Admin notifications provider ─────────────────────────────────────────────
final _adminNotificationsProvider =
    FutureProvider.autoDispose<List<AdminNotification>>((ref) {
  return ref.read(adminServiceProvider).getAdminNotifications();
});

// ── Admin notifications sheet ─────────────────────────────────────────────────
class _AdminNotificationsSheet extends ConsumerStatefulWidget {
  const _AdminNotificationsSheet();

  @override
  ConsumerState<_AdminNotificationsSheet> createState() =>
      _AdminNotificationsSheetState();
}

class _AdminNotificationsSheetState
    extends ConsumerState<_AdminNotificationsSheet> {
  Future<void> _markAllRead() async {
    await ref.read(adminServiceProvider).markAllAdminNotificationsRead();
    ref.invalidate(_adminNotificationsProvider);
  }

  @override
  Widget build(BuildContext context) {
    final notifs = ref.watch(_adminNotificationsProvider);
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(children: [
        const SizedBox(height: 8),
        Container(width: 36, height: 4,
            decoration: BoxDecoration(color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2))),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 8, 4),
          child: Row(children: [
            const Text('Notifications',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const Spacer(),
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read', style: TextStyle(fontSize: 12)),
            ),
          ]),
        ),
        const Divider(height: 1),
        Expanded(child: notifs.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => Center(child: Text('$e')),
          data: (list) {
            if (list.isEmpty) {
              return Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.notifications_none_outlined,
                      size: 48, color: Colors.grey[300]),
                  const SizedBox(height: 12),
                  Text('No notifications yet',
                      style: TextStyle(color: Colors.grey[500])),
                ]),
              );
            }
            return ListView.builder(
              itemCount: list.length,
              itemBuilder: (_, i) {
                final n = list[i];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: n.isRead
                        ? Colors.grey[100]
                        : const Color(0xFF1A237E).withValues(alpha: 0.1),
                    child: Icon(
                      Icons.notifications_outlined,
                      color: n.isRead ? Colors.grey : const Color(0xFF1A237E),
                      size: 20,
                    ),
                  ),
                  title: Text(n.title,
                      style: TextStyle(
                          fontWeight: n.isRead ? FontWeight.normal : FontWeight.bold,
                          fontSize: 13)),
                  subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(n.body, style: const TextStyle(fontSize: 12)),
                    Text(
                      n.createdAt != null
                          ? DateFormat('dd MMM yyyy HH:mm').format(n.createdAt)
                          : '-',
                      style: TextStyle(fontSize: 10, color: Colors.grey[400]),
                    ),
                  ]),
                  isThreeLine: true,
                  onTap: n.isRead ? null : () async {
                    await ref.read(adminServiceProvider).markAdminNotificationRead(n.id);
                    ref.invalidate(_adminNotificationsProvider);
                  },
                );
              },
            );
          },
        )),
      ]),
    );
  }
}

// ── Dispatch Notification Bottom Sheet ────────────────────────────────────────

class _DispatchNotificationSheet extends StatefulWidget {
  final Future<Map<String, dynamic>> Function(String title, String body, String target) onSend;

  const _DispatchNotificationSheet({required this.onSend});

  @override
  State<_DispatchNotificationSheet> createState() =>
      _DispatchNotificationSheetState();
}

class _DispatchNotificationSheetState
    extends State<_DispatchNotificationSheet> {
  final _titleCtrl = TextEditingController();
  final _bodyCtrl  = TextEditingController();
  final _formKey   = GlobalKey<FormState>();
  String _target   = 'all';
  bool   _loading  = false;

  static const _targets = [
    ('all',     'All shops',          Icons.store_outlined),
    ('active',  'Active subscribers', Icons.check_circle_outline),
    ('trial',   'Trial shops',        Icons.hourglass_bottom_outlined),
    ('expired', 'Expired shops',      Icons.warning_amber_outlined),
  ];

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final result = await widget.onSend(
        _titleCtrl.text.trim(),
        _bodyCtrl.text.trim(),
        _target,
      );
      if (!mounted) return;
      final total   = result['total'] ?? 0;
      final fcmSent = result['fcm_sent'] ?? 0;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
            'Sent to $total shop${total == 1 ? '' : 's'} · $fcmSent FCM push${fcmSent == 1 ? '' : 'es'} delivered'),
        backgroundColor: Colors.green,
      ));
    } catch (e) {
      if (!mounted) return;
      final msg = e is ApiException ? e.message : 'Failed to send';
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
          20, 20, 20, MediaQuery.of(context).viewInsets.bottom + 20),
      child: Form(
        key: _formKey,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Handle
          Container(
            width: 36, height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2)),
          ),
          Row(children: [
            const Icon(Icons.campaign_outlined, color: Color(0xFF1A237E)),
            const SizedBox(width: 10),
            const Text('Dispatch Push Notification',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 4),
          const Text(
            'Creates an in-app notification and sends an FCM push to all matching shop owners.',
            style: TextStyle(fontSize: 12, color: Colors.grey),
          ),
          const SizedBox(height: 16),

          // Target selector
          Wrap(
            spacing: 8,
            children: _targets.map((t) {
              final (value, label, icon) = t;
              final selected = _target == value;
              return FilterChip(
                avatar: Icon(icon, size: 16),
                label: Text(label),
                selected: selected,
                onSelected: (_) => setState(() => _target = value),
              );
            }).toList(),
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _titleCtrl,
            decoration: const InputDecoration(
              labelText: 'Notification Title',
              prefixIcon: Icon(Icons.title),
              isDense: true,
            ),
            textInputAction: TextInputAction.next,
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter a title' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _bodyCtrl,
            decoration: const InputDecoration(
              labelText: 'Message Body',
              prefixIcon: Icon(Icons.message_outlined),
              isDense: true,
            ),
            maxLines: 3,
            textInputAction: TextInputAction.done,
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter a message' : null,
          ),
          const SizedBox(height: 20),

          FilledButton.icon(
            onPressed: _loading ? null : _send,
            icon: _loading
                ? const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.send_outlined),
            label: Text(_loading ? 'Sending…' : 'Send Notification'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1A237E),
              minimumSize: const Size(double.infinity, 48),
            ),
          ),
        ]),
      ),
    );
  }
}
