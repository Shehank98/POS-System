import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';
import '../../widgets/common/design_system.dart';

final _adminAgentsProvider = FutureProvider.autoDispose<List<AdminAgent>>((ref) {
  return ref.read(adminServiceProvider).getAgents();
});

final _pendingRegistrationsProvider =
    FutureProvider.autoDispose<List<AgentRegistration>>((ref) {
  return ref.read(adminServiceProvider).getPendingRegistrations();
});

class AdminAgentsScreen extends ConsumerStatefulWidget {
  const AdminAgentsScreen({super.key});

  @override
  ConsumerState<AdminAgentsScreen> createState() => _AdminAgentsScreenState();
}

class _AdminAgentsScreenState extends ConsumerState<AdminAgentsScreen>
    with SingleTickerProviderStateMixin {
  late final _tabCtrl = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _generateInvite() async {
    try {
      final url = await ref.read(adminServiceProvider).generateInviteToken();
      if (!mounted) return;
      showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('Agent Invite Link'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Share this link with the new agent:',
                style: TextStyle(fontSize: 12)),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(url, style: const TextStyle(fontSize: 12)),
            ),
          ]),
          actions: [
            TextButton(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: url));
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Copied to clipboard')));
              },
              child: const Text('Copy'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        child: Row(children: [
          Consumer(builder: (_, ref, __) {
            final pending = ref
                    .watch(_pendingRegistrationsProvider)
                    .valueOrNull
                    ?.where((r) => r.status == 'pending')
                    .length ?? 0;
            return TabBar(
              controller: _tabCtrl,
              tabs: [
                const Tab(text: 'Active Agents'),
                Tab(text: pending > 0 ? 'Pending ($pending)' : 'Pending'),
              ],
              isScrollable: true,
              tabAlignment: TabAlignment.start,
            );
          }),
          const Spacer(),
          FilledButton.icon(
            onPressed: _generateInvite,
            icon: const Icon(Icons.link, size: 18),
            label: const Text('Invite'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              backgroundColor: const Color(0xFF1A237E),
            ),
          ),
        ]),
      ),
      Expanded(child: TabBarView(
        controller: _tabCtrl,
        children: [
          _ActiveAgentsTab(),
          _PendingRegistrationsTab(),
        ],
      )),
    ]);
  }
}

// ── Active agents tab (original content) ─────────────────────────────────
class _ActiveAgentsTab extends ConsumerWidget {
  const _ActiveAgentsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_adminAgentsProvider);

    return async.when(
      loading: () => const ShimmerList(itemCount: 6),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (agents) {
        if (agents.isEmpty) {
          return DSEmptyState(
            icon: Icons.badge_outlined,
            heading: 'No agents yet',
            subtext: 'Add your first sales agent to get started',
            action: FilledButton.icon(
              onPressed: () => _showAgentModal(context, ref, null),
              icon: const Icon(Icons.add),
              label: const Text('Add Agent'),
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: () => ref.refresh(_adminAgentsProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: agents.length + 1,
            itemBuilder: (ctx, i) {
              if (i == 0) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        FilledButton.icon(
                          onPressed: () =>
                              _showAgentModal(ctx, ref, null),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add Agent'),
                        ),
                      ]),
                );
              }
              final agent = agents[i - 1];
              return _AgentTile(agent: agent, index: i - 1)
                  .animate()
                  .fadeIn(
                      delay: Duration(
                          milliseconds: ((i - 1) * 40).clamp(0, 400)),
                      duration: 350.ms)
                  .slideX(begin: 0.05, end: 0);
            },
          ),
        );
      },
    );
  }

  void _showAgentModal(
      BuildContext context, WidgetRef ref, AdminAgent? agent) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AgentModal(agent: agent, ref: ref),
    );
  }
}

