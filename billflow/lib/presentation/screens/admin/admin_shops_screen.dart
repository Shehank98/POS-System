import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';

final _adminShopsProvider =
    FutureProvider.autoDispose.family<List<AdminShop>, String?>((ref, status) {
  return ref.read(adminServiceProvider).getShops(status: status);
});

final _shopStatusFilter = StateProvider.autoDispose<String?>((ref) => null);
final _shopSearch = StateProvider.autoDispose<String>((ref) => '');

class AdminShopsScreen extends ConsumerWidget {
  const AdminShopsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(_shopStatusFilter);
    final search = ref.watch(_shopSearch);
    final async = ref.watch(_adminShopsProvider(status));

    return Column(children: [
      _SearchBar(search: search, ref: ref),
      _FilterChips(status: status, ref: ref),
      Expanded(
        child: async.when(
          loading: () => const ShimmerList(itemCount: 8),
          error: (e, _) =>
              Center(child: Text('Error loading shops: $e')),
          data: (shops) {
            final filtered = search.isEmpty
                ? shops
                : shops
                    .where((s) =>
                        s.name.toLowerCase().contains(search.toLowerCase()) ||
                        s.email.toLowerCase().contains(search.toLowerCase()))
                    .toList();
            if (filtered.isEmpty) {
              return const Center(child: Text('No shops found'));
            }
            return RefreshIndicator(
              onRefresh: () =>
                  ref.refresh(_adminShopsProvider(status).future),
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                itemBuilder: (ctx, i) => _ShopTile(shop: filtered[i], index: i)
                    .animate()
                    .fadeIn(
                        delay: Duration(milliseconds: (i * 40).clamp(0, 400)),
                        duration: 350.ms)
                    .slideX(
                        begin: 0.05,
                        end: 0,
                        delay: Duration(milliseconds: (i * 40).clamp(0, 400)),
                        duration: 350.ms),
              ),
            );
          },
        ),
      ),
    ]);
  }
}

