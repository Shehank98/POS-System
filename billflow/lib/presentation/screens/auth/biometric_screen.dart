import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/services/biometric_service.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/biometric_provider.dart';

class BiometricScreen extends ConsumerStatefulWidget {
  const BiometricScreen({super.key});

  @override
  ConsumerState<BiometricScreen> createState() => _BiometricScreenState();
}

class _BiometricScreenState extends ConsumerState<BiometricScreen> {
  bool _authenticating = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _authenticate());
  }

  Future<void> _authenticate() async {
    setState(() {
      _authenticating = true;
      _failed = false;
    });
    final svc = ref.read(biometricServiceProvider);
    final available = await svc.isAvailable();
    if (!mounted) return;
    if (!available) {
      // Device has no enrolled biometrics - bypass gate silently
      ref.read(biometricGateProvider.notifier).state = false;
      return;
    }
    final ok = await svc.authenticate();
    if (!mounted) return;
    if (ok) {
      ref.read(biometricGateProvider.notifier).state = false;
    } else {
      setState(() {
        _authenticating = false;
        _failed = true;
      });
    }
  }

  void _usePassword() {
    ref.read(authProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primary, AppColors.primaryLight],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Icon(
                      _failed ? Icons.fingerprint : Icons.fingerprint,
                      size: 72,
                      color: _failed ? Colors.red[200] : Colors.white,
                    ),
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    'BillFlow',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _authenticating
                        ? 'Verifying your identity...'
                        : _failed
                            ? 'Authentication failed'
                            : 'Touch the fingerprint sensor',
                    style:
                        const TextStyle(color: Colors.white70, fontSize: 15),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 40),
                  if (!_authenticating) ...[
                    FilledButton.icon(
                      onPressed: _authenticate,
                      icon: const Icon(Icons.fingerprint),
                      label: const Text('Try Again'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: AppColors.primary,
                        minimumSize: const Size(200, 48),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _usePassword,
                      child: const Text(
                        'Use password instead',
                        style: TextStyle(color: Colors.white70),
                      ),
                    ),
                  ] else ...[
                    const CircularProgressIndicator(color: Colors.white),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
