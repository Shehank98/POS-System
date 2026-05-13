import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:local_auth/local_auth.dart';
import '../../../core/constants/app_colors.dart';
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
    final available =
        deviceSupported && await ref.read(biometricServiceProvider).isAvailable();
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
            backgroundColor: AppColors.danger,
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
    final isLocked = ref.watch(isSubscriptionActiveProvider) == false ||
        (user?.inGracePeriod ?? false);

    final initials = (user?.username.isNotEmpty == true)
        ? user!.username.substring(0, 1).toUpperCase()
        : '?';

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        title: Text(
          'Settings',
          style: GoogleFonts.manrope(
            fontSize: 24,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        children: [
          const SizedBox(height: 4),

          // ── Profile card ─────────────────────────────────────────────────────
          _Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: const BoxDecoration(
                      color: AppColors.brandSoft,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      initials,
                      style: GoogleFonts.manrope(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: AppColors.brand,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.username ?? '-',
                          style: GoogleFonts.manrope(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          (user?.role ?? 'user').toUpperCase(),
                          style: GoogleFonts.manrope(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.brand,
                            letterSpacing: 0.5,
                          ),
                        ),
                        Text(
                          user?.shopName ?? '-',
                          style: GoogleFonts.manrope(
                            fontSize: 12,
                            color: AppColors.ink2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 28),

          // ── SHOP group ───────────────────────────────────────────────────────
          _GroupLabel('SHOP'),
          const SizedBox(height: 8),
          _Card(
            child: Column(
              children: [
                _SettingsRow(
                  icon: Icons.inventory_2_outlined,
                  label: 'Products & catalog',
                  onTap: () => context.push('/products'),
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.percent_outlined,
                  label: 'Taxes & discounts',
                  onTap: () => context.push('/tax-settings'),
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.receipt_long_outlined,
                  label: 'Receipt template',
                  onTap: () => context.push('/receipt-settings'),
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.people_outline,
                  label: 'Staff & roles',
                  onTap: () => context.push('/staff'),
                  isLast: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ── DEVICE group ─────────────────────────────────────────────────────
          _GroupLabel('DEVICE'),
          const SizedBox(height: 8),
          _Card(
            child: Column(
              children: [
                _SettingsRow(
                  icon: Icons.qr_code_scanner,
                  label: 'Connected scanner',
                  onTap: () => context.push('/scanner-settings'),
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.print_outlined,
                  label: 'Printer',
                  onTap: () => context.push('/printer-settings'),
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.wifi_outlined,
                  label: 'Network',
                  onTap: () => context.push('/network-settings'),
                  isLast: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ── ACCOUNT group ────────────────────────────────────────────────────
          _GroupLabel('ACCOUNT'),
          const SizedBox(height: 8),
          _Card(
            child: Column(
              children: [
                _SettingsRow(
                  icon: Icons.credit_card_outlined,
                  label: 'Billing',
                  detail: user?.subscriptionStatus == 'active' &&
                          !(user?.inGracePeriod ?? false)
                      ? 'Active'
                      : user?.inGracePeriod == true
                          ? '${user?.graceDaysRemaining}d left'
                          : 'Expired',
                  detailColor: isLocked ? AppColors.danger : AppColors.brand,
                  onTap: () => context.push('/billing'),
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.notifications_outlined,
                  label: 'Notifications',
                  onTap: () => context.push('/notifications'),
                ),
                _Hairline(),
                _BiometricRow(
                  biometricLoading: _biometricLoading,
                  deviceSupportsBiometrics: _deviceSupportsBiometrics,
                  biometricAvailable: _biometricAvailable,
                  biometricEnabled: _biometricEnabled,
                  onToggle: _toggleBiometric,
                  onOpenSettings: () async {
                    try {
                      await LocalAuthentication().getAvailableBiometrics();
                    } catch (_) {}
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: const Text(
                              'Go to Settings → Security → Fingerprint to enroll'),
                          duration: const Duration(seconds: 5),
                          action: SnackBarAction(label: 'OK', onPressed: () {}),
                        ),
                      );
                      await Future.delayed(const Duration(seconds: 3));
                      await _loadBiometricState();
                    }
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ── APPEARANCE group ─────────────────────────────────────────────────
          _GroupLabel('APPEARANCE'),
          const SizedBox(height: 8),
          _Card(
            child: _ThemeToggleRow(
              isDark: themeMode == ThemeMode.dark,
              onChanged: (v) {
                ref.read(themeModeProvider.notifier).state =
                    v ? ThemeMode.dark : ThemeMode.light;
              },
            ),
          ),

          const SizedBox(height: 24),

          // ── ABOUT group ──────────────────────────────────────────────────────
          _GroupLabel('ABOUT'),
          const SizedBox(height: 8),
          _Card(
            child: Column(
              children: [
                _SettingsRow(
                  icon: Icons.store_outlined,
                  label: 'Shop type',
                  detail: user?.shopType ?? '-',
                  showChevron: false,
                ),
                _Hairline(),
                _SettingsRow(
                  icon: Icons.info_outline,
                  label: 'App version',
                  detail: '1.0.0',
                  showChevron: false,
                  isLast: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),

          // ── Sign out ─────────────────────────────────────────────────────────
          GestureDetector(
            onTap: () => _signOut(context, ref),
            child: Container(
              height: 50,
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.hairline),
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: Text(
                'Sign out',
                style: GoogleFonts.manrope(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: AppColors.danger,
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),

          // ── Version footer ───────────────────────────────────────────────────
          Center(
            child: Text(
              'billflow v1.0.0',
              style: GoogleFonts.jetBrainsMono(
                fontSize: 11,
                color: AppColors.ink3,
              ),
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        backgroundColor: AppColors.surface,
        title: Text('Sign Out',
            style: GoogleFonts.manrope(
                fontWeight: FontWeight.w600, color: AppColors.ink)),
        content: Text('Are you sure you want to sign out?',
            style: GoogleFonts.manrope(color: AppColors.ink2)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('Cancel',
                style: GoogleFonts.manrope(color: AppColors.ink2)),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            child: Text('Sign Out', style: GoogleFonts.manrope()),
          ),
        ],
      ),
    );
    if (confirm == true) ref.read(authProvider.notifier).logout();
  }
}

// ── Shared widgets ────────────────────────────────────────────────────────────

class _Card extends StatelessWidget {
  final Widget child;
  const _Card({required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.hairline),
        borderRadius: BorderRadius.circular(16),
      ),
      child: child,
    );
  }
}

class _GroupLabel extends StatelessWidget {
  final String text;
  const _GroupLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.manrope(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.ink3,
        letterSpacing: 1.1,
      ),
    );
  }
}

class _Hairline extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Divider(
      height: 1,
      thickness: 1,
      color: AppColors.hairline,
      indent: 54,
    );
  }
}

class _SettingsRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? detail;
  final Color? detailColor;
  final VoidCallback? onTap;
  final bool showChevron;
  final bool isLast;

  const _SettingsRow({
    required this.icon,
    required this.label,
    this.detail,
    this.detailColor,
    this.onTap,
    this.showChevron = true,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: isLast
          ? const BorderRadius.vertical(bottom: Radius.circular(16))
          : BorderRadius.zero,
      child: SizedBox(
        height: 48,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.soft,
                  borderRadius: BorderRadius.circular(7),
                ),
                alignment: Alignment.center,
                child: Icon(icon, size: 16, color: AppColors.ink2),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 14,
                    color: AppColors.ink,
                  ),
                ),
              ),
              if (detail != null) ...[
                Text(
                  detail!,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    color: detailColor ?? AppColors.ink3,
                  ),
                ),
                const SizedBox(width: 4),
              ],
              if (showChevron)
                const Icon(Icons.chevron_right, size: 18, color: AppColors.ink3),
            ],
          ),
        ),
      ),
    );
  }
}

class _ThemeToggleRow extends StatelessWidget {
  final bool isDark;
  final ValueChanged<bool> onChanged;

  const _ThemeToggleRow({required this.isDark, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(7),
              ),
              alignment: Alignment.center,
              child: const Icon(Icons.dark_mode_outlined,
                  size: 16, color: AppColors.ink2),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Dark mode',
                style: GoogleFonts.manrope(fontSize: 14, color: AppColors.ink),
              ),
            ),
            Switch(
              value: isDark,
              onChanged: onChanged,
              activeColor: AppColors.brand,
            ),
          ],
        ),
      ),
    );
  }
}

