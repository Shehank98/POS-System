import 'package:url_launcher/url_launcher.dart';
import '../../data/models/transaction_model.dart';
import '../../data/models/user_model.dart';
import 'currency_formatter.dart';
import 'date_formatter.dart';

class WhatsAppHelper {
  static Future<void> shareReceipt(
      TransactionModel txn, UserModel user) async {
    final message = _buildInvoiceText(txn, user);
    final encoded = Uri.encodeComponent(message);
    final url = Uri.parse('https://wa.me/?text=$encoded');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }

  static String _buildInvoiceText(TransactionModel txn, UserModel user) {
    final buf = StringBuffer();
    buf.writeln('--- BillFlow Receipt ---');
    buf.writeln('Shop: ${user.shopName}');
    buf.writeln('Date: ${formatDateTime(txn.transactionDate)}');
    buf.writeln('Txn#: ${txn.transactionNumber}');
    buf.writeln('──────────────────────');
    if (txn.items != null) {
      for (final item in txn.items!) {
        final name = item.productName ?? 'Item';
        buf.writeln('$name x${formatNumber(item.quantity)} — ${formatCurrency(item.subtotal)}');
      }
    }
    buf.writeln('──────────────────────');
    buf.writeln('Subtotal: ${formatCurrency(txn.totalAmount - txn.taxAmount + txn.discountAmount)}');
    if (txn.taxAmount > 0) buf.writeln('Tax: ${formatCurrency(txn.taxAmount)}');
    if (txn.discountAmount > 0) buf.writeln('Discount: -${formatCurrency(txn.discountAmount)}');
    buf.writeln('TOTAL: ${formatCurrency(txn.totalAmount)}');
    buf.writeln('Payment: ${txn.paymentMethod.toUpperCase()}');
    buf.writeln('──────────────────────');
    buf.writeln('Thank you for your purchase!');
    return buf.toString();
  }
}
