import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/cart_provider.dart';
import '../../../providers/transaction_provider.dart';
import '../../../core/network/api_exception.dart';
import '../../../core/utils/whatsapp_helper.dart';
import '../../../data/models/user_model.dart';
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
                final txn = await ref
                    .read(transactionsProvider.notifier)
                    .submitQRSale(cart, reference);
                if (mounted) _showSuccessDialog(txn);
              } on ApiException catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(e.message),
                      backgroundColor: AppColors.danger));
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text(e.toString()),
                      backgroundColor: AppColors.danger));
                }
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
      final txn =
          await ref.read(transactionsProvider.notifier).submitSale(cart);
      if (mounted) _showSuccessDialog(txn);
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.message), backgroundColor: AppColors.danger),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text(e.toString()),
              backgroundColor: AppColors.danger),
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
        backgroundColor: AppColors.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text('Send Receipt',
            style: GoogleFonts.manrope(
                fontWeight: FontWeight.w600, color: AppColors.ink)),
        content: TextField(
          controller: phoneCtrl,
          decoration: InputDecoration(
            labelText: 'WhatsApp Number',
            hintText: 'e.g. +601112345678',
            prefixIcon:
                const Icon(Icons.phone, color: AppColors.ink3, size: 18),
            labelStyle: GoogleFonts.manrope(color: AppColors.ink2),
            hintStyle: GoogleFonts.manrope(color: AppColors.ink3),
            filled: true,
            fillColor: AppColors.soft,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.hairline),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.hairline),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
            ),
          ),
          keyboardType: TextInputType.phone,
          autofocus: true,
          style: GoogleFonts.jetBrainsMono(fontSize: 14, color: AppColors.ink),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel',
                style: GoogleFonts.manrope(color: AppColors.ink2)),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, phoneCtrl.text),
            style:
                FilledButton.styleFrom(backgroundColor: AppColors.brand),
            child: Text('Send', style: GoogleFonts.manrope()),
          ),
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
        backgroundColor: AppColors.surface,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.brandSoft,
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.check_rounded,
                  size: 32, color: AppColors.brand),
            ),
            const SizedBox(height: 16),
            Text(
              'Payment Successful',
              style: GoogleFonts.manrope(
                fontWeight: FontWeight.w600,
                fontSize: 18,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              txn.transactionNumber,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 12,
                color: AppColors.ink3,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              formatCurrency(txn.totalAmount),
              style: GoogleFonts.jetBrainsMono(
                fontWeight: FontWeight.w700,
                fontSize: 28,
                color: AppColors.brand,
              ),
            ),
            const SizedBox(height: 4),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'via ${txn.paymentMethod.toUpperCase()}',
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink2,
                  letterSpacing: 0.4,
                ),
              ),
            ),
          ],
        ),
        actions: [
          if (user != null && txn.items != null)
            OutlinedButton.icon(
              onPressed: () => _shareWhatsApp(txn, user),
              icon: const Icon(Icons.share_outlined, size: 16),
              label: Text('WhatsApp receipt',
                  style: GoogleFonts.manrope(fontSize: 13)),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.ink2,
                side: const BorderSide(color: AppColors.hairline),
              ),
            ),
          FilledButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.go('/sales');
            },
            style:
                FilledButton.styleFrom(backgroundColor: AppColors.brand),
            child:
                Text('New sale', style: GoogleFonts.manrope(fontSize: 14)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);

    // Determine CTA label based on payment method
    final String ctaLabel = _isProcessing
        ? 'Processing...'
        : cart.paymentMethod == 'card'
            ? 'Tap card to pay'
            : cart.paymentMethod == 'mobile' || cart.paymentMethod == 'qr'
                ? 'Show QR code'
                : 'Confirm payment';

    // Order reference — last 8 chars of first item name + item count as a stub
    final String orderRef =
        cart.items.isNotEmpty ? '#${cart.items.length.toString().padLeft(3, '0')}' : '#—';

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded,
              size: 18, color: AppColors.ink),
          onPressed: () => context.pop(),
        ),
        titleSpacing: 0,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Step 2 of 2',
              style: GoogleFonts.manrope(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.ink3,
                letterSpacing: 0.4,
              ),
            ),
            Text(
              'Take payment',
              style: GoogleFonts.manrope(
                fontSize: 20,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
                height: 1.1,
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Text(
              orderRef,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 13,
                color: AppColors.ink3,
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── Amount hero card ─────────────────────────────────────────────
            _AmountCard(cart: cart),

            const SizedBox(height: 24),

            // ── Payment method ───────────────────────────────────────────────
            _SectionLabel('Payment method'),
            const SizedBox(height: 10),
            _PaymentMethodGrid(
              selected: cart.paymentMethod,
              onChanged: (m) =>
                  ref.read(cartProvider.notifier).setPaymentMethod(m),
            ),

            const SizedBox(height: 24),

            // ── Order summary ────────────────────────────────────────────────
            _SectionLabel('Order summary'),
            const SizedBox(height: 10),
            _OrderSummaryCard(cart: cart),

            const SizedBox(height: 24),

            // ── Customer phone ───────────────────────────────────────────────
            _SectionLabel('WhatsApp receipt (optional)'),
            const SizedBox(height: 10),
            _PhoneField(
              controller: _phoneCtrl,
              onChanged: (v) =>
                  ref.read(cartProvider.notifier).setCustomerPhone(v),
            ),

            const SizedBox(height: 28),

            // ── Charge button ────────────────────────────────────────────────
            _ChargeButton(
              label: ctaLabel,
              isProcessing: _isProcessing,
              onPressed: _isProcessing ? null : _processPayment,
            ),
          ],
        ),
      ),
    );
  }
}

