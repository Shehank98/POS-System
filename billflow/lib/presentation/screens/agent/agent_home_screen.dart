import 'package:flutter/material.dart';
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
    case 'active':          return AppColors.success;
    case 'trial':           return AppColors.primaryLight;
    case 'expired':         return AppColors.danger;
    case 'pending_payment': return Colors.orange;
    default:                return Colors.grey;
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
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3)),
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
                  color: AppColors.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.warning.withValues(alpha: 0.4)),
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
                      color: AppColors.dangerLight.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.danger.withValues(alpha: 0.3)),
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

// ── Onboard wizard sheet ──────────────────────────────────────
class _OnboardWizardSheet extends ConsumerStatefulWidget {
  final VoidCallback onSuccess;
  const _OnboardWizardSheet({required this.onSuccess});
  @override
  ConsumerState<_OnboardWizardSheet> createState() => _OnboardWizardSheetState();
}

class _OnboardWizardSheetState extends ConsumerState<_OnboardWizardSheet>
    with SingleTickerProviderStateMixin {
  final _page = PageController();
  int _step = 0;
  bool _saving = false;

  // Step 1 — shop info
  final _nameCtrl    = TextEditingController();
  final _ownerCtrl   = TextEditingController();
  final _emailCtrl   = TextEditingController();
  final _phoneCtrl   = TextEditingController();
  final _addressCtrl = TextEditingController();
  // Step 2 — login
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscurePw = true;
  // Step 3 — plan
  List<Map<String, dynamic>> _plans = [];
  int? _selectedPlanId;
  int _months = 1;

  static const _monthOpts = [
    (v: 1, label: '1 Month'),
    (v: 3, label: '3 Months  −10%'),
    (v: 6, label: '6 Months  −15%'),
    (v: 12, label: '1 Year  −20%'),
  ];

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  @override
  void dispose() {
    _page.dispose();
    for (final c in [_nameCtrl, _ownerCtrl, _emailCtrl, _phoneCtrl, _addressCtrl,
                     _usernameCtrl, _passwordCtrl]) { c.dispose(); }
    super.dispose();
  }

  Future<void> _loadPlans() async {
    try {
      final plans = await ref.read(agentServiceProvider).getPlans();
      if (mounted) setState(() => _plans = plans);
    } catch (_) {}
  }

  double? _calcPrice() {
    if (_selectedPlanId == null) return null;
    final plan = _plans.firstWhere((p) => p['id'] == _selectedPlanId, orElse: () => {});
    if (plan.isEmpty) return null;
    final base = double.tryParse(plan['base_monthly_price'].toString()) ?? 0;
    double disc = 0;
    if (_months >= 12) disc = double.tryParse(plan['discount_12m'].toString()) ?? 0.20;
    else if (_months >= 6)  disc = double.tryParse(plan['discount_6m'].toString()) ?? 0.15;
    else if (_months >= 3)  disc = double.tryParse(plan['discount_3m'].toString()) ?? 0.10;
    return base * _months * (1 - disc);
  }

  void _goTo(int step) {
    _page.animateToPage(step,
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeInOut,
    );
    setState(() => _step = step);
  }

  bool get _step1Valid =>
      _nameCtrl.text.isNotEmpty && _ownerCtrl.text.isNotEmpty && _emailCtrl.text.isNotEmpty;
  bool get _step2Valid =>
      _usernameCtrl.text.isNotEmpty && _passwordCtrl.text.length >= 6;

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await ref.read(agentServiceProvider).onboardCustomer({
        'name':               _nameCtrl.text.trim(),
        'owner_name':         _ownerCtrl.text.trim(),
        'email':              _emailCtrl.text.trim(),
        'phone':              _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
        'address':            _addressCtrl.text.trim().isEmpty ? null : _addressCtrl.text.trim(),
        'username':           _usernameCtrl.text.trim(),
        'password':           _passwordCtrl.text,
        if (_selectedPlanId != null) 'plan_id': _selectedPlanId,
        'subscription_months': _months,
      });
      if (mounted) {
        Navigator.pop(context);
        widget.onSuccess();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final price = _calcPrice();

    return Container(
      height: MediaQuery.of(context).size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(children: [
        // Handle
        const SizedBox(height: 10),
        Container(width: 36, height: 4,
            decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2))),
        const SizedBox(height: 12),

        // Step indicator
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: List.generate(4, (i) {
            final done    = i < _step;
            final current = i == _step;
            final labels  = ['Shop Info', 'Login', 'Plan', 'Review'];
            return Expanded(child: Row(children: [
              if (i > 0) Expanded(child: Container(
                height: 2,
                color: done ? const Color(0xFF2E7D32) : Colors.grey[200],
              )),
              Column(mainAxisSize: MainAxisSize.min, children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  width: current ? 32 : 24,
                  height: current ? 32 : 24,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: done ? const Color(0xFF2E7D32)
                         : current ? const Color(0xFF1B5E20)
                         : Colors.grey[200],
                  ),
                  child: Center(child: done
                    ? const Icon(Icons.check, color: Colors.white, size: 14)
                    : Text('${i + 1}', style: TextStyle(
                        fontSize: 11, fontWeight: FontWeight.bold,
                        color: current ? Colors.white : Colors.grey[500]))),
                ),
                const SizedBox(height: 4),
                Text(labels[i], style: TextStyle(
                    fontSize: 10,
                    color: current ? const Color(0xFF1B5E20)
                         : done ? const Color(0xFF2E7D32)
                         : Colors.grey[400],
                    fontWeight: current ? FontWeight.bold : FontWeight.normal)),
              ]),
            ]));
          })),
        ),

        const SizedBox(height: 16),
        const Divider(height: 1),

        // Pages
        Expanded(child: PageView(
          controller: _page,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            // ── Step 1: Shop Info ──────────────────────────────
            _WizardPage(children: [
              const Text('Shop Information',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              _field(_nameCtrl,    'Shop Name *',   TextInputType.text),
              _field(_ownerCtrl,   'Owner Name *',  TextInputType.text),
              _field(_emailCtrl,   'Email *',       TextInputType.emailAddress),
              _field(_phoneCtrl,   'Phone',         TextInputType.phone),
              _field(_addressCtrl, 'Address',       TextInputType.streetAddress),
            ]),

            // ── Step 2: Login Account ──────────────────────────
            _WizardPage(children: [
              const Text('Owner Login Account',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              const Text('The shop owner will use these credentials to log into the POS.',
                  style: TextStyle(fontSize: 12, color: Colors.black54)),
              const SizedBox(height: 16),
              _field(_usernameCtrl, 'Username *', TextInputType.text),
              StatefulBuilder(builder: (_, ss) => TextField(
                controller: _passwordCtrl,
                obscureText: _obscurePw,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: 'Password * (min 6 characters)',
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: Icon(_obscurePw ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                    onPressed: () => setState(() => _obscurePw = !_obscurePw),
                  ),
                ),
              )),
            ]),

            // ── Step 3: Subscription Plan ──────────────────────
            _WizardPage(children: [
              const Text('Subscription Plan',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              if (_plans.isEmpty)
                const Text('No plans available — shop will be created without a plan.',
                    style: TextStyle(color: Colors.black45, fontSize: 13))
              else ...[
                ..._plans.map((p) {
                  final id       = p['id'] as int?;
                  final selected = id == _selectedPlanId;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedPlanId = id),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: selected ? const Color(0xFF2E7D32) : Colors.grey[300]!,
                          width: selected ? 2 : 1,
                        ),
                        color: selected ? const Color(0xFFE8F5E9) : Colors.white,
                      ),
                      child: Row(children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 20, height: 20,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: selected ? const Color(0xFF2E7D32) : Colors.grey[400]!,
                              width: 2,
                            ),
                            color: selected ? const Color(0xFF2E7D32) : Colors.transparent,
                          ),
                          child: selected
                              ? const Icon(Icons.check, color: Colors.white, size: 12)
                              : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Text(p['name']?.toString() ?? '',
                            style: const TextStyle(fontWeight: FontWeight.w600))),
                        Text('LKR ${NumberFormat('#,##0').format(double.tryParse(p['base_monthly_price'].toString()) ?? 0)}/mo',
                            style: const TextStyle(fontWeight: FontWeight.bold,
                                color: Color(0xFF2E7D32), fontSize: 13)),
                      ]),
                    ),
                  );
                }),
                const SizedBox(height: 8),
                const Text('Duration', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 8),
                Wrap(spacing: 8, runSpacing: 8, children: _monthOpts.map((o) {
                  final sel = _months == o.v;
                  return GestureDetector(
                    onTap: () => setState(() => _months = o.v),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        color: sel ? const Color(0xFF1B5E20) : Colors.grey[100],
                        border: Border.all(
                          color: sel ? const Color(0xFF1B5E20) : Colors.grey[300]!),
                      ),
                      child: Text(o.label, style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w600,
                          color: sel ? Colors.white : Colors.black87)),
                    ),
                  );
                }).toList()),
              ],
              if (price != null) ...[
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFE8F5E9),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(children: [
                    const Icon(Icons.calculate_outlined, color: Color(0xFF2E7D32), size: 18),
                    const SizedBox(width: 8),
                    Text('Expected payment: ',
                        style: const TextStyle(fontSize: 13, color: Colors.black54)),
                    Text(fmtMoney(price),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold,
                            color: Color(0xFF1B5E20))),
                  ]),
                ),
              ],
            ]),

            // ── Step 4: Review ────────────────────────────────
            _WizardPage(children: [
              const Text('Review & Confirm',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              ...[
                ['Shop Name',  _nameCtrl.text],
                ['Owner',      _ownerCtrl.text],
                ['Email',      _emailCtrl.text],
                if (_phoneCtrl.text.isNotEmpty) ['Phone', _phoneCtrl.text],
                ['Username',   _usernameCtrl.text],
                ['Plan',       _plans.firstWhere((p) => p['id'] == _selectedPlanId, orElse: () => {'name': '— no plan'})['name'].toString()],
                ['Duration',   '$_months month${_months > 1 ? 's' : ''}'],
                if (price != null) ['Expected Amt', fmtMoney(price)],
              ].map((row) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  SizedBox(width: 110,
                      child: Text(row[0], style: const TextStyle(color: Colors.black45, fontSize: 13))),
                  Expanded(child: Text(row[1],
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13))),
                ]),
              )),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange[50],
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.orange[200]!),
                ),
                child: const Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.info_outline, color: Colors.orange, size: 16),
                  SizedBox(width: 8),
                  Expanded(child: Text(
                    'Shop will be Pending Payment. You must submit cash payment after collecting from the owner.',
                    style: TextStyle(fontSize: 12, color: Colors.orange),
                  )),
                ]),
              ),
            ]),
          ],
        )),

        // Bottom nav buttons
        Padding(
          padding: EdgeInsets.fromLTRB(20, 8, 20, MediaQuery.of(context).viewInsets.bottom + 20),
          child: Row(children: [
            Expanded(child: OutlinedButton(
              onPressed: _saving ? null : () {
                if (_step == 0) Navigator.pop(context);
                else _goTo(_step - 1);
              },
              style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 48)),
              child: Text(_step == 0 ? 'Cancel' : 'Back'),
            )),
            const SizedBox(width: 12),
            Expanded(child: FilledButton(
              onPressed: _saving ? null : () {
                if (_step == 0 && !_step1Valid) return;
                if (_step == 1 && !_step2Valid) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Password must be at least 6 characters')));
                  return;
                }
                if (_step < 3) _goTo(_step + 1);
                else _submit();
              },
              style: FilledButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                backgroundColor: const Color(0xFF1B5E20),
              ),
              child: _saving
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_step < 3 ? 'Next' : 'Onboard Shop'),
            )),
          ]),
        ),
      ]),
    );
  }

  Widget _field(TextEditingController ctrl, String label, TextInputType type) =>
    Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: ctrl,
        keyboardType: type,
        onChanged: (_) => setState(() {}),
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      ),
    );
}

