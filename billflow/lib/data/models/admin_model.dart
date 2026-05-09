// Safe helpers - handles both numeric and string JSON values from PostgreSQL
int _i(dynamic v) => v == null ? 0 : int.tryParse(v.toString()) ?? 0;
int? _iNull(dynamic v) => v == null ? null : int.tryParse(v.toString());
double _d(dynamic v) => v == null ? 0.0 : double.tryParse(v.toString()) ?? 0.0;

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
        totalShops:      _i(json['total_shops']),
        activeShops:     _i(json['active_shops']),
        trialShops:      _i(json['trial_shops']),
        expiredShops:    _i(json['expired_shops']),
        totalAgents:     _i(json['total_agents']),
        pendingPayments: _i(json['pending_payments']),
        mrr:             _d(json['mrr']),
        totalRevenue:    _d(json['total_revenue']),
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
        id:                   _i(json['id']),
        name:                 json['name'] as String? ?? '',
        ownerName:            json['owner_name'] as String? ?? '',
        email:                json['email'] as String? ?? '',
        phone:                json['phone'] as String?,
        address:              json['address'] as String?,
        subscriptionStatus:   json['subscription_status'] as String? ?? 'trial',
        subscriptionEndDate:  json['subscription_end_date'] != null
            ? DateTime.tryParse(json['subscription_end_date'].toString())
            : null,
        planName:             json['plan_name'] as String?,
        shopType:             json['shop_type'] as String? ?? 'retail',
        isCarServiceShop:     json['is_car_service_shop'] == true,
        createdAt:            json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
        onboardedByAgentId:   _iNull(json['onboarded_by_agent_id']),
        agentName:            json['agent_name'] as String?,
        userCount:            _i(json['user_count']),
        productCount:         _i(json['product_count']),
        transactionCount:     _i(json['transaction_count']),
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

  factory AdminPaymentSubmission.fromJson(Map<String, dynamic> json) =>
      AdminPaymentSubmission(
        id:              _i(json['id']),
        shopId:          _i(json['shop_id']),
        shopName:        json['shop_name'] as String? ?? '',
        agentId:         _i(json['agent_id']),
        agentName:       json['agent_name'] as String? ?? '',
        amount:          _d(json['amount']),
        expectedAmount:  json['expected_amount'] != null ? _d(json['expected_amount']) : null,
        submittedAmount: json['submitted_amount'] != null ? _d(json['submitted_amount']) : null,
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
        id:               _i(json['id']),
        name:             json['name'] as String? ?? '',
        email:            json['email'] as String? ?? '',
        phone:            json['phone'] as String?,
        district:         json['district'] as String?,
        monthlyTarget:    _i(json['monthly_target']),
        isActive:         json['is_active'] == true,
        totalCustomers:   _i(json['total_customers']),
        activeCustomers:  _i(json['active_customers']),
        totalEarnings:    _d(json['total_earnings']),
        pendingEarnings:  _d(json['pending_earnings']),
      );
}

// ── AdminCommission ───────────────────────────────────────────────────────
class AdminCommission {
  final int id;
  final int agentId;
  final String agentName;
  final int shopId;
  final String shopName;
  final String commissionType;
  final double amount;
  final String? month;
  final String status;
  final DateTime createdAt;
  final DateTime? paidAt;

  const AdminCommission({
    required this.id,
    required this.agentId,
    required this.agentName,
    required this.shopId,
    required this.shopName,
    required this.commissionType,
    required this.amount,
    this.month,
    required this.status,
    required this.createdAt,
    this.paidAt,
  });

  factory AdminCommission.fromJson(Map<String, dynamic> json) => AdminCommission(
        id:             _i(json['id']),
        agentId:        _i(json['agent_id']),
        agentName:      json['agent_name'] as String? ?? '',
        shopId:         _i(json['shop_id']),
        shopName:       json['shop_name'] as String? ?? '',
        commissionType: json['commission_type'] as String? ?? '',
        amount:         _d(json['amount']),
        month:          json['month'] as String?,
        status:         json['status'] as String? ?? 'pending',
        createdAt:      json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
        paidAt: json['paid_at'] != null
            ? DateTime.tryParse(json['paid_at'].toString())
            : null,
      );

  bool get isPending  => status == 'pending' || status == 'locked';
  bool get isApproved => status == 'approved';
  bool get isPaid     => status == 'paid';
}

// ── AgentRegistration - pending agent waiting for approval ────────────────
class AgentRegistration {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? district;
  final String status;
  final DateTime createdAt;

  const AgentRegistration({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.district,
    required this.status,
    required this.createdAt,
  });

  factory AgentRegistration.fromJson(Map<String, dynamic> json) => AgentRegistration(
        id:        _i(json['id']),
        name:      json['name']     as String? ?? '',
        email:     json['email']    as String? ?? '',
        phone:     json['phone']    as String?,
        district:  json['district'] as String?,
        status:    json['status']   as String? ?? 'pending',
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );
}

// ── AdminNotification ─────────────────────────────────────────────────────
class AdminNotification {
  final int id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;

  const AdminNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
  });

  factory AdminNotification.fromJson(Map<String, dynamic> json) => AdminNotification(
        id:        _i(json['id']),
        type:      json['type']  as String? ?? '',
        title:     json['title'] as String? ?? '',
        body:      json['body']  as String? ?? json['message'] as String? ?? '',
        isRead:    json['is_read'] == true,
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );
}

// ── AdminShopPayment - shop owner self-payment ────────────────────────────
class AdminShopPayment {
  final int id;
  final int shopId;
  final String shopName;
  final double amount;
  final String paymentMethod;
  final String status;
  final String? adminNote;
  final DateTime createdAt;

  const AdminShopPayment({
    required this.id,
    required this.shopId,
    required this.shopName,
    required this.amount,
    required this.paymentMethod,
    required this.status,
    this.adminNote,
    required this.createdAt,
  });

  factory AdminShopPayment.fromJson(Map<String, dynamic> json) => AdminShopPayment(
        id:            _i(json['id']),
        shopId:        _i(json['shop_id']),
        shopName:      json['shop_name']      as String? ?? '',
        amount:        _d(json['amount']),
        paymentMethod: json['payment_method'] as String? ?? '',
        status:        json['status']         as String? ?? 'pending',
        adminNote:     json['admin_note']     as String?,
        createdAt:     json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );
}

// ── ShopUser - staff member of a shop ────────────────────────────────────
class ShopUser {
  final int id;
  final String username;
  final String name;
  final String role;
  final bool isActive;

  const ShopUser({
    required this.id,
    required this.username,
    required this.name,
    required this.role,
    required this.isActive,
  });

  factory ShopUser.fromJson(Map<String, dynamic> json) => ShopUser(
        id:       _i(json['id']),
        username: json['username'] as String? ?? '',
        name:     json['name']     as String? ?? json['username'] as String? ?? '',
        role:     json['role']     as String? ?? 'cashier',
        isActive: json['is_active'] != false,
      );
}
