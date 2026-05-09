import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/design_system.dart';

final _currFmt = NumberFormat('#,##0.00', 'en_US');
String _fmt(double v) => 'LKR ${_currFmt.format(v)}';
String _fmtDate(DateTime? d) =>
    d == null ? '-' : DateFormat('dd MMM yyyy').format(d);

// ── Riverpod providers ────────────────────────────────────────────────────
final _commissionsProvider =
    FutureProvider.autoDispose<List<AdminCommission>>((ref) {
  return ref.read(adminServiceProvider).getCommissions();
});

final _payoutLogsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(adminServiceProvider).getPayoutLogs();
});

// ── Main screen ───────────────────────────────────────────────────────────
class AdminCommissionsScreen extends ConsumerStatefulWidget {
  const AdminCommissionsScreen({super.key});

  @override
  ConsumerState<AdminCommissionsScreen> createState() =>
      _AdminCommissionsScreenState();
}

class _AdminCommissionsScreenState
    extends ConsumerState<AdminCommissionsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  final Set<int> _selected = {};
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _tabs.addListener(() => setState(() => _selected.clear()));
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _approve() async {
    if (_selected.isEmpty) return;
    setState(() => _loading = true);
    try {
      await ref.read(adminServiceProvider).approveCommissions(_selected.toList());
      _selected.clear();
      ref.invalidate(_commissionsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Commissions approved')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _payout() async {
    if (_selected.isEmpty) return;
    setState(() => _loading = true);
    try {
      await ref.read(adminServiceProvider).payoutCommissions(_selected.toList());
      _selected.clear();
      ref.invalidate(_commissionsProvider);
      ref.invalidate(_payoutLogsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Marked as paid')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      TabBar(
        controller: _tabs,
        tabs: const [
          Tab(text: 'Pending'),
          Tab(text: 'Approved'),
          Tab(text: 'Paid'),
        ],
      ),
      Expanded(
        child: TabBarView(
          controller: _tabs,
          children: [
            _CommissionList(
              statusFilter: 'pending',
              selected: _selected,
              onSelectionChanged: (id, val) =>
                  setState(() => val ? _selected.add(id) : _selected.remove(id)),
              actionLabel: 'Approve Selected',
              actionColor: Colors.blue,
              onAction: _approve,
              loading: _loading,
            ),
            _CommissionList(
              statusFilter: 'approved',
              selected: _selected,
              onSelectionChanged: (id, val) =>
                  setState(() => val ? _selected.add(id) : _selected.remove(id)),
              actionLabel: 'Mark as Paid',
              actionColor: AppColors.success,
              onAction: _payout,
              loading: _loading,
            ),
            _PayoutLogList(),
          ],
        ),
      ),
    ]);
  }
}

// ── Commission list (pending or approved) ─────────────────────────────────
class _CommissionList extends ConsumerWidget {
  final String statusFilter;
  final Set<int> selected;
  final void Function(int id, bool val) onSelectionChanged;
  final String actionLabel;
  final Color actionColor;
  final VoidCallback onAction;
  final bool loading;

