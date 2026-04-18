import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/services/auth_service.dart';
import 'auth_provider.dart';

// ── Periodic feature-flag refresh ────────────────────────────────────────────
// Calls /auth/me every 5 minutes so that admin-panel flag changes propagate
// to the mobile app without requiring a reinstall or manual re-login.
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

// ── Convenience selectors (read-only, derived from authProvider) ──────────────
extension FeatureFlags on UserModelFeatureAccessor {
  static bool posEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.posEnabled ?? true;
  static bool productsEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.productsEnabled ?? true;
  static bool reportsEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.reportsEnabled ?? true;
  static bool notificationsEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.notificationsEnabled ?? true;
  static bool inventoryEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.inventoryEnabled ?? true;
  static bool preOrdersEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.preOrdersEnabled ?? true;
  static bool customersEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.customersEnabled ?? true;
  static bool analyticsEnabled(WidgetRef ref) =>
      ref.watch(authProvider).valueOrNull?.analyticsEnabled ?? true;
}

// Dummy class required for the extension receiver
class UserModelFeatureAccessor {}

// Simple provider-based selectors for use in ConsumerWidget/ConsumerState
final posEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.posEnabled ?? true);

final productsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.productsEnabled ?? true);

final reportsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.reportsEnabled ?? true);

final notificationsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.notificationsEnabled ?? true);

final inventoryEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.inventoryEnabled ?? true);

final preOrdersEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.preOrdersEnabled ?? true);

final customersEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.customersEnabled ?? true);

final analyticsEnabledProvider = Provider<bool>((ref) =>
    ref.watch(authProvider).valueOrNull?.analyticsEnabled ?? true);

final isSubscriptionActiveProvider = Provider<bool>((ref) {
  final user = ref.watch(authProvider).valueOrNull;
  if (user == null) return false;
  return !user.readOnly;
});
