import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _tokenKey = 'pos_token';
  static const _userKey = 'pos_user_json';
  static const _shopIdKey = 'pos_last_shop_id';
  static const _usernameKey = 'pos_last_username';

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

  Future<void> saveLastLogin(String shopId, String username) async {
    await _storage.write(key: _shopIdKey, value: shopId);
    await _storage.write(key: _usernameKey, value: username);
  }

  Future<Map<String, String?>> readLastLogin() async {
    return {
      'shopId': await _storage.read(key: _shopIdKey),
      'username': await _storage.read(key: _usernameKey),
    };
  }

  Future<void> deleteAll() => _storage.deleteAll();
}

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());
