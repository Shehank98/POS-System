import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/network/dio_client.dart';
import '../../widgets/common/shimmer_list.dart';

// ── Model ─────────────────────────────────────────────────────────────────────

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
        id:          json['id'] as int,
        action:      json['action'] as String? ?? '',
        description: json['description'] as String?,
        targetType:  json['target_type'] as String?,
        targetId:    json['target_id'] as int?,
        performedBy: json['performed_by'] as String?,
        createdAt:   DateTime.parse(json['created_at'] as String),
      );
}

// ── Provider ──────────────────────────────────────────────────────────────────

final _auditLogProvider = FutureProvider.autoDispose<List<AuditLogEntry>>((ref) async {
  final dio = ref.read(dioProvider);
  final res = await dio.get(ApiConstants.auditLog);
  return (res.data as List)
      .map((e) => AuditLogEntry.fromJson(e as Map<String, dynamic>))
      .toList();
});

// ── Screen ────────────────────────────────────────────────────────────────────

class AuditLogScreen extends ConsumerStatefulWidget {
  const AuditLogScreen({super.key});

  @override
  ConsumerState<AuditLogScreen> createState() => _AuditLogScreenState();
}

class _AuditLogScreenState extends ConsumerState<AuditLogScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_auditLogProvider);
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Audit Log'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () => ref.invalidate(_auditLogProvider),
          ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search actions…',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _query.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () => setState(() => _query = ''))
                  : null,
              isDense: true,
            ),
            onChanged: (v) => setState(() => _query = v.toLowerCase()),
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const ShimmerList(itemCount: 8, itemHeight: 72),
            error: (e, _) => Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.error_outline,
                    size: 48, color: cs.onSurfaceVariant),
                const SizedBox(height: 12),
                Text('Error: $e', textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.tonal(
                  onPressed: () => ref.invalidate(_auditLogProvider),
                  child: const Text('Retry'),
                ),
              ]),
            ),
            data: (entries) {
              final filtered = _query.isEmpty
                  ? entries
                  : entries.where((e) =>
                      e.action.toLowerCase().contains(_query) ||
                      (e.description?.toLowerCase().contains(_query) ??
                          false) ||
                      (e.performedBy?.toLowerCase().contains(_query) ??
                          false)).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.history_outlined,
                        size: 64, color: cs.onSurfaceVariant),
                    const SizedBox(height: 12),
                    Text(_query.isEmpty
                        ? 'No audit entries yet'
                        : 'No results for "$_query"'),
                  ]),
                );
              }

              return RefreshIndicator(
                onRefresh: () => ref.refresh(_auditLogProvider.future),
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => _EntryTile(entry: filtered[i])
                      .animate()
                      .fadeIn(
                          delay: Duration(
                              milliseconds: (i * 30).clamp(0, 300)),
                          duration: 300.ms)
                      .slideX(begin: 0.04, end: 0),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class _EntryTile extends StatelessWidget {
  final AuditLogEntry entry;
  const _EntryTile({required this.entry});

  IconData _iconFor(String action) {
    if (action.contains('delete') || action.contains('void')) {
      return Icons.delete_outline;
    }
    if (action.contains('create') || action.contains('add')) {
      return Icons.add_circle_outline;
    }
    if (action.contains('update') || action.contains('edit')) {
      return Icons.edit_outlined;
    }
    if (action.contains('login') || action.contains('logout')) {
      return Icons.login_outlined;
    }
    if (action.contains('payment')) return Icons.payments_outlined;
    return Icons.history_outlined;
  }

  Color _colorFor(BuildContext context, String action) {
    final cs = Theme.of(context).colorScheme;
    if (action.contains('delete') || action.contains('void')) return cs.error;
    if (action.contains('create') || action.contains('add')) {
      return Colors.green;
    }
    return cs.primary;
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final color = _colorFor(context, entry.action.toLowerCase());

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: color.withOpacity(0.12),
          child: Icon(_iconFor(entry.action.toLowerCase()),
              color: color, size: 20),
        ),
        title: Text(
          entry.action,
          style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (entry.description != null)
              Text(entry.description!,
                  style: TextStyle(
                      fontSize: 12, color: cs.onSurfaceVariant),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Row(children: [
              if (entry.performedBy != null) ...[
                Icon(Icons.person_outline,
                    size: 12, color: cs.onSurfaceVariant),
                const SizedBox(width: 3),
                Text(entry.performedBy!,
                    style: TextStyle(
                        fontSize: 11, color: cs.onSurfaceVariant)),
                const SizedBox(width: 8),
              ],
              Icon(Icons.access_time,
                  size: 12, color: cs.onSurfaceVariant),
              const SizedBox(width: 3),
              Text(
                DateFormat('dd MMM yy, HH:mm')
                    .format(entry.createdAt),
                style: TextStyle(
                    fontSize: 11, color: cs.onSurfaceVariant),
              ),
            ]),
          ],
        ),
        isThreeLine: entry.description != null,
      ),
    );
  }
}
