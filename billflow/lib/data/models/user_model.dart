class UserModel {
  final int id;
  final String username;
  final String role;
  final int shopId;
  final String shopName;
  final String subscriptionStatus;
  final String? subscriptionEndDate;
  final bool barcodeEnabled;
  final double defaultTaxRate;
  final String shopType;
  final bool readOnly;
  final bool inGracePeriod;
  final int graceDaysRemaining;
  final double? daysUntilExpiry;

  // Feature flags
  final bool preOrdersEnabled;
  final bool customersEnabled;
  final bool reportsEnabled;
  final bool analyticsEnabled;
  final bool loyaltyEnabled;
  final bool refundsEnabled;
  final bool voidEnabled;
  final bool offlineEnabled;
  final bool exchangesEnabled;
  final bool branchesEnabled;
  final bool posEnabled;
  final bool productsEnabled;
  final bool notificationsEnabled;
  final bool inventoryEnabled;

  const UserModel({
    required this.id,
    required this.username,
    required this.role,
    required this.shopId,
    required this.shopName,
    required this.subscriptionStatus,
    this.subscriptionEndDate,
    required this.barcodeEnabled,
    required this.defaultTaxRate,
    required this.shopType,
    required this.readOnly,
    required this.inGracePeriod,
    required this.graceDaysRemaining,
    this.daysUntilExpiry,
    required this.preOrdersEnabled,
    required this.customersEnabled,
    required this.reportsEnabled,
    required this.analyticsEnabled,
    required this.loyaltyEnabled,
    required this.refundsEnabled,
    required this.voidEnabled,
    required this.offlineEnabled,
    required this.exchangesEnabled,
    required this.branchesEnabled,
    required this.posEnabled,
    required this.productsEnabled,
    required this.notificationsEnabled,
    required this.inventoryEnabled,
  });

  bool get isOwner => role == 'owner';
  bool get isManagerOrAbove => role == 'owner' || role == 'manager';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] as int,
      username: json['username'] as String,
      role: json['role'] as String,
      shopId: json['shop_id'] as int,
      shopName: json['shop_name'] as String? ?? '',
      subscriptionStatus: json['subscription_status'] as String? ?? 'active',
      subscriptionEndDate: json['subscription_end_date'] as String?,
      barcodeEnabled: json['barcode_enabled'] as bool? ?? false,
      defaultTaxRate: (json['default_tax_rate'] as num?)?.toDouble() ?? 0.0,
      shopType: json['shop_type'] as String? ?? 'retail',
      readOnly: json['read_only'] as bool? ?? false,
      inGracePeriod: json['in_grace_period'] as bool? ?? false,
      graceDaysRemaining: json['grace_days_remaining'] as int? ?? 0,
      daysUntilExpiry: (json['days_until_expiry'] as num?)?.toDouble(),
      preOrdersEnabled: json['pre_orders_enabled'] as bool? ?? false,
      customersEnabled: json['customers_enabled'] as bool? ?? false,
      reportsEnabled: json['reports_enabled'] as bool? ?? false,
      analyticsEnabled: json['analytics_enabled'] as bool? ?? false,
      loyaltyEnabled: json['loyalty_enabled'] as bool? ?? false,
      refundsEnabled: json['refunds_enabled'] as bool? ?? false,
      voidEnabled: json['void_enabled'] as bool? ?? false,
      offlineEnabled: json['offline_enabled'] as bool? ?? false,
      exchangesEnabled: json['exchanges_enabled'] as bool? ?? false,
      branchesEnabled: json['branches_enabled'] as bool? ?? false,
      posEnabled: json['pos_enabled'] as bool? ?? true,
      productsEnabled: json['products_enabled'] as bool? ?? true,
      notificationsEnabled: json['notifications_enabled'] as bool? ?? true,
      inventoryEnabled: json['inventory_enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'role': role,
        'shop_id': shopId,
        'shop_name': shopName,
        'subscription_status': subscriptionStatus,
        'subscription_end_date': subscriptionEndDate,
        'barcode_enabled': barcodeEnabled,
        'default_tax_rate': defaultTaxRate,
        'shop_type': shopType,
        'read_only': readOnly,
        'in_grace_period': inGracePeriod,
        'grace_days_remaining': graceDaysRemaining,
        'days_until_expiry': daysUntilExpiry,
        'pre_orders_enabled': preOrdersEnabled,
        'customers_enabled': customersEnabled,
        'reports_enabled': reportsEnabled,
        'analytics_enabled': analyticsEnabled,
        'loyalty_enabled': loyaltyEnabled,
        'refunds_enabled': refundsEnabled,
        'void_enabled': voidEnabled,
        'offline_enabled': offlineEnabled,
        'exchanges_enabled': exchangesEnabled,
        'branches_enabled': branchesEnabled,
        'pos_enabled': posEnabled,
        'products_enabled': productsEnabled,
        'notifications_enabled': notificationsEnabled,
        'inventory_enabled': inventoryEnabled,
      };
}
