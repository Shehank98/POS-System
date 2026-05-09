import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';
import '../../widgets/common/design_system.dart';

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
              return const DSEmptyState(
                icon: Icons.store_outlined,
                heading: 'No shops found',
                subtext: 'Try adjusting your search or filter',
              );
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final statusColor = shop.isActive
        ? AppColors.statusActive
        : shop.isTrial
            ? AppColors.statusTrial
            : AppColors.statusExpired;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.cardDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: isDark ? null : Border.all(color: AppColors.border, width: 0.8),
        boxShadow: isDark ? [] : [AppColors.cardShadowSm],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => AdminShopDetailScreen(shop: shop),
          )),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              DSAvatar(name: shop.name, size: 40, backgroundColor: statusColor),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    shop.name,
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: isDark ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    shop.ownerName,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: isDark ? const Color(0xFF94A3B8) : AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Row(children: [
                    DSStatusBadge.fromStatus(shop.subscriptionStatus),
                    if (shop.subscriptionEndDate != null) ...[
                      const SizedBox(width: 8),
                      Text(
                        'Expires ${DateFormat('dd MMM yy').format(shop.subscriptionEndDate!)}',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: isDark ? const Color(0xFF64748B) : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ]),
                ]),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: isDark ? const Color(0xFF475569) : AppColors.textMuted,
              ),
            ]),
          ),
        ),
      ),
    );
  }
}

// ── Shop Detail ────────────────────────────────────────────────────────

final _shopUsersProvider =
    FutureProvider.autoDispose.family<List<ShopUser>, int>((ref, shopId) {
  return ref.read(adminServiceProvider).getShopUsers(shopId);
});

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
  bool _deleting = false;

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
          IconButton(
            icon: _deleting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.red))
                : const Icon(Icons.delete_outline, color: Colors.red),
            onPressed: _deleting ? null : () => _confirmDelete(context),
            tooltip: 'Delete shop',
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
          const SizedBox(height: 24),
          _ShopUsersSection(shopId: shop.id),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Shop'),
        content: Text(
            'Permanently delete "${widget.shop.name}"?\n\nThis action cannot be undone. All shop data including products, transactions, and users will be removed.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _deleting = true);
    try {
      await ref.read(adminServiceProvider).deleteShop(widget.shop.id);
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Shop deleted'),
              backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
        setState(() => _deleting = false);
      }
    }
  }
}

// ── Shop Users Management ─────────────────────────────────────────────────
class _ShopUsersSection extends ConsumerWidget {
  final int shopId;
  const _ShopUsersSection({required this.shopId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final async = ref.watch(_shopUsersProvider(shopId));

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('Shop Users',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const Spacer(),
        TextButton.icon(
          onPressed: () => ref.invalidate(_shopUsersProvider(shopId)),
          icon: const Icon(Icons.refresh, size: 16),
          label: const Text('Refresh'),
        ),
      ]),
      const SizedBox(height: 8),
      async.when(
        loading: () => const Center(
            child: Padding(
          padding: EdgeInsets.all(16),
          child: CircularProgressIndicator(),
        )),
        error: (e, _) => Text('Error loading users: $e',
            style: TextStyle(color: cs.error)),
        data: (users) {
          if (users.isEmpty) {
            return Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text('No users yet',
                    style: TextStyle(color: cs.onSurfaceVariant)),
              ),
            );
          }
          return Column(
            children: users.map((u) => _ShopUserTile(
              user: u,
              shopId: shopId,
              onDeleted: () => ref.invalidate(_shopUsersProvider(shopId)),
            )).toList(),
          );
        },
      ),
    ]);
  }
}

class _ShopUserTile extends ConsumerWidget {
  final ShopUser user;
  final int shopId;
  final VoidCallback onDeleted;
  const _ShopUserTile(
      {required this.user, required this.shopId, required this.onDeleted});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: cs.primaryContainer,
          child: Text(
            user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
            style: TextStyle(color: cs.onPrimaryContainer),
          ),
        ),
        title: Text(user.name,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('@${user.username}',
                style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant)),
            Row(children: [
              Container(
                margin: const EdgeInsets.only(top: 2),
                padding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                decoration: BoxDecoration(
                  color: cs.secondaryContainer,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(user.role,
                    style: TextStyle(
                        fontSize: 10, color: cs.onSecondaryContainer)),
              ),
              const SizedBox(width: 6),
              if (!user.isActive)
                Container(
                  margin: const EdgeInsets.only(top: 2),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                  decoration: BoxDecoration(
                    color: Colors.red.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text('Inactive',
                      style: TextStyle(
                          fontSize: 10,
                          color: Colors.red,
                          fontWeight: FontWeight.w600)),
                ),
            ]),
          ],
        ),
        isThreeLine: true,
        trailing: IconButton(
          icon: const Icon(Icons.delete_outline, color: Colors.red, size: 20),
          onPressed: () => _confirmRemove(context, ref),
          tooltip: 'Remove user',
        ),
      ),
    );
  }

  Future<void> _confirmRemove(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove User'),
        content: Text('Remove ${user.name} from this shop?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(adminServiceProvider).deleteShopUser(shopId, user.id);
      onDeleted();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('${user.name} removed')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    }
  }
}

class _InfoCard extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;
  const _InfoCard({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return DSInfoTile(label: label, value: value, valueColor: valueColor);
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