class _WizardPage extends StatelessWidget {
  final List<Widget> children;
  const _WizardPage({required this.children});
  @override
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children),
  );
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
  String _filter = 'all'; // all | active | pending | expired

  @override
  void dispose() { _search.dispose(); super.dispose(); }

  void _showOnboardSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _OnboardWizardSheet(
        onSuccess: () {
          ref.invalidate(agentCustomersProvider);
          ref.invalidate(agentDashboardProvider);
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Shop onboarded — awaiting payment')),
            );
          }
        },
      ),
    );
  }

  String _expiryLabel(AgentCustomer c) {
    final days = c.daysUntilExpiry;
    if (days == null) return '';
    if (days < 0)  return 'Expired ${-days} day${-days == 1 ? '' : 's'} ago';
    if (days == 0) return 'Expires today';
    return 'Expires in $days day${days == 1 ? '' : 's'}';
  }

  Color _expiryColor(AgentCustomer c) {
    final days = c.daysUntilExpiry;
    if (days == null) return Colors.transparent;
    if (days < 0)  return AppColors.danger;
    if (days <= 3) return AppColors.danger;
    if (days <= 7) return AppColors.warning;
    return Colors.black45;
  }

  @override
  Widget build(BuildContext context) {
    final customers = ref.watch(agentCustomersProvider);

    return Column(children: [
      // Search + Add
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
            icon: const Icon(Icons.store_mall_directory, size: 18),
            label: const Text('Onboard'),
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF1B5E20)),
          ),
        ]),
      ),

      // Filter chips
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(children: [
            for (final (id, label) in [
              ('all',     'All'),
              ('active',  'Active'),
              ('pending', 'Pending'),
              ('expired', 'Expired'),
            ])
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(label),
                  selected: _filter == id,
                  onSelected: (_) => setState(() => _filter = id),
                  selectedColor: _filter == id ? _filterColor(id).withValues(alpha: 0.2) : null,
                  labelStyle: TextStyle(
                    fontSize: 12,
                    color: _filter == id ? _filterColor(id) : null,
                    fontWeight: _filter == id ? FontWeight.w600 : FontWeight.normal,
                  ),
                  checkmarkColor: _filterColor(id),
                  side: BorderSide(
                    color: _filter == id ? _filterColor(id) : Colors.grey[300]!,
                  ),
                ),
              ),
          ]),
        ),
      ),

      Expanded(child: customers.when(
        loading: () => const ShimmerList(itemCount: 6),
        error: (e, _) => Center(child: Text('$e')),
        data: (list) {
          final filtered = list.where((c) {
            final q = _q.isEmpty ||
                c.name.toLowerCase().contains(_q) ||
                c.ownerName.toLowerCase().contains(_q) ||
                c.email.toLowerCase().contains(_q);
            if (!q) return false;
            return switch (_filter) {
              'active'  => c.subscriptionStatus == 'active',
              'pending' => c.subscriptionStatus == 'pending_payment',
              'expired' => c.subscriptionStatus == 'expired',
              _         => true,
            };
          }).toList();

          if (filtered.isEmpty) {
            return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.store_outlined, size: 48, color: Colors.grey[300]),
              const SizedBox(height: 12),
              Text(_q.isNotEmpty ? 'No results for "$_q"' : 'No shops in this category',
                  style: const TextStyle(color: Colors.black45)),
            ]));
          }
          return RefreshIndicator(
            onRefresh: () => ref.refresh(agentCustomersProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              itemCount: filtered.length,
              itemBuilder: (_, i) {
                final c = filtered[i];
                final statusColor = _subColor(c.subscriptionStatus);
                final expiryLabel = _expiryLabel(c);
                final expiryColor = _expiryColor(c);

                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                  color: Colors.white,
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () {}, // placeholder for detail view
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          CircleAvatar(
                            radius: 20,
                            backgroundColor: statusColor.withValues(alpha: 0.15),
                            child: Text(c.name[0].toUpperCase(),
                                style: TextStyle(color: statusColor,
                                    fontWeight: FontWeight.bold, fontSize: 15)),
                          ),
                          const SizedBox(width: 10),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(c.name,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            Text(c.ownerName,
                                style: const TextStyle(fontSize: 12, color: Colors.black54)),
                          ])),
                          _StatusDot(status: c.subscriptionStatus, color: statusColor),
                        ]),

                        const SizedBox(height: 8),
                        const Divider(height: 1),
                        const SizedBox(height: 8),

                        Row(children: [
                          if (c.planName != null) ...[
                            Icon(Icons.workspace_premium_outlined,
                                size: 13, color: Colors.grey[500]),
                            const SizedBox(width: 4),
                            Text(c.planName!,
                                style: const TextStyle(fontSize: 11, color: Colors.black54)),
                            const SizedBox(width: 12),
                          ],
                          if (c.isPendingPayment) ...[
                            Icon(Icons.hourglass_top_outlined,
                                size: 13, color: Colors.orange[600]),
                            const SizedBox(width: 4),
                            Text('Awaiting payment',
                                style: TextStyle(fontSize: 11, color: Colors.orange[700],
                                    fontWeight: FontWeight.w500)),
                          ] else if (expiryLabel.isNotEmpty) ...[
                            Icon(
                              c.subscriptionStatus == 'expired'
                                  ? Icons.cancel_outlined : Icons.schedule_outlined,
                              size: 13, color: expiryColor,
                            ),
                            const SizedBox(width: 4),
                            Text(expiryLabel,
                                style: TextStyle(fontSize: 11, color: expiryColor,
                                    fontWeight: FontWeight.w500)),
                          ],
                          const Spacer(),
                          if (c.expectedAmount != null && c.isPendingPayment)
                            Text('LKR ${_currFmt.format(c.expectedAmount!)}',
                                style: const TextStyle(fontSize: 11,
                                    fontWeight: FontWeight.w600, color: Color(0xFF1B5E20))),
                        ]),
                      ]),
                    ),
                  ),
                );
              },
            ),
          );
        },
      )),
    ]);
  }

  Color _filterColor(String id) => switch (id) {
    'active'  => AppColors.success,
    'pending' => Colors.orange,
    'expired' => AppColors.danger,
    _         => AppColors.primary,
  };
}

