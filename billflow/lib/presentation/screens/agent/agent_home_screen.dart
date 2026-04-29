import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/agent_model.dart';
import '../../../data/services/agent_service.dart';
import '../../../providers/agent_auth_provider.dart';
import '../../../providers/agent_provider.dart';
import '../../widgets/common/shimmer_list.dart';

// ── Formatters ────────────────────────────────────────────────
final _currFmt = NumberFormat('#,##0.00', 'en_US');
String fmtMoney(double v) => 'LKR ${_currFmt.format(v)}';
String fmtDate(DateTime? d) =>
    d == null ? '—' : DateFormat('dd MMM yyyy').format(d);

// ── Status helpers ────────────────────────────────────────────
Color _subColor(String status) {
  switch (status) {
    case 'active':    return AppColors.success;
    case 'trial':     return AppColors.primaryLight;
    case 'expired':   return AppColors.danger;
    default:          return Colors.grey;
  }
}

Color _commColor(String status) {
  switch (status) {
    case 'approved': return AppColors.success;
    case 'paid':     return AppColors.primaryLight;
    default:         return Colors.grey;
  }
}

Color _payColor(String status) {
  switch (status) {
    case 'verified':             return AppColors.success;
    case 'pending_verification': return AppColors.warning;
    case 'rejected':             return AppColors.danger;
    default:                     return Colors.grey;
  }
}

String _payLabel(String status) {
  switch (status) {
    case 'pending_verification': return 'Pending';
    case 'verified':             return 'Verified';
    case 'rejected':             return 'Rejected';
    default:                     return status;
  }
}

// ── Stat card ─────────────────────────────────────────────────
class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 8),
            Text(value,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: const TextStyle(fontSize: 11, color: Colors.black54)),
          ],
        ),
      );
}

// ── Dashboard tab ─────────────────────────────────────────────
class _DashboardTab extends ConsumerWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dash = ref.watch(agentDashboardProvider);
    return dash.when(
      loading: () => const ShimmerList(itemCount: 6),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (d) => RefreshIndicator(
        onRefresh: () => ref.refresh(agentDashboardProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Target progress
            if (d.monthlyTarget > 0) ...[
              Row(children: [
                const Icon(Icons.flag_outlined, size: 16, color: Colors.black54),
                const SizedBox(width: 6),
                Text('Monthly target: ${d.activeCustomers} / ${d.monthlyTarget} active shops',
                    style: const TextStyle(fontSize: 13, color: Colors.black54)),
              ]),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: d.monthlyTarget > 0
                      ? (d.activeCustomers / d.monthlyTarget).clamp(0.0, 1.0)
                      : 0,
                  minHeight: 8,
                  backgroundColor: Colors.grey[200],
                  valueColor: AlwaysStoppedAnimation(AppColors.accent),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Stats grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 10,
              mainAxisSpacing: 10,
              childAspectRatio: 1.3,
              children: [
                _StatCard(label: 'Total Shops',   value: '${d.totalCustomers}',  icon: Icons.store_outlined,        color: AppColors.primary),
                _StatCard(label: 'Active Shops',  value: '${d.activeCustomers}', icon: Icons.check_circle_outline,  color: AppColors.success),
                _StatCard(label: 'Approved Earn', value: fmtMoney(d.approvedEarnings), icon: Icons.account_balance_wallet_outlined, color: AppColors.accent),
                _StatCard(label: 'Pending Earn',  value: fmtMoney(d.pendingEarnings),  icon: Icons.lock_outline,          color: AppColors.warning),
              ],
            ),

            if (d.pendingSubmissions > 0) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.warning.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.warning.withOpacity(0.4)),
                ),
                child: Row(children: [
                  Icon(Icons.hourglass_top_outlined, color: AppColors.warning, size: 18),
                  const SizedBox(width: 8),
                  Text('${d.pendingSubmissions} cash payment(s) awaiting admin verification',
                      style: TextStyle(fontSize: 13, color: AppColors.warning)),
                ]),
              ),
            ],

            // Expiring soon
            if (d.expiringSoon.isNotEmpty) ...[
              const SizedBox(height: 20),
              const Text('Expiring Soon (3 days)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 8),
              ...d.expiringSoon.map((s) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.dangerLight.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.danger.withOpacity(0.3)),
                    ),
                    child: Row(children: [
                      const Icon(Icons.warning_amber_outlined, color: AppColors.danger, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(s['name']?.toString() ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w500)),
                      ),
                      Text(
                        s['subscription_end_date'] != null
                            ? fmtDate(DateTime.tryParse(s['subscription_end_date'] as String))
                            : '—',
                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                    ]),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}

