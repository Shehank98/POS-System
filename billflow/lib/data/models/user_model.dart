class UserModel {
  final int id;
  final String username;
  final String? email;
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

  // ── Feature flags — exact match to admin panel ───────────────
  // Barcode Scanner (Hardware/camera barcode at POS)
  // (barcodeEnabled is already a top-level field above)

  // POS Core
  final bool refundsEnabled;   // Allow Refunds
  final bool voidEnabled;      // Allow Void
  final bool offlineEnabled;   // Offline Mode

  // Modules
  final bool preOrdersEnabled;  // Pre-Orders
  final bool customersEnabled;  // Customers Tab
  final bool loyaltyEnabled;    // Loyalty Points
  final bool reportsEnabled;    // Reports
  final bool analyticsEnabled;  // Analytics

  // Clothing Shops Only
  final bool exchangesEnabled;  // Exchanges / Returns
  final bool branchesEnabled;   // Multi-Branch

  // Car Service Only
  final bool carServiceProductsEnabled;  // Products / Add-ons tab

  const UserModel({
    required this.id,
    required this.username,
    this.email,
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
    required this.refundsEnabled,
    required this.voidEnabled,
    required this.offlineEnabled,
    required this.preOrdersEnabled,
    required this.customersEnabled,
    required this.loyaltyEnabled,
    required this.reportsEnabled,
    required this.analyticsEnabled,
    required this.exchangesEnabled,
    required this.branchesEnabled,
    required this.carServiceProductsEnabled,
  });

  bool get isOwner => role == 'owner';
  bool get isManagerOrAbove => role == 'owner' || role == 'manager';
  bool get isClothingShop => shopType == 'clothing';
  bool get isCarServiceShop => shopType == 'car_wash';
  bool get isPendingPayment => subscriptionStatus == 'pending_payment';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: int.tryParse(json['id'].toString()) ?? 0,
      username: json['username'] as String? ?? '',
      email: json['email'] as String?,
      role: json['role'] as String? ?? 'cashier',
      shopId: int.tryParse((json['shop_id'] ?? 0).toString()) ?? 0,
      shopName: json['shop_name'] as String? ?? '',
      subscriptionStatus: json['subscription_status'] as String? ?? 'active',
      subscriptionEndDate: json['subscription_end_date'] as String?,
      barcodeEnabled: json['barcode_enabled'] == true,
      defaultTaxRate: double.tryParse((json['default_tax_rate'] ?? 0).toString()) ?? 0.0,
      shopType: json['shop_type'] as String? ?? 'retail',
      readOnly: json['read_only'] == true,
      inGracePeriod: json['in_grace_period'] == true,
      graceDaysRemaining: int.tryParse((json['grace_days_remaining'] ?? 0).toString()) ?? 0,
      daysUntilExpiry: json['days_until_expiry'] != null
          ? double.tryParse(json['days_until_expiry'].toString())
          : null,
      // POS Core
      refundsEnabled: json['refunds_enabled'] as bool? ?? true,
      voidEnabled: json['void_enabled'] as bool? ?? true,
      offlineEnabled: json['offline_enabled'] as bool? ?? true,
      // Modules
      preOrdersEnabled: json['pre_orders_enabled'] as bool? ?? true,
      customersEnabled: json['customers_enabled'] as bool? ?? true,
      loyaltyEnabled: json['loyalty_enabled'] as bool? ?? true,
      reportsEnabled: json['reports_enabled'] as bool? ?? true,
      analyticsEnabled: json['analytics_enabled'] as bool? ?? true,
      // Clothing Only
      exchangesEnabled: json['exchanges_enabled'] as bool? ?? true,
      branchesEnabled: json['branches_enabled'] as bool? ?? true,
      // Car Service Only
      carServiceProductsEnabled: json['car_service_products_enabled'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'username': username,
        'email': email,
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
        // POS Core
        'refunds_enabled': refundsEnabled,
        'void_enabled': voidEnabled,
        'offline_enabled': offlineEnabled,
        // Modules
        'pre_orders_enabled': preOrdersEnabled,
        'customers_enabled': customersEnabled,
        'loyalty_enabled': loyaltyEnabled,
        'reports_enabled': reportsEnabled,
        'analytics_enabled': analyticsEnabled,
        // Clothing Only
        'exchanges_enabled': exchangesEnabled,
        'branches_enabled': branchesEnabled,
        // Car Service Only
        'car_service_products_enabled': carServiceProductsEnabled,
      };
}
