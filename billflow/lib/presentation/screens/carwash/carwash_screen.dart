import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/carwash_model.dart';
import '../../../providers/carwash_provider.dart';
import '../../../data/services/carwash_service.dart';

class CarwashScreen extends ConsumerStatefulWidget {
  const CarwashScreen({super.key});

  @override
  ConsumerState<CarwashScreen> createState() => _CarwashScreenState();
}

class _CarwashScreenState extends ConsumerState<CarwashScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Car Service'),
        centerTitle: false,
        titleTextStyle: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'Jobs'),
            Tab(text: 'Dashboard'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabCtrl,
        children: const [
          _JobsTab(),
          _DashboardTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateJobSheet(context),
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Job'),
      ),
    );
  }

  void _showCreateJobSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ProviderScope(
        child: _CreateJobSheet(
          onCreated: () {
            ref.invalidate(carwashJobsProvider);
            ref.invalidate(carwashDashboardProvider);
          },
        ),
      ),
    );
  }
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────
class _DashboardTab extends ConsumerWidget {
  const _DashboardTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashAsync = ref.watch(carwashDashboardProvider);
    final cs = Theme.of(context).colorScheme;

    return dashAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_outlined, size: 40, color: Colors.grey),
            const SizedBox(height: 8),
            Text(e.toString(),
                style: const TextStyle(color: Colors.grey),
                textAlign: TextAlign.center),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.invalidate(carwashDashboardProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (dash) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(carwashDashboardProvider),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Today stats
            Text('Today',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: cs.onSurfaceVariant)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                    child: _StatCard(
                  label: 'Jobs',
                  value: '${dash.todayJobs}',
                  icon: Icons.directions_car,
                  color: cs.primary,
                )),
                const SizedBox(width: 12),
                Expanded(
                    child: _StatCard(
                  label: 'Revenue',
                  value: formatCurrency(dash.todayRevenue),
                  icon: Icons.payments_outlined,
                  color: AppColors.success,
                )),
              ],
            ),
            const SizedBox(height: 20),

            // Job pipeline
            Text('Pipeline',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                    color: cs.onSurfaceVariant)),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                    child: _StatCard(
                  label: 'Pending',
                  value: '${dash.pendingJobs}',
                  icon: Icons.hourglass_empty_rounded,
                  color: Colors.orange,
                )),
                const SizedBox(width: 8),
                Expanded(
                    child: _StatCard(
                  label: 'In Progress',
                  value: '${dash.inProgressJobs}',
                  icon: Icons.local_car_wash,
                  color: Colors.blue,
                )),
                const SizedBox(width: 8),
                Expanded(
                    child: _StatCard(
                  label: 'Done',
                  value: '${dash.completedJobs}',
                  icon: Icons.check_circle_outline,
                  color: Colors.green,
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 8),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                  color: cs.onSurface)),
          Text(label,
              style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
        ],
      ),
    );
  }
}

// ── Jobs tab ──────────────────────────────────────────────────────────────────
class _JobsTab extends ConsumerWidget {
  const _JobsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(carwashJobStatusFilterProvider);
    final jobsAsync = ref.watch(carwashJobsProvider);
    final cs = Theme.of(context).colorScheme;

    return Column(
      children: [
        // Status filter chips
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: [
              _FilterChip(
                label: 'All',
                selected: filter == null,
                onTap: () => ref
                    .read(carwashJobStatusFilterProvider.notifier)
                    .state = null,
              ),
              const SizedBox(width: 6),
              for (final s in ['pending', 'in_progress', 'completed', 'paid'])
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: _FilterChip(
                    label: _statusLabel(s),
                    selected: filter == s,
                    color: _statusColor(s),
                    onTap: () => ref
                        .read(carwashJobStatusFilterProvider.notifier)
                        .state = s,
                  ),
                ),
            ],
          ),
        ),

        Expanded(
          child: jobsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.wifi_off_outlined,
                      size: 40, color: Colors.grey),
                  const SizedBox(height: 8),
                  Text(e.toString(),
                      style: const TextStyle(color: Colors.grey)),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => ref.invalidate(carwashJobsProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
            data: (result) => result.jobs.isEmpty
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.directions_car_outlined,
                            size: 48, color: cs.onSurfaceVariant),
                        const SizedBox(height: 8),
                        Text('No jobs found',
                            style: TextStyle(color: cs.onSurfaceVariant)),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: () async => ref.invalidate(carwashJobsProvider),
                    child: ListView.separated(
                      padding: const EdgeInsets.all(12),
                      itemCount: result.jobs.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (ctx, i) =>
                          _JobCard(job: result.jobs[i], ref: ref),
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  String _statusLabel(String s) => switch (s) {
        'in_progress' => 'In Progress',
        'completed' => 'Completed',
        'paid' => 'Paid',
        _ => 'Pending',
      };

  Color _statusColor(String s) => switch (s) {
        'in_progress' => Colors.blue,
        'completed' => Colors.green,
        'paid' => Colors.purple,
        _ => Colors.orange,
      };
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.selected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final chipColor = color ?? cs.primary;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? chipColor : cs.surfaceContainerLow,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: selected ? chipColor : cs.outlineVariant, width: 1),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : cs.onSurface,
          ),
        ),
      ),
    );
  }
}

