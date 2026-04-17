import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../core/utils/date_formatter.dart';
import '../data/models/report_model.dart';
import '../data/models/transaction_model.dart';
import '../data/services/report_service.dart';

final reportStartDateProvider = StateProvider<DateTime>(
    (ref) => DateTime.now().subtract(const Duration(days: 30)));

final reportEndDateProvider =
    StateProvider<DateTime>((ref) => DateTime.now());

final salesSummaryProvider =
    FutureProvider.autoDispose<TransactionSummary>((ref) {
  final start = ref.watch(reportStartDateProvider);
  final end = ref.watch(reportEndDateProvider);
  return ref.watch(reportServiceProvider).getSalesSummary(
        startDate: toApiDate(start),
        endDate: toApiDate(end),
      );
});

final taxReportProvider = FutureProvider.autoDispose<TaxReport>((ref) {
  final start = ref.watch(reportStartDateProvider);
  final end = ref.watch(reportEndDateProvider);
  return ref.watch(reportServiceProvider).getTaxReport(
        startDate: toApiDate(start),
        endDate: toApiDate(end),
      );
});