// ── Customers tab ─────────────────────────────────────────────
class _CustomersTab extends ConsumerStatefulWidget {
  const _CustomersTab();
  @override
  ConsumerState<_CustomersTab> createState() => _CustomersTabState();
}

class _CustomersTabState extends ConsumerState<_CustomersTab> {
  final _search = TextEditingController();
  String _q = '';

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  void _showOnboardSheet() {
    final nameCtrl    = TextEditingController();
    final ownerCtrl   = TextEditingController();
    final emailCtrl   = TextEditingController();
    final phoneCtrl   = TextEditingController();
    final addressCtrl = TextEditingController();
    bool saving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(builder: (ctx, setSt) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.only(
          top: 20, left: 20, right: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Text('Onboard New Shop',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            for (final cfg in [
              {'ctrl': nameCtrl,    'label': 'Shop Name',   'required': true,  'type': TextInputType.text},
              {'ctrl': ownerCtrl,   'label': 'Owner Name',  'required': true,  'type': TextInputType.text},
              {'ctrl': emailCtrl,   'label': 'Email',       'required': true,  'type': TextInputType.emailAddress},
              {'ctrl': phoneCtrl,   'label': 'Phone',       'required': false, 'type': TextInputType.phone},
              {'ctrl': addressCtrl, 'label': 'Address',     'required': false, 'type': TextInputType.streetAddress},
            ]) ...[
              TextField(
                controller: cfg['ctrl'] as TextEditingController,
                keyboardType: cfg['type'] as TextInputType,
                decoration: InputDecoration(
                  labelText: cfg['label'] as String,
                  border: const OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 10),
            ],
            FilledButton(
              onPressed: saving ? null : () async {
                if (nameCtrl.text.isEmpty || ownerCtrl.text.isEmpty || emailCtrl.text.isEmpty) return;
                setSt(() => saving = true);
                try {
                  await ref.read(agentServiceProvider).onboardCustomer({
                    'name': nameCtrl.text.trim(),
                    'owner_name': ownerCtrl.text.trim(),
                    'email': emailCtrl.text.trim(),
                    'phone': phoneCtrl.text.trim().isEmpty ? null : phoneCtrl.text.trim(),
                    'address': addressCtrl.text.trim().isEmpty ? null : addressCtrl.text.trim(),
                  });
                  ref.invalidate(agentCustomersProvider);
                  ref.invalidate(agentDashboardProvider);
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Shop onboarded successfully')),
                    );
                  }
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                    );
                  }
                } finally {
                  setSt(() => saving = false);
                }
              },
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
              child: saving
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Onboard Shop'),
            ),
          ]),
        ),
      )),
    );
  }

  @override
  Widget build(BuildContext context) {
    final customers = ref.watch(agentCustomersProvider);
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: _search,
              onChanged: (v) => setState(() => _q = v.toLowerCase()),
              decoration: InputDecoration(
                hintText: 'Search shops…',
                prefixIcon: const Icon(Icons.search, size: 18),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              ),
            ),
          ),
          const SizedBox(width: 10),
          FilledButton.icon(
            onPressed: _showOnboardSheet,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Add'),
          ),
        ]),
      ),
      Expanded(child: customers.when(
        loading: () => const ShimmerList(itemCount: 6),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) {
          final filtered = list.where((c) =>
              c.name.toLowerCase().contains(_q) ||
              c.ownerName.toLowerCase().contains(_q) ||
              c.email.toLowerCase().contains(_q)).toList();
          if (filtered.isEmpty) {
            return const Center(child: Text('No customers found', style: TextStyle(color: Colors.black45)));
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(agentCustomersProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final c = filtered[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    leading: CircleAvatar(
                      backgroundColor: _subColor(c.subscriptionStatus).withOpacity(0.15),
                      child: Text(c.name[0].toUpperCase(),
                          style: TextStyle(color: _subColor(c.subscriptionStatus), fontWeight: FontWeight.bold)),
                    ),
                    title: Row(children: [
                      Expanded(child: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w600))),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: _subColor(c.subscriptionStatus).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(c.subscriptionStatus,
                            style: TextStyle(fontSize: 11, color: _subColor(c.subscriptionStatus))),
                      ),
                    ]),
                    subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(c.ownerName, style: const TextStyle(fontSize: 12)),
                      if (c.subscriptionEndDate != null)
                        Text('Expires: ${fmtDate(c.subscriptionEndDate)}',
                            style: TextStyle(fontSize: 11,
                                color: c.isExpiring ? AppColors.danger : Colors.black45)),
                    ]),
                  ),
                );
              },
            ),
          );
        },
      )),
    ]);
  }
}

