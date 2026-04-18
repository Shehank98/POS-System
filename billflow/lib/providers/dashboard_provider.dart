import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/dashboard_model.dart';
import '../data/services/dashboard_service.dart';

final dashboardTodayProvider =
    FutureProvider.autoDispose<DashboardToday>((ref) {
  return ref.watch(dashboardServiceProvider).getToday();
});

final dashboardWeekProvider =
    FutureProvider.autoDispose<List<DailyPoint>>((ref) {
  return ref.watch(dashboardServiceProvider).getWeek();
});

final dashboardMonthProvider =
    FutureProvider.autoDispose<List<DailyPoint>>((ref) {
  return ref.watch(dashboardServiceProvider).getMonth();
});

final lowStockProvider =
    FutureProvider.autoDispose<List<LowStockProduct>>((ref) {
  return ref.watch(dashboardServiceProvider).getLowStock();
});

// Analytics date range (ISO date strings)
class AnalyticsRange {
  final String from;
  final String to;
  final String label;
  const AnalyticsRange(
      {required this.from, required this.to, required this.label});
}

final analyticsRangeProvider =
    StateProvider<AnalyticsRange>((ref) => _thisMonth());

AnalyticsRange _thisMonth() {
  final now = DateTime.now().toUtc();
  final from = DateTime.utc(now.year, now.month, 1);
  return AnalyticsRange(
    from: _fmt(from),
    to: _fmt(now),
    label: 'This Month',
  );
}

String _fmt(DateTime d) =>
    '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

final analyticsProvider =
    FutureProvider.autoDispose<AnalyticsResult>((ref) {
  final range = ref.watch(analyticsRangeProvider);
  return ref
      .watch(dashboardServiceProvider)
      .getAnalytics(from: range.from, to: range.to);
});
