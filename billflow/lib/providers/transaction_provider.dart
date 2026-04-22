import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/transaction_model.dart';
import '../data/services/transaction_service.dart';
import 'cart_provider.dart';

class TransactionNotifier extends AsyncNotifier<List<TransactionModel>> {
  @override
  Future<List<TransactionModel>> build() => _fetch();

  Future<List<TransactionModel>> _fetch() async {
    final result =
        await ref.read(transactionServiceProvider).listTransactions();
    return result.transactions;
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_fetch);
  }

  Future<TransactionModel> submitSale(CartState cart) async {
    final txn = await ref
        .read(transactionServiceProvider)
        .createTransaction(
          items: cart.items,
          paymentMethod: cart.paymentMethod,
          discountAmount: cart.orderDiscount,
          customerPhone: cart.customerPhone,
        );
    state = AsyncData([txn, ...state.valueOrNull ?? []]);
    ref.read(cartProvider.notifier).clearCart();
    return txn;
  }

  Future<TransactionModel> submitQRSale(CartState cart, String qrReference) async {
    final txn = await ref
        .read(transactionServiceProvider)
        .createTransaction(
          items: cart.items,
          paymentMethod: 'qr',
          discountAmount: cart.orderDiscount,
          customerPhone: cart.customerPhone,
          qrReference: qrReference,
        );
    state = AsyncData([txn, ...state.valueOrNull ?? []]);
    ref.read(cartProvider.notifier).clearCart();
    return txn;
  }

  Future<void> voidTransaction(int id) async {
    final updated =
        await ref.read(transactionServiceProvider).voidTransaction(id);
    state = AsyncData(state.valueOrNull
            ?.map((t) => t.id == id ? updated : t)
            .toList() ??
        []);
  }
}

final transactionsProvider =
    AsyncNotifierProvider<TransactionNotifier, List<TransactionModel>>(
        TransactionNotifier.new);