class _SearchBar extends StatefulWidget {
  final String search;
  final WidgetRef ref;
  const _SearchBar({required this.search, required this.ref});

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  late final _ctrl = TextEditingController(text: widget.search);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: TextField(
        controller: _ctrl,
        decoration: InputDecoration(
          hintText: 'Search shops…',
          prefixIcon: const Icon(Icons.search),
          suffixIcon: _ctrl.text.isNotEmpty
              ? IconButton(
                  icon: const Icon(Icons.clear),
                  onPressed: () {
                    _ctrl.clear();
                    widget.ref.read(_shopSearch.notifier).state = '';
                  },
                )
              : null,
          isDense: true,
        ),
        onChanged: (v) => widget.ref.read(_shopSearch.notifier).state = v,
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  final String? status;
  final WidgetRef ref;
  const _FilterChips({required this.status, required this.ref});

  @override
  Widget build(BuildContext context) {
    final options = <String?, String>{
      null: 'All',
      'active': 'Active',
      'trial': 'Trial',
      'expired': 'Expired',
      'suspended': 'Suspended',
    };
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: options.entries.map((e) {
          final selected = status == e.key;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: FilterChip(
              label: Text(e.value),
              selected: selected,
              onSelected: (_) =>
                  ref.read(_shopStatusFilter.notifier).state = e.key,
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ShopTile extends ConsumerWidget {
  final AdminShop shop;
  final int index;
  const _ShopTile({required this.shop, required this.index});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final statusColor = shop.isActive
        ? Colors.green
        : shop.isTrial
            ? Colors.orange
            : cs.error;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: statusColor.withValues(alpha: 0.12),
          child: Icon(Icons.store_outlined, color: statusColor),
        ),
        title: Text(shop.name,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(shop.ownerName, style: TextStyle(color: cs.onSurfaceVariant)),
            const SizedBox(height: 4),
            Row(children: [
              _StatusChip(status: shop.subscriptionStatus, color: statusColor),
              const SizedBox(width: 8),
              if (shop.subscriptionEndDate != null)
                Text(
                  'Expires ${DateFormat('dd MMM yy').format(shop.subscriptionEndDate!)}',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: cs.onSurfaceVariant),
                ),
            ]),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.chevron_right),
          onPressed: () => _showDetail(context, ref, shop),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context, WidgetRef ref, AdminShop shop) {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => AdminShopDetailScreen(shop: shop),
    ));
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  final Color color;
  const _StatusChip({required this.status, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: TextStyle(
            fontSize: 11, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}

// ── Shop Detail ────────────────────────────────────────────────────────

class AdminShopDetailScreen extends ConsumerStatefulWidget {
  final AdminShop shop;
  const AdminShopDetailScreen({super.key, required this.shop});

  @override
  ConsumerState<AdminShopDetailScreen> createState() =>
      _AdminShopDetailScreenState();
}

class _AdminShopDetailScreenState
    extends ConsumerState<AdminShopDetailScreen> {
  bool _saving = false;

  void _showSubscriptionDialog() {
    final statusCtrl = TextEditingController(
        text: widget.shop.subscriptionStatus);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Update Subscription'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButtonFormField<String>(
            value: statusCtrl.text,
            decoration:
                const InputDecoration(labelText: 'Status'),
            items: ['trial', 'active', 'expired', 'suspended']
                .map((s) =>
                    DropdownMenuItem(value: s, child: Text(s)))
                .toList(),
            onChanged: (v) => statusCtrl.text = v ?? statusCtrl.text,
          ),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _saving = true);
              try {
                await ref.read(adminServiceProvider).updateSubscription(
                    widget.shop.id,
                    {'subscription_status': statusCtrl.text});
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                        content: Text('Subscription updated'),
                        backgroundColor: Colors.green),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                        content: Text('Error: $e'),
                        backgroundColor: Colors.red),
                  );
                }
              } finally {
                if (mounted) setState(() => _saving = false);
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shop = widget.shop;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: Text(shop.name),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.all(14),
              child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2)),
            ),
          IconButton(
            icon: const Icon(Icons.edit_outlined),
            onPressed: _showSubscriptionDialog,
            tooltip: 'Edit subscription',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _InfoCard(label: 'Owner', value: shop.ownerName),
          _InfoCard(label: 'Email', value: shop.email),
          if (shop.phone != null) _InfoCard(label: 'Phone', value: shop.phone!),
          if (shop.address != null)
            _InfoCard(label: 'Address', value: shop.address ?? ''),
          _InfoCard(label: 'Type', value: shop.shopType),
          _InfoCard(
              label: 'Status',
              value: shop.subscriptionStatus,
              valueColor: shop.isActive
                  ? Colors.green
                  : shop.isTrial
                      ? Colors.orange
                      : cs.error),
          if (shop.subscriptionEndDate != null)
            _InfoCard(
                label: 'Expires',
                value: DateFormat('dd MMM yyyy')
                    .format(shop.subscriptionEndDate!)),
          _InfoCard(
              label: 'Joined',
              value: DateFormat('dd MMM yyyy').format(shop.createdAt)),
          const SizedBox(height: 16),
          Row(children: [
            Expanded(
                child: _CountCard(
                    label: 'Users', value: shop.userCount,
                    icon: Icons.people_outline)),
            const SizedBox(width: 12),
            Expanded(
                child: _CountCard(
                    label: 'Products', value: shop.productCount,
                    icon: Icons.inventory_2_outlined)),
            const SizedBox(width: 12),
            Expanded(
                child: _CountCard(
                    label: 'Transactions', value: shop.transactionCount,
                    icon: Icons.receipt_long_outlined)),
          ]),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _InfoCard({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        SizedBox(
          width: 100,
          child: Text(label,
              style: TextStyle(
                  color:
                      Theme.of(context).colorScheme.onSurfaceVariant,
                  fontSize: 13)),
        ),
        Expanded(
          child: Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.w500, color: valueColor)),
        ),
      ]),
    );
  }
}

class _CountCard extends StatelessWidget {
  final String label;
  final int value;
  final IconData icon;
  const _CountCard(
      {required this.label, required this.value, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        child: Column(children: [
          Icon(icon,
              color: Theme.of(context).colorScheme.primary, size: 22),
          const SizedBox(height: 6),
          Text('$value',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, fontSize: 18)),
          Text(label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color:
                      Theme.of(context).colorScheme.onSurfaceVariant)),
        ]),
      ),
    );
  }
}
