import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/carwash_model.dart';
import '../data/services/carwash_service.dart';

final carwashDashboardProvider =
    FutureProvider.autoDispose<CarwashDashboard>((ref) async {
  return ref.watch(carwashApiServiceProvider).getDashboard();
});

final carwashServicesProvider =
    FutureProvider.autoDispose<List<WashService>>((ref) async {
  return ref.watch(carwashApiServiceProvider).listServices();
});

// Filter state for job list
final carwashJobStatusFilterProvider = StateProvider<String?>((ref) => null);

final carwashJobsProvider =
    FutureProvider.autoDispose<CarwashJobListResult>((ref) async {
  final status = ref.watch(carwashJobStatusFilterProvider);
  return ref.watch(carwashApiServiceProvider).listJobs(status: status);
});

final carwashJobDetailProvider =
    FutureProvider.autoDispose.family<CarwashJob, int>(
  (ref, id) => ref.watch(carwashApiServiceProvider).getJob(id),
);
