import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../data/services/admin_service.dart';

double _d(dynamic v) => v == null ? 0.0 : double.tryParse(v.toString()) ?? 0.0;
int _i(dynamic v)    => v == null ? 0   : int.tryParse(v.toString())    ?? 0;

final _adminPlansProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) =>
        ref.read(adminServiceProvider).getPlans());

class AdminPlansScreen extends ConsumerWidget {
  const AdminPlansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_adminPlansProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error:   (e, _) => Center(child: Text('Error: $e')),
      data: (plans) => RefreshIndicator(
        onRefresh: () => ref.refresh(_adminPlansProvider.future),
        child: ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: plans.length + 1,
          itemBuilder: (ctx, i) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                  FilledButton.icon(
                    onPressed: () => _showModal(context, ref, null),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add Plan'),
                  ),
                ]),
              );
            }
            final plan = plans[i - 1];
            final id     = _i(plan['id']);
            final name   = plan['name']?.toString() ?? '';
            final price  = _d(plan['base_monthly_price']);
            final d3     = (_d(plan['discount_3m'])  * 100).round();
            final d6     = (_d(plan['discount_6m'])  * 100).round();
            final d12    = (_d(plan['discount_12m']) * 100).round();
            final active = plan['is_active'] == true || plan['is_active'] == 1;
            final cs     = Theme.of(context).colorScheme;

            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    CircleAvatar(
                      backgroundColor: cs.primaryContainer,
                      radius: 18,
                      child: Icon(Icons.workspace_premium_outlined,
                          color: cs.onPrimaryContainer, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(child: Text(name,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
                    if (!active)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text('Inactive',
                            style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
                      ),
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 20),
                      onPressed: () => _showModal(context, ref, plan),
                      visualDensity: VisualDensity.compact,
                    ),
                    IconButton(
                      icon: Icon(Icons.delete_outline, size: 20, color: cs.error),
                      onPressed: () => _confirmDelete(context, ref, id, name),
                      visualDensity: VisualDensity.compact,
                    ),
                  ]),
                  const SizedBox(height: 8),
                  Text(
                    'LKR ${price.toStringAsFixed(0)} / month',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: cs.primary),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Discounts:  3 mo −$d3%   6 mo −$d6%   12 mo −$d12%',
                    style: TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                  ),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }

  void _showModal(BuildContext context, WidgetRef ref, Map<String, dynamic>? plan) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _PlanModal(plan: plan, ref: ref),
    );
  }

  void _confirmDelete(BuildContext context, WidgetRef ref, int id, String name) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Plan'),
        content: Text('Delete "$name"? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref.read(adminServiceProvider).deletePlan(id);
                ref.invalidate(_adminPlansProvider);
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Plan deleted')));
                }
              } catch (e) {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text('Error: $e'), backgroundColor: Colors.red));
                }
              }
            },
            child: const Text('Delete'),
          ),
        ],
      ),
    );
  }
}

class _PlanModal extends StatefulWidget {
  final Map<String, dynamic>? plan;
  final WidgetRef ref;
  const _PlanModal({required this.plan, required this.ref});

  @override
  State<_PlanModal> createState() => _PlanModalState();
}

class _PlanModalState extends State<_PlanModal> {
  final _formKey = GlobalKey<FormState>();
  late final _nameCtrl  = TextEditingController(
      text: widget.plan?['name']?.toString() ?? '');
  late final _priceCtrl = TextEditingController(
      text: widget.plan != null
          ? _d(widget.plan!['base_monthly_price']).toStringAsFixed(0) : '');
  late final _d3Ctrl  = TextEditingController(
      text: widget.plan != null
          ? (_d(widget.plan!['discount_3m']) * 100).round().toString() : '10');
  late final _d6Ctrl  = TextEditingController(
      text: widget.plan != null
          ? (_d(widget.plan!['discount_6m']) * 100).round().toString() : '15');
  late final _d12Ctrl = TextEditingController(
      text: widget.plan != null
          ? (_d(widget.plan!['discount_12m']) * 100).round().toString() : '20');
  late bool _active = widget.plan == null
      ? true
      : (widget.plan!['is_active'] == true || widget.plan!['is_active'] == 1);
  bool _loading = false;

  @override
  void dispose() {
    _nameCtrl.dispose(); _priceCtrl.dispose();
    _d3Ctrl.dispose(); _d6Ctrl.dispose(); _d12Ctrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      final data = {
        'name':               _nameCtrl.text.trim(),
        'base_monthly_price': double.tryParse(_priceCtrl.text) ?? 0,
        'discount_3m':        (double.tryParse(_d3Ctrl.text)  ?? 10) / 100,
        'discount_6m':        (double.tryParse(_d6Ctrl.text)  ?? 15) / 100,
        'discount_12m':       (double.tryParse(_d12Ctrl.text) ?? 20) / 100,
        'is_active':          _active,
      };
      final svc = widget.ref.read(adminServiceProvider);
      if (widget.plan == null) {
        await svc.createPlan(data);
      } else {
        await svc.updatePlan(_i(widget.plan!['id']), data);
      }
      widget.ref.invalidate(_adminPlansProvider);
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
    final isEdit = widget.plan != null;
    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
          left: 20, right: 20, top: 20),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text(isEdit ? 'Edit Plan' : 'Add Plan',
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            TextFormField(
              controller: _nameCtrl,
              decoration: const InputDecoration(labelText: 'Plan Name'),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _priceCtrl,
              decoration: const InputDecoration(
                labelText: 'Monthly Price (LKR)',
                prefixText: 'LKR ',
              ),
              keyboardType: TextInputType.number,
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: 16),
            Text('Multi-Month Discounts',
                style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: TextFormField(
                controller: _d3Ctrl,
                decoration: const InputDecoration(
                    labelText: '3 Months %', isDense: true,
                    suffixText: '%'),
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
              )),
              const SizedBox(width: 8),
              Expanded(child: TextFormField(
                controller: _d6Ctrl,
                decoration: const InputDecoration(
                    labelText: '6 Months %', isDense: true,
                    suffixText: '%'),
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.next,
              )),
              const SizedBox(width: 8),
              Expanded(child: TextFormField(
                controller: _d12Ctrl,
                decoration: const InputDecoration(
                    labelText: '12 Months %', isDense: true,
                    suffixText: '%'),
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
              )),
            ]),
            const SizedBox(height: 12),
            SwitchListTile(
              title: const Text('Active'),
              subtitle: const Text('Agents can select this plan when onboarding'),
              value: _active,
              onChanged: (v) => setState(() => _active = v),
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 20, width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(isEdit ? 'Save Changes' : 'Create Plan'),
            ),
            const SizedBox(height: 20),
          ]),
        ),
      ),
    );
  }
}