// ── Job card ──────────────────────────────────────────────────────────────────
class _JobCard extends ConsumerWidget {
  final CarwashJob job;
  final WidgetRef ref;

  const _JobCard({required this.job, required this.ref});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cs = Theme.of(context).colorScheme;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: cs.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Status badge
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusColor(job.status).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    _statusLabel(job.status),
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _statusColor(job.status)),
                  ),
                ),
                const Spacer(),
                Text(
                  job.jobNumber,
                  style:
                      TextStyle(fontSize: 12, color: cs.onSurfaceVariant),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Vehicle & customer
            Row(
              children: [
                const Icon(Icons.directions_car, size: 18),
                const SizedBox(width: 6),
                Text(
                  job.vehicleNumber ?? '—',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
                if (job.vehicleType != null) ...[
                  const SizedBox(width: 6),
                  Text(
                    '(${job.vehicleType})',
                    style:
                        TextStyle(fontSize: 13, color: cs.onSurfaceVariant),
                  ),
                ],
              ],
            ),
            if (job.customerName != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(Icons.person_outline,
                      size: 14, color: cs.onSurfaceVariant),
                  const SizedBox(width: 4),
                  Text(job.customerName!,
                      style: TextStyle(
                          fontSize: 12, color: cs.onSurfaceVariant)),
                ],
              ),
            ],

            const SizedBox(height: 10),

            Row(
              children: [
                // Amount
                Text(
                  formatCurrency(job.totalAmount),
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: cs.primary),
                ),
                const Spacer(),
                // Actions based on current status
                if (job.isPending)
                  _ActionButton(
                    label: 'Start',
                    color: Colors.blue,
                    onTap: () => _changeStatus(context, ref, 'in_progress'),
                  ),
                if (job.isInProgress)
                  _ActionButton(
                    label: 'Complete',
                    color: Colors.green,
                    onTap: () => _changeStatus(context, ref, 'completed'),
                  ),
                if (job.isCompleted)
                  _ActionButton(
                    label: 'Mark Paid',
                    color: Colors.purple,
                    onTap: () => _showPaySheet(context, ref),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _changeStatus(
      BuildContext context, WidgetRef ref, String newStatus) async {
    try {
      await ref
          .read(carwashApiServiceProvider)
          .updateJobStatus(job.id, newStatus);
      ref.invalidate(carwashJobsProvider);
      ref.invalidate(carwashDashboardProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  Future<void> _showPaySheet(BuildContext context, WidgetRef ref) async {
    final method = await showDialog<String>(
      context: context,
      builder: (_) => SimpleDialog(
        title: const Text('Payment Method'),
        children: [
          for (final m in ['cash', 'card', 'mobile'])
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, m),
              child: Text(m[0].toUpperCase() + m.substring(1)),
            ),
        ],
      ),
    );
    if (method == null || !context.mounted) return;
    try {
      await ref.read(carwashApiServiceProvider).payJob(job.id, method);
      ref.invalidate(carwashJobsProvider);
      ref.invalidate(carwashDashboardProvider);
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    }
  }

  String _statusLabel(String s) => switch (s) {
        'in_progress' => 'In Progress',
        'completed' => 'Completed',
        'paid' => 'Paid',
        'cancelled' => 'Cancelled',
        _ => 'Pending',
      };

  Color _statusColor(String s) => switch (s) {
        'in_progress' => Colors.blue,
        'completed' => Colors.green,
        'paid' => Colors.purple,
        'cancelled' => Colors.grey,
        _ => Colors.orange,
      };
}

class _ActionButton extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionButton({
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Text(
          label,
          style: TextStyle(
              fontSize: 12, fontWeight: FontWeight.w600, color: color),
        ),
      ),
    );
  }
}

// ── Create Job bottom sheet ───────────────────────────────────────────────────
class _CreateJobSheet extends ConsumerStatefulWidget {
  final VoidCallback onCreated;
  const _CreateJobSheet({required this.onCreated});

  @override
  ConsumerState<_CreateJobSheet> createState() => _CreateJobSheetState();
}

class _CreateJobSheetState extends ConsumerState<_CreateJobSheet> {
  final _vehicleCtrl = TextEditingController();
  final _customerNameCtrl = TextEditingController();
  final _customerPhoneCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String? _vehicleType;
  final List<Map<String, dynamic>> _selectedServices = [];
  bool _isSubmitting = false;

