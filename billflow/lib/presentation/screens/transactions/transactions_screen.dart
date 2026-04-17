import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../providers/transaction_provider.dart';
import '../../widgets/common/error_view.dart';
import '../../widgets/common/loading_overlay.dart';
import '../../widgets/transactions/transaction_tile.dart';

class TransactionsScreen extends ConsumerWidget {
  const TransactionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final txnAsync = ref.watch(transactionsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales Log'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: () =>
                ref.read(transactionsProvider.notifier).refresh(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () =>
            ref.read(transactionsProvider.notifier).refresh(),
        child: txnAsync.when(
          loading: () => const LoadingOverlay(),
          error: (e, _) => ErrorView(
              message: e.toString(),
              onRetry: () =>
                  ref.read(transactionsProvider.notifier).refresh()),
          data: (txns) => txns.isEmpty
              ? const Center(child: Text('No transactions yet'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: txns.length,
                  itemBuilder: (ctx, i) => TransactionTile(
                    transaction: txns[i],
                    onTap: () => context.push(
                        '/transactions/${txns[i].id}',
                        extra: txns[i]),
                  ),
                ),
        ),
      ),
    );
  }
}
