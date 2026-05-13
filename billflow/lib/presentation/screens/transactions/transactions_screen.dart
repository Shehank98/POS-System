import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../data/models/transaction_model.dart';
import '../../../providers/transaction_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/shimmer_list.dart';

// ── Filter options ────────────────────────────────────────────────────────────

enum _TxnFilter { all, card, cash, mobile, voided }

extension _TxnFilterLabel on _TxnFilter {
  String get label {
    switch (this) {
      case _TxnFilter.all:
        return 'All';
      case _TxnFilter.card:
        return 'Card';
      case _TxnFilter.cash:
        return 'Cash';
      case _TxnFilter.mobile:
        return 'Mobile';
      case _TxnFilter.voided:
        return 'Voided';
    }
  }
}

class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  _TxnFilter _filter = _TxnFilter.all;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<TransactionModel> _applyFilters(List<TransactionModel> txns) {
    var result = txns;

    // Apply method/status filter
    switch (_filter) {
      case _TxnFilter.all:
        break;
      case _TxnFilter.card:
        result = result
            .where((t) => t.paymentMethod.toLowerCase() == 'card')
            .toList();
        break;
      case _TxnFilter.cash:
        result = result
            .where((t) => t.paymentMethod.toLowerCase() == 'cash')
            .toList();
        break;
      case _TxnFilter.mobile:
        result = result
            .where((t) =>
                t.paymentMethod.toLowerCase() == 'mobile' ||
                t.paymentMethod.toLowerCase() == 'qr')
            .toList();
        break;
      case _TxnFilter.voided:
        result = result.where((t) => t.isVoided).toList();
        break;
    }

    // Apply search query
    if (_query.isNotEmpty) {
      result = result
          .where((t) =>
              t.transactionNumber.toLowerCase().contains(_query) ||
              (t.cashier?.toLowerCase().contains(_query) ?? false))
          .toList();
    }

