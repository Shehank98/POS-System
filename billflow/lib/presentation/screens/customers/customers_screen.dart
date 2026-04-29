import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/customer_model.dart';
import '../../../providers/customer_provider.dart';
import '../../widgets/common/shimmer_list.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  final _phoneCtrl = TextEditingController();
  String? _searchedPhone;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _search() {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) return;
    setState(() => _searchedPhone = phone);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Customers'),
          centerTitle: false,
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Lookup'),
              Tab(text: 'Top Customers'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _LookupTab(
              phoneCtrl: _phoneCtrl,
              searchedPhone: _searchedPhone,
              onSearch: _search,
            ),
            const _TopCustomersTab(),
          ],
        ),
      ),
    );
  }
}

// ── Phone Lookup Tab ──────────────────────────────────────────────────────────

class _LookupTab extends ConsumerWidget {
  final TextEditingController phoneCtrl;
  final String? searchedPhone;
  final VoidCallback onSearch;

  const _LookupTab({
    required this.phoneCtrl,
    required this.searchedPhone,
    required this.onSearch,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;

    return Column(
      children: [
        // Search bar
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: phoneCtrl,
                  decoration: InputDecoration(
                    hintText: 'Enter phone number…',
                    prefixIcon: const Icon(Icons.phone_outlined),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12)),
                    filled: true,
                    fillColor: cs.surfaceContainerLowest,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                  ),
                  keyboardType: TextInputType.phone,
                  onSubmitted: (_) => onSearch(),
                ),
              ),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: onSearch,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(56, 48),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Icon(Icons.search),
              ),
            ],
          ),
        ),

        // Results
        Expanded(
          child: searchedPhone == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.person_search_outlined,
                          size: 56, color: cs.onSurfaceVariant),
                      const SizedBox(height: 12),
                      Text('Search by phone number',
                          style: TextStyle(color: cs.onSurfaceVariant)),
                    ],
                  ),
                )
              : _InsightsView(phone: searchedPhone!),
        ),
      ],
    );
  }
}

class _InsightsView extends ConsumerWidget {
  final String phone;
  const _InsightsView({required this.phone});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insightsAsync = ref.watch(customerInsightsProvider(phone));

    return insightsAsync.when(
      loading: () => const ShimmerList(itemCount: 5, itemHeight: 80),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.person_off_outlined, size: 48, color: Colors.grey),
            const SizedBox(height: 12),
            Text(
              e.toString().contains('404') || e.toString().contains('not found')
                  ? 'No customer found for $phone'
                  : e.toString(),
              style: const TextStyle(color: Colors.grey),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
      data: (ins) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          // Header
          _CustomerHeader(insights: ins),
          const SizedBox(height: 12),

          // Stats row
          _StatsGrid(insights: ins),
          const SizedBox(height: 12),

          // Top items
          if (ins.topItems.isNotEmpty) ...[
            _SectionCard(
              icon: Icons.star_outline,
              title: 'Frequently Ordered',
              child: Column(
                children: ins.topItems
                    .map((item) => _TopItemRow(item: item))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Recent orders
          if (ins.recentOrders.isNotEmpty)
            _SectionCard(
              icon: Icons.receipt_long_outlined,
              title: 'Recent Orders',
              child: Column(
                children: ins.recentOrders
                    .map((o) => _RecentOrderRow(order: o))
                    .toList(),
              ),
            ),

          // Cancellation warning
          if ((ins.cancellationTracking?.totalCancellations ?? 0) > 0) ...[
            const SizedBox(height: 12),
            _CancellationBanner(tracking: ins.cancellationTracking!),
          ],
        ],
      ),
    );
  }
}

class _CustomerHeader extends StatelessWidget {
  final CustomerInsights insights;
  const _CustomerHeader({required this.insights});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        CircleAvatar(
          radius: 28,
          backgroundColor: cs.primaryContainer,
          child: Text(
            (insights.name?.isNotEmpty == true
                    ? insights.name![0]
                    : insights.phone[0])
                .toUpperCase(),
            style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: cs.onPrimaryContainer),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                insights.name ?? 'Unknown Customer',
                style: const TextStyle(
                    fontSize: 17, fontWeight: FontWeight.bold),
              ),
              Text(insights.phone,
                  style: TextStyle(color: cs.onSurfaceVariant)),
              if (insights.loyaltyPoints > 0)
                Row(
                  children: [
                    const Icon(Icons.stars, size: 14, color: Colors.amber),
                    const SizedBox(width: 4),
                    Text('${insights.loyaltyPoints} loyalty pts',
                        style: const TextStyle(
                            fontSize: 12, color: Colors.amber)),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatsGrid extends StatelessWidget {
  final CustomerInsights insights;
  const _StatsGrid({required this.insights});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: _StatCell(
                icon: Icons.shopping_bag_outlined,
                label: 'Orders',
                value: '${insights.totalOrders}')),
        const SizedBox(width: 8),
        Expanded(
            child: _StatCell(
                icon: Icons.currency_rupee,
                label: 'Total Spent',
                value: 'Rs. ${formatNumber(insights.totalSpent)}')),
        const SizedBox(width: 8),
        Expanded(
            child: _StatCell(
                icon: Icons.av_timer_outlined,
                label: 'Avg Order',
                value: 'Rs. ${formatNumber(insights.avgOrderValue)}')),
      ],
    );
  }
}

