import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/customer_model.dart';
import '../data/services/customer_service.dart';

final topCustomersProvider =
    FutureProvider.autoDispose<List<TopCustomer>>((ref) {
  return ref.watch(customerServiceProvider).getTop();
});

final customerPhoneQueryProvider = StateProvider<String>((ref) => '');

final customerInsightsProvider =
    FutureProvider.autoDispose.family<CustomerInsights, String>((ref, phone) {
  return ref.watch(customerServiceProvider).getInsights(phone);
});
