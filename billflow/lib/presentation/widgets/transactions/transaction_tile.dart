import 'package:flutter/material.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/transaction_model.dart';

class TransactionTile extends StatelessWidget {
  final TransactionModel transaction;
  final VoidCallback? onTap;

  const TransactionTile({super.key, required this.transaction, this.onTap});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Color statusColor;
    String statusLabel;
    switch (transaction.status) {
      case 'void':
        statusColor = cs.error;
        statusLabel = 'Voided';
        break;
      case 'refunded':
        statusColor = Colors.orange;
        statusLabel = 'Refunded';
        break;
      default:
        statusColor = Colors.green;
        statusLabel = 'Completed';
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        onTap: onTap,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: cs.primaryContainer,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(Icons.receipt_outlined, color: cs.onPrimaryContainer),
        ),
        title: Row(
          children: [
            Text(
              transaction.transactionNumber,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const Spacer(),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: statusColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                statusLabel,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor),
              ),
            ),
          ],
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 4),
            Text(formatDateTime(transaction.transactionDate),
                style: TextStyle(
                    fontSize: 12, color: cs.onSurfaceVariant)),
            if (transaction.cashier != null)
              Text('Cashier: ${transaction.cashier}',
                  style: TextStyle(
                      fontSize: 12, color: cs.onSurfaceVariant)),
          ],
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              formatCurrency(transaction.totalAmount),
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                  color: transaction.isVoided
                      ? cs.onSurfaceVariant
                      : cs.primary,
                  decoration: transaction.isVoided
                      ? TextDecoration.lineThrough
                      : null),
            ),
            Text(
              transaction.paymentMethod.toUpperCase(),
              style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
