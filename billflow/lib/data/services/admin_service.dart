import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/storage/secure_storage.dart';
import '../models/admin_model.dart';

// Dedicated Dio for admin — never shares the shop token
final adminDioProvider = Provider<Dio>((ref) => Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    )));

class AdminService {
  final Dio _dio;
  final SecureStorage _storage;

  AdminService(this._dio, this._storage);

  Future<Options> _authOpts() async {
    final t = await _storage.readAdminToken();
    return Options(headers: {'Authorization': 'Bearer $t'});
  }

  // ── Auth ──────────────────────────────────────────────────────────
  Future<AdminModel> login(String email, String password) async {
    try {
      final res = await _dio.post(ApiConstants.adminLogin, data: {
        'email':    email.trim().toLowerCase(),
        'password': password,
      });
      final token = res.data['token'] as String;
      // Backend returns only { token } — decode email from JWT payload
      final admin = AdminModel(email: email.trim().toLowerCase(), role: 'superadmin');
      await _storage.saveAdminToken(token);
      await _storage.saveAdminUser(jsonEncode(admin.toJson()));
      return admin;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<AdminModel?> tryAutoLogin() async {
    final token = await _storage.readAdminToken();
    if (token == null) return null;
    final cached = await _storage.readAdminUser();
    if (cached != null) {
      return AdminModel.fromJson(jsonDecode(cached) as Map<String, dynamic>);
    }
    return null;
  }

  Future<void> logout() => _storage.deleteAdminSession();

  // ── Dashboard ─────────────────────────────────────────────────────
  Future<AdminDashboardStats> getDashboard() async {
    final res = await _dio.get(ApiConstants.adminDashboard, options: await _authOpts());
    return AdminDashboardStats.fromJson(res.data as Map<String, dynamic>);
  }

  // ── Shops ─────────────────────────────────────────────────────────
  Future<List<AdminShop>> getShops({String? status, String? search}) async {
    final params = <String, dynamic>{};
    if (status != null) params['status'] = status;
    if (search != null && search.isNotEmpty) params['search'] = search;
    final res = await _dio.get(ApiConstants.adminShops,
        queryParameters: params, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminShop.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AdminShop> getShop(int id) async {
    final res = await _dio.get(ApiConstants.adminShopById(id), options: await _authOpts());
    return AdminShop.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AdminShop> updateShop(int id, Map<String, dynamic> data) async {
    final res = await _dio.put(ApiConstants.adminShopById(id),
        data: data, options: await _authOpts());
    return AdminShop.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> updateSubscription(int shopId, Map<String, dynamic> data) async {
    await _dio.put(ApiConstants.adminShopSubscription(shopId),
        data: data, options: await _authOpts());
  }

  // ── Payments ──────────────────────────────────────────────────────
  Future<List<AdminPaymentSubmission>> getPendingPayments() async {
    final res = await _dio.get(ApiConstants.adminPendingPayments, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminPaymentSubmission.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<AdminPaymentSubmission>> getAllPayments() async {
    final res = await _dio.get(ApiConstants.adminAllPayments, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminPaymentSubmission.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> verifyPayment(int id) async {
    await _dio.put(ApiConstants.adminVerifyPayment(id), options: await _authOpts());
  }

  Future<void> rejectPayment(int id, String reason) async {
    await _dio.put(ApiConstants.adminRejectPayment(id),
        data: {'admin_note': reason}, options: await _authOpts());
  }

  // ── Agents ────────────────────────────────────────────────────────
  Future<List<AdminAgent>> getAgents() async {
    final res = await _dio.get(ApiConstants.adminAgents, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminAgent.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<AdminAgent> createAgent(Map<String, dynamic> data) async {
    final res = await _dio.post(ApiConstants.adminAgents,
        data: data, options: await _authOpts());
    return AdminAgent.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AdminAgent> updateAgent(int id, Map<String, dynamic> data) async {
    final res = await _dio.put(ApiConstants.adminAgentById(id),
        data: data, options: await _authOpts());
    return AdminAgent.fromJson(res.data as Map<String, dynamic>);
  }

  Future<void> payoutCommissions(List<int> commissionIds) async {
    await _dio.put(ApiConstants.adminAgentPayout,
        data: {'commission_ids': commissionIds}, options: await _authOpts());
  }
}

final adminServiceProvider = Provider<AdminService>((ref) => AdminService(
      ref.watch(adminDioProvider),
      ref.watch(secureStorageProvider),
    ));