// ── Amount hero card ──────────────────────────────────────────────────────────

class _AmountCard extends StatelessWidget {
  final dynamic cart;
  const _AmountCard({required this.cart});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.ink,
        borderRadius: BorderRadius.circular(20),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Decorative circle top-right
          Positioned(
            top: -28,
            right: -28,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: const Color(0xFF1A6E4A).withValues(alpha: 0.18),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Amount due',
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: Colors.white.withValues(alpha: 0.55),
                    letterSpacing: 0.3,
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      'Rs ',
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 22,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.7),
                      ),
                    ),
                    Text(
                      formatNumber(cart.total),
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 44,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        height: 1,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _AmountPill(
                      '${cart.items.length} item${cart.items.length == 1 ? '' : 's'}',
                    ),
                    const SizedBox(width: 8),
                    if (cart.taxAmount > 0)
                      _AmountPill('incl. ${formatCurrency(cart.taxAmount)} tax'),
                    if (cart.orderDiscount > 0) ...[
                      const SizedBox(width: 8),
                      _AmountPill(
                          '${formatCurrency(cart.orderDiscount)} off',
                          isGreen: true),
                    ],
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AmountPill extends StatelessWidget {
  final String label;
  final bool isGreen;
  const _AmountPill(this.label, {this.isGreen = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: isGreen
            ? AppColors.brand.withValues(alpha: 0.25)
            : Colors.white.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: GoogleFonts.manrope(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: isGreen
              ? const Color(0xFF7FDDB4)
              : Colors.white.withValues(alpha: 0.65),
        ),
      ),
    );
  }
}

// ── Payment method grid ───────────────────────────────────────────────────────

class _PaymentMethodGrid extends StatelessWidget {
  final String selected;
  final ValueChanged<String> onChanged;

  const _PaymentMethodGrid({
    required this.selected,
    required this.onChanged,
  });

  static const _methods = [
    ('cash', Icons.payments_outlined, 'Cash'),
    ('mobile', Icons.qr_code_scanner, 'QR / Mobile'),
    ('card', Icons.credit_card_outlined, 'Card'),
  ];