class _BiometricRow extends StatelessWidget {
  final bool biometricLoading;
  final bool deviceSupportsBiometrics;
  final bool biometricAvailable;
  final bool biometricEnabled;
  final ValueChanged<bool> onToggle;
  final VoidCallback onOpenSettings;

  const _BiometricRow({
    required this.biometricLoading,
    required this.deviceSupportsBiometrics,
    required this.biometricAvailable,
    required this.biometricEnabled,
    required this.onToggle,
    required this.onOpenSettings,
  });

  @override
  Widget build(BuildContext context) {
    if (biometricLoading) {
      return SizedBox(
        height: 48,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.soft,
                  borderRadius: BorderRadius.circular(7),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.fingerprint,
                    size: 16, color: AppColors.ink2),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text('Fingerprint login',
                    style:
                        GoogleFonts.manrope(fontSize: 14, color: AppColors.ink)),
              ),
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: AppColors.brand),
              ),
            ],
          ),
        ),
      );
    }

    if (deviceSupportsBiometrics && !biometricAvailable) {
      return SizedBox(
        height: 56,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: AppColors.soft,
                  borderRadius: BorderRadius.circular(7),
                ),
                alignment: Alignment.center,
                child: const Icon(Icons.fingerprint,
                    size: 16, color: AppColors.warn),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Fingerprint login',
                        style: GoogleFonts.manrope(
                            fontSize: 14, color: AppColors.ink)),
                    Text('No fingerprint enrolled',
                        style: GoogleFonts.manrope(
                            fontSize: 11, color: AppColors.warn)),
                  ],
                ),
              ),
              GestureDetector(
                onTap: onOpenSettings,
                child: Text(
                  'Open Settings',
                  style: GoogleFonts.manrope(
                      fontSize: 12,
                      color: AppColors.brand,
                      fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      height: 48,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.soft,
                borderRadius: BorderRadius.circular(7),
              ),
              alignment: Alignment.center,
              child: Icon(Icons.fingerprint,
                  size: 16,
                  color:
                      biometricAvailable ? AppColors.ink2 : AppColors.ink3),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Fingerprint login',
                      style: GoogleFonts.manrope(
                          fontSize: 14, color: AppColors.ink)),
                  if (!biometricAvailable)
                    Text('Not supported on this device',
                        style: GoogleFonts.manrope(
                            fontSize: 11, color: AppColors.ink3)),
                ],
              ),
            ),
            Switch(
              value: biometricEnabled,
              onChanged: biometricAvailable ? onToggle : null,
              activeColor: AppColors.brand,
            ),
          ],
        ),
      ),
    );
  }
}
