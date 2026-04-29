import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/qr_payment_model.dart';
import '../../../data/services/qr_payment_service.dart';

enum _Phase { loading, waiting, success, failed, expired }

class QrPaymentScreen extends ConsumerStatefulWidget {
  final double amount;
  final int? preOrderId;
  final String sessionType;
  final void Function(String reference) onSuccess;

  const QrPaymentScreen({
    super.key,
    required this.amount,
    required this.onSuccess,
    this.preOrderId,
    this.sessionType = 'pos',
  });

  @override
  ConsumerState<QrPaymentScreen> createState() => _QrPaymentScreenState();
}

class _QrPaymentScreenState extends ConsumerState<QrPaymentScreen> {
  _Phase _phase = _Phase.loading;
  QrPaymentSession? _session;
  Timer? _pollTimer;
  Timer? _countdownTimer;
  int _secondsLeft = 600;

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
    setState(() { _phase = _Phase.loading; _session = null; });
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    try {
      final svc = ref.read(qrPaymentServiceProvider);
      final session = await svc.generateQR(
        amount: widget.amount,
        sessionType: widget.sessionType,
        preOrderId: widget.preOrderId,
      );
      if (!mounted) return;
      final secs = session.expiresAt.difference(DateTime.now()).inSeconds.clamp(0, 600);
      setState(() {
        _session = session;
        _secondsLeft = secs;
        _phase = _Phase.waiting;
      });
      _startCountdown();
      _startPolling(session.reference);
    } catch (e) {
      if (!mounted) return;
      setState(() => _phase = _Phase.failed);
    }
  }

  void _startCountdown() {
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _secondsLeft = (_secondsLeft - 1).clamp(0, 600));
      if (_secondsLeft == 0 && _phase == _Phase.waiting) {
        _pollTimer?.cancel();
        setState(() => _phase = _Phase.expired);
      }
    });
  }

  void _startPolling(String reference) {
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      if (_phase != _Phase.waiting) { _pollTimer?.cancel(); return; }
      try {
        final svc = ref.read(qrPaymentServiceProvider);
        final status = await svc.checkStatus(reference);
        if (!mounted) return;
        if (status.paymentStatus == 2) {
          _pollTimer?.cancel();
          _countdownTimer?.cancel();
          setState(() => _phase = _Phase.success);
          await Future.delayed(const Duration(milliseconds: 1200));
          if (mounted) widget.onSuccess(reference);
        } else if (status.paymentStatus == -1) {
          _pollTimer?.cancel();
          setState(() => _phase = _Phase.failed);
        }
      } catch (_) {}
    });
  }

  String get _countdownLabel {
    final m = (_secondsLeft ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsLeft % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A2E),
        foregroundColor: Colors.white,
        title: const Text('QR Payment'),
        elevation: 0,
      ),
      body: SafeArea(
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    switch (_phase) {
      case _Phase.loading:
        return const Center(child: CircularProgressIndicator(color: Colors.white));

      case _Phase.waiting:
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Text('Scan with HelaPay or any LankaQR app',
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 14),
                  textAlign: TextAlign.center),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.3), blurRadius: 20)],
                ),
                child: QrImageView(
                  data: _session!.qrData,
                  version: QrVersions.auto,
                  size: 280,
                  backgroundColor: Colors.white,
                ),
              ),
              const SizedBox(height: 24),
              Text(formatCurrency(widget.amount),
                  style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.timer_outlined, color: Colors.white54, size: 16),
                  const SizedBox(width: 4),
                  Text('Expires in $_countdownLabel',
                      style: TextStyle(
                        color: _secondsLeft < 60 ? Colors.red.shade300 : Colors.white54,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      )),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(color: Color(0xFF00C853), shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 6),
                  const Text('Waiting for payment…',
                      style: TextStyle(color: Colors.white54, fontSize: 13)),
                ],
              ),
            ],
          ),
        );

      case _Phase.success:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: const BoxDecoration(color: Color(0xFF00C853), shape: BoxShape.circle),
                child: const Icon(Icons.check, size: 64, color: Colors.white),
              ),
              const SizedBox(height: 20),
              const Text('Payment Received!',
                  style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text(formatCurrency(widget.amount),
                  style: const TextStyle(color: Color(0xFF00C853), fontSize: 20)),
            ],
          ),
        );

      case _Phase.failed:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cancel_outlined, size: 72, color: Colors.red),
              const SizedBox(height: 16),
              const Text('Payment Failed',
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _generate,
                icon: const Icon(Icons.refresh),
                label: const Text('Try Again'),
              ),
            ],
          ),
        );

      case _Phase.expired:
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.hourglass_disabled, size: 72, color: Colors.orange),
              const SizedBox(height: 16),
              const Text('QR Code Expired',
                  style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Ask the cashier to generate a new QR code.',
                  style: TextStyle(color: Colors.white54), textAlign: TextAlign.center),
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