  @override
  Widget build(BuildContext context) {
    return Row(
      children: _methods.map((m) {
        final isSelected = selected == m.$1;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(
              left: m.$1 == _methods.first.$1 ? 0 : 6,
              right: m.$1 == _methods.last.$1 ? 0 : 6,
            ),
            child: GestureDetector(
              onTap: () => onChanged(m.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 14),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.ink : AppColors.surface,
                  border: Border.all(
                    color:
                        isSelected ? AppColors.ink : AppColors.hairline,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      m.$2,
                      size: 22,
                      color: isSelected ? Colors.white : AppColors.ink2,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      m.$3,
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: isSelected ? Colors.white : AppColors.ink2,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ── Order summary card ────────────────────────────────────────────────────────

class _OrderSummaryCard extends StatelessWidget {
  final dynamic cart;
  const _OrderSummaryCard({required this.cart});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.hairline),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        children: [
          ...cart.items.map<Widget>((item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '${item.product.name}  ×${formatNumber(item.quantity)}',
                        style: GoogleFonts.manrope(
                          fontSize: 13,
                          color: AppColors.ink2,
                        ),
                      ),
                    ),
                    Text(
                      formatCurrency(item.subtotal),
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.ink,
                      ),
                    ),
                  ],
                ),
              )),
          const Divider(height: 16, thickness: 1, color: AppColors.hairline),
          _SummaryRow('Subtotal', cart.subtotal),
          if (cart.taxAmount > 0)
            _SummaryRow('Tax', cart.taxAmount),
          if (cart.orderDiscount > 0)
            _SummaryRow('Discount', -cart.orderDiscount,
                valueColor: AppColors.brand),
          const SizedBox(height: 6),
          Row(
            children: [
              Text(
                'Total',
                style: GoogleFonts.manrope(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              const Spacer(),
              Text(
                formatCurrency(cart.total),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  final String label;
  final double value;
  final Color? valueColor;
  const _SummaryRow(this.label, this.value, {this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Text(
            label,
            style: GoogleFonts.manrope(fontSize: 13, color: AppColors.ink2),
          ),
          const Spacer(),
          Text(
            formatCurrency(value),
            style: GoogleFonts.jetBrainsMono(
              fontSize: 13,
              color: valueColor ?? AppColors.ink2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Phone field ───────────────────────────────────────────────────────────────

class _PhoneField extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const _PhoneField({required this.controller, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      onChanged: onChanged,
      keyboardType: TextInputType.phone,
      style: GoogleFonts.jetBrainsMono(
        fontSize: 14,
        color: AppColors.ink,
      ),
      decoration: InputDecoration(
        hintText: '+94 71 234 5678',
        hintStyle:
            GoogleFonts.jetBrainsMono(fontSize: 14, color: AppColors.ink3),
        prefixIcon: const Icon(Icons.phone_outlined,
            size: 18, color: AppColors.ink3),
        filled: true,
        fillColor: AppColors.surface,
        contentPadding:
            const EdgeInsets.symmetric(vertical: 14, horizontal: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.hairline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.brand, width: 1.5),
        ),
      ),
    );
  }
}

// ── Charge button ─────────────────────────────────────────────────────────────

class _ChargeButton extends StatelessWidget {
  final String label;
  final bool isProcessing;
  final VoidCallback? onPressed;

  const _ChargeButton({
    required this.label,
    required this.isProcessing,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 56,
        decoration: BoxDecoration(
          color: onPressed == null
              ? AppColors.brand.withValues(alpha: 0.5)
              : AppColors.brand,
          borderRadius: BorderRadius.circular(16),
        ),
        alignment: Alignment.center,
        child: isProcessing
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                    strokeWidth: 2.5, color: Colors.white),
              )
            : Text(
                label,
                style: GoogleFonts.manrope(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.manrope(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.ink3,
        letterSpacing: 1.0,
      ),
    );
  }
}
