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
}
