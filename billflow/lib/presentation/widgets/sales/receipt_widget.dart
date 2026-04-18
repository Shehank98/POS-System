import 'package:flutter/material.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../data/models/user_model.dart';

class ReceiptWidget extends StatelessWidget {
  final TransactionModel txn;
  final UserModel user;

  const ReceiptWidget({super.key, required this.txn, required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 320,
      color: Colors.white,
      padding: const EdgeInsets.all(20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const Text(
            'BillFlow',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E3A5F),
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            user.shopName,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: Color(0xFF333333),
            ),
          ),
          const SizedBox(height: 12),
          _divider(),
          const SizedBox(height: 8),
          _row('Date:', formatDateTime(txn.transactionDate)),
          _row('Receipt#:', txn.transactionNumber),
          _row('Payment:', txn.paymentMethod.toUpperCase()),
          const SizedBox(height: 8),
          _divider(),
          const SizedBox(height: 8),
          if (txn.items != null)
            ...txn.items!.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              item.productName ?? 'Item',
                              style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFF222222)),
                            ),
                            Text(
                              '${formatNumber(item.quantity)} x ${formatCurrency(item.unitPrice)}',
                              style: const TextStyle(
                                  fontSize: 11, color: Color(0xFF666666)),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        formatCurrency(item.subtotal),
                        style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF222222)),
                      ),
                    ],
                  ),
                )),
          const SizedBox(height: 8),
          _divider(),
          const SizedBox(height: 8),
          _row(
              'Subtotal:',
              formatCurrency(
                  txn.totalAmount - txn.taxAmount + txn.discountAmount)),
          if (txn.taxAmount > 0) _row('Tax:', formatCurrency(txn.taxAmount)),
          if (txn.discountAmount > 0)
            _row('Discount:', '-${formatCurrency(txn.discountAmount)}',
                valueColor: const Color(0xFF2E7D32)),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'TOTAL',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF222222)),
              ),
              Text(
                formatCurrency(txn.totalAmount),
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E3A5F)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _divider(),
          const SizedBox(height: 12),
          const Text(
            'Thank you for your purchase!',
            style: TextStyle(
                fontSize: 12,
                color: Color(0xFF666666),
                fontStyle: FontStyle.italic),
          ),
          const SizedBox(height: 4),
          const Text(
            'Powered by BillFlow',
            style: TextStyle(fontSize: 10, color: Color(0xFF999999)),
          ),
        ],
      ),
    );
  }

  Widget _divider() => const Divider(
      color: Color(0xFFCCCCCC), thickness: 1, height: 1);

  Widget _row(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 12, color: Color(0xFF666666))),
          Text(value,
              style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? const Color(0xFF222222))),
        ],
      ),
    );
  }
}
