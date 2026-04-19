class ApiConstants {
  ApiConstants._();

  static const String baseUrl = 'https://pos-system-production-74ed.up.railway.app/api';

  // Auth
  static const String login = '/auth/login';
  static const String me = '/auth/me';

  // Products
  static const String products = '/products';
  static const String productCategories = '/products/categories';
  static String productByBarcode(String barcode) => '/products/by-barcode/$barcode';
  static String productById(int id) => '/products/$id';

  // Clothing shop products
  static const String clothingProducts = '/clothing/products';
  static String clothingProductById(int id) => '/clothing/products/$id';

  // Transactions
  static const String transactions = '/transactions';
  static const String transactionSummary = '/transactions/summary';
  static String transactionById(int id) => '/transactions/$id';
  static String voidTransaction(int id) => '/transactions/$id/void';

  // Dashboard
  static const String dashboardToday = '/dashboard/today';
  static const String dashboardWeek = '/dashboard/week';
  static const String dashboardMonth = '/dashboard/month';
  static const String dashboardLowStock = '/dashboard/low-stock';
  static const String dashboardAnalytics = '/dashboard/analytics';

  // Notifications
  static const String notifications = '/notifications';
  static const String notificationsReadAll = '/notifications/read-all';
  static String notificationMarkRead(int id) => '/notifications/$id/read';

  // Reports
  static const String reportsTax = '/reports/tax';
}
