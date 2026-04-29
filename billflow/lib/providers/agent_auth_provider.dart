import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/models/agent_model.dart';
import '../data/services/agent_service.dart';

class AgentAuthNotifier extends AsyncNotifier<AgentModel?> {
  @override
  Future<AgentModel?> build() async {
    return ref.read(agentServiceProvider).tryAutoLogin();
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(
        () => ref.read(agentServiceProvider).login(email, password));
  }

  Future<void> logout() async {
    await ref.read(agentServiceProvider).logout();
    state = const AsyncData(null);
  }

  AgentModel? get currentAgent => state.valueOrNull;
  bool get isLoggedIn => state.valueOrNull != null;
}

final agentAuthProvider =
    AsyncNotifierProvider<AgentAuthNotifier, AgentModel?>(AgentAuthNotifier.new);