// ── Payments tab ──────────────────────────────────────────────
class _PaymentsTab extends ConsumerStatefulWidget {
  const _PaymentsTab();
  @override
  ConsumerState<_PaymentsTab> createState() => _PaymentsTabState();
}

class _PaymentsTabState extends ConsumerState<_PaymentsTab> {
  void _showSubmitSheet(List<AgentCustomer> customers) {
    AgentCustomer? selected;
    final amountCtrl = TextEditingController();
    final dateCtrl   = TextEditingController(
        text: DateFormat('yyyy-MM-dd').format(DateTime.now()));
    final notesCtrl  = TextEditingController();
    bool saving      = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StatefulBuilder(builder: (ctx, setSt) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.only(
          top: 20, left: 20, right: 20,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: SingleChildScrollView(child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Submit Cash Payment',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            const Text(
              'Payment will remain PENDING until admin verifies it.',
              style: TextStyle(fontSize: 12, color: Colors.orange),
            ),
            const SizedBox(height: 16),

            DropdownButtonFormField<AgentCustomer>(
              value: selected,
              decoration: const InputDecoration(labelText: 'Select Shop', border: OutlineInputBorder()),
              items: customers.map((c) => DropdownMenuItem(
                value: c,
                child: Text(c.name, overflow: TextOverflow.ellipsis),
              )).toList(),
              onChanged: (v) => setSt(() => selected = v),
            ),
            const SizedBox(height: 10),

            TextField(
              controller: amountCtrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Amount (LKR)', border: OutlineInputBorder(),
                prefixText: 'LKR ',
              ),
            ),
            const SizedBox(height: 10),

            TextField(
              controller: dateCtrl,
              decoration: const InputDecoration(
                labelText: 'Payment Date', border: OutlineInputBorder(),
                suffixIcon: Icon(Icons.calendar_today_outlined, size: 18),
              ),
              readOnly: true,
              onTap: () async {
                final d = await showDatePicker(
                  context: ctx,
                  initialDate: DateTime.now(),
                  firstDate: DateTime.now().subtract(const Duration(days: 30)),
                  lastDate: DateTime.now(),
                );
                if (d != null) setSt(() => dateCtrl.text = DateFormat('yyyy-MM-dd').format(d));
              },
            ),
            const SizedBox(height: 10),

            TextField(
              controller: notesCtrl,
              decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
              maxLines: 2,
            ),
            const SizedBox(height: 16),

            FilledButton(
              onPressed: saving || selected == null ? null : () async {
                final amt = double.tryParse(amountCtrl.text);
                if (amt == null || amt <= 0) return;
                setSt(() => saving = true);
                try {
                  await ref.read(agentServiceProvider).submitPayment({
                    'shop_id': selected!.id,
                    'amount': amt,
                    'payment_method': 'cash',
                    'payment_date': dateCtrl.text,
                    'notes': notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
                  });
                  ref.invalidate(agentPaymentsProvider);
                  ref.invalidate(agentDashboardProvider);
                  if (ctx.mounted) Navigator.pop(ctx);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Payment submitted — awaiting admin verification')),
                    );
                  }
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(
                      SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
                    );
                  }
                } finally {
                  setSt(() => saving = false);
                }
              },
              style: FilledButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
              child: saving
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Submit Payment'),
            ),
          ],
        )),
      )),
    );
  }

  @override
  Widget build(BuildContext context) {
    final payments   = ref.watch(agentPaymentsProvider);
    final customersA = ref.watch(agentCustomersProvider);

    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Payment Submissions',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
          FilledButton.icon(
            onPressed: customersA.valueOrNull?.isNotEmpty == true
                ? () => _showSubmitSheet(customersA.valueOrNull!)
                : null,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Submit'),
          ),
        ]),
      ),
      Expanded(child: payments.when(
        loading: () => const ShimmerList(itemCount: 6),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) {
          if (list.isEmpty) return const Center(
              child: Text('No submissions yet', style: TextStyle(color: Colors.black45)));
          return RefreshIndicator(
            onRefresh: () => ref.refresh(agentPaymentsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: list.length,
              itemBuilder: (_, i) {
                final p = list[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(p.shopName,
                            style: const TextStyle(fontWeight: FontWeight.w600))),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: _payColor(p.status).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(_payLabel(p.status),
                              style: TextStyle(fontSize: 11, color: _payColor(p.status))),
                        ),
                      ]),
                      const SizedBox(height: 4),
                      Text(fmtMoney(p.amount),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold,
                              color: AppColors.primary)),
                      Text('${p.paymentMethod.toUpperCase()} · ${fmtDate(p.paymentDate)}',
                          style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      if (p.adminNote != null) ...[
                        const SizedBox(height: 4),
                        Text('Admin: ${p.adminNote}',
                            style: const TextStyle(fontSize: 12, color: Colors.red)),
                      ],
                    ]),
                  ),
                );
              },
            ),
          );
        },
      )),
    ]);
  }
}

