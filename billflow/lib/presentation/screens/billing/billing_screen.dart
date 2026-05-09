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

    final inGrace = user.inGracePeriod;
    final graceDays = user.graceDaysRemaining;
    final daysLeft = user.daysUntilExpiry;
    final endDate = user.subscriptionEndDate;

    Color statusColor;
    String statusLabel;
    IconData statusIcon;

    if (isActive && !inGrace) {
      statusColor = AppColors.success;
      statusLabel = 'Active';
      statusIcon = Icons.check_circle;
    } else if (inGrace) {
      statusColor = Colors.orange;
      statusLabel = 'Grace Period ($graceDays day${graceDays == 1 ? '' : 's'} left)';
      statusIcon = Icons.warning_amber_rounded;
    } else {
      statusColor = AppColors.danger;
      statusLabel = 'Expired - Access Restricted';
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
          // ── Status card ─────────────────────────────────────────
          _SectionCard(
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
                                fontSize: 12, color: cs.onSurfaceVariant)),
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
                    label: daysLeft >= 0 ? 'Days Remaining' : 'Days Overdue',
                    value: '${daysLeft.abs().toStringAsFixed(0)} days',
                    icon: Icons.timer_outlined,
                    valueColor: daysLeft >= 0 ? AppColors.success : AppColors.danger,
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
                value: _shopTypeLabel(user.shopType),
                icon: Icons.category_outlined,
              ),
              const SizedBox(height: 12),
              _InfoRow(
                label: 'Account',
                value: '${user.username} (${user.role})',
                icon: Icons.person_outline,
              ),
            ],
          ),

          // ── Restriction / grace banner ──────────────────────────
          if (!isActive || inGrace) ...[
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: inGrace ? Colors.orange.shade50 : Colors.red.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: inGrace ? Colors.orange : Colors.red),
              ),
              padding: const EdgeInsets.all(14),
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
                        size: 20,
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
                        ? 'Your subscription has expired but you have $graceDays day${graceDays == 1 ? '' : 's'} remaining. Renew now to avoid losing access.'
                        : 'Your subscription has expired. All features are locked. Please renew to restore access.',
                    style: TextStyle(
                        fontSize: 13,
                        color: inGrace
                            ? Colors.orange.shade900
                            : Colors.red.shade900),
                  ),
                ],
              ),
            ),
          ],

          // ── Renewal instructions ────────────────────────────────
          const SizedBox(height: 12),
          _SectionCard(
            header: Row(
              children: [
                Icon(Icons.payments_outlined, color: cs.primary, size: 20),
                const SizedBox(width: 8),
                Text('How to Renew',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: cs.onSurface)),
              ],
            ),
            children: [
              const SizedBox(height: 4),
              _RenewalStep(
                  step: '1',
                  text: 'Contact your service provider or admin to renew your plan.'),
              _RenewalStep(
                  step: '2',
                  text:
                      'Once payment is confirmed the subscription is activated in the admin panel.'),
              _RenewalStep(
                  step: '3',
                  text:
                      'Log out and log back in - full access restores automatically.'),
            ],
          ),

          // ── Enabled features (mirrors admin-panel groups) ───────
          const SizedBox(height: 12),
          _SectionCard(
            header: Text('Enabled Features',
                style: TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                    color: cs.onSurface)),
            children: [
              const SizedBox(height: 4),

              // Barcode Scanner
              _FeatureGroup(label: 'Shop Configuration', children: [
                _FeatureRow(
                  'Barcode Scanner',
                  user.barcodeEnabled,
                  note: 'Hardware/camera barcode at POS',
                ),
              ]),

              // POS Core
              _FeatureGroup(label: 'POS Core', children: [
                _FeatureRow('Allow Refunds', user.refundsEnabled,
                    note: 'Partial/full refund in Transactions'),
                _FeatureRow('Allow Void', user.voidEnabled,
                    note: 'Void completed transactions'),
                _FeatureRow('Offline Mode', user.offlineEnabled,
                    note: 'Accept sales offline and sync later'),
              ]),

              // Modules
              _FeatureGroup(label: 'Modules', children: [
                _FeatureRow('Pre-Orders', user.preOrdersEnabled,
                    note: 'Customer online ordering portal'),
                _FeatureRow('Customers Tab', user.customersEnabled,
                    note: 'Customer insights dashboard'),
                _FeatureRow('Loyalty Points', user.loyaltyEnabled,
                    note: 'Earn & redeem points at checkout'),
                _FeatureRow('Reports', user.reportsEnabled,
                    note: 'Sales & inventory report exports'),
                _FeatureRow('Analytics', user.analyticsEnabled,
                    note: 'Analytics charts and trends'),
              ]),

              // Clothing Shops Only
              if (user.isClothingShop)
                _FeatureGroup(label: 'Clothing Shops Only', children: [
                  _FeatureRow('Exchanges / Returns', user.exchangesEnabled,
                      note: 'Single-transaction exchange module'),
                  _FeatureRow('Multi-Branch', user.branchesEnabled,
                      note: 'Branch inventory management'),
                ]),
            ],
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

  String _shopTypeLabel(String type) {
    switch (type) {
      case 'clothing':
        return 'Clothing Shop';
      case 'grocery':
        return 'Grocery / Supermarket';
      case 'restaurant':
        return 'Restaurant / Cafe';
      case 'carwash':
      case 'car_wash':
        return 'Car Service';
      default:
        return 'Retail';
    }
  }
}

// ── Shared widgets ─────────────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  final List<Widget> children;
  final Widget? header;

  const _SectionCard({required this.children, this.header});

  @override
  Widget build(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (header != null) ...[header!, const SizedBox(height: 12)],
            ...children,
          ],
        ),
      ),
    );
  }
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
                style:
                    TextStyle(fontSize: 13, color: cs.onSurfaceVariant)),
          ),
        ],
      ),
    );
  }
}

class _FeatureGroup extends StatelessWidget {
  final String label;
  final List<Widget> children;
  const _FeatureGroup({required this.label, required this.children});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  letterSpacing: 0.8)),
          const SizedBox(height: 6),
          ...children,
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  final String name;
  final bool enabled;
  final String? note;
  const _FeatureRow(this.name, this.enabled, {this.note});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle : Icons.cancel_outlined,
            size: 16,
            color: enabled ? AppColors.success : Colors.grey.shade400,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    style: TextStyle(
                        fontSize: 13,
                        color: enabled ? cs.onSurface : Colors.grey)),
                if (note != null)
                  Text(note!,
                      style: TextStyle(
                          fontSize: 11, color: cs.onSurfaceVariant)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
