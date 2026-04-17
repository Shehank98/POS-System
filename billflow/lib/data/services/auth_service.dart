import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/secure_storage.dart';
import '../models/user_model.dart';

class AuthService {
  final Dio _dio;
  final SecureStorage _storage;

  AuthService(this._dio, this._storage);

  Future<UserModel> login(
      String username, String password, String shopId) async {
    try {
      final response = await _dio.post(ApiConstants.login, data: {
        'username': username,
        'password': password,
        'shop_id': int.tryParse(shopId) ?? shopId,
      });
      final token = response.data['token'] as String;
      final user = UserModel.fromJson(
          response.data['user'] as Map<String, dynamic>);
      await _storage.saveToken(token);
      await _storage.saveUser(jsonEncode(user.toJson()));
      return user;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<UserModel> getMe() async {
    try {
      final response = await _dio.get(ApiConstants.me);
      final user = UserModel.fromJson(
          (response.data['user'] ?? response.data) as Map<String, dynamic>);
      await _storage.saveUser(jsonEncode(user.toJson()));
      return user;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<UserModel?> tryAutoLogin() async {
    final token = await _storage.readToken();
    if (token == null) return null;
    try {
      return await getMe();
    } catch (_) {
      // Try cached user on network error
      final cached = await _storage.readUser();
      if (cached != null) {
        return UserModel.fromJson(
            jsonDecode(cached) as Map<String, dynamic>);
      }
      return null;
    }
  }

  Future<void> logout() => _storage.deleteAll();
}

final authServiceProvider = Provider<AuthService>((ref) => AuthService(
      ref.watch(dioProvider),
      ref.watch(secureStorageProvider),
    ));