// ── Commissions tab ───────────────────────────────────────────
class _CommissionsTab extends ConsumerWidget {
  const _CommissionsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final commissions = ref.watch(agentCommissionsProvider);
    return commissions.when(
      loading: () => const ShimmerList(itemCount: 6),
      error: (e, _) => Center(child: Text('$e')),
      data: (list) {
        final locked   = list.where((c) => c.status == 'locked').toList();
        final approved = list.where((c) => c.status == 'approved').toList();
        final paid     = list.where((c) => c.status == 'paid').toList();

        final totalApproved = approved.fold(0.0, (s, c) => s + c.amount);
        final totalPaid     = paid.fold(0.0, (s, c) => s + c.amount);
        final totalLocked   = locked.fold(0.0, (s, c) => s + c.amount);

        return RefreshIndicator(
          onRefresh: () => ref.refresh(agentCommissionsProvider.future),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Summary
              Row(children: [
                Expanded(child: _StatCard(label: 'Approved', value: fmtMoney(totalApproved),
                    icon: Icons.check_circle_outline, color: AppColors.success)),
                const SizedBox(width: 10),
                Expanded(child: _StatCard(label: 'Paid Out', value: fmtMoney(totalPaid),
                    icon: Icons.payments_outlined, color: AppColors.primaryLight)),
              ]),
              const SizedBox(height: 10),
              _StatCard(label: 'Locked (awaiting verification)', value: fmtMoney(totalLocked),
                  icon: Icons.lock_outline, color: AppColors.warning),

              if (list.isEmpty) ...[
                const SizedBox(height: 40),
                const Center(child: Text('No commissions yet', style: TextStyle(color: Colors.black45))),
              ],

              for (final section in [
                {'label': 'Approved', 'items': approved, 'color': AppColors.success},
                {'label': 'Locked',   'items': locked,   'color': AppColors.warning},
                {'label': 'Paid',     'items': paid,     'color': AppColors.primaryLight},
              ]) ...[
                if ((section['items'] as List).isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Text(section['label'] as String,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 8),
                  ...(section['items'] as List<AgentCommission>).map((c) => Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: (section['color'] as Color).withOpacity(0.12),
                        child: Icon(
                          c.commissionType == 'signup' ? Icons.person_add_outlined : Icons.autorenew,
                          color: section['color'] as Color, size: 18,
                        ),
                      ),
                      title: Text(c.shopName, style: const TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text(
                        '${c.commissionType == 'signup' ? 'Signup' : 'Recurring'}'
                        '${c.month != null ? ' · ${DateFormat('MMM yyyy').format(c.month!)}' : ''}',
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: Text(fmtMoney(c.amount),
                          style: TextStyle(fontWeight: FontWeight.bold,
                              color: section['color'] as Color)),
                    ),
                  )),
                ],
              ],
            ],
          ),
        );
      },
    );
  }
}

