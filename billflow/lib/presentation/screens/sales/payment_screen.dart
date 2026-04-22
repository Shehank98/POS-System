import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/transaction_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/whatsapp_helper.dart';
import '../../../data/models/user_model.dart';
import '../../widgets/sales/payment_method_selector.dart';
import 'qr_payment_screen.dart';

class PaymentScreen extends ConsumerStatefulWidget {
  const PaymentScreen({super.key});

  @override
  ConsumerState<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends ConsumerState<PaymentScreen> {
  final _phoneCtrl = TextEditingController();
  bool _isProcessing = false;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _processPayment() async {
    final cart = ref.read(cartProvider);
    if (cart.isEmpty) return;

    // QR / Mobile → open dedicated QR screen
    if (cart.paymentMethod == 'mobile' || cart.paymentMethod == 'qr') {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => QrPaymentScreen(
            amount: cart.total,
            onSuccess: (reference) async {
              Navigator.of(context).pop(); // pop QR screen
              setState(() => _isProcessing = true);
              try {
                // Use submitQRSale so payment_method='qr' and qr_reference are sent.
                // submitSale(cart) would use the closure-captured cart with paymentMethod='mobile'.
                final txn = await ref.read(transactionsProvider.notifier).submitQRSale(cart, reference);
                if (mounted) _showSuccessDialog(txn);
              } on ApiException catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: Colors.red));
              } catch (e) {
                if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString()), backgroundColor: Colors.red));
              } finally {
                if (mounted) setState(() => _isProcessing = false);
              }
            },
          ),
        ),
      );
      return;
    }

    setState(() => _isProcessing = true);
    try {
      final txn = await ref.read(transactionsProvider.notifier).submitSale(cart);
      if (mounted) _showSuccessDialog(txn);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: Colors.red),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<void> _shareWhatsApp(TransactionModel txn, UserModel user) async {
    final phoneCtrl = TextEditingController(text: _phoneCtrl.text);
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

  void _showSuccessDialog(TransactionModel txn) {
    final user = ref.read(authProvider).valueOrNull;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFFE8F5E9),
                shape: BoxShape.circle,
              ),
              child:
                  const Icon(Icons.check, size: 48, color: Color(0xFF2E7D32)),
            ),
            const SizedBox(height: 16),
            const Text('Payment Successful!',
                style: TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 8),
            Text(txn.transactionNumber,
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            Text(formatCurrency(txn.totalAmount),
                style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 24,
                    color: Color(0xFF2E7D32))),
            const SizedBox(height: 8),
            Text('via ${txn.paymentMethod.toUpperCase()}',
                style: TextStyle(
                    color:
                        Theme.of(context).colorScheme.onSurfaceVariant)),
          ],
        ),
        actions: [
          if (user != null && txn.items != null)
            OutlinedButton.icon(
              onPressed: () => _shareWhatsApp(txn, user),
              icon: const Icon(Icons.share),
              label: const Text('Share via WhatsApp'),
            ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.go('/sales');
            },
            child: const Text('New Sale'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Payment')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Order summary
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Order Summary',
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.bold)),
                    const Divider(height: 24),
                    ...cart.items.map((item) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${item.product.name} x${formatNumber(item.quantity)}',
                                  style: const TextStyle(fontSize: 14),
                                ),
                              ),
                              Text(formatCurrency(item.subtotal),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                        )),
                    const Divider(height: 16),
                    _TotalRow('Subtotal', cart.subtotal, cs),
                    if (cart.taxAmount > 0)
                      _TotalRow('Tax', cart.taxAmount, cs),
                    if (cart.orderDiscount > 0)
                      _TotalRow('Discount', -cart.orderDiscount, cs,
                          color: Colors.green),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Text('TOTAL',
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16)),
                        const Spacer(),
                        Text(formatCurrency(cart.total),
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 20,
                                color: cs.primary)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Payment method
            Text('Payment Method',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            PaymentMethodSelector(
              selected: cart.paymentMethod,
              onChanged: (m) =>
                  ref.read(cartProvider.notifier).setPaymentMethod(m),
            ),
            const SizedBox(height: 20),

            // Customer phone (optional)
            TextField(
              controller: _phoneCtrl,
              decoration: const InputDecoration(
                labelText: 'Customer Phone (optional)',
                prefixIcon: Icon(Icons.phone_outlined),
                hintText: 'For loyalty points',
              ),
              keyboardType: TextInputType.phone,
              onChanged: (v) =>
                  ref.read(cartProvider.notifier).setCustomerPhone(v),
            ),
            const SizedBox(height: 32),

            // Process button
            FilledButton.icon(
              onPressed: _isProcessing ? null : _processPayment,
              icon: _isProcessing
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child:
                          CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.check_circle_outlined),
              label: Text(
                  _isProcessing ? 'Processing...' : 'Process Payment'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF00C853),
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 58),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TotalRow extends StatelessWidget {
  final String label;
  final double value;
  final ColorScheme cs;
  final Color? color;

  const _TotalRow(this.label, this.value, this.cs, {this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text(label,
              style: TextStyle(color: cs.onSurfaceVariant, fontSize: 14)),
          const Spacer(),
          Text(formatCurrency(value),
              style: TextStyle(
                  fontSize: 14,
                  color: color ?? cs.onSurface)),
        ],
      ),
    );
  }
}
