import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/user_model.dart';
import '../data/services/auth_service.dart';
import '../data/services/biometric_service.dart';
import 'biometric_provider.dart';

class AuthNotifier extends AsyncNotifier<UserModel?> {
  @override
  Future<UserModel?> build() async {
    final user = await ref.read(authServiceProvider).tryAutoLogin();
    if (user != null) {
      final biometricAvailable =
          await ref.read(biometricServiceProvider).isAvailable();
      if (biometricAvailable) {
        ref.read(biometricGateProvider.notifier).state = true;
      }
    }
    return user;
  }

  Future<void> login(
      String username, String password, String shopId) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(authServiceProvider).login(username, password, shopId));
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
