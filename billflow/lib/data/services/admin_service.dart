import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/storage/secure_storage.dart';
import '../models/admin_model.dart';

// Dedicated Dio for admin - never shares the shop token
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
      // Backend returns only { token } - decode email from JWT payload
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

  // ── Plans ─────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getPlans() async {
    final res = await _dio.get(ApiConstants.adminPlans, options: await _authOpts());
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createPlan(Map<String, dynamic> data) async {
    final res = await _dio.post(ApiConstants.adminPlans, data: data, options: await _authOpts());
    return res.data as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updatePlan(int id, Map<String, dynamic> data) async {
    final res = await _dio.put(ApiConstants.adminPlanById(id), data: data, options: await _authOpts());
    return res.data as Map<String, dynamic>;
  }

  Future<void> deletePlan(int id) async {
    await _dio.delete(ApiConstants.adminPlanById(id), options: await _authOpts());
  }

  // ── Push notification dispatch ────────────────────────────────
  // target: 'all' | 'active' | 'trial' | 'expired' | 'specific'
  Future<Map<String, dynamic>> dispatchNotification({
    required String title,
    required String body,
    String target = 'all',
    int? shopId,
  }) async {
    final data = <String, dynamic>{'title': title, 'body': body, 'target': target};
    if (shopId != null) data['shop_id'] = shopId;
    final res = await _dio.post(
      ApiConstants.adminNotificationsDispatch,
      data: data,
      options: await _authOpts(),
    );
    return res.data as Map<String, dynamic>;
  }

  // ── Commission management ─────────────────────────────────────
  Future<List<AdminCommission>> getCommissions({String? status, int? agentId}) async {
    final params = <String, dynamic>{};
    if (status != null) params['status'] = status;
    if (agentId != null) params['agent_id'] = agentId;
    final res = await _dio.get(ApiConstants.adminAgentCommissions,
        queryParameters: params, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminCommission.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> approveCommissions(List<int> ids) async {
    await _dio.put(ApiConstants.adminCommissionsApprove,
        data: {'commission_ids': ids}, options: await _authOpts());
  }

  Future<List<Map<String, dynamic>>> getPayoutLogs() async {
    final res = await _dio.get(ApiConstants.adminPayoutLogs, options: await _authOpts());
    return (res.data as List).cast<Map<String, dynamic>>();
  }

  // ── Agent registration management ────────────────────────────
  Future<List<AgentRegistration>> getPendingRegistrations() async {
    final res = await _dio.get(ApiConstants.adminAgentRegistrations, options: await _authOpts());
    return (res.data as List)
        .map((e) => AgentRegistration.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> approveAgent(int id) async {
    await _dio.put(ApiConstants.adminAgentApprove(id), options: await _authOpts());
  }

  Future<void> rejectAgent(int id, String reason) async {
    await _dio.put(ApiConstants.adminAgentReject(id),
        data: {'reason': reason}, options: await _authOpts());
  }

  Future<Map<String, dynamic>> getAgentDocuments(int id) async {
    final res = await _dio.get(ApiConstants.adminAgentDocuments(id), options: await _authOpts());
    return res.data as Map<String, dynamic>;
  }

  Future<String> generateInviteToken() async {
    final res = await _dio.post(ApiConstants.adminGenerateInvite, options: await _authOpts());
    return (res.data['invite_url'] ?? res.data['token'] ?? '').toString();
  }

  // ── Shop self-payments ────────────────────────────────────────
  Future<List<AdminShopPayment>> getShopPayments({String? status}) async {
    final params = <String, dynamic>{};
    if (status != null) params['status'] = status;
    final res = await _dio.get(ApiConstants.adminShopPayments,
        queryParameters: params, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminShopPayment.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> verifyShopPayment(int id) async {
    await _dio.put(ApiConstants.adminShopPaymentVerify(id), options: await _authOpts());
  }

  Future<void> rejectShopPayment(int id, String reason) async {
    await _dio.put(ApiConstants.adminShopPaymentReject(id),
        data: {'admin_note': reason}, options: await _authOpts());
  }

  // ── Shop users management ─────────────────────────────────────
  Future<List<ShopUser>> getShopUsers(int shopId) async {
    final res = await _dio.get(ApiConstants.adminShopUsers(shopId), options: await _authOpts());
    return (res.data as List)
        .map((e) => ShopUser.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> deleteShopUser(int shopId, int userId) async {
    await _dio.delete(ApiConstants.adminShopUserById(shopId, userId), options: await _authOpts());
  }

  // ── Delete shop ───────────────────────────────────────────────
  Future<void> deleteShop(int shopId) async {
    await _dio.delete(ApiConstants.adminShopById(shopId), options: await _authOpts());
  }

  // ── Financial summary ─────────────────────────────────────────
  Future<Map<String, dynamic>> getFinancialSummary() async {
    final res = await _dio.get(ApiConstants.adminFinancialSummary, options: await _authOpts());
    return res.data as Map<String, dynamic>;
  }

  // ── Admin notifications ───────────────────────────────────────
  Future<List<AdminNotification>> getAdminNotifications() async {
    final res = await _dio.get(ApiConstants.adminNotifications, options: await _authOpts());
    return (res.data as List)
        .map((e) => AdminNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markAllAdminNotificationsRead() async {
    await _dio.put(ApiConstants.adminNotificationsReadAll, options: await _authOpts());
  }

  Future<void> markAdminNotificationRead(int id) async {
    await _dio.put(ApiConstants.adminNotificationRead(id), options: await _authOpts());
  }
}

final adminServiceProvider = Provider<AdminService>((ref) => AdminService(
      ref.watch(adminDioProvider),
      ref.watch(secureStorageProvider),
    ));
