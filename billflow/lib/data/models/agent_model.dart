// Safe helpers - handles both numeric and string JSON values from PostgreSQL
int _i(dynamic v) => v == null ? 0 : int.tryParse(v.toString()) ?? 0;
double _d(dynamic v) => v == null ? 0.0 : double.tryParse(v.toString()) ?? 0.0;

class AgentModel {
  final int id;
  final String name;
  final String email;
  final String? phone;
  final String? district;
  final int monthlyTarget;
  final String? bankName;
  final String? bankAccount;
  final String? bankBranch;
  final String? accountHolder;

  const AgentModel({
    required this.id,
    required this.name,
    required this.email,
    this.phone,
    this.district,
    required this.monthlyTarget,
    this.bankName,
    this.bankAccount,
    this.bankBranch,
    this.accountHolder,
  });

  factory AgentModel.fromJson(Map<String, dynamic> json) => AgentModel(
        id:             _i(json['id']),
        name:           json['name'] as String? ?? '',
        email:          json['email'] as String? ?? '',
        phone:          json['phone'] as String?,
        district:       json['district'] as String?,
        monthlyTarget:  _i(json['monthly_target']),
        bankName:       json['bank_name'] as String?,
        bankAccount:    json['bank_account'] as String?,
        bankBranch:     json['bank_branch'] as String?,
        accountHolder:  json['account_holder'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'id':             id,
        'name':           name,
        'email':          email,
        'phone':          phone,
        'district':       district,
        'monthly_target': monthlyTarget,
        'bank_name':      bankName,
        'bank_account':   bankAccount,
        'bank_branch':    bankBranch,
        'account_holder': accountHolder,
      };

  AgentModel copyWith({
    String? bankName, String? bankAccount, String? bankBranch, String? accountHolder,
  }) => AgentModel(
        id: id, name: name, email: email, phone: phone,
        district: district, monthlyTarget: monthlyTarget,
        bankName:      bankName      ?? this.bankName,
        bankAccount:   bankAccount   ?? this.bankAccount,
        bankBranch:    bankBranch    ?? this.bankBranch,
        accountHolder: accountHolder ?? this.accountHolder,
      );
}

class AgentCustomer {
  final int id;
  final String name;
  final String ownerName;
  final String email;
  final String? phone;
  final String? address;
  final String subscriptionStatus;
  final DateTime? subscriptionEndDate;
  final String? planName;
  final double? expectedAmount;
  final int subscriptionMonths;
  final DateTime createdAt;

  const AgentCustomer({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.email,
    this.phone,
    this.address,
    required this.subscriptionStatus,
    this.subscriptionEndDate,
    this.planName,
    this.expectedAmount,
    this.subscriptionMonths = 1,
    required this.createdAt,
  });

  factory AgentCustomer.fromJson(Map<String, dynamic> json) => AgentCustomer(
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
        expectedAmount:       json['expected_amount'] != null
            ? _d(json['expected_amount'])
            : null,
        subscriptionMonths:   _i(json['subscription_months']) == 0
            ? 1
            : _i(json['subscription_months']),
        createdAt: json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );

  bool get isActive          => subscriptionStatus == 'active';
  bool get isPendingPayment  => subscriptionStatus == 'pending_payment';
  bool get isExpiring =>
      isActive &&
      subscriptionEndDate != null &&
      subscriptionEndDate!.difference(DateTime.now()).inDays <= 3;

  int? get daysUntilExpiry => subscriptionEndDate != null
      ? subscriptionEndDate!.difference(DateTime.now()).inDays
      : null;
}

class AgentPaymentSubmission {
  final int id;
  final int shopId;
  final String shopName;
  final double amount;
  final String paymentMethod;
  final DateTime paymentDate;
  final String? notes;
  final String status;
  final String? adminNote;
  final DateTime createdAt;

  const AgentPaymentSubmission({
    required this.id,
    required this.shopId,
    required this.shopName,
    required this.amount,
    required this.paymentMethod,
    required this.paymentDate,
    this.notes,
    required this.status,
    this.adminNote,
    required this.createdAt,
  });

  factory AgentPaymentSubmission.fromJson(Map<String, dynamic> json) =>
      AgentPaymentSubmission(
        id:            _i(json['id']),
        shopId:        _i(json['shop_id']),
        shopName:      json['shop_name'] as String? ?? '',
        amount:        _d(json['amount'] ?? json['submitted_amount']),
        paymentMethod: json['payment_method'] as String? ?? '',
        paymentDate:   json['payment_date'] != null
            ? DateTime.tryParse(json['payment_date'].toString()) ?? DateTime.now()
            : DateTime.now(),
        notes:         json['notes'] as String?,
        status:        json['status'] as String? ?? 'pending',
        adminNote:     json['admin_note'] as String?,
        createdAt:     json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );
}

class AgentCommission {
  final int id;
  final int shopId;
  final String shopName;
  final String commissionType;
  final double amount;
  final DateTime? month;
  final String status;
  final DateTime createdAt;

