class AdminModel {
  final String email;
  final String role;

  const AdminModel({required this.email, required this.role});

  factory AdminModel.fromJson(Map<String, dynamic> json) => AdminModel(
        email: json['email'] as String,
        role:  json['role'] as String? ?? 'superadmin',
      );

  Map<String, dynamic> toJson() => {'email': email, 'role': role};
}

// ── Admin dashboard summary ───────────────────────────────────────────
class AdminDashboardStats {
  final int totalShops;
  final int activeShops;
  final int trialShops;
  final int expiredShops;
  final int totalAgents;
  final int pendingPayments;
  final double mrr;
  final double totalRevenue;

  const AdminDashboardStats({
    required this.totalShops,
    required this.activeShops,
    required this.trialShops,
    required this.expiredShops,
    required this.totalAgents,
    required this.pendingPayments,
    required this.mrr,
    required this.totalRevenue,
  });

  factory AdminDashboardStats.fromJson(Map<String, dynamic> json) =>
      AdminDashboardStats(
        totalShops:      (json['total_shops']      as num?)?.toInt() ?? 0,
        activeShops:     (json['active_shops']     as num?)?.toInt() ?? 0,
        trialShops:      (json['trial_shops']      as num?)?.toInt() ?? 0,
        expiredShops:    (json['expired_shops']    as num?)?.toInt() ?? 0,
        totalAgents:     (json['total_agents']     as num?)?.toInt() ?? 0,
        pendingPayments: (json['pending_payments'] as num?)?.toInt() ?? 0,
        mrr:             double.parse((json['mrr']           ?? 0).toString()),
        totalRevenue:    double.parse((json['total_revenue'] ?? 0).toString()),
      );
}

// ── Shop summary used in admin screens ───────────────────────────────
class AdminShop {
  final int id;
  final String name;
  final String ownerName;
  final String email;
  final String? phone;
  final String? address;
  final String subscriptionStatus;
  final DateTime? subscriptionEndDate;
  final String? planName;
  final String shopType;
  final bool isCarServiceShop;
  final DateTime createdAt;
  final int? onboardedByAgentId;
  final String? agentName;
  final int userCount;
  final int productCount;
  final int transactionCount;

  const AdminShop({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.email,
    this.phone,
    this.address,
    required this.subscriptionStatus,
    this.subscriptionEndDate,
    this.planName,
    this.shopType = 'retail',
    required this.isCarServiceShop,
    required this.createdAt,
    this.onboardedByAgentId,
    this.agentName,
    this.userCount = 0,
    this.productCount = 0,
    this.transactionCount = 0,
  });

  factory AdminShop.fromJson(Map<String, dynamic> json) => AdminShop(
        id:                   (json['id'] as num?)?.toInt() ?? 0,
        name:                 json['name'] as String,
        ownerName:            json['owner_name'] as String? ?? '',
        email:                json['email'] as String,
        phone:                json['phone'] as String?,
        address:              json['address'] as String?,
        subscriptionStatus:   json['subscription_status'] as String? ?? 'trial',
        subscriptionEndDate:  json['subscription_end_date'] != null
            ? DateTime.tryParse(json['subscription_end_date'] as String)
            : null,
        planName:             json['plan_name'] as String?,
        shopType:             json['shop_type'] as String? ?? 'retail',
        isCarServiceShop:     json['is_car_service_shop'] as bool? ?? false,
        createdAt:            json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
        onboardedByAgentId:   (json['onboarded_by_agent_id'] as num?)?.toInt(),
        agentName:            json['agent_name'] as String?,
        userCount:            (json['user_count'] as num?)?.toInt() ?? 0,
        productCount:         (json['product_count'] as num?)?.toInt() ?? 0,
        transactionCount:     (json['transaction_count'] as num?)?.toInt() ?? 0,
      );

  bool get isActive  => subscriptionStatus == 'active';
  bool get isTrial   => subscriptionStatus == 'trial';
  bool get isExpired => subscriptionStatus == 'expired' || subscriptionStatus == 'suspended';

  bool get isExpiringSoon =>
      isActive &&
      subscriptionEndDate != null &&
      subscriptionEndDate!.difference(DateTime.now()).inDays <= 7;
}

// ── Admin payment submission view ─────────────────────────────────────
class AdminPaymentSubmission {
  final int id;
  final int shopId;
  final String shopName;
  final int agentId;
  final String agentName;
  final double amount;
  final double? expectedAmount;
  final double? submittedAmount;
  final bool isSuspicious;
  final String paymentMethod;
  final DateTime paymentDate;
  final String? notes;
  final String status;
  final String? adminNote;
  final DateTime createdAt;

  const AdminPaymentSubmission({
    required this.id,
    required this.shopId,
    required this.shopName,
    required this.agentId,
    required this.agentName,
    required this.amount,
    this.expectedAmount,
    this.submittedAmount,
    this.isSuspicious = false,
    required this.paymentMethod,
    required this.paymentDate,
    this.notes,
    required this.status,
    this.adminNote,
    required this.createdAt,
  });

  static double _toDouble(dynamic v) =>
      v == null ? 0.0 : double.tryParse(v.toString()) ?? 0.0;

  factory AdminPaymentSubmission.fromJson(Map<String, dynamic> json) =>
      AdminPaymentSubmission(
        id:              (json['id'] as num?)?.toInt() ?? 0,
        shopId:          (json['shop_id'] as num?)?.toInt() ?? 0,
        shopName:        json['shop_name'] as String? ?? '',
        agentId:         (json['agent_id'] as num?)?.toInt() ?? 0,
        agentName:       json['agent_name'] as String? ?? '',
        amount:          _toDouble(json['amount']),
        expectedAmount:  json['expected_amount'] != null ? _toDouble(json['expected_amount']) : null,
        submittedAmount: json['submitted_amount'] != null ? _toDouble(json['submitted_amount']) : null,
        isSuspicious:    json['is_suspicious'] == true,
        paymentMethod:   json['payment_method'] as String? ?? '',
        paymentDate:     json['payment_date'] != null
            ? DateTime.tryParse(json['payment_date'].toString()) ?? DateTime.now()
            : DateTime.now(),
        notes:           json['notes'] as String?,
        status:          json['status'] as String? ?? 'pending',
        adminNote:       json['admin_note'] as String?,
        createdAt:       json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );
}

// ── Admin Agent view ──────────────────────────────────────────────────
class AdminAgent {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? district;
  final int monthlyTarget;
  final bool isActive;
  final int totalCustomers;
  final int activeCustomers;
  final double totalEarnings;
  final double pendingEarnings;

  const AdminAgent({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.district,
    required this.monthlyTarget,
    required this.isActive,
    required this.totalCustomers,
    required this.activeCustomers,
    required this.totalEarnings,
    required this.pendingEarnings,
  });

  factory AdminAgent.fromJson(Map<String, dynamic> json) => AdminAgent(
        id:               (json['id'] as num?)?.toInt() ?? 0,
        name:             json['name'] as String,
        email:            json['email'] as String,
        phone:            json['phone'] as String?,
        district:         json['district'] as String?,
        monthlyTarget:    (json['monthly_target'] as num?)?.toInt() ?? 0,
        isActive:         json['is_active'] as bool? ?? true,
        totalCustomers:   (json['total_customers'] as num?)?.toInt() ?? 0,
        activeCustomers:  (json['active_customers'] as num?)?.toInt() ?? 0,
        totalEarnings:    double.parse((json['total_earnings'] ?? 0).toString()),
        pendingEarnings:  double.parse((json['pending_earnings'] ?? 0).toString()),
      );
}