class _StatCell extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _StatCell(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        children: [
          Icon(icon, size: 20, color: cs.primary),
          const SizedBox(height: 6),
          Text(value,
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 13),
              textAlign: TextAlign.center),
          Text(label,
              style: TextStyle(fontSize: 10, color: cs.onSurfaceVariant),
              textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;
  const _SectionCard(
      {required this.icon, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Row(
              children: [
                Icon(icon, size: 18, color: cs.primary),
                const SizedBox(width: 8),
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 14)),
              ],
            ),
          ),
          const Divider(height: 1),
          child,
        ],
      ),
    );
  }
}

class _TopItemRow extends StatelessWidget {
  final TopItem item;
  const _TopItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Expanded(
              child: Text(item.itemName,
                  style: const TextStyle(fontSize: 13))),
          Text(
              '×${item.totalQty.toStringAsFixed(0)} (${item.orderCount} orders)',
              style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
        ],
      ),
    );
  }
}

class _RecentOrderRow extends StatelessWidget {
  final RecentOrder order;
  const _RecentOrderRow({required this.order});

  Color _statusColor(String s) {
    if (s == 'COMPLETED') return Colors.green;
    if (s == 'CANCELLED') return Colors.red;
    return Colors.blue;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final date = DateTime.tryParse(order.createdAt);
    final dateStr = date != null
        ? '${date.day} ${_month(date.month)}'
        : order.createdAt;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: cs.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(order.tokenNumber,
                style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'monospace')),
          ),
          const SizedBox(width: 8),
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: _statusColor(order.status).withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(order.status,
                style: TextStyle(
                    fontSize: 10,
                    color: _statusColor(order.status),
                    fontWeight: FontWeight.w600)),
          ),
          const Spacer(),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text('Rs. ${formatNumber(order.totalAmount)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 13)),
              Text(dateStr,
                  style:
                      TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
            ],
          ),
        ],
      ),
    );
  }

  String _month(int m) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m];
}

class _CancellationBanner extends StatelessWidget {
  final CancellationTracking tracking;
  const _CancellationBanner({required this.tracking});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.orange.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.orange.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: Colors.orange, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              tracking.cooldownActive
                  ? '${tracking.totalCancellations} cancellations — Cooldown active'
                  : '${tracking.totalCancellations} cancellation${tracking.totalCancellations == 1 ? '' : 's'} on record',
              style: TextStyle(
                  fontSize: 13, color: Colors.orange.shade900),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Top Customers Tab ─────────────────────────────────────────────────────────

class _TopCustomersTab extends ConsumerWidget {
  const _TopCustomersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final topAsync = ref.watch(topCustomersProvider);
    final cs = Theme.of(context).colorScheme;

    return topAsync.when(
      loading: () => const ShimmerList(itemCount: 6, itemHeight: 72),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.wifi_off_outlined,
                size: 40, color: cs.onSurfaceVariant),
            const SizedBox(height: 8),
            Text(e.toString(),
                style: TextStyle(color: cs.onSurfaceVariant),
                textAlign: TextAlign.center),
            const SizedBox(height: 12),
            TextButton(
                onPressed: () => ref.invalidate(topCustomersProvider),
                child: const Text('Retry')),
          ],
        ),
      ),
      data: (customers) => customers.isEmpty
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.people_outline,
                      size: 48, color: cs.onSurfaceVariant),
                  const SizedBox(height: 8),
                  Text('No customer data yet',
                      style: TextStyle(color: cs.onSurfaceVariant)),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () async => ref.invalidate(topCustomersProvider),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: customers.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) =>
                    _TopCustomerCard(rank: i + 1, customer: customers[i])
                        .animate()
                        .fadeIn(
                            delay: Duration(
                                milliseconds: (i * 40).clamp(0, 400)),
                            duration: 300.ms)
                        .slideX(begin: 0.04, end: 0),
              ),
            ),
    );
  }
}

class _TopCustomerCard extends StatelessWidget {
  final int rank;
  final TopCustomer customer;
  const _TopCustomerCard({required this.rank, required this.customer});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final medalColor = rank == 1
        ? Colors.amber
        : rank == 2
            ? Colors.grey.shade400
            : rank == 3
                ? Colors.brown.shade300
                : cs.onSurfaceVariant;

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Rank badge
            SizedBox(
              width: 32,
              child: rank <= 3
                  ? Icon(Icons.emoji_events, color: medalColor, size: 28)
                  : Text('#$rank',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: cs.onSurfaceVariant)),
            ),
            const SizedBox(width: 12),
            // Avatar
            CircleAvatar(
              radius: 20,
              backgroundColor: cs.primaryContainer,
              child: Text(
                (customer.name?.isNotEmpty == true
                        ? customer.name![0]
                        : customer.phone[0])
                    .toUpperCase(),
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: cs.onPrimaryContainer),
              ),
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    customer.name ?? customer.phone,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  Text(
                    customer.name != null ? customer.phone : '',
                    style: TextStyle(
                        fontSize: 12, color: cs.onSurfaceVariant),
                  ),
                  Text(
                    '${customer.orderCount} order${customer.orderCount == 1 ? '' : 's'}',
                    style: TextStyle(
                        fontSize: 12, color: cs.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            // Total spent
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Rs. ${formatNumber(customer.totalSpent)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 14),
                ),
                if (customer.loyaltyPoints > 0)
                  Row(
                    children: [
                      const Icon(Icons.stars,
                          size: 12, color: Colors.amber),
                      const SizedBox(width: 2),
                      Text('${customer.loyaltyPoints} pts',
                          style: const TextStyle(
                              fontSize: 11, color: Colors.amber)),
                    ],
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
