import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/services/auth_service.dart';
import 'auth_provider.dart';

// ── Periodic feature-flag refresh ────────────────────────────────────────────
// Calls /auth/me every 5 minutes so admin-panel ON/OFF changes propagate
// to the mobile app instantly, without reinstall or re-login.
class FeatureFlagRefresher extends AsyncNotifier<void> {
  Timer? _timer;

  @override
  Future<void> build() async {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(minutes: 5), (_) => _refresh());
    ref.onDispose(() => _timer?.cancel());
  }

  Future<void> _refresh() async {
    try {
      final user = await ref.read(authServiceProvider).getMe();
      ref.read(authProvider.notifier).state = AsyncData(user);
    } catch (_) {
      // Silent fail — keep using cached flags until next successful refresh
    }
  }

  Future<void> refreshNow() => _refresh();
}

final featureFlagRefresherProvider =
    AsyncNotifierProvider<FeatureFlagRefresher, void>(FeatureFlagRefresher.new);

// ── Feature flag providers — one per admin-panel flag ─────────────────────────
// These are read-only derived views of the user object in authProvider.
// The admin panel maps exactly to these field names in the shops table.

// Barcode Scanner — Hardware/camera barcode at POS
final barcodeEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.barcodeEnabled ?? false);

// POS Core
final refundsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.refundsEnabled ?? true);

final voidEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.voidEnabled ?? true);

final offlineEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.offlineEnabled ?? true);

// Modules
final preOrdersEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.preOrdersEnabled ?? true);

final customersEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.customersEnabled ?? true);

final loyaltyEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.loyaltyEnabled ?? true);

final reportsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.reportsEnabled ?? true);

final analyticsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.analyticsEnabled ?? true);

// Clothing Shops Only
final exchangesEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.exchangesEnabled ?? true);

final branchesEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.branchesEnabled ?? true);

// ── Shop-type helpers ─────────────────────────────────────────────────────────
final shopTypeProvider = Provider<String>((ref) =>
    ref.watch(authProvider).valueOrNull?.shopType ?? 'retail');

final isClothingShopProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.isClothingShop ?? false);

// ── Subscription gate ─────────────────────────────────────────────────────────
// true = account has full access; false = locked (expired beyond grace period)
final isSubscriptionActiveProvider = Provider<bool>((ref) {
  final user = ref.watch(authProvider).valueOrNull;
  if (user == null) return false;
  return !user.readOnly;
});
