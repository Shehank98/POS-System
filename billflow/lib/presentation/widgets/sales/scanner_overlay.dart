import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/product_model.dart';
import '../../../data/services/product_service.dart';
import '../../../providers/cart_provider.dart';

class ScannerOverlay extends ConsumerStatefulWidget {
  const ScannerOverlay({super.key});

  @override
  ConsumerState<ScannerOverlay> createState() => _ScannerOverlayState();
}

class _ScannerOverlayState extends ConsumerState<ScannerOverlay> {
  final MobileScannerController _controller = MobileScannerController();
  bool _processing = false;
  String? _lastMessage;
  bool _isError = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _showKgDialog(ProductModel product) async {
    final kgCtrl   = TextEditingController();
    final gramCtrl = TextEditingController();
    final formKey  = GlobalKey<FormState>();

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(product.name, maxLines: 2, overflow: TextOverflow.ellipsis),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Enter weight',
                  style: TextStyle(
                      color: Theme.of(ctx).colorScheme.onSurfaceVariant,
                      fontSize: 13)),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: kgCtrl,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      autofocus: true,
                      decoration: const InputDecoration(
                        labelText: 'KG',
                        suffixText: 'kg',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      validator: (v) {
                        if ((v == null || v.isEmpty) && gramCtrl.text.isEmpty) {
                          return 'Enter weight';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      controller: gramCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Grams',
                        suffixText: 'g',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Price: ${formatCurrency(product.price)} / kg',
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (!formKey.currentState!.validate()) return;
              final kg    = double.tryParse(kgCtrl.text) ?? 0.0;
              final grams = double.tryParse(gramCtrl.text) ?? 0.0;
              final totalKg = kg + grams / 1000.0;
              if (totalKg <= 0) return;
              ref.read(cartProvider.notifier).addProduct(product, qty: totalKg);
              Navigator.pop(ctx);
              if (mounted) {
                setState(() {
                  _lastMessage =
                      '✓ ${product.name} ${totalKg.toStringAsFixed(3)} kg';
                  _isError = false;
                });
                HapticFeedback.lightImpact();
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );

    kgCtrl.dispose();
    gramCtrl.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final barcode = capture.barcodes.firstOrNull?.rawValue;
    if (barcode == null) return;

    setState(() {
      _processing = true;
      _lastMessage = null;
    });

    HapticFeedback.mediumImpact();

    try {
      final product =
          await ref.read(productServiceProvider).getByBarcode(barcode);

      if (product.unitType == 'kg') {
        await _showKgDialog(product);
      } else {
        ref.read(cartProvider.notifier).addProduct(product);
        if (mounted) {
          setState(() {
            _lastMessage = '✓ ${product.name} added';
            _isError = false;
          });
          HapticFeedback.lightImpact();
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _lastMessage = 'Product not found';
          _isError = true;
        });
        HapticFeedback.heavyImpact();
      }
    } finally {
      await Future.delayed(const Duration(milliseconds: 1500));
      if (mounted) {
        setState(() {
          _processing = false;
          _lastMessage = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          // Scan frame
          Center(
            child: Container(
              width: 260,
              height: 180,
              decoration: BoxDecoration(
                border: Border.all(
                  color: _processing
                      ? (_isError ? Colors.red : Colors.green)
                      : Colors.white,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const Icon(Icons.close, color: Colors.white),
                  ),
                  const Expanded(
                    child: Text(
                      'Scan Barcode',
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  IconButton(
                    onPressed: () => _controller.toggleTorch(),
                    icon: const Icon(Icons.flash_on, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),
          // Scan result feedback banner
          if (_lastMessage != null)
            Positioned(
              bottom: 80,
              left: 24,
              right: 24,
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                decoration: BoxDecoration(
                  color: _isError ? Colors.red.shade800 : Colors.green.shade700,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _lastMessage!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 15),
                ),
              ),
            ),
          // Hint text
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: Text(
              _processing ? '' : 'Point camera at barcode',
              textAlign: TextAlign.center,
              style:
                  TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