    return result;
  }

  @override
  Widget build(BuildContext context) {
    final txnAsync = ref.watch(transactionsProvider);
    final topPadding = MediaQuery.of(context).padding.top;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Custom header ────────────────────────────────────────────────
          _TransactionsHeader(
            topPadding: topPadding,
            txnAsync: txnAsync,
          ),

          // ── Day summary strip ────────────────────────────────────────────
          txnAsync.when(
            data: (txns) => _DaySummaryStrip(transactions: txns),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),

          const SizedBox(height: 12),

          // ── Search bar ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: _TxnSearchBar(
              controller: _searchCtrl,
              query: _query,
              onChanged: (v) => setState(() => _query = v.toLowerCase()),
              onClear: () {
                _searchCtrl.clear();
                setState(() => _query = '');
              },
            ),
          ),

          // ── Filter chips ─────────────────────────────────────────────────
          _FilterChips(
            selected: _filter,
            onSelected: (f) => setState(() => _filter = f),
          ),
          const SizedBox(height: 12),

          // ── Transaction list ─────────────────────────────────────────────
          Expanded(
            child: RefreshIndicator(
              color: AppColors.brand,
              backgroundColor: AppColors.surface,
              onRefresh: () =>
                  ref.read(transactionsProvider.notifier).refresh(),
              child: txnAsync.when(
                loading: () =>
                    const ShimmerList(itemCount: 8, itemHeight: 76),
                error: (e, _) => ErrorView(
                  message: e.toString(),
                  onRetry: () =>
                      ref.read(transactionsProvider.notifier).refresh(),
                ),
                data: (txns) {
                  final filtered = _applyFilters(txns);
                  if (filtered.isEmpty) {
                    return _EmptyTransactions(query: _query);
                  }
                  return _TxnList(transactions: filtered);
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

class _TransactionsHeader extends StatelessWidget {
  final double topPadding;
  final AsyncValue<List<TransactionModel>> txnAsync;

  const _TransactionsHeader({
    required this.topPadding,
    required this.txnAsync,
  });

  @override
  Widget build(BuildContext context) {
    final txns = txnAsync.valueOrNull ?? [];
    final todayCount = txns
        .where((t) {
          final now = DateTime.now();
          return t.transactionDate.year == now.year &&
              t.transactionDate.month == now.month &&
              t.transactionDate.day == now.day;
        })
        .length;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, topPadding + 16, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$todayCount ${todayCount == 1 ? 'order' : 'orders'} · today',
            style: GoogleFonts.manrope(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: AppColors.ink3,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'Orders',
            style: GoogleFonts.manrope(
              fontSize: 24,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

// ── Day summary strip ─────────────────────────────────────────────────────────

class _DaySummaryStrip extends StatelessWidget {
  final List<TransactionModel> transactions;

  const _DaySummaryStrip({required this.transactions});

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final todayTxns = transactions.where((t) {
      return t.transactionDate.year == now.year &&
          t.transactionDate.month == now.month &&
          t.transactionDate.day == now.day;
    }).toList();

    final dayTotal = todayTxns
        .where((t) => !t.isVoided)
        .fold(0.0, (sum, t) => sum + t.totalAmount);

    final refundTotal = todayTxns
        .where((t) => t.isRefunded)
        .fold(0.0, (sum, t) => sum + t.totalAmount);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.brandSoft,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            // Day total
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Today\'s sales',
                    style: GoogleFonts.manrope(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppColors.brand,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    formatCurrency(dayTotal),
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.brand,
                    ),
                  ),
                ],
              ),
            ),

            // Vertical divider
            Container(
              width: 1,
              height: 36,
              color: AppColors.brand.withValues(alpha: 0.2),
              margin: const EdgeInsets.symmetric(horizontal: 16),
            ),

            // Refund total
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  'Refunds',
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  refundTotal > 0
                      ? '- ${formatCurrency(refundTotal)}'
                      : formatCurrency(0),
                  style: GoogleFonts.jetBrainsMono(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: refundTotal > 0 ? AppColors.danger : AppColors.ink3,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _TxnSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final String query;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  const _TxnSearchBar({
    required this.controller,
    required this.query,
    required this.onChanged,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.hairline),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search, color: AppColors.ink3, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              style: GoogleFonts.manrope(
                fontSize: 14,
                color: AppColors.ink,
              ),
              decoration: InputDecoration(
                hintText: 'Search by order # or cashier...',
                hintStyle: GoogleFonts.manrope(
                  fontSize: 14,
                  color: AppColors.ink3,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
              onChanged: onChanged,
            ),
          ),
          if (query.isNotEmpty) ...[
            GestureDetector(
              onTap: onClear,
              child: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 10),
                child: Icon(Icons.close, color: AppColors.ink3, size: 16),
              ),
            ),
          ] else
            const SizedBox(width: 12),
        ],
      ),
    );
  }
}

// ── Filter chips ──────────────────────────────────────────────────────────────

class _FilterChips extends StatelessWidget {
  final _TxnFilter selected;
  final ValueChanged<_TxnFilter> onSelected;

  const _FilterChips({
    required this.selected,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 34,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _TxnFilter.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final filter = _TxnFilter.values[i];
          final isSelected = filter == selected;
          return GestureDetector(
            onTap: () => onSelected(filter),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.ink : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: isSelected
                    ? null
                    : Border.all(color: AppColors.hairline),
              ),
              child: Text(
                filter.label,
                style: GoogleFonts.manrope(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isSelected ? Colors.white : AppColors.ink2,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

// ── Transaction list ──────────────────────────────────────────────────────────

class _TxnList extends StatelessWidget {
  final List<TransactionModel> transactions;

  const _TxnList({required this.transactions});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
      children: [
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.hairline),
          ),
          clipBehavior: Clip.hardEdge,
          child: Column(
            children: List.generate(transactions.length, (i) {
              final txn = transactions[i];
              final isLast = i == transactions.length - 1;
              return Column(
                children: [
                  _TxnRow(txn: txn)
                      .animate()
                      .fadeIn(
                        delay: Duration(
                            milliseconds: (i * 35).clamp(0, 350)),
                        duration: 300.ms,
                      )
                      .slideY(
                        begin: 0.04,
                        end: 0,
                        delay: Duration(
                            milliseconds: (i * 35).clamp(0, 350)),
                        duration: 300.ms,
                      ),
                  if (!isLast)
                    const Divider(
                      height: 1,
                      thickness: 1,
                      color: AppColors.hairline,
                      indent: 16,
                      endIndent: 16,
                    ),
                ],
              );
            }),
          ),
        ),
      ],
    );
  }
}

