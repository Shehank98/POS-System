import 'dart:io';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:screenshot/screenshot.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../data/models/transaction_model.dart';
import '../../data/models/user_model.dart';
import '../../presentation/widgets/sales/receipt_widget.dart';
import 'currency_formatter.dart';
import 'date_formatter.dart';

class WhatsAppHelper {
  // Normalise Sri Lankan (and other) numbers to E.164 format.
  // 07xxxxxxxx (10 digits, starts with 0)  → +947xxxxxxxx
  // 7xxxxxxxx  (9 digits, starts with 7/6) → +947xxxxxxxx
  // +94xxxxxxxx                            → unchanged
  static String _formatPhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    if (raw.trimLeft().startsWith('+')) {
      return raw.replaceAll(RegExp(r'[\s\-()]'), '');
    }
    if (digits.length == 10 && digits.startsWith('0')) {
      return '+94${digits.substring(1)}';
    }
    if (digits.length == 9) {
      return '+94$digits';
    }
    return '+94$digits'; // best-effort fallback
  }

  static Future<void> shareReceiptImage(
      BuildContext context, TransactionModel txn, UserModel user,
      {String? phoneNumber}) async {
    try {
      final controller = ScreenshotController();
      final imageBytes = await controller.captureFromLongWidget(
        InheritedTheme.captureAll(
          context,
          Material(
            color: Colors.white,
            child: ReceiptWidget(txn: txn, user: user),
          ),
        ),
        pixelRatio: 3.0,
      );

      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/receipt_${txn.transactionNumber}.png');
      await file.writeAsBytes(imageBytes);

      String? shareText = 'Receipt from ${user.shopName}';
      if (phoneNumber != null && phoneNumber.isNotEmpty) {
        final formatted = _formatPhone(phoneNumber);
        final whatsappUri = Uri.parse('whatsapp://send?phone=$formatted');
        if (await canLaunchUrl(whatsappUri)) {
          await launchUrl(whatsappUri);
          await Future.delayed(const Duration(milliseconds: 600));
        } else {
          final webUri = Uri.parse('https://wa.me/$formatted');
          if (await canLaunchUrl(webUri)) {
            await launchUrl(webUri, mode: LaunchMode.externalApplication);
            await Future.delayed(const Duration(milliseconds: 600));
          }
        }
      }

      await Share.shareXFiles(
        [XFile(file.path, mimeType: 'image/png')],
        text: shareText,
        subject: 'BillFlow Receipt ${txn.transactionNumber}',
      );
    } catch (_) {
      await _fallbackTextShare(txn, user, phoneNumber: phoneNumber);
    }
  }

  static Future<void> _fallbackTextShare(TransactionModel txn, UserModel user,
      {String? phoneNumber}) async {
    final message = _buildInvoiceText(txn, user);
    final encoded = Uri.encodeComponent(message);
    Uri url;
    if (phoneNumber != null && phoneNumber.isNotEmpty) {
      final formatted = _formatPhone(phoneNumber);
      url = Uri.parse('https://wa.me/$formatted?text=$encoded');
    } else {
      url = Uri.parse('https://wa.me/?text=$encoded');
    }
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
        buf.writeln(
            '$name x${formatNumber(item.quantity)} — ${formatCurrency(item.subtotal)}');
      }
    }
    buf.writeln('──────────────────────');
    buf.writeln(
        'Subtotal: ${formatCurrency(txn.totalAmount - txn.taxAmount + txn.discountAmount)}');
    if (txn.taxAmount > 0) buf.writeln('Tax: ${formatCurrency(txn.taxAmount)}');
    if (txn.discountAmount > 0) {
      buf.writeln('Discount: -${formatCurrency(txn.discountAmount)}');
    }
    buf.writeln('TOTAL: ${formatCurrency(txn.totalAmount)}');
    buf.writeln('Payment: ${txn.paymentMethod.toUpperCase()}');
    buf.writeln('──────────────────────');
    buf.writeln('Thank you for your purchase!');
    return buf.toString();
  }
}
