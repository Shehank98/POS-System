import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/constants/app_colors.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';

class BillingScreen extends ConsumerWidget {
  const BillingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final isActive = ref.watch(isSubscriptionActiveProvider);
    final cs = Theme.of(context).colorScheme;

    if (user == null) return const SizedBox.shrink();

    final status = user.subscriptionStatus;
    final endDate = user.subscriptionEndDate;
    final inGrace = user.inGracePeriod;
    final graceDays = user.graceDaysRemaining;
    final daysLeft = user.daysUntilExpiry;

    Color statusColor;
    String statusLabel;
    IconData statusIcon;

    if (isActive && !inGrace) {
      statusColor = AppColors.success;
      statusLabel = 'Active';
      statusIcon = Icons.check_circle;
    } else if (inGrace) {
      statusColor = Colors.orange;
      statusLabel = 'Grace Period ($graceDays days left)';
      statusIcon = Icons.warning_amber_rounded;
    } else {
      statusColor = AppColors.danger;
      statusLabel = 'Expired — Access Restricted';
      statusIcon = Icons.block;
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Billing & Subscription'),
        centerTitle: false,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Status card
          Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(statusIcon, color: statusColor, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Subscription Status',
                                style: TextStyle(
                                    fontSize: 12,
                                    color: cs.onSurfaceVariant)),
                            const SizedBox(height: 2),
                            Text(statusLabel,
                                style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: statusColor)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (endDate != null) ...[
                    const SizedBox(height: 16),
                    const Divider(height: 1),
                    const SizedBox(height: 16),
                    _InfoRow(
                      label: 'Expiry Date',
                      value: _formatDate(endDate),
                      icon: Icons.calendar_today_outlined,
                    ),
                    if (daysLeft != null) ...[
                      const SizedBox(height: 12),
                      _InfoRow(
                        label: daysLeft >= 0
                            ? 'Days Remaining'
                            : 'Days Overdue',
                        value: '${daysLeft.abs().toStringAsFixed(0)} days',
                        icon: Icons.timer_outlined,
                        valueColor:
                            daysLeft >= 0 ? AppColors.success : AppColors.danger,
                      ),
                    ],
                  ],
                  const SizedBox(height: 16),
                  const Divider(height: 1),
                  const SizedBox(height: 16),
                  _InfoRow(
                    label: 'Shop',
                    value: user.shopName,
                    icon: Icons.store_outlined,
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    label: 'Shop Type',
                    value: user.shopType.toUpperCase(),
                    icon: Icons.category_outlined,
                  ),
                  const SizedBox(height: 12),
                  _InfoRow(
                    label: 'Account',
                    value: user.username,
                    icon: Icons.person_outline,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Restricted banner
          if (!isActive || inGrace)
            Card(
              color: inGrace
                  ? Colors.orange.shade50
                  : Colors.red.shade50,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(
                      color: inGrace ? Colors.orange : Colors.red,
                      width: 1)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          inGrace
                              ? Icons.warning_amber_rounded
                              : Icons.lock_outline,
                          color: inGrace ? Colors.orange : Colors.red,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          inGrace ? 'Grace Period Active' : 'Access Restricted',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: inGrace ? Colors.orange : Colors.red),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      inGrace
                          ? 'Your subscription has expired but you are in the grace period. Renew now to avoid losing access.'
                          : 'Your subscription has expired. All features except this billing page are locked. Please renew to restore access.',
                      style: TextStyle(
                          fontSize: 13,
                          color: inGrace
                              ? Colors.orange.shade900
                              : Colors.red.shade900),
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 16),

          // Renewal instructions
          Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.payments_outlined, color: cs.primary),
                      const SizedBox(width: 8),
                      Text('How to Renew',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: cs.onSurface)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _RenewalStep(
                    step: '1',
                    text: 'Contact your service provider or admin to renew.',
                  ),
                  _RenewalStep(
                    step: '2',
                    text:
                        'Once payment is confirmed, your subscription will be activated in the admin panel.',
                  ),
                  _RenewalStep(
                    step: '3',
                    text:
                        'Log out and log back in — your access will be restored automatically.',
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Active features summary
          Card(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Enabled Features',
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: cs.onSurface)),
                  const SizedBox(height: 12),
                  _FeatureRow('POS / Sales', user.posEnabled),
                  _FeatureRow('Product Management', user.productsEnabled),
                  _FeatureRow('Reports', user.reportsEnabled),
                  _FeatureRow('Analytics', user.analyticsEnabled),
                  _FeatureRow('Customers', user.customersEnabled),
                  _FeatureRow('Pre-Orders', user.preOrdersEnabled),
                  _FeatureRow('Notifications', user.notificationsEnabled),
                  _FeatureRow('Inventory', user.inventoryEnabled),
                  _FeatureRow('Loyalty', user.loyaltyEnabled),
                  _FeatureRow('Refunds', user.refundsEnabled),
                ],
              ),
            ),
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final d = DateTime.parse(iso);
      return '${d.day} ${_month(d.month)} ${d.year}';
    } catch (_) {
      return iso;
    }
  }

  String _month(int m) => const [
        '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ][m];
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? valueColor;

  const _InfoRow({
    required this.label,
    required this.value,
    required this.icon,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 18, color: cs.onSurfaceVariant),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: TextStyle(fontSize: 11, color: cs.onSurfaceVariant)),
              Text(value,
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: valueColor ?? cs.onSurface)),
            ],
          ),
        ),
      ],
    );
  }
}

class _RenewalStep extends StatelessWidget {
  final String step;
  final String text;

  const _RenewalStep({required this.step, required this.text});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 11,
            backgroundColor: cs.primaryContainer,
            child: Text(step,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: cs.onPrimaryContainer)),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final String name;
  final bool enabled;

  const _FeatureRow(this.name, this.enabled);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle : Icons.cancel_outlined,
            size: 18,
            color: enabled ? AppColors.success : Colors.grey,
          ),
          const SizedBox(width: 8),
          Text(name,
              style: TextStyle(
                  fontSize: 13,
                  color: enabled
                      ? Theme.of(context).colorScheme.onSurface
                      : Colors.grey)),
        ],
      ),
    );
  }
}