  static const _vehicleTypes = ['Car', 'SUV', 'Pickup', 'Van', 'Motorcycle'];

  @override
  void dispose() {
    _vehicleCtrl.dispose();
    _customerNameCtrl.dispose();
    _customerPhoneCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  double get _total => _selectedServices.fold(
      0.0, (s, item) => s + (item['price'] as double));

  @override
  Widget build(BuildContext context) {
    final servicesAsync = ref.watch(carwashServicesProvider);
    final cs = Theme.of(context).colorScheme;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollCtrl) => Container(
        decoration: BoxDecoration(
          color: cs.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // Drag handle
            Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: cs.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),

            // Header
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.local_car_wash),
                  const SizedBox(width: 8),
                  const Text('New Job',
                      style: TextStyle(
                          fontWeight: FontWeight.bold, fontSize: 17)),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            Expanded(
              child: ListView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(16),
                children: [
                  // Vehicle number (required)
                  TextField(
                    controller: _vehicleCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Vehicle Number *',
                      prefixIcon: Icon(Icons.directions_car_outlined),
                      border: OutlineInputBorder(),
                    ),
                    textCapitalization: TextCapitalization.characters,
                  ),
                  const SizedBox(height: 12),

                  // Vehicle type
                  DropdownButtonFormField<String>(
                    value: _vehicleType,
                    decoration: const InputDecoration(
                      labelText: 'Vehicle Type',
                      prefixIcon: Icon(Icons.category_outlined),
                      border: OutlineInputBorder(),
                    ),
                    items: _vehicleTypes
                        .map((t) =>
                            DropdownMenuItem(value: t, child: Text(t)))
                        .toList(),
                    onChanged: (v) => setState(() => _vehicleType = v),
                  ),
                  const SizedBox(height: 12),

                  // Customer name
                  TextField(
                    controller: _customerNameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Customer Name',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Customer phone
                  TextField(
                    controller: _customerPhoneCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Customer Phone',
                      prefixIcon: Icon(Icons.phone_outlined),
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 20),

                  // Services selection
                  Text('Services',
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: cs.onSurfaceVariant)),
                  const SizedBox(height: 8),
                  servicesAsync.when(
                    loading: () =>
                        const Center(child: CircularProgressIndicator()),
                    error: (e, _) => Text(e.toString(),
                        style: const TextStyle(color: Colors.red)),
                    data: (services) => Column(
                      children: services.map((svc) {
                        final added = _selectedServices
                            .any((s) => s['id'] == svc.id);
                        return CheckboxListTile(
                          value: added,
                          onChanged: (v) {
                            setState(() {
                              if (v == true) {
                                _selectedServices.add({
                                  'service_id': svc.id,
                                  'id': svc.id,
                                  'name': svc.name,
                                  'price': svc.price,
                                });
                              } else {
                                _selectedServices.removeWhere(
                                    (s) => s['id'] == svc.id);
                              }
                            });
                          },
                          title: Text(svc.name),
                          subtitle: svc.durationMinutes != null
                              ? Text('${svc.durationMinutes} min')
                              : null,
                          secondary: Text(
                            formatCurrency(svc.price),
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: cs.primary),
                          ),
                          controlAffinity: ListTileControlAffinity.leading,
                          contentPadding: EdgeInsets.zero,
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Notes
                  TextField(
                    controller: _notesCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Notes (optional)',
                      prefixIcon: Icon(Icons.notes_outlined),
                      border: OutlineInputBorder(),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 80),
                ],
              ),
            ),

            // Submit button
            Padding(
              padding: EdgeInsets.fromLTRB(
                  16,
                  8,
                  16,
                  MediaQuery.of(context).viewInsets.bottom + 16),
              child: FilledButton.icon(
                onPressed: (_isSubmitting ||
                        _vehicleCtrl.text.trim().isEmpty ||
                        _selectedServices.isEmpty)
                    ? null
                    : _submit,
                icon: _isSubmitting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.check),
                label: Text(
                  _selectedServices.isEmpty
                      ? 'Select at least one service'
                      : 'Create Job — ${formatCurrency(_total)}',
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold),
                ),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _isSubmitting = true);
    try {
      await ref.read(carwashApiServiceProvider).createJob(
            vehicleNumber: _vehicleCtrl.text.trim(),
            vehicleType: _vehicleType,
            customerName: _customerNameCtrl.text.trim().isEmpty
                ? null
                : _customerNameCtrl.text.trim(),
            customerPhone: _customerPhoneCtrl.text.trim().isEmpty
                ? null
                : _customerPhoneCtrl.text.trim(),
            notes: _notesCtrl.text.trim().isEmpty
                ? null
                : _notesCtrl.text.trim(),
            items: _selectedServices
                .map((s) => {
                      'item_type': 'service',
                      'service_id': s['service_id'],
                      'quantity': 1,
                    })
                .toList(),
          );
      widget.onCreated();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}