// ── Profile tab ───────────────────────────────────────────────
class _ProfileTab extends ConsumerStatefulWidget {
  const _ProfileTab();
  @override
  ConsumerState<_ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends ConsumerState<_ProfileTab> {
  bool _editingBank = false;
  final _bankNameCtrl    = TextEditingController();
  final _bankAccountCtrl = TextEditingController();
  final _bankBranchCtrl  = TextEditingController();
  final _accountHolderCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _bankNameCtrl.dispose(); _bankAccountCtrl.dispose();
    _bankBranchCtrl.dispose(); _accountHolderCtrl.dispose();
    super.dispose();
  }

  void _startEdit(AgentModel agent) {
    _bankNameCtrl.text       = agent.bankName ?? '';
    _bankAccountCtrl.text    = agent.bankAccount ?? '';
    _bankBranchCtrl.text     = agent.bankBranch ?? '';
    _accountHolderCtrl.text  = agent.accountHolder ?? '';
    setState(() => _editingBank = true);
  }

  Future<void> _saveBank(AgentModel agent) async {
    setState(() => _saving = true);
    try {
      await ref.read(agentServiceProvider).updateBankDetails({
        'bank_name':      _bankNameCtrl.text.trim(),
        'bank_account':   _bankAccountCtrl.text.trim(),
        'bank_branch':    _bankBranchCtrl.text.trim(),
        'account_holder': _accountHolderCtrl.text.trim(),
      });
      // Refresh agent profile
      await ref.read(agentAuthProvider.notifier).build();
      setState(() => _editingBank = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bank details updated')));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
    } finally {
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final agentAsync = ref.watch(agentAuthProvider);
    final agent = agentAsync.valueOrNull;
    if (agent == null) return const Center(child: CircularProgressIndicator());

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Profile card
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(children: [
              CircleAvatar(
                radius: 32,
                backgroundColor: const Color(0xFF2E7D32).withOpacity(0.15),
                child: Text(agent.name[0].toUpperCase(),
                    style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold,
                        color: Color(0xFF2E7D32))),
              ),
              const SizedBox(height: 10),
              Text(agent.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text(agent.email, style: const TextStyle(color: Colors.black54, fontSize: 13)),
              if (agent.district != null) ...[
                const SizedBox(height: 4),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  const Icon(Icons.location_on_outlined, size: 14, color: Colors.black45),
                  const SizedBox(width: 4),
                  Text(agent.district!, style: const TextStyle(color: Colors.black45, fontSize: 13)),
                ]),
              ],
            ]),
          ),
        ),

        const SizedBox(height: 16),

        // Bank details card
        Card(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                const Icon(Icons.account_balance_outlined, size: 18),
                const SizedBox(width: 8),
                const Text('Bank Details', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                const Spacer(),
                if (!_editingBank)
                  TextButton(onPressed: () => _startEdit(agent), child: const Text('Edit')),
              ]),
              const SizedBox(height: 10),

              if (!_editingBank) ...[
                for (final row in [
                  ['Bank',    agent.bankName ?? '—'],
                  ['Account', agent.bankAccount ?? '—'],
                  ['Branch',  agent.bankBranch ?? '—'],
                  ['Holder',  agent.accountHolder ?? '—'],
                ])
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(children: [
                      SizedBox(width: 72,
                          child: Text(row[0], style: const TextStyle(color: Colors.black45, fontSize: 13))),
                      Expanded(child: Text(row[1], style: const TextStyle(fontWeight: FontWeight.w500))),
                    ]),
                  ),
              ] else ...[
                for (final cfg in [
                  {'ctrl': _bankNameCtrl,       'label': 'Bank Name'},
                  {'ctrl': _bankAccountCtrl,    'label': 'Account Number'},
                  {'ctrl': _bankBranchCtrl,     'label': 'Branch'},
                  {'ctrl': _accountHolderCtrl,  'label': 'Account Holder'},
                ]) ...[
                  TextField(
                    controller: cfg['ctrl'] as TextEditingController,
                    decoration: InputDecoration(
                      labelText: cfg['label'] as String,
                      border: const OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: () => setState(() => _editingBank = false),
                    child: const Text('Cancel'),
                  )),
                  const SizedBox(width: 10),
                  Expanded(child: FilledButton(
                    onPressed: _saving ? null : () => _saveBank(agent),
                    child: _saving
                        ? const SizedBox(height: 18, width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Save'),
                  )),
                ]),
              ],
            ]),
          ),
        ),

        const SizedBox(height: 24),
        OutlinedButton.icon(
          onPressed: () async {
            await ref.read(agentAuthProvider.notifier).logout();
            if (context.mounted) context.go('/agent-login');
          },
          icon: const Icon(Icons.logout, color: Colors.red),
          label: const Text('Sign Out', style: TextStyle(color: Colors.red)),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(double.infinity, 50),
            side: const BorderSide(color: Colors.red),
          ),
        ),
      ],
    );
  }
}

