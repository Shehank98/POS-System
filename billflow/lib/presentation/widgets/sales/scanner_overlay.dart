import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
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

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final barcode = capture.barcodes.firstOrNull?.rawValue;
    if (barcode == null) return;

    setState(() => _processing = true);
    try {
      final product =
          await ref.read(productServiceProvider).getByBarcode(barcode);
      ref.read(cartProvider.notifier).addProduct(product);
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('${product.name} added to cart'),
              backgroundColor: Colors.green),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Product not found for this barcode'),
              backgroundColor: Colors.red),
        );
        setState(() => _processing = false);
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
          // Overlay frame
          Center(
            child: Container(
              width: 260,
              height: 180,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
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
                    style: IconButton.styleFrom(
                        backgroundColor: Colors.black45),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => _controller.toggleTorch(),
                    icon: const Icon(Icons.flashlight_on, color: Colors.white),
                    style: IconButton.styleFrom(
                        backgroundColor: Colors.black45),
                  ),
                ],
              ),
            ),
          ),
          if (_processing)
            const Center(
              child: CircularProgressIndicator(color: Colors.white),
            ),
          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Text(
              'Point camera at barcode',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Colors.white.withOpacity(0.8), fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }
}
