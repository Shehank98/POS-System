import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/services/qr_payment_service.dart';

enum _QrState { loading, waiting, success, failed, expired }

class QrPaymentScreen extends ConsumerStatefulWidget {
  final double amount;
  final int? preOrderId;
  final void Function(String reference) onSuccess;

  const QrPaymentScreen({
    super.key,
    required this.amount,
    this.preOrderId,
    required this.onSuccess,
  });

  @override
  ConsumerState<QrPaymentScreen> createState() => _QrPaymentScreenState();
}

class _QrPaymentScreenState extends ConsumerState<QrPaymentScreen> {
  _QrState _state = _QrState.loading;
  QrPaymentSession? _session;
  String _timeLeft = '';
  Timer? _pollTimer;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _generate();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  Future<void> _generate() async {
    setState(() => _state = _QrState.loading);
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    try {
      final service = ref.read(qrPaymentServiceProvider);
      final session = await service.generateQR(
        amount: widget.amount,
        preOrderId: widget.preOrderId,
      );
      _session = session;
      setState(() {
        _state = _QrState.waiting;
        _timeLeft = _countdown(session.expiresAt);
      });
      _startCountdown();
      _startPolling();
    } catch (_) {
      if (mounted) setState(() => _state = _QrState.failed);
    }
  }

  String _countdown(DateTime expiresAt) {
    final diff = expiresAt.difference(DateTime.now());
    if (diff.isNegative) return '00:00';
    final m = diff.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = diff.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_session == null || !mounted) return;
      setState(() => _timeLeft = _countdown(_session!.expiresAt));
      if (_session!.expiresAt.isBefore(DateTime.now())) {
        _stopAll();
        setState(() => _state = _QrState.expired);
      }
    });
  }

  void _startPolling() {
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (_session == null || !mounted) return;
      try {
        final service = ref.read(qrPaymentServiceProvider);
        final status = await service.checkStatus(_session!.reference);
        if (!mounted) return;
        if (status.paymentStatus == 2) {
          _stopAll();
          setState(() => _state = _QrState.success);
          await Future.delayed(const Duration(milliseconds: 1200));
          if (mounted) widget.onSuccess(_session!.reference);
        } else if (status.paymentStatus == -1) {
          _stopAll();
          setState(() => _state = _QrState.failed);
        }
      } catch (_) {}
    });
  }

  void _stopAll() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QR Payment'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () {
            _stopAll();
            Navigator.of(context).pop();
          },
        ),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    switch (_state) {
      case _QrState.loading:
        return const Center(child: CircularProgressIndicator());

      case _QrState.waiting:
        return Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Scan with HelaPay or any LankaQR app',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                if (_session?.qrData != null)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 20,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: QrImageView(
                      data: _session!.qrData,
                      size: 280,
                      errorCorrectionLevel: QrErrorCorrectLevel.M,
                    ),
                  ),
                const SizedBox(height: 24),
                Text(
                  formatCurrency(widget.amount),
                  style: const TextStyle(
                      fontSize: 32, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Colors.amber,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('Waiting for payment...',
                        style: TextStyle(color: Colors.grey)),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Expires in $_timeLeft',
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
          ),
        );

      case _QrState.success:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(
                  color: Color(0xFFE8F5E9),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle,
                    size: 80, color: Color(0xFF2E7D32)),
              ),
              const SizedBox(height: 24),
              const Text(
                'Payment Received!',
                style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF2E7D32)),
              ),
              const SizedBox(height: 8),
              Text(
                formatCurrency(widget.amount),
                style: const TextStyle(
                    fontSize: 20,
                    color: Color(0xFF2E7D32),
                    fontWeight: FontWeight.w600),
              ),
            ],
          ),
        );

      case _QrState.failed:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.cancel, size: 80, color: Colors.red),
              const SizedBox(height: 16),
              const Text(
                'Payment Failed',
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.red),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please ask the customer to try again.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _generate,
                icon: const Icon(Icons.refresh),
                label: const Text('Try Again'),
              ),
            ],
          ),
        );

      case _QrState.expired:
        return Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.timer_off, size: 80, color: Colors.grey),
              const SizedBox(height: 16),
              const Text(
                'QR Code Expired',
                style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey),
              ),
              const SizedBox(height: 8),
              const Text(
                'Generate a new QR code to proceed.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _generate,
                icon: const Icon(Icons.qr_code),
                label: const Text('Generate New QR'),
              ),
            ],
          ),
        );
    }
  }
}
