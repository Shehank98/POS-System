import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:local_auth/local_auth.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../data/services/biometric_service.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';
import '../../../providers/theme_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _biometricEnabled = false;
  bool _biometricAvailable = false;
  bool _biometricLoading = false;
  bool _deviceSupportsBiometrics = false;

  @override
  void initState() {
    super.initState();
    _loadBiometricState();
  }

  Future<void> _loadBiometricState() async {
    final storage = ref.read(secureStorageProvider);
    final enabled = await storage.readBiometricEnabled();
    final auth = LocalAuthentication();
    final deviceSupported = await auth.isDeviceSupported();
    final available = deviceSupported && await ref.read(biometricServiceProvider).isAvailable();
    if (mounted) {
      setState(() {
        _biometricEnabled = enabled;
        _biometricAvailable = available;
        _deviceSupportsBiometrics = deviceSupported;
      });
    }
  }

  Future<void> _toggleBiometric(bool enable) async {
    final storage = ref.read(secureStorageProvider);
    final service = ref.read(biometricServiceProvider);

    if (enable) {
      if (!_biometricAvailable) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text(
              'No fingerprint enrolled on this device. Go to Android Settings → Security → Fingerprint to add one.'),
          duration: Duration(seconds: 5),
        ));
        return;
      }
      setState(() => _biometricLoading = true);
      final ok = await service.authenticate();
      setState(() => _biometricLoading = false);
      if (!ok) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Fingerprint verification failed. Try again.'),
            backgroundColor: Colors.red,
          ));
        }
        return;
      }
    }

    await storage.saveBiometricEnabled(enable);
    if (mounted) setState(() => _biometricEnabled = enable);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(enable
            ? 'Fingerprint login enabled - active on next app open'
            : 'Fingerprint login disabled'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).valueOrNull;
    final themeMode = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const SizedBox(height: 8),

          // User info
          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor:
                        Theme.of(context).colorScheme.primaryContainer,
                    child: Text(
                      user?.username.substring(0, 1).toUpperCase() ?? '?',
                      style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Theme.of(context)
                              .colorScheme
                              .onPrimaryContainer),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user?.username ?? '-',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 16)),
                        Text(user?.shopName ?? '-',
                            style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurfaceVariant)),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: Theme.of(context)
                                .colorScheme
                                .primaryContainer,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            (user?.role ?? 'user').toUpperCase(),
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onPrimaryContainer),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('Preferences',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color:
                        Theme.of(context).colorScheme.onSurfaceVariant)),
          ),
          const SizedBox(height: 8),

          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                SwitchListTile(
                  title: const Text('Dark Mode'),
                  subtitle: const Text('Switch between light and dark theme'),
                  secondary: const Icon(Icons.dark_mode_outlined),
                  value: themeMode == ThemeMode.dark,
                  onChanged: (v) {
                    ref.read(themeModeProvider.notifier).state =
                        v ? ThemeMode.dark : ThemeMode.light;
                  },
                ),
                const Divider(height: 1),
                if (_biometricLoading)
                  const ListTile(
                    leading: Icon(Icons.fingerprint),
                    title: Text('Fingerprint Login'),
                    trailing: SizedBox(width: 24, height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                else if (_deviceSupportsBiometrics && !_biometricAvailable)
                  ListTile(
                    leading: const Icon(Icons.fingerprint, color: Colors.orange),
                    title: const Text('Fingerprint Login'),
                    subtitle: const Text(
                      'No fingerprint enrolled. Tap to open Security Settings.',
                      style: TextStyle(color: Colors.orange),
                    ),
                    trailing: TextButton(
                      onPressed: () async {
                        // Open device security settings
                        const intent = 'android.settings.SECURITY_SETTINGS';
                        try {
                          await LocalAuthentication().getAvailableBiometrics();
                        } catch (_) {}
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: const Text('Go to Settings → Security → Fingerprint to enroll'),
                              duration: const Duration(seconds: 5),
                              action: SnackBarAction(label: 'OK', onPressed: () {}),
                            ),
                          );
                          // Re-check after a short delay
                          await Future.delayed(const Duration(seconds: 3));
                          await _loadBiometricState();
                        }
                      },
                      child: const Text('Open Settings'),
                    ),
                  )
                else
                  SwitchListTile(
                    title: const Text('Fingerprint Login'),
                    subtitle: Text(_biometricAvailable
                        ? 'Use fingerprint to unlock app'
                        : 'Not supported on this device'),
                    secondary: Icon(Icons.fingerprint,
                        color: _biometricAvailable ? null : Colors.grey),
                    value: _biometricEnabled,
                    onChanged: _biometricAvailable ? _toggleBiometric : null,
                  ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          // Billing / Subscription tile
          Builder(builder: (context) {
            final isLocked = ref.watch(isSubscriptionActiveProvider) == false ||
                (user?.inGracePeriod ?? false);
            return Card(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              child: ListTile(
                leading: Icon(
                  Icons.credit_card_outlined,
                  color: isLocked ? Colors.red : null,
                ),
                title: const Text('Billing & Subscription'),
                subtitle: Text(
                  user?.subscriptionStatus == 'active'
                      ? 'Active'
                      : user?.inGracePeriod == true
                          ? 'Grace period - ${user?.graceDaysRemaining} days left'
                          : 'Expired - renew to restore access',
                  style: TextStyle(
                    color: isLocked ? Colors.red : Colors.grey,
                    fontSize: 12,
                  ),
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/billing'),
              ),
            );
          }),

          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text('About',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color:
                        Theme.of(context).colorScheme.onSurfaceVariant)),
          ),
          const SizedBox(height: 8),

          Card(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              children: [
                const ListTile(
                  leading: Icon(Icons.info_outline),
                  title: Text('App Version'),
                  trailing:
                      Text('1.0.0', style: TextStyle(color: Colors.grey)),
                ),
                ListTile(
                  leading: const Icon(Icons.store_outlined),
                  title: const Text('Shop Type'),
                  trailing: Text(user?.shopType ?? '-',
                      style: const TextStyle(color: Colors.grey)),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton.icon(
              onPressed: () => _signOut(context, ref),
              icon: const Icon(Icons.logout, color: Colors.red),
              label: const Text('Sign Out',
                  style: TextStyle(color: Colors.red)),
              style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: Colors.red)),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Future<void> _signOut(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Sign Out')),
        ],
      ),
    );
    if (confirm == true) ref.read(authProvider.notifier).logout();
  }
}
