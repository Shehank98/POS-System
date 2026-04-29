import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _tokenKey      = 'pos_token';
  static const _userKey       = 'pos_user_json';
  static const _identifierKey = 'pos_last_identifier';

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  Future<void> saveToken(String token) =>
      _storage.write(key: _tokenKey, value: token);

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> deleteToken() => _storage.delete(key: _tokenKey);

  Future<void> saveUser(String userJson) =>
      _storage.write(key: _userKey, value: userJson);

  Future<String?> readUser() => _storage.read(key: _userKey);

  Future<void> saveLastLogin(String identifier) =>
      _storage.write(key: _identifierKey, value: identifier);

  Future<Map<String, String?>> readLastLogin() async {
    return {
      'identifier': await _storage.read(key: _identifierKey),
    };
  }

  static const _biometricKey = 'pos_biometric_enabled';

  Future<void> saveBiometricEnabled(bool v) =>
      _storage.write(key: _biometricKey, value: v.toString());

  Future<bool> readBiometricEnabled() async =>
      await _storage.read(key: _biometricKey) == 'true';

  // ── Sales Agent ───────────────────────────────────────────────
  static const _agentTokenKey = 'agent_token';
  static const _agentUserKey  = 'agent_user_json';

  Future<void> saveAgentToken(String token) =>
      _storage.write(key: _agentTokenKey, value: token);

  Future<String?> readAgentToken() => _storage.read(key: _agentTokenKey);

  Future<void> saveAgentUser(String json) =>
      _storage.write(key: _agentUserKey, value: json);

  Future<String?> readAgentUser() => _storage.read(key: _agentUserKey);

  Future<void> deleteAgentSession() async {
    await _storage.delete(key: _agentTokenKey);
    await _storage.delete(key: _agentUserKey);
  }

  // ── Admin ─────────────────────────────────────────────────────────
  static const _adminTokenKey = 'admin_token';
  static const _adminUserKey  = 'admin_user_json';

  Future<void> saveAdminToken(String token) =>
      _storage.write(key: _adminTokenKey, value: token);

  Future<String?> readAdminToken() => _storage.read(key: _adminTokenKey);

  Future<void> saveAdminUser(String json) =>
      _storage.write(key: _adminUserKey, value: json);

  Future<String?> readAdminUser() => _storage.read(key: _adminUserKey);

  Future<void> deleteAdminSession() async {
    await _storage.delete(key: _adminTokenKey);
    await _storage.delete(key: _adminUserKey);
  }

  Future<void> deleteAll() => _storage.deleteAll();
}

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());
