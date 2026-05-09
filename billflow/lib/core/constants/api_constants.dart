class ApiConstants {
  ApiConstants._();

  static const String baseUrl = 'https://pos-system-production-74ed.up.railway.app/api';

  // ── Auth ─────────────────────────────────────────────────────
  static const String login = '/auth/login';
  static const String me = '/auth/me';

  // ── Products (retail / grocery) ───────────────────────────────
  static const String products = '/products';
  static const String productCategories = '/products/categories';
  static String productByBarcode(String barcode) => '/products/by-barcode/$barcode';
  static String productById(int id) => '/products/$id';

  // ── Clothing products (base products) ────────────────────────
  static const String clothingProducts = '/clothing/products';
  static String clothingProductById(int id) => '/clothing/products/$id';

  // ── Clothing variants ─────────────────────────────────────────
  static String clothingVariants(int productId) =>
      '/clothing/products/$productId/variants';
  static String clothingVariantById(int id) => '/clothing/variants/$id';
  static String clothingVariantByBarcode(String barcode) =>
      '/clothing/variants/by-barcode/${Uri.encodeComponent(barcode)}';
  static String clothingVariantAdjust(int id) =>
      '/clothing/variants/$id/adjust';
  static String clothingVariantStockHistory(int id) =>
      '/clothing/variants/$id/stock-history';
  static const String clothingLowStock = '/clothing/variants/low-stock';

  // ── Clothing exchanges / returns ──────────────────────────────
  static const String clothingExchangeLookup = '/clothing/transactions/lookup';
  static const String clothingExchanges = '/clothing/exchanges';
  static String clothingExchangeById(int id) => '/clothing/exchanges/$id';

  // ── Clothing dashboard ────────────────────────────────────────
  static const String clothingDashboard = '/clothing/dashboard';

  // ── Branches (clothing multi-branch) ─────────────────────────
  static const String clothingBranches = '/clothing/branches';
  static String clothingBranchById(int id) => '/clothing/branches/$id';
  static String clothingBranchInventory(int id) =>
      '/clothing/branches/$id/inventory';
  static const String clothingBranchTransfer = '/clothing/branches/transfer';

  // ── Transactions ──────────────────────────────────────────────
  static const String transactions = '/transactions';
  static const String transactionSummary = '/transactions/summary';
  static String transactionById(int id) => '/transactions/$id';
  static String voidTransaction(int id) => '/transactions/$id/void';
  static String refundTransaction(int id) => '/transactions/$id/refund';
  static const String transactionSync = '/transactions/sync';

  // ── Dashboard ─────────────────────────────────────────────────
  static const String dashboardToday = '/dashboard/today';
  static const String dashboardWeek = '/dashboard/week';
  static const String dashboardMonth = '/dashboard/month';
  static const String dashboardLowStock = '/dashboard/low-stock';
  static const String dashboardAnalytics = '/dashboard/analytics';

  // ── Reports ───────────────────────────────────────────────────
  static const String reportsTax = '/reports/tax';
  static const String auditLog = '/audit-log';

  // ── Notifications ─────────────────────────────────────────────
  static const String notifications = '/notifications';
  static const String notificationsReadAll = '/notifications/read-all';
  static String notificationMarkRead(int id) => '/notifications/$id/read';

  // ── Customers ─────────────────────────────────────────────────
  static const String customersTop = '/customers/top';
  static const String customersInsights = '/customers/insights';

  // ── Car Wash ──────────────────────────────────────────────────
  static const String carwashDashboard = '/carwash/dashboard';
  static const String carwashStaffView = '/carwash/staff/my-view';
  // Services
  static const String carwashServices = '/carwash/services';
  static String carwashServiceById(int id) => '/carwash/services/$id';
  // Products / supplies
  static const String carwashProducts = '/carwash/products';
  static String carwashProductById(int id) => '/carwash/products/$id';
  // Jobs
  static const String carwashJobs = '/carwash/jobs';
  static String carwashJobById(int id) => '/carwash/jobs/$id';
  static String carwashJobStatus(int id) => '/carwash/jobs/$id/status';
  static String carwashJobItems(int id) => '/carwash/jobs/$id/items';
  static String carwashJobItemById(int jobId, int itemId) =>
      '/carwash/jobs/$jobId/items/$itemId';
  static String carwashJobPay(int id) => '/carwash/jobs/$id/pay';
  // Bookings
  static const String carwashBookings = '/carwash/bookings';
  static String carwashBookingById(int id) => '/carwash/bookings/$id';
  static String carwashBookingStatus(int id) => '/carwash/bookings/$id/status';
  static String carwashBookingConvert(int id) =>
      '/carwash/bookings/$id/convert';

  // ── Pre-Orders ────────────────────────────────────────────────
  static const String preOrders = '/pre-orders';
  static String preOrderById(int id) => '/pre-orders/$id';
  static String preOrderStatus(int id) => '/pre-orders/$id/status';
  static String preOrderPay(int id) => '/pre-orders/$id/pay';

  // ── QR Payments (HelaPOS / LankaQR) ──────────────────────────
  static const String qrGenerate = '/qr/generate';
  static String qrStatus(String ref) => '/qr/status/$ref';
  static String qrDisplay(String ref) => '/qr/display/$ref';

  // ── Sales Agent ───────────────────────────────────────────────
  static const String agentLogin         = '/agent-auth/login';
  static const String agentMe            = '/agent-auth/me';
  static const String agentDashboard     = '/agents/me/dashboard';
  static const String agentCustomers     = '/agents/me/customers';
  static const String agentPayments      = '/agents/me/payments';
  static const String agentCommissions   = '/agents/me/commissions';
  static const String agentBankDetails   = '/agents/me/bank-details';
  static const String agentRenewals      = '/agents/me/renewals';
  static const String agentPlans         = '/agents/me/plans';
  static const String agentNotifications = '/agents/me/notifications';
  static const String agentNotificationsReadAll = '/agents/me/notifications/read-all';
  static String agentNotificationRead(int id) => '/agents/me/notifications/$id/read';
  static String agentEditCustomer(int shopId) => '/agents/me/customers/$shopId';
  // Agent shop payment QR
  static String agentShopPaymentQR(int shopId) => '/agents/me/shops/$shopId/payment-qr';
  static String agentShopPaymentQRStatus(int shopId, String ref) => '/agents/me/shops/$shopId/payment-qr/status/$ref';
  static String agentShopPayments(int shopId) => '/agents/me/shops/$shopId/payments';
  static String agentShopNote(int shopId) => '/agents/me/shops/$shopId/note';
  // Agent deposit QR (wallet top-up)
  static const String agentDepositQR      = '/agents/me/deposit/generate-qr';
  static String agentDepositStatus(String ref) => '/agents/me/deposit/status/$ref';
  static const String agentDepositHistory  = '/agents/me/deposit/history';
  static const String agentSubscriptions   = '/agents/me/subscriptions';

  // ── Admin ─────────────────────────────────────────────────────
  static const String adminLogin        = '/admin/login';
  static const String adminMe           = '/admin/me';
  static const String adminDashboard    = '/admin/dashboard';
  static const String adminShops        = '/admin/shops';
  static String adminShopById(int id)        => '/admin/shops/$id';
  static String adminShopSubscription(int id) => '/admin/shops/$id/subscription';
  static const String adminPayments     = '/admin/payments';
  static const String adminPendingPayments = '/admin/agent-payments/pending';
  static const String adminAllPayments  = '/admin/agent-payments';
  static String adminVerifyPayment(int id) => '/admin/agent-payments/$id/verify';
  static String adminRejectPayment(int id) => '/admin/agent-payments/$id/reject';
  static const String adminAgents       = '/admin/agents';
  static String adminAgentById(int id)  => '/admin/agents/$id';
  static String adminAgentCustomers(int id) => '/admin/agents/$id/customers';
  static const String adminAgentCommissions = '/admin/agent-commissions';
  static const String adminAgentPayout  = '/admin/agent-commissions/payout';
  static const String adminPlans        = '/admin/plans';
  static String adminPlanById(int id)   => '/admin/plans/$id';
  static const String adminAuditLog              = '/admin/audit-log';
  static const String adminNotificationsDispatch = '/admin/notifications/dispatch';
  // Admin commission management
  static const String adminCommissionsApprove    = '/admin/agent-commissions/approve';
  static const String adminPayoutLogs            = '/admin/agent-payout-logs';
  // Admin broader views
  static const String adminShopsByAgent          = '/admin/shops-by-agent';
  static const String adminFinancialSummary      = '/admin/financial-summary';
  // Admin shop extras
  static String adminShopSales(int id)           => '/admin/shops/$id/sales';
  static String adminShopUsers(int id)           => '/admin/shops/$id/users';
  static String adminShopUserById(int s, int u)  => '/admin/shops/$s/users/$u';
  // Admin shop self-payments
  static const String adminShopPayments          = '/admin/shop-payments';
  static String adminShopPaymentVerify(int id)   => '/admin/shop-payments/$id/verify';
  static String adminShopPaymentReject(int id)   => '/admin/shop-payments/$id/reject';
  // Admin notifications
  static const String adminNotifications         = '/admin/notifications';
  static const String adminNotificationsReadAll  = '/admin/notifications/read-all';
  static String adminNotificationRead(int id)    => '/admin/notifications/$id/read';
  // Admin agent registration management
  static String adminAgentApprove(int id)        => '/admin/agents/$id/approve';
  static String adminAgentReject(int id)         => '/admin/agents/$id/reject';
  static const String adminAgentRegistrations    = '/admin/agent-registrations';
  static String adminAgentDocuments(int id)      => '/admin/agents/$id/documents';
  static const String adminGenerateInvite        = '/admin/generate-agent-invite';
  static String adminAgentBankDetails(int id)    => '/admin/agents/$id/bank-details';
}
