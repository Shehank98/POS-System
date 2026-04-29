import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';

final _adminDashboardProvider = FutureProvider.autoDispose<AdminDashboardStats>((ref) {
  return ref.read(adminServiceProvider).getDashboard();
});

class AdminDashboardScreen extends ConsumerWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_adminDashboardProvider);
    final cs = Theme.of(context).colorScheme;

    return RefreshIndicator(
      onRefresh: () => ref.refresh(_adminDashboardProvider.future),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: Text('Overview',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: cs.onSurfaceVariant)),
            ),
          ),
          async.when(
            loading: () => const SliverToBoxAdapter(
                child: ShimmerGrid(itemCount: 6, itemHeight: 90)),
            error: (e, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Center(child: Text('Error: $e')),
              ),
            ),
            data: (stats) => SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: SliverGrid(
                delegate: SliverChildListDelegate([
                  _StatCard(
                    label: 'Total Shops',
                    value: '${stats.totalShops}',
                    icon: Icons.store_outlined,
                    color: cs.primary,
                    delay: 0,
                  ),
                  _StatCard(
                    label: 'Active',
                    value: '${stats.activeShops}',
                    icon: Icons.check_circle_outline,
                    color: Colors.green,
                    delay: 60,
                  ),
                  _StatCard(
                    label: 'Trial',
                    value: '${stats.trialShops}',
                    icon: Icons.hourglass_top_outlined,
                    color: Colors.orange,
                    delay: 120,
                  ),
                  _StatCard(
                    label: 'Expired',
                    value: '${stats.expiredShops}',
                    icon: Icons.cancel_outlined,
                    color: cs.error,
                    delay: 180,
                  ),
                  _StatCard(
                    label: 'Total Revenue',
                    value: 'Rs ${NumberFormat('#,##0').format(stats.totalRevenue)}',
                    icon: Icons.payments_outlined,
                    color: Colors.teal,
                    delay: 240,
                  ),
                  _StatCard(
                    label: 'Pending',
                    value: '${stats.pendingPayments}',
                    icon: Icons.pending_actions_outlined,
                    color: Colors.deepOrange,
                    delay: 300,
                  ),
                ]),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.5,
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final int delay;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.delay,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(width: 6),
              Expanded(
                child: Text(label,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: cs.onSurfaceVariant),
                    overflow: TextOverflow.ellipsis),
              ),
            ]),
            Text(value,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    )
        .animate()
        .fadeIn(delay: Duration(milliseconds: delay), duration: 400.ms)
        .slideY(begin: 0.2, end: 0, delay: Duration(milliseconds: delay), duration: 400.ms);
  }
}
