import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/auth_provider.dart';

class WaitingActivationScreen extends ConsumerStatefulWidget {
  const WaitingActivationScreen({super.key});
  @override
  ConsumerState<WaitingActivationScreen> createState() => _WaitingActivationScreenState();
}

class _WaitingActivationScreenState extends ConsumerState<WaitingActivationScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  bool _refreshing = false;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    setState(() => _refreshing = true);
    try {
      ref.invalidate(authProvider);
      // Give the provider a moment to rebuild
      await Future.delayed(const Duration(milliseconds: 800));
      final user = ref.read(authProvider).valueOrNull;
      if (user != null && !user.isPendingPayment && mounted) {
        context.go(user.isCarServiceShop ? '/carwash' : '/dashboard');
      }
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Animated icon
              AnimatedBuilder(
                animation: _pulse,
                builder: (_, __) => Container(
                  width: 100, height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.orange.withValues(alpha: 0.1 + 0.08 * _pulse.value),
                    border: Border.all(
                      color: Colors.orange.withValues(alpha: 0.3 + 0.2 * _pulse.value),
                      width: 2,
                    ),
                  ),
                  child: const Icon(Icons.hourglass_top_rounded,
                      color: Colors.orange, size: 48),
                ),
              ),

              const SizedBox(height: 32),
              Text(
                user?.shopName ?? 'Your Shop',
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              const Text(
                'Pending Activation',
                style: TextStyle(fontSize: 16, color: Colors.orange, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              const Text(
                'Your shop has been registered. Your sales agent will collect the subscription payment and submit it for verification.\n\nOnce the admin verifies the payment, your account will be activated and you can start using the POS.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.black54, height: 1.5),
              ),

              const SizedBox(height: 40),

              // Steps
              _StepRow(step: '1', label: 'Agent collects payment', done: true),
              _StepRow(step: '2', label: 'Agent submits to admin', done: false),
              _StepRow(step: '3', label: 'Admin verifies & activates', done: false),

              const SizedBox(height: 40),

              FilledButton.icon(
                onPressed: _refreshing ? null : _checkStatus,
                icon: _refreshing
                    ? const SizedBox(height: 16, width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.refresh, size: 18),
                label: const Text('Check Activation Status'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.orange,
                  minimumSize: const Size(double.infinity, 50),
                ),
              ),

              const SizedBox(height: 12),
              TextButton(
                onPressed: () async {
                  await ref.read(authProvider.notifier).logout();
                  if (context.mounted) context.go('/login');
                },
                child: const Text('Sign Out', style: TextStyle(color: Colors.black45)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepRow extends StatelessWidget {
  final String step;
  final String label;
  final bool done;
  const _StepRow({required this.step, required this.label, required this.done});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Row(children: [
      Container(
        width: 28, height: 28,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: done ? Colors.green : Colors.grey[200],
        ),
        child: done
            ? const Icon(Icons.check, color: Colors.white, size: 16)
            : Center(child: Text(step,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold,
                    color: Colors.grey[500]))),
      ),
      const SizedBox(width: 12),
      Text(label, style: TextStyle(
          fontSize: 14,
          color: done ? Colors.black87 : Colors.black45,
          fontWeight: done ? FontWeight.w500 : FontWeight.normal)),
    ]),
  );
}