// ── Pending registrations tab ─────────────────────────────────────────────
class _PendingRegistrationsTab extends ConsumerWidget {
  const _PendingRegistrationsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_pendingRegistrationsProvider);

    return async.when(
      loading: () => const ShimmerList(itemCount: 4),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (regs) {
        final pending = regs.where((r) => r.status == 'pending').toList();
        if (pending.isEmpty) {
          return const DSEmptyState(
            icon: Icons.how_to_reg_outlined,
            heading: 'No pending registrations',
            subtext: 'New agent sign-ups will appear here for review',
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(_pendingRegistrationsProvider.future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: pending.length,
            itemBuilder: (_, i) {
              final r = pending[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
                elevation: 0,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                    Row(children: [
                      CircleAvatar(
                        backgroundColor: Colors.orange.withValues(alpha: 0.15),
                        child: Text(r.name[0].toUpperCase(),
                            style: const TextStyle(
                                color: Colors.orange, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(r.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                        Text(r.email,
                            style: TextStyle(
                                fontSize: 12, color: Colors.grey[600])),
                      ])),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: Colors.orange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('Pending',
                            style: TextStyle(
                                fontSize: 10,
                                color: Colors.orange,
                                fontWeight: FontWeight.w600)),
                      ),
                    ]),
                    if (r.phone != null || r.district != null) ...[
                      const SizedBox(height: 8),
                      Wrap(spacing: 12, children: [
                        if (r.phone != null)
                          Text('Phone: ${r.phone}',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey[600])),
                        if (r.district != null)
                          Text('District: ${r.district}',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.grey[600])),
                      ]),
                    ],
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(child: OutlinedButton(
                        onPressed: () => _reject(context, ref, r.id),
                        style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red,
                            side: const BorderSide(color: Colors.red)),
                        child: const Text('Reject'),
                      )),
                      const SizedBox(width: 10),
                      Expanded(child: FilledButton(
                        onPressed: () => _approve(context, ref, r.id),
                        style: FilledButton.styleFrom(
                            backgroundColor: Colors.green),
                        child: const Text('Approve'),
                      )),
                    ]),
                  ]),
                ),
              ).animate().fadeIn(
                  delay: Duration(milliseconds: (i * 40).clamp(0, 300)),
                  duration: 300.ms);
            },
          ),
        );
      },
    );
  }

  Future<void> _approve(BuildContext context, WidgetRef ref, int id) async {
    try {
      await ref.read(adminServiceProvider).approveAgent(id);
      ref.invalidate(_pendingRegistrationsProvider);
      ref.invalidate(_adminAgentsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Agent approved - they can now log in'),
              backgroundColor: Colors.green));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _reject(BuildContext context, WidgetRef ref, int id) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Registration'),
        content: TextField(
          controller: reasonCtrl,
          decoration: const InputDecoration(labelText: 'Reason'),
          maxLines: 2,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref.read(adminServiceProvider)
          .rejectAgent(id, reasonCtrl.text.trim());
      ref.invalidate(_pendingRegistrationsProvider);
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Registration rejected')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _AgentTile extends ConsumerWidget {
  final AdminAgent agent;
  final int index;
  const _AgentTile({required this.agent, required this.index});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;
    final fmt = NumberFormat('#,##0.00');

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: cs.primaryContainer,
          child: Text(agent.name[0].toUpperCase(),
              style: TextStyle(
                  color: cs.onPrimaryContainer,
                  fontWeight: FontWeight.bold)),
        ),
        title: Text(agent.name,
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(agent.email,
                style:
                    TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
            if (agent.district != null)
              Text(agent.district!,
                  style:
                      TextStyle(color: cs.onSurfaceVariant, fontSize: 12)),
            const SizedBox(height: 4),
            Row(children: [
              Icon(Icons.store_outlined,
                  size: 13, color: cs.onSurfaceVariant),
              const SizedBox(width: 4),
              Text('${agent.totalCustomers} shops',
                  style: TextStyle(
                      fontSize: 12, color: cs.onSurfaceVariant)),
              const SizedBox(width: 12),
              Icon(Icons.payments_outlined,
                  size: 13, color: Colors.green),
              const SizedBox(width: 4),
              Text('Rs ${fmt.format(agent.totalEarnings)}',
                  style: const TextStyle(
                      fontSize: 12, color: Colors.green)),
            ]),
          ],
        ),
        trailing: IconButton(
          icon: const Icon(Icons.edit_outlined),
          onPressed: () => _showEdit(context, ref, agent),
        ),
      ),
    );
  }

  void _showEdit(BuildContext context, WidgetRef ref, AdminAgent agent) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _AgentModal(agent: agent, ref: ref),
    );
  }
}

class _AgentModal extends StatefulWidget {
  final AdminAgent? agent;
  final WidgetRef ref;
  const _AgentModal({required this.agent, required this.ref});

  @override
  State<_AgentModal> createState() => _AgentModalState();
}

class _AgentModalState extends State<_AgentModal> {
  final _formKey = GlobalKey<FormState>();
  late final _nameCtrl = TextEditingController(text: widget.agent?.name ?? '');
  late final _emailCtrl =
      TextEditingController(text: widget.agent?.email ?? '');
  late final _phoneCtrl =
      TextEditingController(text: widget.agent?.phone ?? '');
  late final _districtCtrl =
      TextEditingController(text: widget.agent?.district ?? '');
  late final _targetCtrl = TextEditingController(
      text: widget.agent?.monthlyTarget.toString() ?? '10');
  final _passwordCtrl = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    _districtCtrl.dispose();
    _targetCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final data = {
        'name': _nameCtrl.text.trim(),
        'email': _emailCtrl.text.trim().toLowerCase(),
        'phone': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
        'district': _districtCtrl.text.trim().isEmpty
            ? null
            : _districtCtrl.text.trim(),
        'monthly_target': int.tryParse(_targetCtrl.text) ?? 10,
        if (_passwordCtrl.text.isNotEmpty) 'password': _passwordCtrl.text,
      };
      final svc = widget.ref.read(adminServiceProvider);
      if (widget.agent == null) {
        await svc.createAgent(data);
      } else {
        await svc.updateAgent(widget.agent!.id, data);
      }
      widget.ref.invalidate(_adminAgentsProvider);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.agent != null;
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 16, right: 16, top: 16),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(isEdit ? 'Edit Agent' : 'Add Agent',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Name'),
              validator: (v) =>
                  v == null || v.isEmpty ? 'Required' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _emailCtrl,
              decoration: const InputDecoration(labelText: 'Email'),
              keyboardType: TextInputType.emailAddress,
              validator: (v) =>
                  v == null || v.isEmpty ? 'Required' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _passwordCtrl,
              decoration: InputDecoration(
                labelText: isEdit
                    ? 'New Password (leave blank to keep)'
                    : 'Password',
              ),
              obscureText: true,
              validator: (v) =>
                  !isEdit && (v == null || v.isEmpty) ? 'Required' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextFormField(
                  controller: _phoneCtrl,
                  decoration: const InputDecoration(labelText: 'Phone'),
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _districtCtrl,
                  decoration: const InputDecoration(labelText: 'District'),
                  textInputAction: TextInputAction.next,
                ),
              ),
            ]),
            const SizedBox(height: 12),
            TextFormField(
              controller: _targetCtrl,
              decoration:
                  const InputDecoration(labelText: 'Monthly Target (shops)'),
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.done,
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(isEdit ? 'Save Changes' : 'Create Agent'),
            ),
            const SizedBox(height: 16),
          ]),
        ),
      ),
    );
  }
}
