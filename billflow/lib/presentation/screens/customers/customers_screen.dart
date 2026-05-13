import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/customer_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/customer_provider.dart';
import '../../widgets/common/shimmer_list.dart';

// ─────────────────────────────────────────────────────────────────────────────
// CustomersScreen
// ─────────────────────────────────────────────────────────────────────────────

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  final _phoneCtrl = TextEditingController();
  String? _searchedPhone;

  @override
  void initState() {
    super.initState();
    // Tab 0 = Top Customers, Tab 1 = Search
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  void _search() {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) return;
    setState(() => _searchedPhone = phone);
  }

  @override
  Widget build(BuildContext context) {
    final topAsync = ref.watch(topCustomersProvider);
    final user = ref.watch(authProvider).valueOrNull;
    final isManager = user?.isManagerOrAbove == true;

    // Derive eyebrow count from loaded top list; falls back to en-dash
    final countLabel = topAsync.maybeWhen(
      data: (list) => _formatCount(list.length),
      orElse: () => '–',
    );

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 16, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$countLabel saved',
                          style: GoogleFonts.manrope(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink3,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Customers',
                          style: GoogleFonts.manrope(
                            fontSize: 24,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                            height: 1.15,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // + button visible only to manager+
                  if (isManager)
                    GestureDetector(
                      onTap: () {
                        // navigate to add-customer flow
                      },
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: AppColors.ink,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.add,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            // ── Underline tabs ───────────────────────────────────────────────
            _UnderlineTabs(controller: _tabCtrl),

            const SizedBox(height: 14),

            // ── Tab views ────────────────────────────────────────────────────
            Expanded(
              child: TabBarView(
                controller: _tabCtrl,
                children: [
                  _TopCustomersTab(topAsync: topAsync),
                  _SearchTab(
                    phoneCtrl: _phoneCtrl,
                    searchedPhone: _searchedPhone,
                    onSearch: _search,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

String _formatCount(int n) {
  if (n >= 1000) {
    final k = n / 1000;
    return '${k % 1 == 0 ? k.toInt() : k.toStringAsFixed(1)}k';
  }
  return '$n';
}

String _initials(String? name, String phone) {
  if (name != null && name.isNotEmpty) return name[0].toUpperCase();
  return phone.isNotEmpty ? phone[0].toUpperCase() : '?';
}

// ─────────────────────────────────────────────────────────────────────────────
// Underline tab bar
// ─────────────────────────────────────────────────────────────────────────────

class _UnderlineTabs extends StatefulWidget {
  final TabController controller;
  const _UnderlineTabs({required this.controller});

  @override
  State<_UnderlineTabs> createState() => _UnderlineTabsState();
}

class _UnderlineTabsState extends State<_UnderlineTabs> {
  static const _labels = ['Top Customers', 'Search'];

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_rebuild);
  }

  void _rebuild() => setState(() {});

  @override
  void dispose() {
    widget.controller.removeListener(_rebuild);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: List.generate(_labels.length, (i) {
          final active = widget.controller.index == i;
          return GestureDetector(
            onTap: () => widget.controller.animateTo(i),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding:
                  EdgeInsets.only(right: i < _labels.length - 1 ? 26 : 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _labels[i],
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      fontWeight:
                          active ? FontWeight.w600 : FontWeight.w500,
                      color: active ? AppColors.ink : AppColors.ink3,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Container(
                    height: 2,
                    // intrinsic width derived from char count × avg glyph width
                    width: _labels[i].length * 7.8,
                    decoration: BoxDecoration(
                      color:
                          active ? AppColors.ink : AppColors.hairline,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top Customers tab
// ─────────────────────────────────────────────────────────────────────────────

class _TopCustomersTab extends ConsumerWidget {
  final AsyncValue<List<TopCustomer>> topAsync;
  const _TopCustomersTab({required this.topAsync});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return topAsync.when(
      loading: () => const ShimmerList(itemCount: 6, itemHeight: 72),
      error: (e, _) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.wifi_off_outlined, size: 40, color: AppColors.ink3),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              e.toString(),
              style:
                  GoogleFonts.manrope(fontSize: 13, color: AppColors.ink2),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 14),
          _RetryButton(
              onPressed: () => ref.invalidate(topCustomersProvider)),
        ]),
      ),
      data: (customers) {
        if (customers.isEmpty) {
          return Center(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.people_outline,
                  size: 52, color: AppColors.ink3),
              const SizedBox(height: 10),
              Text(
                'No customer data yet',
                style: GoogleFonts.manrope(
                    fontSize: 14, color: AppColors.ink2),
              ),
            ]),
          );
        }

        return RefreshIndicator(
          color: AppColors.brand,
          onRefresh: () async => ref.invalidate(topCustomersProvider),
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            itemCount: customers.length,
            itemBuilder: (_, i) {
              return _CustomerRow(
                rank: i + 1,
                customer: customers[i],
                isFirst: i == 0,
                isLast: i == customers.length - 1,
              )
                  .animate()
                  .fadeIn(
                      delay:
                          Duration(milliseconds: (i * 40).clamp(0, 400)),
                      duration: 280.ms)
                  .slideX(begin: 0.04, end: 0);
            },
          ),
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer row (surface card with per-item dividers)
// ─────────────────────────────────────────────────────────────────────────────

class _CustomerRow extends StatelessWidget {
  final int rank;
  final TopCustomer customer;
  final bool isFirst;
  final bool isLast;

  const _CustomerRow({
    required this.rank,
    required this.customer,
    this.isFirst = false,
    this.isLast = false,
  });

  static Color _medalColor(int rank) {
    if (rank == 1) return const Color(0xFFCAA756);
    if (rank == 2) return const Color(0xFFA3A3A3);
    if (rank == 3) return const Color(0xFFC08A5A);
    return AppColors.soft;
  }

  @override
  Widget build(BuildContext context) {
    final medal = rank <= 3;
    final mc = _medalColor(rank);
    final initials = _initials(customer.name, customer.phone);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(
          top: isFirst ? const Radius.circular(16) : Radius.zero,
          bottom: isLast ? const Radius.circular(16) : Radius.zero,
        ),
        border: Border(
          left: const BorderSide(color: AppColors.hairline),
          right: const BorderSide(color: AppColors.hairline),
          top: isFirst
              ? const BorderSide(color: AppColors.hairline)
              : BorderSide.none,
          bottom: const BorderSide(color: AppColors.hairline),
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          // Avatar / medal
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color:
                  medal ? mc.withValues(alpha: 0.14) : AppColors.soft,
              border:
                  medal ? Border.all(color: mc, width: 1.5) : null,
            ),
            child: Center(
              child: medal
                  ? Text(
                      rank == 1
                          ? '🥇'
                          : rank == 2
                              ? '🥈'
                              : '🥉',
                      style: const TextStyle(fontSize: 17),
                    )
                  : Text(
                      initials,
                      style: GoogleFonts.manrope(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink2,
                      ),
                    ),
            ),
          ),

          const SizedBox(width: 12),

          // Name · phone · loyalty
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer.name ?? customer.phone,
                  style: GoogleFonts.manrope(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (customer.name != null) ...[
                  const SizedBox(height: 1),
                  Text(
                    customer.phone,
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 11,
                      color: AppColors.ink3,
                    ),
                  ),
                ],
                if (customer.loyaltyPoints > 0) ...[
                  const SizedBox(height: 3),
                  Row(children: [
                    const Icon(Icons.star_rounded,
                        size: 12, color: AppColors.brand),
                    const SizedBox(width: 2),
                    Text(
                      '${customer.loyaltyPoints} pts',
                      style: GoogleFonts.manrope(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.brand,
                      ),
                    ),
                  ]),
                ],
              ],
            ),
          ),

          // Total spent + order count
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'Rs. ${formatNumber(customer.totalSpent)}',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                '${customer.orderCount} order${customer.orderCount == 1 ? '' : 's'}',
                style: GoogleFonts.manrope(
                  fontSize: 11,
                  color: AppColors.ink3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search tab
// ─────────────────────────────────────────────────────────────────────────────

class _SearchTab extends StatelessWidget {
  final TextEditingController phoneCtrl;
  final String? searchedPhone;
  final VoidCallback onSearch;

  const _SearchTab({
    required this.phoneCtrl,
    required this.searchedPhone,
    required this.onSearch,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // ── Search bar ─────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Container(
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.hairline),
            ),
            child: TextField(
              controller: phoneCtrl,
              style: GoogleFonts.jetBrainsMono(
                  fontSize: 13.5, color: AppColors.ink),
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => onSearch(),
              decoration: InputDecoration(
                hintText: 'Search by phone…',
                hintStyle: GoogleFonts.manrope(
                    fontSize: 13, color: AppColors.ink3),
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(left: 12, right: 6),
                  child: Icon(Icons.phone_outlined,
                      size: 16, color: AppColors.ink3),
                ),
                prefixIconConstraints:
                    const BoxConstraints(minWidth: 0, minHeight: 0),
                suffixIcon: GestureDetector(
                  onTap: onSearch,
                  child: const Padding(
                    padding: EdgeInsets.only(right: 12),
                    child: Icon(Icons.search,
                        size: 18, color: AppColors.ink2),
                  ),
                ),
                suffixIconConstraints:
                    const BoxConstraints(minWidth: 0, minHeight: 0),
                border: InputBorder.none,
                contentPadding:
                    const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              ),
            ),
          ),
        ),

        const SizedBox(height: 16),

        // ── Results ────────────────────────────────────────────────────────
        Expanded(
          child: searchedPhone == null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.person_search_outlined,
                          size: 52, color: AppColors.ink3),
                      const SizedBox(height: 12),
                      Text(
                        'Search by phone number',
                        style: GoogleFonts.manrope(
                            fontSize: 14, color: AppColors.ink2),
                      ),
                    ],
                  ),
                )
              : _InsightsView(phone: searchedPhone!),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer insights view
// ─────────────────────────────────────────────────────────────────────────────

class _InsightsView extends ConsumerWidget {
  final String phone;
  const _InsightsView({required this.phone});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insightsAsync = ref.watch(customerInsightsProvider(phone));

    return insightsAsync.when(
      loading: () => const ShimmerList(itemCount: 5, itemHeight: 80),
      error: (e, _) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.person_off_outlined,
              size: 48, color: AppColors.ink3),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              e.toString().contains('404') ||
                      e.toString().contains('not found')
                  ? 'No customer found for $phone'
                  : e.toString(),
              style: GoogleFonts.manrope(
                  fontSize: 13, color: AppColors.ink2),
              textAlign: TextAlign.center,
            ),
          ),
        ]),
      ),
      data: (ins) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        children: [
          _InsightsHeader(insights: ins),
          const SizedBox(height: 12),
          _StatsRow(insights: ins),
          const SizedBox(height: 12),
          if (ins.topItems.isNotEmpty) ...[
            _SectionCard(
              icon: Icons.star_outline_rounded,
              title: 'Frequently Ordered',
              child: Column(
                children: ins.topItems
                    .map((item) => _TopItemRow(item: item))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
          ],
          if (ins.recentOrders.isNotEmpty)
            _SectionCard(
              icon: Icons.receipt_long_outlined,
              title: 'Recent Orders',
              child: Column(
                children: ins.recentOrders
                    .map((o) => _RecentOrderRow(order: o))
                    .toList(),
              ),
            ),
          if ((ins.cancellationTracking?.totalCancellations ?? 0) > 0) ...[
            const SizedBox(height: 12),
            _CancellationBanner(tracking: ins.cancellationTracking!),
          ],
        ],
      ),
    );
  }
}

