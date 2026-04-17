import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/dashboard_provider.dart';
import '../../../providers/notification_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';
import '../../widgets/common/stat_card.dart';
import '../../widgets/charts/revenue_bar_chart.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final todayAsync = ref.watch(dashboardTodayProvider);
    final weekAsync = ref.watch(dashboardWeekProvider);
    final unread = ref.watch(unreadNotificationCountProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(dashboardTodayProvider);
          ref.invalidate(dashboardWeekProvider);
          ref.invalidate(lowStockProvider);
        },
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user?.shopName ?? 'BillFlow',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                  Text('Welcome, ${user?.username ?? ''}',
                      style: TextStyle(
                          fontSize: 12,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withOpacity(0.6))),
                ],
              ),
              actions: [
                Stack(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.notifications_outlined),
                      onPressed: () => context.push('/notifications'),
                    ),
                    if (unread > 0)
                      Positioned(
                        right: 8,
                        top: 8,
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: const BoxDecoration(
                            color: AppColors.danger,
                            shape: BoxShape.circle,
                          ),
                          child: Center(
                            child: Text(
                              unread > 9 ? '9+' : '$unread',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.settings_outlined),
                  onPressed: () => context.push('/settings'),
                ),
              ],
            ),

            // Read-only warning
            if (user?.readOnly == true)
              SliverToBoxAdapter(
                child: MaterialBanner(
                  content: const Text(
                      'Account expired — Read Only Mode. Contact support to renew.'),
                  backgroundColor: AppColors.warning.withOpacity(0.15),
                  leading: const Icon(Icons.warning_amber, color: AppColors.warning),
                  actions: [
                    TextButton(
                        onPressed: () {},
                        child: const Text('Dismiss'))
                  ],
                ),
              ),

            // Stats grid
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: todayAsync.when(
                loading: () => const SliverToBoxAdapter(child: LoadingOverlay()),
                error: (e, _) => SliverToBoxAdapter(
                    child: ErrorView(
                        message: e.toString(),
                        onRetry: () => ref.invalidate(dashboardTodayProvider))),
                data: (today) => SliverGrid(
                  delegate: SliverChildListDelegate([
                    StatCard(
                      label: 'Transactions',
                      value: '${today.summary.transactionCount}',
                      icon: Icons.receipt_long_outlined,
                      iconColor: AppColors.primaryLight,
                    ),
                    StatCard(
                      label: "Today's Revenue",
                      value: formatCurrency(today.summary.totalSales),
                      icon: Icons.attach_money,
                      iconColor: AppColors.accent,
                    ),
                    StatCard(
                      label: 'Items Sold',
                      value: formatNumber(today.itemsSold),
                      icon: Icons.shopping_bag_outlined,
                      iconColor: Colors.purple,
                    ),
                    StatCard(
                      label: 'Net Sales',
                      value: formatCurrency(today.summary.netSales),
                      icon: Icons.trending_up,
                      iconColor: AppColors.success,
                    ),
                  ]),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 1.35,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                ),
              ),
            ),

            // Weekly chart
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Weekly Sales',
                            style: Theme.of(context)
                                .textTheme
                                .titleMedium
                                ?.copyWith(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 16),
                        weekAsync.when(
                          data: (week) => RevenueBarChart(data: week),
                          loading: () => const SizedBox(
                              height: 160, child: LoadingOverlay()),
                          error: (_, __) => const SizedBox(
                              height: 60,
                              child: Center(
                                  child: Text('Unable to load chart'))),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // Top products
            SliverToBoxAdapter(
              child: todayAsync.whenData((today) {
                if (today.topProducts.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Top Products Today',
                              style: Theme.of(context)
                                  .textTheme
                                  .titleMedium
                                  ?.copyWith(fontWeight: FontWeight.bold)),
                          const SizedBox(height: 12),
                          ...today.topProducts.asMap().entries.map((e) {
                            final p = e.value;
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: CircleAvatar(
                                radius: 14,
                                child: Text('${e.key + 1}',
                                    style:
                                        const TextStyle(fontSize: 12)),
                              ),
                              title: Text(p.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                              subtitle: Text(
                                  'Qty: ${formatNumber(p.qtySold)}'),
                              trailing: Text(formatCurrency(p.revenue),
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: Theme.of(context)
                                          .colorScheme
                                          .primary)),
                            );
                          }),
                        ],
                      ),
                    ),
                  ),
                );
              }).valueOrNull ??
                  const SizedBox.shrink(),
            ),

            // Low stock alert
            Consumer(builder: (ctx, r, _) {
              final lowAsync = r.watch(lowStockProvider);
              return SliverToBoxAdapter(
                child: lowAsync.whenData((items) {
                  if (items.isEmpty) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    child: Card(
                      color: AppColors.warning.withOpacity(0.08),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              const Icon(Icons.warning_amber,
                                  color: AppColors.warning),
                              const SizedBox(width: 8),
                              Text('Low Stock Alert (${items.length})',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: AppColors.warning)),
                            ]),
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: items
                                  .take(6)
                                  .map((p) => Chip(
                                        label: Text(
                                            '${p.name}: ${formatNumber(p.stockQuantity)}'),
                                        backgroundColor:
                                            AppColors.warning.withOpacity(0.1),
                                        side: const BorderSide(
                                            color: AppColors.warning),
                                      ))
                                  .toList(),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }).valueOrNull ??
                    const SizedBox.shrink(),
              );
            }),
          ],
        ),
      ),
    );
  }
}