  const _CommissionList({
    required this.statusFilter,
    required this.selected,
    required this.onSelectionChanged,
    required this.actionLabel,
    required this.actionColor,
    required this.onAction,
    required this.loading,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final all = ref.watch(_commissionsProvider);

    return all.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (list) {
        final filtered = list.where((c) {
          if (statusFilter == 'pending') return c.isPending;
          if (statusFilter == 'approved') return c.isApproved;
          return false;
        }).toList();

        if (filtered.isEmpty) {
          return DSEmptyState(
            icon: Icons.account_balance_wallet_outlined,
            heading: 'No ${statusFilter == 'pending' ? 'pending' : 'approved'} commissions',
          );
        }

        final totalSelected = filtered
            .where((c) => selected.contains(c.id))
            .fold(0.0, (s, c) => s + c.amount);

        return Column(children: [
          if (filtered.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
              child: Row(children: [
                Checkbox(
                  value: selected.containsAll(filtered.map((c) => c.id)),
                  tristate: true,
                  onChanged: (v) {
                    if (v == true) {
                      for (final c in filtered) onSelectionChanged(c.id, true);
                    } else {
                      for (final c in filtered) onSelectionChanged(c.id, false);
                    }
                  },
                ),
                Text('Select all  (${filtered.length})',
                    style: const TextStyle(fontSize: 13)),
                const Spacer(),
                if (selected.isNotEmpty)
                  Text(_fmt(totalSelected),
                      style: TextStyle(
                          fontWeight: FontWeight.bold, color: actionColor)),
              ]),
            ),
            const Divider(height: 1),
          ],
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.refresh(_commissionsProvider.future),
              child: ListView.builder(
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 80),
                itemCount: filtered.length,
                itemBuilder: (_, i) {
                  final c = filtered[i];
                  final isSelected = selected.contains(c.id);
                  return Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                    color: isSelected
                        ? actionColor.withValues(alpha: 0.08)
                        : null,
                    child: CheckboxListTile(
                      value: isSelected,
                      onChanged: (v) => onSelectionChanged(c.id, v ?? false),
                      activeColor: actionColor,
                      contentPadding: const EdgeInsets.fromLTRB(4, 4, 12, 4),
                      title: Row(children: [
                        Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(c.agentName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 13)),
                                Text(c.shopName,
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.grey[600])),
                              ]),
                        ),
                        Column(crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                          Text(_fmt(c.amount),
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: actionColor)),
                          _TypeBadge(type: c.commissionType),
                        ]),
                      ]),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '${c.month != null ? "${c.month!}  " : ""}'
                          '${_fmtDate(c.createdAt)}',
                          style:
                              TextStyle(fontSize: 11, color: Colors.grey[500]),
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          if (selected.isNotEmpty)
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton.icon(
                  onPressed: loading ? null : onAction,
                  style: FilledButton.styleFrom(
                    backgroundColor: actionColor,
                    minimumSize: const Size(double.infinity, 50),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.check_circle_outline),
                  label: Text('$actionLabel (${selected.length})'),
                ),
              ),
            ),
        ]);
      },
    );
  }
}

// ── Paid history / payout logs ────────────────────────────────────────────
class _PayoutLogList extends ConsumerWidget {
  const _PayoutLogList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Show paid commissions from commission list
    final all = ref.watch(_commissionsProvider);

    return all.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (list) {
        final paid = list.where((c) => c.isPaid).toList();
        if (paid.isEmpty) {
          return const DSEmptyState(
            icon: Icons.receipt_long_outlined,
            heading: 'No paid commissions yet',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(_commissionsProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 20),
            itemCount: paid.length,
            itemBuilder: (_, i) {
              final c = paid[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                elevation: 0,
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: AppColors.success.withValues(alpha: 0.12),
                    child: const Icon(Icons.check, color: AppColors.success),
                  ),
                  title: Text(c.agentName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  subtitle: Text(
                    '${c.shopName}  ${c.month ?? ''}\nPaid ${_fmtDate(c.paidAt)}',
                    style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                  ),
                  isThreeLine: true,
                  trailing: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(_fmt(c.amount),
                          style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              color: AppColors.success)),
                      _TypeBadge(type: c.commissionType),
                    ],
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

// ── Commission type badge ─────────────────────────────────────────────────
class _TypeBadge extends StatelessWidget {
  final String type;
  const _TypeBadge({required this.type});

  @override
  Widget build(BuildContext context) {
    final isOnboarding = type == 'onboarding';
    final color = isOnboarding ? const Color(0xFF7C3AED) : const Color(0xFF0D9488);
    return Container(
      margin: const EdgeInsets.only(top: 3),
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        isOnboarding ? 'Onboarding' : 'Monthly',
        style: GoogleFonts.inter(
            fontSize: 9, color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}
