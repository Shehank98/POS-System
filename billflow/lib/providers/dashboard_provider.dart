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
