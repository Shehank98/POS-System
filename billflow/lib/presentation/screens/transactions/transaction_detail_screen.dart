import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../core/utils/whatsapp_helper.dart';
import '../../../data/models/transaction_model.dart';
import '../../../data/models/user_model.dart';
import '../../../data/services/transaction_service.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/transaction_provider.dart';
import '../../widgets/common/loading_overlay.dart';

class TransactionDetailScreen extends ConsumerStatefulWidget {
  final int transactionId;
  final TransactionModel? transaction;

  const TransactionDetailScreen(
      {super.key, required this.transactionId, this.transaction});

  @override
  ConsumerState<TransactionDetailScreen> createState() =>
      _TransactionDetailScreenState();
}

class _TransactionDetailScreenState
    extends ConsumerState<TransactionDetailScreen> {
  TransactionModel? _txn;
  bool _loading = false;
  bool _voiding = false;

  @override
  void initState() {
    super.initState();
    if (widget.transaction?.items != null) {
      _txn = widget.transaction;
    } else {
      _fetch();
    }
  }

  Future<void> _shareWhatsApp(
      BuildContext _, TransactionModel txn, UserModel user) async {
    final phoneCtrl = TextEditingController();
    final phone = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Send Receipt'),
        content: TextField(
          controller: phoneCtrl,
          decoration: const InputDecoration(
            labelText: 'WhatsApp Number',
            hintText: 'e.g. +601112345678',
            prefixIcon: Icon(Icons.phone),
          ),
          keyboardType: TextInputType.phone,
          autofocus: true,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, phoneCtrl.text),
              child: const Text('Send')),
        ],
      ),
    );
    phoneCtrl.dispose();
    if (phone == null || !mounted) return;
    await WhatsAppHelper.shareReceiptImage(context, txn, user,
        phoneNumber: phone);
  }

  Future<void> _fetch() async {
    setState(() => _loading = true);
    try {
      final txn = await ref
          .read(transactionServiceProvider)
          .getTransaction(widget.transactionId);
      setState(() => _txn = txn);
    } catch (_) {
      setState(() => _txn = widget.transaction);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _void() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Void Transaction'),
        content: const Text(
            'Are you sure? This action cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(
                  backgroundColor: Colors.red),
              child: const Text('Void')),
        ],
      ),
    );
    if (confirm != true) return;
    setState(() => _voiding = true);
    try {
      await ref
          .read(transactionsProvider.notifier)
          .voidTransaction(widget.transactionId);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(e.toString()),
                backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _voiding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    final cs = Theme.of(context).colorScheme;

    if (_loading) return const Scaffold(body: LoadingOverlay());
    if (_txn == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Transaction not found')),
      );
    }

    final txn = _txn!;
    final canVoid = txn.isCompleted &&
        user?.isManagerOrAbove == true &&
        user?.voidEnabled == true;

    return Scaffold(
      appBar: AppBar(
        title: Text(txn.transactionNumber),
        actions: [
          if (user != null)
            IconButton(
              icon: const Icon(Icons.share_outlined),
              onPressed: () => _shareWhatsApp(context, txn, user),
              tooltip: 'Share via WhatsApp',
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(formatDateTime(txn.transactionDate),
                          style: TextStyle(color: cs.onSurfaceVariant)),
                      _StatusBadge(txn.status),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(formatCurrency(txn.totalAmount),
                      style: TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.bold,
                          color: txn.isVoided
                              ? cs.onSurfaceVariant
                              : cs.primary,
                          decoration: txn.isVoided
                              ? TextDecoration.lineThrough
                              : null)),
                  const SizedBox(height: 4),
                  Text('via ${txn.paymentMethod.toUpperCase()}',
                      style: TextStyle(color: cs.onSurfaceVariant)),
                  if (txn.cashier != null) ...[
                    const SizedBox(height: 4),
                    Text('Cashier: ${txn.cashier}',
                        style: TextStyle(
                            color: cs.onSurfaceVariant, fontSize: 12)),
                  ],
                ]),
              ),
            ),
            const SizedBox(height: 16),

            // Items
            if (txn.items != null && txn.items!.isNotEmpty) ...[
              Text('Items',
                  style: Theme.of(context)
                      .textTheme
                      .titleMedium
                      ?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    children: txn.items!.map((item) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.start,
                                children: [
                                  Text(item.productName ?? 'Item',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w600)),
                                  Text(
                                      '${formatNumber(item.quantity)} × ${formatCurrency(item.unitPrice)}',
                                      style: TextStyle(
                                          fontSize: 12,
                                          color: cs.onSurfaceVariant)),
                                ],
                              ),
                            ),
                            Text(formatCurrency(item.subtotal),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Totals
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(children: [
                  _Row('Subtotal',
                      formatCurrency(txn.totalAmount -
                          txn.taxAmount +
                          txn.discountAmount),
                      cs),
                  if (txn.taxAmount > 0)
                    _Row('Tax', formatCurrency(txn.taxAmount), cs),
                  if (txn.discountAmount > 0)
                    _Row('Discount',
                        '-${formatCurrency(txn.discountAmount)}', cs,
                        color: Colors.green),
                  const Divider(height: 16),
                  Row(children: [
                    const Text('TOTAL',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const Spacer(),
                    Text(formatCurrency(txn.totalAmount),
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                            color: cs.primary)),
                  ]),
                ]),
              ),
            ),
            const SizedBox(height: 24),

            if (canVoid)
              OutlinedButton.icon(
                onPressed: _voiding ? null : _void,
                icon: _voiding
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.cancel_outlined),
                label: Text(_voiding ? 'Voiding...' : 'Void Transaction'),
                style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red,
                    side: const BorderSide(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge(this.status);

  @override
  Widget build(BuildContext context) {
    Color color;
    switch (status) {
      case 'void':
        color = Colors.red;
        break;
      case 'refunded':
        color = Colors.orange;
        break;
      default:
        color = Colors.green;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.toUpperCase(),
        style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: color),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final ColorScheme cs;
  final Color? color;
  const _Row(this.label, this.value, this.cs, {this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(children: [
        Text(label,
            style: TextStyle(color: cs.onSurfaceVariant)),
        const Spacer(),
        Text(value,
            style: TextStyle(color: color ?? cs.onSurface)),
      ]),
    );
  }
}
