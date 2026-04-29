import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/constants/api_constants.dart';
import '../../core/network/api_exception.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/secure_storage.dart';
import '../models/agent_model.dart';

class AgentService {
  final Dio _dio;
  final SecureStorage _storage;

  AgentService(this._dio, this._storage);

  Future<AgentModel> login(String email, String password) async {
    try {
      final response = await _dio.post(ApiConstants.agentLogin, data: {
        'email':    email.trim().toLowerCase(),
        'password': password,
      });
      final token = response.data['token'] as String;
      final agent = AgentModel.fromJson(response.data['agent'] as Map<String, dynamic>);
      await _storage.saveAgentToken(token);
      await _storage.saveAgentUser(jsonEncode(agent.toJson()));
      return agent;
    } on DioException catch (e) {
      throw ApiException.fromDioException(e);
    }
  }

  Future<AgentModel?> tryAutoLogin() async {
    final token = await _storage.readAgentToken();
    if (token == null) return null;
    try {
      final response = await _dio.get(
        ApiConstants.agentMe,
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );
      final agent = AgentModel.fromJson(response.data as Map<String, dynamic>);
      await _storage.saveAgentUser(jsonEncode(agent.toJson()));
      return agent;
    } catch (_) {
      final cached = await _storage.readAgentUser();
      if (cached != null) {
        return AgentModel.fromJson(jsonDecode(cached) as Map<String, dynamic>);
      }
      return null;
    }
  }

  Future<void> logout() => _storage.deleteAgentSession();

  Future<String?> _token() => _storage.readAgentToken();

  Future<Options> _authOpts() async {
    final t = await _token();
    return Options(headers: {'Authorization': 'Bearer $t'});
  }

  Future<AgentDashboard> getDashboard() async {
    final res = await _dio.get(ApiConstants.agentDashboard, options: await _authOpts());
    return AgentDashboard.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<AgentCustomer>> getCustomers() async {
    final res = await _dio.get(ApiConstants.agentCustomers, options: await _authOpts());
    return (res.data as List).map((e) => AgentCustomer.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AgentCustomer> onboardCustomer(Map<String, dynamic> data) async {
    final res = await _dio.post(ApiConstants.agentCustomers, data: data, options: await _authOpts());
    return AgentCustomer.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AgentCustomer> editCustomer(int shopId, Map<String, dynamic> data) async {
    final res = await _dio.put(ApiConstants.agentEditCustomer(shopId), data: data, options: await _authOpts());
    return AgentCustomer.fromJson(res.data as Map<String, dynamic>);
  }

  Future<AgentPaymentSubmission> submitPayment(Map<String, dynamic> data) async {
    final res = await _dio.post(ApiConstants.agentPayments, data: data, options: await _authOpts());
    return AgentPaymentSubmission.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<AgentPaymentSubmission>> getPayments() async {
    final res = await _dio.get(ApiConstants.agentPayments, options: await _authOpts());
    return (res.data as List).map((e) => AgentPaymentSubmission.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<AgentCommission>> getCommissions() async {
    final res = await _dio.get(ApiConstants.agentCommissions, options: await _authOpts());
    return (res.data as List).map((e) => AgentCommission.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<AgentModel> updateBankDetails(Map<String, dynamic> data) async {
    final res = await _dio.put(ApiConstants.agentBankDetails, data: data, options: await _authOpts());
    return AgentModel.fromJson(res.data as Map<String, dynamic>);
  }

  Future<List<AgentCustomer>> getRenewals() async {
    final res = await _dio.get(ApiConstants.agentRenewals, options: await _authOpts());
    return (res.data as List).map((e) => AgentCustomer.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final agentServiceProvider = Provider<AgentService>((ref) => AgentService(
      ref.watch(dioProvider),
      ref.watch(secureStorageProvider),
    ));
