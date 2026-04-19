import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/services/auth_service.dart';
import '../data/services/biometric_service.dart';
import '../data/services/push_notification_service.dart';
import '../core/storage/secure_storage.dart';
import 'biometric_provider.dart';

class AuthNotifier extends AsyncNotifier<UserModel?> {
  @override
  Future<UserModel?> build() async {
    final user = await ref.read(authServiceProvider).tryAutoLogin();
    if (user != null) {
      final storage = ref.read(secureStorageProvider);
      final biometricEnabled = await storage.readBiometricEnabled();
      if (biometricEnabled) {
        final available = await ref.read(biometricServiceProvider).isAvailable();
        if (available) {
          ref.read(biometricGateProvider.notifier).state = true;
        }
      }
      try {
        PushNotificationService.subscribeToTopic('shop_${user.shopId}_preorders');
        PushNotificationService.subscribeToTopic('shop_${user.shopId}_low_stock');
      } catch (_) {}
    }
    return user;
  }

  Future<void> login(String username, String password, String shopId) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(authServiceProvider).login(username, password, shopId));
    _subscribeToShopTopics();
  }

  void _subscribeToShopTopics() {
    final user = state.valueOrNull;
    if (user == null) return;
    try {
      PushNotificationService.subscribeToTopic(
          'shop_${user.shopId}_preorders');
      PushNotificationService.subscribeToTopic(
          'shop_${user.shopId}_low_stock');
    } catch (_) {}
  }

  Future<void> logout() async {
    await ref.read(authServiceProvider).logout();
    ref.read(biometricGateProvider.notifier).state = false;
    state = const AsyncData(null);
  }

  UserModel? get currentUser => state.valueOrNull;
  bool get isLoggedIn => state.valueOrNull != null;
}

final authProvider =
    AsyncNotifierProvider<AuthNotifier, UserModel?>(AuthNotifier.new);
