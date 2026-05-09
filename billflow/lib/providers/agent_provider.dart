import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/agent_model.dart';
import '../data/services/agent_service.dart';

final agentDashboardProvider = FutureProvider.autoDispose<AgentDashboard>((ref) {
  return ref.read(agentServiceProvider).getDashboard();
});

final agentCustomersProvider = FutureProvider.autoDispose<List<AgentCustomer>>((ref) {
  return ref.read(agentServiceProvider).getCustomers();
});

final agentPaymentsProvider = FutureProvider.autoDispose<List<AgentPaymentSubmission>>((ref) {
  return ref.read(agentServiceProvider).getPayments();
});

final agentCommissionsProvider = FutureProvider.autoDispose<List<AgentCommission>>((ref) {
  return ref.read(agentServiceProvider).getCommissions();
});

final agentRenewalsProvider = FutureProvider.autoDispose<List<AgentCustomer>>((ref) {
  return ref.read(agentServiceProvider).getRenewals();
});

final agentNotificationsProvider = FutureProvider.autoDispose<List<AgentNotification>>((ref) {
  return ref.read(agentServiceProvider).getNotifications();
});

final agentDepositHistoryProvider = FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.read(agentServiceProvider).getDepositHistory();
});
