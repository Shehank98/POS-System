import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';

final _adminAgentsProvider = FutureProvider.autoDispose<List<AdminAgent>>((ref) {
  return ref.read(adminServiceProvider).getAgents();
});

class AdminAgentsScreen extends ConsumerWidget {
  const AdminAgentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_adminAgentsProvider);

    return async.when(
      loading: () => const ShimmerList(itemCount: 6),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (agents) {
        if (agents.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.badge_outlined,
                  size: 64,
                  color:
                      Theme.of(context).colorScheme.onSurfaceVariant),
              const SizedBox(height: 12),
              const Text('No agents yet'),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: () => _showAgentModal(context, ref, null),
                icon: const Icon(Icons.add),
                label: const Text('Add Agent'),
              ),
            ]),
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