// ── Transaction row ───────────────────────────────────────────────────────────

class _TxnRow extends StatelessWidget {
  final TransactionModel txn;
  const _TxnRow({required this.txn});

  static const _methodData = {
    'card': (
      icon: Icons.credit_card_outlined,
      color: Color(0xFF2563EB),
    ),
    'qr': (
      icon: Icons.qr_code_outlined,
      color: Color(0xFF7C3AED),
    ),
    'mobile': (
      icon: Icons.qr_code_outlined,
      color: Color(0xFF7C3AED),
    ),
    'cash': (
      icon: Icons.payments_outlined,
      color: AppColors.brand,
    ),
  };

  @override
  Widget build(BuildContext context) {
    final method = txn.paymentMethod.toLowerCase();
    final methodEntry = _methodData[method] ??
        (icon: Icons.payments_outlined, color: AppColors.brand);
    final methodIcon = methodEntry.icon;
    final methodColor = methodEntry.color;

    final isVoided = txn.isVoided;
    final itemCount = txn.items?.length ?? 0;

    return Opacity(
      opacity: isVoided ? 0.55 : 1.0,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.push('/transactions/${txn.id}', extra: txn),
          splashColor: AppColors.soft,
          highlightColor: AppColors.soft.withValues(alpha: 0.5),
          child: Padding(
            padding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                // ── Payment method icon ────────────────────────────────
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.soft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    methodIcon,
                    color: methodColor,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 12),

                // ── Order ID + time + items + method ───────────────────
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        txn.transactionNumber,
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _buildSubtitle(txn, itemCount),
                        style: GoogleFonts.manrope(
                          fontSize: 11,
                          color: AppColors.ink3,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),

                // ── Amount + void badge / status ───────────────────────
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatCurrency(txn.totalAmount),
                      style: GoogleFonts.jetBrainsMono(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    if (isVoided)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.danger.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'VOID',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.danger,
                          ),
                        ),
                      )
                    else if (txn.isRefunded)
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.warn.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'REFUND',
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: AppColors.warn,
                          ),
                        ),
                      ),
                  ],
                ),

                const SizedBox(width: 6),
                const Icon(
                  Icons.chevron_right,
                  size: 16,
                  color: AppColors.ink3,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _buildSubtitle(TransactionModel txn, int itemCount) {
    final parts = <String>[
      _formatTime(txn.transactionDate),
      if (itemCount > 0) '$itemCount ${itemCount == 1 ? 'item' : 'items'}',
      txn.paymentMethod[0].toUpperCase() + txn.paymentMethod.substring(1),
    ];
    return parts.join(' · ');
  }

  String _formatTime(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inMinutes < 1) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    final month = dt.month.toString().padLeft(2, '0');
    final day = dt.day.toString().padLeft(2, '0');
    return '${dt.year}/$month/$day';
  }
}

// ── Empty state ───────────────────────────────────────────────────────────────

class _EmptyTransactions extends StatelessWidget {
  final String query;

  const _EmptyTransactions({required this.query});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.soft,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.hairline),
            ),
            child: const Icon(
              Icons.receipt_long_outlined,
              size: 32,
              color: AppColors.ink3,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            query.isEmpty ? 'No orders yet' : 'No results for "$query"',
            style: GoogleFonts.manrope(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            query.isEmpty
                ? 'Completed transactions will appear here'
                : 'Try a different search term or filter',
            style: GoogleFonts.manrope(
              fontSize: 13,
              color: AppColors.ink3,
            ),
          ),
        ],
      ),
    );
  }
}
