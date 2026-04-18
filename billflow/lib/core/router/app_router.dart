import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../providers/biometric_provider.dart';
import '../../data/models/product_model.dart';
import '../../data/models/transaction_model.dart';
import '../../presentation/screens/auth/login_screen.dart';
import '../../presentation/screens/auth/biometric_screen.dart';
import '../../presentation/screens/billing/billing_screen.dart';
import '../../presentation/screens/dashboard/dashboard_screen.dart';
import '../../presentation/screens/sales/sales_screen.dart';
import '../../presentation/screens/sales/payment_screen.dart';
import '../../presentation/screens/products/products_screen.dart';
import '../../presentation/screens/products/product_form_screen.dart';
import '../../presentation/screens/transactions/transactions_screen.dart';
import '../../presentation/screens/transactions/transaction_detail_screen.dart';
import '../../presentation/screens/reports/reports_screen.dart';
import '../../presentation/screens/notifications/notifications_screen.dart';
import '../../presentation/screens/settings/settings_screen.dart';
import '../../presentation/screens/analytics/analytics_screen.dart';
import '../../presentation/screens/carwash/carwash_screen.dart';
import '../../presentation/screens/carwash/carwash_bookings_screen.dart';
import '../../presentation/screens/carwash/carwash_services_screen.dart';
import '../../presentation/screens/customers/customers_screen.dart';
import '../../presentation/screens/pre_orders/pre_orders_screen.dart';
import '../../presentation/widgets/common/app_scaffold.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);
  final needsBiometric = ref.watch(biometricGateProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    redirect: (context, state) {
      final user = authState.valueOrNull;
      final isLoggedIn = user != null;
      final isLoading = authState.isLoading;
      final loc = state.matchedLocation;

      if (isLoading) return loc == '/' ? null : '/';
      if (!isLoggedIn && loc != '/login') return '/login';
      if (isLoggedIn && needsBiometric && loc != '/biometric') return '/biometric';

      if (isLoggedIn && !needsBiometric) {
        // Subscription gate: fully locked accounts can only access /billing and /settings
        final isLocked = user.readOnly && !user.inGracePeriod;
        const allowedWhenLocked = {'/billing', '/settings'};
        if (isLocked && !allowedWhenLocked.contains(loc)) return '/billing';

        if (loc == '/login' || loc == '/' || loc == '/biometric') {
          // Car service shops go to their own dashboard
          return user.isCarServiceShop ? '/carwash' : '/dashboard';
        }
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/biometric',
        builder: (context, state) => const BiometricScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AppScaffold(child: child),
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/sales',
            builder: (context, state) => const SalesScreen(),
          ),
          GoRoute(
            path: '/transactions',
            builder: (context, state) => const TransactionsScreen(),
          ),
          GoRoute(
            path: '/products',
            builder: (context, state) => const ProductsScreen(),
          ),
          GoRoute(
            path: '/reports',
            builder: (context, state) => const ReportsScreen(),
          ),
          GoRoute(
            path: '/customers',
            builder: (context, state) => const CustomersScreen(),
          ),
          GoRoute(
            path: '/carwash',
            builder: (context, state) => const CarwashScreen(),
          ),
          GoRoute(
            path: '/carwash/bookings',
            builder: (context, state) => const CarwashBookingsScreen(),
          ),
          GoRoute(
            path: '/carwash/services',
            builder: (context, state) => const CarwashServicesScreen(),
          ),
          GoRoute(
            path: '/analytics',
            builder: (context, state) => const AnalyticsScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/billing',
        builder: (context, state) => const BillingScreen(),
      ),
      GoRoute(
        path: '/pre-orders',
        builder: (context, state) => const PreOrdersScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
      GoRoute(
        path: '/products/add',
        builder: (context, state) => const ProductFormScreen(),
      ),
      GoRoute(
        path: '/products/:id/edit',
        builder: (context, state) {
          final product = state.extra as ProductModel?;
          return ProductFormScreen(product: product);
        },
      ),
      GoRoute(
        path: '/transactions/:id',
        builder: (context, state) {
          final txn = state.extra as TransactionModel?;
          final id = int.parse(state.pathParameters['id']!);
          return TransactionDetailScreen(transactionId: id, transaction: txn);
        },
      ),
      GoRoute(
        path: '/payment',
        builder: (context, state) => const PaymentScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
    ],
  );
});
