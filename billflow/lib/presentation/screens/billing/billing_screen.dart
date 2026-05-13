import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../data/models/user_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/feature_flag_provider.dart';

class BillingScreen extends ConsumerWidget {
  const BillingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authProvider).valueOrNull;
    final isActive = ref.watch(isSubscriptionActiveProvider);

    if (user == null) return const SizedBox.shrink();

    final inGrace = user.inGracePeriod;
    final graceDays = user.graceDaysRemaining;
    final daysLeft = user.daysUntilExpiry;
    final endDate = user.subscriptionEndDate;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Back button + header ─────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 20, 0),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: const Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 16,
                        color: AppColors.ink,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ACCOUNT',
                        style: GoogleFonts.manrope(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink3,
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Billing & plan',
                        style: GoogleFonts.manrope(
                          fontSize: 20,
                          fontWeight: FontWeight.w700,
                          color: AppColors.ink,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 40),
                children: [
                  // ── Plan card ──────────────────────────────────────
                  _PlanCard(
                    user: user,
                    isActive: isActive,
                    daysLeft: daysLeft,
                    endDate: endDate,
                  ),

                  const SizedBox(height: 12),

                  // ── Status pill ────────────────────────────────────
                  _StatusPill(
                    isActive: isActive,
                    inGrace: inGrace,
                    graceDays: graceDays,
                    daysLeft: daysLeft,
                  ),

                  const SizedBox(height: 20),

                  // ── Warning banner (grace / expired) ───────────────
                  if (!isActive || inGrace) ...[
                    _WarningBanner(inGrace: inGrace, graceDays: graceDays),
                    const SizedBox(height: 20),
                  ],

                  // ── Payment history ────────────────────────────────
                  _SectionEyebrow('PAYMENT HISTORY'),
                  const SizedBox(height: 10),
                  _PaymentHistoryCard(user: user, endDate: endDate),

                  const SizedBox(height: 20),

                  // ── Card on file ───────────────────────────────────
                  _CardOnFile(),

                  const SizedBox(height: 24),

                  // ── Enabled features ───────────────────────────────
                  _SectionEyebrow('ENABLED FEATURES'),
                  const SizedBox(height: 10),
                  _FeaturesCard(user: user),

                  const SizedBox(height: 20),

                  // ── Renewal instructions ───────────────────────────
                  _SectionEyebrow('HOW TO RENEW'),
                  const SizedBox(height: 10),
                  _RenewalCard(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Plan card (dark ink background) ──────────────────────────────────────────

class _PlanCard extends StatelessWidget {
  final UserModel user;
  final bool isActive;
  final double? daysLeft;
  final String? endDate;

  const _PlanCard({
    required this.user,
    required this.isActive,
    required this.daysLeft,
    required this.endDate,
  });

  @override
  Widget build(BuildContext context) {
    final dl = daysLeft?.toInt() ?? 0;
    final renewalText = endDate != null ? 'Renews ${_formatDate(endDate!)}' : 'No renewal date';
    final planLabel = _planLabel(user.shopType);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Stack(
        children: [
          // Card background
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(
              color: AppColors.ink,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Eyebrow
                Text(
                  'CURRENT PLAN',
                  style: GoogleFonts.manrope(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Colors.white.withValues(alpha: 0.6),
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 6),

                // Plan name
                Text(
                  planLabel,
                  style: GoogleFonts.manrope(
                    fontSize: 26,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),

                // Renewal + price
                Text(
                  '$renewalText · ${user.shopName}',
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    color: Colors.white.withValues(alpha: 0.65),
                  ),
                ),

                const SizedBox(height: 18),

                // Divider
                Divider(
                  color: Colors.white.withValues(alpha: 0.12),
                  height: 1,
                ),

                const SizedBox(height: 16),

                // Seats + Devices grid
                Row(
                  children: [
                    _PlanStat(
                      label: 'Seats',
                      value: '1 / 1',
                    ),
                    const SizedBox(width: 32),
                    _PlanStat(
                      label: 'Devices',
                      value: '1 / 3',
                    ),
                    const SizedBox(width: 32),
                    _PlanStat(
                      label: 'Days left',
                      value: dl >= 0 ? '$dl' : '0',
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Decorative circle top-right
          Positioned(
            top: -30,
            right: -30,
            child: Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF1A6E4A).withValues(alpha: 0.15),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _planLabel(String shopType) {
    switch (shopType) {
      case 'clothing':
        return 'Clothing Pro';
      case 'grocery':
        return 'Grocery Plan';
      case 'restaurant':
        return 'Restaurant Plan';
      case 'car_wash':
      case 'carwash':
        return 'Car Service Plan';
      default:
        return 'Retail Plan';
    }
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
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m];
}

class _PlanStat extends StatelessWidget {
  final String label;
  final String value;
  const _PlanStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: GoogleFonts.jetBrainsMono(
            fontSize: 18,
            fontWeight: FontWeight.w600,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: GoogleFonts.manrope(
            fontSize: 11,
            color: Colors.white.withValues(alpha: 0.55),
          ),
        ),
      ],
    );
  }
}

// ── Status pill ───────────────────────────────────────────────────────────────

class _StatusPill extends StatelessWidget {
  final bool isActive;
  final bool inGrace;
  final int graceDays;
  final double? daysLeft;

  const _StatusPill({
    required this.isActive,
    required this.inGrace,
    required this.graceDays,
    required this.daysLeft,
  });

  @override
  Widget build(BuildContext context) {
    final dl = daysLeft?.toInt() ?? 0;

    Color bg;
    Color textColor;
    Color dotColor;
    String label;

    if (isActive && !inGrace) {
      bg = AppColors.brandSoft;
      textColor = AppColors.brand;
      dotColor = AppColors.brand;
      label = 'Active · $dl days left';
    } else if (inGrace) {
      bg = const Color(0xFFFDF3E0);
      textColor = AppColors.warn;
      dotColor = AppColors.warn;
      label = 'Grace period · $graceDays day${graceDays == 1 ? '' : 's'} left';
    } else {
      bg = const Color(0xFFFBE8E8);
      textColor = AppColors.danger;
      dotColor = AppColors.danger;
      label = 'Expired — access restricted';
    }

    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 7),
            Text(
              label,
              style: GoogleFonts.manrope(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Warning banner ────────────────────────────────────────────────────────────

class _WarningBanner extends StatelessWidget {
  final bool inGrace;
  final int graceDays;
  const _WarningBanner({required this.inGrace, required this.graceDays});

  @override
  Widget build(BuildContext context) {
    final bg = inGrace ? const Color(0xFFFDF3E0) : const Color(0xFFFBE8E8);
    final borderColor = inGrace ? AppColors.warn : AppColors.danger;
    final icon = inGrace ? Icons.warning_amber_rounded : Icons.lock_outline;
    final title = inGrace ? 'Grace Period Active' : 'Access Restricted';
    final body = inGrace
        ? 'Your subscription has expired but you have $graceDays day${graceDays == 1 ? '' : 's'} remaining. Renew now to avoid losing access.'
        : 'Your subscription has expired. All features are locked. Please renew to restore access.';
    final bodyColor = inGrace
        ? const Color(0xFF7A4400)
        : const Color(0xFF7A0000);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: borderColor),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.manrope(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: borderColor,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: GoogleFonts.manrope(
                    fontSize: 12,
                    color: bodyColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Section eyebrow ───────────────────────────────────────────────────────────

class _SectionEyebrow extends StatelessWidget {
  final String text;
  const _SectionEyebrow(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: GoogleFonts.manrope(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        color: AppColors.ink3,
        letterSpacing: 1.4,
      ),
    );
  }
}

// ── Payment history card ──────────────────────────────────────────────────────

class _PaymentHistoryCard extends StatelessWidget {
  final UserModel user;
  final String? endDate;

  const _PaymentHistoryCard({required this.user, required this.endDate});

  @override
  Widget build(BuildContext context) {
    // Build synthetic payment rows from user subscription data
    final rows = <_PaymentEntry>[];

    if (endDate != null) {
      try {
        final d = DateTime.parse(endDate!);
        // Current period
        rows.add(_PaymentEntry(
          date: _formatDate(d),
          method: 'Subscription renewal',
          amount: 'Active',
        ));
        // Previous period
        final prev = DateTime(d.year, d.month - 1, d.day);
        rows.add(_PaymentEntry(
          date: _formatDate(prev),
          method: 'Bank transfer',
          amount: '—',
        ));
      } catch (_) {}
    }

    if (rows.isEmpty) {
      rows.add(const _PaymentEntry(
        date: 'No records',
        method: 'No payment history',
        amount: '—',
      ));
    }

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        children: rows.asMap().entries.map((e) {
          final isLast = e.key == rows.length - 1;
          return Column(
            children: [
              _PaymentRow(entry: e.value),
              if (!isLast)
                const Divider(
                    height: 1, indent: 16, color: AppColors.hairline),
            ],
          );
        }).toList(),
      ),
    );
  }

  String _formatDate(DateTime d) {
    const months = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    return '${d.day} ${months[d.month]} ${d.year}';
  }
}

class _PaymentEntry {
  final String date;
  final String method;
  final String amount;
  const _PaymentEntry(
      {required this.date, required this.method, required this.amount});
}

class _PaymentRow extends StatelessWidget {
  final _PaymentEntry entry;
  const _PaymentRow({required this.entry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      child: Row(
        children: [
          // Check icon in 28x28 brandSoft circle
          Container(
            width: 28,
            height: 28,
            decoration: const BoxDecoration(
              color: AppColors.brandSoft,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 14,
              color: AppColors.brand,
            ),
          ),
          const SizedBox(width: 12),
          // Date + method
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  entry.date,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  entry.method,
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    color: AppColors.ink3,
                  ),
                ),
              ],
            ),
          ),
          // Amount
          Text(
            entry.amount,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Card on file row ──────────────────────────────────────────────────────────

class _CardOnFile extends StatelessWidget {
  const _CardOnFile();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.credit_card_rounded,
              size: 18,
              color: AppColors.ink2,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Visa ending 4242',
              style: GoogleFonts.manrope(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.ink,
              ),
            ),
          ),
          Text(
            'Update →',
            style: GoogleFonts.manrope(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: AppColors.brand,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Features card ─────────────────────────────────────────────────────────────

class _FeaturesCard extends StatelessWidget {
  final UserModel user;
  const _FeaturesCard({required this.user});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _FeatureGroup(label: 'Shop Configuration', children: [
            _FeatureRow('Barcode Scanner', user.barcodeEnabled,
                note: 'Hardware/camera barcode at POS'),
          ]),
          _FeatureGroup(label: 'POS Core', children: [
            _FeatureRow('Allow Refunds', user.refundsEnabled,
                note: 'Partial/full refund in Transactions'),
            _FeatureRow('Allow Void', user.voidEnabled,
                note: 'Void completed transactions'),
            _FeatureRow('Offline Mode', user.offlineEnabled,
                note: 'Accept sales offline and sync later'),
          ]),
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
          if (user.isClothingShop)
            _FeatureGroup(label: 'Clothing Shops Only', children: [
              _FeatureRow('Exchanges / Returns', user.exchangesEnabled,
                  note: 'Single-transaction exchange module'),
              _FeatureRow('Multi-Branch', user.branchesEnabled,
                  note: 'Branch inventory management'),
            ]),
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
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: GoogleFonts.manrope(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              color: AppColors.ink3,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 8),
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle_rounded : Icons.cancel_outlined,
            size: 16,
            color: enabled ? AppColors.brand : AppColors.ink3,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: enabled ? AppColors.ink : AppColors.ink3,
                  ),
                ),
                if (note != null)
                  Text(
                    note!,
                    style: GoogleFonts.manrope(
                      fontSize: 11,
                      color: AppColors.ink3,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Renewal card ──────────────────────────────────────────────────────────────

class _RenewalCard extends StatelessWidget {
  const _RenewalCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        children: [
          _RenewalStep(
            step: '1',
            text:
                'Contact your service provider or admin to renew your plan.',
          ),
          _RenewalStep(
            step: '2',
            text:
                'Once payment is confirmed the subscription is activated in the admin panel.',
          ),
          _RenewalStep(
            step: '3',
            text:
                'Log out and log back in — full access restores automatically.',
            isLast: true,
          ),
        ],
      ),
    );
  }
}

class _RenewalStep extends StatelessWidget {
  final String step;
  final String text;
  final bool isLast;
  const _RenewalStep(
      {required this.step, required this.text, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              color: AppColors.brandSoft,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                step,
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brand,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.manrope(
                fontSize: 13,
                color: AppColors.ink2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