  const AgentCommission({
    required this.id,
    required this.shopId,
    required this.shopName,
    required this.commissionType,
    required this.amount,
    this.month,
    required this.status,
    required this.createdAt,
  });

  factory AgentCommission.fromJson(Map<String, dynamic> json) => AgentCommission(
        id:             _i(json['id']),
        shopId:         _i(json['shop_id']),
        shopName:       json['shop_name'] as String? ?? '',
        commissionType: json['commission_type'] as String? ?? '',
        amount:         _d(json['amount']),
        month:          json['month'] != null
            ? DateTime.tryParse(json['month'].toString())
            : null,
        status:         json['status'] as String? ?? 'locked',
        createdAt:      json['created_at'] != null
            ? DateTime.tryParse(json['created_at'].toString()) ?? DateTime.now()
            : DateTime.now(),
      );
}

class AgentDashboard {
  final int totalCustomers;
  final int activeCustomers;
  final int inactiveCustomers;
  final int pendingPaymentShops;
  final double approvedEarnings;
  final double pendingEarnings;
  final double totalPaid;
  final int pendingSubmissions;
  final int monthlyTarget;
  final double walletCollected;
  final double walletVerified;
  final List<Map<String, dynamic>> expiringSoon;

  const AgentDashboard({
    required this.totalCustomers,
    required this.activeCustomers,
    required this.inactiveCustomers,
    this.pendingPaymentShops = 0,
    required this.approvedEarnings,
    required this.pendingEarnings,
    required this.totalPaid,
    required this.pendingSubmissions,
    required this.monthlyTarget,
    this.walletCollected = 0,
    this.walletVerified = 0,
    required this.expiringSoon,
  });

  double get walletBalance => walletCollected - walletVerified;

  factory AgentDashboard.fromJson(Map<String, dynamic> json) => AgentDashboard(
        totalCustomers:      _i(json['total_customers']),
        activeCustomers:     _i(json['active_customers']),
        inactiveCustomers:   _i(json['inactive_customers']),
        pendingPaymentShops: _i(json['pending_payment_shops']),
        approvedEarnings:    _d(json['approved_earnings']),
        pendingEarnings:     _d(json['pending_earnings']),
        totalPaid:           _d(json['total_paid']),
        pendingSubmissions:  _i(json['pending_submissions']),
        monthlyTarget:       _i(json['monthly_target']),
        walletCollected:     _d(json['wallet_collected']),
        walletVerified:      _d(json['wallet_verified']),
        expiringSoon: (json['expiring_soon'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>(),
      );
}

// ── AgentShopQR - HelaPay QR generated on behalf of a shop ───────────────
class AgentShopQR {
  final String reference;
  final String qrData;
  final double amount;
  final String shopName;
  final DateTime expiresAt;

  const AgentShopQR({
    required this.reference,
    required this.qrData,
    required this.amount,
    required this.shopName,
    required this.expiresAt,
  });

  factory AgentShopQR.fromJson(Map<String, dynamic> json) => AgentShopQR(
        reference: json['reference'] as String? ?? '',
        qrData:    json['qr_data']   as String? ?? '',
        amount:    _d(json['amount']),
        shopName:  json['shop_name'] as String? ?? '',
        expiresAt: json['expires_at'] != null
            ? DateTime.tryParse(json['expires_at'].toString()) ?? DateTime.now().add(const Duration(minutes: 10))
            : DateTime.now().add(const Duration(minutes: 10)),
      );
}

// ── AgentDepositQR - HelaPay QR to top up agent wallet ───────────────────
class AgentDepositQR {
  final String reference;
  final String qrData;
  final double amount;
  final DateTime expiresAt;

  const AgentDepositQR({
    required this.reference,
    required this.qrData,
    required this.amount,
    required this.expiresAt,
  });

  factory AgentDepositQR.fromJson(Map<String, dynamic> json) => AgentDepositQR(
        reference: json['reference'] as String? ?? '',
        qrData:    json['qr_data']   as String? ?? '',
        amount:    _d(json['amount']),
        expiresAt: json['expires_at'] != null
            ? DateTime.tryParse(json['expires_at'].toString()) ?? DateTime.now().add(const Duration(minutes: 10))
            : DateTime.now().add(const Duration(minutes: 10)),
      );
}

// ── AgentNotification ─────────────────────────────────────────────────────
class AgentNotification {
  final int id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;

  const AgentNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
  });

  factory AgentNotification.fromJson(Map<String, dynamic> json) => AgentNotification(
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
