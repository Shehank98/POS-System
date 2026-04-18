import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/pre_order_model.dart';
import '../../../providers/pre_order_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';

const _tabs = ['ALL', 'PENDING', 'PREPARING', 'READY', 'COMPLETED'];

class PreOrdersScreen extends ConsumerStatefulWidget {
  const PreOrdersScreen({super.key});

  @override
  ConsumerState<PreOrdersScreen> createState() => _PreOrdersScreenState();
}

class _PreOrdersScreenState extends ConsumerState<PreOrdersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: _tabs.length, vsync: this);
    _tab.addListener(() {
      if (!_tab.indexIsChanging) {
        final status = _tab.index == 0 ? null : _tabs[_tab.index];
        ref.read(preOrderProvider.notifier).refresh(status: status);
      }
    });
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final preOrdersEnabled = ref.watch(preOrdersEnabledProvider);

    if (!preOrdersEnabled) {
      return Scaffold(
        appBar: AppBar(title: const Text('Pre-Orders')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_outline, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text('Pre-Orders is not enabled for your plan.',
                  style: TextStyle(color: Colors.grey.shade600)),
            ],
          ),
        ),
      );
    }

    final ordersAsync = ref.watch(preOrderProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Pre-Orders'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () {
              final status = _tab.index == 0 ? null : _tabs[_tab.index];
              ref.read(preOrderProvider.notifier).refresh(status: status);
            },
          ),
        ],
        bottom: TabBar(
          controller: _tab,
          isScrollable: true,
          tabs: _tabs.map((t) => Tab(text: t)).toList(),
        ),
      ),
      body: ordersAsync.when(
        loading: () => const LoadingOverlay(),
        error: (e, _) => ErrorView(
          message: e.toString(),
          onRetry: () => ref.read(preOrderProvider.notifier).refresh(),
        ),
        data: (orders) {
          if (orders.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.inbox_outlined,
                      size: 64,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withOpacity(0.2)),
                  const SizedBox(height: 12),
                  Text(
                    'No orders found',
                    style: TextStyle(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withOpacity(0.5)),
                  ),
                ],
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () {
              final status = _tab.index == 0 ? null : _tabs[_tab.index];
              return ref
                  .read(preOrderProvider.notifier)
                  .refresh(status: status);
            },
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: orders.length,
              itemBuilder: (ctx, i) => _OrderCard(order: orders[i]),
            ),
          );
        },
      ),
    );
  }
}

class _OrderCard extends ConsumerWidget {
  final PreOrderModel order;
  const _OrderCard({required this.order});

  Color _statusColor(String status) {
    switch (status) {
      case 'PENDING':
        return AppColors.warning;
      case 'PREPARING':
        return const Color(0xFF1565C0);
      case 'READY':
        return AppColors.success;
      case 'COMPLETED':
        return Colors.grey;
      case 'CANCELLED':
        return AppColors.danger;
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sc = _statusColor(order.status);
    final cs = Theme.of(context).colorScheme;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    order.tokenNumber,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 15),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.customerName?.isNotEmpty == true
                            ? order.customerName!
                            : order.customerPhone,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        order.customerPhone,
                        style: TextStyle(
                            fontSize: 12,
                            color: cs.onSurface.withOpacity(0.5)),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: sc.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    order.status,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: sc),
                  ),
                ),
              ],
            ),
            const Divider(height: 16),
            ...order.items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Text('${item.qty}x ',
                          style: TextStyle(
                              color: cs.onSurface.withOpacity(0.6),
                              fontSize: 13)),
                      Expanded(
                          child: Text(item.name,
                              style: const TextStyle(fontSize: 13))),
                      Text(formatCurrency(item.price * item.qty),
                          style: const TextStyle(fontSize: 13)),
                    ],
                  ),
                )),
            const Divider(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  formatCurrency(order.totalAmount),
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
                _ActionButtons(order: order),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionButtons extends ConsumerWidget {
  final PreOrderModel order;
  const _ActionButtons({required this.order});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(preOrderProvider.notifier);

    switch (order.status) {
      case 'PENDING':
        return FilledButton(
          onPressed: () => notifier.updateStatus(order.id, 'PREPARING'),
          style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1565C0),
              minimumSize: const Size(0, 36)),
          child: const Text('Start Preparing', style: TextStyle(fontSize: 12)),
        );
      case 'PREPARING':
        return FilledButton(
          onPressed: () => notifier.updateStatus(order.id, 'READY'),
          style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              minimumSize: const Size(0, 36)),
          child: const Text('Mark Ready', style: TextStyle(fontSize: 12)),
        );
      case 'READY':
        return FilledButton(
          onPressed: () => notifier.markAsPaid(order.id),
          style: FilledButton.styleFrom(
              minimumSize: const Size(0, 36)),
          child: const Text('Mark Paid', style: TextStyle(fontSize: 12)),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