class _InsightsHeader extends StatelessWidget {
  final CustomerInsights insights;
  const _InsightsHeader({required this.insights});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.brandSoft,
              border: Border.all(
                  color: AppColors.brand.withValues(alpha: 0.3)),
            ),
            child: Center(
              child: Text(
                _initials(insights.name, insights.phone),
                style: GoogleFonts.manrope(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  color: AppColors.brand,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  insights.name ?? 'Unknown Customer',
                  style: GoogleFonts.manrope(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  insights.phone,
                  style: GoogleFonts.jetBrainsMono(
                      fontSize: 12, color: AppColors.ink3),
                ),
                if (insights.loyaltyPoints > 0) ...[
                  const SizedBox(height: 3),
                  Row(children: [
                    const Icon(Icons.star_rounded,
                        size: 13, color: AppColors.brand),
                    const SizedBox(width: 3),
                    Text(
                      '${insights.loyaltyPoints} loyalty pts',
                      style: GoogleFonts.manrope(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.brand,
                      ),
                    ),
                  ]),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  final CustomerInsights insights;
  const _StatsRow({required this.insights});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _StatCell(
              label: 'Orders', value: '${insights.totalOrders}'),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatCell(
              label: 'Total Spent',
              value: 'Rs. ${formatNumber(insights.totalSpent)}'),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _StatCell(
              label: 'Avg Order',
              value: 'Rs. ${formatNumber(insights.avgOrderValue)}'),
        ),
      ],
    );
  }
}

