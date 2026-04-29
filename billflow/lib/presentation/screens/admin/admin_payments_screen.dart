import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../data/models/admin_model.dart';
import '../../../data/services/admin_service.dart';
import '../../widgets/common/shimmer_list.dart';

final _pendingPaymentsProvider =
    FutureProvider.autoDispose<List<AdminPaymentSubmission>>((ref) {
  return ref.read(adminServiceProvider).getPendingPayments();
});

final _allPaymentsProvider =
    FutureProvider.autoDispose<List<AdminPaymentSubmission>>((ref) {
  return ref.read(adminServiceProvider).getAllPayments();
});

class AdminPaymentsScreen extends ConsumerStatefulWidget {
  const AdminPaymentsScreen({super.key});

  @override
  ConsumerState<AdminPaymentsScreen> createState() =>
      _AdminPaymentsScreenState();
}

class _AdminPaymentsScreenState extends ConsumerState<AdminPaymentsScreen>
    with SingleTickerProviderStateMixin {
  late final _tabCtrl = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      TabBar(
        controller: _tabCtrl,
        tabs: [
          Consumer(builder: (_, ref, __) {
            final count = ref
                    .watch(_pendingPaymentsProvider)
                    .valueOrNull
                    ?.length ??
                0;
            return Tab(
                text: count > 0 ? 'Pending ($count)' : 'Pending');
          }),
          const Tab(text: 'All Payments'),
        ],
      ),
      Expanded(
        child: TabBarView(
          controller: _tabCtrl,
          children: [
            _PaymentList(
              provider: _pendingPaymentsProvider,
              showActions: true,
              emptyMessage: 'No pending payments',
            ),
            _PaymentList(
              provider: _allPaymentsProvider,
              showActions: false,
              emptyMessage: 'No payments yet',
            ),
          ],
        ),
      ),
    ]);
  }
}

class _PaymentList extends ConsumerWidget {
  final AutoDisposeFutureProvider<List<AdminPaymentSubmission>> provider;
  final bool showActions;
  final String emptyMessage;

  const _PaymentList({
    required this.provider,
    required this.showActions,
    required this.emptyMessage,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(provider);

    return async.when(
      loading: () => const ShimmerList(itemCount: 6),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (payments) {
        if (payments.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.receipt_long_outlined,
                  size: 64,
                  color: Theme.of(context).colorScheme.onSurfaceVariant),
              const SizedBox(height: 12),
              Text(emptyMessage),
            ]),
          );
        }
        return RefreshIndicator(
          onRefresh: () => ref.refresh(provider.future),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: payments.length,
            itemBuilder: (ctx, i) => _PaymentTile(
              payment: payments[i],
              showActions: showActions,
              onAction: (action, note) async {
                try {
                  if (action == 'verify') {
                    await ref
                        .read(adminServiceProvider)
                        .verifyPayment(payments[i].id);
                  } else {
                    await ref
                        .read(adminServiceProvider)
                        .rejectPayment(payments[i].id, note ?? '');
                  }
                  ref.invalidate(_pendingPaymentsProvider);
                  ref.invalidate(_allPaymentsProvider);
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                      content: Text(action == 'verify'
                          ? 'Payment verified — shop activated'
                          : 'Payment rejected'),
                      backgroundColor:
                          action == 'verify' ? Colors.green : Colors.red,
                    ));
                  }
                } catch (e) {
                  if (ctx.mounted) {
                    ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                        content: Text('Error: $e'),
                        backgroundColor: Colors.red));
                  }
                }
              },
            )
                .animate()
                .fadeIn(
                    delay: Duration(milliseconds: (i * 40).clamp(0, 400)),
                    duration: 350.ms)
                .slideY(begin: 0.05, end: 0),
          ),
        );
      },
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final AdminPaymentSubmission payment;
  final bool showActions;
  final void Function(String action, String? note) onAction;

  const _PaymentTile({
    required this.payment,
    required this.showActions,
    required this.onAction,
  });

  Color _statusColor(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return switch (payment.status) {
      'verified' => Colors.green,
      'rejected' => cs.error,
      _ => Colors.orange,
    };
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final color = _statusColor(context);
    final fmt = NumberFormat('#,##0.00');

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(payment.shopName,
                  style: const TextStyle(fontWeight: FontWeight.w600)),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20)),
              child: Text(
                payment.status == 'pending_verification'
                    ? 'Pending'
                    : payment.status[0].toUpperCase() +
                        payment.status.substring(1),
                style: TextStyle(
                    fontSize: 11,
                    color: color,
                    fontWeight: FontWeight.w600),
              ),
            ),
          ]),
          const SizedBox(height: 6),
          Text('Agent: ${payment.agentName}',
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13)),
          const SizedBox(height: 4),
          Row(children: [
            Icon(Icons.payments_outlined, size: 16, color: cs.primary),
            const SizedBox(width: 4),
            Text('Rs ${fmt.format(payment.amount)}',
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: cs.primary)),
            const SizedBox(width: 12),
            Icon(Icons.calendar_today_outlined,
                size: 14, color: cs.onSurfaceVariant),
            const SizedBox(width: 4),
            Text(
                DateFormat('dd MMM yyyy').format(payment.paymentDate),
                style: TextStyle(
                    fontSize: 13, color: cs.onSurfaceVariant)),
          ]),
          if (payment.notes != null) ...[
            const SizedBox(height: 4),
            Text(payment.notes!,
                style: TextStyle(
                    fontSize: 12, color: cs.onSurfaceVariant,
                    fontStyle: FontStyle.italic)),
          ],
          if (showActions) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _confirmReject(context),
                  icon: const Icon(Icons.close, size: 16),
                  label: const Text('Reject'),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: cs.error,
                      side: BorderSide(color: cs.error)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _confirmVerify(context),
                  icon: const Icon(Icons.check, size: 16),
                  label: const Text('Verify'),
                  style: FilledButton.styleFrom(
                      backgroundColor: Colors.green),
                ),
              ),
            ]),
          ],
        ]),
      ),
    );
  }

  void _confirmVerify(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Verify Payment'),
        content: Text(
            'Verify Rs ${payment.amount.toStringAsFixed(2)} from ${payment.shopName}?\n\nThis will activate the shop subscription and unlock agent commissions.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () {
              Navigator.pop(ctx);
              onAction('verify', null);
            },
            child: const Text('Verify'),
          ),
        ],
      ),
    );
  }

  void _confirmReject(BuildContext context) {
    final noteCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Payment'),
        content: TextField(
          controller: noteCtrl,
          decoration: const InputDecoration(
              labelText: 'Reason (optional)', hintText: 'Explain why…'),
          maxLines: 3,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: Theme.of(ctx).colorScheme.error),
            onPressed: () {
              Navigator.pop(ctx);
              onAction('reject', noteCtrl.text.trim());
            },
            child: const Text('Reject'),
          ),
        ],
      ),
    );
  }
}
