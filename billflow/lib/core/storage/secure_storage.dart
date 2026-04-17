import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  static const _tokenKey = 'pos_token';
  static const _userKey = 'pos_user_json';

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

  Future<void> deleteAll() => _storage.deleteAll();
}

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());
