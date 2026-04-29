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
        id:             json['id'] as int,
        name:           json['name'] as String,
        email:          json['email'] as String,
        phone:          json['phone'] as String?,
        district:       json['district'] as String?,
        monthlyTarget:  (json['monthly_target'] as num?)?.toInt() ?? 0,
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
    required this.createdAt,
  });

  factory AgentCustomer.fromJson(Map<String, dynamic> json) => AgentCustomer(
        id:                   json['id'] as int,
        name:                 json['name'] as String,
        ownerName:            json['owner_name'] as String,
        email:                json['email'] as String,
        phone:                json['phone'] as String?,
        address:              json['address'] as String?,
        subscriptionStatus:   json['subscription_status'] as String,
        subscriptionEndDate:  json['subscription_end_date'] != null
            ? DateTime.tryParse(json['subscription_end_date'] as String)
            : null,
        createdAt: DateTime.parse(json['created_at'] as String),
      );

  bool get isActive   => subscriptionStatus == 'active';
  bool get isExpiring =>
      isActive &&
      subscriptionEndDate != null &&
      subscriptionEndDate!.difference(DateTime.now()).inDays <= 3;
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
        id:            json['id'] as int,
        shopId:        json['shop_id'] as int,
        shopName:      json['shop_name'] as String? ?? '',
        amount:        double.parse(json['amount'].toString()),
        paymentMethod: json['payment_method'] as String,
        paymentDate:   DateTime.parse(json['payment_date'] as String),
        notes:         json['notes'] as String?,
        status:        json['status'] as String,
        adminNote:     json['admin_note'] as String?,
        createdAt:     DateTime.parse(json['created_at'] as String),
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
        id:             json['id'] as int,
        shopId:         json['shop_id'] as int,
        shopName:       json['shop_name'] as String? ?? '',
        commissionType: json['commission_type'] as String,
        amount:         double.parse(json['amount'].toString()),
        month:          json['month'] != null ? DateTime.tryParse(json['month'] as String) : null,
        status:         json['status'] as String,
        createdAt:      DateTime.parse(json['created_at'] as String),
      );
}

class AgentDashboard {
  final int totalCustomers;
  final int activeCustomers;
  final int inactiveCustomers;
  final double approvedEarnings;
  final double pendingEarnings;
  final double totalPaid;
  final int pendingSubmissions;
  final int monthlyTarget;
  final List<Map<String, dynamic>> expiringSoon;

  const AgentDashboard({
    required this.totalCustomers,
    required this.activeCustomers,
    required this.inactiveCustomers,
    required this.approvedEarnings,
    required this.pendingEarnings,
    required this.totalPaid,
    required this.pendingSubmissions,
    required this.monthlyTarget,
    required this.expiringSoon,
  });

  factory AgentDashboard.fromJson(Map<String, dynamic> json) => AgentDashboard(
        totalCustomers:     (json['total_customers'] as num?)?.toInt() ?? 0,
        activeCustomers:    (json['active_customers'] as num?)?.toInt() ?? 0,
        inactiveCustomers:  (json['inactive_customers'] as num?)?.toInt() ?? 0,
        approvedEarnings:   double.parse((json['approved_earnings'] ?? 0).toString()),
        pendingEarnings:    double.parse((json['pending_earnings'] ?? 0).toString()),
        totalPaid:          double.parse((json['total_paid'] ?? 0).toString()),
        pendingSubmissions: (json['pending_submissions'] as num?)?.toInt() ?? 0,
        monthlyTarget:      (json['monthly_target'] as num?)?.toInt() ?? 0,
        expiringSoon: (json['expiring_soon'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>(),
      );
}
