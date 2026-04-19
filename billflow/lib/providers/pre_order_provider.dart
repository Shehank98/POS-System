import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/pre_order_model.dart';
import '../data/services/pre_order_service.dart';

class PreOrderNotifier
    extends AutoDisposeAsyncNotifier<List<PreOrderModel>> {
  String? _statusFilter;

  @override
  Future<List<PreOrderModel>> build() =>
      ref.read(preOrderServiceProvider).listOrders(status: _statusFilter);

  Future<void> refresh({String? status}) async {
    _statusFilter = status;
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(preOrderServiceProvider).listOrders(status: status));
  }

  Future<void> updateStatus(int id, String status) async {
    await ref.read(preOrderServiceProvider).updateStatus(id, status);
    refresh(status: _statusFilter);
  }

  Future<void> markAsPaid(int id) async {
    await ref.read(preOrderServiceProvider).markAsPaid(id);
    refresh(status: _statusFilter);
  }
}

final preOrderProvider = AsyncNotifierProvider.autoDispose<PreOrderNotifier,
    List<PreOrderModel>>(PreOrderNotifier.new);