class _StatusDot extends StatelessWidget {
  final String status;
  final Color color;
  const _StatusDot({required this.status, required this.color});

  static const _labels = {
    'active':          'Active',
    'trial':           'Trial',
    'expired':         'Expired',
    'suspended':       'Suspended',
    'pending_payment': 'Pending',
  };

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.12),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: color.withValues(alpha: 0.3)),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 6, height: 6,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color)),
      const SizedBox(width: 5),
      Text(_labels[status] ?? status,
          style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600)),
    ]),
  );
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
                final pColor = _payColor(p.status);
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey[200]!),
                    // Left accent bar
                    boxShadow: [BoxShadow(
                      color: pColor.withValues(alpha: 0.15),
                      blurRadius: 8, offset: const Offset(0, 2),
                    )],
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: IntrinsicHeight(child: Row(children: [
                      Container(width: 4, color: pColor),
                      Expanded(child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(child: Text(p.shopName,
                                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: pColor,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(_payLabel(p.status),
                                  style: const TextStyle(fontSize: 11,
                                      color: Colors.white, fontWeight: FontWeight.w600)),
                            ),
                          ]),
                          const SizedBox(height: 6),
                          Text(fmtMoney(p.amount),
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold,
                                  color: Color(0xFF1B5E20))),
                          const SizedBox(height: 2),
                          Text('${p.paymentMethod.toUpperCase()} · ${fmtDate(p.paymentDate)}',
                              style: const TextStyle(fontSize: 12, color: Colors.black45)),
                          if (p.adminNote != null) ...[
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                              decoration: BoxDecoration(
                                color: Colors.red[50],
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(children: [
                                const Icon(Icons.info_outline, color: Colors.red, size: 14),
                                const SizedBox(width: 6),
                                Expanded(child: Text('${p.adminNote}',
                                    style: const TextStyle(fontSize: 12, color: Colors.red))),
                              ]),
                            ),
                          ],
                        ]),
                      )),
                    ])),
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
                        backgroundColor: (section['color'] as Color).withValues(alpha: 0.12),
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
                backgroundColor: const Color(0xFF2E7D32).withValues(alpha: 0.15),
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
  // 0=Dashboard, 1=Shops, 2=Payments, 3=Commissions, 4=Profile
  int _tab = 0;

  static const _navItems = [
    (icon: Icons.dashboard_outlined,   label: 'Dashboard'),
    (icon: Icons.store_outlined,       label: 'Shops'),
    (icon: Icons.payments_outlined,    label: 'Payments'),
    (icon: Icons.more_horiz,           label: 'More'),
  ];

  static const _bodies = [
    _DashboardTab(),
    _CustomersTab(),
    _PaymentsTab(),
    _CommissionsTab(),
    _ProfileTab(),
  ];

  static const _tabLabels = [
    'Dashboard', 'Shops', 'Payments', 'Commissions', 'Profile',
  ];

  // Nav bar selected index: tabs 3+ map to "More" (nav index 3)
  int get _navIndex => _tab > 2 ? 3 : _tab;

  void _onNavTap(int i) {
    if (i == 3) {
      _showMoreSheet();
    } else {
      setState(() => _tab = i);
    }
  }

  void _showMoreSheet() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 8),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFE8F5E9),
                child: Icon(Icons.account_balance_wallet_outlined,
                    color: Color(0xFF2E7D32)),
              ),
              title: const Text('Commissions',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('View earnings & commission history'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(context);
                setState(() => _tab = 3);
              },
            ),
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: Color(0xFFE3F2FD),
                child: Icon(Icons.person_outline, color: Color(0xFF1565C0)),
              ),
              title: const Text('Profile',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Bank details & account settings'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.pop(context);
                setState(() => _tab = 4);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final agent = ref.watch(agentAuthProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1B5E20),
        foregroundColor: Colors.white,
        title: Text(_tabLabels[_tab],
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
        actions: [
          if (agent != null)
            Padding(
              padding: const EdgeInsets.only(right: 14),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(agent.name,
                      style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white)),
                  if (agent.district != null)
                    Text(agent.district!,
                        style: const TextStyle(
                            fontSize: 11, color: Colors.white70)),
                ],
              ),
            ),
        ],
      ),
      body: _bodies[_tab],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _navIndex,
        onDestinationSelected: _onNavTap,
        destinations: _navItems
            .map((t) => NavigationDestination(
                  icon: Icon(t.icon),
                  label: t.label,
                ))
            .toList(),
      ),
    );
  }
}