class _StatCell extends StatelessWidget {
  final String label;
  final String value;
  const _StatCell({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: GoogleFonts.jetBrainsMono(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: GoogleFonts.manrope(
                fontSize: 10.5, color: AppColors.ink3),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final Widget child;
  const _SectionCard(
      {required this.icon, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 10),
            child: Row(children: [
              Icon(icon, size: 16, color: AppColors.ink2),
              const SizedBox(width: 7),
              Text(
                title,
                style: GoogleFonts.manrope(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
            ]),
          ),
          const Divider(height: 1, color: AppColors.hairline),
          child,
        ],
      ),
    );
  }
}

class _TopItemRow extends StatelessWidget {
  final TopItem item;
  const _TopItemRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Text(
              item.itemName,
              style:
                  GoogleFonts.manrope(fontSize: 13, color: AppColors.ink),
            ),
          ),
          Text(
            '×${item.totalQty.toStringAsFixed(0)} · ${item.orderCount} orders',
            style: GoogleFonts.manrope(
                fontSize: 11.5, color: AppColors.ink2),
          ),
        ],
      ),
    );
  }
}

class _RecentOrderRow extends StatelessWidget {
  final RecentOrder order;
  const _RecentOrderRow({required this.order});

  static Color _statusColor(String s) {
    if (s == 'COMPLETED') return AppColors.brand;
    if (s == 'CANCELLED') return AppColors.danger;
    return AppColors.warn;
  }

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(order.createdAt);
    final dateStr = date != null
        ? '${date.day} ${_month(date.month)}'
        : order.createdAt;
    final sc = _statusColor(order.status);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          // Token badge
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              order.tokenNumber,
              style: GoogleFonts.jetBrainsMono(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.ink2,
              ),
            ),
          ),
          const SizedBox(width: 8),
          // Status badge
          Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: sc.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              order.status,
              style: GoogleFonts.manrope(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: sc,
              ),
            ),
          ),
          const Spacer(),
          // Amount + date
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                'Rs. ${formatNumber(order.totalAmount)}',
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
              Text(
                dateStr,
                style: GoogleFonts.manrope(
                    fontSize: 11, color: AppColors.ink3),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static String _month(int m) => const [
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
        'Dec',
      ][m];
}

class _CancellationBanner extends StatelessWidget {
  final CancellationTracking tracking;
  const _CancellationBanner({required this.tracking});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.warn.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: AppColors.warn.withValues(alpha: 0.28)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: AppColors.warn, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              tracking.cooldownActive
                  ? '${tracking.totalCancellations} cancellations — Cooldown active'
                  : '${tracking.totalCancellations} cancellation${tracking.totalCancellations == 1 ? '' : 's'} on record',
              style: GoogleFonts.manrope(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.warn,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: retry button
// ─────────────────────────────────────────────────────────────────────────────

class _RetryButton extends StatelessWidget {
  final VoidCallback onPressed;
  const _RetryButton({required this.onPressed});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 20, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.soft,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.hairline),
        ),
        child: Text(
          'Retry',
          style: GoogleFonts.manrope(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.ink,
          ),
        ),
      ),
    );
  }
}