// ── Agent Home Screen (tab container) ─────────────────────────
class AgentHomeScreen extends ConsumerStatefulWidget {
  const AgentHomeScreen({super.key});

  @override
  ConsumerState<AgentHomeScreen> createState() => _AgentHomeScreenState();
}

class _AgentHomeScreenState extends ConsumerState<AgentHomeScreen> {
  int _tab = 0;

  static const _tabs = [
    (icon: Icons.dashboard_outlined,    label: 'Dashboard'),
    (icon: Icons.store_outlined,        label: 'Customers'),
    (icon: Icons.payments_outlined,     label: 'Payments'),
    (icon: Icons.account_balance_wallet_outlined, label: 'Commissions'),
    (icon: Icons.person_outline,        label: 'Profile'),
  ];

  static const _bodies = [
    _DashboardTab(),
    _CustomersTab(),
    _PaymentsTab(),
    _CommissionsTab(),
    _ProfileTab(),
  ];

  @override
  Widget build(BuildContext context) {
    final agent = ref.watch(agentAuthProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1B5E20),
        foregroundColor: Colors.white,
        title: Text(_tabs[_tab].label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        actions: [
          if (agent != null)
            Padding(
              padding: const EdgeInsets.only(right: 14),
              child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(agent.name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white)),
                if (agent.district != null)
                  Text(agent.district!, style: const TextStyle(fontSize: 11, color: Colors.white70)),
              ]),
            ),
        ],
      ),
      body: _bodies[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: _tabs.map((t) => NavigationDestination(
          icon: Icon(t.icon),
          label: t.label,
        )).toList(),
      ),
    );
  }
}
