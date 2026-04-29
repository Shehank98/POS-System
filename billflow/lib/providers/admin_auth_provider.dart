import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/admin_model.dart';
import '../data/services/admin_service.dart';

class AdminAuthNotifier extends AsyncNotifier<AdminModel?> {
  @override
  Future<AdminModel?> build() async {
    return ref.read(adminServiceProvider).tryAutoLogin();
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(adminServiceProvider).login(email, password));
  }

  Future<void> logout() async {
    await ref.read(adminServiceProvider).logout();
    state = const AsyncData(null);
  }

  AdminModel? get currentAdmin => state.valueOrNull;
  bool get isLoggedIn => state.valueOrNull != null;
}

final adminAuthProvider =
    AsyncNotifierProvider<AdminAuthNotifier, AdminModel?>(AdminAuthNotifier.new);
