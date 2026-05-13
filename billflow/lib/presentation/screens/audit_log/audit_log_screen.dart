import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../widgets/common/shimmer_list.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Model
// ─────────────────────────────────────────────────────────────────────────────

class AuditLogEntry {
  final int id;
  final String action;
  final String? description;
  final String? targetType;
  final int? targetId;
  final String? performedBy;
  final DateTime createdAt;

  const AuditLogEntry({
    required this.id,
    required this.action,
    this.description,
    this.targetType,
    this.targetId,
    this.performedBy,
    required this.createdAt,
  });

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) => AuditLogEntry(
        id: (json['id'] as num?)?.toInt() ?? 0,
        action: json['action'] as String? ?? '',
        description: json['description'] as String?,
        targetType: json['target_type'] as String?,
        targetId: (json['target_id'] as num?)?.toInt(),
        performedBy: json['performed_by'] as String?,
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ??
                DateTime.now()
            : DateTime.now(),
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

final _auditLogProvider =
    FutureProvider.autoDispose<List<AuditLogEntry>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get(ApiConstants.auditLog);
  final raw = res.data;
  final list =
      (raw is List ? raw : raw['records']) as List<dynamic>? ?? [];
  return list
      .map((e) => AuditLogEntry.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ─────────────────────────────────────────────────────────────────────────────
// Filter chip enum
// ─────────────────────────────────────────────────────────────────────────────

enum _Filter { all, refunds, voids, stock, pricing, auth }

extension _FilterLabel on _Filter {
  String get label {
    switch (this) {
      case _Filter.all:
        return 'All';
      case _Filter.refunds:
        return 'Refunds';
      case _Filter.voids:
        return 'Voids';
      case _Filter.stock:
        return 'Stock';
      case _Filter.pricing:
        return 'Pricing';
      case _Filter.auth:
        return 'Auth';
    }
  }

  bool matches(AuditLogEntry e) {
    final a = e.action.toLowerCase();
    switch (this) {
      case _Filter.all:
        return true;
      case _Filter.refunds:
        return a.contains('refund');
      case _Filter.voids:
        return a.contains('void');
      case _Filter.stock:
        return a.contains('stock') || a.contains('inventory');
      case _Filter.pricing:
        return a.contains('price') ||
            a.contains('pricing') ||
            a.contains('discount');
      case _Filter.auth:
        return a.contains('login') ||
            a.contains('logout') ||
            a.contains('auth') ||
            a.contains('password');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Severity helpers
// ─────────────────────────────────────────────────────────────────────────────

enum _Severity { danger, warn, normal }

_Severity _severityFor(String action) {
  final a = action.toLowerCase();
  if (a.contains('delete') ||
      a.contains('void') ||
      a.contains('remove') ||
      a.contains('cancel')) {
    return _Severity.danger;
  }
  if (a.contains('refund') ||
      a.contains('adjust') ||
      a.contains('discount') ||
      a.contains('price')) {
    return _Severity.warn;
  }
  return _Severity.normal;
}

Color _dotColor(_Severity s) {
  switch (s) {
    case _Severity.danger:
      return AppColors.danger;
    case _Severity.warn:
      return AppColors.warn;
    case _Severity.normal:
      return AppColors.ink;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AuditLogScreen
// ─────────────────────────────────────────────────────────────────────────────

class AuditLogScreen extends ConsumerStatefulWidget {
  const AuditLogScreen({super.key});

  @override
  ConsumerState<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends ConsumerState<AuditLogScreen> {
  String _query = '';
  _Filter _filter = _Filter.all;
  bool _showSearch = false;
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<AuditLogEntry> _applyFilters(List<AuditLogEntry> entries) {
    return entries.where((e) {
      final matchesFilter = _filter.matches(e);
      if (!matchesFilter) return false;
      if (_query.isEmpty) return true;
      final q = _query.toLowerCase();
      return e.action.toLowerCase().contains(q) ||
          (e.description?.toLowerCase().contains(q) ?? false) ||
          (e.performedBy?.toLowerCase().contains(q) ?? false);
    }).toList();
  }

  bool _isToday(DateTime dt) {
    final now = DateTime.now();
    return dt.year == now.year &&
        dt.month == now.month &&
        dt.day == now.day;
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_auditLogProvider);

    // Eyebrow: count of today's events from loaded data
    final todayCount = async.maybeWhen(
      data: (list) => list.where((e) => _isToday(e.createdAt)).length,
      orElse: () => null,
    );

    final eyebrow = todayCount != null
        ? 'Today · $todayCount event${todayCount == 1 ? '' : 's'}'
        : 'Today';

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
                  // Back button
                  GestureDetector(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: Container(
                      width: 36,
                      height: 36,
                      margin: const EdgeInsets.only(right: 12),
                      decoration: BoxDecoration(
                        color: AppColors.soft,
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

                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          eyebrow,
                          style: GoogleFonts.manrope(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink3,
                            letterSpacing: 0.6,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Audit log',
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

                  // Search toggle
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _showSearch = !_showSearch;
                        if (!_showSearch) {
                          _query = '';
                          _searchCtrl.clear();
                        }
                      });
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color:
                            _showSearch ? AppColors.ink : AppColors.soft,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: _showSearch
                              ? AppColors.ink
                              : AppColors.hairline,
                        ),
                      ),
                      child: Icon(
                        Icons.search_rounded,
                        size: 18,
                        color: _showSearch
                            ? Colors.white
                            : AppColors.ink2,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Search bar (collapsible) ──────────────────────────────────
            AnimatedSize(
              duration: 200.ms,
              curve: Curves.easeInOut,
              child: _showSearch
                  ? Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                      child: Container(
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.hairline),
                        ),
                        child: TextField(
                          controller: _searchCtrl,
                          autofocus: true,
                          style: GoogleFonts.manrope(
                              fontSize: 13.5, color: AppColors.ink),
                          onChanged: (v) =>
                              setState(() => _query = v.toLowerCase()),
                          decoration: InputDecoration(
                            hintText: 'Search actions…',
                            hintStyle: GoogleFonts.manrope(
                                fontSize: 13, color: AppColors.ink3),
                            prefixIcon: const Padding(
                              padding:
                                  EdgeInsets.only(left: 12, right: 6),
                              child: Icon(Icons.search_rounded,
                                  size: 16, color: AppColors.ink3),
                            ),
                            prefixIconConstraints:
                                const BoxConstraints(
                                    minWidth: 0, minHeight: 0),
                            suffixIcon: _query.isNotEmpty
                                ? GestureDetector(
                                    onTap: () => setState(() {
                                      _query = '';
                                      _searchCtrl.clear();
                                    }),
                                    child: const Padding(
                                      padding:
                                          EdgeInsets.only(right: 10),
                                      child: Icon(Icons.clear_rounded,
                                          size: 16,
                                          color: AppColors.ink3),
                                    ),
                                  )
                                : null,
                            suffixIconConstraints:
                                const BoxConstraints(
                                    minWidth: 0, minHeight: 0),
                            border: InputBorder.none,
                            contentPadding:
                                const EdgeInsets.symmetric(
                                    vertical: 10, horizontal: 12),
                          ),
                        ),
                      ),
                    )
                  : const SizedBox.shrink(),
            ),

            const SizedBox(height: 16),

            // ── Filter chips ─────────────────────────────────────────────
            SizedBox(
              height: 32,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                children: _Filter.values.map((f) {
                  final active = _filter == f;
                  return GestureDetector(
                    onTap: () => setState(() => _filter = f),
                    child: AnimatedContainer(
                      duration: 160.ms,
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: active ? AppColors.ink : AppColors.surface,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: active
                              ? AppColors.ink
                              : AppColors.hairline,
                        ),
                      ),
                      child: Text(
                        f.label,
                        style: GoogleFonts.manrope(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: active
                              ? Colors.white
                              : AppColors.ink2,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),

            const SizedBox(height: 14),

            // ── Timeline list ────────────────────────────────────────────
            Expanded(
              child: async.when(
                loading: () =>
                    const ShimmerList(itemCount: 8, itemHeight: 72),
                error: (e, _) => Center(
                  child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline,
                            size: 48, color: AppColors.ink3),
                        const SizedBox(height: 12),
                        Padding(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 32),
                          child: Text(
                            'Error: $e',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.manrope(
                                fontSize: 13, color: AppColors.ink2),
                          ),
                        ),
                        const SizedBox(height: 16),
                        _RetryButton(
                          onPressed: () =>
                              ref.invalidate(_auditLogProvider),
                        ),
                      ]),
                ),
                data: (entries) {
                  final filtered = _applyFilters(entries);

                  if (filtered.isEmpty) {
                    return Center(
                      child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.history_outlined,
                                size: 56, color: AppColors.ink3),
                            const SizedBox(height: 12),
                            Text(
                              _query.isEmpty && _filter == _Filter.all
                                  ? 'No audit entries yet'
                                  : 'No results found',
                              style: GoogleFonts.manrope(
                                  fontSize: 14, color: AppColors.ink2),
                            ),
                          ]),
                    );
                  }

                  return RefreshIndicator(
                    color: AppColors.brand,
                    onRefresh: () =>
                        ref.refresh(_auditLogProvider.future),
                    child: ListView.builder(
                      padding:
                          const EdgeInsets.fromLTRB(16, 0, 16, 32),
                      itemCount: filtered.length,
                      itemBuilder: (_, i) {
                        return _TimelineEntry(
                          entry: filtered[i],
                          isLast: i == filtered.length - 1,
                        )
                            .animate()
                            .fadeIn(
                                delay: Duration(
                                    milliseconds:
                                        (i * 30).clamp(0, 300)),
                                duration: 280.ms)
                            .slideX(begin: 0.04, end: 0);
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline entry
// ─────────────────────────────────────────────────────────────────────────────

class _TimelineEntry extends StatelessWidget {
  final AuditLogEntry entry;
  final bool isLast;

  const _TimelineEntry({
    required this.entry,
    this.isLast = false,
  });

  // Extract a short "delta" string from the description if present
  // e.g. "Price changed from 120 to 150" → "120 → 150"
  String? _extractDelta(String? description) {
    if (description == null) return null;
    // Look for "from X to Y" patterns
    final re =
        RegExp(r'from\s+([^\s]+)\s+to\s+([^\s.]+)', caseSensitive: false);
    final m = re.firstMatch(description);
    if (m != null) return '${m.group(1)} → ${m.group(2)}';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final severity = _severityFor(entry.action);
    final dotColor = _dotColor(severity);
    final timeStr = DateFormat('HH:mm').format(entry.createdAt);
    final delta = _extractDelta(entry.description);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Left rail + dot ─────────────────────────────────────────────
          SizedBox(
            width: 22,
            child: Column(
              children: [
                // Dot
                Container(
                  width: 11,
                  height: 11,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.bg,
                    border: Border.all(color: dotColor, width: 2),
                  ),
                ),
                // Rail segment below dot
                if (!isLast)
                  Expanded(
                    child: Center(
                      child: Container(
                        width: 1,
                        color: AppColors.hairline,
                      ),
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(width: 10),

          // ── Content ─────────────────────────────────────────────────────
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Time · Who
                  Row(
                    children: [
                      Text(
                        timeStr,
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11,
                          color: AppColors.ink3,
                        ),
                      ),
                      if (entry.performedBy != null) ...[
                        Text(
                          ' · ',
                          style: GoogleFonts.manrope(
                              fontSize: 11, color: AppColors.ink3),
                        ),
                        Text(
                          entry.performedBy!,
                          style: GoogleFonts.manrope(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: AppColors.ink2,
                          ),
                        ),
                      ],
                    ],
                  ),

                  const SizedBox(height: 3),

                  // What (action)
                  Text(
                    entry.action,
                    style: GoogleFonts.manrope(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.ink,
                      letterSpacing: -0.005 * 13.5,
                    ),
                  ),

                  // Description (if different from delta and non-null)
                  if (entry.description != null &&
                      entry.description!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      entry.description!,
                      style: GoogleFonts.manrope(
                        fontSize: 12,
                        color: AppColors.ink2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],

                  // Delta pill
                  if (delta != null) ...[
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: AppColors.soft,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.hairline),
                      ),
                      child: Text(
                        delta,
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 11.5,
                          color: AppColors.ink2,
                        ),
                      ),
                    ),
                  ],
                ],
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
