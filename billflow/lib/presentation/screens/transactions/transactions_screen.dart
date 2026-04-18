import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../providers/transaction_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';

class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final txnAsync = ref.watch(transactionsProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Receipts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.read(transactionsProvider.notifier).refresh(),
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search by receipt # or cashier...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      )
                    : null,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
              ),
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
            ),
          ),

          // List
          Expanded(
            child: RefreshIndicator(
              onRefresh: () =>
                  ref.read(transactionsProvider.notifier).refresh(),
              child: txnAsync.when(
                loading: () => const LoadingOverlay(),
                error: (e, _) => ErrorView(
                    message: e.toString(),
                    onRetry: () =>
                        ref.read(transactionsProvider.notifier).refresh()),
                data: (txns) {
                  final filtered = _query.isEmpty
                      ? txns
                      : txns
                          .where((t) =>
                              t.transactionNumber
                                  .toLowerCase()
                                  .contains(_query) ||
                              (t.cashier?.toLowerCase().contains(_query) ??
                                  false))
                          .toList();
                  if (filtered.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.receipt_long_outlined,
                              size: 64,
                              color: cs.onSurface.withOpacity(0.2)),
                          const SizedBox(height: 12),
                          Text(
                            _query.isEmpty
                                ? 'No transactions yet'
                                : 'No results for "$_query"',
                            style: TextStyle(
                                color: cs.onSurface.withOpacity(0.5)),
                          ),
                        ],
                      ),
                    );
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 4),
                    itemCount: filtered.length,
                    itemBuilder: (ctx, i) =>
                        _TxnCard(txn: filtered[i]),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TxnCard extends StatelessWidget {
  final TransactionModel txn;
  const _TxnCard({required this.txn});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;

    Color statusColor;
    IconData statusIcon;
    switch (txn.status) {
      case 'void':
        statusColor = AppColors.danger;
        statusIcon = Icons.cancel_outlined;
        break;
      case 'refunded':
        statusColor = AppColors.warning;
        statusIcon = Icons.replay_outlined;
        break;
      default:
        statusColor = AppColors.success;
        statusIcon = Icons.check_circle_outline;
    }

    Color methodColor;
    IconData methodIcon;
    switch (txn.paymentMethod.toLowerCase()) {
      case 'card':
        methodColor = const Color(0xFF1565C0);
        methodIcon = Icons.credit_card;
        break;
      case 'mobile':
      case 'qr':
        methodColor = const Color(0xFF6A1B9A);
        methodIcon = Icons.qr_code;
        break;
      default:
        methodColor = const Color(0xFF2E7D32);
        methodIcon = Icons.payments_outlined;
    }

    return GestureDetector(
      onTap: () => context.push('/transactions/${txn.id}', extra: txn),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            // Method icon
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: methodColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(methodIcon, color: methodColor, size: 20),
            ),
            const SizedBox(width: 12),

            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    txn.transactionNumber,
                    style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatDate(txn.transactionDate),
                    style: TextStyle(
                        fontSize: 12,
                        color: cs.onSurface.withOpacity(0.5)),
                  ),
                  if (txn.cashier != null)
                    Text(
                      txn.cashier!,
                      style: TextStyle(
                          fontSize: 12,
                          color: cs.onSurface.withOpacity(0.5)),
                    ),
                ],
              ),
            ),

            // Amount + status
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  formatCurrency(txn.totalAmount),
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 15),
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(statusIcon, size: 13, color: statusColor),
                    const SizedBox(width: 3),
                    Text(
                      txn.status.toUpperCase(),
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: statusColor),
                    ),
                  ],
                ),
              ],
            ),

            const SizedBox(width: 6),
            Icon(Icons.chevron_right,
                size: 18, color: cs.onSurface.withOpacity(0.3)),
          ],
        ),
      ),
    );
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    return '${dt.day}/${dt.month}/${dt.year}';
  }
}
